/**
 * Session Manager - Multi-tenant Cookie Isolation
 *
 * Manages browser sessions with complete cookie isolation per client.
 * Supports session persistence, warm starts, and concurrent client access.
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class SessionManager {
  constructor(options = {}) {
    this.sessionsDir = options.sessionsDir || path.join(process.cwd(), 'sessions');
    this.encryptionKey = options.encryptionKey || process.env.SESSION_ENCRYPTION_KEY;
    this.maxSessionAge = options.maxSessionAge || 24 * 60 * 60 * 1000; // 24 hours
    this.activeSessions = new Map();
    this.sessionLocks = new Map();
  }

  /**
   * Initialize session storage directory
   */
  async initialize() {
    try {
      await fs.mkdir(this.sessionsDir, { recursive: true });
      await this._cleanExpiredSessions();
    } catch (error) {
      console.error('Failed to initialize session manager:', error);
      throw error;
    }
  }

  /**
   * Get or create a session for a client
   * @param {string} clientId - Unique client identifier (Toast GUID or internal ID)
   * @param {object} browser - Playwright browser instance
   * @returns {object} Session context with page and metadata
   */
  async getSession(clientId, browser) {
    const sessionId = this._generateSessionId(clientId);

    // Check for active session
    if (this.activeSessions.has(sessionId)) {
      const session = this.activeSessions.get(sessionId);
      if (await this._validateSession(session)) {
        session.lastAccessed = Date.now();
        return session;
      }
      // Session invalid, clean up
      await this.destroySession(clientId);
    }

    // Acquire lock for this client
    await this._acquireLock(clientId);

    try {
      // Try to restore from persisted state
      const persistedState = await this._loadPersistedSession(clientId);

      // Create new browser context with isolation
      const contextOptions = {
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'en-US',
        timezoneId: 'America/New_York',
        // Restore cookies if we have persisted state
        storageState: persistedState?.storageState || undefined
      };

      const context = await browser.newContext(contextOptions);
      const page = await context.newPage();

      // Set up request interception for session management
      await this._setupRequestInterception(context, clientId);

      const session = {
        id: sessionId,
        clientId,
        context,
        page,
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        isAuthenticated: persistedState?.isAuthenticated || false,
        toastGuid: persistedState?.toastGuid || null,
        metadata: persistedState?.metadata || {}
      };

      this.activeSessions.set(sessionId, session);
      return session;

    } finally {
      this._releaseLock(clientId);
    }
  }

  /**
   * Persist session state for warm restarts
   * @param {string} clientId - Client identifier
   */
  async persistSession(clientId) {
    const sessionId = this._generateSessionId(clientId);
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      throw new Error(`No active session for client: ${clientId}`);
    }

    try {
      // Get storage state (cookies, localStorage, sessionStorage)
      const storageState = await session.context.storageState();

      const persistedData = {
        clientId,
        storageState,
        isAuthenticated: session.isAuthenticated,
        toastGuid: session.toastGuid,
        metadata: session.metadata,
        persistedAt: Date.now()
      };

      // Encrypt and save
      const encrypted = this._encrypt(JSON.stringify(persistedData));
      const filePath = path.join(this.sessionsDir, `${sessionId}.session`);
      await fs.writeFile(filePath, encrypted);

      console.log(`Session persisted for client: ${clientId}`);
    } catch (error) {
      console.error(`Failed to persist session for ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Destroy a session and clean up resources
   * @param {string} clientId - Client identifier
   */
  async destroySession(clientId) {
    const sessionId = this._generateSessionId(clientId);
    const session = this.activeSessions.get(sessionId);

    if (session) {
      try {
        await session.page?.close();
        await session.context?.close();
      } catch (error) {
        console.warn(`Error closing session resources: ${error.message}`);
      }
      this.activeSessions.delete(sessionId);
    }

    // Remove persisted state
    try {
      const filePath = path.join(this.sessionsDir, `${sessionId}.session`);
      await fs.unlink(filePath);
    } catch (error) {
      // File may not exist, ignore
    }
  }

  /**
   * Mark session as authenticated
   * @param {string} clientId - Client identifier
   * @param {string} toastGuid - Toast restaurant GUID
   */
  async markAuthenticated(clientId, toastGuid) {
    const sessionId = this._generateSessionId(clientId);
    const session = this.activeSessions.get(sessionId);

    if (session) {
      session.isAuthenticated = true;
      session.toastGuid = toastGuid;
      await this.persistSession(clientId);
    }
  }

  /**
   * Check if session is authenticated
   * @param {string} clientId - Client identifier
   * @returns {boolean}
   */
  isAuthenticated(clientId) {
    const sessionId = this._generateSessionId(clientId);
    const session = this.activeSessions.get(sessionId);
    return session?.isAuthenticated || false;
  }

  /**
   * Get all active sessions
   * @returns {Array} List of active session info
   */
  getActiveSessions() {
    return Array.from(this.activeSessions.values()).map(s => ({
      clientId: s.clientId,
      createdAt: s.createdAt,
      lastAccessed: s.lastAccessed,
      isAuthenticated: s.isAuthenticated,
      toastGuid: s.toastGuid
    }));
  }

  /**
   * Switch to a different client within the same browser
   * Useful for multi-location Toast accounts
   * @param {string} currentClientId - Current client
   * @param {string} newClientId - Target client
   */
  async switchClient(currentClientId, newClientId) {
    const currentSession = this.activeSessions.get(this._generateSessionId(currentClientId));

    if (!currentSession) {
      throw new Error(`No active session for client: ${currentClientId}`);
    }

    // Persist current state
    await this.persistSession(currentClientId);

    // Mark as switched (not destroyed, can switch back)
    currentSession.metadata.switchedFrom = currentClientId;
    currentSession.metadata.switchedAt = Date.now();

    return { success: true, previousClient: currentClientId };
  }

  // ============ Private Methods ============

  _generateSessionId(clientId) {
    return crypto.createHash('sha256').update(clientId).digest('hex').substring(0, 16);
  }

  async _loadPersistedSession(clientId) {
    const sessionId = this._generateSessionId(clientId);
    const filePath = path.join(this.sessionsDir, `${sessionId}.session`);

    try {
      const encrypted = await fs.readFile(filePath, 'utf8');
      const decrypted = this._decrypt(encrypted);
      const data = JSON.parse(decrypted);

      // Check if session is too old
      if (Date.now() - data.persistedAt > this.maxSessionAge) {
        await fs.unlink(filePath);
        return null;
      }

      return data;
    } catch (error) {
      // File doesn't exist or is corrupted
      return null;
    }
  }

  async _validateSession(session) {
    try {
      // Check if page is still valid
      await session.page.evaluate(() => document.readyState);
      return true;
    } catch {
      return false;
    }
  }

  async _setupRequestInterception(context, clientId) {
    // Log all requests for debugging
    context.on('request', request => {
      if (request.url().includes('toasttab.com')) {
        console.log(`[${clientId}] Request: ${request.method()} ${request.url()}`);
      }
    });

    // Capture authentication responses
    context.on('response', async response => {
      const url = response.url();
      if (url.includes('/authentication/') || url.includes('/login')) {
        const status = response.status();
        console.log(`[${clientId}] Auth Response: ${status} ${url}`);
      }
    });
  }

  async _acquireLock(clientId) {
    while (this.sessionLocks.get(clientId)) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    this.sessionLocks.set(clientId, true);
  }

  _releaseLock(clientId) {
    this.sessionLocks.delete(clientId);
  }

  async _cleanExpiredSessions() {
    try {
      const files = await fs.readdir(this.sessionsDir);
      const now = Date.now();

      for (const file of files) {
        if (!file.endsWith('.session')) continue;

        const filePath = path.join(this.sessionsDir, file);
        const stats = await fs.stat(filePath);

        if (now - stats.mtimeMs > this.maxSessionAge) {
          await fs.unlink(filePath);
          console.log(`Cleaned expired session: ${file}`);
        }
      }
    } catch (error) {
      console.error('Error cleaning expired sessions:', error);
    }
  }

  _encrypt(text) {
    if (!this.encryptionKey) {
      // No encryption key, store as base64
      return Buffer.from(text).toString('base64');
    }

    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  _decrypt(text) {
    if (!this.encryptionKey) {
      return Buffer.from(text, 'base64').toString('utf8');
    }

    const [ivHex, encrypted] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

module.exports = SessionManager;
