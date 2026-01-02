/**
 * Automation Job API - Single Job Operations
 *
 * GET /api/automation/jobs/[id] - Get job details with steps
 * PUT /api/automation/jobs/[id] - Update job status (pause, cancel, resume)
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const { id } = context.params;

    // Get job with client info
    const job = await db.prepare(`
      SELECT
        j.*,
        c.name as client_name,
        c.company as client_company,
        c.email as client_email
      FROM automation_jobs j
      LEFT JOIN clients c ON j.client_id = c.id
      WHERE j.id = ?
    `).bind(id).first();

    if (!job) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Job not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Get job steps
    const { results: steps } = await db.prepare(`
      SELECT
        id,
        step_number,
        step_type,
        status,
        input,
        output,
        error,
        started_at,
        completed_at,
        created_at
      FROM automation_job_steps
      WHERE job_id = ?
      ORDER BY step_number ASC
    `).bind(id).all();

    // Parse JSON fields and format dates
    const formattedJob = {
      ...job,
      input: job.input ? JSON.parse(job.input) : null,
      output: job.output ? JSON.parse(job.output) : null,
      created_at: job.created_at ? new Date(job.created_at * 1000).toISOString() : null,
      updated_at: job.updated_at ? new Date(job.updated_at * 1000).toISOString() : null,
      scheduled_at: job.scheduled_at ? new Date(job.scheduled_at * 1000).toISOString() : null,
      started_at: job.started_at ? new Date(job.started_at * 1000).toISOString() : null,
      completed_at: job.completed_at ? new Date(job.completed_at * 1000).toISOString() : null
    };

    const formattedSteps = (steps || []).map(step => ({
      ...step,
      input: step.input ? JSON.parse(step.input) : null,
      output: step.output ? JSON.parse(step.output) : null,
      started_at: step.started_at ? new Date(step.started_at * 1000).toISOString() : null,
      completed_at: step.completed_at ? new Date(step.completed_at * 1000).toISOString() : null,
      created_at: step.created_at ? new Date(step.created_at * 1000).toISOString() : null
    }));

    return new Response(JSON.stringify({
      success: true,
      data: {
        ...formattedJob,
        steps: formattedSteps
      }
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Job GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestPut(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const { id } = context.params;
    const body = await context.request.json();
    const now = Math.floor(Date.now() / 1000);

    // Verify job exists
    const existingJob = await db.prepare('SELECT * FROM automation_jobs WHERE id = ?').bind(id).first();
    if (!existingJob) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Job not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Handle action-based updates
    const action = body.action;
    let newStatus = body.status;
    let updateFields = {};

    if (action) {
      switch (action) {
        case 'pause':
          if (existingJob.status !== 'in_progress') {
            return new Response(JSON.stringify({
              success: false,
              error: 'Can only pause jobs that are in progress'
            }), {
              status: 400,
              headers: corsHeaders
            });
          }
          newStatus = 'paused';
          break;

        case 'resume':
          if (existingJob.status !== 'paused') {
            return new Response(JSON.stringify({
              success: false,
              error: 'Can only resume jobs that are paused'
            }), {
              status: 400,
              headers: corsHeaders
            });
          }
          newStatus = 'pending';
          break;

        case 'cancel':
          if (['completed', 'failed', 'cancelled'].includes(existingJob.status)) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Cannot cancel a job that has already finished'
            }), {
              status: 400,
              headers: corsHeaders
            });
          }
          newStatus = 'cancelled';
          updateFields.completed_at = now;
          break;

        case 'retry':
          if (!['failed', 'cancelled'].includes(existingJob.status)) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Can only retry failed or cancelled jobs'
            }), {
              status: 400,
              headers: corsHeaders
            });
          }
          newStatus = 'pending';
          updateFields.error = null;
          updateFields.progress = 0;
          updateFields.started_at = null;
          updateFields.completed_at = null;
          break;

        default:
          return new Response(JSON.stringify({
            success: false,
            error: `Unknown action: ${action}`
          }), {
            status: 400,
            headers: corsHeaders
          });
      }
    }

    // Build update query
    let setClauses = ['status = ?', 'updated_at = ?'];
    let params = [newStatus || existingJob.status, now];

    if (updateFields.completed_at !== undefined) {
      setClauses.push('completed_at = ?');
      params.push(updateFields.completed_at);
    }
    if (updateFields.error !== undefined) {
      setClauses.push('error = ?');
      params.push(updateFields.error);
    }
    if (updateFields.progress !== undefined) {
      setClauses.push('progress = ?');
      params.push(updateFields.progress);
    }
    if (updateFields.started_at !== undefined) {
      setClauses.push('started_at = ?');
      params.push(updateFields.started_at);
    }
    if (body.priority !== undefined) {
      setClauses.push('priority = ?');
      params.push(body.priority);
    }

    params.push(id);

    await db.prepare(`
      UPDATE automation_jobs
      SET ${setClauses.join(', ')}
      WHERE id = ?
    `).bind(...params).run();

    // Return updated job
    const updatedJob = await db.prepare('SELECT * FROM automation_jobs WHERE id = ?').bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: {
        ...updatedJob,
        input: updatedJob.input ? JSON.parse(updatedJob.input) : null,
        output: updatedJob.output ? JSON.parse(updatedJob.output) : null,
        created_at: updatedJob.created_at ? new Date(updatedJob.created_at * 1000).toISOString() : null,
        updated_at: updatedJob.updated_at ? new Date(updatedJob.updated_at * 1000).toISOString() : null,
        scheduled_at: updatedJob.scheduled_at ? new Date(updatedJob.scheduled_at * 1000).toISOString() : null,
        started_at: updatedJob.started_at ? new Date(updatedJob.started_at * 1000).toISOString() : null,
        completed_at: updatedJob.completed_at ? new Date(updatedJob.completed_at * 1000).toISOString() : null
      }
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Job PUT error:', error);
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
