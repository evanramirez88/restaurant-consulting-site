// Admin Availability Schedules API - List and Create
export async function onRequestGet(context) {
  try {
    const db = context.env.DB;

    const { results } = await db.prepare(`
      SELECT * FROM availability_schedules
      ORDER BY priority DESC, created_at DESC
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
      INSERT INTO availability_schedules (
        id, title, status, location_type, town, address,
        walk_ins_accepted, scheduling_available, scheduling_link, scheduling_link_type,
        availability_start, availability_end, display_start, display_end,
        custom_message, priority, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.title || null,
      body.status || 'available',
      body.location_type || 'remote',
      body.town || null,
      body.address || null,
      body.walk_ins_accepted ? 1 : 0,
      body.scheduling_available ? 1 : 0,
      body.scheduling_link || null,
      body.scheduling_link_type || null,
      body.availability_start || null,
      body.availability_end || null,
      body.display_start || null,
      body.display_end || null,
      body.custom_message || null,
      body.priority || 0,
      body.is_active !== false ? 1 : 0,
      now,
      now
    ).run();

    const schedule = await db.prepare('SELECT * FROM availability_schedules WHERE id = ?').bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: schedule
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
