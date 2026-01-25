/**
 * Client Deals Pipeline API
 * GET /api/admin/clients/:clientId/deals - List deals
 * POST /api/admin/clients/:clientId/deals - Create deal
 * PUT /api/admin/clients/:clientId/deals - Update deal (pass id in body)
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../_shared/auth.js';

export async function onRequestGet(context) {
  const { env, request, params } = context;
  const { clientId } = params;

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    const url = new URL(request.url);
    const stage = url.searchParams.get('stage');

    let query = `
      SELECT d.*, r.name as rep_name
      FROM client_deals d
      LEFT JOIN reps r ON d.rep_id = r.id
      WHERE d.client_id = ?
    `;
    const queryParams = [clientId];

    if (stage) {
      query += ' AND d.stage = ?';
      queryParams.push(stage);
    }

    query += ' ORDER BY d.updated_at DESC';

    const result = await env.DB.prepare(query).bind(...queryParams).all();

    // Pipeline summary
    const summary = await env.DB.prepare(`
      SELECT
        stage,
        COUNT(*) as count,
        SUM(value) as total_value,
        AVG(probability) as avg_probability
      FROM client_deals WHERE client_id = ?
      GROUP BY stage
    `).bind(clientId).all();

    return new Response(JSON.stringify({
      success: true,
      data: result.results || [],
      pipeline: summary.results || []
    }), { headers: corsHeaders });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: corsHeaders
    });
  }
}

export async function onRequestPost(context) {
  const { env, request, params } = context;
  const { clientId } = params;

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    const body = await request.json();
    const { title, description, deal_type, stage = 'discovery', value = 0, recurring_value = 0, probability = 50, expected_close_date, rep_id, next_step } = body;

    if (!title || !deal_type) {
      return new Response(JSON.stringify({ success: false, error: 'title and deal_type are required' }), {
        status: 400, headers: corsHeaders
      });
    }

    const id = `deal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const closeDateTs = expected_close_date ? Math.floor(new Date(expected_close_date).getTime() / 1000) : null;

    await env.DB.prepare(`
      INSERT INTO client_deals (id, client_id, rep_id, title, description, deal_type, stage, value, recurring_value, probability, expected_close_date, next_step)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, clientId, rep_id || null, title, description || null, deal_type, stage, value, recurring_value, probability, closeDateTs, next_step || null).run();

    // Log activity
    await env.DB.prepare(`
      INSERT INTO client_activity_log (id, client_id, activity_type, title, metadata_json, performed_by_type, performed_by_name)
      VALUES (?, ?, 'note_added', ?, ?, 'admin', ?)
    `).bind(`act_${Date.now()}`, clientId, `New deal: ${title} ($${value})`, JSON.stringify({ deal_id: id, deal_type, value }), auth.username || 'Admin').run();

    return new Response(JSON.stringify({
      success: true,
      data: { id, title, deal_type, stage, value }
    }), { status: 201, headers: corsHeaders });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: corsHeaders
    });
  }
}

export async function onRequestPut(context) {
  const { env, request, params } = context;
  const { clientId } = params;

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    const body = await request.json();
    const { id, stage, value, probability, next_step, next_step_date, won_reason, lost_reason } = body;

    if (!id) {
      return new Response(JSON.stringify({ success: false, error: 'Deal id is required' }), {
        status: 400, headers: corsHeaders
      });
    }

    const updates = [];
    const updateParams = [];

    if (stage) { updates.push('stage = ?'); updateParams.push(stage); }
    if (value !== undefined) { updates.push('value = ?'); updateParams.push(value); }
    if (probability !== undefined) { updates.push('probability = ?'); updateParams.push(probability); }
    if (next_step !== undefined) { updates.push('next_step = ?'); updateParams.push(next_step); }
    if (won_reason) { updates.push('won_reason = ?'); updateParams.push(won_reason); }
    if (lost_reason) { updates.push('lost_reason = ?'); updateParams.push(lost_reason); }

    if (stage === 'closed_won' || stage === 'closed_lost') {
      updates.push('actual_close_date = unixepoch()');
    }

    updates.push('updated_at = unixepoch()');
    updateParams.push(id, clientId);

    await env.DB.prepare(`
      UPDATE client_deals SET ${updates.join(', ')} WHERE id = ? AND client_id = ?
    `).bind(...updateParams).run();

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
