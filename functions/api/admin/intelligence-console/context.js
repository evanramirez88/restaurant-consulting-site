/**
 * Intelligence Console Context API
 * Manages data context from multiple sources
 *
 * GET /api/admin/intelligence-console/context - Get context summary
 * GET /api/admin/intelligence-console/context/search - Semantic search across context
 * POST /api/admin/intelligence-console/context/sync - Trigger source sync
 * POST /api/admin/intelligence-console/context/ingest - Manually ingest data
 */

import { verifyAuth, unauthorizedResponse, handleOptions } from '../../../_shared/auth.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestGet(context) {
  const { request, env } = context;

  const auth = await verifyAuth(request, env);
  if (!auth.authenticated) {
    return unauthorizedResponse(auth.error, request);
  }

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action'); // 'summary', 'search', 'recent', 'sources'

    if (action === 'search') {
      // Semantic search across context items
      const query = url.searchParams.get('q');
      const sourceType = url.searchParams.get('source');
      const limit = parseInt(url.searchParams.get('limit') || '20', 10);

      if (!query) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Query parameter "q" is required'
        }), { status: 400, headers: corsHeaders });
      }

      let searchQuery = `
        SELECT
          ci.*,
          ds.name as source_name
        FROM context_items ci
        JOIN context_data_sources ds ON ci.source_id = ds.id
        WHERE ci.content LIKE ?
      `;
      const params = [`%${query}%`];

      if (sourceType) {
        searchQuery += ' AND ds.source_type = ?';
        params.push(sourceType);
      }

      searchQuery += ' ORDER BY ci.timestamp DESC LIMIT ?';
      params.push(limit);

      const results = await env.DB.prepare(searchQuery).bind(...params).all();

      return new Response(JSON.stringify({
        success: true,
        query,
        results: results.results || [],
        count: results.results?.length || 0
      }), { headers: corsHeaders });
    }

    if (action === 'recent') {
      // Get recent context items
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      const sourceType = url.searchParams.get('source');

      let query = `
        SELECT
          ci.*,
          ds.name as source_name
        FROM context_items ci
        JOIN context_data_sources ds ON ci.source_id = ds.id
        WHERE 1=1
      `;
      const params = [];

      if (sourceType) {
        query += ' AND ds.source_type = ?';
        params.push(sourceType);
      }

      query += ' ORDER BY ci.timestamp DESC LIMIT ?';
      params.push(limit);

      const results = await env.DB.prepare(query).bind(...params).all();

      return new Response(JSON.stringify({
        success: true,
        items: results.results || []
      }), { headers: corsHeaders });
    }

    if (action === 'sources') {
      // Get data sources with stats
      const sources = await env.DB.prepare(`
        SELECT
          ds.*,
          COUNT(ci.id) as item_count,
          MAX(ci.timestamp) as latest_item
        FROM context_data_sources ds
        LEFT JOIN context_items ci ON ds.id = ci.source_id
        GROUP BY ds.id
        ORDER BY ds.tier, ds.name
      `).all();

      return new Response(JSON.stringify({
        success: true,
        sources: sources.results || []
      }), { headers: corsHeaders });
    }

    // Default: Get context summary
    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - 86400;
    const oneWeekAgo = now - 604800;

    const [
      totalItems,
      itemsByType,
      itemsBySource,
      recentItems,
      dataSources
    ] = await Promise.all([
      // Total context items
      env.DB.prepare('SELECT COUNT(*) as count FROM context_items').first().catch(() => ({ count: 0 })),

      // Items by type
      env.DB.prepare(`
        SELECT item_type, COUNT(*) as count
        FROM context_items
        GROUP BY item_type
        ORDER BY count DESC
      `).all().catch(() => ({ results: [] })),

      // Items by source
      env.DB.prepare(`
        SELECT ds.name, ds.source_type, COUNT(ci.id) as count
        FROM context_data_sources ds
        LEFT JOIN context_items ci ON ds.id = ci.source_id
        GROUP BY ds.id
        ORDER BY count DESC
      `).all().catch(() => ({ results: [] })),

      // Recent items (last 24h)
      env.DB.prepare(`
        SELECT COUNT(*) as count
        FROM context_items
        WHERE timestamp > ?
      `).bind(oneDayAgo).first().catch(() => ({ count: 0 })),

      // Data sources status
      env.DB.prepare(`
        SELECT id, name, source_type, tier, sync_enabled, last_sync_at, last_sync_status
        FROM context_data_sources
        ORDER BY tier, name
      `).all().catch(() => ({ results: [] }))
    ]);

    return new Response(JSON.stringify({
      success: true,
      summary: {
        totalItems: totalItems?.count || 0,
        recentItems24h: recentItems?.count || 0,
        byType: itemsByType.results || [],
        bySource: itemsBySource.results || [],
        dataSources: dataSources.results || []
      }
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('Context GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: corsHeaders });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const auth = await verifyAuth(request, env);
  if (!auth.authenticated) {
    return unauthorizedResponse(auth.error, request);
  }

  try {
    const body = await request.json();
    const { action } = body;

    const now = Math.floor(Date.now() / 1000);

    if (action === 'sync') {
      // Trigger data source sync
      const { sourceId, sourceType } = body;

      // For now, sync internal data (leads, clients, etc.)
      if (sourceId === 'internal' || sourceType === 'internal') {
        const ingestedCount = await syncInternalData(env, now);
        return new Response(JSON.stringify({
          success: true,
          message: 'Internal data synced',
          itemsIngested: ingestedCount
        }), { headers: corsHeaders });
      }

      // Update sync status
      await env.DB.prepare(`
        UPDATE context_data_sources
        SET last_sync_at = ?, last_sync_status = 'pending'
        WHERE id = ? OR source_type = ?
      `).bind(now, sourceId || '', sourceType || '').run();

      return new Response(JSON.stringify({
        success: true,
        message: `Sync initiated for ${sourceId || sourceType}`
      }), { headers: corsHeaders });
    }

    if (action === 'ingest') {
      // Manual data ingestion
      const { sourceId, items } = body;

      if (!sourceId || !items || !Array.isArray(items)) {
        return new Response(JSON.stringify({
          success: false,
          error: 'sourceId and items array are required'
        }), { status: 400, headers: corsHeaders });
      }

      let ingested = 0;
      for (const item of items) {
        try {
          const itemId = `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await env.DB.prepare(`
            INSERT OR IGNORE INTO context_items
            (id, source_id, item_type, title, content, summary, external_id, timestamp,
             participants, related_lead_id, related_client_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            itemId,
            sourceId,
            item.type || 'note',
            item.title || null,
            item.content,
            item.summary || null,
            item.externalId || null,
            item.timestamp || now,
            item.participants ? JSON.stringify(item.participants) : null,
            item.leadId || null,
            item.clientId || null,
            now
          ).run();
          ingested++;
        } catch (e) {
          console.error('Ingest item error:', e);
        }
      }

      // Update source sync status
      await env.DB.prepare(`
        UPDATE context_data_sources
        SET last_sync_at = ?, last_sync_status = 'success', last_sync_count = ?
        WHERE id = ?
      `).bind(now, ingested, sourceId).run();

      return new Response(JSON.stringify({
        success: true,
        itemsIngested: ingested,
        totalProvided: items.length
      }), { headers: corsHeaders });
    }

    if (action === 'configure_source') {
      // Configure a data source
      const { sourceId, syncEnabled, syncInterval, endpoint, apiKey } = body;

      await env.DB.prepare(`
        UPDATE context_data_sources SET
          sync_enabled = ?,
          sync_interval_minutes = COALESCE(?, sync_interval_minutes),
          endpoint_url = COALESCE(?, endpoint_url),
          api_key_encrypted = COALESCE(?, api_key_encrypted),
          updated_at = ?
        WHERE id = ?
      `).bind(
        syncEnabled ? 1 : 0,
        syncInterval || null,
        endpoint || null,
        apiKey || null,
        now,
        sourceId
      ).run();

      return new Response(JSON.stringify({
        success: true,
        message: 'Source configured'
      }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Invalid action. Use: sync, ingest, configure_source'
    }), { status: 400, headers: corsHeaders });

  } catch (error) {
    console.error('Context POST error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: corsHeaders });
  }
}

/**
 * Sync internal platform data to context items
 */
async function syncInternalData(env, now) {
  let ingested = 0;
  const sevenDaysAgo = now - 604800;

  // Sync recent leads as context
  const leads = await env.DB.prepare(`
    SELECT id, name, dba_name, primary_email, city, lead_score, current_pos, notes, created_at
    FROM restaurant_leads
    WHERE updated_at > ? AND (notes IS NOT NULL AND notes != '')
    LIMIT 100
  `).bind(sevenDaysAgo).all();

  for (const lead of (leads.results || [])) {
    try {
      await env.DB.prepare(`
        INSERT OR REPLACE INTO context_items
        (id, source_id, item_type, title, content, external_id, timestamp, related_lead_id, created_at)
        VALUES (?, 'internal', 'lead_note', ?, ?, ?, ?, ?, ?)
      `).bind(
        `ctx_lead_${lead.id}`,
        `Lead: ${lead.dba_name || lead.name}`,
        `${lead.notes || ''}\n\nPOS: ${lead.current_pos || 'Unknown'} | Score: ${lead.lead_score} | City: ${lead.city}`,
        `lead_${lead.id}`,
        lead.created_at || now,
        lead.id,
        now
      ).run();
      ingested++;
    } catch (e) {}
  }

  // Sync recent tickets as context
  const tickets = await env.DB.prepare(`
    SELECT t.id, t.subject, t.description, t.status, t.priority, c.company_name, t.created_at
    FROM tickets t
    LEFT JOIN clients c ON t.client_id = c.id
    WHERE t.created_at > ?
    LIMIT 100
  `).bind(sevenDaysAgo).all();

  for (const ticket of (tickets.results || [])) {
    try {
      await env.DB.prepare(`
        INSERT OR REPLACE INTO context_items
        (id, source_id, item_type, title, content, external_id, timestamp, created_at)
        VALUES (?, 'internal', 'ticket', ?, ?, ?, ?, ?)
      `).bind(
        `ctx_ticket_${ticket.id}`,
        `Ticket: ${ticket.subject}`,
        `Client: ${ticket.company_name || 'Unknown'}\nStatus: ${ticket.status} | Priority: ${ticket.priority}\n\n${ticket.description || ''}`,
        `ticket_${ticket.id}`,
        ticket.created_at || now,
        now
      ).run();
      ingested++;
    } catch (e) {}
  }

  // Sync recent client notes
  const clients = await env.DB.prepare(`
    SELECT id, company_name, contact_name, notes, internal_notes, updated_at
    FROM clients
    WHERE updated_at > ? AND ((notes IS NOT NULL AND notes != '') OR (internal_notes IS NOT NULL AND internal_notes != ''))
    LIMIT 50
  `).bind(sevenDaysAgo).all();

  for (const client of (clients.results || [])) {
    try {
      const content = [client.notes, client.internal_notes].filter(Boolean).join('\n\n---\n\n');
      await env.DB.prepare(`
        INSERT OR REPLACE INTO context_items
        (id, source_id, item_type, title, content, external_id, timestamp, related_client_id, created_at)
        VALUES (?, 'internal', 'client_note', ?, ?, ?, ?, ?, ?)
      `).bind(
        `ctx_client_${client.id}`,
        `Client: ${client.company_name}`,
        content,
        `client_${client.id}`,
        client.updated_at || now,
        client.id,
        now
      ).run();
      ingested++;
    } catch (e) {}
  }

  // Update internal source sync status
  await env.DB.prepare(`
    UPDATE context_data_sources
    SET last_sync_at = ?, last_sync_status = 'success', last_sync_count = ?
    WHERE id = 'internal'
  `).bind(now, ingested).run();

  return ingested;
}
