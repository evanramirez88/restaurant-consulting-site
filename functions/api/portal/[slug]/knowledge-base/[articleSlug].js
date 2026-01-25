/**
 * Portal Knowledge Base Article Detail
 * GET /api/portal/:slug/knowledge-base/:articleSlug - Get single article
 */
import { getCorsOrigin } from '../../../../_shared/auth.js';

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300'
  };
}

export async function onRequestGet(context) {
  const { env, request, params } = context;
  const { articleSlug } = params;
  const headers = getCorsHeaders(request);

  try {
    const article = await env.DB.prepare(`
      SELECT * FROM toast_hub_posts WHERE slug = ? AND status = 'published'
    `).bind(articleSlug).first();

    if (!article) {
      return new Response(JSON.stringify({ success: false, error: 'Article not found' }), { status: 404, headers });
    }

    // Increment view count
    await env.DB.prepare(`
      UPDATE toast_hub_posts SET view_count = view_count + 1 WHERE slug = ?
    `).bind(articleSlug).run();

    // Get related articles in same category
    const related = await env.DB.prepare(`
      SELECT slug, title, excerpt, category FROM toast_hub_posts
      WHERE category = ? AND slug != ? AND status = 'published'
      ORDER BY view_count DESC LIMIT 3
    `).bind(article.category, articleSlug).all();

    return new Response(JSON.stringify({
      success: true,
      data: { article, related: related.results || [] }
    }), { headers });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers });
  }
}

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}
