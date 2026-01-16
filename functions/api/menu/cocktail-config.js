/**
 * Cocktail Configuration API
 *
 * Implements the Martini/Manhattan inventory logic:
 * - Spirit State concept: cocktails are "states" of base spirits
 * - Volume-based pricing preserves inventory data integrity
 *
 * GET /api/menu/cocktail-config - Get all configurations
 * GET /api/menu/cocktail-config?category=vodka - Get by category
 * GET /api/menu/cocktail-config?bar_program=craft_cocktail - Get by bar program type
 * POST /api/menu/cocktail-config/generate - Generate menu items and modifiers
 * POST /api/menu/cocktail-config/calculate - Calculate pricing for custom config
 */

import { getCorsOrigin } from '../../_shared/auth.js';

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

// ============================================
// MARTINI/MANHATTAN PRICING FORMULA
// Final Price = (Base Spirit Price * Volume Multiplier) + Style Upcharge
// ============================================

/**
 * Calculate cocktail price using the Martini/Manhattan formula
 *
 * @param {number} basePrice - Spirit's base price for standard 2oz pour
 * @param {number} volumeMultiplier - Style's volume multiplier (e.g., Martini = 2.0)
 * @param {number} styleUpcharge - Additional upcharge for style complexity
 * @returns {number} - Calculated cocktail price
 */
function calculateCocktailPrice(basePrice, volumeMultiplier, styleUpcharge = 0) {
  return Math.round((basePrice * volumeMultiplier + styleUpcharge) * 100) / 100;
}

/**
 * Calculate pour cost and margin
 */
function calculateCostMetrics(costPerOz, typicalOz, finalPrice) {
  const pourCost = Math.round(costPerOz * typicalOz * 100) / 100;
  const marginPct = finalPrice > 0
    ? Math.round(((finalPrice - pourCost) / finalPrice) * 1000) / 10
    : 0;

  return { pourCost, marginPct };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const barProgram = url.searchParams.get('bar_program');
    const action = url.searchParams.get('action');

    // Get spirits
    let spiritQuery = `
      SELECT * FROM spirit_base_items
      WHERE is_active = 1
    `;
    const spiritParams = [];

    if (category) {
      spiritQuery += ` AND category = ?`;
      spiritParams.push(category);
    }
    spiritQuery += ` ORDER BY category, display_order`;

    const spirits = await env.DB.prepare(spiritQuery)
      .bind(...spiritParams)
      .all();

    // Get cocktail styles
    const styles = await env.DB.prepare(`
      SELECT * FROM cocktail_styles
      WHERE is_active = 1
      ORDER BY display_order
    `).all();

    // Get modifier templates
    let templateQuery = `
      SELECT * FROM cocktail_modifier_templates
      WHERE is_active = 1
    `;
    const templateParams = [];

    if (barProgram) {
      templateQuery += ` AND bar_program_type = ?`;
      templateParams.push(barProgram);
    }

    const templates = await env.DB.prepare(templateQuery)
      .bind(...templateParams)
      .all();

    // If action=pricing, return the pricing matrix
    if (action === 'pricing') {
      const pricingMatrix = [];

      for (const spirit of spirits.results || []) {
        const spiritPricing = {
          spirit_id: spirit.id,
          category: spirit.category,
          brand: spirit.brand,
          base_price: spirit.base_price,
          tier: spirit.is_top_shelf ? 'top_shelf' :
                spirit.is_premium ? 'premium' :
                spirit.is_well ? 'well' : 'standard',
          cocktails: []
        };

        for (const style of styles.results || []) {
          const price = calculateCocktailPrice(
            spirit.base_price,
            style.volume_multiplier,
            style.style_upcharge
          );

          const metrics = calculateCostMetrics(
            spirit.cost_per_oz || 0,
            style.typical_oz,
            price
          );

          spiritPricing.cocktails.push({
            style_id: style.id,
            style_name: style.style_name,
            volume_multiplier: style.volume_multiplier,
            upcharge: style.style_upcharge,
            calculated_price: price,
            pour_oz: style.typical_oz,
            pour_cost: metrics.pourCost,
            margin_pct: metrics.marginPct,
            menu_item_name: `${spirit.brand} ${style.style_name}`
          });
        }

        pricingMatrix.push(spiritPricing);
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          pricingMatrix,
          formula: 'Final Price = (Base Spirit Price * Volume Multiplier) + Style Upcharge'
        }
      }), { headers: corsHeaders });
    }

    // Return configuration data
    return new Response(JSON.stringify({
      success: true,
      data: {
        spirits: (spirits.results || []).map(s => ({
          ...s,
          tier: s.is_top_shelf ? 'top_shelf' :
                s.is_premium ? 'premium' :
                s.is_well ? 'well' : 'standard'
        })),
        styles: styles.results || [],
        modifierTemplates: (templates.results || []).map(t => ({
          ...t,
          spirit_categories: JSON.parse(t.spirit_categories || '[]'),
          options: JSON.parse(t.options_json || '[]')
        })),
        formula: {
          description: 'Martini/Manhattan Inventory Logic',
          equation: 'Final Price = (Base Spirit Price * Volume Multiplier) + Style Upcharge',
          example: {
            spirit: 'Titos ($10)',
            style: 'Martini (2x multiplier, $2 upcharge)',
            calculation: '($10 * 2.0) + $2 = $22'
          }
        }
      }
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('Cocktail config error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: corsHeaders });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    const url = new URL(request.url);
    const action = url.pathname.split('/').pop();
    const body = await request.json();

    // Calculate pricing for custom configuration
    if (action === 'calculate') {
      const { base_price, volume_multiplier, style_upcharge, cost_per_oz, typical_oz } = body;

      if (!base_price || !volume_multiplier) {
        return new Response(JSON.stringify({
          success: false,
          error: 'base_price and volume_multiplier are required'
        }), { status: 400, headers: corsHeaders });
      }

      const price = calculateCocktailPrice(base_price, volume_multiplier, style_upcharge || 0);
      const metrics = calculateCostMetrics(cost_per_oz || 0, typical_oz || 2.0, price);

      return new Response(JSON.stringify({
        success: true,
        data: {
          calculated_price: price,
          pour_cost: metrics.pourCost,
          margin_pct: metrics.marginPct,
          breakdown: {
            base_price,
            volume_multiplier,
            style_upcharge: style_upcharge || 0,
            formula: `(${base_price} * ${volume_multiplier}) + ${style_upcharge || 0} = ${price}`
          }
        }
      }), { headers: corsHeaders });
    }

    // Generate menu items and modifier rules for bar program
    if (action === 'generate') {
      const {
        bar_program_type = 'full_bar',
        spirit_categories,
        include_styles,
        client_id
      } = body;

      // Get applicable modifier templates
      let templateQuery = `
        SELECT * FROM cocktail_modifier_templates
        WHERE is_active = 1 AND bar_program_type = ?
      `;
      const templates = await env.DB.prepare(templateQuery)
        .bind(bar_program_type)
        .all();

      // Get spirits for selected categories
      let spiritQuery = `
        SELECT * FROM spirit_base_items
        WHERE is_active = 1
      `;
      const spiritParams = [];

      if (spirit_categories && spirit_categories.length > 0) {
        spiritQuery += ` AND category IN (${spirit_categories.map(() => '?').join(',')})`;
        spiritParams.push(...spirit_categories);
      }
      spiritQuery += ` ORDER BY category, display_order`;

      const spirits = await env.DB.prepare(spiritQuery)
        .bind(...spiritParams)
        .all();

      // Get styles
      let styleQuery = `SELECT * FROM cocktail_styles WHERE is_active = 1`;
      const styleParams = [];

      if (include_styles && include_styles.length > 0) {
        styleQuery += ` AND id IN (${include_styles.map(() => '?').join(',')})`;
        styleParams.push(...include_styles);
      }
      styleQuery += ` ORDER BY display_order`;

      const styles = await env.DB.prepare(styleQuery)
        .bind(...styleParams)
        .all();

      // Generate menu items (spirit + style combinations)
      const menuItems = [];
      for (const spirit of spirits.results || []) {
        // Base spirit item (just the spirit, no cocktail style)
        menuItems.push({
          type: 'base_spirit',
          name: spirit.brand,
          category: `${spirit.category.charAt(0).toUpperCase() + spirit.category.slice(1)}`,
          price: spirit.base_price,
          modifiers: [] // Will be populated with service style modifiers
        });

        // Cocktail items (spirit + style)
        for (const style of styles.results || []) {
          const price = calculateCocktailPrice(
            spirit.base_price,
            style.volume_multiplier,
            style.style_upcharge
          );

          menuItems.push({
            type: 'cocktail',
            name: `${spirit.brand} ${style.style_name}`,
            base_spirit: spirit.brand,
            style: style.style_name,
            category: 'Cocktails',
            price,
            pour_oz: style.typical_oz,
            glass: style.default_glass
          });
        }
      }

      // Generate modifier rules
      const modifierRules = [];
      for (const template of templates.results || []) {
        const categories = JSON.parse(template.spirit_categories || '[]');
        const options = JSON.parse(template.options_json || '[]');

        modifierRules.push({
          template_id: template.id,
          template_name: template.template_name,
          group_name: template.group_name,
          group_type: template.group_type,
          is_required: template.is_required === 1,
          applicable_categories: categories,
          options: options,
          pricing_logic: template.pricing_logic
        });
      }

      // Generate recommended POS configuration
      const posConfig = {
        approach: 'spirit_state_model',
        description: 'Spirits as base inventory items with service style modifiers',
        menuStructure: {
          categories: [
            {
              name: 'Vodka',
              items: menuItems.filter(i => i.type === 'base_spirit' && i.category === 'Vodka'),
              modifiers: modifierRules.filter(r => r.applicable_categories.includes('vodka'))
            },
            {
              name: 'Gin',
              items: menuItems.filter(i => i.type === 'base_spirit' && i.category === 'Gin'),
              modifiers: modifierRules.filter(r => r.applicable_categories.includes('gin'))
            },
            {
              name: 'Bourbon/Whiskey',
              items: menuItems.filter(i =>
                i.type === 'base_spirit' &&
                ['Bourbon', 'Rye', 'Scotch'].includes(i.category)
              ),
              modifiers: modifierRules.filter(r =>
                r.applicable_categories.some(c => ['bourbon', 'rye', 'scotch'].includes(c))
              )
            },
            {
              name: 'Tequila',
              items: menuItems.filter(i => i.type === 'base_spirit' && i.category === 'Tequila'),
              modifiers: modifierRules.filter(r => r.applicable_categories.includes('tequila'))
            },
            {
              name: 'Rum',
              items: menuItems.filter(i => i.type === 'base_spirit' && i.category === 'Rum'),
              modifiers: modifierRules.filter(r => r.applicable_categories.includes('rum'))
            }
          ],
          benefits: [
            'Accurate inventory tracking - spirits deducted correctly regardless of cocktail style',
            'Consistent pricing using volume multipliers',
            'Simplified menu - one button per spirit brand',
            'Modifier options preserve bartender flexibility',
            'Proper cost tracking for margin analysis'
          ]
        }
      };

      return new Response(JSON.stringify({
        success: true,
        data: {
          bar_program_type,
          menuItems,
          modifierRules,
          posConfig,
          stats: {
            spirits_count: spirits.results?.length || 0,
            styles_count: styles.results?.length || 0,
            menu_items_generated: menuItems.length,
            modifier_rules_count: modifierRules.length
          }
        }
      }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Unknown action'
    }), { status: 400, headers: corsHeaders });

  } catch (error) {
    console.error('Cocktail config POST error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: corsHeaders });
  }
}

export async function onRequestOptions(context) {
  const { request } = context;
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': getCorsOrigin(request),
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    }
  });
}
