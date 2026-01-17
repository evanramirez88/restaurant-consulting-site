/**
 * Menu List API - List Saved Menus
 *
 * GET /api/menu/list
 *
 * Lists saved menus with optional filtering.
 *
 * Query Parameters:
 * - client_id: (optional) Filter by client ID
 * - status: (optional) Filter by status (draft, deployed, archived)
 * - limit: (optional) Maximum number of menus to return (default 50)
 * - offset: (optional) Offset for pagination (default 0)
 *
 * Returns:
 * - success: boolean
 * - menus: array of menu objects (without full item data for performance)
 * - total: total count of matching menus
 * - pagination: { limit, offset, hasMore }
 */

import { verifyAuth, verifyClientAuth, unauthorizedResponse, handleOptions, getCorsHeaders } from '../../_shared/auth.js';

export async function onRequestGet(context) {
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
      return unauthorizedResponse('Authentication required to list menus', request);
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

    // Parse query parameters
    const url = new URL(request.url);
    let clientId = url.searchParams.get('client_id');
    const status = url.searchParams.get('status');
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10), 1), 100);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);

    // If client auth, enforce filtering to their own menus
    if (authenticatedUser.type === 'client') {
      clientId = authenticatedUser.clientId;
    }

    // Build query
    let whereConditions = [];
    let params = [];

    if (clientId) {
      whereConditions.push('m.client_id = ?');
      params.push(clientId);
    }

    if (status) {
      if (!['draft', 'deployed', 'archived'].includes(status)) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid status. Must be one of: draft, deployed, archived'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
      whereConditions.push('m.status = ?');
      params.push(status);
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM parsed_menus m
      ${whereClause}
    `;
    const countResult = await env.DB.prepare(countQuery).bind(...params).first();
    const total = countResult?.total || 0;

    // Get menus (without full item data for performance)
    const listQuery = `
      SELECT
        m.id,
        m.client_id,
        m.name,
        m.source_file_key,
        m.categories_json,
        m.modifier_groups_json,
        m.item_count,
        m.status,
        m.deployed_at,
        m.created_at,
        m.updated_at,
        c.name as client_name,
        c.company as client_company
      FROM parsed_menus m
      LEFT JOIN clients c ON m.client_id = c.id
      ${whereClause}
      ORDER BY m.updated_at DESC
      LIMIT ? OFFSET ?
    `;

    const { results: menus } = await env.DB.prepare(listQuery)
      .bind(...params, limit, offset)
      .all();

    // Format the results
    const formattedMenus = (menus || []).map(menu => ({
      id: menu.id,
      clientId: menu.client_id,
      clientName: menu.client_name,
      clientCompany: menu.client_company,
      name: menu.name,
      sourceFileKey: menu.source_file_key,
      categories: menu.categories_json ? JSON.parse(menu.categories_json) : [],
      modifierGroups: menu.modifier_groups_json ? JSON.parse(menu.modifier_groups_json) : [],
      itemCount: menu.item_count,
      status: menu.status,
      deployedAt: menu.deployed_at ? new Date(menu.deployed_at * 1000).toISOString() : null,
      createdAt: menu.created_at ? new Date(menu.created_at * 1000).toISOString() : null,
      updatedAt: menu.updated_at ? new Date(menu.updated_at * 1000).toISOString() : null
    }));

    return new Response(JSON.stringify({
      success: true,
      menus: formattedMenus,
      total: total,
      pagination: {
        limit: limit,
        offset: offset,
        hasMore: offset + limit < total
      }
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('[Menu List] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to list menus'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions(context) {
  return handleOptions(context.request);
}
