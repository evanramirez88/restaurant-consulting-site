/**
 * Email Subscribers Import API
 *
 * POST /api/admin/email/subscribers/import - Import subscribers from CSV data
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../_shared/auth.js';

export async function onRequestPost(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const body = await context.request.json();

    const { subscribers, filename } = body;

    if (!subscribers || !Array.isArray(subscribers) || subscribers.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Subscribers array is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Limit batch size
    if (subscribers.length > 500) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Maximum 500 subscribers per import batch'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    let imported = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails = [];

    // Process each subscriber
    for (const subscriber of subscribers) {
      try {
        // Validate email
        if (!subscriber.email || !emailRegex.test(subscriber.email.trim())) {
          errors++;
          errorDetails.push({ email: subscriber.email, error: 'Invalid email format' });
          continue;
        }

        const email = subscriber.email.toLowerCase().trim();

        // Check for duplicate
        const existing = await db.prepare(
          'SELECT id FROM email_subscribers WHERE email = ?'
        ).bind(email).first();

        if (existing) {
          skipped++;
          continue;
        }

        // Prepare tags
        let tags = '[]';
        if (subscriber.tags && Array.isArray(subscriber.tags)) {
          tags = JSON.stringify(subscriber.tags);
        }

        // Insert subscriber
        const id = crypto.randomUUID();

        await db.prepare(`
          INSERT INTO email_subscribers (
            id, email, first_name, last_name, company, phone, pos_system,
            geographic_tier, lead_source, status, engagement_score, tags,
            total_emails_sent, total_emails_opened, total_emails_clicked,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id,
          email,
          subscriber.first_name || null,
          subscriber.last_name || null,
          subscriber.company || null,
          subscriber.phone || null,
          subscriber.pos_system || null,
          subscriber.geographic_tier || null,
          subscriber.lead_source || 'csv_import',
          subscriber.status || 'active',
          subscriber.engagement_score || 50,
          tags,
          0, 0, 0,
          now, now
        ).run();

        imported++;
      } catch (e) {
        errors++;
        errorDetails.push({
          email: subscriber.email,
          error: e.message
        });
      }
    }

    // Log the import
    try {
      const importLogId = crypto.randomUUID();
      await db.prepare(`
        INSERT INTO import_log (
          id, type, filename, total_rows, imported, skipped, errors, created_at
        ) VALUES (?, 'subscribers', ?, ?, ?, ?, ?, ?)
      `).bind(
        importLogId,
        filename || 'unknown.csv',
        subscribers.length,
        imported,
        skipped,
        errors,
        now
      ).run();
    } catch (e) {
      // Import log table might not exist - that's okay
      console.log('Import log skipped:', e.message);
    }

    return new Response(JSON.stringify({
      success: true,
      imported,
      skipped,
      errors,
      total: subscribers.length,
      errorDetails: errorDetails.slice(0, 10) // Only return first 10 errors
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Subscribers import error:', error);
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
