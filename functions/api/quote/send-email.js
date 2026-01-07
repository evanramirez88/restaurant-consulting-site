/**
 * Quote Email API - Send quote request to admin
 *
 * POST /api/quote/send-email
 *
 * Stores quote requests in D1 database and can optionally send via email service
 */

import { getCorsOrigin } from '../../_shared/auth.js';
import { rateLimit, RATE_LIMITS } from '../../_shared/rate-limit.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS headers - use dynamic origin for security
  const corsHeaders = {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };

  // Rate limiting - 10 requests per 5 minutes per IP
  const rateLimitResponse = await rateLimit(
    request,
    env.RATE_LIMIT_KV,
    'quote',
    RATE_LIMITS.QUOTE_FORM,
    corsHeaders
  );
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const body = await request.json();
    const { name, email, restaurantName, phone, quoteData, locations, estimate } = body;

    // Validate required fields
    if (!name || !email) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Name and email are required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid email address'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const db = context.env.DB;

    // Ensure table exists
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS quote_requests (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        restaurant_name TEXT,
        phone TEXT,
        quote_data TEXT,
        locations_data TEXT,
        estimate_data TEXT,
        status TEXT DEFAULT 'pending',
        notes TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      )
    `).run();

    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    // Store the quote request
    await db.prepare(`
      INSERT INTO quote_requests (
        id, name, email, restaurant_name, phone,
        quote_data, locations_data, estimate_data,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).bind(
      id,
      name,
      email,
      restaurantName || null,
      phone || null,
      JSON.stringify(quoteData || {}),
      JSON.stringify(locations || []),
      JSON.stringify(estimate || {}),
      now,
      now
    ).run();

    // Try to send email notification if Resend API key is configured
    let emailSent = false;
    if (context.env.RESEND_API_KEY) {
      try {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${context.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'R&G Consulting <noreply@ccrestaurantconsulting.com>',
            to: ['ramirezconsulting.rg@gmail.com'],
            subject: `New Quote Request from ${name}${restaurantName ? ` - ${restaurantName}` : ''}`,
            html: generateQuoteEmailHtml(name, email, restaurantName, phone, estimate, locations)
          })
        });

        if (emailResponse.ok) {
          emailSent = true;
        }
      } catch (emailError) {
        console.error('Email send error:', emailError);
        // Continue even if email fails - quote is still stored
      }
    }

    // Send confirmation email to customer if configured
    if (context.env.RESEND_API_KEY && emailSent) {
      try {
        // Get contact info from environment variables with fallback defaults
        const contactPhone = context.env.CONTACT_PHONE || '17744080083';
        const contactEmail = context.env.CONTACT_EMAIL || 'ramirezconsulting.rg@gmail.com';

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${context.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'R&G Consulting <noreply@ccrestaurantconsulting.com>',
            to: [email],
            subject: 'Your Quote Request - Cape Cod Restaurant Consulting',
            html: generateCustomerConfirmationHtml(name, restaurantName, estimate, contactPhone, contactEmail)
          })
        });
      } catch (err) {
        console.error('Customer confirmation email error:', err);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Quote request received! We\'ll be in touch within 24 hours.',
      requestId: id,
      emailSent
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Quote email error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to process quote request'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions(context) {
  const { request } = context;
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': getCorsOrigin(request),
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    }
  });
}

function generateQuoteEmailHtml(name, email, restaurantName, phone, estimate, locations) {
  const installCost = estimate?.installCost || 0;
  const travelCost = estimate?.travelCost || 0;
  const supportMonthly = estimate?.supportMonthly || 0;
  const totalFirst = estimate?.combinedFirst || 0;

  const locationsList = (locations || []).map(loc => `
    <li style="margin-bottom: 8px;">
      <strong>${loc.name || 'Unnamed Location'}</strong>
      ${loc.address ? `<br><span style="color: #666;">${loc.address}</span>` : ''}
      <br>Floors: ${loc.floors?.length || 1}
      ${loc.integrationIds?.length ? `<br>Integrations: ${loc.integrationIds.length}` : ''}
    </li>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Quote Request</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
      <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #1e293b; margin-bottom: 24px; font-size: 24px;">
          New Quote Request
        </h1>

        <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <h3 style="margin: 0 0 12px 0; color: #475569; font-size: 14px; text-transform: uppercase;">Contact Information</h3>
          <p style="margin: 4px 0;"><strong>Name:</strong> ${name}</p>
          <p style="margin: 4px 0;"><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          ${restaurantName ? `<p style="margin: 4px 0;"><strong>Restaurant:</strong> ${restaurantName}</p>` : ''}
          ${phone ? `<p style="margin: 4px 0;"><strong>Phone:</strong> <a href="tel:${phone}">${phone}</a></p>` : ''}
        </div>

        <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <h3 style="margin: 0 0 12px 0; color: #92400e; font-size: 14px; text-transform: uppercase;">Quote Estimate</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 4px 0;">Installation Cost:</td>
              <td style="text-align: right; font-weight: bold;">$${installCost.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0;">Travel Cost:</td>
              <td style="text-align: right; font-weight: bold;">$${travelCost.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0;">Monthly Support:</td>
              <td style="text-align: right; font-weight: bold;">$${supportMonthly.toFixed(2)}/mo</td>
            </tr>
            <tr style="border-top: 2px solid #d97706;">
              <td style="padding: 8px 0 4px 0; font-weight: bold; color: #92400e;">Total First Month:</td>
              <td style="text-align: right; font-weight: bold; color: #92400e; font-size: 18px;">$${totalFirst.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        ${locations?.length ? `
        <div style="margin-bottom: 24px;">
          <h3 style="margin: 0 0 12px 0; color: #475569; font-size: 14px; text-transform: uppercase;">Locations</h3>
          <ul style="margin: 0; padding-left: 20px; color: #334155;">
            ${locationsList}
          </ul>
        </div>
        ` : ''}

        <div style="text-align: center; margin-top: 24px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
          <a href="mailto:${email}?subject=Re: Your Quote Request"
             style="display: inline-block; background: #ea580c; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold;">
            Reply to Customer
          </a>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateCustomerConfirmationHtml(name, restaurantName, estimate, contactPhone, contactEmail) {
  const totalFirst = estimate?.combinedFirst || 0;

  // Format phone for display and tel link
  const phoneDisplay = contactPhone.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '+$1 ($2) $3-$4');
  const phoneLink = `+${contactPhone}`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Quote Request Received</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
      <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #1e293b; margin-bottom: 8px; font-size: 24px;">
            Thanks for your interest, ${name}!
          </h1>
          <p style="color: #64748b; margin: 0;">We've received your quote request${restaurantName ? ` for ${restaurantName}` : ''}.</p>
        </div>

        <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); border-radius: 12px; padding: 24px; margin-bottom: 24px; color: white;">
          <p style="margin: 0 0 8px 0; font-size: 14px; opacity: 0.8;">Your Estimated Total</p>
          <p style="margin: 0; font-size: 36px; font-weight: bold;">$${totalFirst.toFixed(2)}</p>
          <p style="margin: 8px 0 0 0; font-size: 12px; opacity: 0.7;">Installation + First Month Support</p>
        </div>

        <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #22c55e;">
          <h3 style="margin: 0 0 8px 0; color: #166534; font-size: 16px;">What happens next?</h3>
          <ol style="margin: 0; padding-left: 20px; color: #15803d;">
            <li style="margin-bottom: 4px;">We'll review your floor plan and requirements</li>
            <li style="margin-bottom: 4px;">A consultant will reach out within 24 hours</li>
            <li style="margin-bottom: 4px;">We'll schedule a brief call to finalize details</li>
            <li>You'll receive a formal proposal with next steps</li>
          </ol>
        </div>

        <div style="text-align: center; margin-top: 24px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
          <p style="color: #64748b; font-size: 14px; margin-bottom: 16px;">Questions? We're here to help.</p>
          <a href="tel:${phoneLink}"
             style="display: inline-block; background: #ea580c; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; margin-right: 8px;">
            Call Us
          </a>
          <a href="mailto:${contactEmail}"
             style="display: inline-block; background: #1e293b; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold;">
            Email Us
          </a>
        </div>

        <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 24px;">
          Cape Cod Restaurant Consulting | R&G Consulting LLC
        </p>
      </div>
    </body>
    </html>
  `;
}
