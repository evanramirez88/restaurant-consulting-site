/**
 * Email Subscribers API - List and Create
 *
 * GET /api/admin/email/subscribers - List all subscribers with pagination and filters
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

    // Filters
    const status = url.searchParams.get('status');
    const posSystem = url.searchParams.get('pos_system');
    const geographicTier = url.searchParams.get('geographic_tier');
    const scoreMin = url.searchParams.get('score_min');
    const scoreMax = url.searchParams.get('score_max');
    const tags = url.searchParams.get('tags');

    // Build WHERE clause
    const conditions = [];
    const params = [];

    if (search) {
      conditions.push(`(email LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR company LIKE ?)`);
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (posSystem) {
      conditions.push('pos_system = ?');
      params.push(posSystem);
    }

    if (geographicTier) {
      conditions.push('geographic_tier = ?');
      params.push(geographicTier);
    }

    if (scoreMin) {
      conditions.push('engagement_score >= ?');
      params.push(parseInt(scoreMin));
    }

    if (scoreMax) {
      conditions.push('engagement_score <= ?');
      params.push(parseInt(scoreMax));
    }

    if (tags) {
      // Tags are stored as JSON array, search within
      const tagList = tags.split(',');
      const tagConditions = tagList.map(() => `tags LIKE ?`);
      conditions.push(`(${tagConditions.join(' OR ')})`);
      tagList.forEach(tag => params.push(`%"${tag.trim()}"%`));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

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
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, limit, offset];
    const { results } = await db.prepare(dataQuery).bind(...dataParams).all();

    // Get unique values for filter dropdowns (only on first page to avoid extra queries)
    let meta = null;
    if (page === 1) {
      const [posSystemsResult, tiersResult, tagsResult] = await Promise.all([
        db.prepare(`SELECT DISTINCT pos_system FROM email_subscribers WHERE pos_system IS NOT NULL AND pos_system != '' ORDER BY pos_system`).all(),
        db.prepare(`SELECT DISTINCT geographic_tier FROM email_subscribers WHERE geographic_tier IS NOT NULL AND geographic_tier != '' ORDER BY geographic_tier`).all(),
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
