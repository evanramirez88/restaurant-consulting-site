/**
 * Portal Client Info API
 *
 * GET /api/portal/[slug]/info
 *
 * Returns client information by slug for portal display.
 * Uses new unified data model: organizations + org_contacts + client_accounts
 * Falls back to legacy clients table for backward compatibility.
 * Supports demo mode for slugs starting with "demo-".
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

// Demo client data for testing
const DEMO_CLIENTS = {
  'demo-seafood-shack': {
    id: 'demo-client-001',
    name: 'Demo User',
    company: 'Demo Seafood Shack',
    email: 'demo@example.com',
    slug: 'demo-seafood-shack',
    avatar_url: null,
    portal_enabled: true,
    support_plan_tier: 'professional',
    support_plan_status: 'active',
    support_plan_started: Date.now() - 30 * 24 * 60 * 60 * 1000,
    support_plan_renews: Date.now() + 30 * 24 * 60 * 60 * 1000,
    timezone: 'America/New_York',
    organization_id: 'demo-org-001',
    health_score: 85,
    health_trend: 'improving'
  }
};

export async function onRequestGet(context) {
  const { params, env, request } = context;
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

  // Check for demo mode - slug starts with "demo-" or has demo query param
  const url = new URL(request.url);
  const isDemoMode = slug.startsWith('demo-') || url.searchParams.get('demo') === 'true';

  if (isDemoMode && DEMO_CLIENTS[slug]) {
    return new Response(JSON.stringify({
      success: true,
      data: DEMO_CLIENTS[slug]
    }), {
      status: 200,
      headers: corsHeaders
    });
  }

  try {
    const db = env.DB;

    // Try new schema first: org_contacts + organizations + client_accounts
    let result = await db.prepare(`
      SELECT
        o.id as organization_id,
        o.legal_name,
        o.dba_name as company,
        o.lifecycle_stage,
        c.id as contact_id,
        c.first_name,
        c.last_name,
        c.email,
        c.phone,
        c.slug,
        c.portal_enabled,
        c.timezone,
        ca.id as account_id,
        ca.support_plan_tier,
        ca.support_plan_status,
        ca.support_plan_started,
        ca.support_plan_renews,
        ca.health_score,
        ca.health_trend,
        ca.client_since,
        ca.mrr
      FROM org_contacts c
      JOIN organizations o ON c.organization_id = o.id
      LEFT JOIN client_accounts ca ON ca.organization_id = o.id
      WHERE c.slug = ?
    `).bind(slug).first();

    // If not found in new schema, try legacy clients table
    if (!result) {
      const legacyClient = await db.prepare(`
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
          timezone,
          health_score,
          health_trend
        FROM clients
        WHERE slug = ?
      `).bind(slug).first();

      if (legacyClient) {
        // Return legacy format
        if (!legacyClient.portal_enabled) {
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
            id: legacyClient.id,
            name: legacyClient.name,
            company: legacyClient.company,
            email: legacyClient.email,
            slug: legacyClient.slug,
            avatar_url: legacyClient.avatar_url,
            portal_enabled: Boolean(legacyClient.portal_enabled),
            support_plan_tier: legacyClient.support_plan_tier,
            support_plan_status: legacyClient.support_plan_status,
            support_plan_started: legacyClient.support_plan_started,
            support_plan_renews: legacyClient.support_plan_renews,
            timezone: legacyClient.timezone || 'America/New_York',
            health_score: legacyClient.health_score,
            health_trend: legacyClient.health_trend
          }
        }), {
          status: 200,
          headers: corsHeaders
        });
      }
    }

    if (!result) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Client not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Check if portal is enabled
    if (!result.portal_enabled) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Portal is not enabled for this client'
      }), {
        status: 403,
        headers: corsHeaders
      });
    }

    // Build display name
    const displayName = result.first_name && result.last_name
      ? `${result.first_name} ${result.last_name}`
      : result.first_name || result.last_name || result.legal_name;

    return new Response(JSON.stringify({
      success: true,
      data: {
        // Legacy fields for backward compatibility
        id: result.organization_id,
        name: displayName,
        company: result.company || result.legal_name,
        email: result.email,
        slug: result.slug,
        avatar_url: null,
        portal_enabled: Boolean(result.portal_enabled),
        support_plan_tier: result.support_plan_tier,
        support_plan_status: result.support_plan_status,
        support_plan_started: result.support_plan_started,
        support_plan_renews: result.support_plan_renews,
        timezone: result.timezone || 'America/New_York',
        // New fields from unified schema
        organization_id: result.organization_id,
        contact_id: result.contact_id,
        account_id: result.account_id,
        lifecycle_stage: result.lifecycle_stage,
        health_score: result.health_score,
        health_trend: result.health_trend,
        client_since: result.client_since,
        mrr: result.mrr
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
