/**
 * Organization Stage Change API
 *
 * POST /api/organizations/:id/stage-change
 * Changes the lifecycle stage of an organization with proper tracking
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

const VALID_STAGES = ['lead', 'prospect', 'mql', 'sql', 'opportunity', 'client', 'churned', 'blacklist'];

// Define allowed transitions
const STAGE_TRANSITIONS = {
  'lead': ['prospect', 'blacklist'],
  'prospect': ['mql', 'sql', 'blacklist', 'lead'],
  'mql': ['sql', 'opportunity', 'blacklist', 'lead'],
  'sql': ['opportunity', 'blacklist', 'mql'],
  'opportunity': ['client', 'blacklist', 'sql'],
  'client': ['churned', 'blacklist'],
  'churned': ['lead', 'prospect', 'blacklist'],
  'blacklist': ['lead']
};

export async function onRequestPost(context) {
  const { params, env, request } = context;
  const { id } = params;

  try {
    const body = await request.json();
    const db = env.DB;

    const { new_stage, reason, notes, triggered_by } = body;

    if (!new_stage || !VALID_STAGES.includes(new_stage)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Invalid stage. Must be one of: ${VALID_STAGES.join(', ')}`
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Get current organization
    const org = await db.prepare(`
      SELECT id, lifecycle_stage, legal_name FROM organizations WHERE id = ?
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

    const currentStage = org.lifecycle_stage;

    // Validate transition (skip if force is set)
    if (!body.force && STAGE_TRANSITIONS[currentStage] && !STAGE_TRANSITIONS[currentStage].includes(new_stage)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Invalid transition from ${currentStage} to ${new_stage}. Allowed: ${STAGE_TRANSITIONS[currentStage].join(', ')}`
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // If same stage, no change needed
    if (currentStage === new_stage) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Organization is already at this stage',
        data: { id, lifecycle_stage: currentStage }
      }), {
        status: 200,
        headers: corsHeaders
      });
    }

    // Update the stage (trigger will log the transition)
    await db.prepare(`
      UPDATE organizations
      SET lifecycle_stage = ?, lifecycle_changed_by = ?
      WHERE id = ?
    `).bind(new_stage, triggered_by?.name || 'API', id).run();

    // Update the transition record with reason and notes
    if (reason || notes) {
      await db.prepare(`
        UPDATE lifecycle_transitions
        SET reason = ?, notes = ?, triggered_by_type = ?, triggered_by_name = ?
        WHERE organization_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(
        reason || null,
        notes || null,
        triggered_by?.type || 'api',
        triggered_by?.name || null,
        id
      ).run();
    }

    // Log activity
    await db.prepare(`
      INSERT INTO unified_activity_log (
        id, organization_id, activity_type, title, description,
        performed_by_type, performed_by_id, performed_by_name, created_at
      ) VALUES (?, ?, 'stage_changed', ?, ?, ?, ?, ?, unixepoch())
    `).bind(
      'act_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12),
      id,
      `Stage changed: ${currentStage} → ${new_stage}`,
      reason || null,
      triggered_by?.type || 'api',
      triggered_by?.id || null,
      triggered_by?.name || null
    ).run();

    // If converting to client, ensure client_account exists
    if (new_stage === 'client') {
      const existingAccount = await db.prepare(`
        SELECT id FROM client_accounts WHERE organization_id = ?
      `).bind(id).first();

      if (!existingAccount) {
        await db.prepare(`
          INSERT INTO client_accounts (
            id, organization_id, client_since, status, created_at, updated_at
          ) VALUES (?, ?, unixepoch(), 'active', unixepoch(), unixepoch())
        `).bind(id + '_account', id).run();
      }
    }

    // Fetch updated organization
    const updated = await db.prepare(`
      SELECT id, legal_name, lifecycle_stage, lifecycle_changed_at
      FROM organizations WHERE id = ?
    `).bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      message: `Stage changed from ${currentStage} to ${new_stage}`,
      data: updated
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Stage change error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to change stage'
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
