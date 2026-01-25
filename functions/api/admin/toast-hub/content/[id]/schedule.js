// Toast Hub Content Scheduling API
// POST /api/admin/toast-hub/content/[id]/schedule
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
    const body = await context.request.json();
    const now = Math.floor(Date.now() / 1000);

    // Validate scheduled_for timestamp
    const { scheduled_for } = body;
    if (!scheduled_for) {
      return new Response(JSON.stringify({
        success: false,
        error: 'scheduled_for timestamp is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Ensure scheduled time is in the future
    if (scheduled_for <= now) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Scheduled time must be in the future'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

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

    // Create revision before scheduling
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
      `Scheduled for publication at ${new Date(scheduled_for * 1000).toISOString()}`,
      now
    ).run();

    // Update post status to scheduled
    await db.prepare(`
      UPDATE toast_hub_posts SET
        status = 'scheduled',
        scheduled_for = ?,
        updated_at = ?
      WHERE id = ?
    `).bind(scheduled_for, now, id).run();

    const updated = await db.prepare('SELECT * FROM toast_hub_posts WHERE id = ?').bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: updated,
      message: `Post scheduled for ${new Date(scheduled_for * 1000).toLocaleString()}`
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

    // Cancel scheduling - revert to draft
    await db.prepare(`
      UPDATE toast_hub_posts SET
        status = 'draft',
        scheduled_for = NULL,
        updated_at = ?
      WHERE id = ? AND status = 'scheduled'
    `).bind(now, id).run();

    const updated = await db.prepare('SELECT * FROM toast_hub_posts WHERE id = ?').bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: updated,
      message: 'Schedule cancelled, post reverted to draft'
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
