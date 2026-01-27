/**
 * Browser Service API
 * ===================
 * Decoupled headless browser automation service for Toast ABO.
 *
 * Primary: Playwright for reliable automation
 * Secondary: Puppeteer for network interception
 *
 * API Endpoints:
 *
 * Health & Status:
 *   GET  /health                    - Health check
 *   GET  /sessions                  - List active sessions
 *   GET  /metrics                   - Performance metrics
 *
 * Session Management:
 *   POST /session/create            - Create new browser session
 *   DELETE /session/:id             - Close session
 *
 * Navigation:
 *   POST /session/:id/navigate      - Navigate to URL
 *   POST /session/:id/back          - Go back
 *   POST /session/:id/refresh       - Refresh page
 *
 * Interaction:
 *   POST /session/:id/click         - Click element
 *   POST /session/:id/type          - Type text
 *   POST /session/:id/select        - Select option
 *   POST /session/:id/screenshot    - Take screenshot
 *   POST /session/:id/evaluate      - Execute JavaScript
 *
 * Toast-Specific:
 *   POST /toast/login               - Login to Toast back-office
 *   POST /toast/switch-client       - Switch to client restaurant
 *   POST /toast/execute-job         - Execute automation job
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs').promises;

// Load environment
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_SESSIONS = parseInt(process.env.MAX_CONCURRENT_SESSIONS) || 3;
const BROWSER_TIMEOUT = parseInt(process.env.BROWSER_TIMEOUT) || 60000;
const SCREENSHOTS_DIR = process.env.SCREENSHOTS_DIR || '/data/screenshots';
const SESSIONS_DIR = process.env.SESSIONS_DIR || '/data/sessions';

// ============================================================
// SESSION STORE
// ============================================================

const sessions = new Map();
// sessionId -> { browser, context, page, createdAt, lastActive, clientId }

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));

// API Key validation (optional, for production)
app.use((req, res, next) => {
  // Skip auth for health check
  if (req.path === '/health') return next();

  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.BROWSER_API_KEY;

  if (expectedKey && apiKey !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
});

// ============================================================
// HEALTH & STATUS ENDPOINTS
// ============================================================

app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    sessions: {
      active: sessions.size,
      max: MAX_SESSIONS
    },
    uptime: process.uptime()
  };
  res.json(health);
});

app.get('/sessions', (req, res) => {
  const sessionList = Array.from(sessions.entries()).map(([id, session]) => ({
    id,
    clientId: session.clientId,
    createdAt: session.createdAt,
    lastActive: session.lastActive,
    url: session.page?.url() || null
  }));
  res.json({ sessions: sessionList });
});

app.get('/metrics', (req, res) => {
  res.json({
    activeSessions: sessions.size,
    maxSessions: MAX_SESSIONS,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime()
  });
});

// ============================================================
// SESSION MANAGEMENT
// ============================================================

app.post('/session/create', async (req, res) => {
  try {
    if (sessions.size >= MAX_SESSIONS) {
      return res.status(429).json({
        error: 'Max sessions reached',
        max: MAX_SESSIONS
      });
    }

    const {
      browser: browserType = 'chromium',
      headless = true,
      clientId = null
    } = req.body;

    const sessionId = uuidv4().substring(0, 8);

    console.log(`Creating session ${sessionId} for client ${clientId || 'unknown'}`);

    // Launch browser
    const browser = await chromium.launch({
      headless: headless !== false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    // Create context with persistent cookies
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    // Create page
    const page = await context.newPage();
    page.setDefaultTimeout(BROWSER_TIMEOUT);

    // Store session
    sessions.set(sessionId, {
      browser,
      context,
      page,
      clientId,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    });

    // Set up auto-cleanup on disconnect
    browser.on('disconnected', () => {
      console.log(`Browser disconnected for session ${sessionId}`);
      sessions.delete(sessionId);
    });

    res.json({
      sessionId,
      status: 'created',
      message: 'Browser session ready'
    });

  } catch (error) {
    console.error('Session creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/session/:id', async (req, res) => {
  const { id } = req.params;
  const session = sessions.get(id);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    await session.browser.close();
    sessions.delete(id);
    res.json({ status: 'closed', sessionId: id });
  } catch (error) {
    sessions.delete(id);
    res.json({ status: 'closed', sessionId: id, note: 'Force closed' });
  }
});

// ============================================================
// NAVIGATION
// ============================================================

app.post('/session/:id/navigate', async (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  try {
    const { url, waitUntil = 'domcontentloaded' } = req.body;

    await session.page.goto(url, { waitUntil, timeout: BROWSER_TIMEOUT });
    updateActivity(session);

    res.json({
      status: 'navigated',
      url: session.page.url(),
      title: await session.page.title()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/session/:id/back', async (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  try {
    await session.page.goBack();
    updateActivity(session);
    res.json({ status: 'navigated_back', url: session.page.url() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/session/:id/refresh', async (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  try {
    await session.page.reload();
    updateActivity(session);
    res.json({ status: 'refreshed', url: session.page.url() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// INTERACTION
// ============================================================

app.post('/session/:id/click', async (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  try {
    const { selector, x, y, timeout = 5000 } = req.body;

    if (selector) {
      await session.page.click(selector, { timeout });
    } else if (x !== undefined && y !== undefined) {
      await session.page.mouse.click(x, y);
    } else {
      return res.status(400).json({ error: 'Provide selector or x,y coordinates' });
    }

    updateActivity(session);
    res.json({ status: 'clicked', selector, x, y });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/session/:id/type', async (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  try {
    const { selector, text, delay = 50, clear = false } = req.body;

    if (clear) {
      await session.page.fill(selector, '');
    }
    await session.page.type(selector, text, { delay });

    updateActivity(session);
    res.json({ status: 'typed', selector, length: text.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/session/:id/select', async (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  try {
    const { selector, value } = req.body;
    await session.page.selectOption(selector, value);

    updateActivity(session);
    res.json({ status: 'selected', selector, value });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/session/:id/screenshot', async (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  try {
    const { fullPage = false, selector = null, format = 'png' } = req.body;
    const filename = `screenshot_${req.params.id}_${Date.now()}.${format}`;
    const filepath = path.join(SCREENSHOTS_DIR, filename);

    let screenshot;
    if (selector) {
      const element = await session.page.$(selector);
      screenshot = await element.screenshot({ path: filepath, type: format });
    } else {
      screenshot = await session.page.screenshot({
        path: filepath,
        fullPage,
        type: format
      });
    }

    updateActivity(session);

    res.json({
      status: 'captured',
      filename,
      path: filepath,
      base64: screenshot.toString('base64')
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/session/:id/evaluate', async (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  try {
    const { script } = req.body;
    const result = await session.page.evaluate(script);

    updateActivity(session);
    res.json({ status: 'evaluated', result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// TOAST-SPECIFIC ENDPOINTS
// ============================================================

app.post('/toast/login', async (req, res) => {
  const { sessionId, email, password, totpSecret } = req.body;
  const session = getSession(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  try {
    const page = session.page;

    // Navigate to Toast login
    await page.goto('https://pos.toasttab.com/login', {
      waitUntil: 'networkidle'
    });

    // Fill credentials
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    // Wait for either dashboard or 2FA
    await page.waitForURL(/dashboard|verify/, { timeout: 30000 });

    // Check if 2FA is required
    if (page.url().includes('verify') && totpSecret) {
      // Generate TOTP code
      const totp = generateTOTP(totpSecret);
      await page.fill('input[name="code"]', totp);
      await page.click('button[type="submit"]');
      await page.waitForURL(/dashboard/, { timeout: 30000 });
    }

    // Save cookies for session persistence
    const cookies = await session.context.cookies();
    await saveCookies(sessionId, cookies);

    updateActivity(session);
    res.json({
      status: 'logged_in',
      url: page.url(),
      message: 'Successfully logged into Toast'
    });

  } catch (error) {
    console.error('Toast login error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/toast/switch-client', async (req, res) => {
  const { sessionId, restaurantGuid } = req.body;
  const session = getSession(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  try {
    const page = session.page;

    // Navigate to restaurant switcher or directly to restaurant
    const switchUrl = `https://pos.toasttab.com/restaurants/${restaurantGuid}/dashboard`;
    await page.goto(switchUrl, { waitUntil: 'networkidle' });

    // Verify we're in the right restaurant
    const currentUrl = page.url();
    if (!currentUrl.includes(restaurantGuid)) {
      throw new Error('Failed to switch to restaurant');
    }

    // Update session with client context
    session.clientId = restaurantGuid;
    updateActivity(session);

    res.json({
      status: 'switched',
      restaurantGuid,
      url: currentUrl
    });

  } catch (error) {
    console.error('Client switch error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/toast/execute-job', async (req, res) => {
  const { sessionId, jobType, jobData } = req.body;
  const session = getSession(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  try {
    // Job execution would be expanded based on jobType
    // For now, return a placeholder
    res.json({
      status: 'job_received',
      jobType,
      message: 'Job execution not yet implemented in browser-service. Use n8n workflow to orchestrate.'
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getSession(id) {
  return sessions.get(id);
}

function updateActivity(session) {
  session.lastActive = new Date().toISOString();
}

async function saveCookies(sessionId, cookies) {
  const filepath = path.join(SESSIONS_DIR, `${sessionId}_cookies.json`);
  await fs.mkdir(SESSIONS_DIR, { recursive: true });
  await fs.writeFile(filepath, JSON.stringify(cookies, null, 2));
}

async function loadCookies(sessionId) {
  try {
    const filepath = path.join(SESSIONS_DIR, `${sessionId}_cookies.json`);
    const data = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function generateTOTP(secret) {
  // Simple TOTP implementation
  // In production, use a library like 'otpauth'
  const { createHmac } = require('crypto');
  const time = Math.floor(Date.now() / 30000);
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(time));

  const hmac = createHmac('sha1', Buffer.from(secret, 'base32'));
  hmac.update(buffer);
  const hash = hmac.digest();

  const offset = hash[hash.length - 1] & 0x0f;
  const code = (hash.readUInt32BE(offset) & 0x7fffffff) % 1000000;

  return code.toString().padStart(6, '0');
}

// ============================================================
// SESSION CLEANUP (Auto-close idle sessions)
// ============================================================

setInterval(() => {
  const now = Date.now();
  const IDLE_TIMEOUT = 10 * 60 * 1000; // 10 minutes

  for (const [id, session] of sessions.entries()) {
    const lastActive = new Date(session.lastActive).getTime();
    if (now - lastActive > IDLE_TIMEOUT) {
      console.log(`Closing idle session ${id}`);
      session.browser.close().catch(() => {});
      sessions.delete(id);
    }
  }
}, 60000); // Check every minute

// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Browser Service running on port ${PORT}`);
  console.log(`Max concurrent sessions: ${MAX_SESSIONS}`);
  console.log(`Screenshots directory: ${SCREENSHOTS_DIR}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down browser service...');
  for (const [id, session] of sessions.entries()) {
    await session.browser.close().catch(() => {});
  }
  process.exit(0);
});
