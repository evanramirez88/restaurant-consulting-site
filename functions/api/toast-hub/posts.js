// Public Toast Hub Posts API - List published posts only
// Updated for Authority Engine: includes GEO data, respects visibility toggles
export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    const url = new URL(context.request.url);

    // Optional query params
    const category = url.searchParams.get('category');
    const featured = url.searchParams.get('featured');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const portal = url.searchParams.get('portal'); // 'client' | 'rep' | null (public)

    // Build query - only return published posts with correct visibility
    let query = `
      SELECT
        id, slug, title, excerpt, category, author,
        published_at, view_count, featured,
        meta_title, meta_description, og_image_url, tags_json,
        tldr_summary, expert_commentary, reading_time_minutes,
        visible_public, visible_client_portal, visible_rep_portal,
        source_type, source_url
      FROM toast_hub_posts
      WHERE status = 'published'
    `;
    const params = [];

    // Apply visibility filter based on portal context
    if (portal === 'client') {
      query += ` AND visible_client_portal = 1`;
    } else if (portal === 'rep') {
      query += ` AND visible_rep_portal = 1`;
    } else {
      // Public view - only show publicly visible posts
      query += ` AND visible_public = 1`;
    }

    if (category) {
      query += ` AND category = ?`;
      params.push(category);
    }

    if (featured === 'true') {
      query += ` AND featured = 1`;
    }

    query += ` ORDER BY featured DESC, published_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const { results } = await db.prepare(query).bind(...params).all();

    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) as total FROM toast_hub_posts WHERE status = 'published'`;
    if (portal === 'client') {
      countQuery += ` AND visible_client_portal = 1`;
    } else if (portal === 'rep') {
      countQuery += ` AND visible_rep_portal = 1`;
    } else {
      countQuery += ` AND visible_public = 1`;
    }
    if (category) {
      countQuery += ` AND category = '${category}'`;
    }
    const countResult = await db.prepare(countQuery).first();

    // Get category counts for filters
    const { results: categoryCounts } = await db.prepare(`
      SELECT category, COUNT(*) as count
      FROM toast_hub_posts
      WHERE status = 'published' AND visible_public = 1 AND category IS NOT NULL
      GROUP BY category
      ORDER BY count DESC
    `).all();

    return new Response(JSON.stringify({
      success: true,
      data: results || [],
      categories: categoryCounts || [],
      pagination: {
        total: countResult?.total || 0,
        limit,
        offset,
        hasMore: offset + (results?.length || 0) < (countResult?.total || 0)
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
