/**
 * Crawler Queue System
 *
 * POST /api/admin/intelligence/crawler - Add items to crawl queue
 * GET /api/admin/intelligence/crawler - Get queue status
 * POST /api/admin/intelligence/crawler/process - Process queue items (for cron/scheduled)
 *
 * This manages a persistent queue of URLs and leads to crawl, enrich, and verify.
 * Designed to be called periodically by a cron job or Cloudflare Scheduled Worker.
 */

import { scrapeRestaurantWebsite } from './_lib/scraper.js';
import { fetchAllPublicRecords, scrapeYelpBusiness } from './_lib/public-records.js';

// Queue item types
const QUEUE_TYPES = {
  WEBSITE_SCRAPE: 'website_scrape',
  ENRICH_LEAD: 'enrich_lead',
  VERIFY_DATA: 'verify_data',
  PUBLIC_RECORDS: 'public_records',
  SOCIAL_SCAN: 'social_scan',
  DISCOVERY: 'discovery',
};

// Priority levels
const PRIORITY = {
  CRITICAL: 1,   // Hot leads, client requests
  HIGH: 2,       // Leads with high scores
  NORMAL: 3,     // Regular processing
  LOW: 4,        // Background enrichment
  BACKGROUND: 5, // Continuous crawling
};

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { action = 'add' } = body;

    switch (action) {
      case 'add':
        return await addToQueue(env, body);
      case 'process':
        return await processQueue(env, body);
      case 'clear':
        return await clearQueue(env, body);
      case 'bulk_add':
        return await bulkAddToQueue(env, body);
      default:
        return Response.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Crawler error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function onRequestGet(context) {
  const { env } = context;

  try {
    // Get queue statistics
    const stats = await env.DB.prepare(`
      SELECT
        queue_type,
        status,
        COUNT(*) as count
      FROM crawler_queue
      GROUP BY queue_type, status
    `).all();

    const pending = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM crawler_queue WHERE status = 'pending'
    `).first();

    const processing = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM crawler_queue WHERE status = 'processing'
    `).first();

    const completed = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM crawler_queue
      WHERE status = 'completed' AND completed_at > unixepoch() - 86400
    `).first();

    const failed = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM crawler_queue
      WHERE status = 'failed' AND completed_at > unixepoch() - 86400
    `).first();

    // Get next items in queue
    const nextItems = await env.DB.prepare(`
      SELECT id, queue_type, target_url, target_id, priority, created_at
      FROM crawler_queue
      WHERE status = 'pending'
      ORDER BY priority ASC, created_at ASC
      LIMIT 10
    `).all();

    return Response.json({
      success: true,
      stats: {
        pending: pending?.count || 0,
        processing: processing?.count || 0,
        completed_24h: completed?.count || 0,
        failed_24h: failed?.count || 0,
        by_type: groupStats(stats.results || []),
      },
      next_items: nextItems.results || [],
    });
  } catch (error) {
    // If table doesn't exist, create it
    if (error.message.includes('no such table')) {
      await ensureQueueTable(env);
      return Response.json({
        success: true,
        stats: { pending: 0, processing: 0, completed_24h: 0, failed_24h: 0 },
        next_items: [],
        message: 'Queue table created',
      });
    }
    throw error;
  }
}

/**
 * Ensure crawler_queue table exists
 */
async function ensureQueueTable(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS crawler_queue (
      id TEXT PRIMARY KEY,
      queue_type TEXT NOT NULL,
      target_url TEXT,
      target_id TEXT,
      priority INTEGER DEFAULT 3,
      status TEXT DEFAULT 'pending',
      attempts INTEGER DEFAULT 0,
      max_attempts INTEGER DEFAULT 3,
      result_json TEXT,
      error_message TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      started_at INTEGER,
      completed_at INTEGER,
      scheduled_for INTEGER
    )
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_crawler_status ON crawler_queue(status, priority, created_at)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_crawler_target ON crawler_queue(target_id)
  `).run();
}

/**
 * Add item to crawl queue
 */
async function addToQueue(env, body) {
  const {
    type,
    url,
    lead_id,
    client_id,
    priority = PRIORITY.NORMAL,
    scheduled_for,
  } = body;

  if (!type || !QUEUE_TYPES[type.toUpperCase()]) {
    return Response.json({
      success: false,
      error: 'Valid type required: ' + Object.values(QUEUE_TYPES).join(', '),
    }, { status: 400 });
  }

  await ensureQueueTable(env);

  const id = 'crawl_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);

  await env.DB.prepare(`
    INSERT INTO crawler_queue (
      id, queue_type, target_url, target_id, priority, scheduled_for
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    type,
    url || null,
    lead_id || client_id || null,
    priority,
    scheduled_for || null
  ).run();

  return Response.json({
    success: true,
    queue_id: id,
    message: `Added to ${type} queue with priority ${priority}`,
  });
}

/**
 * Bulk add items to queue
 */
async function bulkAddToQueue(env, body) {
  const { items, type, priority = PRIORITY.NORMAL } = body;

  if (!items || !Array.isArray(items)) {
    return Response.json({ success: false, error: 'items array required' }, { status: 400 });
  }

  await ensureQueueTable(env);

  let added = 0;
  const errors = [];

  for (const item of items.slice(0, 100)) { // Limit to 100 at a time
    try {
      const id = 'crawl_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);

      await env.DB.prepare(`
        INSERT INTO crawler_queue (
          id, queue_type, target_url, target_id, priority
        ) VALUES (?, ?, ?, ?, ?)
      `).bind(
        id,
        item.type || type,
        item.url || null,
        item.lead_id || item.id || null,
        item.priority || priority
      ).run();

      added++;
    } catch (error) {
      errors.push({ item, error: error.message });
    }
  }

  return Response.json({
    success: true,
    added,
    errors: errors.length > 0 ? errors : undefined,
    message: `Added ${added} items to queue`,
  });
}

/**
 * Process items from the queue
 */
async function processQueue(env, body) {
  const { limit = 5, type } = body;

  await ensureQueueTable(env);

  // Get pending items
  let query = `
    SELECT * FROM crawler_queue
    WHERE status = 'pending'
    AND (scheduled_for IS NULL OR scheduled_for <= unixepoch())
    AND attempts < max_attempts
  `;
  const params = [];

  if (type) {
    query += ' AND queue_type = ?';
    params.push(type);
  }

  query += ' ORDER BY priority ASC, created_at ASC LIMIT ?';
  params.push(limit);

  const items = await env.DB.prepare(query).bind(...params).all();

  const results = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    details: [],
  };

  for (const item of (items.results || [])) {
    // Mark as processing
    await env.DB.prepare(`
      UPDATE crawler_queue
      SET status = 'processing', started_at = unixepoch(), attempts = attempts + 1
      WHERE id = ?
    `).bind(item.id).run();

    try {
      const result = await processQueueItem(env, item);
      results.processed++;

      if (result.success) {
        results.succeeded++;
        await env.DB.prepare(`
          UPDATE crawler_queue
          SET status = 'completed', completed_at = unixepoch(), result_json = ?
          WHERE id = ?
        `).bind(JSON.stringify(result), item.id).run();
      } else {
        results.failed++;
        const newStatus = item.attempts + 1 >= item.max_attempts ? 'failed' : 'pending';
        await env.DB.prepare(`
          UPDATE crawler_queue
          SET status = ?, error_message = ?, completed_at = unixepoch()
          WHERE id = ?
        `).bind(newStatus, result.error, item.id).run();
      }

      results.details.push({
        id: item.id,
        type: item.queue_type,
        success: result.success,
      });
    } catch (error) {
      results.failed++;
      const newStatus = item.attempts + 1 >= item.max_attempts ? 'failed' : 'pending';
      await env.DB.prepare(`
        UPDATE crawler_queue
        SET status = ?, error_message = ?
        WHERE id = ?
      `).bind(newStatus, error.message, item.id).run();

      results.details.push({
        id: item.id,
        type: item.queue_type,
        success: false,
        error: error.message,
      });
    }
  }

  return Response.json({
    success: true,
    ...results,
  });
}

/**
 * Process a single queue item based on its type
 */
async function processQueueItem(env, item) {
  switch (item.queue_type) {
    case QUEUE_TYPES.WEBSITE_SCRAPE:
      return await processWebsiteScrape(env, item);

    case QUEUE_TYPES.ENRICH_LEAD:
      return await processEnrichLead(env, item);

    case QUEUE_TYPES.VERIFY_DATA:
      return await processVerifyData(env, item);

    case QUEUE_TYPES.PUBLIC_RECORDS:
      return await processPublicRecords(env, item);

    case QUEUE_TYPES.SOCIAL_SCAN:
      return await processSocialScan(env, item);

    case QUEUE_TYPES.DISCOVERY:
      return await processDiscovery(env, item);

    default:
      return { success: false, error: 'Unknown queue type' };
  }
}

/**
 * Process website scrape
 */
async function processWebsiteScrape(env, item) {
  if (!item.target_url) {
    return { success: false, error: 'No URL to scrape' };
  }

  const scrapeResult = await scrapeRestaurantWebsite(item.target_url);

  if (!scrapeResult.success) {
    return { success: false, error: scrapeResult.errors.join(', ') };
  }

  // If we have a lead_id, update the lead with scraped data
  if (item.target_id) {
    await updateLeadFromScrape(env, item.target_id, scrapeResult);
  }

  return {
    success: true,
    data: scrapeResult,
    facts_extracted: countFacts(scrapeResult),
  };
}

/**
 * Process lead enrichment
 */
async function processEnrichLead(env, item) {
  if (!item.target_id) {
    return { success: false, error: 'No lead ID to enrich' };
  }

  const lead = await env.DB.prepare(
    'SELECT * FROM restaurant_leads WHERE id = ?'
  ).bind(item.target_id).first();

  if (!lead) {
    return { success: false, error: 'Lead not found' };
  }

  const enrichments = {};
  let factsCreated = 0;

  // If has website, scrape it
  if (lead.website) {
    const scrapeResult = await scrapeRestaurantWebsite(lead.website);
    if (scrapeResult.success) {
      await updateLeadFromScrape(env, item.target_id, scrapeResult);
      enrichments.website = scrapeResult;
    }
  }

  return {
    success: true,
    lead_id: item.target_id,
    enrichments,
    facts_created: factsCreated,
  };
}

/**
 * Process data verification
 */
async function processVerifyData(env, item) {
  if (!item.target_id) {
    return { success: false, error: 'No target ID for verification' };
  }

  const lead = await env.DB.prepare(
    'SELECT * FROM restaurant_leads WHERE id = ?'
  ).bind(item.target_id).first();

  if (!lead) {
    return { success: false, error: 'Lead not found' };
  }

  const verification = {
    email_valid: null,
    phone_valid: null,
    website_active: null,
  };

  // Check if website is still active
  if (lead.website) {
    try {
      const response = await fetch(lead.website, {
        method: 'HEAD',
        redirect: 'follow',
      });
      verification.website_active = response.ok;
    } catch {
      verification.website_active = false;
    }
  }

  // Update verification status
  await env.DB.prepare(`
    UPDATE restaurant_leads
    SET verified_at = unixepoch(), verification_json = ?
    WHERE id = ?
  `).bind(JSON.stringify(verification), item.target_id).run();

  return {
    success: true,
    lead_id: item.target_id,
    verification,
  };
}

/**
 * Process public records lookup
 */
async function processPublicRecords(env, item) {
  if (!item.target_id) {
    return { success: false, error: 'No target ID for public records' };
  }

  const lead = await env.DB.prepare(
    'SELECT * FROM restaurant_leads WHERE id = ?'
  ).bind(item.target_id).first();

  if (!lead) {
    return { success: false, error: 'Lead not found' };
  }

  const records = await fetchAllPublicRecords({
    name: lead.company_name,
    city: lead.city,
    state: lead.state || 'MA',
  });

  // Create facts from public records
  if (records.health_inspections?.found) {
    // Store health inspection data
  }

  return {
    success: true,
    lead_id: item.target_id,
    records,
  };
}

/**
 * Process social media scan
 */
async function processSocialScan(env, item) {
  const lead = await env.DB.prepare(
    'SELECT * FROM restaurant_leads WHERE id = ?'
  ).bind(item.target_id).first();

  if (!lead) {
    return { success: false, error: 'Lead not found' };
  }

  const social = {};

  // If we have a Yelp URL, scrape it
  // Note: This would need actual Yelp URL - for now just structure

  return {
    success: true,
    lead_id: item.target_id,
    social,
  };
}

/**
 * Process discovery task
 */
async function processDiscovery(env, item) {
  // This would handle location-based discovery
  return {
    success: true,
    message: 'Discovery task processed',
  };
}

/**
 * Update lead from scrape results
 */
async function updateLeadFromScrape(env, leadId, scrapeResult) {
  const updates = [];
  const values = [];

  if (scrapeResult.tech_stack.pos_system) {
    updates.push('current_pos = ?');
    values.push(scrapeResult.tech_stack.pos_system);
  }

  if (scrapeResult.contacts.phones?.[0]) {
    updates.push('phone = COALESCE(phone, ?)');
    values.push(scrapeResult.contacts.phones[0]);
  }

  if (scrapeResult.contacts.emails?.[0]) {
    updates.push('email = COALESCE(email, ?)');
    values.push(scrapeResult.contacts.emails[0]);
  }

  if (updates.length > 0) {
    values.push(leadId);
    await env.DB.prepare(`
      UPDATE restaurant_leads
      SET ${updates.join(', ')}, updated_at = unixepoch()
      WHERE id = ?
    `).bind(...values).run();
  }
}

/**
 * Count facts from scrape result
 */
function countFacts(scrapeResult) {
  let count = 0;
  if (scrapeResult.tech_stack.pos_system) count++;
  if (scrapeResult.tech_stack.online_ordering) count++;
  if (scrapeResult.contacts.phones?.length) count++;
  if (scrapeResult.contacts.emails?.length) count++;
  if (scrapeResult.data.cuisine_hints?.length) count++;
  return count;
}

/**
 * Group stats by type
 */
function groupStats(stats) {
  const grouped = {};
  for (const stat of stats) {
    if (!grouped[stat.queue_type]) {
      grouped[stat.queue_type] = { pending: 0, processing: 0, completed: 0, failed: 0 };
    }
    grouped[stat.queue_type][stat.status] = stat.count;
  }
  return grouped;
}

/**
 * Clear queue items
 */
async function clearQueue(env, body) {
  const { status = 'completed', older_than_days = 7 } = body;

  await ensureQueueTable(env);

  const cutoff = Math.floor(Date.now() / 1000) - (older_than_days * 86400);

  const result = await env.DB.prepare(`
    DELETE FROM crawler_queue
    WHERE status = ? AND completed_at < ?
  `).bind(status, cutoff).run();

  return Response.json({
    success: true,
    deleted: result.meta?.changes || 0,
    message: `Cleared ${status} items older than ${older_than_days} days`,
  });
}
