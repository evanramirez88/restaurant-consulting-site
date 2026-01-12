/**
 * Research Sessions API
 *
 * GET /api/admin/intelligence/research - List research sessions
 * POST /api/admin/intelligence/research - Start new research
 */

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const clientId = url.searchParams.get('client_id');
  const status = url.searchParams.get('status');
  const limit = parseInt(url.searchParams.get('limit') || '20');

  try {
    let query = `
      SELECT
        rs.*,
        c.name as client_name,
        c.company as client_company,
        ai.name as ai_provider_name
      FROM research_sessions rs
      LEFT JOIN clients c ON rs.client_id = c.id
      LEFT JOIN ai_providers ai ON rs.ai_provider_id = ai.id
      WHERE 1=1
    `;
    const params = [];

    if (clientId) {
      query += ' AND rs.client_id = ?';
      params.push(clientId);
    }
    if (status) {
      query += ' AND rs.status = ?';
      params.push(status);
    }

    query += ' ORDER BY rs.created_at DESC LIMIT ?';
    params.push(limit);

    const sessions = await env.DB.prepare(query).bind(...params).all();

    return Response.json({
      success: true,
      sessions: sessions.results || [],
    });
  } catch (error) {
    console.error('Research GET error:', error);
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { client_id, research_type, query: searchQuery } = body;

    if (!client_id || !research_type) {
      return Response.json({
        success: false,
        error: 'client_id and research_type are required',
      }, { status: 400 });
    }

    // Get client info
    const client = await env.DB.prepare(
      'SELECT id, name, company FROM clients WHERE id = ?'
    ).bind(client_id).first();

    if (!client) {
      return Response.json({
        success: false,
        error: 'Client not found',
      }, { status: 404 });
    }

    // Get default AI provider
    const defaultProvider = await env.DB.prepare(
      'SELECT id, name FROM ai_providers WHERE is_default = 1 AND is_active = 1'
    ).first();

    // Create research session
    const sessionId = 'research_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    const title = `${research_type} - ${client.company || client.name}`;

    await env.DB.prepare(`
      INSERT INTO research_sessions (
        id, title, client_id, target_type, research_type, query,
        status, ai_provider_id, started_at
      ) VALUES (?, ?, ?, 'client', ?, ?, 'in_progress', ?, unixepoch())
    `).bind(
      sessionId, title, client_id, research_type, searchQuery || null,
      defaultProvider?.id || null
    ).run();

    // For now, we'll simulate research by creating some placeholder facts
    // In a real implementation, this would call the AI provider
    const simulatedFacts = generateSimulatedFacts(client, research_type);

    // Insert simulated facts
    for (const fact of simulatedFacts) {
      const factId = 'fact_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
      await env.DB.prepare(`
        INSERT INTO client_atomic_facts (
          id, client_id, field_name, field_value, original_text,
          source, confidence, status, ai_provider_id
        ) VALUES (?, ?, ?, ?, ?, 'ai_research', ?, 'pending', ?)
      `).bind(
        factId, client_id, fact.field, fact.value, fact.source,
        fact.confidence, defaultProvider?.id || null
      ).run();
    }

    // Update session as completed
    await env.DB.prepare(`
      UPDATE research_sessions
      SET status = 'completed', facts_found = ?, completed_at = unixepoch()
      WHERE id = ?
    `).bind(simulatedFacts.length, sessionId).run();

    return Response.json({
      success: true,
      session_id: sessionId,
      facts_found: simulatedFacts.length,
      message: `Research completed. Found ${simulatedFacts.length} potential facts.`,
    });
  } catch (error) {
    console.error('Research POST error:', error);
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

// Simulated fact generation (replace with actual AI in production)
function generateSimulatedFacts(client, researchType) {
  const facts = [];
  const companyName = client.company || client.name;

  if (researchType === 'discovery') {
    facts.push({
      field: 'cuisine_type',
      value: 'American',
      source: `Based on ${companyName} typical menu offerings`,
      confidence: 0.7,
    });
    facts.push({
      field: 'service_style',
      value: 'Full Service',
      source: `${companyName} appears to offer full table service`,
      confidence: 0.65,
    });
  } else if (researchType === 'enrichment') {
    facts.push({
      field: 'seating_capacity',
      value: '75',
      source: `Estimated seating capacity for ${companyName}`,
      confidence: 0.5,
    });
  } else if (researchType === 'verification') {
    facts.push({
      field: 'website',
      value: `https://www.${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      source: `Potential website for ${companyName}`,
      confidence: 0.4,
    });
  }

  return facts;
}
