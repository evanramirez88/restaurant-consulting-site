/**
 * Contract Generation API
 *
 * POST /api/contracts/generate
 *
 * Creates a contract from a quote using PandaDoc.
 * This endpoint is called after a client accepts a quote.
 *
 * Request Body:
 * {
 *   client: { id, name, company, email, phone, address },
 *   quote: { summary, items, timeEstimate },
 *   serviceType: 'implementation' | 'support' | 'remote' | 'local',
 *   sendImmediately: boolean (default: true)
 * }
 *
 * Response:
 * {
 *   success: true,
 *   contract: { id, name, status, signingUrl? },
 *   message: string
 * }
 */

import {
  isPandaDocEnabled,
  createContractFromQuote,
  createAndSendContract,
  getTemplateId,
  getSigningLink
} from '../_shared/pandadoc.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // Check if PandaDoc is configured
    if (!isPandaDocEnabled(env)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Contract generation not configured',
        fallback: 'square_invoice',
        message: 'PandaDoc is not configured. Use Square invoice with terms instead.'
      }), {
        status: 503,
        headers: corsHeaders
      });
    }

    // Parse request body
    const data = await request.json();

    // Validate required fields
    if (!data.client || !data.client.email) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Client information with email is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (!data.quote || !data.quote.summary) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Quote data is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const serviceType = data.serviceType || 'implementation';
    const templateId = getTemplateId(env, serviceType);

    if (!templateId) {
      return new Response(JSON.stringify({
        success: false,
        error: `No template configured for service type: ${serviceType}`,
        hint: 'Set PANDADOC_TEMPLATE_IMPLEMENTATION in Cloudflare secrets'
      }), {
        status: 500,
        headers: corsHeaders
      });
    }

    let result;
    const sendImmediately = data.sendImmediately !== false;

    if (sendImmediately) {
      // Create and send in one step
      result = await createAndSendContract(env, {
        templateId,
        client: data.client,
        quote: data.quote,
        serviceType
      });
    } else {
      // Just create the document (draft)
      result = {
        document: await createContractFromQuote(env, {
          templateId,
          client: data.client,
          quote: data.quote,
          serviceType
        }),
        status: 'draft'
      };
    }

    // Optionally get embedded signing link
    let signingUrl = null;
    if (data.embedded && result.document?.id) {
      try {
        const session = await getSigningLink(env, result.document.id, data.client.email);
        signingUrl = session.url;
      } catch (e) {
        console.warn('Could not generate signing link:', e.message);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      contract: {
        id: result.document?.id,
        name: result.document?.name,
        status: result.status,
        signingUrl
      },
      message: sendImmediately
        ? 'Contract created and sent for signature'
        : 'Contract created as draft'
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Contract generation error:', error);

    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to generate contract',
      details: error.details
    }), {
      status: error.status || 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}
