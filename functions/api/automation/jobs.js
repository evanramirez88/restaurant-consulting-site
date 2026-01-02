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

export async function onRequestOptions() {
  return handleOptions();
}
