// Admin Reps API - List and Create
export async function onRequestGet(context) {
  try {
    const db = context.env.DB;

    const { results } = await db.prepare(`
      SELECT
        r.*,
        (SELECT COUNT(*) FROM client_rep_assignments WHERE rep_id = r.id) as client_count
      FROM reps r
      ORDER BY r.created_at DESC
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

    await db.prepare(`
      INSERT INTO reps (
        id, email, name, territory, slug, phone, portal_enabled,
        status, avatar_url, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.email,
      body.name,
      body.territory || null,
      body.slug || null,
      body.phone || null,
      body.portal_enabled ? 1 : 0,
      body.status || 'pending',
      body.avatar_url || null,
      body.notes || null,
      now,
      now
    ).run();

    const rep = await db.prepare('SELECT * FROM reps WHERE id = ?').bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: rep
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
