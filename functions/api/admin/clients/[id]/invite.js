/**
 * Admin Client Invite API
 *
 * POST /api/admin/clients/[id]/invite
 *
 * Sends a portal invite email to a client with a magic link.
 * Only admins can send invites.
 */

import jwt from '@tsndr/cloudflare-worker-jwt';
import { verifyAuth, unauthorizedResponse, getCorsOrigin, handleOptions } from '../../../../_shared/auth.js';

const INVITE_EXPIRY = 7 * 24 * 60 * 60; // 7 days

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    // Verify admin authentication
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error, request);
    }

    const db = env.DB;
    const { id } = params;

    // Get client info
    const client = await db.prepare(`
      SELECT id, email, name, company, slug, portal_enabled
      FROM clients
      WHERE id = ?
    `).bind(id).first();

    if (!client) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Client not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    if (!client.email) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Client has no email address configured'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (!client.slug) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Client has no portal slug configured. Set a slug first.'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Ensure portal is enabled
    if (!client.portal_enabled) {
      // Auto-enable portal for invited clients
      await db.prepare(`
        UPDATE clients SET portal_enabled = 1 WHERE id = ?
      `).bind(id).run();
    }

    // Generate magic link token (7 day expiry for invites)
    const jwtSecret = env.CLIENT_JWT_SECRET || env.JWT_SECRET || env.ADMIN_PASSWORD_HASH;
    if (!jwtSecret) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Server configuration error'
      }), {
        status: 500,
        headers: corsHeaders
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const token = await jwt.sign({
      clientId: client.id,
      email: client.email,
      slug: client.slug,
      type: 'magic_link',
      invite: true,
      iat: now,
      exp: now + INVITE_EXPIRY
    }, jwtSecret);

    // Build invite URL
    const baseUrl = env.SITE_URL || 'https://ccrestaurantconsulting.com';
    const inviteUrl = `${baseUrl}/#/portal/${client.slug}/login?token=${token}`;

    // Send invite email via Resend
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
            from: 'Cape Cod Restaurant Consulting <noreply@ccrestaurantconsulting.com>',
            to: [client.email],
            subject: `Welcome to Your ${client.company} Portal`,
            html: generateClientInviteEmail(client.name, client.company, inviteUrl)
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
      // Log for development
      console.log('Client invite link (dev mode):', inviteUrl);
    }

    // Update last_invited_at timestamp
    await db.prepare(`
      UPDATE clients SET last_invited_at = ? WHERE id = ?
    `).bind(now, id).run();

    return new Response(JSON.stringify({
      success: true,
      message: emailSent
        ? `Invite sent to ${client.email}`
        : 'Invite generated (email service not configured)',
      inviteUrl: emailSent ? undefined : inviteUrl // Only return URL in dev mode
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Client invite error:', error);
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
  return handleOptions(context.request);
}

function generateClientInviteEmail(name, company, inviteUrl) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Welcome to Your Client Portal</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
      <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #1e293b; margin-bottom: 8px; font-size: 24px;">
            Cape Cod Restaurant Consulting
          </h1>
          <p style="color: #64748b; margin: 0;">Client Portal</p>
        </div>

        <p style="color: #334155; font-size: 16px; line-height: 1.6;">
          Hi ${name || 'there'},
        </p>

        <p style="color: #334155; font-size: 16px; line-height: 1.6;">
          Your client portal for <strong>${company}</strong> is ready! Click the button below to access it:
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${inviteUrl}"
             style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 16px;">
            Access Your Portal
          </a>
        </div>

        <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
          This link expires in 7 days. After your first login, you can request new login links anytime.
        </p>

        <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
          <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin-bottom: 8px;">
            <strong>In your portal you can:</strong>
          </p>
          <ul style="color: #64748b; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
            <li>View your support plan details</li>
            <li>Submit and track support tickets</li>
            <li>Access shared documents and files</li>
            <li>View project status and updates</li>
            <li>Manage billing and invoices</li>
          </ul>
        </div>

        <p style="color: #94a3b8; font-size: 12px; margin-top: 32px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px;">
          Cape Cod Restaurant Consulting | R&G Consulting LLC<br>
          Cape Cod, MA | ccrestaurantconsulting.com
        </p>
      </div>
    </body>
    </html>
  `;
}
