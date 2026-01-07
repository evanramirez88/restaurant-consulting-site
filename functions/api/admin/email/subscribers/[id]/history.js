/**
 * Email Subscriber History API
 *
 * GET /api/admin/email/subscribers/:id/history - Get subscriber's email history
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

    // Pagination parameters
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = (page - 1) * limit;

    // Check subscriber exists
    const subscriber = await db.prepare('SELECT id, email FROM email_subscribers WHERE id = ?')
      .bind(id)
      .first();

    if (!subscriber) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Subscriber not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Get email history from email_log table
    let results = [];
    let total = 0;

    try {
      // Get total count
      const countResult = await db.prepare(`
        SELECT COUNT(*) as total FROM email_log WHERE subscriber_id = ?
      `).bind(id).first();
      total = countResult?.total || 0;

      // Get email history
      const historyResult = await db.prepare(`
        SELECT
          id,
          subject,
          sent_at,
          opened_at,
          clicked_at,
          bounced,
          template_id,
          sequence_id,
          campaign_id
        FROM email_log
        WHERE subscriber_id = ?
        ORDER BY sent_at DESC
        LIMIT ? OFFSET ?
      `).bind(id, limit, offset).all();

      results = historyResult.results || [];
    } catch (e) {
      // Table might not exist yet - return empty array
      console.log('Email log query failed:', e.message);
    }

    return new Response(JSON.stringify({
      success: true,
      data: results,
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
    console.error('Subscriber history GET error:', error);
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
