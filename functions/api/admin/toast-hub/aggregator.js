// Toast Hub Aggregator Status API
// View aggregator stats and logs, trigger manual runs
import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../_shared/auth.js';

/**
 * GET /api/admin/toast-hub/aggregator
 * Get aggregator status and recent run logs
 */
export async function onRequestGet(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const url = new URL(context.request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);

    // Get recent aggregator logs
    const { results: logs } = await db.prepare(`
      SELECT * FROM toast_hub_aggregator_logs
      ORDER BY run_started_at DESC
      LIMIT ?
    `).bind(limit).all();

    // Get source stats
    const sourceStats = await db.prepare(`
      SELECT
        COUNT(*) as total_sources,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_sources,
        SUM(CASE WHEN consecutive_failures >= 5 THEN 1 ELSE 0 END) as failed_sources
      FROM toast_hub_sources
    `).first();

    // Get import stats
    const importStats = await db.prepare(`
      SELECT
        COUNT(*) as total_imports,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN visible_public = 1 THEN 1 ELSE 0 END) as visible_public,
        SUM(CASE WHEN visible_client_portal = 1 THEN 1 ELSE 0 END) as visible_client,
        SUM(CASE WHEN visible_rep_portal = 1 THEN 1 ELSE 0 END) as visible_rep
      FROM toast_hub_imports
    `).first();

    // Get today's stats
    const todayStart = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
    const todayStats = await db.prepare(`
      SELECT
        COUNT(*) as imports_today,
        SUM(items_imported) as items_imported_today
      FROM toast_hub_aggregator_logs
      WHERE run_started_at >= ?
    `).bind(todayStart).first();

    return new Response(JSON.stringify({
      success: true,
      data: {
        logs: logs || [],
        sources: sourceStats || {},
        imports: importStats || {},
        today: todayStats || {},
        worker_url: 'https://toast-hub-aggregator.ramirezconsulting-rg.workers.dev'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /api/admin/toast-hub/aggregator
 * Trigger manual aggregator run
 */
export async function onRequestPost(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    // Call the aggregator worker directly
    try {
      const workerResponse = await fetch('https://toast-hub-aggregator.ramirezconsulting-rg.workers.dev/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(60000) // 60 second timeout for aggregation
      });

      const result = await workerResponse.json();

      return new Response(JSON.stringify({
        success: true,
        triggered: true,
        worker_response: result
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (fetchError) {
      // Worker might not be deployed yet
      return new Response(JSON.stringify({
        success: false,
        error: `Could not reach aggregator worker: ${fetchError.message}`,
        hint: 'Ensure toast-hub-aggregator worker is deployed'
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
