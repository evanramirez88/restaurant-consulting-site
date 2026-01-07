/**
 * Send Test Email API
 *
 * POST /api/admin/email/templates/send-test
 *
 * Sends a test email using Resend to verify template content
 *
 * Expects body: {
 *   recipient: string,         // Email address to send to
 *   subject: string,           // Already rendered subject
 *   body: string,              // Already rendered body
 *   is_html?: boolean,         // Whether body is HTML
 *   template_id?: string       // Optional template ID for logging
 * }
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../_shared/auth.js';

// Resend API endpoint
const RESEND_API_URL = 'https://api.resend.com/emails';

/**
 * Generate plain text version of email for HTML emails
 */
function generatePlainText(html) {
  // Very simple HTML to text conversion
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Wrap content in email-safe HTML
 */
function wrapHtml(content, isHtml) {
  if (isHtml && (content.includes('<!DOCTYPE') || content.includes('<html'))) {
    return content;
  }

  const bodyContent = isHtml ? content : content.replace(/\n/g, '<br>');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    a { color: #f59e0b; }
    h1, h2, h3 { color: #1a1a1a; }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #f59e0b;
      color: white !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  ${bodyContent}
  <div class="footer">
    <p>This is a test email sent from R&G Consulting Email Admin.</p>
  </div>
</body>
</html>
  `.trim();
}

export async function onRequestPost(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const body = await context.request.json();

    // Validate required fields
    if (!body.recipient) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Recipient email is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.recipient)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid email address format'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Get Resend API key
    const resendApiKey = context.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Email service not configured'
      }), {
        status: 500,
        headers: corsHeaders
      });
    }

    // Prepare email content
    const subject = body.subject || '(No Subject) - Test Email';
    const htmlContent = wrapHtml(body.body || '', body.is_html);
    const textContent = body.is_html ? generatePlainText(body.body || '') : body.body || '';

    // Send via Resend
    const resendPayload = {
      from: 'R&G Consulting <noreply@ccrestaurantconsulting.com>',
      to: [body.recipient],
      subject: `[TEST] ${subject}`,
      html: htmlContent,
      text: textContent,
      tags: [
        { name: 'type', value: 'test' },
        { name: 'template_id', value: body.template_id || 'direct' }
      ]
    };

    const resendResponse = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(resendPayload)
    });

    const resendResult = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('Resend API error:', resendResult);
      return new Response(JSON.stringify({
        success: false,
        error: resendResult.message || 'Failed to send email'
      }), {
        status: 500,
        headers: corsHeaders
      });
    }

    // Log the test email
    try {
      const db = context.env.DB;
      if (db) {
        await db.prepare(`
          INSERT INTO email_logs (id, type, recipient, subject, status, resend_id, created_at)
          VALUES (?, 'test', ?, ?, 'sent', ?, ?)
        `).bind(
          crypto.randomUUID(),
          body.recipient,
          subject,
          resendResult.id,
          Date.now()
        ).run();
      }
    } catch (logError) {
      console.error('Failed to log test email:', logError);
      // Don't fail the request if logging fails
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        message_id: resendResult.id,
        recipient: body.recipient
      }
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Send test email error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to send test email'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
