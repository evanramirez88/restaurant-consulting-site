/**
 * Restaurant Classifications API
 *
 * GET /api/admin/automation/classifications - List classifications
 * GET /api/admin/automation/classifications?client_id=xxx - Get client's classification
 */

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const clientId = url.searchParams.get('client_id');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  try {
    let query;
    let params;

    if (clientId) {
      // Get specific client's classification
      query = `
        SELECT
          rc.*,
          c.name as client_name,
          c.company_name as client_company,
          t.name as template_name,
          t.description as template_description
        FROM restaurant_classifications rc
        LEFT JOIN clients c ON rc.client_id = c.id
        LEFT JOIN toast_config_templates t ON rc.config_template_id = t.id
        WHERE rc.client_id = ?
        ORDER BY rc.created_at DESC
        LIMIT 1
      `;
      params = [clientId];
    } else {
      // List all classifications
      query = `
        SELECT
          rc.*,
          c.name as client_name,
          c.company_name as client_company,
          t.name as template_name
        FROM restaurant_classifications rc
        LEFT JOIN clients c ON rc.client_id = c.id
        LEFT JOIN toast_config_templates t ON rc.config_template_id = t.id
        ORDER BY rc.created_at DESC
        LIMIT ? OFFSET ?
      `;
      params = [limit, offset];
    }

    const stmt = env.DB.prepare(query);
    const result = clientId
      ? await stmt.bind(...params).first()
      : await stmt.bind(...params).all();

    // Get total count
    const countResult = await env.DB.prepare(`
      SELECT COUNT(*) as total FROM restaurant_classifications
    `).first();

    if (clientId) {
      return new Response(JSON.stringify({
        success: true,
        data: result ? formatClassification(result) : null
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: (result.results || []).map(formatClassification),
      pagination: {
        total: countResult?.total || 0,
        limit,
        offset
      }
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

function formatClassification(row) {
  return {
    id: row.id,
    client_id: row.client_id,
    client_name: row.client_name,
    client_company: row.client_company,
    restaurant_id: row.restaurant_id,

    // Classification
    service_style: row.service_style,
    establishment_type: row.establishment_type,
    beverage_focus: row.beverage_focus,
    cuisine_types: row.cuisine_types_json ? JSON.parse(row.cuisine_types_json) : [],
    hours_pattern: row.hours_pattern,
    volume_level: row.volume_level,
    price_point: row.price_point,

    // Features
    has_bar: row.has_bar === 1,
    has_patio: row.has_patio === 1,
    has_delivery: row.has_delivery === 1,
    has_takeout: row.has_takeout === 1,
    has_reservations: row.has_reservations === 1,

    // AI metadata
    classification_confidence: row.classification_confidence,
    data_sources: row.data_sources_json ? JSON.parse(row.data_sources_json) : [],
    ai_model_used: row.ai_model_used,

    // Template
    config_template_id: row.config_template_id,
    template_name: row.template_name,
    template_description: row.template_description,

    // Override info
    is_manual_override: row.is_manual_override === 1,
    reviewed_by: row.reviewed_by,
    reviewed_at: row.reviewed_at,
    review_notes: row.review_notes,

    created_at: row.created_at,
    updated_at: row.updated_at
  };
}
