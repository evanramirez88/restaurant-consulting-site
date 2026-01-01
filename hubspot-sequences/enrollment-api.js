/**
 * HubSpot Sequence Enrollment API
 *
 * This Cloudflare Worker handles bulk enrollment of contacts into sequences.
 * Deploy to Cloudflare Workers and call from automation workflows.
 *
 * Endpoint: POST /enroll
 * Body: { sequenceId, contactIds: [...], senderEmail }
 *
 * Prerequisites:
 * - Sequences must be created in HubSpot UI first
 * - Get sequence IDs from HubSpot after creation
 * - HUBSPOT_ACCESS_TOKEN in environment variables
 */

// Sequence ID mapping (UPDATE AFTER CREATING SEQUENCES IN HUBSPOT)
const SEQUENCES = {
  'toast-users-support': 'SEQUENCE_ID_HERE',
  'clover-users-switch': 'SEQUENCE_ID_HERE',
  'square-users-switch': 'SEQUENCE_ID_HERE',
  'new-toast-install': 'SEQUENCE_ID_HERE',
  'past-client-referral': 'SEQUENCE_ID_HERE',
  'non-responder': 'SEQUENCE_ID_HERE'
};

// Your sender email
const SENDER_EMAIL = 'ramirezconsulting.rg@gmail.com';

export default {
  async fetch(request, env) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    try {
      const { sequenceKey, contactIds, senderEmail } = await request.json();

      // Validate inputs
      if (!sequenceKey || !contactIds || !Array.isArray(contactIds)) {
        return new Response(JSON.stringify({
          error: 'Missing required fields: sequenceKey, contactIds (array)'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const sequenceId = SEQUENCES[sequenceKey];
      if (!sequenceId || sequenceId === 'SEQUENCE_ID_HERE') {
        return new Response(JSON.stringify({
          error: `Unknown or unconfigured sequence: ${sequenceKey}. Update SEQUENCES mapping.`
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Enroll each contact
      const results = [];
      const errors = [];

      for (const contactId of contactIds) {
        try {
          const enrollResponse = await fetch(
            'https://api.hubapi.com/automation/v4/sequences/enrollments',
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${env.HUBSPOT_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                sequenceId: sequenceId,
                contactId: contactId.toString(),
                senderEmail: senderEmail || SENDER_EMAIL
              })
            }
          );

          if (enrollResponse.ok) {
            results.push({ contactId, status: 'enrolled' });
          } else {
            const errorData = await enrollResponse.json();
            errors.push({ contactId, error: errorData.message || 'Enrollment failed' });
          }
        } catch (err) {
          errors.push({ contactId, error: err.message });
        }

        // Rate limit: 100 requests per 10 seconds
        await new Promise(r => setTimeout(r, 100));
      }

      return new Response(JSON.stringify({
        success: true,
        enrolled: results.length,
        failed: errors.length,
        results,
        errors
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

/**
 * USAGE EXAMPLE:
 *
 * // Enroll contacts in Toast Users Support sequence
 * fetch('https://your-worker.workers.dev/enroll', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     sequenceKey: 'toast-users-support',
 *     contactIds: ['12345', '67890', '11111'],
 *     senderEmail: 'ramirezconsulting.rg@gmail.com'
 *   })
 * });
 *
 * SETUP STEPS:
 * 1. Create sequences in HubSpot UI using the templates in this folder
 * 2. Get each sequence ID from HubSpot (Settings > Sequences > click sequence > URL contains ID)
 * 3. Update the SEQUENCES object above with real IDs
 * 4. Deploy this worker: wrangler publish
 * 5. Add HUBSPOT_ACCESS_TOKEN to worker secrets
 */
