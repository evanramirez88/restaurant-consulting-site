/**
 * Admin Intel API
 *
 * GET /api/admin/intel - List all intel submissions
 *
 * Admin view of all rep intel submissions with filtering and pagination.
 */

import { verifyAuth, unauthorizedResponse, getCorsHeaders, handleOptions } from '../../../_shared/auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    // Verify admin authentication
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    const db = env.DB;
    const url = new URL(request.url);

    // Parse query params
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');
    const urgency = url.searchParams.get('urgency');
    const repId = url.searchParams.get('rep_id');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Build query
    let query = `
      SELECT
        ris.*,
        r.name as rep_name,
        r.email as rep_email,
        r.territory as rep_territory,
        c.company as client_name,
        c.slug as client_slug
      FROM rep_intel_submissions ris
      JOIN reps r ON ris.rep_id = r.id
      LEFT JOIN clients c ON ris.client_id = c.id
      WHERE 1=1
    `;
    const bindings = [];

    if (status) {
      query += ' AND ris.status = ?';
      bindings.push(status);
    }

    if (type) {
      query += ' AND ris.submission_type = ?';
      bindings.push(type);
    }

    if (urgency) {
      query += ' AND ris.urgency = ?';
      bindings.push(urgency);
    }

    if (repId) {
      query += ' AND ris.rep_id = ?';
      bindings.push(repId);
    }

    query += `
      ORDER BY
        CASE ris.status WHEN 'pending' THEN 0 ELSE 1 END,
        CASE ris.urgency
          WHEN 'hot' THEN 1
          WHEN 'high' THEN 2
          WHEN 'normal' THEN 3
          WHEN 'low' THEN 4
        END,
        ris.created_at DESC
      LIMIT ? OFFSET ?
    `;
    bindings.push(limit, offset);

    const { results } = await db.prepare(query).bind(...bindings).all();

    // Get counts by status
    const countsResult = await db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'reviewed' THEN 1 ELSE 0 END) as reviewed,
        SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as converted,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived
      FROM rep_intel_submissions
    `).first();

    // Get counts by type
    const typeCountsResult = await db.prepare(`
      SELECT
        SUM(CASE WHEN submission_type = 'lead' THEN 1 ELSE 0 END) as leads,
        SUM(CASE WHEN submission_type = 'opportunity' THEN 1 ELSE 0 END) as opportunities,
        SUM(CASE WHEN submission_type = 'market_intel' THEN 1 ELSE 0 END) as market_intel,
        SUM(CASE WHEN submission_type = 'competitor_info' THEN 1 ELSE 0 END) as competitor_info,
        SUM(CASE WHEN submission_type = 'feedback' THEN 1 ELSE 0 END) as feedback
      FROM rep_intel_submissions
      WHERE status = 'pending'
    `).first();

    return new Response(JSON.stringify({
      success: true,
      data: results || [],
      counts: {
        byStatus: {
          total: countsResult?.total || 0,
          pending: countsResult?.pending || 0,
          reviewed: countsResult?.reviewed || 0,
          converted: countsResult?.converted || 0,
          rejected: countsResult?.rejected || 0,
          archived: countsResult?.archived || 0
        },
        byType: {
          leads: typeCountsResult?.leads || 0,
          opportunities: typeCountsResult?.opportunities || 0,
          market_intel: typeCountsResult?.market_intel || 0,
          competitor_info: typeCountsResult?.competitor_info || 0,
          feedback: typeCountsResult?.feedback || 0
        }
      },
      pagination: {
        limit,
        offset,
        hasMore: (results?.length || 0) === limit
      }
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Admin intel error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions(context) {
  return handleOptions(context.request);
}
