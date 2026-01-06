/**
 * Worker Health Check Endpoint
 *
 * GET /api/automation/worker/health - Check worker API authentication
 *
 * Simple endpoint to verify worker API key is valid
 */

import { verifyWorkerAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    // Verify worker authentication
    const auth = await verifyWorkerAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const now = Math.floor(Date.now() / 1000);

    // Get job counts
    let pendingCount = 0;
    let runningCount = 0;

    try {
      const pending = await db.prepare(
        "SELECT COUNT(*) as count FROM automation_jobs WHERE status = 'pending'"
      ).first();
      pendingCount = pending?.count || 0;

      const running = await db.prepare(
        "SELECT COUNT(*) as count FROM automation_jobs WHERE status = 'in_progress'"
      ).first();
      runningCount = running?.count || 0;
    } catch (dbError) {
      // D1 might not be configured yet
      console.log('D1 query failed:', dbError.message);
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        status: 'healthy',
        authenticated: true,
        worker_id: auth.workerId,
        timestamp: new Date(now * 1000).toISOString(),
        jobs: {
          pending: pendingCount,
          running: runningCount
        }
      }
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Worker health check error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
