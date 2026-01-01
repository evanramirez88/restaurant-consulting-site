/**
 * Portal Client Info API
 *
 * GET /api/portal/[slug]/info
 *
 * Returns client information by slug for portal display.
 * This is a public endpoint for loading portal landing pages.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

export async function onRequestGet(context) {
  const { params, env } = context;
  const { slug } = params;

  if (!slug) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Missing client slug'
    }), {
      status: 400,
      headers: corsHeaders
    });
  }

  try {
    const db = env.DB;

    // Get client by slug
    const client = await db.prepare(`
      SELECT
        id,
        name,
        company,
        email,
        slug,
        avatar_url,
        portal_enabled,
        support_plan_tier,
        support_plan_status,
        support_plan_started,
        support_plan_renews,
        timezone
      FROM clients
      WHERE slug = ?
    `).bind(slug).first();

    if (!client) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Client not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Check if portal is enabled
    if (!client.portal_enabled) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Portal is not enabled for this client'
      }), {
        status: 403,
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: client.id,
        name: client.name,
        company: client.company,
        email: client.email,
        slug: client.slug,
        avatar_url: client.avatar_url,
        portal_enabled: Boolean(client.portal_enabled),
        support_plan_tier: client.support_plan_tier,
        support_plan_status: client.support_plan_status,
        support_plan_started: client.support_plan_started,
        support_plan_renews: client.support_plan_renews,
        timezone: client.timezone || 'America/New_York'
      }
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Portal info error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to load client information'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}
