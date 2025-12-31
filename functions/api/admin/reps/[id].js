// Admin Rep API - Get, Update, Delete
export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    const { id } = context.params;

    const rep = await db.prepare(`
      SELECT
        r.*,
        (SELECT COUNT(*) FROM client_rep_assignments WHERE rep_id = r.id) as client_count
      FROM reps r
      WHERE r.id = ?
    `).bind(id).first();

    if (!rep) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Rep not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

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

export async function onRequestPut(context) {
  try {
    const db = context.env.DB;
    const { id } = context.params;
    const body = await context.request.json();
    const now = Math.floor(Date.now() / 1000);

    await db.prepare(`
      UPDATE reps SET
        email = ?,
        name = ?,
        territory = ?,
        slug = ?,
        phone = ?,
        portal_enabled = ?,
        status = ?,
        avatar_url = ?,
        notes = ?,
        updated_at = ?
      WHERE id = ?
    `).bind(
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
      id
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

export async function onRequestDelete(context) {
  try {
    const db = context.env.DB;
    const { id } = context.params;

    await db.prepare('DELETE FROM reps WHERE id = ?').bind(id).run();

    return new Response(JSON.stringify({
      success: true
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
