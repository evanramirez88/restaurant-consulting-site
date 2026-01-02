/**
 * Automation Trigger API - Create New Jobs
 *
 * POST /api/automation/trigger - Create a new automation job
 *
 * Body:
 * - clientId: (required) Client ID
 * - jobType: (required) Type of job (menu_import, pos_sync, report_generation, etc.)
 * - input: (optional) Job-specific input data
 * - scheduledAt: (optional) ISO timestamp for scheduled execution
 * - priority: (optional) Job priority 1-10 (default 5)
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../_shared/auth.js';

// Valid job types
const VALID_JOB_TYPES = [
  'menu_import',           // Import menu from PDF/image to Toast
  'menu_export',           // Export menu from Toast
  'pos_sync',              // Sync POS data
  'report_generation',     // Generate reports
  'price_update',          // Update menu prices
  'item_availability',     // Update item availability
  'employee_sync',         // Sync employee data
  'sales_report',          // Pull sales reports
  'inventory_check',       // Check inventory levels
  'modifier_update',       // Update modifiers
  'category_reorganize',   // Reorganize menu categories
  'toast_backup',          // Backup Toast configuration
  'toast_restore',         // Restore Toast configuration
  'custom'                 // Custom automation task
];

export async function onRequestPost(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const body = await context.request.json();

    // Validate required fields
    if (!body.clientId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'clientId is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (!body.jobType) {
      return new Response(JSON.stringify({
        success: false,
        error: 'jobType is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Validate job type
    if (!VALID_JOB_TYPES.includes(body.jobType)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Invalid jobType. Must be one of: ${VALID_JOB_TYPES.join(', ')}`
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Verify client exists
    const client = await db.prepare('SELECT id, name, company FROM clients WHERE id = ?')
      .bind(body.clientId).first();

    if (!client) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Client not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Check if client has Toast credentials
    const credentials = await db.prepare(`
      SELECT id FROM automation_credentials
      WHERE client_id = ? AND platform = 'toast' AND is_active = 1
    `).bind(body.clientId).first();

    if (!credentials && body.jobType !== 'custom') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Client does not have active Toast credentials configured'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const jobId = crypto.randomUUID();

    // Parse scheduled time if provided
    let scheduledAt = null;
    if (body.scheduledAt) {
      const scheduledDate = new Date(body.scheduledAt);
      if (isNaN(scheduledDate.getTime())) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid scheduledAt format. Use ISO 8601 format.'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
      scheduledAt = Math.floor(scheduledDate.getTime() / 1000);
    }

    // Validate priority
    const priority = Math.min(Math.max(parseInt(body.priority || '5', 10), 1), 10);

    // Create the job
    await db.prepare(`
      INSERT INTO automation_jobs (
        id,
        client_id,
        job_type,
        status,
        priority,
        input,
        progress,
        scheduled_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      jobId,
      body.clientId,
      body.jobType,
      scheduledAt ? 'scheduled' : 'pending',
      priority,
      body.input ? JSON.stringify(body.input) : null,
      0,
      scheduledAt,
      now,
      now
    ).run();

    // Get the created job
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
        ...createdJob,
        input: createdJob.input ? JSON.parse(createdJob.input) : null,
        output: null,
        created_at: new Date(createdJob.created_at * 1000).toISOString(),
        updated_at: new Date(createdJob.updated_at * 1000).toISOString(),
        scheduled_at: createdJob.scheduled_at ? new Date(createdJob.scheduled_at * 1000).toISOString() : null,
        started_at: null,
        completed_at: null
      },
      message: scheduledAt
        ? `Job scheduled for ${new Date(scheduledAt * 1000).toISOString()}`
        : 'Job created and queued for processing'
    }), {
      status: 201,
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Automation trigger error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

// Also support GET to retrieve valid job types
export async function onRequestGet(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        jobTypes: VALID_JOB_TYPES,
        descriptions: {
          menu_import: 'Import menu from PDF/image to Toast POS',
          menu_export: 'Export menu data from Toast POS',
          pos_sync: 'Synchronize POS data between systems',
          report_generation: 'Generate custom reports',
          price_update: 'Bulk update menu item prices',
          item_availability: 'Update menu item availability status',
          employee_sync: 'Synchronize employee data',
          sales_report: 'Pull sales and revenue reports',
          inventory_check: 'Check and report inventory levels',
          modifier_update: 'Update menu item modifiers',
          category_reorganize: 'Reorganize menu categories and structure',
          toast_backup: 'Create backup of Toast configuration',
          toast_restore: 'Restore Toast configuration from backup',
          custom: 'Custom automation task'
        }
      }
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Job types GET error:', error);
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
