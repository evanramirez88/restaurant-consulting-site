// Site Content Management API
// GET: List all site content blocks
// POST: Create or update content blocks

export async function onRequestGet(context) {
  try {
    const { env } = context;

    // Check admin auth
    const authCookie = context.request.headers.get('Cookie')?.match(/admin_session=([^;]+)/)?.[1];
    if (!authCookie) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await env.DB.prepare(`
      SELECT id, page, section, content_key, content_value, content_type, is_editable, updated_at
      FROM site_content
      ORDER BY page, section, content_key
    `).all();

    // Group by page and section for easier UI consumption
    const grouped = {};
    for (const row of result.results || []) {
      if (!grouped[row.page]) grouped[row.page] = {};
      if (!grouped[row.page][row.section]) grouped[row.page][row.section] = [];
      grouped[row.page][row.section].push(row);
    }

    return new Response(JSON.stringify({
      success: true,
      data: result.results || [],
      grouped
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) {
  try {
    const { env, request } = context;

    // Check admin auth
    const authCookie = request.headers.get('Cookie')?.match(/admin_session=([^;]+)/)?.[1];
    if (!authCookie) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { page, section, content_key, content_value, content_type = 'text' } = body;

    if (!page || !section || !content_key) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: page, section, content_key'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const id = `${page}_${section}_${content_key}`;

    await env.DB.prepare(`
      INSERT INTO site_content (id, page, section, content_key, content_value, content_type, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, unixepoch())
      ON CONFLICT(page, section, content_key) DO UPDATE SET
        content_value = excluded.content_value,
        content_type = excluded.content_type,
        updated_at = unixepoch()
    `).bind(id, page, section, content_key, content_value || '', content_type).run();

    return new Response(JSON.stringify({
      success: true,
      data: { id, page, section, content_key, content_value, content_type }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestDelete(context) {
  try {
    const { env, request } = context;

    // Check admin auth
    const authCookie = request.headers.get('Cookie')?.match(/admin_session=([^;]+)/)?.[1];
    if (!authCookie) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing content ID'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await env.DB.prepare('DELETE FROM site_content WHERE id = ?').bind(id).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
