// Admin API Configs - List and Update
export async function onRequestGet(context) {
  try {
    const db = context.env.DB;

    const { results } = await db.prepare(`
      SELECT * FROM api_configs
      ORDER BY service ASC
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
    const now = Math.floor(Date.now() / 1000);

    // Upsert API config
    await db.prepare(`
      INSERT INTO api_configs (
        id, service, provider, display_name, config_json, is_active,
        fallback_provider, rate_limit_per_hour, notes, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(service) DO UPDATE SET
        provider = excluded.provider,
        display_name = excluded.display_name,
        config_json = excluded.config_json,
        is_active = excluded.is_active,
        fallback_provider = excluded.fallback_provider,
        rate_limit_per_hour = excluded.rate_limit_per_hour,
        notes = excluded.notes,
        updated_at = excluded.updated_at
    `).bind(
      body.id || `api_${body.service}`,
      body.service,
      body.provider,
      body.display_name || null,
      body.config_json || null,
      body.is_active !== false ? 1 : 0,
      body.fallback_provider || null,
      body.rate_limit_per_hour || null,
      body.notes || null,
      now
    ).run();

    const config = await db.prepare('SELECT * FROM api_configs WHERE service = ?').bind(body.service).first();

    return new Response(JSON.stringify({
      success: true,
      data: config
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
