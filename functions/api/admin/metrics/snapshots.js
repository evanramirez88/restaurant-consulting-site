/**
 * Business Metrics Snapshots API
 * GET /api/admin/metrics/snapshots - Get metrics history
 * POST /api/admin/metrics/snapshots - Capture current snapshot
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../_shared/auth.js';

export async function onRequestGet(context) {
  const { env, request } = context;

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '30');

    const result = await env.DB.prepare(`
      SELECT * FROM business_metrics_snapshots
      WHERE snapshot_date >= date('now', '-' || ? || ' days')
      ORDER BY snapshot_date DESC
    `).bind(days).all();

    return new Response(JSON.stringify({
      success: true,
      data: result.results || []
    }), { headers: corsHeaders });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: corsHeaders
    });
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    const today = new Date().toISOString().split('T')[0];

    // Gather current metrics from various tables
    const [clients, tickets, revenue, subscriptions, emails, leads] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) as count FROM clients WHERE status = \'active\'').first(),
      env.DB.prepare('SELECT COUNT(*) as count FROM tickets WHERE status IN (\'open\', \'in_progress\')').first(),
      env.DB.prepare(`
        SELECT SUM(amount) as total FROM project_revenue
        WHERE created_at > unixepoch() - 2592000
      `).first(),
      env.DB.prepare('SELECT COUNT(*) as count FROM stripe_subscriptions WHERE status = \'active\'').first(),
      env.DB.prepare(`
        SELECT COUNT(*) as sent, SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened
        FROM email_logs WHERE sent_at > unixepoch() - 2592000
      `).first(),
      env.DB.prepare(`
        SELECT
          SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END) as contacted,
          SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as converted
        FROM restaurant_leads WHERE updated_at > unixepoch() - 2592000
      `).first()
    ]);

    // Deal pipeline value
    const pipeline = await env.DB.prepare(`
      SELECT SUM(value) as total FROM client_deals WHERE stage NOT IN ('closed_won', 'closed_lost')
    `).first();

    // CSAT average
    const csat = await env.DB.prepare(`
      SELECT AVG(rating) as avg FROM ticket_satisfaction WHERE created_at > unixepoch() - 2592000
    `).first();

    const id = `snap_${today}_${Math.random().toString(36).slice(2, 6)}`;

    await env.DB.prepare(`
      INSERT OR REPLACE INTO business_metrics_snapshots
      (id, snapshot_date, active_clients, open_tickets, monthly_revenue, active_subscriptions,
       total_pipeline_value, avg_csat, emails_sent, emails_opened, leads_contacted, leads_converted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, today,
      clients?.count || 0,
      tickets?.count || 0,
      revenue?.total || 0,
      subscriptions?.count || 0,
      pipeline?.total || 0,
      csat?.avg || null,
      emails?.sent || 0,
      emails?.opened || 0,
      leads?.contacted || 0,
      leads?.converted || 0
    ).run();

    return new Response(JSON.stringify({
      success: true,
      data: { id, snapshot_date: today }
    }), { status: 201, headers: corsHeaders });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
