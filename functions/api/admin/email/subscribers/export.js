/**
 * Email Subscribers Export API
 *
 * GET /api/admin/email/subscribers/export - Export subscribers as CSV
 *
 * Supports all advanced filter parameters from the list endpoint
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

    // Search
    const search = url.searchParams.get('search');

    // Advanced filters - support both single values and multi-value (comma-separated)
    const statuses = url.searchParams.get('statuses'); // Multi-value
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
      const timestamp = Math.floor(new Date(createdAfter).getTime() / 1000);
      if (!isNaN(timestamp)) {
        conditions.push('created_at >= ?');
        params.push(timestamp);
      }
    }

    if (createdBefore) {
      const date = new Date(createdBefore);
      date.setHours(23, 59, 59, 999);
      const timestamp = Math.floor(date.getTime() / 1000);
      if (!isNaN(timestamp)) {
        conditions.push('created_at <= ?');
        params.push(timestamp);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get all matching subscribers (limit to 100k for safety)
    const query = `
      SELECT
        email,
        first_name,
        last_name,
        company,
        phone,
        pos_system,
        geographic_tier,
        lead_source,
        status,
        engagement_score,
        tags,
        total_emails_sent,
        total_emails_opened,
        total_emails_clicked,
        last_email_sent_at,
        last_email_opened_at,
        created_at
      FROM email_subscribers
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT 100000
    `;

    const { results } = await db.prepare(query).bind(...params).all();

    if (!results || results.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No subscribers to export'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Generate CSV
    const csvHeaders = [
      'email',
      'first_name',
      'last_name',
      'company',
      'phone',
      'pos_system',
      'geographic_tier',
      'lead_source',
      'status',
      'engagement_score',
      'tags',
      'total_emails_sent',
      'total_emails_opened',
      'total_emails_clicked',
      'open_rate',
      'click_rate',
      'last_email_sent_at',
      'last_email_opened_at',
      'created_at'
    ];

    const csvRows = [csvHeaders.join(',')];

    for (const subscriber of results) {
      // Calculate rates
      const openRate = subscriber.total_emails_sent > 0
        ? Math.round((subscriber.total_emails_opened / subscriber.total_emails_sent) * 100)
        : 0;
      const clickRate = subscriber.total_emails_opened > 0
        ? Math.round((subscriber.total_emails_clicked / subscriber.total_emails_opened) * 100)
        : 0;

      // Format timestamps
      const formatTimestamp = (ts) => {
        if (!ts) return '';
        return new Date(ts * 1000).toISOString();
      };

      // Format tags
      let tagsStr = '';
      if (subscriber.tags) {
        try {
          const tagsArray = typeof subscriber.tags === 'string'
            ? JSON.parse(subscriber.tags)
            : subscriber.tags;
          tagsStr = Array.isArray(tagsArray) ? tagsArray.join(';') : '';
        } catch (e) {
          tagsStr = '';
        }
      }

      const row = [
        escapeCsvField(subscriber.email || ''),
        escapeCsvField(subscriber.first_name || ''),
        escapeCsvField(subscriber.last_name || ''),
        escapeCsvField(subscriber.company || ''),
        escapeCsvField(subscriber.phone || ''),
        escapeCsvField(subscriber.pos_system || ''),
        escapeCsvField(subscriber.geographic_tier || ''),
        escapeCsvField(subscriber.lead_source || ''),
        escapeCsvField(subscriber.status || ''),
        subscriber.engagement_score || 0,
        escapeCsvField(tagsStr),
        subscriber.total_emails_sent || 0,
        subscriber.total_emails_opened || 0,
        subscriber.total_emails_clicked || 0,
        `${openRate}%`,
        `${clickRate}%`,
        formatTimestamp(subscriber.last_email_sent_at),
        formatTimestamp(subscriber.last_email_opened_at),
        formatTimestamp(subscriber.created_at)
      ];

      csvRows.push(row.join(','));
    }

    const csv = csvRows.join('\n');

    // Return as file download
    const filename = `subscribers_export_${new Date().toISOString().split('T')[0]}.csv`;

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Subscribers export error:', error);
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
 * Escape a field for CSV output
 */
function escapeCsvField(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);

  // Check if field needs quoting
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    // Escape double quotes by doubling them
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export async function onRequestOptions() {
  return handleOptions();
}
