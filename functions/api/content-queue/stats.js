/**
 * Content Queue Stats API - Restaurant Wrap Pipeline
 * 
 * GET /api/content-queue/stats - Get queue statistics and insights
 */

export async function onRequestGet(context) {
  const { env } = context;
  
  try {
    // Overall counts
    const overallCounts = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'in_review' THEN 1 ELSE 0 END) as in_review,
        SUM(CASE WHEN status = 'writing' THEN 1 ELSE 0 END) as writing,
        SUM(CASE WHEN status = 'editing' THEN 1 ELSE 0 END) as editing,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived
      FROM content_queue
    `).first();
    
    // Priority distribution
    const priorityCounts = await env.DB.prepare(`
      SELECT 
        SUM(CASE WHEN publishing_priority = 'high' THEN 1 ELSE 0 END) as high,
        SUM(CASE WHEN publishing_priority = 'medium' THEN 1 ELSE 0 END) as medium,
        SUM(CASE WHEN publishing_priority = 'low' THEN 1 ELSE 0 END) as low
      FROM content_queue
      WHERE status NOT IN ('published', 'rejected', 'archived')
    `).first();
    
    // Category distribution
    const categoryCounts = await env.DB.prepare(`
      SELECT 
        publishing_category as category,
        COUNT(*) as count
      FROM content_queue
      WHERE status NOT IN ('archived')
      GROUP BY publishing_category
      ORDER BY count DESC
      LIMIT 10
    `).all();
    
    // Top keywords
    const keywordCounts = await env.DB.prepare(`
      SELECT 
        seo_primary_keyword as keyword,
        COUNT(*) as count
      FROM content_queue
      WHERE status NOT IN ('archived')
      GROUP BY seo_primary_keyword
      ORDER BY count DESC
      LIMIT 10
    `).all();
    
    // Source distribution
    const sourceCounts = await env.DB.prepare(`
      SELECT 
        source_content_source as source,
        COUNT(*) as count
      FROM content_queue
      WHERE status NOT IN ('archived')
      GROUP BY source_content_source
      ORDER BY count DESC
      LIMIT 10
    `).all();
    
    // Average scores by status
    const scoresByStatus = await env.DB.prepare(`
      SELECT 
        status,
        ROUND(AVG(score_seo_opportunity), 1) as avg_seo_opportunity,
        ROUND(AVG(score_content_gap), 1) as avg_content_gap,
        ROUND(AVG(score_overall_priority), 1) as avg_overall_priority
      FROM content_queue
      GROUP BY status
    `).all();
    
    // Items created this week
    const weekAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
    const weeklyStats = await env.DB.prepare(`
      SELECT 
        COUNT(*) as created_this_week,
        SUM(CASE WHEN status = 'published' AND published_at > ? THEN 1 ELSE 0 END) as published_this_week
      FROM content_queue
      WHERE created_at > ?
    `).bind(weekAgo, weekAgo).first();
    
    // High-priority pending items (action needed)
    const actionNeeded = await env.DB.prepare(`
      SELECT 
        id,
        source_content_title,
        seo_primary_keyword,
        score_overall_priority,
        publishing_priority,
        created_at
      FROM content_queue
      WHERE status = 'pending' 
        AND (publishing_priority = 'high' OR score_overall_priority >= 70)
      ORDER BY score_overall_priority DESC
      LIMIT 5
    `).all();
    
    // Search intent distribution
    const intentCounts = await env.DB.prepare(`
      SELECT 
        seo_search_intent as intent,
        COUNT(*) as count
      FROM content_queue
      WHERE status NOT IN ('archived')
      GROUP BY seo_search_intent
      ORDER BY count DESC
    `).all();
    
    // Timeliness distribution
    const timelinessCounts = await env.DB.prepare(`
      SELECT 
        publishing_timeliness as timeliness,
        COUNT(*) as count
      FROM content_queue
      WHERE status IN ('pending', 'in_review', 'writing', 'editing', 'approved')
      GROUP BY publishing_timeliness
    `).all();
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        overview: {
          total: overallCounts?.total || 0,
          byStatus: {
            pending: overallCounts?.pending || 0,
            in_review: overallCounts?.in_review || 0,
            writing: overallCounts?.writing || 0,
            editing: overallCounts?.editing || 0,
            approved: overallCounts?.approved || 0,
            published: overallCounts?.published || 0,
            rejected: overallCounts?.rejected || 0,
            archived: overallCounts?.archived || 0
          },
          byPriority: {
            high: priorityCounts?.high || 0,
            medium: priorityCounts?.medium || 0,
            low: priorityCounts?.low || 0
          }
        },
        distributions: {
          categories: categoryCounts.results || [],
          keywords: keywordCounts.results || [],
          sources: sourceCounts.results || [],
          searchIntent: intentCounts.results || [],
          timeliness: timelinessCounts.results || []
        },
        scores: {
          byStatus: scoresByStatus.results || []
        },
        activity: {
          createdThisWeek: weeklyStats?.created_this_week || 0,
          publishedThisWeek: weeklyStats?.published_this_week || 0
        },
        actionItems: {
          highPriorityPending: actionNeeded.results || []
        },
        generatedAt: new Date().toISOString()
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Content queue stats error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
