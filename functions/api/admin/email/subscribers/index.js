/**
 * Email Subscribers API - List and Create
 *
 * GET /api/admin/email/subscribers - List all subscribers with pagination and advanced filters
 * POST /api/admin/email/subscribers - Create a new subscriber
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

    // Pagination
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
    const offset = (page - 1) * limit;

    // Search
    const search = url.searchParams.get('search');

    // Advanced filters - support both single values and multi-value (comma-separated)
    const statuses = url.searchParams.get('statuses'); // Multi-value: active,unsubscribed
    const status = url.searchParams.get('status'); // Single value (backward compatible)
    const posSystems = url.searchParams.get('pos_systems'); // Multi-value
    const posSystem = url.searchParams.get('pos_system'); // Single value (backward compatible)
    const geographicTiers = url.searchParams.get('geographic_tiers'); // Multi-value
    const geographicTier = url.searchParams.get('geographic_tier'); // Single value (backward compatible)
    const leadSources = url.searchParams.get('lead_sources'); // Multi-value
    const scoreMin = url.searchParams.get('score_min');
    const scoreMax = url.searchParams.get('score_max');
    const tags = url.searchParams.get('tags');
    const createdAfter = url.searchParams.get('created_after');
    const createdBefore = url.searchParams.get('created_before');

    // Sorting
    const sortBy = url.searchParams.get('sort_by') || 'created_at';
    const sortOrder = url.searchParams.get('sort_order') || 'desc';
    const validSortColumns = ['created_at', 'updated_at', 'email', 'engagement_score', 'last_email_sent_at'];
    const validSortOrders = ['asc', 'desc'];

    // Build WHERE clause
    const conditions = [];
    const params = [];

    if (search) {
      conditions.push(`(email LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR company LIKE ?)`);
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // Handle status filter (multi-value or single)
    if (statuses) {
      const statusList = statuses.split(',').map(s => s.trim()).filter(s => s);
      if (statusList.length > 0) {
        const placeholders = statusList.map(() => '?').join(',');
        conditions.push(`status IN (${placeholders})`);
        params.push(...statusList);
      }
    } else if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    // Handle POS system filter (multi-value or single)
    if (posSystems) {
      const posList = posSystems.split(',').map(s => s.trim()).filter(s => s);
      if (posList.length > 0) {
        const placeholders = posList.map(() => '?').join(',');
        conditions.push(`pos_system IN (${placeholders})`);
        params.push(...posList);
      }
    } else if (posSystem) {
      conditions.push('pos_system = ?');
      params.push(posSystem);
    }

    // Handle geographic tier filter (multi-value or single)
    if (geographicTiers) {
      const tierList = geographicTiers.split(',').map(s => s.trim()).filter(s => s);
      if (tierList.length > 0) {
        const placeholders = tierList.map(() => '?').join(',');
        conditions.push(`geographic_tier IN (${placeholders})`);
        params.push(...tierList);
      }
    } else if (geographicTier) {
      conditions.push('geographic_tier = ?');
      params.push(geographicTier);
    }

    // Handle lead source filter (multi-value)
    if (leadSources) {
      const sourceList = leadSources.split(',').map(s => s.trim()).filter(s => s);
      if (sourceList.length > 0) {
        const placeholders = sourceList.map(() => '?').join(',');
        conditions.push(`lead_source IN (${placeholders})`);
        params.push(...sourceList);
      }
    }

    // Score range filter
    if (scoreMin) {
      conditions.push('engagement_score >= ?');
      params.push(parseInt(scoreMin));
    }

    if (scoreMax) {
      conditions.push('engagement_score <= ?');
      params.push(parseInt(scoreMax));
    }

    // Tags filter - search within JSON array
    if (tags) {
      const tagList = tags.split(',').map(t => t.trim()).filter(t => t);
      if (tagList.length > 0) {
        const tagConditions = tagList.map(() => `tags LIKE ?`);
        conditions.push(`(${tagConditions.join(' OR ')})`);
        tagList.forEach(tag => params.push(`%"${tag}"%`));
      }
    }

    // Date range filters
    if (createdAfter) {
      // Convert date string to Unix timestamp
      const timestamp = Math.floor(new Date(createdAfter).getTime() / 1000);
      if (!isNaN(timestamp)) {
        conditions.push('created_at >= ?');
        params.push(timestamp);
      }
    }

    if (createdBefore) {
      // Convert date string to Unix timestamp (end of day)
      const date = new Date(createdBefore);
      date.setHours(23, 59, 59, 999);
      const timestamp = Math.floor(date.getTime() / 1000);
      if (!isNaN(timestamp)) {
        conditions.push('created_at <= ?');
        params.push(timestamp);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Validate and apply sorting
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const sortDirection = validSortOrders.includes(sortOrder.toLowerCase()) ? sortOrder.toUpperCase() : 'DESC';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM email_subscribers ${whereClause}`;
    const countResult = await db.prepare(countQuery).bind(...params).first();
    const total = countResult?.total || 0;

    // Get subscribers
    const dataQuery = `
      SELECT
        id, email, first_name, last_name, company, phone, pos_system,
        geographic_tier, lead_source, status, engagement_score, tags,
        total_emails_sent, total_emails_opened, total_emails_clicked,
        last_email_sent_at, last_email_opened_at, created_at, updated_at
      FROM email_subscribers
      ${whereClause}
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, limit, offset];
    const { results } = await db.prepare(dataQuery).bind(...dataParams).all();

    // Get unique values for filter dropdowns (only on first page to avoid extra queries)
    let meta = null;
    if (page === 1) {
      const [posSystemsResult, tiersResult, leadSourcesResult, tagsResult] = await Promise.all([
        db.prepare(`SELECT DISTINCT pos_system FROM email_subscribers WHERE pos_system IS NOT NULL AND pos_system != '' ORDER BY pos_system`).all(),
        db.prepare(`SELECT DISTINCT geographic_tier FROM email_subscribers WHERE geographic_tier IS NOT NULL AND geographic_tier != '' ORDER BY geographic_tier`).all(),
        db.prepare(`SELECT DISTINCT lead_source FROM email_subscribers WHERE lead_source IS NOT NULL AND lead_source != '' ORDER BY lead_source`).all(),
        db.prepare(`SELECT tags FROM email_subscribers WHERE tags IS NOT NULL AND tags != '[]' LIMIT 1000`).all()
      ]);

      // Extract unique tags from JSON arrays
      const allTags = new Set();
      (tagsResult.results || []).forEach(row => {
        try {
          const tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags;
          if (Array.isArray(tags)) {
            tags.forEach(tag => allTags.add(tag));
          }
        } catch (e) {}
      });

      meta = {
        pos_systems: (posSystemsResult.results || []).map(r => r.pos_system),
        geographic_tiers: (tiersResult.results || []).map(r => r.geographic_tier),
        lead_sources: (leadSourcesResult.results || []).map(r => r.lead_source),
        tags: Array.from(allTags).sort()
      };
    }

    return new Response(JSON.stringify({
      success: true,
      data: results || [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      ...(meta && { meta })
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Subscribers GET error:', error);
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
    if (!body.email) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Email is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid email format'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Check for duplicate email
    const existing = await db.prepare('SELECT id FROM email_subscribers WHERE email = ?')
      .bind(body.email.toLowerCase().trim())
      .first();

    if (existing) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Email already exists'
      }), {
        status: 409,
        headers: corsHeaders
      });
    }

    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const tags = body.tags ? JSON.stringify(body.tags) : '[]';

    await db.prepare(`
      INSERT INTO email_subscribers (
        id, email, first_name, last_name, company, phone, pos_system,
        geographic_tier, lead_source, status, engagement_score, tags,
        total_emails_sent, total_emails_opened, total_emails_clicked,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.email.toLowerCase().trim(),
      body.first_name || null,
      body.last_name || null,
      body.company || null,
      body.phone || null,
      body.pos_system || null,
      body.geographic_tier || null,
      body.lead_source || 'manual',
      body.status || 'active',
      body.engagement_score || 50,
      tags,
      0, 0, 0,
      now, now
    ).run();

    const subscriber = await db.prepare('SELECT * FROM email_subscribers WHERE id = ?').bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: subscriber
    }), {
      status: 201,
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Subscribers POST error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
