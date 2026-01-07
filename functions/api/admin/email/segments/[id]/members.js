/**
 * Email Segment Members API
 *
 * GET /api/admin/email/segments/:id/members - List segment members
 * PUT /api/admin/email/segments/:id/members - Replace all members (for static segments)
 * POST /api/admin/email/segments/:id/members - Add members to segment
 * DELETE /api/admin/email/segments/:id/members - Remove members from segment
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const { id } = context.params;
    const url = new URL(context.request.url);

    // Pagination
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
    const offset = (page - 1) * limit;

    // Check segment exists
    const segment = await db.prepare('SELECT * FROM email_segments WHERE id = ?').bind(id).first();

    if (!segment) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Segment not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    let members = [];
    let total = 0;

    if (segment.segment_type === 'static') {
      // Get members from email_segment_members table
      const countResult = await db.prepare(`
        SELECT COUNT(*) as total FROM email_segment_members WHERE segment_id = ?
      `).bind(id).first();
      total = countResult?.total || 0;

      const { results } = await db.prepare(`
        SELECT
          esm.subscriber_id,
          esm.added_at,
          es.email,
          es.first_name,
          es.last_name,
          es.company,
          es.pos_system,
          es.geo_tier as geographic_tier,
          es.status,
          es.engagement_score,
          es.tags_json
        FROM email_segment_members esm
        JOIN email_subscribers es ON esm.subscriber_id = es.id
        WHERE esm.segment_id = ?
        ORDER BY esm.added_at DESC
        LIMIT ? OFFSET ?
      `).bind(id, limit, offset).all();

      members = (results || []).map(m => ({
        ...m,
        tags: m.tags_json ? (typeof m.tags_json === 'string' ? JSON.parse(m.tags_json) : m.tags_json) : []
      }));
    } else {
      // Dynamic segment - query subscribers matching conditions
      if (segment.query_json) {
        const query = JSON.parse(segment.query_json);

        // Get count
        const { sql: countSql, params: countParams } = buildSegmentQuery(query, true);
        const countResult = await db.prepare(countSql).bind(...countParams).first();
        total = countResult?.count || 0;

        // Get members
        const { sql, params } = buildSegmentQuery(query, false);
        const pagedSql = `${sql} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        const { results } = await db.prepare(pagedSql).bind(...params, limit, offset).all();

        members = (results || []).map(m => ({
          subscriber_id: m.id,
          ...m,
          tags: m.tags_json ? (typeof m.tags_json === 'string' ? JSON.parse(m.tags_json) : m.tags_json) : []
        }));
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: members,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Segment members GET error:', error);
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

    // Check segment exists and is static
    const segment = await db.prepare('SELECT * FROM email_segments WHERE id = ?').bind(id).first();

    if (!segment) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Segment not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    if (segment.segment_type !== 'static') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Cannot manually manage members of a dynamic segment'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const subscriberIds = body.subscriber_ids || [];
    const now = Math.floor(Date.now() / 1000);

    // Delete existing members
    await db.prepare('DELETE FROM email_segment_members WHERE segment_id = ?').bind(id).run();

    // Insert new members
    if (subscriberIds.length > 0) {
      // Batch insert in chunks
      const chunkSize = 50;
      for (let i = 0; i < subscriberIds.length; i += chunkSize) {
        const chunk = subscriberIds.slice(i, i + chunkSize);
        const values = chunk.map(() => '(?, ?, ?, ?)').join(', ');
        const params = chunk.flatMap(subId => [crypto.randomUUID(), id, subId, now]);

        await db.prepare(`
          INSERT INTO email_segment_members (id, segment_id, subscriber_id, added_at)
          VALUES ${values}
        `).bind(...params).run();
      }
    }

    // Update cached count
    await db.prepare(`
      UPDATE email_segments SET cached_count = ?, cached_at = ?, updated_at = ? WHERE id = ?
    `).bind(subscriberIds.length, now, now, id).run();

    return new Response(JSON.stringify({
      success: true,
      data: {
        count: subscriberIds.length
      }
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Segment members PUT error:', error);
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
    const { id } = context.params;
    const body = await context.request.json();

    // Check segment exists and is static
    const segment = await db.prepare('SELECT * FROM email_segments WHERE id = ?').bind(id).first();

    if (!segment) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Segment not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    if (segment.segment_type !== 'static') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Cannot manually manage members of a dynamic segment'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const subscriberIds = body.subscriber_ids || [];
    const now = Math.floor(Date.now() / 1000);

    if (subscriberIds.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No subscriber IDs provided'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Insert new members (ignore duplicates)
    let addedCount = 0;
    for (const subId of subscriberIds) {
      try {
        await db.prepare(`
          INSERT INTO email_segment_members (id, segment_id, subscriber_id, added_at)
          VALUES (?, ?, ?, ?)
        `).bind(crypto.randomUUID(), id, subId, now).run();
        addedCount++;
      } catch (e) {
        // Likely duplicate, skip
        console.log(`Skipping duplicate member: ${subId}`);
      }
    }

    // Update cached count
    const countResult = await db.prepare(`
      SELECT COUNT(*) as count FROM email_segment_members WHERE segment_id = ?
    `).bind(id).first();

    await db.prepare(`
      UPDATE email_segments SET cached_count = ?, cached_at = ?, updated_at = ? WHERE id = ?
    `).bind(countResult?.count || 0, now, now, id).run();

    return new Response(JSON.stringify({
      success: true,
      data: {
        added: addedCount,
        total: countResult?.count || 0
      }
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Segment members POST error:', error);
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
    const body = await context.request.json();

    // Check segment exists and is static
    const segment = await db.prepare('SELECT * FROM email_segments WHERE id = ?').bind(id).first();

    if (!segment) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Segment not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    if (segment.segment_type !== 'static') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Cannot manually manage members of a dynamic segment'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const subscriberIds = body.subscriber_ids || [];
    const now = Math.floor(Date.now() / 1000);

    if (subscriberIds.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No subscriber IDs provided'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Delete members
    const placeholders = subscriberIds.map(() => '?').join(', ');
    await db.prepare(`
      DELETE FROM email_segment_members
      WHERE segment_id = ? AND subscriber_id IN (${placeholders})
    `).bind(id, ...subscriberIds).run();

    // Update cached count
    const countResult = await db.prepare(`
      SELECT COUNT(*) as count FROM email_segment_members WHERE segment_id = ?
    `).bind(id).first();

    await db.prepare(`
      UPDATE email_segments SET cached_count = ?, cached_at = ?, updated_at = ? WHERE id = ?
    `).bind(countResult?.count || 0, now, now, id).run();

    return new Response(JSON.stringify({
      success: true,
      data: {
        removed: subscriberIds.length,
        total: countResult?.count || 0
      }
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Segment members DELETE error:', error);
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
    : 'id, email, first_name, last_name, company, pos_system, geo_tier as geographic_tier, status, engagement_score, tags_json, created_at';

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
