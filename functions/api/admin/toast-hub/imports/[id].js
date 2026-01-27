// Toast Hub Import Detail API - Single import management
// Handles approval, rejection, visibility toggles, and promotion to post
import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../_shared/auth.js';

function generateId(prefix) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}${random}`;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
}

/**
 * GET /api/admin/toast-hub/imports/:id
 * Get single import with full details
 */
export async function onRequestGet(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const importId = context.params.id;

    const item = await db.prepare(`
      SELECT i.*, s.name as source_name, s.source_type
      FROM toast_hub_imports i
      LEFT JOIN toast_hub_sources s ON i.source_id = s.id
      WHERE i.id = ?
    `).bind(importId).first();

    if (!item) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Import not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // If promoted to post, get post details
    let post = null;
    if (item.post_id) {
      post = await db.prepare('SELECT * FROM toast_hub_posts WHERE id = ?').bind(item.post_id).first();
    }

    return new Response(JSON.stringify({
      success: true,
      data: { ...item, post }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * PUT /api/admin/toast-hub/imports/:id
 * Update import (status, visibility, content edits)
 */
export async function onRequestPut(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const importId = context.params.id;
    const body = await context.request.json();
    const now = Math.floor(Date.now() / 1000);

    // Build dynamic update
    const updates = [];
    const params = [];

    // Status update (Gate 1)
    if (body.status !== undefined) {
      updates.push('status = ?');
      params.push(body.status);

      if (body.status === 'approved' || body.status === 'rejected') {
        updates.push('reviewed_by = ?', 'reviewed_at = ?');
        params.push(auth.user?.email || 'admin', now);
      }
    }

    // Visibility toggles (Gate 2) - Only allowed for approved content
    if (body.visible_public !== undefined) {
      updates.push('visible_public = ?');
      params.push(body.visible_public ? 1 : 0);
    }
    if (body.visible_client_portal !== undefined) {
      updates.push('visible_client_portal = ?');
      params.push(body.visible_client_portal ? 1 : 0);
    }
    if (body.visible_rep_portal !== undefined) {
      updates.push('visible_rep_portal = ?');
      params.push(body.visible_rep_portal ? 1 : 0);
    }

    // Content edits
    if (body.title !== undefined) {
      updates.push('title = ?');
      params.push(body.title);
    }
    if (body.excerpt !== undefined) {
      updates.push('excerpt = ?');
      params.push(body.excerpt);
    }
    if (body.content_body !== undefined) {
      updates.push('content_body = ?');
      params.push(body.content_body);
    }

    // GEO optimization fields
    if (body.tldr_summary !== undefined) {
      updates.push('tldr_summary = ?');
      params.push(body.tldr_summary);
    }
    if (body.expert_commentary !== undefined) {
      updates.push('expert_commentary = ?');
      params.push(body.expert_commentary);
    }
    if (body.fact_highlights_json !== undefined) {
      updates.push('fact_highlights_json = ?');
      params.push(typeof body.fact_highlights_json === 'string' ? body.fact_highlights_json : JSON.stringify(body.fact_highlights_json));
    }

    // Review notes
    if (body.review_notes !== undefined) {
      updates.push('review_notes = ?');
      params.push(body.review_notes);
    }

    // Category
    if (body.category_suggestion !== undefined) {
      updates.push('category_suggestion = ?');
      params.push(body.category_suggestion);
    }

    // Tags
    if (body.tags_json !== undefined) {
      updates.push('tags_json = ?');
      params.push(typeof body.tags_json === 'string' ? body.tags_json : JSON.stringify(body.tags_json));
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No updates provided'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(importId);

    await db.prepare(`
      UPDATE toast_hub_imports SET ${updates.join(', ')} WHERE id = ?
    `).bind(...params).run();

    const updated = await db.prepare(`
      SELECT i.*, s.name as source_name, s.source_type
      FROM toast_hub_imports i
      LEFT JOIN toast_hub_sources s ON i.source_id = s.id
      WHERE i.id = ?
    `).bind(importId).first();

    return new Response(JSON.stringify({
      success: true,
      data: updated
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /api/admin/toast-hub/imports/:id
 * Special actions: promote to post, generate content
 */
export async function onRequestPost(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const importId = context.params.id;
    const body = await context.request.json();
    const now = Math.floor(Date.now() / 1000);

    const item = await db.prepare('SELECT * FROM toast_hub_imports WHERE id = ?').bind(importId).first();
    if (!item) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Import not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Promote to post
    if (body.action === 'promote') {
      // Validate: must be approved
      if (item.status !== 'approved') {
        return new Response(JSON.stringify({
          success: false,
          error: 'Only approved imports can be promoted to posts'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check if already promoted
      if (item.post_id) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Import already promoted to post'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const postId = generateId('post');
      const slug = slugify(item.title);

      // Build full content with TL;DR and Expert Commentary
      let fullContent = '';
      if (item.tldr_summary) {
        fullContent += `**TL;DR:** ${item.tldr_summary}\n\n---\n\n`;
      }
      fullContent += item.content_body || item.excerpt || '';
      if (item.expert_commentary) {
        fullContent += `\n\n---\n\n**Expert Analysis:**\n\n${item.expert_commentary}`;
      }

      // Create the post
      await db.prepare(`
        INSERT INTO toast_hub_posts (
          id, slug, title, excerpt, content, content_format,
          category, tags_json, meta_title, meta_description,
          status, author, published_at,
          view_count, featured, display_order,
          visible_public, visible_client_portal, visible_rep_portal,
          tldr_summary, expert_commentary, fact_highlights_json, faq_json,
          source_import_id, source_type, source_url,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        postId,
        slug,
        item.title,
        item.excerpt || item.tldr_summary,
        fullContent,
        'markdown',
        item.category_suggestion || 'news',
        item.tags_json,
        item.title,
        item.tldr_summary || item.excerpt,
        'published',
        item.author || 'Evan Ramirez',
        now,
        0,
        0,
        0,
        item.visible_public,
        item.visible_client_portal,
        item.visible_rep_portal,
        item.tldr_summary,
        item.expert_commentary,
        item.fact_highlights_json,
        null, // faq_json - to be generated
        importId,
        item.source_id ? 'import' : 'manual',
        item.external_url,
        now,
        now
      ).run();

      // Update import with post reference
      await db.prepare(`
        UPDATE toast_hub_imports
        SET post_id = ?, promoted_at = ?, updated_at = ?
        WHERE id = ?
      `).bind(postId, now, now, importId).run();

      const post = await db.prepare('SELECT * FROM toast_hub_posts WHERE id = ?').bind(postId).first();

      return new Response(JSON.stringify({
        success: true,
        action: 'promoted',
        data: post
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Unknown action'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * DELETE /api/admin/toast-hub/imports/:id
 */
export async function onRequestDelete(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const importId = context.params.id;

    await db.prepare('DELETE FROM toast_hub_imports WHERE id = ?').bind(importId).run();

    return new Response(JSON.stringify({
      success: true,
      deleted: importId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
