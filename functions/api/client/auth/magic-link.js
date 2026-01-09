/**
 * Client Magic Link Auth Handler
 *
 * POST /api/client/auth/magic-link
 *
 * Sends a magic link email to the client for passwordless login.
 */

import jwt from '@tsndr/cloudflare-worker-jwt';
import { getCorsOrigin } from '../../../_shared/auth.js';
import { rateLimit, RATE_LIMITS } from '../../../_shared/rate-limit.js';

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

// Token expiration: 15 minutes
const TOKEN_EXPIRY = 15 * 60;

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  // Rate limiting - 5 magic links per 5 minutes per IP
  const rateLimitResponse = await rateLimit(
    request,
    env.RATE_LIMIT_KV,
    'magic-link',
    RATE_LIMITS.CONTACT_FORM, // 5 per 5 minutes
    corsHeaders
  );
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const body = await request.json();
    const { email, slug } = body;

    if (!email) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Email is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const db = env.DB;

    // Find client by email
    let client;
    if (slug) {
      // If slug provided, verify client matches
      client = await db.prepare(`
        SELECT id, email, name, company, slug, portal_enabled
        FROM clients
        WHERE LOWER(email) = LOWER(?) AND slug = ?
      `).bind(email, slug).first();
    } else {
      // Find any client with this email
      client = await db.prepare(`
        SELECT id, email, name, company, slug, portal_enabled
        FROM clients
        WHERE LOWER(email) = LOWER(?)
      `).bind(email).first();
    }

    // For security, always respond with success even if client not found
    if (!client || !client.portal_enabled) {
      // Log the attempt but don't reveal if user exists
      console.log('Magic link request for unknown or disabled client:', email);

      return new Response(JSON.stringify({
        success: true,
        message: 'If this email is registered, a login link has been sent.'
      }), {
        status: 200,
        headers: corsHeaders
      });
    }

    // Generate magic link token
    const jwtSecret = env.CLIENT_JWT_SECRET || env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT secret not configured');
    }

    const now = Math.floor(Date.now() / 1000);
    const token = await jwt.sign({
      clientId: client.id,
      email: client.email,
      slug: client.slug,
      type: 'magic_link',
      iat: now,
      exp: now + TOKEN_EXPIRY
    }, jwtSecret);

    // Build magic link URL
    const baseUrl = env.SITE_URL || 'https://ccrestaurantconsulting.com';
    const magicLink = `${baseUrl}/#/portal/${client.slug}/login?token=${token}`;

    // Send email via Resend (or other email provider)
    if (env.RESEND_API_KEY) {
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Cape Cod Restaurant Consulting <portal@ccrestaurantconsulting.com>',
          to: [client.email],
          subject: 'Your Portal Login Link',
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <title>Portal Login</title>
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; padding: 20px;">
              <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div style="background: #0f172a; padding: 24px; text-align: center;">
                  <h1 style="color: #f59e0b; margin: 0; font-size: 24px;">Cape Cod Restaurant Consulting</h1>
                  <p style="color: #94a3b8; margin: 8px 0 0;">Client Portal</p>
                </div>
                <div style="padding: 32px 24px;">
                  <h2 style="color: #1f2937; margin: 0 0 16px;">Hello ${client.name},</h2>
                  <p style="color: #6b7280; line-height: 1.6; margin: 0 0 24px;">
                    Click the button below to sign in to your ${client.company} portal. This link will expire in 15 minutes.
                  </p>
                  <div style="text-align: center; margin: 32px 0;">
                    <a href="${magicLink}" style="display: inline-block; background: #ea580c; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      Sign In to Portal
                    </a>
                  </div>
                  <p style="color: #9ca3af; font-size: 14px; margin: 24px 0 0;">
                    If you didn't request this login link, you can safely ignore this email.
                  </p>
                </div>
                <div style="background: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                    Cape Cod Restaurant Consulting | Cape Cod, MA
                  </p>
                </div>
              </div>
            </body>
            </html>
          `
        })
      });

      if (!emailResponse.ok) {
        console.error('Email send failed:', await emailResponse.text());
        throw new Error('Failed to send email');
      }
    } else {
      // Log the magic link for development
      console.log('Magic link (dev mode):', magicLink);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'If this email is registered, a login link has been sent.'
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Magic link error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to send login link'
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
