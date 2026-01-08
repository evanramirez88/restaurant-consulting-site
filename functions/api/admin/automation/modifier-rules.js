/**
 * Modifier Rules API
 *
 * GET /api/admin/automation/modifier-rules - List all modifier rules
 * GET /api/admin/automation/modifier-rules?template_id=xxx - Get rules for template
 * POST /api/admin/automation/modifier-rules - Create new rule
 */

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const templateId = url.searchParams.get('template_id');
  const category = url.searchParams.get('category');

  try {
    let query = `
      SELECT
        mr.*,
        t.name as template_name
      FROM modifier_rules mr
      LEFT JOIN toast_config_templates t ON mr.template_id = t.id
      WHERE 1=1
    `;
    const params = [];

    if (templateId) {
      query += ` AND (mr.template_id = ? OR mr.template_id IS NULL)`;
      params.push(templateId);
    }

    if (category) {
      query += ` AND mr.rule_category = ?`;
      params.push(category);
    }

    query += ` ORDER BY mr.priority DESC, mr.rule_name ASC`;

    const stmt = env.DB.prepare(query);
    const result = params.length > 0
      ? await stmt.bind(...params).all()
      : await stmt.all();

    const rules = (result.results || []).map(formatRule);

    return new Response(JSON.stringify({
      success: true,
      data: rules
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
    const {
      template_id,
      rule_name,
      rule_description,
      rule_category,
      trigger_type,
      trigger_pattern,
      modifier_group_name,
      modifier_group_type,
      modifier_options,
      is_required,
      priority
    } = body;

    if (!rule_name || !trigger_type || !trigger_pattern || !modifier_group_name || !modifier_options) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const id = `rule_${crypto.randomUUID().split('-')[0]}`;

    await env.DB.prepare(`
      INSERT INTO modifier_rules (
        id, template_id, rule_name, rule_description, rule_category,
        trigger_type, trigger_pattern, trigger_case_sensitive,
        modifier_group_name, modifier_group_type, modifier_min_selections, modifier_max_selections,
        modifier_options_json, price_inclusion, priority, is_required, apply_to_variants,
        is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 1, 1, ?, 'included', ?, ?, 1, 1, unixepoch(), unixepoch())
    `).bind(
      id,
      template_id || null,
      rule_name,
      rule_description || null,
      rule_category || 'general',
      trigger_type,
      trigger_pattern,
      modifier_group_name,
      modifier_group_type || 'single',
      JSON.stringify(modifier_options),
      priority || 0,
      is_required ? 1 : 0
    ).run();

    return new Response(JSON.stringify({
      success: true,
      data: { id, rule_name }
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

function formatRule(row) {
  return {
    id: row.id,
    template_id: row.template_id,
    template_name: row.template_name,

    rule_name: row.rule_name,
    rule_description: row.rule_description,
    rule_category: row.rule_category,

    trigger_type: row.trigger_type,
    trigger_pattern: row.trigger_pattern,
    trigger_case_sensitive: row.trigger_case_sensitive === 1,

    modifier_group_name: row.modifier_group_name,
    modifier_group_type: row.modifier_group_type,
    modifier_min_selections: row.modifier_min_selections,
    modifier_max_selections: row.modifier_max_selections,
    modifier_options: JSON.parse(row.modifier_options_json || '[]'),

    price_inclusion: row.price_inclusion,
    priority: row.priority,
    is_required: row.is_required === 1,
    apply_to_variants: row.apply_to_variants === 1,

    is_active: row.is_active === 1,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}
