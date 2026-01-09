// Admin Post API - Get, Update, Delete (Toast Hub)
import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const { id } = context.params;

    const post = await db.prepare('SELECT * FROM toast_hub_posts WHERE id = ?').bind(id).first();

    if (!post) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Post not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: post
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestPut(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const { id } = context.params;
    const body = await context.request.json();
    const now = Math.floor(Date.now() / 1000);

    // Get existing post to check status change
    const existing = await db.prepare('SELECT * FROM toast_hub_posts WHERE id = ?').bind(id).first();

    // Set published_at if status changes to published
    let publishedAt = existing?.published_at || null;
    if (body.status === 'published' && existing?.status !== 'published') {
      publishedAt = now;
    }

    await db.prepare(`
      UPDATE toast_hub_posts SET
        slug = ?,
        title = ?,
        excerpt = ?,
        content = ?,
        content_format = ?,
        category = ?,
        tags_json = ?,
        meta_title = ?,
        meta_description = ?,
        og_image_url = ?,
        status = ?,
        author = ?,
        published_at = ?,
        scheduled_for = ?,
        featured = ?,
        display_order = ?,
        updated_at = ?
      WHERE id = ?
    `).bind(
      body.slug || existing?.slug,
      body.title || '',
      body.excerpt || null,
      body.content || null,
      body.content_format || 'markdown',
      body.category || null,
      body.tags_json || null,
      body.meta_title || null,
      body.meta_description || null,
      body.og_image_url || null,
      body.status || 'draft',
      body.author || null,
      publishedAt,
      body.scheduled_for || null,
      body.featured ? 1 : 0,
      body.display_order || 0,
      now,
      id
    ).run();

    const post = await db.prepare('SELECT * FROM toast_hub_posts WHERE id = ?').bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: post
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestDelete(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const { id } = context.params;

    await db.prepare('DELETE FROM toast_hub_posts WHERE id = ?').bind(id).run();

    return new Response(JSON.stringify({
      success: true
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
