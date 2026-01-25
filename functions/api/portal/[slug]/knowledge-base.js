/**
 * Portal Knowledge Base API
 * GET /api/portal/:slug/knowledge-base - Get published help articles
 *
 * Returns published toast_hub_posts accessible to clients.
 * No auth required for reading (public knowledge base).
 */
import { getCorsOrigin } from '../../../_shared/auth.js';

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300'
  };
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const headers = getCorsHeaders(request);
  const url = new URL(request.url);

  try {
    const category = url.searchParams.get('category');
    const search = url.searchParams.get('search');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = `SELECT id, slug, title, excerpt, category, tags_json, created_at, updated_at, view_count
      FROM toast_hub_posts WHERE status = 'published'`;
    const params = [];

    if (category) {
      query += ` AND category = ?`;
      params.push(category);
    }

    if (search) {
      query += ` AND (title LIKE ? OR excerpt LIKE ? OR content LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY featured DESC, display_order ASC, created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const articles = await env.DB.prepare(query).bind(...params).all();

    // Get categories
    const categories = await env.DB.prepare(`
      SELECT slug, name, description FROM toast_hub_categories WHERE is_active = 1 ORDER BY display_order ASC
    `).all();

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM toast_hub_posts WHERE status = 'published'`;
    const countParams = [];
    if (category) {
      countQuery += ` AND category = ?`;
      countParams.push(category);
    }
    if (search) {
      countQuery += ` AND (title LIKE ? OR excerpt LIKE ? OR content LIKE ?)`;
      const searchTerm = `%${search}%`;
      countParams.push(searchTerm, searchTerm, searchTerm);
    }
    const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();

    return new Response(JSON.stringify({
      success: true,
      data: {
        articles: articles.results || [],
        categories: categories.results || [],
        total: countResult?.total || 0,
        limit,
        offset
      }
    }), { headers });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers });
  }
}

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}
