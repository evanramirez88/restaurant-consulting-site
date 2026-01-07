/**
 * Email Segments Preview API
 *
 * POST /api/admin/email/segments/preview - Preview matching subscribers for a query
 *
 * This endpoint allows previewing a segment query without creating/saving the segment.
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../_shared/auth.js';

export async function onRequestPost(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const body = await context.request.json();

    if (!body.query) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Query is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const query = body.query;

    // Get count
    const { sql: countSql, params: countParams } = buildSegmentQuery(query, true);
    const countResult = await db.prepare(countSql).bind(...countParams).first();
    const count = countResult?.count || 0;

    // Get sample (first 10)
    const { sql: sampleSql, params: sampleParams } = buildSegmentQuery(query, false);
    const sampleQuery = `${sampleSql} LIMIT 10`;
    const { results: sample } = await db.prepare(sampleQuery).bind(...sampleParams).all();

    // Parse tags for sample subscribers
    const parsedSample = (sample || []).map(s => ({
      ...s,
      tags: s.tags_json ? (typeof s.tags_json === 'string' ? JSON.parse(s.tags_json) : s.tags_json) : []
    }));

    return new Response(JSON.stringify({
      success: true,
      data: {
        count,
        sample: parsedSample
      }
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Segment preview error:', error);
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
 * Build SQL query from segment conditions
 */
function buildSegmentQuery(query, countOnly = false) {
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

  const selectClause = countOnly
    ? 'COUNT(*) as count'
    : 'id, email, first_name, last_name, company, pos_system, geo_tier as geographic_tier, status, engagement_score, tags_json';

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
