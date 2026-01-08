/**
 * Toast Configuration Templates API
 *
 * GET /api/admin/automation/templates - List all templates
 * POST /api/admin/automation/templates - Create new template
 */

export async function onRequestGet(context) {
  const { env } = context;

  try {
    const templates = await env.DB.prepare(`
      SELECT
        id, name, description,
        applies_to_json,
        menu_structure_json,
        kds_config_json,
        order_flow_json,
        modifier_rules_json,
        priority,
        is_active,
        created_at, updated_at
      FROM toast_config_templates
      ORDER BY priority DESC, name ASC
    `).all();

    // Parse JSON fields
    const parsed = templates.results.map(t => ({
      ...t,
      applies_to: JSON.parse(t.applies_to_json || '{}'),
      menu_structure: JSON.parse(t.menu_structure_json || '{}'),
      kds_config: JSON.parse(t.kds_config_json || '{}'),
      order_flow: JSON.parse(t.order_flow_json || '{}'),
      modifier_rules: t.modifier_rules_json ? JSON.parse(t.modifier_rules_json) : null
    }));

    // Get modifier rule counts for each template
    const ruleCounts = await env.DB.prepare(`
      SELECT template_id, COUNT(*) as count
      FROM modifier_rules
      WHERE is_active = 1
      GROUP BY template_id
    `).all();

    const countMap = {};
    ruleCounts.results.forEach(r => {
      countMap[r.template_id] = r.count;
    });

    parsed.forEach(t => {
      t.modifier_rule_count = countMap[t.id] || 0;
    });

    return new Response(JSON.stringify({
      success: true,
      data: parsed
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
  const { request, env } = context;

  try {
    const body = await request.json();
    const { name, description, applies_to, menu_structure, kds_config, order_flow, priority } = body;

    if (!name || !applies_to || !menu_structure || !kds_config || !order_flow) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const id = `tmpl_${crypto.randomUUID().split('-')[0]}`;

    await env.DB.prepare(`
      INSERT INTO toast_config_templates (
        id, name, description,
        applies_to_json, menu_structure_json, kds_config_json, order_flow_json,
        priority, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, unixepoch(), unixepoch())
    `).bind(
      id,
      name,
      description || null,
      JSON.stringify(applies_to),
      JSON.stringify(menu_structure),
      JSON.stringify(kds_config),
      JSON.stringify(order_flow),
      priority || 0
    ).run();

    return new Response(JSON.stringify({
      success: true,
      data: { id, name }
    }), {
      status: 201,
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
