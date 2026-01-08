/**
 * Automation Jobs API (Admin)
 *
 * GET /api/admin/automation/jobs - List automation jobs
 * POST /api/admin/automation/jobs - Create a new automation job
 */

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  try {
    const status = url.searchParams.get('status');
    const clientId = url.searchParams.get('client_id');
    const jobType = url.searchParams.get('job_type');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = `
      SELECT
        j.*,
        c.name as client_name,
        c.company_name as client_company
      FROM automation_jobs j
      LEFT JOIN clients c ON j.client_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ` AND j.status = ?`;
      params.push(status);
    }

    if (clientId) {
      query += ` AND j.client_id = ?`;
      params.push(clientId);
    }

    if (jobType) {
      query += ` AND j.job_type = ?`;
      params.push(jobType);
    }

    query += ` ORDER BY j.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const stmt = env.DB.prepare(query);
    const result = params.length > 0
      ? await stmt.bind(...params).all()
      : await stmt.all();

    const jobs = (result.results || []).map(job => ({
      ...job,
      input: job.input ? JSON.parse(job.input) : null,
      output: job.output ? JSON.parse(job.output) : null
    }));

    // Get total count
    const countResult = await env.DB.prepare(`
      SELECT COUNT(*) as total FROM automation_jobs
    `).first();

    return new Response(JSON.stringify({
      success: true,
      data: jobs,
      pagination: {
        total: countResult?.total || 0,
        limit,
        offset
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { client_id, job_type, job_config, priority, scheduled_at } = body;

    // Validate required fields
    if (!client_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'client_id is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!job_type) {
      return new Response(JSON.stringify({
        success: false,
        error: 'job_type is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate job_type
    const validJobTypes = [
      'menu_deployment',
      'menu_import',
      'pos_sync',
      'report_generation',
      'backup',
      'inventory_sync',
      'employee_sync',
      'classification',
      'config_apply'
    ];

    if (!validJobTypes.includes(job_type)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Invalid job_type. Must be one of: ${validJobTypes.join(', ')}`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify client exists
    const clientCheck = await env.DB.prepare('SELECT id, name FROM clients WHERE id = ?').bind(client_id).first();
    if (!clientCheck) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Client not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate job ID
    const jobId = `job_${crypto.randomUUID().split('-')[0]}`;

    // Parse scheduled_at or default to now
    const scheduledUnix = scheduled_at
      ? Math.floor(new Date(scheduled_at).getTime() / 1000)
      : Math.floor(Date.now() / 1000);

    // Insert the job
    await env.DB.prepare(`
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

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: jobId,
        client_id,
        client_name: clientCheck.name,
        job_type,
        status: 'pending',
        priority: priority || 0,
        input: job_config || null,
        scheduled_at: new Date(scheduledUnix * 1000).toISOString()
      }
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Create job error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
