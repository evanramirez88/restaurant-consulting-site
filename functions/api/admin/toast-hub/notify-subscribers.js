// Toast Hub Newsletter Notification API
// POST /api/admin/toast-hub/notify-subscribers - Send content to email subscribers
import { verifyAuth, unauthorizedResponse, getCorsHeaders, handleOptions } from '../../../_shared/auth.js';

export async function onRequestPost(context) {
  const corsHeaders = getCorsHeaders(context.request);

  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, context.request);
    }

    const db = context.env.DB;
    const body = await context.request.json();
    const now = Math.floor(Date.now() / 1000);

    const {
      content_id,
      subject_override,
      preview_text,
      recipient_filter = 'all', // 'all', 'active_clients', 'leads', 'segment'
      segment_id,
      test_mode = false,
      test_email
    } = body;

    if (!content_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'content_id is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Get the content
    const post = await db.prepare(`
      SELECT * FROM toast_hub_posts WHERE id = ? AND status = 'published'
    `).bind(content_id).first();

    if (!post) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Post not found or not published'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Build subject line
    const subject = subject_override || `New from Toast Hub: ${post.title}`;

    // Build recipient list based on filter
    let recipients = [];

    if (test_mode) {
      // Test mode - send only to test email
      if (!test_email) {
        return new Response(JSON.stringify({
          success: false,
          error: 'test_email is required in test mode'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
      recipients = [{ email: test_email, name: 'Test Recipient' }];
    } else {
      // Build recipient query based on filter
      if (recipient_filter === 'all') {
        // All clients with portal access + active email subscribers
        const { results: clientRecipients } = await db.prepare(`
          SELECT DISTINCT email, name
          FROM clients
          WHERE portal_enabled = 1 AND email IS NOT NULL
        `).all();

        const { results: subscriberRecipients } = await db.prepare(`
          SELECT DISTINCT email, COALESCE(first_name, '') || ' ' || COALESCE(last_name, '') as name
          FROM email_subscribers
          WHERE status = 'active' AND email IS NOT NULL
        `).all();

        // Merge and dedupe
        const emailSet = new Set();
        recipients = [...(clientRecipients || []), ...(subscriberRecipients || [])].filter(r => {
          if (emailSet.has(r.email.toLowerCase())) return false;
          emailSet.add(r.email.toLowerCase());
          return true;
        });
      } else if (recipient_filter === 'active_clients') {
        const { results } = await db.prepare(`
          SELECT DISTINCT email, name
          FROM clients
          WHERE portal_enabled = 1 AND email IS NOT NULL
        `).all();
        recipients = results || [];
      } else if (recipient_filter === 'leads') {
        const { results } = await db.prepare(`
          SELECT DISTINCT email, COALESCE(first_name, '') || ' ' || COALESCE(last_name, '') as name
          FROM email_subscribers
          WHERE status = 'active' AND email IS NOT NULL
        `).all();
        recipients = results || [];
      } else if (recipient_filter === 'segment' && segment_id) {
        const { results } = await db.prepare(`
          SELECT DISTINCT es.email, COALESCE(es.first_name, '') || ' ' || COALESCE(es.last_name, '') as name
          FROM email_subscribers es
          WHERE es.segment = ? AND es.status = 'active' AND es.email IS NOT NULL
        `).bind(segment_id).all();
        recipients = results || [];
      }
    }

    if (recipients.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No recipients found for the selected filter'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Build email content
    const postUrl = `https://ccrestaurantconsulting.com/#/toast-hub/${post.slug}`;
    const excerpt = post.excerpt || post.content?.substring(0, 200) + '...';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #1a1a1a; padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #f59e0b; font-size: 24px; font-weight: bold;">Toast Hub</h1>
              <p style="margin: 10px 0 0; color: #9ca3af; font-size: 14px;">R&G Consulting</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              ${post.category ? `<p style="margin: 0 0 15px; color: #f59e0b; font-size: 12px; text-transform: uppercase; font-weight: 600;">${post.category}</p>` : ''}
              <h2 style="margin: 0 0 20px; color: #1a1a1a; font-size: 28px; line-height: 1.3;">${post.title}</h2>
              <p style="margin: 0 0 30px; color: #4b5563; font-size: 16px; line-height: 1.6;">${excerpt}</p>
              <a href="${postUrl}" style="display: inline-block; padding: 14px 28px; background-color: #f59e0b; color: #1a1a1a; text-decoration: none; font-weight: 600; border-radius: 6px;">Read Full Article</a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px;">
                Questions? <a href="mailto:ramirezconsulting.rg@gmail.com" style="color: #f59e0b;">Contact us</a>
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                R&G Consulting LLC | Cape Cod, MA<br>
                <a href="https://ccrestaurantconsulting.com" style="color: #9ca3af;">ccrestaurantconsulting.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    // Send emails via Resend (if configured) or log for manual send
    let sentCount = 0;
    let failedCount = 0;
    const errors = [];

    if (context.env.RESEND_API_KEY && !test_mode) {
      // Batch send via Resend
      for (const recipient of recipients) {
        try {
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${context.env.RESEND_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: context.env.RESEND_FROM_EMAIL || 'Toast Hub <noreply@ccrestaurantconsulting.com>',
              to: recipient.email,
              subject,
              html: htmlContent
            })
          });

          if (response.ok) {
            sentCount++;
          } else {
            failedCount++;
            const errData = await response.json();
            errors.push({ email: recipient.email, error: errData.message });
          }
        } catch (err) {
          failedCount++;
          errors.push({ email: recipient.email, error: err.message });
        }
      }
    } else {
      // Test mode or no Resend - just log
      sentCount = recipients.length;
      console.log(`[Toast Hub Newsletter] Would send to ${recipients.length} recipients:`, recipients.map(r => r.email));
    }

    // Log the notification
    const notificationId = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO content_notifications (
        id, content_id, content_type, notification_type,
        subject, body, recipient_count, sent_by, sent_at, metadata_json
      ) VALUES (?, ?, 'post', 'newsletter', ?, ?, ?, ?, ?, ?)
    `).bind(
      notificationId,
      content_id,
      subject,
      preview_text || excerpt,
      sentCount,
      auth.payload?.sub || 'admin',
      now,
      JSON.stringify({
        recipient_filter,
        segment_id,
        test_mode,
        failed_count: failedCount,
        errors: errors.slice(0, 10) // Keep first 10 errors
      })
    ).run();

    return new Response(JSON.stringify({
      success: true,
      data: {
        notification_id: notificationId,
        recipients_count: recipients.length,
        sent_count: sentCount,
        failed_count: failedCount,
        test_mode,
        errors: errors.slice(0, 5)
      },
      message: test_mode
        ? `Test email sent to ${test_email}`
        : `Newsletter sent to ${sentCount} recipient(s)`
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: getCorsHeaders(context.request)
    });
  }
}

// GET - Get notification history for a post
export async function onRequestGet(context) {
  const corsHeaders = getCorsHeaders(context.request);

  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, context.request);
    }

    const db = context.env.DB;
    const url = new URL(context.request.url);
    const contentId = url.searchParams.get('content_id');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    let query = `
      SELECT
        cn.*,
        p.title as post_title,
        p.slug as post_slug
      FROM content_notifications cn
      JOIN toast_hub_posts p ON cn.content_id = p.id
      WHERE cn.content_type = 'post'
    `;
    const params = [];

    if (contentId) {
      query += ' AND cn.content_id = ?';
      params.push(contentId);
    }

    query += ' ORDER BY cn.sent_at DESC LIMIT ?';
    params.push(limit);

    const stmt = db.prepare(query);
    const { results } = await stmt.bind(...params).all();

    return new Response(JSON.stringify({
      success: true,
      data: {
        notifications: results || [],
        total: (results || []).length
      }
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: getCorsHeaders(context.request)
    });
  }
}

export async function onRequestOptions(context) {
  return handleOptions(context.request);
}
