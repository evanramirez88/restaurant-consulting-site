// Admin Toast Hub Analytics - Aggregated content performance data
import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../_shared/auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) return unauthorizedResponse(auth.error, request);

    const db = env.DB;
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || '30d';

    // Calculate date cutoff
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const cutoff = Math.floor(Date.now() / 1000) - (days * 86400);

    // Run queries in parallel
    const [topArticles, totalViews, uniqueVisitors, referrerBreakdown, dailyViews, postStats] = await Promise.all([
      // Top articles by views
      db.prepare(`
        SELECT p.id, p.title, p.slug, p.category, p.view_count, p.published_at,
          COUNT(pv.id) as period_views,
          COUNT(DISTINCT pv.visitor_hash) as unique_views,
          AVG(pv.time_on_page) as avg_time,
          AVG(pv.scroll_depth) as avg_scroll
        FROM toast_hub_posts p
        LEFT JOIN toast_hub_page_views pv ON p.id = pv.post_id AND pv.created_at >= ?
        WHERE p.status = 'published'
        GROUP BY p.id
        ORDER BY period_views DESC
        LIMIT 10
      `).bind(cutoff).all(),

      // Total views in period
      db.prepare(`
        SELECT COUNT(*) as total FROM toast_hub_page_views WHERE created_at >= ?
      `).bind(cutoff).first(),

      // Unique visitors in period
      db.prepare(`
        SELECT COUNT(DISTINCT visitor_hash) as total FROM toast_hub_page_views WHERE created_at >= ?
      `).bind(cutoff).first(),

      // Referrer breakdown
      db.prepare(`
        SELECT
          CASE
            WHEN referrer IS NULL OR referrer = '' THEN 'direct'
            WHEN referrer LIKE '%google%' OR referrer LIKE '%bing%' THEN 'organic'
            WHEN referrer LIKE '%facebook%' OR referrer LIKE '%twitter%' OR referrer LIKE '%linkedin%' THEN 'social'
            WHEN utm_source IS NOT NULL THEN 'campaign'
            ELSE 'referral'
          END as source,
          COUNT(*) as count
        FROM toast_hub_page_views
        WHERE created_at >= ?
        GROUP BY source
        ORDER BY count DESC
      `).bind(cutoff).all(),

      // Daily view counts for chart
      db.prepare(`
        SELECT
          date(created_at, 'unixepoch') as day,
          COUNT(*) as views,
          COUNT(DISTINCT visitor_hash) as unique_views
        FROM toast_hub_page_views
        WHERE created_at >= ?
        GROUP BY day
        ORDER BY day ASC
      `).bind(cutoff).all(),

      // Overall post stats
      db.prepare(`
        SELECT
          COUNT(*) as total_posts,
          SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
          SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as drafts,
          SUM(view_count) as all_time_views
        FROM toast_hub_posts
      `).first()
    ]);

    return new Response(JSON.stringify({
      success: true,
      data: {
        period,
        summary: {
          total_views: totalViews?.total || 0,
          unique_visitors: uniqueVisitors?.total || 0,
          total_posts: postStats?.total_posts || 0,
          published_posts: postStats?.published || 0,
          draft_posts: postStats?.drafts || 0,
          all_time_views: postStats?.all_time_views || 0
        },
        top_articles: topArticles?.results || [],
        referrer_breakdown: referrerBreakdown?.results || [],
        daily_views: dailyViews?.results || []
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
