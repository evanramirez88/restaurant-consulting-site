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
        j.input_json,
        j.output_json,
        j.error_message,
        j.progress_percentage,
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

    // Parse JSON fields and map to simplified names
    const jobData = {
      id: job.id,
      client_id: job.client_id,
      job_type: job.job_type,
      status: job.status,
      priority: job.priority,
      input: job.input_json ? JSON.parse(job.input_json) : null,
      output: job.output_json ? JSON.parse(job.output_json) : null,
      error: job.error_message,
      progress: job.progress_percentage,
      client_name: job.client_name,
      client_company: job.client_company,
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
      // Map common status names to DB values
      const statusMap = {
        'pending': 'queued',
        'in_progress': 'running',
        'running': 'running',
        'queued': 'queued',
        'completed': 'completed',
        'failed': 'failed',
        'cancelled': 'cancelled'
      };

      const mappedStatus = statusMap[body.status];
      if (!mappedStatus) {
        const validStatuses = Object.keys(statusMap);
        return new Response(JSON.stringify({
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
      updates.push('status = ?');
      params.push(mappedStatus);

      // Set completed_at for terminal statuses
      if (['completed', 'failed', 'cancelled'].includes(mappedStatus)) {
        updates.push('completed_at = ?');
        params.push(now);
      }
    }

    if (body.progress !== undefined) {
      const progress = Math.max(0, Math.min(100, parseInt(body.progress, 10)));
      updates.push('progress_percentage = ?');
      params.push(progress);
    }

    if (body.output !== undefined) {
      updates.push('output_json = ?');
      params.push(JSON.stringify(body.output));
    }

    if (body.error !== undefined) {
      updates.push('error_message = ?');
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
        j.progress_percentage,
        j.error_message,
        j.started_at,
        j.completed_at,
        j.updated_at
      FROM automation_jobs j
      WHERE j.id = ?
    `).bind(jobId).first();

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: job.id,
        client_id: job.client_id,
        job_type: job.job_type,
        status: job.status,
        priority: job.priority,
        progress: job.progress_percentage,
        error: job.error_message,
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
