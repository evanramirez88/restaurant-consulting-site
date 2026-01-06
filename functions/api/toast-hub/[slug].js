// Public Toast Hub Single Post API - Get post by slug and increment view count
export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    const { slug } = context.params;

    // Get post (only if published)
    const post = await db.prepare(`
      SELECT
        id, slug, title, excerpt, content, content_format, category, author,
        published_at, view_count, featured,
        meta_title, meta_description, og_image_url, tags_json
      FROM toast_hub_posts
      WHERE slug = ? AND status = 'published'
    `).bind(slug).first();

    if (!post) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Post not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Increment view count (fire and forget)
    db.prepare(`
      UPDATE toast_hub_posts
      SET view_count = view_count + 1
      WHERE id = ?
    `).bind(post.id).run().catch(() => {});

    // Get related posts from same category
    const { results: relatedPosts } = await db.prepare(`
      SELECT id, slug, title, excerpt, category, published_at, featured
      FROM toast_hub_posts
      WHERE status = 'published'
        AND id != ?
        AND (category = ? OR featured = 1)
      ORDER BY
        CASE WHEN category = ? THEN 0 ELSE 1 END,
        featured DESC,
        published_at DESC
      LIMIT 3
    `).bind(post.id, post.category, post.category).all();

    return new Response(JSON.stringify({
      success: true,
      data: {
        ...post,
        relatedPosts: relatedPosts || []
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
