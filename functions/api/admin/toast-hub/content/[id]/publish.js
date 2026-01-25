// Toast Hub Content Publish API
// POST /api/admin/toast-hub/content/[id]/publish - Publish immediately
// DELETE /api/admin/toast-hub/content/[id]/publish - Unpublish (revert to draft)
import { verifyAuth, unauthorizedResponse, getCorsHeaders, handleOptions } from '../../../../_shared/auth.js';

export async function onRequestPost(context) {
  const corsHeaders = getCorsHeaders(context.request);

  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, context.request);
    }

    const db = context.env.DB;
    const { id } = context.params;
    const now = Math.floor(Date.now() / 1000);

    // Get current post state
    const existing = await db.prepare('SELECT * FROM toast_hub_posts WHERE id = ?').bind(id).first();
    if (!existing) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Post not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Validate required fields before publishing
    if (!existing.title || existing.title.trim() === '') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Post title is required for publishing'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (!existing.content || existing.content.trim() === '') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Post content is required for publishing'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Create revision before publishing
    const revisionId = crypto.randomUUID();
    const revisionVersion = (existing.revision_count || 0) + 1;

    await db.prepare(`
      INSERT INTO toast_hub_revisions (
        id, post_id, version, title, content, content_format,
        excerpt, category, status, tags_json, changed_by, change_summary, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      revisionId,
      id,
      revisionVersion,
      existing.title,
      existing.content,
      existing.content_format,
      existing.excerpt,
      existing.category,
      existing.status,
      existing.tags_json,
      auth.payload?.sub || 'admin',
      'Published immediately',
      now
    ).run();

    // Update post to published
    await db.prepare(`
      UPDATE toast_hub_posts SET
        status = 'published',
        published_at = ?,
        scheduled_for = NULL,
        updated_at = ?
      WHERE id = ?
    `).bind(now, now, id).run();

    const updated = await db.prepare('SELECT * FROM toast_hub_posts WHERE id = ?').bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: updated,
      message: 'Post published successfully'
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
    const now = Math.floor(Date.now() / 1000);

    // Get current post state
    const existing = await db.prepare('SELECT * FROM toast_hub_posts WHERE id = ?').bind(id).first();
    if (!existing) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Post not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Create revision before unpublishing
    const revisionId = crypto.randomUUID();
    const revisionVersion = (existing.revision_count || 0) + 1;

    await db.prepare(`
      INSERT INTO toast_hub_revisions (
        id, post_id, version, title, content, content_format,
        excerpt, category, status, tags_json, changed_by, change_summary, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      revisionId,
      id,
      revisionVersion,
      existing.title,
      existing.content,
      existing.content_format,
      existing.excerpt,
      existing.category,
      existing.status,
      existing.tags_json,
      auth.payload?.sub || 'admin',
      'Unpublished - reverted to draft',
      now
    ).run();

    // Revert to draft
    await db.prepare(`
      UPDATE toast_hub_posts SET
        status = 'draft',
        published_at = NULL,
        updated_at = ?
      WHERE id = ?
    `).bind(now, id).run();

    const updated = await db.prepare('SELECT * FROM toast_hub_posts WHERE id = ?').bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: updated,
      message: 'Post unpublished and reverted to draft'
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
