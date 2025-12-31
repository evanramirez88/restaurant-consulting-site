// Admin Categories API - List and Create (Toast Hub)
export async function onRequestGet(context) {
  try {
    const db = context.env.DB;

    const { results } = await db.prepare(`
      SELECT * FROM toast_hub_categories
      ORDER BY display_order ASC, name ASC
    `).all();

    return new Response(JSON.stringify({
      success: true,
      data: results || []
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
    const db = context.env.DB;
    const body = await context.request.json();

    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    const slug = body.slug || body.name
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    await db.prepare(`
      INSERT INTO toast_hub_categories (
        id, slug, name, description, display_order, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      slug,
      body.name || '',
      body.description || null,
      body.display_order || 0,
      body.is_active !== false ? 1 : 0,
      now
    ).run();

    const category = await db.prepare('SELECT * FROM toast_hub_categories WHERE id = ?').bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: category
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
