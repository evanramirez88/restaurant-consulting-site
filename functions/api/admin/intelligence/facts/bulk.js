/**
 * Bulk Facts API
 *
 * POST /api/admin/intelligence/facts/bulk - Create multiple facts at once
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { client_id, facts } = body;

    if (!client_id || !facts || !Array.isArray(facts)) {
      return Response.json({
        success: false,
        error: 'client_id and facts array are required',
      }, { status: 400 });
    }

    // Verify client exists
    const client = await env.DB.prepare(
      'SELECT id FROM clients WHERE id = ?'
    ).bind(client_id).first();

    if (!client) {
      return Response.json({
        success: false,
        error: 'Client not found',
      }, { status: 404 });
    }

    let factsCreated = 0;
    const errors = [];

    for (const fact of facts) {
      try {
        if (!fact.field_name || fact.field_value === undefined) {
          errors.push({ fact, error: 'Missing field_name or field_value' });
          continue;
        }

        const factId = 'fact_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);

        await env.DB.prepare(`
          INSERT INTO client_atomic_facts (
            id, client_id, field_name, field_value, original_text,
            source, confidence, status, ai_provider_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, unixepoch())
        `).bind(
          factId,
          client_id,
          fact.field_name,
          String(fact.field_value),
          fact.original_text || null,
          fact.source || 'import',
          fact.confidence || 0.5,
          fact.ai_provider_id || null
        ).run();

        factsCreated++;
      } catch (factError) {
        errors.push({ fact, error: factError.message });
      }
    }

    return Response.json({
      success: true,
      facts_created: factsCreated,
      errors: errors.length > 0 ? errors : undefined,
      message: `Created ${factsCreated} facts${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
    });
  } catch (error) {
    console.error('Bulk facts error:', error);
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
