// Admin Availability Schedule API - Get, Update, Delete
export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    const { id } = context.params;

    const schedule = await db.prepare('SELECT * FROM availability_schedules WHERE id = ?').bind(id).first();

    if (!schedule) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Schedule not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

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

export async function onRequestPut(context) {
  try {
    const db = context.env.DB;
    const { id } = context.params;
    const body = await context.request.json();
    const now = Math.floor(Date.now() / 1000);

    await db.prepare(`
      UPDATE availability_schedules SET
        title = ?,
        status = ?,
        location_type = ?,
        town = ?,
        address = ?,
        walk_ins_accepted = ?,
        scheduling_available = ?,
        scheduling_link = ?,
        scheduling_link_type = ?,
        availability_start = ?,
        availability_end = ?,
        display_start = ?,
        display_end = ?,
        custom_message = ?,
        priority = ?,
        is_active = ?,
        updated_at = ?
      WHERE id = ?
    `).bind(
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
      id
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

export async function onRequestDelete(context) {
  try {
    const db = context.env.DB;
    const { id } = context.params;

    await db.prepare('DELETE FROM availability_schedules WHERE id = ?').bind(id).run();

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
