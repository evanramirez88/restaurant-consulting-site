/**
 * Market Intelligence Stats API
 *
 * GET /api/admin/intelligence/stats - Get aggregate market statistics
 *
 * Returns statistics in the format expected by ClientIntelligenceTab.tsx
 */

export async function onRequestGet(context) {
  const { env } = context;

  try {
    // Get total counts by status
    const statusCounts = await env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN lead_score >= 70 THEN 1 ELSE 0 END) as total_leads,
        SUM(CASE WHEN lead_score < 70 THEN 1 ELSE 0 END) as total_prospects
      FROM restaurant_leads
    `).first();

    // Count actual clients
    const clientCount = await env.DB.prepare(`
      SELECT COUNT(*) as total FROM clients
    `).first();

    // Calculate average lead score
    const avgScore = await env.DB.prepare(`
      SELECT AVG(lead_score) as avg_score FROM restaurant_leads WHERE lead_score > 0
    `).first();

    // Get breakdown by region/state (top regions)
    const regionBreakdown = await env.DB.prepare(`
      SELECT
        CASE
          WHEN city LIKE '%cape%' OR city IN ('Hyannis', 'Sandwich', 'Provincetown', 'Chatham', 'Falmouth', 'Barnstable') THEN 'Cape Cod'
          WHEN city IN ('Plymouth', 'Quincy', 'Weymouth', 'Braintree', 'Marshfield') THEN 'South Shore'
          WHEN city IN ('Boston', 'Cambridge', 'Somerville', 'Brookline', 'Newton') THEN 'Boston'
          WHEN state = 'MA' THEN 'Massachusetts (Other)'
          WHEN state IS NOT NULL AND state != '' THEN state
          ELSE 'Unknown'
        END as region,
        COUNT(*) as count
      FROM restaurant_leads
      GROUP BY region
      ORDER BY count DESC
      LIMIT 10
    `).all();

    // Get breakdown by POS system
    const posBreakdown = await env.DB.prepare(`
      SELECT
        CASE
          WHEN LOWER(current_pos) LIKE '%toast%' THEN 'Toast'
          WHEN LOWER(current_pos) LIKE '%square%' THEN 'Square'
          WHEN LOWER(current_pos) LIKE '%clover%' THEN 'Clover'
          WHEN LOWER(current_pos) LIKE '%aloha%' THEN 'Aloha'
          WHEN LOWER(current_pos) LIKE '%lightspeed%' THEN 'Lightspeed'
          WHEN LOWER(current_pos) LIKE '%upserve%' THEN 'Upserve'
          WHEN LOWER(current_pos) LIKE '%micros%' THEN 'Micros'
          WHEN current_pos IS NULL OR current_pos = '' THEN 'Unknown'
          ELSE 'Other'
        END as pos_system,
        COUNT(*) as count
      FROM restaurant_leads
      GROUP BY pos_system
      ORDER BY count DESC
    `).all();

    // Get breakdown by cuisine/category
    const categoryBreakdown = await env.DB.prepare(`
      SELECT
        COALESCE(cuisine_primary, service_style, 'Other') as category,
        COUNT(*) as count
      FROM restaurant_leads
      GROUP BY category
      ORDER BY count DESC
      LIMIT 8
    `).all();

    // Build response in format UI expects
    const byRegion = {};
    (regionBreakdown.results || []).forEach(row => {
      byRegion[row.region] = row.count;
    });

    const byPOS = {};
    (posBreakdown.results || []).forEach(row => {
      byPOS[row.pos_system] = row.count;
    });

    const byCategory = {};
    (categoryBreakdown.results || []).forEach(row => {
      byCategory[row.category] = row.count;
    });

    return Response.json({
      success: true,
      data: {
        total_prospects: statusCounts?.total_prospects || 0,
        total_leads: statusCounts?.total_leads || 0,
        total_clients: clientCount?.total || 0,
        avg_lead_score: Math.round(avgScore?.avg_score || 0),
        by_region: byRegion,
        by_pos: byPOS,
        by_category: byCategory,
      },
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
