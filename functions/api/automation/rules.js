/**
 * Automation Rules API
 *
 * GET /api/automation/rules - List automation rules with run counts
 * POST /api/automation/rules - Create a new automation rule
 *
 * Supports both domain expertise rules (cocktail_logic, kds_routing)
 * and user-defined trigger/action rules (reporting, inventory, menu, labor, pricing, integration)
 */

import { verifyAuth, unauthorizedResponse, getCorsHeaders, handleOptions } from '../_shared/auth.js';

// Map DB categories to UI categories
const CATEGORY_MAPPING = {
  'cocktail_logic': 'menu',
  'kds_routing': 'integration',
  'printer_routing': 'integration',
  'tax_rules': 'pricing',
  'modifier_hierarchy': 'menu',
  'inventory_logic': 'inventory',
  'pricing_rules': 'pricing',
  'station_weights': 'integration',
  'menu_structure': 'menu',
  // UI categories (pass through)
  'reporting': 'reporting',
  'inventory': 'inventory',
  'menu': 'menu',
  'labor': 'labor',
  'pricing': 'pricing',
  'integration': 'integration'
};

// UI category info
const CATEGORY_INFO = {
  reporting: { label: 'Reporting', color: 'blue' },
  inventory: { label: 'Inventory', color: 'green' },
  menu: { label: 'Menu Sync', color: 'amber' },
  labor: { label: 'Labor', color: 'purple' },
  pricing: { label: 'Pricing', color: 'emerald' },
  integration: { label: 'Integrations', color: 'cyan' }
};

export async function onRequestGet(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, context.request);
    }

    const db = context.env.DB;
    const url = new URL(context.request.url);

    // Parse query parameters
    const category = url.searchParams.get('category');
    const activeOnly = url.searchParams.get('active_only') !== 'false';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    // Build query
    let whereConditions = [];
    let params = [];

    if (activeOnly) {
      whereConditions.push('ar.is_active = 1');
    }

    if (category) {
      // Map UI category back to DB categories
      const dbCategories = Object.entries(CATEGORY_MAPPING)
        .filter(([_, uiCat]) => uiCat === category)
        .map(([dbCat, _]) => dbCat);

      if (dbCategories.length > 0) {
        whereConditions.push(`ar.rule_category IN (${dbCategories.map(() => '?').join(', ')})`);
        params.push(...dbCategories);
      }
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM automation_rules ar ${whereClause}`;
    const countResult = await db.prepare(countQuery).bind(...params).first();
    const total = countResult?.total || 0;

    // Get rules with run counts from automation_events
    // Note: automation_events links to jobs, not rules directly
    // So we compute run_count from jobs that were created by rules
    const query = `
      SELECT
        ar.id,
        ar.rule_name as name,
        ar.rule_description as description,
        ar.rule_category as category,
        ar.rule_logic_json as logic,
        ar.is_active as enabled,
        ar.is_default,
        ar.applies_to_restaurant_type,
        ar.applies_to_pos_version,
        ar.created_at,
        ar.updated_at,
        (SELECT COUNT(*) FROM automation_jobs aj WHERE aj.job_type LIKE '%' || REPLACE(ar.rule_category, '_', '%') || '%') as run_count,
        (SELECT MAX(created_at) FROM automation_jobs aj WHERE aj.job_type LIKE '%' || REPLACE(ar.rule_category, '_', '%') || '%') as last_run_at
      FROM automation_rules ar
      ${whereClause}
      ORDER BY ar.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const { results } = await db.prepare(query).bind(...params, limit, offset).all();

    // Transform to UI format
    const rules = (results || []).map(rule => {
      let logic = {};
      try {
        logic = rule.logic ? JSON.parse(rule.logic) : {};
      } catch (e) {
        logic = {};
      }

      // Map category
      const uiCategory = CATEGORY_MAPPING[rule.category] || 'integration';

      // Build trigger from logic
      const trigger = {
        type: logic.trigger_type || 'schedule',
        ...(logic.schedule && { schedule: logic.schedule }),
        ...(logic.event && { event: logic.event }),
        ...(logic.threshold && { threshold: logic.threshold })
      };

      // Build actions from logic
      const actions = logic.actions || [
        { type: 'notification', config: { channel: 'app' } }
      ];

      return {
        id: rule.id,
        name: rule.name,
        description: rule.description || '',
        category: uiCategory,
        trigger,
        actions,
        enabled: rule.enabled === 1,
        runCount: rule.run_count || 0,
        lastRun: rule.last_run_at ? rule.last_run_at * 1000 : null,
        nextRun: null, // Computed based on schedule
        createdAt: rule.created_at ? rule.created_at * 1000 : null,
        updatedAt: rule.updated_at ? rule.updated_at * 1000 : null,
        isDefault: rule.is_default === 1,
        appliesToType: rule.applies_to_restaurant_type,
        appliesToVersion: rule.applies_to_pos_version
      };
    });

    return new Response(JSON.stringify({
      success: true,
      data: rules,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + rules.length < total
      },
      categories: CATEGORY_INFO
    }), {
      headers: getCorsHeaders(context.request)
    });
  } catch (error) {
    console.error('Automation rules list error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: getCorsHeaders(context.request)
    });
  }
}

export async function onRequestPost(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, context.request);
    }

    const db = context.env.DB;
    const body = await context.request.json();

    const { name, description, category, trigger, actions } = body;

    // Validate required fields
    if (!name) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Rule name is required'
      }), {
        status: 400,
        headers: getCorsHeaders(context.request)
      });
    }

    if (!category) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Category is required'
      }), {
        status: 400,
        headers: getCorsHeaders(context.request)
      });
    }

    // Valid UI categories
    const validCategories = ['reporting', 'inventory', 'menu', 'labor', 'pricing', 'integration'];
    if (!validCategories.includes(category)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Invalid category. Must be one of: ${validCategories.join(', ')}`
      }), {
        status: 400,
        headers: getCorsHeaders(context.request)
      });
    }

    // Generate ID
    const id = `rule_${crypto.randomUUID().split('-')[0]}`;

    // Build logic JSON
    const logicJson = JSON.stringify({
      trigger_type: trigger?.type || 'schedule',
      schedule: trigger?.schedule,
      event: trigger?.event,
      threshold: trigger?.threshold,
      actions: actions || []
    });

    // Insert rule
    await db.prepare(`
      INSERT INTO automation_rules (
        id, rule_category, rule_name, rule_description, rule_logic_json,
        is_active, is_default, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 1, 0, unixepoch(), unixepoch())
    `).bind(id, category, name, description || '', logicJson).run();

    // Fetch created rule
    const created = await db.prepare('SELECT * FROM automation_rules WHERE id = ?').bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: created.id,
        name: created.rule_name,
        description: created.rule_description,
        category,
        trigger,
        actions,
        enabled: true,
        runCount: 0,
        lastRun: null,
        nextRun: null,
        createdAt: Date.now()
      }
    }), {
      status: 201,
      headers: getCorsHeaders(context.request)
    });
  } catch (error) {
    console.error('Create automation rule error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: getCorsHeaders(context.request)
    });
  }
}

export async function onRequestOptions(context) {
  return handleOptions(context.request);
}
