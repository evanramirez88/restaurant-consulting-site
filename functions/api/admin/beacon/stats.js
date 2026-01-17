/**
 * Beacon Dashboard Statistics
 *
 * GET /api/admin/beacon/stats - Get dashboard statistics
 */

import { corsHeaders, handleOptions } from '../../../_shared/auth.js';

/**
 * GET - Get dashboard statistics
 */
export async function onRequestGet(context) {
  const { env } = context;

  try {
    // Get item counts by status
    const statusCounts = await env.DB.prepare(`
      SELECT status, COUNT(*) as count
      FROM beacon_content_items
      GROUP BY status
    `).all();

    // Get item counts by category
    const categoryCounts = await env.DB.prepare(`
      SELECT ai_category as category, COUNT(*) as count
      FROM beacon_content_items
      WHERE status = 'pending'
      GROUP BY ai_category
      ORDER BY count DESC
    `).all();

    // Get source stats
    const sourceCounts = await env.DB.prepare(`
      SELECT
        s.id,
        s.name,
        s.type,
        s.enabled,
        s.last_fetched_at,
        s.error_count,
        COUNT(i.id) as total_items,
        SUM(CASE WHEN i.status = 'pending' THEN 1 ELSE 0 END) as pending_items
      FROM beacon_sources s
      LEFT JOIN beacon_content_items i ON s.id = i.source_id
      GROUP BY s.id
      ORDER BY s.enabled DESC, pending_items DESC
    `).all();

    // Get publication counts
    const pubCounts = await env.DB.prepare(`
      SELECT status, COUNT(*) as count
      FROM beacon_publications
      GROUP BY status
    `).all();

    // Get high priority pending items (top 5)
    const highPriorityItems = await env.DB.prepare(`
      SELECT
        id, title, ai_category, ai_sentiment, ai_action_suggestion,
        ai_priority_score, source_type, fetched_at
      FROM beacon_content_items
      WHERE status = 'pending'
      ORDER BY ai_priority_score DESC
      LIMIT 5
    `).all();

    // Get recent activity (last 24 hours)
    const recentActivity = await env.DB.prepare(`
      SELECT
        DATE(fetched_at, 'unixepoch') as date,
        COUNT(*) as items_fetched,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM beacon_content_items
      WHERE fetched_at > unixepoch() - 604800
      GROUP BY DATE(fetched_at, 'unixepoch')
      ORDER BY date DESC
      LIMIT 7
    `).all();

    // Calculate totals
    const statusMap = {};
    (statusCounts.results || []).forEach(row => {
      statusMap[row.status] = row.count;
    });

    const pubStatusMap = {};
    (pubCounts.results || []).forEach(row => {
      pubStatusMap[row.status] = row.count;
    });

    return new Response(JSON.stringify({
      success: true,
      data: {
        overview: {
          total_items: Object.values(statusMap).reduce((a, b) => a + b, 0),
          pending: statusMap.pending || 0,
          approved: statusMap.approved || 0,
          rejected: statusMap.rejected || 0,
          published: statusMap.published || 0,
          archived: statusMap.archived || 0,
          total_publications: Object.values(pubStatusMap).reduce((a, b) => a + b, 0),
          published_publications: pubStatusMap.published || 0,
          draft_publications: pubStatusMap.draft || 0
        },
        by_status: statusCounts.results || [],
        by_category: categoryCounts.results || [],
        sources: sourceCounts.results || [],
        publications: pubCounts.results || [],
        high_priority: highPriorityItems.results || [],
        recent_activity: recentActivity.results || []
      }
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Beacon stats error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to fetch statistics'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
