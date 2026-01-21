/**
 * Business Brief Actions API
 *
 * GET  /api/admin/business-brief/actions - List action items
 * POST /api/admin/business-brief/actions - Create or update action
 *
 * Action items are the priority queue of things needing attention
 */

import { verifyAuth, unauthorizedResponse, getCorsOrigin, handleOptions } from '../../../_shared/auth.js';

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

function generateId() {
  return 'act_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * GET /api/admin/business-brief/actions
 * List action items with filtering
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status'); // pending, acknowledged, completed, all
    const priority = url.searchParams.get('priority'); // critical, high, medium, low
    const category = url.searchParams.get('category');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const includeExpired = url.searchParams.get('includeExpired') === 'true';

    const now = Math.floor(Date.now() / 1000);

    // Build query
    let query = `SELECT * FROM business_brief_actions WHERE 1=1`;
    const params = [];

    // Status filter
    if (status && status !== 'all') {
      if (status === 'active') {
        query += ` AND status IN ('pending', 'acknowledged', 'in_progress')`;
      } else {
        query += ` AND status = ?`;
        params.push(status);
      }
    }

    // Priority filter
    if (priority) {
      query += ` AND priority = ?`;
      params.push(priority);
    }

    // Category filter
    if (category) {
      query += ` AND category = ?`;
      params.push(category);
    }

    // Exclude expired unless requested
    if (!includeExpired) {
      query += ` AND (expires_at IS NULL OR expires_at > ?)`;
      params.push(now);
    }

    // Order by priority, then deadline, then created
    query += ` ORDER BY
      CASE priority
        WHEN 'critical' THEN 0
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        ELSE 3
      END,
      CASE WHEN deadline IS NOT NULL THEN 0 ELSE 1 END,
      deadline ASC,
      created_at DESC
    `;

    query += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const actions = await env.DB.prepare(query).bind(...params).all();

    // Get counts by status
    const countQuery = await env.DB.prepare(`
      SELECT
        status,
        COUNT(*) as count
      FROM business_brief_actions
      WHERE (expires_at IS NULL OR expires_at > ?)
      GROUP BY status
    `).bind(now).all();

    const counts = {};
    (countQuery.results || []).forEach(r => {
      counts[r.status] = r.count;
    });

    return new Response(JSON.stringify({
      success: true,
      data: actions.results || [],
      counts: counts,
      pagination: {
        limit,
        offset,
        total: Object.values(counts).reduce((a, b) => a + b, 0)
      }
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Actions list error:', error);
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
 * POST /api/admin/business-brief/actions
 * Create new action or update existing
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const body = await request.json();
    const now = Math.floor(Date.now() / 1000);

    // Handle different operations
    const operation = body.operation || 'create';

    switch (operation) {
      case 'create': {
        // Validate required fields
        if (!body.title || !body.priority || !body.category) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Missing required fields: title, priority, category'
          }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const id = generateId();

        await env.DB.prepare(`
          INSERT INTO business_brief_actions (
            id, priority, category, title, description,
            source_type, source_id, source_link,
            estimated_value, deadline, suggested_action,
            status, auto_generated, expires_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id,
          body.priority,
          body.category,
          body.title,
          body.description || null,
          body.sourceType || 'system',
          body.sourceId || null,
          body.sourceLink || null,
          body.estimatedValue || null,
          body.deadline || null,
          body.suggestedAction || null,
          'pending',
          body.autoGenerated ? 1 : 0,
          body.expiresAt || null,
          now,
          now
        ).run();

        return new Response(JSON.stringify({
          success: true,
          message: 'Action created',
          id: id
        }), {
          headers: corsHeaders
        });
      }

      case 'acknowledge': {
        if (!body.id) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Missing action id'
          }), {
            status: 400,
            headers: corsHeaders
          });
        }

        await env.DB.prepare(`
          UPDATE business_brief_actions
          SET status = 'acknowledged',
              acknowledged_at = ?,
              acknowledged_by = ?,
              updated_at = ?
          WHERE id = ?
        `).bind(now, 'admin', now, body.id).run();

        return new Response(JSON.stringify({
          success: true,
          message: 'Action acknowledged'
        }), {
          headers: corsHeaders
        });
      }

      case 'start': {
        if (!body.id) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Missing action id'
          }), {
            status: 400,
            headers: corsHeaders
          });
        }

        await env.DB.prepare(`
          UPDATE business_brief_actions
          SET status = 'in_progress',
              updated_at = ?
          WHERE id = ?
        `).bind(now, body.id).run();

        return new Response(JSON.stringify({
          success: true,
          message: 'Action started'
        }), {
          headers: corsHeaders
        });
      }

      case 'complete': {
        if (!body.id) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Missing action id'
          }), {
            status: 400,
            headers: corsHeaders
          });
        }

        await env.DB.prepare(`
          UPDATE business_brief_actions
          SET status = 'completed',
              completed_at = ?,
              completed_by = ?,
              updated_at = ?
          WHERE id = ?
        `).bind(now, 'admin', now, body.id).run();

        return new Response(JSON.stringify({
          success: true,
          message: 'Action completed'
        }), {
          headers: corsHeaders
        });
      }

      case 'snooze': {
        if (!body.id || !body.snoozeUntil) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Missing action id or snoozeUntil timestamp'
          }), {
            status: 400,
            headers: corsHeaders
          });
        }

        await env.DB.prepare(`
          UPDATE business_brief_actions
          SET status = 'snoozed',
              snoozed_until = ?,
              updated_at = ?
          WHERE id = ?
        `).bind(body.snoozeUntil, now, body.id).run();

        return new Response(JSON.stringify({
          success: true,
          message: 'Action snoozed'
        }), {
          headers: corsHeaders
        });
      }

      case 'dismiss': {
        if (!body.id) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Missing action id'
          }), {
            status: 400,
            headers: corsHeaders
          });
        }

        await env.DB.prepare(`
          UPDATE business_brief_actions
          SET status = 'dismissed',
              updated_at = ?
          WHERE id = ?
        `).bind(now, body.id).run();

        return new Response(JSON.stringify({
          success: true,
          message: 'Action dismissed'
        }), {
          headers: corsHeaders
        });
      }

      case 'bulk_dismiss': {
        if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Missing or empty ids array'
          }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const placeholders = body.ids.map(() => '?').join(',');
        const query = `UPDATE business_brief_actions SET status = 'dismissed', updated_at = ? WHERE id IN (${placeholders})`;
        await env.DB.prepare(query).bind(now, ...body.ids).run();

        return new Response(JSON.stringify({
          success: true,
          message: `${body.ids.length} actions dismissed`
        }), {
          headers: corsHeaders
        });
      }

      case 'generate': {
        // Generate action items from system state
        const generated = await generateActionItems(env);

        return new Response(JSON.stringify({
          success: true,
          message: `Generated ${generated} action items`
        }), {
          headers: corsHeaders
        });
      }

      default:
        return new Response(JSON.stringify({
          success: false,
          error: `Unknown operation: ${operation}`
        }), {
          status: 400,
          headers: corsHeaders
        });
    }

  } catch (error) {
    console.error('Actions operation error:', error);
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
 * Generate action items from current system state
 */
async function generateActionItems(env) {
  const now = Math.floor(Date.now() / 1000);
  const oneDayAgo = now - 86400;
  const oneWeekAgo = now - 604800;
  const threeDaysAgo = now - 259200;
  let generated = 0;

  // Helper to create action if not exists
  async function createActionIfNotExists(sourceType, sourceId, data) {
    // Check if similar action already exists and is not completed/dismissed
    const existing = await env.DB.prepare(`
      SELECT id FROM business_brief_actions
      WHERE source_type = ? AND source_id = ?
      AND status NOT IN ('completed', 'dismissed')
    `).bind(sourceType, sourceId).first();

    if (existing) return false;

    const id = 'act_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

    await env.DB.prepare(`
      INSERT INTO business_brief_actions (
        id, priority, category, title, description,
        source_type, source_id, source_link,
        estimated_value, deadline, suggested_action,
        status, auto_generated, expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 1, ?, ?, ?)
    `).bind(
      id,
      data.priority,
      data.category,
      data.title,
      data.description || null,
      sourceType,
      sourceId,
      data.sourceLink || null,
      data.estimatedValue || null,
      data.deadline || null,
      data.suggestedAction || null,
      data.expiresAt || (now + 604800), // Default 7 day expiry
      now,
      now
    ).run();

    return true;
  }

  try {
    // 1. Check for failed emails
    const failedEmails = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM email_logs
      WHERE status = 'failed' AND created_at > ?
    `).bind(oneDayAgo).first();

    if (failedEmails?.count > 0) {
      const created = await createActionIfNotExists('email', 'failed_emails_' + Math.floor(now / 86400), {
        priority: 'critical',
        category: 'email',
        title: `${failedEmails.count} emails failed to send`,
        description: 'Email delivery issues detected. Check Resend domain verification and API configuration.',
        sourceLink: '/admin?tab=email&subtab=errors',
        suggestedAction: 'Review failed emails and fix configuration issues'
      });
      if (created) generated++;
    }

    // 2. Check for urgent tickets
    const urgentTickets = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM tickets
      WHERE priority IN ('urgent', 'high')
      AND status IN ('open', 'pending')
    `).first();

    if (urgentTickets?.count > 0) {
      const created = await createActionIfNotExists('ticket', 'urgent_tickets_' + Math.floor(now / 86400), {
        priority: urgentTickets.count > 3 ? 'critical' : 'high',
        category: 'support',
        title: `${urgentTickets.count} high-priority tickets need attention`,
        description: 'Urgent support requests are waiting for response.',
        sourceLink: '/admin?tab=tickets',
        suggestedAction: 'Review and respond to urgent tickets'
      });
      if (created) generated++;
    }

    // 3. Check for leads needing follow-up
    const staleLeads = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM restaurant_leads
      WHERE status = 'contacted'
      AND updated_at < ?
    `).bind(threeDaysAgo).first();

    if (staleLeads?.count > 5) {
      const created = await createActionIfNotExists('lead', 'stale_leads_' + Math.floor(now / 86400), {
        priority: 'medium',
        category: 'leads',
        title: `${staleLeads.count} contacted leads need follow-up`,
        description: 'Leads were contacted but have no recent activity.',
        sourceLink: '/admin?tab=contacts&subtab=leads',
        suggestedAction: 'Schedule follow-up calls or send re-engagement emails'
      });
      if (created) generated++;
    }

    // 4. Check for expiring quotes
    const expiringQuotes = await env.DB.prepare(`
      SELECT COUNT(*) as count, SUM(total_quote) as value FROM quotes
      WHERE status IN ('sent', 'viewed')
      AND valid_until > ?
      AND valid_until < ?
    `).bind(now, now + 604800).first();

    if (expiringQuotes?.count > 0) {
      const created = await createActionIfNotExists('quote', 'expiring_quotes_' + Math.floor(now / 86400), {
        priority: 'high',
        category: 'revenue',
        title: `${expiringQuotes.count} quotes expiring this week`,
        description: `$${(expiringQuotes.value || 0).toLocaleString()} in pipeline at risk of expiring.`,
        estimatedValue: expiringQuotes.value,
        sourceLink: '/admin?tab=overview',
        suggestedAction: 'Follow up with prospects before quotes expire'
      });
      if (created) generated++;
    }

    // 5. Check for hot leads not contacted
    const hotLeads = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM restaurant_leads
      WHERE lead_score >= 80
      AND status IN ('prospect', 'lead')
      AND (last_contacted_at IS NULL OR last_contacted_at < ?)
    `).bind(oneWeekAgo).first();

    if (hotLeads?.count > 0) {
      const created = await createActionIfNotExists('lead', 'hot_leads_' + Math.floor(now / 86400), {
        priority: 'high',
        category: 'leads',
        title: `${hotLeads.count} hot leads (score 80+) not contacted`,
        description: 'High-potential leads are waiting for outreach.',
        estimatedValue: hotLeads.count * 2500, // Estimated value per lead
        sourceLink: '/admin?tab=contacts&subtab=leads',
        suggestedAction: 'Prioritize outreach to highest-scoring leads'
      });
      if (created) generated++;
    }

    // 6. Check automation health
    const automationStatus = await env.DB.prepare(`
      SELECT * FROM automation_server_status WHERE id = 1
    `).first();

    if (automationStatus && !automationStatus.is_online) {
      const created = await createActionIfNotExists('automation', 'offline_' + Math.floor(now / 86400), {
        priority: 'critical',
        category: 'automation',
        title: 'Automation server is offline',
        description: 'Toast automation capabilities are unavailable.',
        sourceLink: '/admin?tab=tools',
        suggestedAction: 'Check automation server status and restart if needed'
      });
      if (created) generated++;
    }

    // 7. Check for pending content (Beacon)
    const pendingContent = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM beacon_content_items
      WHERE status = 'pending'
    `).first().catch(() => null);

    if (pendingContent?.count > 10) {
      const created = await createActionIfNotExists('beacon', 'pending_content_' + Math.floor(now / 86400), {
        priority: 'low',
        category: 'operations',
        title: `${pendingContent.count} content items pending review`,
        description: 'Beacon content queue needs attention for SEO.',
        sourceLink: '/admin?tab=intelligence',
        suggestedAction: 'Review and approve/reject pending content'
      });
      if (created) generated++;
    }

  } catch (error) {
    console.error('Error generating action items:', error);
  }

  return generated;
}

export async function onRequestOptions(context) {
  return handleOptions(context.request);
}
