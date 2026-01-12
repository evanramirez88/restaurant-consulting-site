/**
 * Set AI Provider as Default
 *
 * POST /api/admin/intelligence/providers/:id/default - Set as default provider
 */

export async function onRequestPost(context) {
  const { params, env } = context;
  const { id } = params;

  try {
    // Verify provider exists and is active
    const provider = await env.DB.prepare(
      'SELECT id, is_active FROM ai_providers WHERE id = ?'
    ).bind(id).first();

    if (!provider) {
      return Response.json({
        success: false,
        error: 'Provider not found',
      }, { status: 404 });
    }

    if (!provider.is_active) {
      return Response.json({
        success: false,
        error: 'Cannot set inactive provider as default',
      }, { status: 400 });
    }

    // Unset all existing defaults
    await env.DB.prepare(
      'UPDATE ai_providers SET is_default = 0, updated_at = unixepoch()'
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
