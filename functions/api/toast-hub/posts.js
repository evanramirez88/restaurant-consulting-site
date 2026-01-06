// Public Toast Hub Posts API - List published posts only
export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    const url = new URL(context.request.url);

    // Optional query params
    const category = url.searchParams.get('category');
    const featured = url.searchParams.get('featured');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Build query - only return published posts
    let query = `
      SELECT
        id, slug, title, excerpt, category, author,
        published_at, view_count, featured,
        meta_title, meta_description, og_image_url, tags_json
      FROM toast_hub_posts
      WHERE status = 'published'
    `;
    const params = [];

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
    if (category) {
      countQuery += ` AND category = '${category}'`;
    }
    const countResult = await db.prepare(countQuery).first();

    return new Response(JSON.stringify({
      success: true,
      data: results || [],
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
