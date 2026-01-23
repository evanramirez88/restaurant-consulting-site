/**
 * Context Engine Connector
 * =========================
 * Shared utility for the Platform to access data from the Data Context Engine.
 *
 * Two access modes:
 *   1. SYNCED (Primary): Read from D1 tables populated by context/sync.js
 *   2. LIVE (Optional): Pull directly from DATA_CONTEXT API when available
 *
 * The Data Context Engine is treated as a BLACK BOX external API.
 * We ONLY read from it. We do NOT modify its internals.
 *
 * All data returned is filtered through the Data Gatekeeper
 * to ensure personal data never surfaces in business queries.
 */

import { filterQueryResults, filterBatch, classifyPrivacy } from './data-gatekeeper.js';

/**
 * Context Engine client for accessing synced business data.
 */
export class ContextEngine {
  /**
   * @param {Object} env - Cloudflare Workers environment (DB, KV, etc.)
   */
  constructor(env) {
    this.db = env.DB;
    this.kv = env.RATE_LIMIT_KV; // Reuse KV for caching
    this.contextApiUrl = env.CONTEXT_ENGINE_URL || null; // Optional live endpoint
    this.contextApiKey = env.CONTEXT_ENGINE_KEY || null;
  }

  // ===========================================================================
  // SYNCED DATA ACCESS (Primary - reads from D1)
  // ===========================================================================

  /**
   * Get recent business communications for a contact.
   * @param {string} contactId - Contact ID
   * @param {number} limit - Max results
   * @returns {Array} Filtered communications
   */
  async getContactCommunications(contactId, limit = 20) {
    const result = await this.db.prepare(`
      SELECT c.*, k.name as contact_name, k.company, k.email as contact_email
      FROM synced_communications c
      LEFT JOIN synced_contacts k ON c.contact_id = k.id
      WHERE c.contact_id = ?
      AND c.privacy_level IN ('business', 'public')
      ORDER BY c.occurred_at DESC
      LIMIT ?
    `).bind(contactId, limit).all();

    return filterQueryResults(result.results);
  }

  /**
   * Get all recent business communications across all contacts.
   * Used by Business Brief for daily digest.
   * @param {number} sinceDaysAgo - How far back to look
   * @param {number} limit - Max results
   * @returns {Array} Filtered communications
   */
  async getRecentBusinessActivity(sinceDaysAgo = 7, limit = 50) {
    const sinceTimestamp = Math.floor(Date.now() / 1000) - (sinceDaysAgo * 86400);

    const result = await this.db.prepare(`
      SELECT c.*, k.name as contact_name, k.company
      FROM synced_communications c
      LEFT JOIN synced_contacts k ON c.contact_id = k.id
      WHERE c.occurred_at > ?
      AND c.privacy_level IN ('business', 'public')
      ORDER BY c.occurred_at DESC
      LIMIT ?
    `).bind(sinceTimestamp, limit).all();

    return filterQueryResults(result.results);
  }

  /**
   * Search context items by keyword (business data only).
   * @param {string} query - Search term
   * @param {Object} options - { type, limit }
   * @returns {Array} Filtered context items
   */
  async searchContext(query, options = {}) {
    const { type, limit = 20 } = options;
    const searchTerm = `%${query}%`;

    let sql = `
      SELECT * FROM context_items
      WHERE privacy_level IN ('business', 'public')
      AND (content LIKE ? OR summary LIKE ? OR tags LIKE ?)
    `;
    const binds = [searchTerm, searchTerm, searchTerm];

    if (type) {
      sql += ` AND type = ?`;
      binds.push(type);
    }

    sql += ` ORDER BY relevance_score DESC, created_at DESC LIMIT ?`;
    binds.push(limit);

    const result = await this.db.prepare(sql).bind(...binds).all();
    return filterQueryResults(result.results);
  }

  /**
   * Get business contacts matching criteria.
   * @param {Object} filters - { search, source, limit }
   * @returns {Array} Filtered contacts
   */
  async getBusinessContacts(filters = {}) {
    const { search, source, limit = 50 } = filters;

    let sql = `SELECT * FROM synced_contacts WHERE privacy_level IN ('business', 'public')`;
    const binds = [];

    if (search) {
      sql += ` AND (name LIKE ? OR company LIKE ? OR email LIKE ?)`;
      binds.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (source) {
      sql += ` AND source = ?`;
      binds.push(source);
    }

    sql += ` ORDER BY last_interaction_at DESC LIMIT ?`;
    binds.push(limit);

    const result = await this.db.prepare(sql).bind(...binds).all();
    return filterQueryResults(result.results);
  }

  /**
   * Get a single contact with their recent communications.
   * @param {string} contactId - Contact ID
   * @returns {Object|null} Contact with communications
   */
  async getContactProfile(contactId) {
    const contact = await this.db.prepare(`
      SELECT * FROM synced_contacts
      WHERE id = ? AND privacy_level IN ('business', 'public')
    `).bind(contactId).first();

    if (!contact) return null;

    const comms = await this.getContactCommunications(contactId, 10);

    return {
      ...contact,
      recent_communications: comms
    };
  }

  /**
   * Get context items by type (facts, transcripts, documents).
   * @param {string} type - Item type
   * @param {number} limit - Max results
   * @returns {Array} Filtered items
   */
  async getContextByType(type, limit = 20) {
    const result = await this.db.prepare(`
      SELECT * FROM context_items
      WHERE type = ? AND privacy_level IN ('business', 'public')
      ORDER BY relevance_score DESC, created_at DESC
      LIMIT ?
    `).bind(type, limit).all();

    return filterQueryResults(result.results);
  }

  /**
   * Get the daily business brief data package.
   * Aggregates recent activity, pending items, and key metrics.
   * @returns {Object} Business brief data
   */
  async getBusinessBriefData() {
    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - 86400;
    const oneWeekAgo = now - (7 * 86400);

    // Recent communications (last 24h)
    const recentComms = await this.db.prepare(`
      SELECT c.type, COUNT(*) as count,
        MAX(c.occurred_at) as latest
      FROM synced_communications c
      WHERE c.occurred_at > ? AND c.privacy_level IN ('business', 'public')
      GROUP BY c.type
    `).bind(oneDayAgo).all();

    // Active contacts (interacted in last 7 days)
    const activeContacts = await this.db.prepare(`
      SELECT COUNT(DISTINCT contact_id) as count
      FROM synced_communications
      WHERE occurred_at > ? AND privacy_level IN ('business', 'public')
    `).bind(oneWeekAgo).first();

    // Recent context items (facts, transcripts added)
    const recentItems = await this.db.prepare(`
      SELECT type, COUNT(*) as count
      FROM context_items
      WHERE created_at > ? AND privacy_level IN ('business', 'public')
      GROUP BY type
    `).bind(oneDayAgo).all();

    // Last sync status
    const lastSync = await this.db.prepare(`
      SELECT * FROM context_ingestion_log
      ORDER BY created_at DESC LIMIT 1
    `).first();

    return {
      period: { from: oneDayAgo, to: now },
      communications: recentComms.results || [],
      active_contacts: activeContacts?.count || 0,
      new_context_items: recentItems.results || [],
      last_sync: lastSync,
      engine_status: this.contextApiUrl ? 'configured' : 'sync_only'
    };
  }

  // ===========================================================================
  // LIVE ENGINE ACCESS (Optional - direct calls to DATA_CONTEXT API)
  // ===========================================================================

  /**
   * Check if live Context Engine is available.
   * @returns {boolean}
   */
  isLiveEngineConfigured() {
    return !!(this.contextApiUrl && this.contextApiKey);
  }

  /**
   * Pull fresh data from the live Context Engine.
   * Only works if CONTEXT_ENGINE_URL is configured (e.g., via Cloudflare Tunnel).
   *
   * @param {string} endpoint - API path on the Context Engine
   * @param {Object} params - Query parameters
   * @returns {Object|null} Filtered response data, or null if unavailable
   */
  async pullFromEngine(endpoint, params = {}) {
    if (!this.isLiveEngineConfigured()) {
      return null; // Engine not reachable, use synced data
    }

    try {
      const url = new URL(endpoint, this.contextApiUrl);
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${this.contextApiKey}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(5000) // 5s timeout
      });

      if (!response.ok) {
        console.error(`Context Engine error: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = await response.json();

      // Apply gatekeeper to live response
      if (data.items && Array.isArray(data.items)) {
        const { allowed } = filterBatch(data.items);
        return { ...data, items: allowed };
      }

      return data;

    } catch (error) {
      // Engine is offline or unreachable - not critical, use synced data
      console.warn(`Context Engine unreachable: ${error.message}`);
      return null;
    }
  }

  /**
   * Request a fresh sync from the Context Engine.
   * Triggers the engine to push latest data to our sync endpoint.
   *
   * @returns {boolean} True if trigger was sent successfully
   */
  async requestSync() {
    if (!this.isLiveEngineConfigured()) return false;

    try {
      const response = await fetch(new URL('/api/sync/trigger', this.contextApiUrl), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.contextApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          target: 'business_platform',
          filter: 'business_only'
        }),
        signal: AbortSignal.timeout(5000)
      });

      return response.ok;
    } catch (error) {
      console.warn(`Sync trigger failed: ${error.message}`);
      return false;
    }
  }

  // ===========================================================================
  // ENRICHMENT HELPERS
  // ===========================================================================

  /**
   * Find matching context for a restaurant lead.
   * Searches communications, contacts, and context items for anything
   * related to a specific business.
   *
   * @param {Object} lead - Restaurant lead { name, domain, email, phone }
   * @returns {Object} Matching context data
   */
  async findLeadContext(lead) {
    const results = {
      contact: null,
      communications: [],
      context_items: []
    };

    // Try to find matching contact
    if (lead.email) {
      results.contact = await this.db.prepare(`
        SELECT * FROM synced_contacts
        WHERE email = ? AND privacy_level IN ('business', 'public')
      `).bind(lead.email).first();
    }

    if (!results.contact && lead.phone) {
      results.contact = await this.db.prepare(`
        SELECT * FROM synced_contacts
        WHERE phone = ? AND privacy_level IN ('business', 'public')
      `).bind(lead.phone).first();
    }

    // Get communications for matched contact
    if (results.contact) {
      results.communications = await this.getContactCommunications(results.contact.id, 5);
    }

    // Search context items for business name
    if (lead.name) {
      results.context_items = await this.searchContext(lead.name, { limit: 5 });
    }

    return results;
  }

  /**
   * Get sync health status.
   * @returns {Object} Sync status info
   */
  async getSyncStatus() {
    const recentLogs = await this.db.prepare(`
      SELECT * FROM context_ingestion_log
      ORDER BY created_at DESC LIMIT 5
    `).all();

    const totalItems = await this.db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM context_items WHERE privacy_level IN ('business', 'public')) as context_items,
        (SELECT COUNT(*) FROM synced_contacts WHERE privacy_level IN ('business', 'public')) as contacts,
        (SELECT COUNT(*) FROM synced_communications WHERE privacy_level IN ('business', 'public')) as communications
    `).first();

    return {
      live_engine: this.isLiveEngineConfigured(),
      recent_syncs: recentLogs.results || [],
      totals: totalItems || { context_items: 0, contacts: 0, communications: 0 }
    };
  }
}

/**
 * Factory function - creates a ContextEngine instance from env.
 * @param {Object} env - Cloudflare Workers environment
 * @returns {ContextEngine}
 */
export function createContextEngine(env) {
  return new ContextEngine(env);
}
