/**
 * Content Queue API - Restaurant Wrap Pipeline
 * 
 * GET /api/content-queue - List queue items with filters
 * POST /api/content-queue - Add new item to queue
 * 
 * Query params:
 *   status: pending|in_review|writing|editing|approved|published|rejected
 *   priority: high|medium|low
 *   category: string
 *   limit: number (default 20)
 *   offset: number (default 0)
 */

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  
  // Parse query params
  const status = url.searchParams.get('status');
  const priority = url.searchParams.get('priority');
  const category = url.searchParams.get('category');
  const keyword = url.searchParams.get('keyword');
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const sortBy = url.searchParams.get('sortBy') || 'score_overall_priority';
  const sortOrder = url.searchParams.get('sortOrder') || 'DESC';
  
  try {
    // Build query
    let whereConditions = [];
    let params = [];
    
    if (status) {
      whereConditions.push('status = ?');
      params.push(status);
    }
    
    if (priority) {
      whereConditions.push('publishing_priority = ?');
      params.push(priority);
    }
    
    if (category) {
      whereConditions.push('publishing_category = ?');
      params.push(category);
    }
    
    if (keyword) {
      whereConditions.push('(seo_primary_keyword LIKE ? OR source_content_title LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';
    
    // Validate sort column
    const validSortColumns = [
      'score_overall_priority', 'created_at', 'updated_at', 
      'score_seo_opportunity', 'score_content_gap'
    ];
    const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : 'score_overall_priority';
    const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    // Get total count
    const countResult = await env.DB.prepare(`
      SELECT COUNT(*) as total FROM content_queue ${whereClause}
    `).bind(...params).first();
    
    // Get items
    const items = await env.DB.prepare(`
      SELECT 
        id,
        source_content_title,
        source_content_url,
        source_content_source,
        source_content_excerpt,
        seo_primary_keyword,
        seo_secondary_keywords_json,
        seo_meta_title,
        seo_meta_description,
        seo_suggested_slug,
        seo_search_intent,
        publishing_category,
        publishing_tags_json,
        publishing_priority,
        publishing_estimated_effort,
        publishing_timeliness,
        score_seo_opportunity,
        score_content_gap,
        score_competitive_difficulty,
        score_overall_priority,
        status,
        assigned_to,
        review_notes,
        published_post_id,
        created_at,
        updated_at
      FROM content_queue 
      ${whereClause}
      ORDER BY ${safeSortBy} ${safeSortOrder}
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all();
    
    // Get status counts
    const statusCounts = await env.DB.prepare(`
      SELECT 
        status,
        COUNT(*) as count
      FROM content_queue
      GROUP BY status
    `).all();
    
    // Get priority counts
    const priorityCounts = await env.DB.prepare(`
      SELECT 
        publishing_priority,
        COUNT(*) as count
      FROM content_queue
      GROUP BY publishing_priority
    `).all();
    
    // Parse JSON fields
    const parsedItems = items.results.map(item => ({
      ...item,
      seo_secondary_keywords: JSON.parse(item.seo_secondary_keywords_json || '[]'),
      publishing_tags: JSON.parse(item.publishing_tags_json || '[]'),
    }));
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        items: parsedItems,
        pagination: {
          total: countResult?.total || 0,
          limit,
          offset,
          hasMore: offset + limit < (countResult?.total || 0)
        },
        counts: {
          byStatus: statusCounts.results.reduce((acc, r) => ({ ...acc, [r.status]: r.count }), {}),
          byPriority: priorityCounts.results.reduce((acc, r) => ({ ...acc, [r.publishing_priority]: r.count }), {})
        }
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Content queue list error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.source_content_title || !body.source_content_url || !body.seo_primary_keyword) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: source_content_title, source_content_url, seo_primary_keyword'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const id = `queue_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const now = Math.floor(Date.now() / 1000);
    
    await env.DB.prepare(`
      INSERT INTO content_queue (
        id,
        source_content_title,
        source_content_url,
        source_content_source,
        source_content_excerpt,
        source_external_id,
        seo_primary_keyword,
        seo_secondary_keywords_json,
        seo_long_tail_keywords_json,
        seo_meta_title,
        seo_meta_description,
        seo_suggested_slug,
        seo_target_word_count_min,
        seo_target_word_count_max,
        seo_search_intent,
        structure_headline,
        structure_subheadlines_json,
        structure_sections_json,
        structure_cta_placement_json,
        structure_internal_links_json,
        summary_key_points_json,
        summary_expert_angle,
        summary_unique_value,
        summary_target_audience,
        publishing_category,
        publishing_tags_json,
        publishing_priority,
        publishing_estimated_effort,
        publishing_timeliness,
        score_seo_opportunity,
        score_content_gap,
        score_competitive_difficulty,
        score_overall_priority,
        status,
        created_at,
        updated_at,
        created_by
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?
      )
    `).bind(
      id,
      body.source_content_title,
      body.source_content_url,
      body.source_content_source || 'manual',
      body.source_content_excerpt || null,
      body.source_external_id || null,
      body.seo_primary_keyword,
      JSON.stringify(body.seo_secondary_keywords || []),
      JSON.stringify(body.seo_long_tail_keywords || []),
      body.seo_meta_title || body.source_content_title,
      body.seo_meta_description || body.source_content_excerpt,
      body.seo_suggested_slug || body.source_content_title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 60),
      body.seo_target_word_count_min || 1200,
      body.seo_target_word_count_max || 2000,
      body.seo_search_intent || 'informational',
      body.structure_headline || body.source_content_title,
      JSON.stringify(body.structure_subheadlines || []),
      JSON.stringify(body.structure_sections || []),
      JSON.stringify(body.structure_cta_placement || []),
      JSON.stringify(body.structure_internal_links || []),
      JSON.stringify(body.summary_key_points || []),
      body.summary_expert_angle || null,
      body.summary_unique_value || null,
      body.summary_target_audience || 'Restaurant owners and managers',
      body.publishing_category || 'General',
      JSON.stringify(body.publishing_tags || []),
      body.publishing_priority || 'medium',
      body.publishing_estimated_effort || 'standard',
      body.publishing_timeliness || 'evergreen',
      body.score_seo_opportunity || 50,
      body.score_content_gap || 50,
      body.score_competitive_difficulty || 50,
      body.score_overall_priority || 50,
      'pending',
      now,
      now,
      body.created_by || null
    ).run();
    
    return new Response(JSON.stringify({
      success: true,
      data: { id }
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Content queue create error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
