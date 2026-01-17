/**
 * Menu Deploy API - Deploy Menu to Toast ABO
 *
 * POST /api/menu/deploy
 *
 * Deploys a saved menu to Toast POS via the automation system.
 * Creates an automation job with job_type='menu_deployment' and passes
 * the menu items as job input.
 *
 * Body:
 * - menuId: (required) ID of the saved menu to deploy
 * - clientId: (required) Client ID (must have Toast credentials configured)
 * - scheduledAt: (optional) ISO timestamp for scheduled execution
 * - priority: (optional) Job priority 1-10 (default 5)
 *
 * Returns:
 * - success: boolean
 * - jobId: string (automation job ID)
 * - deploymentId: string (deployment history record ID)
 * - message: string
 */

import { verifyAuth, verifyClientAuth, unauthorizedResponse, handleOptions, getCorsHeaders } from '../../_shared/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    // Verify authentication - require either admin or client session
    const adminAuth = await verifyAuth(request, env);
    let authenticatedUser = null;

    if (adminAuth.authenticated) {
      authenticatedUser = { type: 'admin', payload: adminAuth.payload };
    } else {
      // Try client authentication
      const clientAuth = await verifyClientAuth(request, env);
      if (clientAuth.authenticated) {
        authenticatedUser = { type: 'client', clientId: clientAuth.clientId, payload: clientAuth.payload };
      }
    }

    if (!authenticatedUser) {
      return unauthorizedResponse('Authentication required to deploy menus', request);
    }

    // Check database is configured
    if (!env.DB) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Database not configured'
      }), {
        status: 503,
        headers: corsHeaders
      });
    }

    // Parse request body
    const body = await request.json();
    const { menuId, clientId, scheduledAt, priority } = body;

    // Validate required fields
    if (!menuId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'menuId is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (!clientId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'clientId is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // If client auth, enforce clientId to their own ID
    if (authenticatedUser.type === 'client' && clientId !== authenticatedUser.clientId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'You can only deploy to your own account'
      }), {
        status: 403,
        headers: corsHeaders
      });
    }

    // Verify client exists
    const client = await env.DB.prepare(
      'SELECT id, name, company FROM clients WHERE id = ?'
    ).bind(clientId).first();

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
    const credentials = await env.DB.prepare(`
      SELECT id FROM automation_credentials
      WHERE client_id = ? AND platform = 'toast' AND is_active = 1
    `).bind(clientId).first();

    if (!credentials) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Client does not have active Toast credentials configured. Please configure Toast API credentials first.'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Load the menu
    const menu = await env.DB.prepare(`
      SELECT
        id,
        client_id,
        name,
        menu_data_json,
        categories_json,
        modifier_groups_json,
        item_count,
        status
      FROM parsed_menus
      WHERE id = ?
    `).bind(menuId).first();

    if (!menu) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Menu not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Check permissions - clients can only deploy their own menus
    if (authenticatedUser.type === 'client' && menu.client_id && menu.client_id !== authenticatedUser.clientId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'You do not have permission to deploy this menu'
      }), {
        status: 403,
        headers: corsHeaders
      });
    }

    // Parse menu data
    const items = menu.menu_data_json ? JSON.parse(menu.menu_data_json) : [];
    const categories = menu.categories_json ? JSON.parse(menu.categories_json) : [];
    const modifierGroups = menu.modifier_groups_json ? JSON.parse(menu.modifier_groups_json) : [];

    if (items.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Menu has no items to deploy'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const jobId = crypto.randomUUID();
    const deploymentId = crypto.randomUUID();

    // Parse scheduled time if provided
    let scheduledAtUnix = null;
    if (scheduledAt) {
      const scheduledDate = new Date(scheduledAt);
      if (isNaN(scheduledDate.getTime())) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid scheduledAt format. Use ISO 8601 format.'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
      scheduledAtUnix = Math.floor(scheduledDate.getTime() / 1000);
    }

    // Validate priority
    const jobPriority = Math.min(Math.max(parseInt(priority || '5', 10), 1), 10);

    // Prepare job input with menu data
    const jobInput = {
      menuId: menu.id,
      menuName: menu.name,
      deploymentId: deploymentId,
      items: items,
      categories: categories,
      modifierGroups: modifierGroups,
      itemCount: items.length,
      deployedBy: authenticatedUser.type === 'admin' ? 'admin' : authenticatedUser.clientId
    };

    // Create the automation job
    await env.DB.prepare(`
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
      ) VALUES (?, ?, 'menu_deployment', ?, ?, ?, 0, ?, ?, ?)
    `).bind(
      jobId,
      clientId,
      scheduledAtUnix ? 'scheduled' : 'pending',
      jobPriority,
      JSON.stringify(jobInput),
      scheduledAtUnix,
      now,
      now
    ).run();

    // Create deployment history record
    await env.DB.prepare(`
      INSERT INTO menu_deployment_history (
        id,
        menu_id,
        client_id,
        job_id,
        status,
        deployed_by,
        created_at
      ) VALUES (?, ?, ?, ?, 'pending', ?, ?)
    `).bind(
      deploymentId,
      menuId,
      clientId,
      jobId,
      authenticatedUser.type === 'admin' ? 'admin' : authenticatedUser.clientId,
      now
    ).run();

    // Update menu to associate with client if not already
    if (!menu.client_id && clientId) {
      await env.DB.prepare(`
        UPDATE parsed_menus
        SET client_id = ?, updated_at = ?
        WHERE id = ?
      `).bind(clientId, now, menuId).run();
    }

    return new Response(JSON.stringify({
      success: true,
      jobId: jobId,
      deploymentId: deploymentId,
      message: scheduledAtUnix
        ? `Menu deployment scheduled for ${new Date(scheduledAtUnix * 1000).toISOString()}`
        : 'Menu deployment job created and queued for processing',
      details: {
        menuName: menu.name,
        itemCount: items.length,
        clientName: client.name,
        clientCompany: client.company,
        status: scheduledAtUnix ? 'scheduled' : 'pending'
      }
    }), {
      status: 201,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('[Menu Deploy] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to create deployment job'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * GET /api/menu/deploy
 *
 * Get deployment status/history for a menu.
 *
 * Query Parameters:
 * - menuId: (optional) Filter by menu ID
 * - clientId: (optional) Filter by client ID
 * - limit: (optional) Maximum results (default 20)
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    // Verify authentication
    const adminAuth = await verifyAuth(request, env);
    let authenticatedUser = null;

    if (adminAuth.authenticated) {
      authenticatedUser = { type: 'admin', payload: adminAuth.payload };
    } else {
      const clientAuth = await verifyClientAuth(request, env);
      if (clientAuth.authenticated) {
        authenticatedUser = { type: 'client', clientId: clientAuth.clientId, payload: clientAuth.payload };
      }
    }

    if (!authenticatedUser) {
      return unauthorizedResponse('Authentication required', request);
    }

    if (!env.DB) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Database not configured'
      }), {
        status: 503,
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);
    let menuId = url.searchParams.get('menuId');
    let clientId = url.searchParams.get('clientId');
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20', 10), 1), 100);

    // If client auth, enforce filtering to their own deployments
    if (authenticatedUser.type === 'client') {
      clientId = authenticatedUser.clientId;
    }

    // Build query
    let whereConditions = [];
    let params = [];

    if (menuId) {
      whereConditions.push('d.menu_id = ?');
      params.push(menuId);
    }

    if (clientId) {
      whereConditions.push('d.client_id = ?');
      params.push(clientId);
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    const { results: deployments } = await env.DB.prepare(`
      SELECT
        d.*,
        m.name as menu_name,
        m.item_count as menu_item_count,
        c.name as client_name,
        c.company as client_company,
        j.status as job_status,
        j.progress as job_progress,
        j.error as job_error
      FROM menu_deployment_history d
      LEFT JOIN parsed_menus m ON d.menu_id = m.id
      LEFT JOIN clients c ON d.client_id = c.id
      LEFT JOIN automation_jobs j ON d.job_id = j.id
      ${whereClause}
      ORDER BY d.created_at DESC
      LIMIT ?
    `).bind(...params, limit).all();

    const formattedDeployments = (deployments || []).map(d => ({
      id: d.id,
      menuId: d.menu_id,
      menuName: d.menu_name,
      menuItemCount: d.menu_item_count,
      clientId: d.client_id,
      clientName: d.client_name,
      clientCompany: d.client_company,
      jobId: d.job_id,
      status: d.status,
      jobStatus: d.job_status,
      jobProgress: d.job_progress,
      itemsDeployed: d.items_deployed,
      itemsFailed: d.items_failed,
      error: d.error || d.job_error,
      deployedBy: d.deployed_by,
      startedAt: d.started_at ? new Date(d.started_at * 1000).toISOString() : null,
      completedAt: d.completed_at ? new Date(d.completed_at * 1000).toISOString() : null,
      createdAt: d.created_at ? new Date(d.created_at * 1000).toISOString() : null
    }));

    return new Response(JSON.stringify({
      success: true,
      deployments: formattedDeployments
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('[Menu Deploy GET] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to get deployment history'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions(context) {
  return handleOptions(context.request);
}
