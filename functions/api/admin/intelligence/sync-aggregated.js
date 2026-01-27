/**
 * Intelligence Aggregated Content Sync API
 *
 * POST /api/admin/intelligence/sync-aggregated
 *
 * Bridges content from toast_hub_imports to:
 * - context_items (for RAG queries by Intelligence Researcher)
 * - intel_feed_items (for triage workflow)
 *
 * This endpoint should be called:
 * - After manual aggregation runs
 * - On a schedule (via intelligence-scheduler worker)
 * - When content is approved in the admin UI
 */

import { verifyAuth, unauthorizedResponse, handleOptions } from '../../../_shared/auth.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

export async function onRequestOptions() {
  return handleOptions();
}

/**
 * GET /api/admin/intelligence/sync-aggregated
 * Preview what would be synced
 */
export async function onRequestGet(context) {
  const { request, env } = context;

  const auth = await verifyAuth(request, env);
  if (!auth.authenticated) {
    return unauthorizedResponse(auth.error, request);
  }

  try {
    const url = new URL(request.url);
    const minScore = parseInt(url.searchParams.get('min_score') || '50');

    // Get pending items that haven't been synced to context
    const pendingSync = await env.DB.prepare(`
      SELECT
        i.id,
        i.title,
        i.excerpt,
        i.ai_score,
        i.status,
        i.created_at,
        s.name as source_name,
        s.source_type
      FROM toast_hub_imports i
      JOIN toast_hub_sources s ON i.source_id = s.id
      WHERE i.ai_score >= ?
        AND NOT EXISTS (
          SELECT 1 FROM context_items c
          WHERE c.external_id = 'toasthub_' || i.id
        )
      ORDER BY i.ai_score DESC
      LIMIT 100
    `).bind(minScore).all();

    // Get existing synced count
    const syncedCount = await env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM context_items
      WHERE external_id LIKE 'toasthub_%'
    `).first();

    return new Response(JSON.stringify({
      success: true,
      preview: {
        pendingCount: pendingSync.results?.length || 0,
        alreadySynced: syncedCount?.count || 0,
        minScoreFilter: minScore,
        items: pendingSync.results || []
      }
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('Sync preview error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: corsHeaders });
  }
}

/**
 * POST /api/admin/intelligence/sync-aggregated
 * Sync aggregated content to context_items and intel_feed_items
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  const auth = await verifyAuth(request, env);
  if (!auth.authenticated) {
    return unauthorizedResponse(auth.error, request);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const {
      minScore = 50,          // Minimum AI score to sync
      statusFilter = 'all',   // 'all', 'pending', 'approved'
      limit = 100,            // Max items to sync per call
      syncToContext = true,   // Sync to context_items
      syncToFeed = true       // Sync to intel_feed_items
    } = body;

    const now = Math.floor(Date.now() / 1000);

    // Build query for items to sync
    let query = `
      SELECT
        i.id,
        i.source_id,
        i.external_id,
        i.external_url,
        i.title,
        i.excerpt,
        i.content_body,
        i.author,
        i.published_at,
        i.ai_score,
        i.status,
        i.category_suggestion,
        i.created_at,
        s.name as source_name,
        s.source_type
      FROM toast_hub_imports i
      JOIN toast_hub_sources s ON i.source_id = s.id
      WHERE i.ai_score >= ?
    `;
    const params = [minScore];

    if (statusFilter === 'pending') {
      query += ' AND i.status = ?';
      params.push('pending');
    } else if (statusFilter === 'approved') {
      query += ' AND i.status = ?';
      params.push('approved');
    }

    // Exclude already synced items
    query += ` AND NOT EXISTS (
      SELECT 1 FROM context_items c
      WHERE c.external_id = 'toasthub_' || i.id
    )`;

    query += ' ORDER BY i.ai_score DESC LIMIT ?';
    params.push(limit);

    const imports = await env.DB.prepare(query).bind(...params).all();

    const results = {
      total: imports.results?.length || 0,
      contextItemsCreated: 0,
      feedItemsCreated: 0,
      errors: []
    };

    // Get or create the aggregator data source for context_items
    let contextSourceId = 'toasthub_aggregator';
    const existingSource = await env.DB.prepare(
      'SELECT id FROM context_data_sources WHERE id = ?'
    ).bind(contextSourceId).first();

    if (!existingSource) {
      // Create the data source entry
      await env.DB.prepare(`
        INSERT INTO context_data_sources (id, name, source_type, tier, sync_enabled, created_at)
        VALUES (?, 'Toast Hub Aggregator', 'aggregator', 2, 1, ?)
      `).bind(contextSourceId, now).run();
    }

    // Process each import
    for (const item of imports.results || []) {
      try {
        // Sync to context_items
        if (syncToContext) {
          const contextId = `ctx_toasthub_${item.id}`;
          const externalId = `toasthub_${item.id}`;

          // Prepare content for context
          const content = [
            item.content_body || item.excerpt,
            item.author ? `Author: ${item.author}` : null,
            item.external_url ? `Source: ${item.external_url}` : null
          ].filter(Boolean).join('\n\n');

          // Determine item_type based on source
          let itemType = 'article';
          if (item.source_type === 'reddit') {
            itemType = 'discussion';
          } else if (item.category_suggestion) {
            if (item.category_suggestion.toLowerCase().includes('guide')) {
              itemType = 'guide';
            } else if (item.category_suggestion.toLowerCase().includes('news')) {
              itemType = 'news';
            }
          }

          // Calculate relevance score (normalize ai_score to 0-1)
          const relevanceScore = Math.min(1, (item.ai_score || 50) / 100);

          await env.DB.prepare(`
            INSERT OR REPLACE INTO context_items (
              id, source_id, item_type, title, content, summary,
              external_id, timestamp, privacy_level, relevance_score,
              tags, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'business', ?, ?, ?)
          `).bind(
            contextId,
            contextSourceId,
            itemType,
            item.title,
            content,
            item.excerpt,
            externalId,
            item.published_at || item.created_at || now,
            relevanceScore,
            JSON.stringify([item.source_name, item.source_type, item.category_suggestion].filter(Boolean)),
            now
          ).run();

          results.contextItemsCreated++;
        }

        // Sync to intel_feed_items
        if (syncToFeed) {
          const feedId = `feed_toasthub_${item.id}`;

          // Check if feed item already exists
          const existingFeed = await env.DB.prepare(
            'SELECT id FROM intel_feed_items WHERE id = ?'
          ).bind(feedId).first();

          if (!existingFeed) {
            // Get or create feed source
            let feedSourceId = `feed_src_${item.source_id}`;
            const existingFeedSource = await env.DB.prepare(
              'SELECT id FROM intel_feed_sources WHERE id = ?'
            ).bind(feedSourceId).first();

            if (!existingFeedSource) {
              await env.DB.prepare(`
                INSERT INTO intel_feed_sources (id, name, source_type, category, is_active, created_at)
                VALUES (?, ?, ?, 'industry_news', 1, ?)
              `).bind(feedSourceId, item.source_name, item.source_type, now).run();
            }

            await env.DB.prepare(`
              INSERT INTO intel_feed_items (
                id, source_id, title, url, content, author,
                published_at, fetched_at, relevance_score, triage_status
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
            `).bind(
              feedId,
              feedSourceId,
              item.title,
              item.external_url,
              item.content_body || item.excerpt,
              item.author,
              item.published_at,
              now,
              item.ai_score || 50
            ).run();

            results.feedItemsCreated++;
          }
        }

      } catch (itemError) {
        results.errors.push({
          itemId: item.id,
          error: itemError.message
        });
      }
    }

    // Update sync status on the data source
    await env.DB.prepare(`
      UPDATE context_data_sources
      SET last_sync_at = ?, last_sync_status = 'success', last_sync_count = ?
      WHERE id = ?
    `).bind(now, results.contextItemsCreated, contextSourceId).run();

    // Log the sync operation
    await env.DB.prepare(`
      INSERT INTO context_ingestion_log (
        id, source_id, operation, items_processed, items_created, items_failed, created_at
      ) VALUES (?, ?, 'sync_aggregated', ?, ?, ?, ?)
    `).bind(
      `sync_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
      contextSourceId,
      results.total,
      results.contextItemsCreated + results.feedItemsCreated,
      results.errors.length,
      now
    ).run();

    return new Response(JSON.stringify({
      success: true,
      message: `Synced ${results.contextItemsCreated} to context, ${results.feedItemsCreated} to feed`,
      results
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('Sync error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: corsHeaders });
  }
}
