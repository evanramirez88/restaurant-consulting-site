// Toast Hub Beacon Import API
// POST /api/admin/toast-hub/import-from-beacon - Import content from Beacon
import { verifyAuth, unauthorizedResponse, getCorsHeaders, handleOptions } from '../../_shared/auth.js';

export async function onRequestPost(context) {
  const corsHeaders = getCorsHeaders(context.request);

  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, context.request);
    }

    const db = context.env.DB;
    const body = await context.request.json();
    const now = Math.floor(Date.now() / 1000);

    const { beacon_item_id, template_id, title_override, category_override, as_draft } = body;

    if (!beacon_item_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'beacon_item_id is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Get the Beacon content item
    const beaconItem = await db.prepare(`
      SELECT
        bi.*,
        bs.name as source_name
      FROM beacon_content_items bi
      LEFT JOIN beacon_sources bs ON bi.source_id = bs.id
      WHERE bi.id = ?
    `).bind(beacon_item_id).first();

    if (!beaconItem) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Beacon content item not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Check if already imported
    const existingImport = await db.prepare(`
      SELECT * FROM beacon_to_toasthub_imports WHERE beacon_item_id = ?
    `).bind(beacon_item_id).first();

    if (existingImport) {
      return new Response(JSON.stringify({
        success: false,
        error: 'This content has already been imported',
        existing_post_id: existingImport.toast_hub_post_id
      }), {
        status: 409,
        headers: corsHeaders
      });
    }

    // Get template if specified
    let templateContent = null;
    if (template_id) {
      const template = await db.prepare(`
        SELECT * FROM toast_hub_templates WHERE id = ?
      `).bind(template_id).first();
      if (template) {
        templateContent = template.default_content;
      }
    }

    // Generate slug from title
    const title = title_override || beaconItem.title;
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 100);

    // Check for slug collision
    const existingSlug = await db.prepare(`
      SELECT id FROM toast_hub_posts WHERE slug = ?
    `).bind(slug).first();

    const finalSlug = existingSlug ? `${slug}-${Date.now()}` : slug;

    // Build content from Beacon item
    let content = '';

    // If template provided, use it as base and inject Beacon content
    if (templateContent) {
      content = templateContent;
      // Replace common placeholders if any
      content = content.replace(/\{\{title\}\}/g, title);
      content = content.replace(/\{\{source\}\}/g, beaconItem.source_name || beaconItem.source_type);
      content = content.replace(/\{\{author\}\}/g, beaconItem.author || 'Unknown');
    } else {
      // Build content from Beacon item data
      content = `## Source\n\nFrom: ${beaconItem.source_name || beaconItem.source_type}`;
      if (beaconItem.author) {
        content += `\nAuthor: ${beaconItem.author}`;
      }
      if (beaconItem.url) {
        content += `\nOriginal: [View Source](${beaconItem.url})`;
      }
      content += '\n\n---\n\n';

      // Add AI summary if available
      if (beaconItem.ai_summary) {
        content += `## Summary\n\n${beaconItem.ai_summary}\n\n`;
      }

      // Add original content
      if (beaconItem.body) {
        content += `## Original Content\n\n${beaconItem.body}\n`;
      }
    }

    // Map Beacon category to Toast Hub category
    const categoryMap = {
      'menu': 'tips',
      'hardware': 'guides',
      'integrations': 'guides',
      'reports': 'tips',
      'labor': 'guides',
      'training': 'guides',
      'general': 'tips'
    };
    const category = category_override || categoryMap[beaconItem.ai_category] || 'tips';

    // Build tags from Beacon AI tags
    let tags = [];
    if (beaconItem.ai_tags_json) {
      try {
        tags = JSON.parse(beaconItem.ai_tags_json);
      } catch (e) {}
    }
    // Add source type as tag
    if (beaconItem.source_type) {
      tags.push(beaconItem.source_type);
    }

    // Create the Toast Hub post
    const postId = crypto.randomUUID();
    const status = as_draft !== false ? 'draft' : 'published';

    await db.prepare(`
      INSERT INTO toast_hub_posts (
        id, slug, title, excerpt, content, content_format,
        category, tags_json, meta_title, meta_description,
        status, author, published_at, view_count, featured,
        display_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      postId,
      finalSlug,
      title,
      beaconItem.ai_summary || beaconItem.body?.substring(0, 200) || null,
      content,
      'markdown',
      category,
      tags.length > 0 ? JSON.stringify(tags) : null,
      title.substring(0, 60),
      beaconItem.ai_summary?.substring(0, 160) || null,
      status,
      'R&G Consulting',
      status === 'published' ? now : null,
      0,
      0,
      0,
      now,
      now
    ).run();

    // Record the import
    const importId = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO beacon_to_toasthub_imports (
        id, beacon_item_id, toast_hub_post_id, import_status,
        imported_by, imported_at, modifications_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      importId,
      beacon_item_id,
      postId,
      'imported',
      auth.payload?.sub || 'admin',
      now,
      JSON.stringify({
        title_override: !!title_override,
        category_override: !!category_override,
        template_id: template_id || null,
        as_draft
      })
    ).run();

    // Update Beacon item status
    await db.prepare(`
      UPDATE beacon_content_items SET
        status = 'transformed',
        updated_at = ?
      WHERE id = ?
    `).bind(now, beacon_item_id).run();

    // Get the created post
    const post = await db.prepare('SELECT * FROM toast_hub_posts WHERE id = ?').bind(postId).first();

    return new Response(JSON.stringify({
      success: true,
      data: post,
      import_id: importId,
      message: `Successfully imported "${title}" from Beacon`
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

// GET available Beacon content for import
export async function onRequestGet(context) {
  const corsHeaders = getCorsHeaders(context.request);

  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, context.request);
    }

    const db = context.env.DB;
    const url = new URL(context.request.url);
    const status = url.searchParams.get('status') || 'approved';
    const category = url.searchParams.get('category');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    // Get Beacon items that are approved but not yet imported
    let query = `
      SELECT
        bi.*,
        bs.name as source_name,
        CASE WHEN bti.id IS NOT NULL THEN 1 ELSE 0 END as already_imported
      FROM beacon_content_items bi
      LEFT JOIN beacon_sources bs ON bi.source_id = bs.id
      LEFT JOIN beacon_to_toasthub_imports bti ON bi.id = bti.beacon_item_id
      WHERE bi.status = ?
    `;
    const params = [status];

    if (category) {
      query += ' AND bi.ai_category = ?';
      params.push(category);
    }

    query += ' ORDER BY bi.ai_priority_score DESC, bi.fetched_at DESC LIMIT ?';
    params.push(limit);

    const stmt = db.prepare(query);
    const { results } = await stmt.bind(...params).all();

    // Get templates
    const { results: templates } = await db.prepare(`
      SELECT id, name, template_type, description
      FROM toast_hub_templates
      WHERE is_active = 1
      ORDER BY usage_count DESC, name ASC
    `).all();

    return new Response(JSON.stringify({
      success: true,
      data: {
        items: results || [],
        templates: templates || [],
        total: (results || []).length
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

export async function onRequestOptions(context) {
  return handleOptions(context.request);
}
