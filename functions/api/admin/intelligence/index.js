/**
 * Client Intelligence API - Main Index
 *
 * GET /api/admin/intelligence - Dashboard stats
 * GET /api/admin/intelligence/facts - List pending facts
 * POST /api/admin/intelligence/facts/:id/approve - Approve a fact
 * POST /api/admin/intelligence/facts/:id/reject - Reject a fact
 */

export async function onRequestGet(context) {
  const { env } = context;

  try {
    // Get dashboard stats
    const stats = await env.DB.prepare(`
      SELECT
        (SELECT COUNT(*) FROM clients) as total_clients,
        (SELECT COUNT(*) FROM clients WHERE portal_enabled = 1) as active_portals,
        (SELECT COUNT(*) FROM client_profiles) as profiled_clients,
        (SELECT COUNT(*) FROM client_atomic_facts WHERE status = 'pending') as pending_facts,
        (SELECT COUNT(*) FROM client_atomic_facts WHERE status = 'approved') as approved_facts,
        (SELECT COUNT(*) FROM file_imports WHERE import_status = 'pending') as pending_imports,
        (SELECT COUNT(*) FROM ai_usage_logs WHERE created_at > unixepoch() - 86400) as ai_calls_today,
        (SELECT SUM(cost_estimate) FROM ai_usage_logs WHERE created_at > unixepoch() - 86400) as ai_cost_today
    `).first();

    // Get recent facts
    const recentFacts = await env.DB.prepare(`
      SELECT
        f.id,
        f.client_id,
        c.name as client_name,
        c.company as client_company,
        f.field_name,
        f.field_value,
        f.confidence,
        f.source,
        f.created_at
      FROM client_atomic_facts f
      JOIN clients c ON f.client_id = c.id
      WHERE f.status = 'pending'
      ORDER BY f.confidence DESC, f.created_at DESC
      LIMIT 10
    `).all();

    // Get AI provider stats
    const providers = await env.DB.prepare(`
      SELECT
        id,
        name,
        provider_type,
        model_id,
        is_active,
        is_default,
        total_requests,
        total_tokens_used,
        total_cost
      FROM ai_providers
      ORDER BY is_default DESC, is_active DESC
    `).all();

    return Response.json({
      success: true,
      stats,
      pending_facts: recentFacts.results || [],
      ai_providers: providers.results || [],
    });
  } catch (error) {
    console.error('Intelligence API error:', error);
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    const body = await request.json();

    // Route based on action
    if (body.action === 'research') {
      return handleResearch(env, body);
    }

    if (body.action === 'extract_facts') {
      return handleExtractFacts(env, body);
    }

    return Response.json({
      success: false,
      error: 'Unknown action',
    }, { status: 400 });
  } catch (error) {
    console.error('Intelligence POST error:', error);
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

async function handleResearch(env, body) {
  const { client_id, query, provider_id } = body;

  // Get active provider
  let provider;
  if (provider_id) {
    provider = await env.DB.prepare(
      'SELECT * FROM ai_providers WHERE id = ? AND is_active = 1'
    ).bind(provider_id).first();
  } else {
    provider = await env.DB.prepare(
      'SELECT * FROM ai_providers WHERE is_default = 1 AND is_active = 1'
    ).first();
  }

  if (!provider) {
    return Response.json({
      success: false,
      error: 'No active AI provider configured',
    }, { status: 400 });
  }

  // Get client info
  const client = await env.DB.prepare(
    'SELECT * FROM clients WHERE id = ?'
  ).bind(client_id).first();

  if (!client) {
    return Response.json({
      success: false,
      error: 'Client not found',
    }, { status: 404 });
  }

  // Create research session
  const sessionId = 'research_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);

  await env.DB.prepare(`
    INSERT INTO research_sessions (id, client_id, target_type, research_type, query, status, ai_provider_id, started_at, created_at)
    VALUES (?, ?, 'client', 'enrichment', ?, 'in_progress', ?, unixepoch(), unixepoch())
  `).bind(sessionId, client_id, query, provider.id).run();

  // Note: Actual AI call would be implemented here based on provider type
  // For now, return session info for async processing

  return Response.json({
    success: true,
    session_id: sessionId,
    provider: provider.name,
    status: 'in_progress',
    message: 'Research session started. Check back for results.',
  });
}

async function handleExtractFacts(env, body) {
  const { text, client_id, source } = body;

  if (!text || text.length < 10) {
    return Response.json({
      success: false,
      error: 'Text too short for extraction',
    }, { status: 400 });
  }

  // Get default provider
  const provider = await env.DB.prepare(
    'SELECT * FROM ai_providers WHERE is_default = 1 AND is_active = 1'
  ).first();

  if (!provider) {
    return Response.json({
      success: false,
      error: 'No active AI provider configured',
    }, { status: 400 });
  }

  // For now, return a placeholder - actual AI extraction would go here
  // This would call the appropriate AI API based on provider.provider_type

  return Response.json({
    success: true,
    provider: provider.name,
    message: 'Fact extraction would be performed here',
    note: 'AI integration requires API keys to be configured',
  });
}
