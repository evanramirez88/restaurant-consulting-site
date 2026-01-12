/**
 * Individual AI Provider API
 *
 * GET /api/admin/intelligence/providers/:id - Get provider details
 * PUT /api/admin/intelligence/providers/:id - Update provider
 * DELETE /api/admin/intelligence/providers/:id - Delete provider
 * POST /api/admin/intelligence/providers/:id/default - Set as default
 */

export async function onRequestGet(context) {
  const { params, env } = context;
  const { id } = params;

  try {
    const provider = await env.DB.prepare(
      'SELECT * FROM ai_providers WHERE id = ?'
    ).bind(id).first();

    if (!provider) {
      return Response.json({
        success: false,
        error: 'Provider not found',
      }, { status: 404 });
    }

    return Response.json({
      success: true,
      provider,
    });
  } catch (error) {
    console.error('Provider GET error:', error);
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

export async function onRequestPut(context) {
  const { request, params, env } = context;
  const { id } = params;

  try {
    const body = await request.json();
    const allowedFields = [
      'name', 'provider_type', 'model_id', 'api_endpoint',
      'max_tokens', 'temperature', 'is_active', 'system_prompt',
      'supports_vision', 'supports_function_calling', 'context_window',
      'cost_per_1k_input', 'cost_per_1k_output'
    ];

    // Build dynamic update
    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        let value = body[field];
        // Convert booleans to integers for SQLite
        if (typeof value === 'boolean') {
          value = value ? 1 : 0;
        }
        updates.push(`${field} = ?`);
        values.push(value);
      }
    }

    if (updates.length === 0) {
      return Response.json({
        success: false,
        error: 'No valid fields to update',
      }, { status: 400 });
    }

    updates.push('updated_at = unixepoch()');
    values.push(id);

    await env.DB.prepare(`
      UPDATE ai_providers
      SET ${updates.join(', ')}
      WHERE id = ?
    `).bind(...values).run();

    return Response.json({
      success: true,
      message: 'Provider updated',
    });
  } catch (error) {
    console.error('Provider PUT error:', error);
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  const { request, params, env } = context;
  const { id } = params;
  const url = new URL(request.url);

  // Check if this is a /default action
  if (url.pathname.endsWith('/default')) {
    try {
      // First, unset all defaults
      await env.DB.prepare(
        'UPDATE ai_providers SET is_default = 0'
      ).run();

      // Set this one as default
      await env.DB.prepare(
        'UPDATE ai_providers SET is_default = 1, updated_at = unixepoch() WHERE id = ?'
      ).bind(id).run();

      return Response.json({
        success: true,
        message: 'Provider set as default',
      });
    } catch (error) {
      console.error('Provider default error:', error);
      return Response.json({
        success: false,
        error: error.message,
      }, { status: 500 });
    }
  }

  return Response.json({
    success: false,
    error: 'Unknown action',
  }, { status: 400 });
}

export async function onRequestDelete(context) {
  const { params, env } = context;
  const { id } = params;

  try {
    // Check if it's the default provider
    const provider = await env.DB.prepare(
      'SELECT is_default FROM ai_providers WHERE id = ?'
    ).bind(id).first();

    if (provider?.is_default) {
      return Response.json({
        success: false,
        error: 'Cannot delete the default provider. Set another provider as default first.',
      }, { status: 400 });
    }

    const result = await env.DB.prepare(
      'DELETE FROM ai_providers WHERE id = ?'
    ).bind(id).run();

    if (result.meta?.changes === 0) {
      return Response.json({
        success: false,
        error: 'Provider not found',
      }, { status: 404 });
    }

    return Response.json({
      success: true,
      message: 'Provider deleted',
    });
  } catch (error) {
    console.error('Provider DELETE error:', error);
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
