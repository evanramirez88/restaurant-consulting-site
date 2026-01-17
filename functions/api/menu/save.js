/**
 * Menu Save API - Save/Update Parsed Menus
 *
 * POST /api/menu/save
 *
 * Saves a parsed menu to the database for persistence and later deployment.
 *
 * Body:
 * - menuId: (optional) Existing menu ID to update
 * - clientId: (optional) Client ID to associate with the menu
 * - name: (required) Menu name
 * - items: (required) Array of menu items
 * - categories: (optional) Array of category names
 * - modifierGroups: (optional) Array of modifier group names
 * - sourceFileKey: (optional) R2 file key of source document
 *
 * Returns:
 * - success: boolean
 * - menuId: string (new or existing ID)
 * - message: string
 */

import { verifyAuth, verifyClientAuth, unauthorizedResponse, handleOptions, getCorsHeaders } from '../../_shared/auth.js';

/**
 * Validate menu items array
 */
function validateMenuItems(items) {
  if (!Array.isArray(items)) {
    return { valid: false, error: 'items must be an array' };
  }

  if (items.length === 0) {
    return { valid: false, error: 'items array cannot be empty' };
  }

  // Validate each item has required fields
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.name || typeof item.name !== 'string') {
      return { valid: false, error: `Item at index ${i} is missing a valid name` };
    }
  }

  return { valid: true };
}

/**
 * Ensure all items have IDs
 */
function ensureItemIds(items) {
  return items.map((item, idx) => ({
    ...item,
    id: item.id || `item_${idx + 1}_${Date.now()}`
  }));
}

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
      return unauthorizedResponse('Authentication required to save menus', request);
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
    const { menuId, clientId, name, items, categories, modifierGroups, sourceFileKey } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Menu name is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (!items) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Menu items are required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Validate items
    const validation = validateMenuItems(items);
    if (!validation.valid) {
      return new Response(JSON.stringify({
        success: false,
        error: validation.error
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Ensure all items have IDs
    const itemsWithIds = ensureItemIds(items);

    // Prepare JSON data
    const menuDataJson = JSON.stringify(itemsWithIds);
    const categoriesJson = categories ? JSON.stringify(categories) : null;
    const modifierGroupsJson = modifierGroups ? JSON.stringify(modifierGroups) : null;
    const itemCount = itemsWithIds.length;

    const now = Math.floor(Date.now() / 1000);

    // If client auth, enforce clientId to their own ID
    let effectiveClientId = clientId;
    if (authenticatedUser.type === 'client') {
      effectiveClientId = authenticatedUser.clientId;
    }

    // Check if updating existing menu or creating new
    if (menuId) {
      // Update existing menu
      const existingMenu = await env.DB.prepare(
        'SELECT id, client_id FROM parsed_menus WHERE id = ?'
      ).bind(menuId).first();

      if (!existingMenu) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Menu not found'
        }), {
          status: 404,
          headers: corsHeaders
        });
      }

      // Check permissions - clients can only update their own menus
      if (authenticatedUser.type === 'client' && existingMenu.client_id !== authenticatedUser.clientId) {
        return new Response(JSON.stringify({
          success: false,
          error: 'You do not have permission to update this menu'
        }), {
          status: 403,
          headers: corsHeaders
        });
      }

      // Update the menu
      await env.DB.prepare(`
        UPDATE parsed_menus
        SET
          name = ?,
          client_id = ?,
          menu_data_json = ?,
          categories_json = ?,
          modifier_groups_json = ?,
          item_count = ?,
          source_file_key = COALESCE(?, source_file_key),
          updated_at = ?
        WHERE id = ?
      `).bind(
        name.trim(),
        effectiveClientId || existingMenu.client_id,
        menuDataJson,
        categoriesJson,
        modifierGroupsJson,
        itemCount,
        sourceFileKey,
        now,
        menuId
      ).run();

      return new Response(JSON.stringify({
        success: true,
        menuId: menuId,
        message: 'Menu updated successfully',
        itemCount: itemCount
      }), {
        status: 200,
        headers: corsHeaders
      });

    } else {
      // Create new menu
      const newMenuId = crypto.randomUUID();

      await env.DB.prepare(`
        INSERT INTO parsed_menus (
          id,
          client_id,
          name,
          source_file_key,
          menu_data_json,
          categories_json,
          modifier_groups_json,
          item_count,
          status,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)
      `).bind(
        newMenuId,
        effectiveClientId || null,
        name.trim(),
        sourceFileKey || null,
        menuDataJson,
        categoriesJson,
        modifierGroupsJson,
        itemCount,
        now,
        now
      ).run();

      return new Response(JSON.stringify({
        success: true,
        menuId: newMenuId,
        message: 'Menu saved successfully',
        itemCount: itemCount
      }), {
        status: 201,
        headers: corsHeaders
      });
    }

  } catch (error) {
    console.error('[Menu Save] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to save menu'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions(context) {
  return handleOptions(context.request);
}
