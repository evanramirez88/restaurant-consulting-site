/**
 * Email Segments API - List and Create
 *
 * GET /api/admin/email/segments - List all segments
 * POST /api/admin/email/segments - Create a new segment
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
    const url = new URL(context.request.url);

    // Filters
    const segmentType = url.searchParams.get('type');
    const status = url.searchParams.get('status') || 'active';

    // Build WHERE clause
    const conditions = [];
    const params = [];

    if (segmentType && segmentType !== 'all') {
      conditions.push('segment_type = ?');
      params.push(segmentType);
    }

    if (status && status !== 'all') {
      conditions.push('status = ?');
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get segments with their cached counts
    const query = `
      SELECT
        id, name, slug, description, segment_type, query_json,
        cached_count, cached_at, status, created_at, updated_at
      FROM email_segments
      ${whereClause}
      ORDER BY created_at DESC
    `;

    const { results } = await db.prepare(query).bind(...params).all();

    return new Response(JSON.stringify({
      success: true,
      data: results || []
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Segments GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

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
    if (!body.name || !body.name.trim()) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Segment name is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    // Generate slug from name
    const slug = body.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100);

    // Check for duplicate slug
    const existingSlug = await db.prepare('SELECT id FROM email_segments WHERE slug = ?')
      .bind(slug)
      .first();

    const finalSlug = existingSlug ? `${slug}-${Date.now()}` : slug;

    // Calculate initial cached count for dynamic segments
    let cachedCount = 0;
    if (body.segment_type === 'dynamic' && body.query_json) {
      try {
        cachedCount = await calculateSegmentCount(db, body.query_json);
      } catch (e) {
        console.error('Failed to calculate initial count:', e);
      }
    }

    await db.prepare(`
      INSERT INTO email_segments (
        id, name, slug, description, segment_type, query_json,
        cached_count, cached_at, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.name.trim(),
      finalSlug,
      body.description || null,
      body.segment_type || 'dynamic',
      body.query_json || null,
      cachedCount,
      now,
      'active',
      now,
      now
    ).run();

    const segment = await db.prepare('SELECT * FROM email_segments WHERE id = ?').bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: segment
    }), {
      status: 201,
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Segments POST error:', error);
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

  // Handle both old format (conditions array) and new format (groups)
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

  // Handle field mapping (some fields have different names in DB)
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
      return { sql: '1=0', param: undefined }; // No matches if empty list

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
      // Date handling - convert to timestamp
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

/**
 * Map frontend field names to database column names
 */
function getDBField(field) {
  const fieldMap = {
    'geographic_tier': 'geo_tier',
    'engagement_score': 'engagement_score',
    'tags': 'tags_json',
    'email_domain': 'email'
  };
  return fieldMap[field] || field;
}

/**
 * Convert date string to Unix timestamp
 */
function dateToTimestamp(dateStr) {
  const date = new Date(dateStr);
  return Math.floor(date.getTime() / 1000);
}

export async function onRequestOptions() {
  return handleOptions();
}
