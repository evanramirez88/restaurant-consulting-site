/**
 * Automation Status API
 *
 * GET /api/automation/status - Get automation server status
 *
 * Returns current status of the automation server including:
 * - Online status
 * - Active sessions
 * - Queue depth
 * - Last heartbeat
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const kv = context.env.KV;

    // Get automation server status from KV (will be updated by heartbeat)
    let serverStatus = null;
    if (kv) {
      const statusJson = await kv.get('automation:server:status');
      if (statusJson) {
        serverStatus = JSON.parse(statusJson);
      }
    }

    // Get active job counts from database
    let activeJobs = 0;
    let queuedJobs = 0;
    let totalJobsToday = 0;

    if (db) {
      // Count active jobs (in_progress status)
      const activeResult = await db.prepare(`
        SELECT COUNT(*) as count FROM automation_jobs WHERE status = 'in_progress'
      `).first();
      activeJobs = activeResult?.count || 0;

      // Count queued jobs (pending status)
      const queuedResult = await db.prepare(`
        SELECT COUNT(*) as count FROM automation_jobs WHERE status = 'pending'
      `).first();
      queuedJobs = queuedResult?.count || 0;

      // Count jobs created today
      const todayStart = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
      const todayResult = await db.prepare(`
        SELECT COUNT(*) as count FROM automation_jobs WHERE created_at >= ?
      `).bind(todayStart).first();
      totalJobsToday = todayResult?.count || 0;
    }

    // Determine if server is online
    // Server is considered online if last heartbeat was within 60 seconds
    const now = Math.floor(Date.now() / 1000);
    const lastHeartbeat = serverStatus?.lastHeartbeat || null;
    const isOnline = lastHeartbeat && (now - lastHeartbeat) < 60;

    const status = {
      isOnline: isOnline,
      currentSessions: serverStatus?.activeSessions || activeJobs,
      maxSessions: serverStatus?.maxSessions || 5,
      queueDepth: queuedJobs,
      lastHeartbeat: lastHeartbeat ? new Date(lastHeartbeat * 1000).toISOString() : null,
      serverVersion: serverStatus?.version || null,
      stats: {
        activeJobs,
        queuedJobs,
        totalJobsToday
      }
    };

    return new Response(JSON.stringify({
      success: true,
      status
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Automation status error:', error);
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
