/**
 * Email Segments API - Single Segment Operations
 *
 * GET /api/admin/email/segments/:id - Get segment details
 * PUT /api/admin/email/segments/:id - Update segment
 * DELETE /api/admin/email/segments/:id - Delete segment
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const { id } = context.params;

    // Get segment
    const segment = await db.prepare(`
      SELECT * FROM email_segments WHERE id = ?
    `).bind(id).first();

    if (!segment) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Segment not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // For static segments, get member count
    let memberCount = segment.cached_count;
    if (segment.segment_type === 'static') {
      const countResult = await db.prepare(`
        SELECT COUNT(*) as count FROM email_segment_members WHERE segment_id = ?
      `).bind(id).first();
      memberCount = countResult?.count || 0;
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        ...segment,
        member_count: memberCount
      }
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Segment GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestPut(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const { id } = context.params;
    const body = await context.request.json();

    // Check segment exists
    const existing = await db.prepare('SELECT * FROM email_segments WHERE id = ?').bind(id).first();

    if (!existing) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Segment not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    const now = Math.floor(Date.now() / 1000);

    // Build update query dynamically
    const updates = [];
    const params = [];

    if (body.name !== undefined) {
      updates.push('name = ?');
      params.push(body.name.trim());

      // Update slug if name changed
      const newSlug = body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 100);

      // Check for duplicate slug
      const existingSlug = await db.prepare('SELECT id FROM email_segments WHERE slug = ? AND id != ?')
        .bind(newSlug, id)
        .first();

      updates.push('slug = ?');
      params.push(existingSlug ? `${newSlug}-${Date.now()}` : newSlug);
    }

    if (body.description !== undefined) {
      updates.push('description = ?');
      params.push(body.description || null);
    }

    if (body.segment_type !== undefined) {
      updates.push('segment_type = ?');
      params.push(body.segment_type);
    }

    if (body.query_json !== undefined) {
      updates.push('query_json = ?');
      params.push(body.query_json);

      // Recalculate cached count for dynamic segments
      if (body.segment_type === 'dynamic' || existing.segment_type === 'dynamic') {
        try {
          const count = await calculateSegmentCount(db, body.query_json);
          updates.push('cached_count = ?');
          params.push(count);
          updates.push('cached_at = ?');
          params.push(now);
        } catch (e) {
          console.error('Failed to recalculate count:', e);
        }
      }
    }

    if (body.status !== undefined) {
      updates.push('status = ?');
      params.push(body.status);
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No fields to update'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    await db.prepare(`
      UPDATE email_segments SET ${updates.join(', ')} WHERE id = ?
    `).bind(...params).run();

    const segment = await db.prepare('SELECT * FROM email_segments WHERE id = ?').bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: segment
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Segment PUT error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestDelete(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const { id } = context.params;

    // Check segment exists
    const existing = await db.prepare('SELECT id FROM email_segments WHERE id = ?').bind(id).first();

    if (!existing) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Segment not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Delete segment members first (cascade should handle this but being explicit)
    await db.prepare('DELETE FROM email_segment_members WHERE segment_id = ?').bind(id).run();

    // Delete segment
    await db.prepare('DELETE FROM email_segments WHERE id = ?').bind(id).run();

    return new Response(JSON.stringify({
      success: true
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Segment DELETE error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * Calculate the count of subscribers matching a segment query
 */
async function calculateSegmentCount(db, queryJson) {
  if (!queryJson) return 0;

  const query = typeof queryJson === 'string' ? JSON.parse(queryJson) : queryJson;
  const { sql, params } = buildSegmentQuery(query, true);

  const result = await db.prepare(sql).bind(...params).first();
  return result?.count || 0;
}

/**
 * Build SQL query from segment conditions
 */
function buildSegmentQuery(query, countOnly = false) {
  const conditions = [];
  const params = [];

  const groups = query.groups || [{ logic: 'AND', conditions: query.conditions || [] }];
  const groupLogic = query.logic || 'AND';

  const groupConditions = groups.map(group => {
    const groupConds = (group.conditions || []).map(condition => {
      const { sql, param } = buildConditionSQL(condition);
      if (param !== undefined) {
        if (Array.isArray(param)) {
          params.push(...param);
        } else {
          params.push(param);
        }
      }
      return sql;
    }).filter(Boolean);

    if (groupConds.length === 0) return null;
    return `(${groupConds.join(` ${group.logic || 'AND'} `)})`;
  }).filter(Boolean);

  let whereClause = '';
  if (groupConditions.length > 0) {
    whereClause = `WHERE ${groupConditions.join(` ${groupLogic} `)}`;
  }

  const selectClause = countOnly ? 'COUNT(*) as count' : '*';

  return {
    sql: `SELECT ${selectClause} FROM email_subscribers ${whereClause}`,
    params
  };
}

/**
 * Build SQL condition from a single condition object
 */
function buildConditionSQL(condition) {
  const { field, operator, value } = condition;
  const dbField = getDBField(field);

  switch (operator) {
    case 'equals':
      return { sql: `${dbField} = ?`, param: value };
    case 'not_equals':
      return { sql: `${dbField} != ?`, param: value };
    case 'contains':
      if (field === 'tags') {
        return { sql: `tags_json LIKE ?`, param: `%"${value}"%` };
      }
      return { sql: `${dbField} LIKE ?`, param: `%${value}%` };
    case 'not_contains':
      if (field === 'tags') {
        return { sql: `(tags_json IS NULL OR tags_json NOT LIKE ?)`, param: `%"${value}"%` };
      }
      return { sql: `${dbField} NOT LIKE ?`, param: `%${value}%` };
    case 'starts_with':
      return { sql: `${dbField} LIKE ?`, param: `${value}%` };
    case 'ends_with':
      return { sql: `${dbField} LIKE ?`, param: `%${value}` };
    case 'greater_than':
      return { sql: `${dbField} > ?`, param: value };
    case 'less_than':
      return { sql: `${dbField} < ?`, param: value };
    case 'greater_than_or_equals':
      return { sql: `${dbField} >= ?`, param: value };
    case 'less_than_or_equals':
      return { sql: `${dbField} <= ?`, param: value };
    case 'between':
      if (Array.isArray(value) && value.length === 2) {
        return { sql: `${dbField} BETWEEN ? AND ?`, param: value };
      }
      return { sql: '1=1', param: undefined };
    case 'in_list':
      if (Array.isArray(value) && value.length > 0) {
        const placeholders = value.map(() => '?').join(', ');
        return { sql: `${dbField} IN (${placeholders})`, param: value };
      }
      return { sql: '1=0', param: undefined };
    case 'not_in_list':
      if (Array.isArray(value) && value.length > 0) {
        const placeholders = value.map(() => '?').join(', ');
        return { sql: `${dbField} NOT IN (${placeholders})`, param: value };
      }
      return { sql: '1=1', param: undefined };
    case 'is_empty':
      if (field === 'tags') {
        return { sql: `(tags_json IS NULL OR tags_json = '[]')`, param: undefined };
      }
      return { sql: `(${dbField} IS NULL OR ${dbField} = '')`, param: undefined };
    case 'is_not_empty':
      if (field === 'tags') {
        return { sql: `(tags_json IS NOT NULL AND tags_json != '[]')`, param: undefined };
      }
      return { sql: `(${dbField} IS NOT NULL AND ${dbField} != '')`, param: undefined };
    case 'before':
      return { sql: `${dbField} < ?`, param: dateToTimestamp(value) };
    case 'after':
      return { sql: `${dbField} > ?`, param: dateToTimestamp(value) };
    case 'in_last_days':
      const daysAgo = Math.floor(Date.now() / 1000) - (parseInt(value) * 86400);
      return { sql: `${dbField} >= ?`, param: daysAgo };
    case 'contains_any':
      if (Array.isArray(value) && value.length > 0) {
        const tagConditions = value.map(() => `tags_json LIKE ?`).join(' OR ');
        return { sql: `(${tagConditions})`, param: value.map(v => `%"${v}"%`) };
      }
      return { sql: '1=0', param: undefined };
    case 'contains_all':
      if (Array.isArray(value) && value.length > 0) {
        const tagConditions = value.map(() => `tags_json LIKE ?`).join(' AND ');
        return { sql: `(${tagConditions})`, param: value.map(v => `%"${v}"%`) };
      }
      return { sql: '1=1', param: undefined };
    default:
      return { sql: '1=1', param: undefined };
  }
}

function getDBField(field) {
  const fieldMap = {
    'geographic_tier': 'geo_tier',
    'engagement_score': 'engagement_score',
    'tags': 'tags_json',
    'email_domain': 'email'
  };
  return fieldMap[field] || field;
}

function dateToTimestamp(dateStr) {
  const date = new Date(dateStr);
  return Math.floor(date.getTime() / 1000);
}

export async function onRequestOptions() {
  return handleOptions();
}
