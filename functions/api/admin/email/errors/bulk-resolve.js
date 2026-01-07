/**
 * Bulk Resolve API
 *
 * POST /api/admin/email/errors/bulk-resolve - Mark multiple errors as resolved
 *
 * Body:
 *   - error_ids: Array of error IDs to resolve
 *   - resolution_note: Optional note about resolution
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../_shared/auth.js';

export async function onRequestPost(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const body = await context.request.json();
    const { error_ids, resolution_note } = body;
    const db = context.env.DB;
    const now = Math.floor(Date.now() / 1000);

    if (!error_ids || !Array.isArray(error_ids) || error_ids.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'error_ids array is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Limit to 100 at a time
    const idsToResolve = error_ids.slice(0, 100);
    let resolvedCount = 0;

    for (const id of idsToResolve) {
      try {
        const result = await db.prepare(`
          UPDATE email_logs
          SET
            resolution_status = 'resolved',
            resolved_at = ?,
            resolved_by = 'admin',
            resolution_note = ?
          WHERE id = ?
          AND COALESCE(resolution_status, 'pending') NOT IN ('resolved', 'suppressed')
        `).bind(now, resolution_note || 'Bulk resolved', id).run();

        if (result.changes > 0) {
          resolvedCount++;
        }
      } catch (e) {
        console.error(`Error resolving ${id}:`, e);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Resolved ${resolvedCount} of ${idsToResolve.length} error(s)`,
      data: {
        requested: idsToResolve.length,
        resolved: resolvedCount
      }
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Bulk resolve error:', error);
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
