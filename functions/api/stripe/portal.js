/**
 * Stripe Customer Portal API
 *
 * POST /api/stripe/portal - Create portal session for self-service management
 *
 * Allows customers to:
 * - Update payment methods
 * - View invoice history
 * - Change subscription plans
 * - Cancel subscription (if allowed by portal config)
 */

import { verifyClientAuth, verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../_shared/auth.js';
import { createPortalSession } from '../_shared/stripe.js';

/**
 * POST /api/stripe/portal
 * Create customer portal session
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // Allow both admin and client auth
    let clientId = null;
    let customerId = null;

    const body = await request.json();

    // Admin can create portal session for any customer
    const adminAuth = await verifyAuth(request, env);
    if (adminAuth.authenticated) {
      customerId = body.customer_id;
      clientId = body.client_id;
    } else {
      // Client auth - can only access own portal
      const clientAuth = await verifyClientAuth(request, env);
      if (!clientAuth.authenticated) {
        return unauthorizedResponse('Authentication required');
      }
      clientId = clientAuth.clientId;
    }

    // Get customer ID from client if not provided
    if (!customerId && clientId) {
      const client = await env.DB.prepare(
        'SELECT stripe_customer_id FROM clients WHERE id = ?'
      ).bind(clientId).first();

      if (!client?.stripe_customer_id) {
        return new Response(JSON.stringify({
          success: false,
          error: 'No Stripe customer found for this client. Please subscribe to a plan first.'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }

      customerId = client.stripe_customer_id;
    }

    if (!customerId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'customer_id is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Determine return URL
    const returnUrl = body.return_url || `${new URL(request.url).origin}/client/billing`;

    // Check commitment status (inform user, but portal config handles restrictions)
    let commitmentInfo = null;
    const commitment = await env.DB.prepare(`
      SELECT commitment_end_date, commitment_fulfilled
      FROM stripe_commitment_tracking
      WHERE stripe_customer_id = ? AND commitment_fulfilled = 0
      ORDER BY created_at DESC LIMIT 1
    `).bind(customerId).first();

    if (commitment) {
      const endDate = new Date(commitment.commitment_end_date);
      if (new Date() < endDate) {
        commitmentInfo = {
          active: true,
          end_date: commitment.commitment_end_date,
          message: `You are within a commitment period until ${endDate.toLocaleDateString()}. Early cancellation may incur fees.`
        };
      }
    }

    // Create portal session
    const session = await createPortalSession(env, {
      customerId,
      returnUrl
    });

    return new Response(JSON.stringify({
      success: true,
      data: {
        url: session.url,
        commitment: commitmentInfo
      }
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Create portal session error:', error);
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
