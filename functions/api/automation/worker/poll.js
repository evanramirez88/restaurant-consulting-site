/**
 * Worker Poll Endpoint
 *
 * GET /api/automation/worker/poll - Poll for queued jobs
 *
 * Worker-only endpoint authenticated via API key
 * Returns one queued job at a time, ordered by priority and creation time
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

    // Get the next queued job (queued status, not scheduled for future)
    const job = await db.prepare(`
      SELECT
        j.id,
        j.client_id,
        j.job_type,
        j.status,
        j.priority,
        j.input_json,
        j.scheduled_at,
        j.created_at,
        c.name as client_name,
        c.company as client_company
      FROM automation_jobs j
      LEFT JOIN clients c ON j.client_id = c.id
      WHERE j.status = 'queued'
        AND (j.scheduled_at IS NULL OR j.scheduled_at <= ?)
      ORDER BY j.priority DESC, j.created_at ASC
      LIMIT 1
    `).bind(now).first();

    if (!job) {
      return new Response(JSON.stringify({
        success: true,
        data: null,
        message: 'No jobs available'
      }), {
        headers: corsHeaders
      });
    }

    // Mark the job as running
    await db.prepare(`
      UPDATE automation_jobs
      SET status = 'running', started_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(now, now, job.id).run();

    // Parse JSON input
    const jobData = {
      ...job,
      input: job.input_json ? JSON.parse(job.input_json) : null,
      status: 'running',
      started_at: new Date(now * 1000).toISOString(),
      created_at: job.created_at ? new Date(job.created_at * 1000).toISOString() : null,
      scheduled_at: job.scheduled_at ? new Date(job.scheduled_at * 1000).toISOString() : null
    };
    // Remove the raw JSON field
    delete jobData.input_json;

    return new Response(JSON.stringify({
      success: true,
      data: jobData
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Worker poll error:', error);
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
