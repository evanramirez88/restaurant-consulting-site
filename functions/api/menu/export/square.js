/**
 * Square Catalog Export API
 *
 * POST /api/menu/export/square
 *
 * Converts parsed menu data to Square Catalog API format.
 * Can export from either a saved menu ID or directly from menu items.
 *
 * Request Body:
 * - menuId: (optional) ID of saved menu in parsed_menus table
 * - items: (optional) Array of menu items if not using menuId
 * - categories: (optional) Array of categories if not using menuId
 *
 * Returns:
 * - success: boolean
 * - data: Square catalog batch upsert format
 * - download: base64 encoded JSON for download
 */

import { verifyAuth, verifyClientAuth, unauthorizedResponse, handleOptions, getCorsHeaders } from '../../../_shared/auth.js';

// Generate a Square-compatible idempotency key
function generateIdempotencyKey() {
  return `mb_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

// Generate a temporary ID for Square objects (client can replace these)
function generateTempId(prefix, index) {
  return `#${prefix}_${index}`;
}

// Parse price string to cents
function parsePriceToCents(priceStr) {
  if (!priceStr) return 0;
  // Remove currency symbols and whitespace
  const cleaned = priceStr.replace(/[^0-9.]/g, '');
  const amount = parseFloat(cleaned);
  if (isNaN(amount)) return 0;
  return Math.round(amount * 100);
}

// Convert menu items to Square catalog format
function convertToSquareCatalog(items, categories) {
  const catalogObjects = [];
  const categoryMap = new Map();

  // Create category objects first
  categories.forEach((cat, index) => {
    const catId = generateTempId('category', index);
    categoryMap.set(cat, catId);
    catalogObjects.push({
      type: 'CATEGORY',
      id: catId,
      category_data: {
        name: cat
      }
    });
  });

  // Create item objects
  items.forEach((item, index) => {
    const itemId = generateTempId('item', index);
    const variationId = generateTempId('var', index);
    const priceCents = parsePriceToCents(item.price);
    const categoryId = categoryMap.get(item.category);

    const itemObject = {
      type: 'ITEM',
      id: itemId,
      item_data: {
        name: item.name,
        description: item.description || '',
        variations: [
          {
            type: 'ITEM_VARIATION',
            id: variationId,
            item_variation_data: {
              item_id: itemId,
              name: 'Regular',
              pricing_type: 'FIXED_PRICING',
              price_money: {
                amount: priceCents,
                currency: 'USD'
              }
            }
          }
        ]
      }
    };

    // Add category reference if available
    if (categoryId) {
      itemObject.item_data.category_id = categoryId;
    }

    catalogObjects.push(itemObject);

    // Handle modifiers (create modifier lists if needed)
    if (item.modifiers && item.modifiers.length > 0) {
      item.modifiers.forEach((modifier, modIndex) => {
        const modListId = generateTempId(`modlist_${index}`, modIndex);
        catalogObjects.push({
          type: 'MODIFIER_LIST',
          id: modListId,
          modifier_list_data: {
            name: modifier,
            selection_type: 'SINGLE',
            modifiers: []
          }
        });
      });
    }
  });

  return catalogObjects;
}

export async function onRequestPost(context) {
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
      return unauthorizedResponse('Authentication required for Square export', request);
    }

    // Parse request body
    const body = await request.json();
    const { menuId, items, categories } = body;

    let menuItems = items || [];
    let menuCategories = categories || [];

    // If menuId provided, fetch from database
    if (menuId && env.DB) {
      const menu = await env.DB.prepare(`
        SELECT menu_data_json, categories_json
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

      menuItems = menu.menu_data_json ? JSON.parse(menu.menu_data_json) : [];
      menuCategories = menu.categories_json ? JSON.parse(menu.categories_json) : [];
    }

    if (!menuItems || menuItems.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No menu items provided'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Convert to Square catalog format
    const catalogObjects = convertToSquareCatalog(menuItems, menuCategories);

    // Create the batch upsert request format
    const squareExport = {
      idempotency_key: generateIdempotencyKey(),
      batches: [
        {
          objects: catalogObjects
        }
      ]
    };

    // Create base64 download
    const jsonString = JSON.stringify(squareExport, null, 2);
    const base64Download = btoa(unescape(encodeURIComponent(jsonString)));

    return new Response(JSON.stringify({
      success: true,
      data: squareExport,
      download: base64Download,
      stats: {
        totalItems: menuItems.length,
        totalCategories: menuCategories.length,
        catalogObjects: catalogObjects.length
      }
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('[Square Export] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to export to Square format'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions(context) {
  return handleOptions(context.request);
}
