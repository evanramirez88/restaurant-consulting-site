/**
 * Rep Magic Link API - Send magic link for rep authentication
 *
 * POST /api/rep/:slug/auth/magic-link
 */
import jwt from '@tsndr/cloudflare-worker-jwt';
import { getCorsOrigin } from '../../../../_shared/auth.js';
import { rateLimit, RATE_LIMITS } from '../../../../_shared/rate-limit.js';

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  // Rate limiting - 5 magic links per 5 minutes per IP
  const rateLimitResponse = await rateLimit(
    request,
    env.RATE_LIMIT_KV,
    'rep-magic-link',
    RATE_LIMITS.CONTACT_FORM, // 5 per 5 minutes
    corsHeaders
  );
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const db = env.DB;
    const { slug } = context.params;
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Email is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Find rep by slug and email
    const rep = await db.prepare(`
      SELECT id, email, name, slug
      FROM reps
      WHERE slug = ? AND LOWER(email) = LOWER(?) AND portal_enabled = 1
    `).bind(slug, email).first();

    if (!rep) {
      // Don't reveal whether rep exists or email matches
      // But still return success to prevent email enumeration
      return new Response(JSON.stringify({
        success: true,
        message: 'If an account exists, a login link has been sent.'
      }), {
        headers: corsHeaders
      });
    }

    // Generate magic link token
    const jwtSecret = env.REP_JWT_SECRET || env.JWT_SECRET || env.ADMIN_PASSWORD_HASH;
    if (!jwtSecret) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Server configuration error'
      }), {
        status: 500,
        headers: corsHeaders
      });
    }

    const token = await jwt.sign({
      repId: rep.id,
      email: rep.email,
      slug: rep.slug,
      type: 'magic-link',
      exp: Math.floor(Date.now() / 1000) + (15 * 60) // 15 minutes
    }, jwtSecret);

    // Build magic link URL
    const origin = new URL(context.request.url).origin;
    const magicLink = `${origin}/#/rep/${slug}/login?token=${token}`;

    // Send email with magic link using Resend if configured
    let emailSent = false;
    if (env.RESEND_API_KEY) {
      try {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'R&G Consulting <noreply@ccrestaurantconsulting.com>',
            to: [rep.email],
            subject: 'Your Rep Portal Login Link',
            html: generateMagicLinkEmail(rep.name, magicLink)
          })
        });

        if (emailResponse.ok) {
          emailSent = true;
        } else {
          console.error('Resend API error:', await emailResponse.text());
        }
      } catch (emailError) {
        console.error('Email send error:', emailError);
      }
    } else {
      // Log for development when Resend is not configured
      console.log('RESEND_API_KEY not configured. Magic link for', rep.email, ':', magicLink);
    }

    return new Response(JSON.stringify({
      success: true,
      message: emailSent
        ? 'Magic link sent to your email'
        : 'Login link generated (email service not configured)'
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Magic link error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
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

function generateMagicLinkEmail(name, magicLink) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Rep Portal Login</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
      <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #1e293b; margin-bottom: 8px; font-size: 24px;">
            Rep Portal Login
          </h1>
        </div>

        <p style="color: #334155; font-size: 16px; line-height: 1.6;">
          Hi ${name || 'there'},
        </p>

        <p style="color: #334155; font-size: 16px; line-height: 1.6;">
          Click the button below to sign in to your Rep Portal:
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${magicLink}"
             style="display: inline-block; background: linear-gradient(135deg, #ea580c 0%, #dc2626 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 16px;">
            Sign In to Rep Portal
          </a>
        </div>

        <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
          This link expires in 15 minutes. If you didn't request this, you can safely ignore this email.
        </p>

        <p style="color: #94a3b8; font-size: 12px; margin-top: 32px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px;">
          Cape Cod Restaurant Consulting | R&G Consulting LLC
        </p>
      </div>
    </body>
    </html>
  `;
}
