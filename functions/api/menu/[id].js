/**
 * Menu Load API - Load Specific Menu by ID
 *
 * GET /api/menu/[id]
 *
 * Loads a specific saved menu including all item data.
 *
 * Path Parameters:
 * - id: Menu ID
 *
 * Returns:
 * - success: boolean
 * - menu: full menu object including items
 *
 * DELETE /api/menu/[id]
 *
 * Deletes a saved menu (or archives it).
 *
 * Query Parameters:
 * - permanent: (optional) If 'true', permanently deletes; otherwise archives
 *
 * Returns:
 * - success: boolean
 * - message: string
 */

import { verifyAuth, verifyClientAuth, unauthorizedResponse, handleOptions, getCorsHeaders } from '../../_shared/auth.js';

export async function onRequestGet(context) {
  const { request, env, params } = context;
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
      return unauthorizedResponse('Authentication required to load menus', request);
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

    const menuId = params.id;

    if (!menuId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Menu ID is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Get the menu with client info
    const menu = await env.DB.prepare(`
      SELECT
        m.*,
        c.name as client_name,
        c.company as client_company,
        c.email as client_email
      FROM parsed_menus m
      LEFT JOIN clients c ON m.client_id = c.id
      WHERE m.id = ?
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

    // Check permissions - clients can only view their own menus
    if (authenticatedUser.type === 'client' && menu.client_id !== authenticatedUser.clientId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'You do not have permission to view this menu'
      }), {
        status: 403,
        headers: corsHeaders
      });
    }

    // Get deployment history for this menu
    const { results: deployments } = await env.DB.prepare(`
      SELECT
        id,
        job_id,
        status,
        items_deployed,
        items_failed,
        error,
        deployed_by,
        started_at,
        completed_at,
        created_at
      FROM menu_deployment_history
      WHERE menu_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).bind(menuId).all();

    // Format the response
    const formattedMenu = {
      id: menu.id,
      clientId: menu.client_id,
      client: menu.client_id ? {
        id: menu.client_id,
        name: menu.client_name,
        company: menu.client_company,
        email: menu.client_email
      } : null,
      name: menu.name,
      sourceFileKey: menu.source_file_key,
      items: menu.menu_data_json ? JSON.parse(menu.menu_data_json) : [],
      categories: menu.categories_json ? JSON.parse(menu.categories_json) : [],
      modifierGroups: menu.modifier_groups_json ? JSON.parse(menu.modifier_groups_json) : [],
      itemCount: menu.item_count,
      status: menu.status,
      deployedAt: menu.deployed_at ? new Date(menu.deployed_at * 1000).toISOString() : null,
      createdAt: menu.created_at ? new Date(menu.created_at * 1000).toISOString() : null,
      updatedAt: menu.updated_at ? new Date(menu.updated_at * 1000).toISOString() : null,
      deploymentHistory: (deployments || []).map(d => ({
        id: d.id,
        jobId: d.job_id,
        status: d.status,
        itemsDeployed: d.items_deployed,
        itemsFailed: d.items_failed,
        error: d.error,
        deployedBy: d.deployed_by,
        startedAt: d.started_at ? new Date(d.started_at * 1000).toISOString() : null,
        completedAt: d.completed_at ? new Date(d.completed_at * 1000).toISOString() : null,
        createdAt: d.created_at ? new Date(d.created_at * 1000).toISOString() : null
      }))
    };

    return new Response(JSON.stringify({
      success: true,
      menu: formattedMenu
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('[Menu Load] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to load menu'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;
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
      return unauthorizedResponse('Authentication required to delete menus', request);
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

    const menuId = params.id;
    const url = new URL(request.url);
    const permanent = url.searchParams.get('permanent') === 'true';

    if (!menuId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Menu ID is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Get the menu
    const menu = await env.DB.prepare(
      'SELECT id, client_id, name, status FROM parsed_menus WHERE id = ?'
    ).bind(menuId).first();

    if (!menu) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Menu not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Check permissions - clients can only delete their own menus
    if (authenticatedUser.type === 'client' && menu.client_id !== authenticatedUser.clientId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'You do not have permission to delete this menu'
      }), {
        status: 403,
        headers: corsHeaders
      });
    }

    // Clients cannot permanently delete, only archive
    if (permanent && authenticatedUser.type === 'client') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Clients can only archive menus, not permanently delete them'
      }), {
        status: 403,
        headers: corsHeaders
      });
    }

    const now = Math.floor(Date.now() / 1000);

    if (permanent) {
      // Permanently delete the menu
      await env.DB.prepare('DELETE FROM parsed_menus WHERE id = ?').bind(menuId).run();

      return new Response(JSON.stringify({
        success: true,
        message: `Menu "${menu.name}" has been permanently deleted`
      }), {
        status: 200,
        headers: corsHeaders
      });
    } else {
      // Archive the menu
      await env.DB.prepare(`
        UPDATE parsed_menus
        SET status = 'archived', updated_at = ?
        WHERE id = ?
      `).bind(now, menuId).run();

      return new Response(JSON.stringify({
        success: true,
        message: `Menu "${menu.name}" has been archived`
      }), {
        status: 200,
        headers: corsHeaders
      });
    }

  } catch (error) {
    console.error('[Menu Delete] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to delete menu'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions(context) {
  return handleOptions(context.request);
}
