/**
 * Business Brief Data Context API
 *
 * GET /api/admin/business-brief/data-context
 *
 * Returns aggregated Google sync data:
 * - Recent calendar events
 * - Recent drive documents
 * - Recent communications (Gmail)
 * - Sync health & stats
 */

import { verifyAuth, unauthorizedResponse, getCorsOrigin, handleOptions } from '../../../_shared/auth.js';

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    const db = env.DB;
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10');

    // Fetch recent calendar events from context_items
    let calendarEvents = [];
    try {
      const calResult = await db.prepare(`
        SELECT id, content, summary, timestamp, source, tags, relevance_score
        FROM context_items
        WHERE (source = 'google_calendar' OR type = 'meeting' OR item_type = 'meeting')
          AND privacy_level IN ('business', 'public')
        ORDER BY timestamp DESC
        LIMIT ?
      `).bind(limit).all();
      calendarEvents = calResult.results || [];
    } catch (e) {
      console.log('Calendar query error:', e.message);
    }

    // Fetch recent drive documents from context_items
    let driveDocuments = [];
    try {
      const driveResult = await db.prepare(`
        SELECT id, content, summary, timestamp, source, tags, relevance_score
        FROM context_items
        WHERE (source = 'google_drive' OR type = 'document' OR item_type = 'document')
          AND privacy_level IN ('business', 'public')
        ORDER BY timestamp DESC
        LIMIT ?
      `).bind(limit).all();
      driveDocuments = driveResult.results || [];
    } catch (e) {
      console.log('Drive query error:', e.message);
    }

    // Fetch recent communications
    let communications = [];
    try {
      const commsResult = await db.prepare(`
        SELECT
          sc.id, sc.type, sc.direction, sc.summary,
          sc.content_snippet, sc.occurred_at, sc.source_id,
          sc.privacy_level,
          sk.name as contact_name, sk.company as contact_company, sk.email as contact_email
        FROM synced_communications sc
        LEFT JOIN synced_contacts sk ON sc.contact_id = sk.id
        WHERE sc.privacy_level IN ('business', 'public')
        ORDER BY sc.occurred_at DESC
        LIMIT ?
      `).bind(limit).all();
      communications = commsResult.results || [];
    } catch (e) {
      console.log('Communications query error:', e.message);
    }

    // Fetch email replies stats (from our response pipeline)
    let replyStats = { total: 0, human: 0, unprocessed: 0 };
    try {
      const replyResult = await db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN classification IN ('human_positive','human_negative','human_info') THEN 1 ELSE 0 END) as human,
          SUM(CASE WHEN processed = 0 THEN 1 ELSE 0 END) as unprocessed
        FROM email_replies
      `).first();
      if (replyResult) {
        replyStats = {
          total: replyResult.total || 0,
          human: replyResult.human || 0,
          unprocessed: replyResult.unprocessed || 0
        };
      }
    } catch (e) {
      console.log('Reply stats error:', e.message);
    }

    // Sync health stats
    let syncHealth = { sources: [], lastSync: null, totalItems: 0 };
    try {
      // Count items by source
      const sourceStats = await db.prepare(`
        SELECT source, COUNT(*) as count, MAX(timestamp) as last_item
        FROM context_items
        WHERE privacy_level IN ('business', 'public')
        GROUP BY source
        ORDER BY last_item DESC
      `).all();

      const commsCount = await db.prepare(`
        SELECT COUNT(*) as count, MAX(occurred_at) as last_item
        FROM synced_communications
        WHERE privacy_level IN ('business', 'public')
      `).first();

      const contactsCount = await db.prepare(`
        SELECT COUNT(*) as count
        FROM synced_contacts
      `).first();

      syncHealth = {
        sources: (sourceStats.results || []).map(s => ({
          name: s.source || 'unknown',
          count: s.count,
          lastSync: s.last_item
        })),
        communications: {
          count: commsCount?.count || 0,
          lastSync: commsCount?.last_item || null
        },
        contacts: contactsCount?.count || 0,
        totalItems: (sourceStats.results || []).reduce((sum, s) => sum + s.count, 0) + (commsCount?.count || 0)
      };
    } catch (e) {
      console.log('Sync health error:', e.message);
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        calendar: calendarEvents.map(e => ({
          id: e.id,
          title: e.summary || e.content?.substring(0, 100) || 'Untitled Event',
          content: e.content,
          date: e.timestamp,
          source: e.source,
          tags: e.tags
        })),
        drive: driveDocuments.map(d => ({
          id: d.id,
          title: d.summary || d.content?.substring(0, 100) || 'Untitled Doc',
          content: d.content,
          date: d.timestamp,
          source: d.source,
          tags: d.tags
        })),
        communications: communications.map(c => ({
          id: c.id,
          // BB-8 fix: Infer type from content/summary when type is generic 'meeting'
          type: inferCommunicationType(c.type, c.summary, c.content_snippet, c.source_id),
          direction: c.direction,
          summary: c.summary,
          snippet: c.content_snippet,
          date: c.occurred_at,
          contact: c.contact_name ? {
            name: c.contact_name,
            company: c.contact_company,
            email: c.contact_email
          } : null
        })),
        replyStats,
        syncHealth
      }
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('Data context error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: getCorsHeaders(request) });
  }
}

export async function onRequestOptions(context) {
  return handleOptions(context.request);
}

/**
 * BB-8 fix: Infer communication type from content when stored type is generic
 */
function inferCommunicationType(storedType, summary, snippet, sourceId) {
  // If type is already specific, use it
  if (storedType && storedType !== 'meeting' && storedType !== 'other' && storedType !== 'unknown') {
    return storedType;
  }

  const content = ((summary || '') + ' ' + (snippet || '') + ' ' + (sourceId || '')).toLowerCase();

  // Check for email indicators
  if (content.includes('email') || content.includes('gmail') || content.includes('@') ||
      content.includes('inbox') || content.includes('sent mail') || content.includes('subject:')) {
    return 'email';
  }

  // Check for call/phone indicators
  if (content.includes('call') || content.includes('phone') || content.includes('voicemail') ||
      content.includes('dial') || content.includes('rang') || content.includes('missed call')) {
    return 'call';
  }

  // Check for SMS/text indicators
  if (content.includes('sms') || content.includes('text message') || content.includes('imessage') ||
      content.includes('whatsapp') || content.includes('messenger')) {
    return 'sms';
  }

  // Check for document indicators
  if (content.includes('document') || content.includes('google docs') || content.includes('.doc') ||
      content.includes('.pdf') || content.includes('spreadsheet') || content.includes('sheet') ||
      content.includes('drive') || content.includes('file')) {
    return 'document';
  }

  // Check for browsing/web indicators
  if (content.includes('http') || content.includes('dashboard') || content.includes('website') ||
      content.includes('browser') || content.includes('chrome') || content.includes('tab')) {
    return 'browsing';
  }

  // Check for actual meeting indicators
  if (content.includes('zoom') || content.includes('meet') || content.includes('calendar') ||
      content.includes('schedule') || content.includes('appointment') || content.includes('conference')) {
    return 'meeting';
  }

  // Default to the stored type or 'activity'
  return storedType || 'activity';
}
