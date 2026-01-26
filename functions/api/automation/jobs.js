/**
 * Automation Jobs API - List Jobs
 *
 * GET /api/automation/jobs - List automation jobs with filtering
 *
 * Query Parameters:
 * - status: Filter by job status (pending, in_progress, completed, failed, cancelled)
 * - client_id: Filter by client ID
 * - job_type: Filter by job type (menu_import, pos_sync, report_generation, etc.)
 * - limit: Number of results (default 50, max 100)
 * - offset: Pagination offset (default 0)
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
    const url = new URL(context.request.url);

    // Parse query parameters
    const status = url.searchParams.get('status');
    const clientId = url.searchParams.get('client_id');
    const jobType = url.searchParams.get('job_type');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    // Build dynamic query with filters
    let whereConditions = [];
    let params = [];

    if (status) {
      whereConditions.push('j.status = ?');
      params.push(status);
    }

    if (clientId) {
      whereConditions.push('j.client_id = ?');
      params.push(clientId);
    }

    if (jobType) {
      whereConditions.push('j.job_type = ?');
      params.push(jobType);
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM automation_jobs j
      ${whereClause}
    `;
    const countResult = await db.prepare(countQuery).bind(...params).first();
    const total = countResult?.total || 0;

    // Get jobs with client name
    const query = `
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
      ${whereClause}
      ORDER BY
        CASE j.status
          WHEN 'in_progress' THEN 1
          WHEN 'pending' THEN 2
          ELSE 3
        END,
        j.priority DESC,
        j.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const { results } = await db.prepare(query).bind(...params, limit, offset).all();

    // Parse JSON fields
    const jobs = (results || []).map(job => ({
      ...job,
      input: job.input ? JSON.parse(job.input) : null,
      output: job.output ? JSON.parse(job.output) : null,
      created_at: job.created_at ? new Date(job.created_at * 1000).toISOString() : null,
      updated_at: job.updated_at ? new Date(job.updated_at * 1000).toISOString() : null,
      scheduled_at: job.scheduled_at ? new Date(job.scheduled_at * 1000).toISOString() : null,
      started_at: job.started_at ? new Date(job.started_at * 1000).toISOString() : null,
      completed_at: job.completed_at ? new Date(job.completed_at * 1000).toISOString() : null
    }));

    return new Response(JSON.stringify({
      success: true,
      data: jobs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + jobs.length < total
      }
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Automation jobs list error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * POST /api/automation/jobs - Create a new automation job
 *
 * Request Body:
 * - client_id: Required - Client ID for the job
 * - job_type: Required - Type of job (menu_deployment, menu_import, pos_sync, etc.)
 * - job_config: Optional - Configuration object for the job
 * - priority: Optional - Job priority (default 0)
 * - scheduled_at: Optional - When to run the job (ISO string, defaults to now)
 */
export async function onRequestPost(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const body = await context.request.json();

    const { client_id, job_type, job_config, priority, scheduled_at } = body;

    // Validate required fields
    if (!client_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'client_id is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (!job_type) {
      return new Response(JSON.stringify({
        success: false,
        error: 'job_type is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Validate job_type (aligned with JobExecutor handlers)
    const validJobTypes = [
      'menu_deployment',   // Menu Builder → Toast deployment
      'menu_upload',       // Direct menu upload
      'menu_update',       // Update existing menu items
      'kds_config',        // KDS station configuration
      'printer_setup',     // Printer routing setup
      'employee_setup',    // Employee profile creation
      'health_check',      // Configuration verification
      'full_setup'         // Complete restaurant setup
    ];

    if (!validJobTypes.includes(job_type)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Invalid job_type. Must be one of: ${validJobTypes.join(', ')}`
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Verify client exists
    const clientCheck = await db.prepare('SELECT id FROM clients WHERE id = ?').bind(client_id).first();
    if (!clientCheck) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Client not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Generate job ID
    const jobId = `job_${crypto.randomUUID().split('-')[0]}`;

    // Parse scheduled_at or default to now
    const scheduledUnix = scheduled_at
      ? Math.floor(new Date(scheduled_at).getTime() / 1000)
      : Math.floor(Date.now() / 1000);

    // Insert the job
    await db.prepare(`
      INSERT INTO automation_jobs (
        id, client_id, job_type, status, priority, input,
        scheduled_at, created_at, updated_at
      ) VALUES (?, ?, ?, 'pending', ?, ?, ?, unixepoch(), unixepoch())
    `).bind(
      jobId,
      client_id,
      job_type,
      priority || 0,
      job_config ? JSON.stringify(job_config) : null,
      scheduledUnix
    ).run();

    // Fetch the created job
    const createdJob = await db.prepare(`
      SELECT
        j.*,
        c.name as client_name,
        c.company as client_company
      FROM automation_jobs j
      LEFT JOIN clients c ON j.client_id = c.id
      WHERE j.id = ?
    `).bind(jobId).first();

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: createdJob.id,
        client_id: createdJob.client_id,
        client_name: createdJob.client_name,
        job_type: createdJob.job_type,
        status: createdJob.status,
        priority: createdJob.priority,
        input: createdJob.input ? JSON.parse(createdJob.input) : null,
        scheduled_at: createdJob.scheduled_at ? new Date(createdJob.scheduled_at * 1000).toISOString() : null,
        created_at: createdJob.created_at ? new Date(createdJob.created_at * 1000).toISOString() : null
      }
    }), {
      status: 201,
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Create automation job error:', error);
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
