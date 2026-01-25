/**
 * Failed Emails API - List and Filter Failed Emails
 *
 * GET /api/admin/email/errors - Get failed emails with filters
 *
 * Query params:
 *   - error_type: Filter by error type (bounced, rejected, timed_out, invalid_email, rate_limited)
 *   - sequence_id: Filter by sequence
 *   - start_date: Unix timestamp for start of range
 *   - end_date: Unix timestamp for end of range
 *   - retryable: boolean - Only show retryable errors
 *   - status: pending, retrying, resolved, suppressed
 *   - search: Search email or error message
 *   - page: Page number (default 1)
 *   - limit: Results per page (default 20)
 *   - format: 'csv' for CSV export
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

    // Get query parameters
    const errorType = url.searchParams.get('error_type');
    const sequenceId = url.searchParams.get('sequence_id');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const retryable = url.searchParams.get('retryable') === 'true';
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const format = url.searchParams.get('format');
    const offset = (page - 1) * limit;

    // Default to last 7 days if no dates provided
    const now = Math.floor(Date.now() / 1000);
    const defaultStart = now - (7 * 24 * 60 * 60);
    const start = startDate ? parseInt(startDate) : defaultStart;
    const end = endDate ? parseInt(endDate) : now;

    // Build WHERE clause
    let whereConditions = ['el.status IN (\'failed\', \'bounced\', \'rejected\')'];
    let queryParams = [];

    // Date range filter - use failed_at if available, otherwise created_at
    whereConditions.push('COALESCE(el.failed_at, el.created_at) >= ?');
    queryParams.push(start);
    whereConditions.push('COALESCE(el.failed_at, el.created_at) <= ?');
    queryParams.push(end);

    // Error type filter
    if (errorType && errorType !== 'all') {
      whereConditions.push('el.error_type = ?');
      queryParams.push(errorType);
    }

    // Sequence filter
    if (sequenceId && sequenceId !== 'all') {
      whereConditions.push('el.sequence_id = ?');
      queryParams.push(sequenceId);
    }

    // Status filter (for error resolution status)
    if (status && status !== 'all') {
      whereConditions.push('COALESCE(el.resolution_status, \'pending\') = ?');
      queryParams.push(status);
    }

    // Retryable filter - exclude hard bounces and invalid emails
    if (retryable) {
      whereConditions.push('el.error_type NOT IN (\'bounced\', \'invalid_email\')');
      whereConditions.push('COALESCE(el.retry_count, 0) < 5');
      whereConditions.push('COALESCE(el.resolution_status, \'pending\') = \'pending\'');
    }

    // Search filter
    if (search) {
      whereConditions.push('(s.email LIKE ? OR el.error_message LIKE ?)');
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM email_logs el
      LEFT JOIN email_subscribers s ON el.subscriber_id = s.id
      WHERE ${whereClause}
    `;
    const countResult = await db.prepare(countQuery).bind(...queryParams).first();
    const total = countResult?.total || 0;

    // Get failed emails with full details
    const dataQuery = `
      SELECT
        el.id,
        el.subscriber_id,
        s.email as subscriber_email,
        s.first_name || ' ' || COALESCE(s.last_name, '') as subscriber_name,
        el.sequence_id,
        seq.name as sequence_name,
        el.step_id,
        ss.step_number,
        ss.subject as step_subject,
        COALESCE(el.error_type, 'unknown') as error_type,
        el.error_message,
        el.error_details,
        COALESCE(el.failed_at, el.created_at) as failed_at,
        COALESCE(el.retry_count, 0) as retry_count,
        el.last_retry_at,
        COALESCE(el.resolution_status, 'pending') as status,
        el.resolved_at,
        el.resolved_by,
        el.resolution_note
      FROM email_logs el
      LEFT JOIN email_subscribers s ON el.subscriber_id = s.id
      LEFT JOIN email_sequences seq ON el.sequence_id = seq.id
      LEFT JOIN sequence_steps ss ON el.step_id = ss.id
      WHERE ${whereClause}
      ORDER BY COALESCE(el.failed_at, el.created_at) DESC
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...queryParams, limit, offset];
    const { results: failedEmails } = await db.prepare(dataQuery).bind(...dataParams).all();

    // Handle CSV export
    if (format === 'csv') {
      const csvRows = [
        ['ID', 'Email', 'Sequence', 'Step', 'Error Type', 'Error Message', 'Failed At', 'Retry Count', 'Status'].join(',')
      ];

      for (const email of failedEmails) {
        csvRows.push([
          email.id,
          `"${(email.subscriber_email || '').replace(/"/g, '""')}"`,
          `"${(email.sequence_name || '').replace(/"/g, '""')}"`,
          email.step_number || '',
          email.error_type || '',
          `"${(email.error_message || '').replace(/"/g, '""')}"`,
          new Date(email.failed_at * 1000).toISOString(),
          email.retry_count,
          email.status
        ].join(','));
      }

      return new Response(csvRows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="failed_emails_${new Date().toISOString().split('T')[0]}.csv"`,
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: failedEmails,
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
    console.error('Failed emails GET error:', error);
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
