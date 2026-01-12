/**
 * AI Providers API
 *
 * GET /api/admin/intelligence/providers - List all providers
 * POST /api/admin/intelligence/providers - Create new provider
 */

export async function onRequestGet(context) {
  const { env } = context;

  try {
    const providers = await env.DB.prepare(`
      SELECT
        id,
        name,
        provider_type,
        model_id,
        api_endpoint,
        max_tokens,
        temperature,
        is_active,
        is_default,
        supports_vision,
        supports_function_calling,
        supports_streaming,
        context_window,
        cost_per_1k_input,
        cost_per_1k_output,
        total_requests,
        total_tokens_used,
        total_cost,
        created_at,
        updated_at
      FROM ai_providers
      ORDER BY is_default DESC, is_active DESC, name ASC
    `).all();

    return Response.json({
      success: true,
      providers: providers.results || [],
    });
  } catch (error) {
    console.error('Providers GET error:', error);
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
    const {
      name,
      provider_type,
      model_id,
      api_endpoint,
      max_tokens = 4096,
      temperature = 0.7,
      is_active = true,
      supports_vision = false,
      supports_function_calling = true,
      context_window = 128000,
      cost_per_1k_input = 0,
      cost_per_1k_output = 0,
    } = body;

    if (!name || !model_id || !provider_type) {
      return Response.json({
        success: false,
        error: 'name, model_id, and provider_type are required',
      }, { status: 400 });
    }

    const id = 'ai_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);

    await env.DB.prepare(`
      INSERT INTO ai_providers (
        id, name, provider_type, model_id, api_endpoint,
        max_tokens, temperature, is_active, is_default,
        supports_vision, supports_function_calling, context_window,
        cost_per_1k_input, cost_per_1k_output
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
    `).bind(
      id, name, provider_type, model_id, api_endpoint || null,
      max_tokens, temperature, is_active ? 1 : 0,
      supports_vision ? 1 : 0, supports_function_calling ? 1 : 0,
      context_window, cost_per_1k_input, cost_per_1k_output
    ).run();

    return Response.json({
      success: true,
      id,
      message: 'Provider created successfully',
    });
  } catch (error) {
    console.error('Providers POST error:', error);
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
