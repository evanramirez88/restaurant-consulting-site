/**
 * Convert Organization to Client API
 *
 * POST /api/organizations/:id/convert-to-client
 * Converts a prospect/opportunity to a paying client
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

export async function onRequestPost(context) {
  const { params, env, request } = context;
  const { id } = params;

  try {
    const body = await request.json();
    const db = env.DB;

    // Get current organization
    const org = await db.prepare(`
      SELECT o.*, c.email, c.id as contact_id, c.slug as contact_slug
      FROM organizations o
      LEFT JOIN org_contacts c ON c.organization_id = o.id AND c.is_primary = 1
      WHERE o.id = ?
    `).bind(id).first();

    if (!org) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Organization not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    if (org.lifecycle_stage === 'client') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Organization is already a client'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Check if client_account already exists
    let accountId = id + '_account';
    const existingAccount = await db.prepare(`
      SELECT id FROM client_accounts WHERE organization_id = ?
    `).bind(id).first();

    if (existingAccount) {
      accountId = existingAccount.id;
    }

    // Update organization lifecycle stage
    await db.prepare(`
      UPDATE organizations
      SET lifecycle_stage = 'client', lifecycle_changed_at = unixepoch()
      WHERE id = ?
    `).bind(id).run();

    // Create or update client_account
    if (!existingAccount) {
      await db.prepare(`
        INSERT INTO client_accounts (
          id, organization_id, client_since, status,
          support_plan_tier, support_plan_status,
          stripe_customer_id, square_subscription_id,
          health_score, service_lane,
          created_at, updated_at
        ) VALUES (?, ?, unixepoch(), 'active', ?, 'active', ?, ?, 75, 'B', unixepoch(), unixepoch())
      `).bind(
        accountId,
        id,
        body.support_plan_tier || 'core',
        body.stripe_customer_id || null,
        body.square_subscription_id || null
      ).run();
    } else {
      await db.prepare(`
        UPDATE client_accounts
        SET
          status = 'active',
          support_plan_tier = COALESCE(?, support_plan_tier, 'core'),
          support_plan_status = 'active',
          support_plan_started = COALESCE(support_plan_started, unixepoch()),
          stripe_customer_id = COALESCE(?, stripe_customer_id),
          updated_at = unixepoch()
        WHERE id = ?
      `).bind(
        body.support_plan_tier || null,
        body.stripe_customer_id || null,
        accountId
      ).run();
    }

    // Enable portal access for primary contact if requested
    if (body.enable_portal && org.contact_id) {
      const portalSlug = org.contact_slug || org.email?.split('@')[0]?.toLowerCase()?.replace(/[^a-z0-9]/g, '-');

      await db.prepare(`
        UPDATE org_contacts
        SET portal_enabled = 1, slug = COALESCE(slug, ?)
        WHERE id = ?
      `).bind(portalSlug, org.contact_id).run();
    }

    // Log lifecycle transition
    await db.prepare(`
      INSERT INTO lifecycle_transitions (
        id, organization_id, from_stage, to_stage,
        reason, triggered_by_type, triggered_by_name, trigger_event,
        created_at
      ) VALUES (?, ?, ?, 'client', ?, 'api', ?, 'conversion', unixepoch())
    `).bind(
      'lt_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12),
      id,
      org.lifecycle_stage,
      body.conversion_reason || 'Converted to paying client',
      body.converted_by || 'System'
    ).run();

    // Log activity
    await db.prepare(`
      INSERT INTO unified_activity_log (
        id, organization_id, client_account_id, activity_type, title, description,
        performed_by_type, performed_by_name, created_at
      ) VALUES (?, ?, ?, 'subscription_started', 'Converted to client', ?, 'api', ?, unixepoch())
    `).bind(
      'act_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12),
      id,
      accountId,
      `Support plan: ${body.support_plan_tier || 'core'}`,
      body.converted_by || 'System'
    ).run();

    // Fetch updated organization with client account
    const result = await db.prepare(`
      SELECT
        o.id, o.legal_name, o.dba_name, o.slug, o.lifecycle_stage,
        ca.id as account_id, ca.status as account_status,
        ca.support_plan_tier, ca.support_plan_status, ca.client_since,
        c.portal_enabled, c.slug as portal_slug
      FROM organizations o
      LEFT JOIN client_accounts ca ON ca.organization_id = o.id
      LEFT JOIN org_contacts c ON c.organization_id = o.id AND c.is_primary = 1
      WHERE o.id = ?
    `).bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      message: 'Organization successfully converted to client',
      data: result
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Convert to client error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to convert organization to client'
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}
