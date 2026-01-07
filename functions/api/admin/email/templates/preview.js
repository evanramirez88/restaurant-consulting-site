/**
 * Email Template Preview API
 *
 * POST /api/admin/email/templates/preview - Render template with sample data
 *
 * Expects body: {
 *   subject?: string,
 *   body?: string,
 *   is_html?: boolean,
 *   sample_data?: object  // Optional custom sample data
 * }
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../_shared/auth.js';

// Default sample data for preview
const DEFAULT_SAMPLE_DATA = {
  first_name: 'John',
  last_name: 'Smith',
  company: 'The Seafood Shack',
  email: 'john@seafoodshack.com',
  phone: '508-555-1234',
  unsubscribe_link: 'https://ccrestaurantconsulting.com/unsubscribe/abc123'
};

/**
 * Replace tokens in text with sample data values
 */
function renderTokens(text, sampleData) {
  if (!text) return '';

  let rendered = text;
  Object.entries(sampleData).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    rendered = rendered.replace(regex, value);
  });

  return rendered;
}

/**
 * Wrap plain text in basic HTML for preview
 */
function wrapPlainTextAsHtml(text) {
  // Convert line breaks to <br> tags
  const withBreaks = text.replace(/\n/g, '<br>');

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
      line-height: 1.5;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    a {
      color: #f59e0b;
    }
  </style>
</head>
<body>
  ${withBreaks}
</body>
</html>
  `.trim();
}

/**
 * Wrap HTML content in email-safe wrapper
 */
function wrapHtmlEmail(html) {
  // If the HTML already has a full document structure, return as-is
  if (html.includes('<!DOCTYPE') || html.includes('<html')) {
    return html;
  }

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
      line-height: 1.5;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    a {
      color: #f59e0b;
    }
    h1, h2, h3 {
      color: #1a1a1a;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #f59e0b;
      color: white;
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
  ${html}
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

    // Merge custom sample data with defaults
    const sampleData = {
      ...DEFAULT_SAMPLE_DATA,
      ...(body.sample_data || {})
    };

    // Render subject with tokens
    const renderedSubject = renderTokens(body.subject || '', sampleData);

    // Render body with tokens
    let renderedBody = renderTokens(body.body || '', sampleData);

    // Wrap in appropriate HTML structure
    let htmlPreview;
    if (body.is_html) {
      htmlPreview = wrapHtmlEmail(renderedBody);
    } else {
      htmlPreview = wrapPlainTextAsHtml(renderedBody);
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        subject: renderedSubject,
        body_text: renderedBody,
        body_html: htmlPreview,
        sample_data_used: sampleData
      }
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Template preview error:', error);
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
