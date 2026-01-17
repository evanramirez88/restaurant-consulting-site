/**
 * Send Quote via Email with PDF Attachment
 * POST /api/quote/send
 *
 * Sends a quote email to a recipient with an attached PDF summary.
 * Can be called by admins directly or via rep portal with proper auth.
 *
 * Body options:
 *   { quoteId, recipientEmail, recipientName, message? }
 *   { quoteData, recipientEmail, recipientName, message? }
 */

import { verifyAuth, getCorsOrigin, handleOptions as sharedHandleOptions } from '../../_shared/auth.js';
// Note: Pricing constants are defined inline to avoid import issues in Workers environment

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

/**
 * Calculate total price from quote data
 */
function calculateQuoteTotal(quote) {
  let total = 0;

  // Hardware/line items
  if (quote.items && Array.isArray(quote.items)) {
    for (const item of quote.items) {
      total += (item.price || 0) * (item.quantity || 1);
    }
  }

  // Installation cost from summary
  if (quote.summary?.installAfterDiscount) {
    total = quote.summary.installAfterDiscount;
  } else if (quote.summary?.installCost) {
    total = quote.summary.installCost;
  }

  // Add support plan cost
  const supportPrices = {
    core: { monthly: 350, quarterly: 1050, annual: 3850 },
    professional: { monthly: 500, quarterly: 1500, annual: 5500 },
    premium: { monthly: 800, quarterly: 2400, annual: 8800 }
  };

  const tier = (quote.supportTier || 'core').toLowerCase();
  const period = (quote.supportPeriod || 'monthly').toLowerCase();

  if (supportPrices[tier] && supportPrices[tier][period]) {
    total += supportPrices[tier][period];
  }

  // Add go-live support if present
  if (quote.summary?.goLiveSupportCost) {
    total += quote.summary.goLiveSupportCost;
  }

  return Math.round(total * 100) / 100;
}

/**
 * Format currency for display
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Generate the email body HTML
 */
function generateEmailHtml(quote, recipientName, customMessage, quoteNumber) {
  const totalPrice = calculateQuoteTotal(quote);
  const itemCount = quote.items?.length || 0;
  const supportTier = quote.supportTier || 'Core';
  const supportPeriod = quote.supportPeriod || 'Monthly';

  // Format support tier for display
  const tierDisplay = supportTier.charAt(0).toUpperCase() + supportTier.slice(1);
  const periodDisplay = supportPeriod.charAt(0).toUpperCase() + supportPeriod.slice(1);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Custom Quote - R&G Consulting</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 0; background: #f3f4f6; }
    .wrapper { background: #f3f4f6; padding: 20px; }
    .container { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 32px 30px; text-align: center; }
    .header h1 { margin: 0 0 8px 0; font-size: 28px; font-weight: 700; }
    .header p { margin: 0; opacity: 0.9; font-size: 16px; }
    .content { padding: 32px 30px; }
    .greeting { font-size: 18px; margin-bottom: 16px; }
    .message { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0; }
    .quote-summary { background: #f9fafb; padding: 24px; border-radius: 8px; margin: 24px 0; border: 1px solid #e5e7eb; }
    .quote-summary h3 { margin: 0 0 16px 0; color: #374151; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px; }
    .quote-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .quote-row:last-child { border-bottom: none; }
    .quote-label { color: #6b7280; }
    .quote-value { font-weight: 600; color: #1f2937; }
    .total-row { margin-top: 16px; padding-top: 16px; border-top: 2px solid #e5e7eb; }
    .total { font-size: 28px; font-weight: 700; color: #f59e0b; }
    .cta-section { text-align: center; margin: 32px 0; }
    .button { display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; }
    .button:hover { background: linear-gradient(135deg, #d97706 0%, #b45309 100%); }
    .validity { text-align: center; color: #6b7280; font-size: 14px; margin: 16px 0; }
    .help-section { background: #f9fafb; padding: 24px; border-radius: 8px; margin: 24px 0; text-align: center; }
    .help-section p { margin: 0 0 8px 0; }
    .contact-link { color: #f59e0b; text-decoration: none; font-weight: 500; }
    .signature { margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; }
    .signature p { margin: 4px 0; }
    .signature strong { color: #1f2937; }
    .footer { padding: 24px 30px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; background: #f9fafb; }
    .footer a { color: #f59e0b; text-decoration: none; }
    .quote-number { display: inline-block; background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 4px; font-size: 14px; font-weight: 500; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>Your Custom Quote</h1>
        <p>R&G Consulting - Toast POS Solutions</p>
        ${quoteNumber ? `<div style="margin-top: 12px;"><span class="quote-number">Quote #${quoteNumber}</span></div>` : ''}
      </div>
      <div class="content">
        <p class="greeting">Hi ${recipientName || 'there'},</p>

        ${customMessage ? `<div class="message"><p style="margin:0;">${customMessage}</p></div>` : ''}

        <p>Thank you for your interest in our Toast POS services. Please find your customized quote summary below.</p>

        <div class="quote-summary">
          <h3>Quote Summary</h3>
          ${itemCount > 0 ? `
          <div class="quote-row">
            <span class="quote-label">Hardware Items</span>
            <span class="quote-value">${itemCount} items</span>
          </div>
          ` : ''}
          <div class="quote-row">
            <span class="quote-label">Support Plan</span>
            <span class="quote-value">${tierDisplay} (${periodDisplay})</span>
          </div>
          ${quote.summary?.goLiveSupportDays > 0 ? `
          <div class="quote-row">
            <span class="quote-label">Go-Live Support</span>
            <span class="quote-value">${quote.summary.goLiveSupportDays} days</span>
          </div>
          ` : ''}
          ${quote.summary?.discountAmount > 0 ? `
          <div class="quote-row">
            <span class="quote-label">Discount Applied</span>
            <span class="quote-value" style="color: #059669;">-${formatCurrency(quote.summary.discountAmount)}</span>
          </div>
          ` : ''}
          <div class="quote-row total-row">
            <span class="quote-label" style="font-weight: 600; color: #1f2937;">Estimated Total</span>
            <span class="total">${formatCurrency(totalPrice)}</span>
          </div>
        </div>

        <p class="validity">This quote is valid for <strong>30 days</strong> from the date of this email.</p>

        <div class="cta-section">
          <p style="margin-bottom: 16px; color: #6b7280;">Ready to discuss your quote or have questions?</p>
          <a href="https://cal.com/r-g-consulting/consultation" class="button">Schedule a Call</a>
        </div>

        <div class="help-section">
          <p><strong>Need immediate assistance?</strong></p>
          <p>Reply directly to this email or call <a href="tel:+17744080083" class="contact-link">774-408-0083</a></p>
        </div>

        <div class="signature">
          <p>Best regards,</p>
          <p><strong>Evan Ramirez</strong></p>
          <p style="color: #6b7280;">R&G Consulting LLC</p>
          <p style="color: #6b7280;">Cape Cod Restaurant Consulting</p>
        </div>
      </div>
      <div class="footer">
        <p><strong>R&G Consulting LLC</strong></p>
        <p><a href="https://ccrestaurantconsulting.com">ccrestaurantconsulting.com</a></p>
        <p style="margin-top: 8px;">Specializing in Toast POS Implementation & Support</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate PDF HTML content for the quote
 */
function generateQuotePdfHtml(quote, recipientName, quoteNumber) {
  const totalPrice = calculateQuoteTotal(quote);
  const items = quote.items || [];
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Generate item rows
  const itemRows = items.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.name || item.label || 'Item'}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity || 1}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.price || 0)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency((item.price || 0) * (item.quantity || 1))}</td>
    </tr>
  `).join('');

  // Support plan pricing
  const tier = (quote.supportTier || 'core').toLowerCase();
  const period = (quote.supportPeriod || 'monthly').toLowerCase();
  const tierDisplay = tier.charAt(0).toUpperCase() + tier.slice(1);
  const periodDisplay = period.charAt(0).toUpperCase() + period.slice(1);

  const supportPrices = {
    core: { monthly: 350, quarterly: 1050, annual: 3850 },
    professional: { monthly: 500, quarterly: 1500, annual: 5500 },
    premium: { monthly: 800, quarterly: 2400, annual: 8800 }
  };
  const supportCost = supportPrices[tier]?.[period] || 350;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Quote ${quoteNumber || ''} - R&G Consulting</title>
  <style>
    @page { margin: 40px; }
    body { font-family: Arial, Helvetica, sans-serif; line-height: 1.5; color: #1f2937; padding: 40px; font-size: 14px; }
    .header { border-bottom: 3px solid #f59e0b; padding-bottom: 20px; margin-bottom: 30px; }
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; }
    .logo { font-size: 24px; font-weight: bold; color: #f59e0b; margin-bottom: 4px; }
    .tagline { color: #6b7280; font-size: 14px; }
    .quote-info { text-align: right; }
    .quote-info p { margin: 2px 0; }
    .quote-number { font-size: 18px; font-weight: bold; color: #1f2937; }
    h2 { color: #1f2937; font-size: 18px; margin: 24px 0 12px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th { background: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; }
    th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: center; }
    th:last-child { text-align: right; }
    .total-section { background: #fef3c7; padding: 16px; border-radius: 8px; margin: 24px 0; }
    .total-row { display: flex; justify-content: space-between; padding: 8px 0; }
    .total-row.grand-total { border-top: 2px solid #d97706; margin-top: 8px; padding-top: 12px; }
    .total-label { color: #6b7280; }
    .total-value { font-weight: 600; }
    .grand-total .total-label, .grand-total .total-value { color: #92400e; font-size: 18px; font-weight: bold; }
    .terms { margin-top: 32px; padding: 20px; background: #f9fafb; border-radius: 8px; }
    .terms h3 { margin: 0 0 12px 0; font-size: 14px; color: #374151; }
    .terms ul { margin: 0; padding-left: 20px; color: #6b7280; font-size: 12px; }
    .terms li { margin-bottom: 4px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; }
    .footer p { margin: 4px 0; color: #6b7280; font-size: 12px; }
    .footer strong { color: #1f2937; }
    .contact { font-size: 13px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-row">
      <div>
        <div class="logo">R&G Consulting</div>
        <div class="tagline">Toast POS Implementation & Support</div>
      </div>
      <div class="quote-info">
        ${quoteNumber ? `<p class="quote-number">Quote #${quoteNumber}</p>` : ''}
        <p><strong>Date:</strong> ${dateStr}</p>
        <p><strong>Valid Until:</strong> ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
    </div>
  </div>

  <h2>Prepared For</h2>
  <p style="margin: 0;"><strong>${recipientName || 'Valued Customer'}</strong></p>

  ${items.length > 0 ? `
  <h2>Hardware & Equipment</h2>
  <table>
    <tr>
      <th>Item</th>
      <th style="text-align: center;">Qty</th>
      <th style="text-align: right;">Unit Price</th>
      <th style="text-align: right;">Total</th>
    </tr>
    ${itemRows}
  </table>
  ` : ''}

  <h2>Support Plan</h2>
  <table>
    <tr>
      <th>Plan</th>
      <th style="text-align: center;">Billing</th>
      <th style="text-align: right;" colspan="2">Price</th>
    </tr>
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;"><strong>Restaurant Guardian - ${tierDisplay}</strong></td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${periodDisplay}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;" colspan="2">${formatCurrency(supportCost)}</td>
    </tr>
  </table>

  ${quote.summary?.goLiveSupportCost > 0 ? `
  <h2>Go-Live Support</h2>
  <table>
    <tr>
      <th>Service</th>
      <th style="text-align: center;">Days</th>
      <th style="text-align: right;" colspan="2">Price</th>
    </tr>
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">On-Site Opening Support</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${quote.summary.goLiveSupportDays}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;" colspan="2">${formatCurrency(quote.summary.goLiveSupportCost)}</td>
    </tr>
  </table>
  ` : ''}

  <div class="total-section">
    ${quote.summary?.installCost ? `
    <div class="total-row">
      <span class="total-label">Installation Labor</span>
      <span class="total-value">${formatCurrency(quote.summary.installCost)}</span>
    </div>
    ` : ''}
    ${quote.summary?.travelCost > 0 ? `
    <div class="total-row">
      <span class="total-label">Travel</span>
      <span class="total-value">${formatCurrency(quote.summary.travelCost)}</span>
    </div>
    ` : ''}
    ${quote.summary?.discountAmount > 0 ? `
    <div class="total-row">
      <span class="total-label">Discount</span>
      <span class="total-value" style="color: #059669;">-${formatCurrency(quote.summary.discountAmount)}</span>
    </div>
    ` : ''}
    <div class="total-row">
      <span class="total-label">Support Plan (${tierDisplay} ${periodDisplay})</span>
      <span class="total-value">${formatCurrency(supportCost)}</span>
    </div>
    ${quote.summary?.goLiveSupportCost > 0 ? `
    <div class="total-row">
      <span class="total-label">Go-Live Support</span>
      <span class="total-value">${formatCurrency(quote.summary.goLiveSupportCost)}</span>
    </div>
    ` : ''}
    <div class="total-row grand-total">
      <span class="total-label">Estimated Total</span>
      <span class="total-value">${formatCurrency(totalPrice)}</span>
    </div>
  </div>

  <div class="terms">
    <h3>Terms & Conditions</h3>
    <ul>
      <li>Quote valid for 30 days from date of issue</li>
      <li>50% deposit required to schedule installation</li>
      <li>Final payment due upon completion of installation</li>
      <li>Hardware pricing subject to Toast availability</li>
      <li>Support plan billed ${periodDisplay.toLowerCase()} starting after go-live</li>
    </ul>
  </div>

  <div class="footer">
    <p><strong>R&G Consulting LLC</strong></p>
    <p class="contact">Phone: 774-408-0083 | Email: ramirezconsulting.rg@gmail.com</p>
    <p>ccrestaurantconsulting.com</p>
  </div>
</body>
</html>
  `;
}

/**
 * Generate PDF as base64 (stub - returns null until PDF service is integrated)
 *
 * Options for PDF generation:
 * 1. PDFShift API - https://pdfshift.io
 * 2. Browserless API - https://browserless.io
 * 3. html-pdf-node (requires Node runtime)
 * 4. Custom Puppeteer worker
 */
async function generatePdfBase64(html, env) {
  // TODO: Integrate with PDF generation service
  // For now, we'll send the email without a PDF attachment
  // The email includes all the key information inline

  // Future implementation example with PDFShift:
  // if (env.PDFSHIFT_API_KEY) {
  //   const response = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
  //     method: 'POST',
  //     headers: {
  //       'Authorization': `Basic ${btoa(`api:${env.PDFSHIFT_API_KEY}`)}`,
  //       'Content-Type': 'application/json'
  //     },
  //     body: JSON.stringify({ source: html })
  //   });
  //   const buffer = await response.arrayBuffer();
  //   return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  // }

  console.log('[Quote Send] PDF generation not implemented - sending email without attachment');
  return null;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    // Verify auth (admin)
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({
        success: false,
        error: auth.error || 'Unauthorized'
      }), {
        status: 401,
        headers: corsHeaders
      });
    }

    const body = await request.json();
    const { quoteId, quoteData, recipientEmail, recipientName, message } = body;

    // Validate required fields
    if (!recipientEmail) {
      return new Response(JSON.stringify({
        success: false,
        error: 'recipientEmail is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid email address'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Get quote data
    let quote = quoteData;
    let quoteNumber = null;
    let dbQuoteId = quoteId;

    if (quoteId && !quote) {
      // Fetch from database
      const dbQuote = await env.DB.prepare(
        'SELECT * FROM rep_quotes WHERE id = ?'
      ).bind(quoteId).first();

      if (!dbQuote) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Quote not found'
        }), {
          status: 404,
          headers: corsHeaders
        });
      }

      try {
        quote = JSON.parse(dbQuote.quote_data_json);
      } catch (e) {
        quote = dbQuote.quote_data_json;
      }
      quoteNumber = dbQuote.quote_number;
    }

    if (!quote) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Quote data required (provide quoteId or quoteData)'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Check for Resend API key
    if (!env.RESEND_API_KEY) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Email service not configured'
      }), {
        status: 500,
        headers: corsHeaders
      });
    }

    // Generate email HTML
    const emailHtml = generateEmailHtml(quote, recipientName, message, quoteNumber);

    // Generate PDF HTML (for potential future use)
    const pdfHtml = generateQuotePdfHtml(quote, recipientName, quoteNumber);

    // Try to generate PDF attachment
    const pdfBase64 = await generatePdfBase64(pdfHtml, env);

    // Build email payload
    const emailPayload = {
      from: 'R&G Consulting <quotes@ccrestaurantconsulting.com>',
      to: [recipientEmail],
      subject: quoteNumber
        ? `Your Custom Toast POS Quote #${quoteNumber} - R&G Consulting`
        : 'Your Custom Toast POS Quote - R&G Consulting',
      html: emailHtml,
      reply_to: 'ramirezconsulting.rg@gmail.com'
    };

    // Add PDF attachment if generated
    if (pdfBase64) {
      emailPayload.attachments = [{
        filename: quoteNumber
          ? `RG_Consulting_Quote_${quoteNumber}.pdf`
          : `RG_Consulting_Quote_${Date.now()}.pdf`,
        content: pdfBase64
      }];
    }

    // Send email via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailPayload)
    });

    if (!resendResponse.ok) {
      const error = await resendResponse.json().catch(() => ({ message: 'Unknown error' }));
      console.error('[Quote Send] Resend error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message || 'Failed to send email'
      }), {
        status: 500,
        headers: corsHeaders
      });
    }

    const resendData = await resendResponse.json();
    const now = Math.floor(Date.now() / 1000);

    // Update quote status if quoteId provided
    if (dbQuoteId) {
      try {
        await env.DB.prepare(`
          UPDATE rep_quotes
          SET status = 'sent',
              sent_at = ?,
              updated_at = ?,
              last_email_sent_at = ?,
              email_send_count = COALESCE(email_send_count, 0) + 1,
              expires_at = ?
          WHERE id = ? AND (status = 'draft' OR status = 'sent')
        `).bind(
          now,
          now,
          now,
          now + (30 * 24 * 60 * 60), // 30 days from now
          dbQuoteId
        ).run();
      } catch (dbError) {
        console.error('[Quote Send] DB update error:', dbError);
        // Don't fail the request if DB update fails
      }
    }

    // Log the email send (without requiring subscriber_id)
    try {
      const logId = `qe_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
      await env.DB.prepare(`
        INSERT INTO quote_email_logs (
          id, quote_id, email_to, email_from, subject, message_id,
          status, sent_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'sent', ?, ?)
      `).bind(
        logId,
        dbQuoteId || null,
        recipientEmail,
        'quotes@ccrestaurantconsulting.com',
        emailPayload.subject,
        resendData.id,
        now,
        now
      ).run();
    } catch (logError) {
      // Table might not exist yet, that's okay
      console.log('[Quote Send] Email log skipped (table may not exist):', logError.message);
    }

    return new Response(JSON.stringify({
      success: true,
      messageId: resendData.id,
      sentTo: recipientEmail,
      quoteNumber,
      hasPdfAttachment: !!pdfBase64
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('[Quote Send] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to send quote email'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions(context) {
  return sharedHandleOptions(context.request);
}
