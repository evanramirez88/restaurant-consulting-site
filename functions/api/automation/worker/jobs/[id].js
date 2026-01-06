/**
 * Worker Job Update Endpoint
 *
 * PATCH /api/automation/worker/jobs/:id - Update job status and progress
 * GET /api/automation/worker/jobs/:id - Get job details
 *
 * Worker-only endpoint authenticated via API key
 */

import { verifyWorkerAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    // Verify worker authentication
    const auth = await verifyWorkerAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const jobId = context.params.id;

    const job = await db.prepare(`
      SELECT
        j.id,
        j.client_id,
        j.job_type,
        j.status,
        j.priority,
        j.input,
        j.output,
        j.error,
        j.progress,
        j.scheduled_at,
        j.started_at,
        j.completed_at,
        j.created_at,
        j.updated_at,
        c.name as client_name,
        c.company as client_company
      FROM automation_jobs j
      LEFT JOIN clients c ON j.client_id = c.id
      WHERE j.id = ?
    `).bind(jobId).first();

    if (!job) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Job not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Parse JSON fields
    const jobData = {
      ...job,
      input: job.input ? JSON.parse(job.input) : null,
      output: job.output ? JSON.parse(job.output) : null,
      created_at: job.created_at ? new Date(job.created_at * 1000).toISOString() : null,
      updated_at: job.updated_at ? new Date(job.updated_at * 1000).toISOString() : null,
      scheduled_at: job.scheduled_at ? new Date(job.scheduled_at * 1000).toISOString() : null,
      started_at: job.started_at ? new Date(job.started_at * 1000).toISOString() : null,
      completed_at: job.completed_at ? new Date(job.completed_at * 1000).toISOString() : null
    };

    return new Response(JSON.stringify({
      success: true,
      data: jobData
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Worker job GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestPatch(context) {
  try {
    // Verify worker authentication
    const auth = await verifyWorkerAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const jobId = context.params.id;
    const body = await context.request.json();
    const now = Math.floor(Date.now() / 1000);

    // Check job exists
    const existing = await db.prepare('SELECT id, status FROM automation_jobs WHERE id = ?')
      .bind(jobId).first();

    if (!existing) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Job not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Build update query dynamically
    const updates = ['updated_at = ?'];
    const params = [now];

    if (body.status !== undefined) {
      const validStatuses = ['pending', 'in_progress', 'completed', 'failed', 'cancelled'];
      if (!validStatuses.includes(body.status)) {
        return new Response(JSON.stringify({
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
      updates.push('status = ?');
      params.push(body.status);

      // Set completed_at for terminal statuses
      if (['completed', 'failed', 'cancelled'].includes(body.status)) {
        updates.push('completed_at = ?');
        params.push(now);
      }
    }

    if (body.progress !== undefined) {
      const progress = Math.max(0, Math.min(100, parseInt(body.progress, 10)));
      updates.push('progress = ?');
      params.push(progress);
    }

    if (body.output !== undefined) {
      updates.push('output = ?');
      params.push(JSON.stringify(body.output));
    }

    if (body.error !== undefined) {
      updates.push('error = ?');
      params.push(body.error);
    }

    // Add job ID to params
    params.push(jobId);

    const query = `UPDATE automation_jobs SET ${updates.join(', ')} WHERE id = ?`;
    await db.prepare(query).bind(...params).run();

    // Return updated job
    const job = await db.prepare(`
      SELECT
        j.id,
        j.client_id,
        j.job_type,
        j.status,
        j.priority,
        j.progress,
        j.error,
        j.started_at,
        j.completed_at,
        j.updated_at
      FROM automation_jobs j
      WHERE j.id = ?
    `).bind(jobId).first();

    return new Response(JSON.stringify({
      success: true,
      data: {
        ...job,
        started_at: job.started_at ? new Date(job.started_at * 1000).toISOString() : null,
        completed_at: job.completed_at ? new Date(job.completed_at * 1000).toISOString() : null,
        updated_at: job.updated_at ? new Date(job.updated_at * 1000).toISOString() : null
      }
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Worker job PATCH error:', error);
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
