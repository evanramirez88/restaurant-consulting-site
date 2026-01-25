// Client Portal Knowledge Base API
// GET /api/client-portal/knowledge-base - Get content shared with current client
import { verifyClientAuth, getCorsHeaders, handleOptions } from '../../_shared/auth.js';

export async function onRequestGet(context) {
  const corsHeaders = getCorsHeaders(context.request);

  try {
    const auth = await verifyClientAuth(context.request, context.env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({
        success: false,
        error: auth.error || 'Authentication required'
      }), {
        status: 401,
        headers: corsHeaders
      });
    }

    const db = context.env.DB;
    const clientId = auth.clientId;
    const url = new URL(context.request.url);
    const now = Math.floor(Date.now() / 1000);

    // Query params
    const category = url.searchParams.get('category');
    const search = url.searchParams.get('search');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const bookmarked = url.searchParams.get('bookmarked') === 'true';

    // Build query for shared content
    let query = `
      SELECT
        p.id,
        p.slug,
        p.title,
        p.excerpt,
        p.content,
        p.content_format,
        p.category,
        p.tags_json,
        p.published_at,
        p.view_count,
        cca.access_level,
        cca.granted_at,
        cca.expires_at,
        CASE WHEN cb.id IS NOT NULL THEN 1 ELSE 0 END as is_bookmarked
      FROM client_content_access cca
      JOIN toast_hub_posts p ON cca.content_id = p.id
      LEFT JOIN content_bookmarks cb ON cb.content_id = p.id AND cb.client_id = cca.client_id
      WHERE cca.client_id = ?
        AND cca.content_type = 'post'
        AND p.status = 'published'
        AND (cca.expires_at IS NULL OR cca.expires_at > ?)
    `;
    const params = [clientId, now];

    if (category) {
      query += ' AND p.category = ?';
      params.push(category);
    }

    if (search) {
      query += ' AND (p.title LIKE ? OR p.excerpt LIKE ? OR p.content LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (bookmarked) {
      query += ' AND cb.id IS NOT NULL';
    }

    query += ' ORDER BY cca.granted_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = db.prepare(query);
    const { results: posts } = await stmt.bind(...params).all();

    // Get categories available to this client
    const { results: categories } = await db.prepare(`
      SELECT DISTINCT p.category, COUNT(*) as count
      FROM client_content_access cca
      JOIN toast_hub_posts p ON cca.content_id = p.id
      WHERE cca.client_id = ?
        AND cca.content_type = 'post'
        AND p.status = 'published'
        AND p.category IS NOT NULL
        AND (cca.expires_at IS NULL OR cca.expires_at > ?)
      GROUP BY p.category
      ORDER BY count DESC
    `).bind(clientId, now).all();

    // Get total count
    const countResult = await db.prepare(`
      SELECT COUNT(*) as total
      FROM client_content_access cca
      JOIN toast_hub_posts p ON cca.content_id = p.id
      WHERE cca.client_id = ?
        AND cca.content_type = 'post'
        AND p.status = 'published'
        AND (cca.expires_at IS NULL OR cca.expires_at > ?)
    `).bind(clientId, now).first();

    // Get bookmarks count
    const bookmarkCount = await db.prepare(`
      SELECT COUNT(*) as total
      FROM content_bookmarks cb
      JOIN toast_hub_posts p ON cb.content_id = p.id
      WHERE cb.client_id = ?
        AND cb.content_type = 'post'
        AND p.status = 'published'
    `).bind(clientId).first();

    return new Response(JSON.stringify({
      success: true,
      data: {
        posts: posts || [],
        categories: categories || [],
        total: countResult?.total || 0,
        bookmarks_count: bookmarkCount?.total || 0,
        pagination: {
          limit,
          offset,
          has_more: (posts || []).length === limit
        }
      }
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: getCorsHeaders(context.request)
    });
  }
}

// POST - Bookmark or unbookmark content
export async function onRequestPost(context) {
  const corsHeaders = getCorsHeaders(context.request);

  try {
    const auth = await verifyClientAuth(context.request, context.env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({
        success: false,
        error: auth.error || 'Authentication required'
      }), {
        status: 401,
        headers: corsHeaders
      });
    }

    const db = context.env.DB;
    const clientId = auth.clientId;
    const body = await context.request.json();
    const now = Math.floor(Date.now() / 1000);

    const { content_id, action = 'bookmark', notes } = body;

    if (!content_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'content_id is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Verify client has access to this content
    const access = await db.prepare(`
      SELECT * FROM client_content_access
      WHERE client_id = ? AND content_id = ? AND content_type = 'post'
        AND (expires_at IS NULL OR expires_at > ?)
    `).bind(clientId, content_id, now).first();

    if (!access) {
      return new Response(JSON.stringify({
        success: false,
        error: 'You do not have access to this content'
      }), {
        status: 403,
        headers: corsHeaders
      });
    }

    if (action === 'bookmark') {
      // Add bookmark
      const bookmarkId = crypto.randomUUID();
      await db.prepare(`
        INSERT OR REPLACE INTO content_bookmarks (
          id, client_id, content_id, content_type, notes, created_at
        ) VALUES (?, ?, ?, 'post', ?, ?)
      `).bind(bookmarkId, clientId, content_id, notes || null, now).run();

      return new Response(JSON.stringify({
        success: true,
        message: 'Content bookmarked',
        bookmark_id: bookmarkId
      }), {
        headers: corsHeaders
      });
    } else if (action === 'unbookmark') {
      // Remove bookmark
      await db.prepare(`
        DELETE FROM content_bookmarks
        WHERE client_id = ? AND content_id = ? AND content_type = 'post'
      `).bind(clientId, content_id).run();

      return new Response(JSON.stringify({
        success: true,
        message: 'Bookmark removed'
      }), {
        headers: corsHeaders
      });
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid action. Use "bookmark" or "unbookmark"'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: getCorsHeaders(context.request)
    });
  }
}

export async function onRequestOptions(context) {
  return handleOptions(context.request);
}
