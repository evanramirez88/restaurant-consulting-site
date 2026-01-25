// Toast Hub Content Sharing API
// POST /api/admin/toast-hub/content/[id]/share - Share with specific clients
// GET /api/admin/toast-hub/content/[id]/share - Get sharing status
// DELETE /api/admin/toast-hub/content/[id]/share - Remove client access
import { verifyAuth, unauthorizedResponse, getCorsHeaders, handleOptions } from '../../../../_shared/auth.js';

export async function onRequestGet(context) {
  const corsHeaders = getCorsHeaders(context.request);

  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, context.request);
    }

    const db = context.env.DB;
    const { id } = context.params;

    // Get post info
    const post = await db.prepare(`
      SELECT id, title, status FROM toast_hub_posts WHERE id = ?
    `).bind(id).first();

    if (!post) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Post not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Get clients with access
    const { results: sharedWith } = await db.prepare(`
      SELECT
        cca.id as access_id,
        cca.client_id,
        cca.access_level,
        cca.granted_at,
        cca.granted_by,
        cca.expires_at,
        c.name as client_name,
        c.email as client_email,
        c.company as client_company
      FROM client_content_access cca
      JOIN clients c ON cca.client_id = c.id
      WHERE cca.content_id = ? AND cca.content_type = 'post'
      ORDER BY cca.granted_at DESC
    `).bind(id).all();

    // Get available clients (not yet shared with)
    const { results: availableClients } = await db.prepare(`
      SELECT
        c.id,
        c.name,
        c.email,
        c.company
      FROM clients c
      WHERE c.id NOT IN (
        SELECT client_id FROM client_content_access WHERE content_id = ? AND content_type = 'post'
      )
      AND c.portal_enabled = 1
      ORDER BY c.name ASC
    `).bind(id).all();

    return new Response(JSON.stringify({
      success: true,
      data: {
        post: {
          id: post.id,
          title: post.title,
          status: post.status
        },
        shared_with: sharedWith || [],
        available_clients: availableClients || [],
        total_shared: (sharedWith || []).length
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

export async function onRequestPost(context) {
  const corsHeaders = getCorsHeaders(context.request);

  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, context.request);
    }

    const db = context.env.DB;
    const { id } = context.params;
    const body = await context.request.json();
    const now = Math.floor(Date.now() / 1000);

    const { client_ids, access_level = 'read', expires_in_days } = body;

    if (!client_ids || !Array.isArray(client_ids) || client_ids.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'client_ids array is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Validate access level
    const validLevels = ['read', 'download', 'full'];
    if (!validLevels.includes(access_level)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Invalid access_level. Must be one of: ${validLevels.join(', ')}`
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Check post exists
    const post = await db.prepare('SELECT id, title FROM toast_hub_posts WHERE id = ?').bind(id).first();
    if (!post) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Post not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Calculate expiry if provided
    const expiresAt = expires_in_days ? now + (expires_in_days * 24 * 60 * 60) : null;

    // Grant access to each client
    const results = [];
    for (const clientId of client_ids) {
      // Verify client exists
      const client = await db.prepare('SELECT id, name FROM clients WHERE id = ?').bind(clientId).first();
      if (!client) {
        results.push({ client_id: clientId, success: false, error: 'Client not found' });
        continue;
      }

      try {
        const accessId = crypto.randomUUID();
        await db.prepare(`
          INSERT OR REPLACE INTO client_content_access (
            id, client_id, content_id, content_type, granted_at,
            granted_by, expires_at, access_level
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          accessId,
          clientId,
          id,
          'post',
          now,
          auth.payload?.sub || 'admin',
          expiresAt,
          access_level
        ).run();

        results.push({
          client_id: clientId,
          client_name: client.name,
          success: true,
          access_id: accessId
        });
      } catch (err) {
        results.push({ client_id: clientId, success: false, error: err.message });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return new Response(JSON.stringify({
      success: true,
      data: {
        results,
        shared_count: successCount,
        message: `Shared "${post.title}" with ${successCount} client(s)`
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

export async function onRequestDelete(context) {
  const corsHeaders = getCorsHeaders(context.request);

  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, context.request);
    }

    const db = context.env.DB;
    const { id } = context.params;
    const url = new URL(context.request.url);
    const clientId = url.searchParams.get('client_id');

    if (!clientId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'client_id query parameter is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Remove access
    await db.prepare(`
      DELETE FROM client_content_access
      WHERE content_id = ? AND client_id = ? AND content_type = 'post'
    `).bind(id, clientId).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Client access removed'
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

export async function onRequestOptions(context) {
  return handleOptions(context.request);
}
