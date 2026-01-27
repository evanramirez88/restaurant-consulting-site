// Toast Hub Source Detail API - Single source management
import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../_shared/auth.js';

/**
 * GET /api/admin/toast-hub/sources/:id
 * Get single source with import stats
 */
export async function onRequestGet(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const sourceId = context.params.id;

    const source = await db.prepare(`
      SELECT
        s.*,
        COUNT(DISTINCT i.id) as total_imports,
        SUM(CASE WHEN i.status = 'pending' THEN 1 ELSE 0 END) as pending_imports,
        SUM(CASE WHEN i.status = 'approved' THEN 1 ELSE 0 END) as approved_imports,
        SUM(CASE WHEN i.status = 'rejected' THEN 1 ELSE 0 END) as rejected_imports
      FROM toast_hub_sources s
      LEFT JOIN toast_hub_imports i ON s.id = i.source_id
      WHERE s.id = ?
      GROUP BY s.id
    `).bind(sourceId).first();

    if (!source) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Source not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get recent imports from this source
    const { results: recentImports } = await db.prepare(`
      SELECT id, title, status, created_at
      FROM toast_hub_imports
      WHERE source_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).bind(sourceId).all();

    return new Response(JSON.stringify({
      success: true,
      data: {
        ...source,
        recent_imports: recentImports || []
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * PUT /api/admin/toast-hub/sources/:id
 * Update source settings
 */
export async function onRequestPut(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const sourceId = context.params.id;
    const body = await context.request.json();
    const now = Math.floor(Date.now() / 1000);

    const updates = [];
    const params = [];

    if (body.name !== undefined) {
      updates.push('name = ?');
      params.push(body.name);
    }
    if (body.feed_url !== undefined) {
      updates.push('feed_url = ?');
      params.push(body.feed_url);
    }
    if (body.category_id !== undefined) {
      updates.push('category_id = ?');
      params.push(body.category_id);
    }
    if (body.fetch_frequency_minutes !== undefined) {
      updates.push('fetch_frequency_minutes = ?');
      params.push(body.fetch_frequency_minutes);
    }
    if (body.is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(body.is_active ? 1 : 0);
      // Reset failures when re-enabling
      if (body.is_active) {
        updates.push('consecutive_failures = 0', 'last_error = NULL');
      }
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No updates provided'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(sourceId);

    await db.prepare(`
      UPDATE toast_hub_sources SET ${updates.join(', ')} WHERE id = ?
    `).bind(...params).run();

    const updated = await db.prepare('SELECT * FROM toast_hub_sources WHERE id = ?').bind(sourceId).first();

    return new Response(JSON.stringify({
      success: true,
      data: updated
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * DELETE /api/admin/toast-hub/sources/:id
 */
export async function onRequestDelete(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const sourceId = context.params.id;

    // Check for imports using this source
    const importCount = await db.prepare(`
      SELECT COUNT(*) as count FROM toast_hub_imports WHERE source_id = ?
    `).bind(sourceId).first();

    if (importCount && importCount.count > 0) {
      return new Response(JSON.stringify({
        success: false,
        error: `Cannot delete source with ${importCount.count} existing imports. Set is_active to 0 instead.`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    await db.prepare('DELETE FROM toast_hub_sources WHERE id = ?').bind(sourceId).run();

    return new Response(JSON.stringify({
      success: true,
      deleted: sourceId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /api/admin/toast-hub/sources/:id
 * Special actions: test fetch, trigger immediate fetch
 */
export async function onRequestPost(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const sourceId = context.params.id;
    const body = await context.request.json();

    const source = await db.prepare('SELECT * FROM toast_hub_sources WHERE id = ?').bind(sourceId).first();
    if (!source) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Source not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Test fetch - validates the feed URL
    if (body.action === 'test') {
      if (!source.feed_url) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Source has no feed_url to test'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        const response = await fetch(source.feed_url, {
          headers: {
            'User-Agent': 'ToastHub-Aggregator/1.0 (R&G Consulting)',
            'Accept': 'application/rss+xml, application/xml, text/xml',
          },
          signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
          return new Response(JSON.stringify({
            success: false,
            error: `Fetch failed: HTTP ${response.status}`
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const text = await response.text();
        const hasItems = text.includes('<item') || text.includes('<entry');

        return new Response(JSON.stringify({
          success: true,
          test_result: {
            status: response.status,
            content_type: response.headers.get('content-type'),
            content_length: text.length,
            has_items: hasItems,
            preview: text.substring(0, 500)
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({
          success: false,
          error: `Fetch error: ${err.message}`
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Unknown action'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
