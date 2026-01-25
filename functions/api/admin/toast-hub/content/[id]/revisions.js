// Toast Hub Content Revisions API
// GET /api/admin/toast-hub/content/[id]/revisions - List all revisions
// POST /api/admin/toast-hub/content/[id]/revisions - Restore a specific revision
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

    // Get all revisions for this post
    const { results: revisions } = await db.prepare(`
      SELECT
        id,
        post_id,
        version,
        title,
        content,
        content_format,
        excerpt,
        category,
        status,
        tags_json,
        changed_by,
        change_summary,
        created_at
      FROM toast_hub_revisions
      WHERE post_id = ?
      ORDER BY version DESC
    `).bind(id).all();

    return new Response(JSON.stringify({
      success: true,
      data: {
        post_id: id,
        post_title: post.title,
        revisions: revisions || [],
        total: (revisions || []).length
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

    const { revision_id } = body;
    if (!revision_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'revision_id is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Get the revision to restore
    const revision = await db.prepare(`
      SELECT * FROM toast_hub_revisions WHERE id = ? AND post_id = ?
    `).bind(revision_id, id).first();

    if (!revision) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Revision not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Get current post state to save as a new revision
    const current = await db.prepare('SELECT * FROM toast_hub_posts WHERE id = ?').bind(id).first();
    if (!current) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Post not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Get the highest version number
    const maxVersion = await db.prepare(`
      SELECT MAX(version) as max_version FROM toast_hub_revisions WHERE post_id = ?
    `).bind(id).first();
    const newVersion = (maxVersion?.max_version || 0) + 1;

    // Save current state as a revision before restoring
    const newRevisionId = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO toast_hub_revisions (
        id, post_id, version, title, content, content_format,
        excerpt, category, status, tags_json, changed_by, change_summary, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      newRevisionId,
      id,
      newVersion,
      current.title,
      current.content,
      current.content_format,
      current.excerpt,
      current.category,
      current.status,
      current.tags_json,
      auth.payload?.sub || 'admin',
      `State before restoring to version ${revision.version}`,
      now
    ).run();

    // Restore the post to the selected revision
    await db.prepare(`
      UPDATE toast_hub_posts SET
        title = ?,
        content = ?,
        content_format = ?,
        excerpt = ?,
        category = ?,
        tags_json = ?,
        updated_at = ?
      WHERE id = ?
    `).bind(
      revision.title,
      revision.content,
      revision.content_format,
      revision.excerpt,
      revision.category,
      revision.tags_json,
      now,
      id
    ).run();

    const updated = await db.prepare('SELECT * FROM toast_hub_posts WHERE id = ?').bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: updated,
      message: `Restored to version ${revision.version} from ${new Date(revision.created_at * 1000).toLocaleString()}`
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
