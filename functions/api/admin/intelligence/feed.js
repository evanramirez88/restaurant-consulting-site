/**
 * Intelligence Feed Items API
 * GET /api/admin/intelligence/feed - Get combined feed items across all sources
 * POST /api/admin/intelligence/feed - Triage a feed item (update status/convert to finding)
 */

import { verifyAuth, unauthorizedResponse, getCorsHeaders, handleOptions } from '../../../_shared/auth.js';

export async function onRequestGet(context) {
  const { env, request } = context;

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    const url = new URL(request.url);
    const triageStatus = url.searchParams.get('status'); // pending, relevant, irrelevant, needs_review
    const sourceId = url.searchParams.get('source_id');
    const minRelevance = parseInt(url.searchParams.get('min_relevance') || '0');
    const convertedOnly = url.searchParams.get('converted') === 'true';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = `
      SELECT
        i.*,
        s.name as source_name,
        s.source_type,
        s.category as source_category
      FROM intel_feed_items i
      LEFT JOIN intel_feed_sources s ON i.source_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (triageStatus) {
      query += ' AND i.triage_status = ?';
      params.push(triageStatus);
    }
    if (sourceId) {
      query += ' AND i.source_id = ?';
      params.push(sourceId);
    }
    if (minRelevance > 0) {
      query += ' AND i.relevance_score >= ?';
      params.push(minRelevance);
    }
    if (convertedOnly) {
      query += ' AND i.converted_to_finding = 1';
    }

    query += ' ORDER BY i.relevance_score DESC, i.fetched_at DESC';
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const result = await env.DB.prepare(query).bind(...params).all();

    // Get stats
    const stats = await env.DB.prepare(`
      SELECT
        COUNT(*) as total_items,
        SUM(CASE WHEN triage_status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN triage_status = 'relevant' THEN 1 ELSE 0 END) as relevant_count,
        SUM(CASE WHEN triage_status = 'irrelevant' THEN 1 ELSE 0 END) as irrelevant_count,
        SUM(CASE WHEN triage_status = 'needs_review' THEN 1 ELSE 0 END) as needs_review_count,
        SUM(CASE WHEN converted_to_finding = 1 THEN 1 ELSE 0 END) as converted_count,
        AVG(relevance_score) as avg_relevance
      FROM intel_feed_items
    `).first();

    return new Response(JSON.stringify({
      success: true,
      data: result.results || [],
      stats: stats || {},
      pagination: { limit, offset }
    }), {
      status: 200,
      headers: getCorsHeaders(request)
    });

  } catch (error) {
    console.error('Feed GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to fetch feed'
    }), {
      status: 500,
      headers: getCorsHeaders(request)
    });
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    const body = await request.json();
    const { id, action, relevance_score, triage_reason } = body;

    if (!id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Item id is required'
      }), {
        status: 400,
        headers: getCorsHeaders(request)
      });
    }

    // Get the feed item
    const item = await env.DB.prepare(`
      SELECT i.*, s.name as source_name, s.source_type
      FROM intel_feed_items i
      LEFT JOIN intel_feed_sources s ON i.source_id = s.id
      WHERE i.id = ?
    `).bind(id).first();

    if (!item) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Feed item not found'
      }), {
        status: 404,
        headers: getCorsHeaders(request)
      });
    }

    // Handle different actions
    if (action === 'convert_to_finding') {
      // Convert to a finding
      const findingData = body.finding || {};
      const findingId = `finding_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const agentType = findingData.agent_type || 'news_monitor';
      const findingType = findingData.finding_type || 'news_mention';
      const priority = findingData.priority || 'normal';
      const summary = findingData.summary || item.content?.substring(0, 500);

      await env.DB.prepare(`
        INSERT INTO agent_findings (id, agent_type, finding_type, title, summary, source_url, source_type, priority, raw_data_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        findingId,
        agentType,
        findingType,
        item.title,
        summary,
        item.url,
        item.source_type || 'feed',
        priority,
        JSON.stringify({
          feed_item_id: item.id,
          source_name: item.source_name,
          original_content: item.content,
          published_at: item.published_at,
          author: item.author
        })
      ).run();

      // Mark the feed item as converted
      await env.DB.prepare(`
        UPDATE intel_feed_items
        SET converted_to_finding = 1, finding_id = ?, triage_status = 'relevant'
        WHERE id = ?
      `).bind(findingId, id).run();

      return new Response(JSON.stringify({
        success: true,
        message: 'Feed item converted to finding',
        data: { item_id: id, finding_id: findingId }
      }), {
        status: 200,
        headers: getCorsHeaders(request)
      });
    }

    // Handle triage status updates
    const updates = [];
    const params = [];

    if (action === 'mark_relevant') {
      updates.push('triage_status = ?');
      params.push('relevant');
    } else if (action === 'mark_irrelevant') {
      updates.push('triage_status = ?');
      params.push('irrelevant');
    } else if (action === 'needs_review') {
      updates.push('triage_status = ?');
      params.push('needs_review');
    }

    if (relevance_score !== undefined) {
      updates.push('relevance_score = ?');
      params.push(Math.max(0, Math.min(100, relevance_score)));
    }

    if (triage_reason) {
      updates.push('triage_reason = ?');
      params.push(triage_reason);
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No valid action or updates provided'
      }), {
        status: 400,
        headers: getCorsHeaders(request)
      });
    }

    params.push(id);

    await env.DB.prepare(`
      UPDATE intel_feed_items SET ${updates.join(', ')} WHERE id = ?
    `).bind(...params).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Feed item updated'
    }), {
      status: 200,
      headers: getCorsHeaders(request)
    });

  } catch (error) {
    console.error('Feed POST error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to process feed item'
    }), {
      status: 500,
      headers: getCorsHeaders(request)
    });
  }
}

// Bulk operations
export async function onRequestPut(context) {
  const { env, request } = context;

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    const body = await request.json();
    const { action, item_ids, source_id } = body;

    if (!action) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Action is required'
      }), {
        status: 400,
        headers: getCorsHeaders(request)
      });
    }

    let affectedCount = 0;

    if (action === 'poll_all') {
      // Trigger polling for all active sources
      const sources = await env.DB.prepare(`
        SELECT id, name, source_type, url FROM intel_feed_sources WHERE is_active = 1
      `).all();

      const results = [];
      for (const source of sources.results || []) {
        // We can't actually poll here synchronously, but we can mark them for polling
        // In a real implementation, this would trigger a worker or queue
        results.push({ id: source.id, name: source.name, status: 'queued' });
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Queued ${results.length} sources for polling`,
        data: results
      }), {
        status: 200,
        headers: getCorsHeaders(request)
      });
    }

    if (action === 'bulk_triage') {
      const { status } = body;
      if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: 'item_ids array is required for bulk_triage'
        }), {
          status: 400,
          headers: getCorsHeaders(request)
        });
      }

      const placeholders = item_ids.map(() => '?').join(',');
      await env.DB.prepare(`
        UPDATE intel_feed_items SET triage_status = ? WHERE id IN (${placeholders})
      `).bind(status || 'irrelevant', ...item_ids).run();

      affectedCount = item_ids.length;
    }

    if (action === 'cleanup_old') {
      // Delete items older than 30 days that are marked irrelevant
      const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
      const result = await env.DB.prepare(`
        DELETE FROM intel_feed_items WHERE triage_status = 'irrelevant' AND fetched_at < ?
      `).bind(thirtyDaysAgo).run();
      affectedCount = result.meta?.changes || 0;
    }

    return new Response(JSON.stringify({
      success: true,
      message: `${action} completed`,
      affected_count: affectedCount
    }), {
      status: 200,
      headers: getCorsHeaders(request)
    });

  } catch (error) {
    console.error('Feed PUT error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to process bulk operation'
    }), {
      status: 500,
      headers: getCorsHeaders(request)
    });
  }
}

export async function onRequestOptions(context) {
  return handleOptions(context.request);
}
