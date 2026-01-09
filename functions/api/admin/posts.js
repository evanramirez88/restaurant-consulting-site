// Admin Posts API - List and Create (Toast Hub)
import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;

    const { results } = await db.prepare(`
      SELECT * FROM toast_hub_posts
      ORDER BY created_at DESC
    `).all();

    return new Response(JSON.stringify({
      success: true,
      data: results || []
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

export async function onRequestPost(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const body = await context.request.json();

    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    // Generate slug from title if not provided
    const slug = body.slug || body.title
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 100);

    await db.prepare(`
      INSERT INTO toast_hub_posts (
        id, slug, title, excerpt, content, content_format,
        category, tags_json, meta_title, meta_description, og_image_url,
        status, author, published_at, scheduled_for,
        view_count, featured, display_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      slug,
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
      body.status === 'published' ? now : null,
      body.scheduled_for || null,
      0,
      body.featured ? 1 : 0,
      body.display_order || 0,
      now,
      now
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

export async function onRequestOptions() {
  return handleOptions();
}
