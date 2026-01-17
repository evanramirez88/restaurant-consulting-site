/**
 * Lead to Client Conversion API
 *
 * Converts a qualified lead into a client profile, copying relevant data
 * and creating initial tracking records.
 *
 * POST /api/leads/convert
 * Body: { lead_id, deal_type?, deal_value?, notes? }
 *
 * GET /api/leads/convert?lead_id=xxx
 * Returns: Lead data and conversion preview
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../_shared/auth.js';

/**
 * Generate a unique client ID
 */
function generateClientId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 6);
  return `cli_${timestamp}${random}`;
}

/**
 * Map restaurant lead data to client structure
 */
function mapLeadToClient(lead) {
  return {
    name: lead.name || lead.dba_name || lead.company_name || 'Unknown',
    business_name: lead.name || lead.dba_name,
    email: lead.primary_email,
    phone: lead.primary_phone,
    address: [lead.address_line1, lead.address_line2].filter(Boolean).join(', '),
    city: lead.city,
    state: lead.state,
    zip: lead.zip,
    website: lead.website_url,

    // Classification data
    service_style: lead.service_style,
    cuisine_type: lead.cuisine_primary,
    bar_program: lead.bar_program,
    menu_complexity: lead.menu_complexity,

    // Operational data
    seat_count: lead.actual_seat_count,
    staff_count: lead.actual_staff_count,

    // POS/Tech data
    current_pos: lead.current_pos,
    online_ordering_provider: lead.online_ordering_provider,
    reservation_provider: lead.reservation_provider,

    // External IDs
    hubspot_id: lead.hubspot_id,
    google_place_id: lead.google_place_id,
    yelp_id: lead.yelp_id,

    // Metadata
    notes: lead.notes,
    tags: lead.tags
  };
}

/**
 * Create client atomic facts from lead data
 */
function generateAtomicFacts(lead, clientId) {
  const facts = [];
  const now = Math.floor(Date.now() / 1000);

  const addFact = (key, value, category = 'general') => {
    if (value) {
      facts.push({
        id: `fact_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        client_id: clientId,
        key,
        value: String(value),
        category,
        source: 'lead_conversion',
        confidence: 0.9,
        created_at: now
      });
    }
  };

  // Business facts
  addFact('business_name', lead.name || lead.dba_name, 'identity');
  addFact('primary_email', lead.primary_email, 'contact');
  addFact('primary_phone', lead.primary_phone, 'contact');
  addFact('website', lead.website_url, 'contact');
  addFact('address', [lead.address_line1, lead.city, lead.state, lead.zip].filter(Boolean).join(', '), 'location');

  // Operational facts
  addFact('service_style', lead.service_style, 'operations');
  addFact('cuisine_type', lead.cuisine_primary, 'operations');
  addFact('bar_program', lead.bar_program, 'operations');
  addFact('seat_count', lead.actual_seat_count, 'operations');
  addFact('staff_count', lead.actual_staff_count, 'operations');

  // Tech facts
  addFact('current_pos', lead.current_pos, 'technology');
  addFact('online_ordering', lead.online_ordering_provider, 'technology');
  addFact('reservations', lead.reservation_provider, 'technology');

  // Lead origin facts
  addFact('lead_source', lead.source, 'acquisition');
  addFact('lead_score_at_conversion', lead.lead_score, 'acquisition');
  addFact('original_lead_id', lead.id, 'acquisition');

  return facts;
}

/**
 * Calculate days in pipeline
 */
function calculateDaysInPipeline(leadCreatedAt) {
  const now = Math.floor(Date.now() / 1000);
  const createdTs = typeof leadCreatedAt === 'number' ? leadCreatedAt : parseInt(leadCreatedAt) || now;
  return Math.floor((now - createdTs) / 86400);
}

/**
 * POST: Convert lead to client
 */
export async function onRequestPost(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const body = await context.request.json();
    const {
      lead_id,
      deal_type = 'support_plan',
      deal_value = 0,
      notes = ''
    } = body;

    if (!lead_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'lead_id is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Fetch the lead
    const lead = await context.env.DB.prepare(`
      SELECT * FROM restaurant_leads WHERE id = ?
    `).bind(lead_id).first();

    if (!lead) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Lead not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Check if already converted
    if (lead.converted_to_client_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Lead already converted',
        existing_client_id: lead.converted_to_client_id
      }), {
        status: 409,
        headers: corsHeaders
      });
    }

    // Generate client ID
    const clientId = generateClientId();
    const now = Math.floor(Date.now() / 1000);

    // Map lead data to client structure
    const clientData = mapLeadToClient(lead);

    // Get segment info
    const segment = await context.env.DB.prepare(`
      SELECT s.name as segment_name
      FROM lead_segment_members lsm
      JOIN lead_segments s ON s.id = lsm.segment_id
      WHERE lsm.lead_id = ?
      ORDER BY lsm.assigned_at DESC
      LIMIT 1
    `).bind(lead_id).first();

    // Count touchpoints (activity log entries)
    const touchpoints = await context.env.DB.prepare(`
      SELECT COUNT(*) as count FROM lead_activity_log WHERE lead_id = ?
    `).bind(lead_id).first();

    // Start transaction: Create client
    await context.env.DB.prepare(`
      INSERT INTO clients (
        id, name, email, phone, address, city, state, zip, website,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).bind(
      clientId,
      clientData.name,
      clientData.email,
      clientData.phone,
      clientData.address,
      clientData.city,
      clientData.state,
      clientData.zip,
      clientData.website,
      now,
      now
    ).run();

    // Create atomic facts
    const atomicFacts = generateAtomicFacts(lead, clientId);
    for (const fact of atomicFacts) {
      try {
        await context.env.DB.prepare(`
          INSERT INTO client_atomic_facts (id, client_id, key, value, category, source, confidence, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          fact.id,
          fact.client_id,
          fact.key,
          fact.value,
          fact.category,
          fact.source,
          fact.confidence,
          fact.created_at
        ).run();
      } catch (factError) {
        // Table might not exist, log and continue
        console.log(`Could not create atomic fact ${fact.key}:`, factError.message);
      }
    }

    // Create conversion record
    const conversionId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    try {
      await context.env.DB.prepare(`
        INSERT INTO lead_conversions (
          id, lead_id, client_id, converted_by, conversion_source,
          initial_deal_value, deal_type, lead_score_at_conversion,
          segment_at_conversion, days_in_pipeline, touchpoints_count, notes
        ) VALUES (?, ?, ?, ?, 'direct', ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        conversionId,
        lead_id,
        clientId,
        auth.user?.id || 'system',
        deal_value,
        deal_type,
        lead.lead_score || 0,
        segment?.segment_name || null,
        calculateDaysInPipeline(lead.created_at),
        touchpoints?.count || 0,
        notes
      ).run();
    } catch (convError) {
      // Table might not exist yet
      console.log('Could not create conversion record:', convError.message);
    }

    // Update lead with conversion reference
    await context.env.DB.prepare(`
      UPDATE restaurant_leads
      SET status = 'client',
          converted_to_client_id = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(clientId, now, lead_id).run();

    // Log activity
    await context.env.DB.prepare(`
      INSERT INTO lead_activity_log (id, lead_id, activity_type, subject, description, performed_by, created_at)
      VALUES (?, ?, 'converted', 'Lead converted to client', ?, ?, ?)
    `).bind(
      `act_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      lead_id,
      `Converted to client ${clientId}. Deal type: ${deal_type}, Value: $${deal_value}`,
      auth.user?.id || 'system',
      now
    ).run();

    return new Response(JSON.stringify({
      success: true,
      client_id: clientId,
      conversion_id: conversionId,
      lead_id,
      client: clientData,
      atomic_facts_created: atomicFacts.length,
      metrics: {
        lead_score_at_conversion: lead.lead_score,
        days_in_pipeline: calculateDaysInPipeline(lead.created_at),
        touchpoints: touchpoints?.count || 0,
        segment: segment?.segment_name || null
      }
    }), {
      status: 201,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Lead conversion error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * GET: Preview conversion / get lead details
 */
export async function onRequestGet(context) {
  try {
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const url = new URL(context.request.url);
    const leadId = url.searchParams.get('lead_id');

    if (!leadId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'lead_id query parameter is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Fetch the lead
    const lead = await context.env.DB.prepare(`
      SELECT * FROM restaurant_leads WHERE id = ?
    `).bind(leadId).first();

    if (!lead) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Lead not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Check if already converted
    if (lead.converted_to_client_id) {
      const existingClient = await context.env.DB.prepare(`
        SELECT * FROM clients WHERE id = ?
      `).bind(lead.converted_to_client_id).first();

      return new Response(JSON.stringify({
        success: true,
        already_converted: true,
        lead,
        client: existingClient
      }), {
        headers: corsHeaders
      });
    }

    // Get segment info
    const segments = await context.env.DB.prepare(`
      SELECT s.id, s.name, lsm.assigned_at, lsm.status
      FROM lead_segment_members lsm
      JOIN lead_segments s ON s.id = lsm.segment_id
      WHERE lsm.lead_id = ?
    `).bind(leadId).all();

    // Get activity count
    const activityCount = await context.env.DB.prepare(`
      SELECT COUNT(*) as count FROM lead_activity_log WHERE lead_id = ?
    `).bind(leadId).first();

    // Get contacts
    const contacts = await context.env.DB.prepare(`
      SELECT * FROM lead_contacts WHERE lead_id = ? AND status = 'active'
    `).bind(leadId).all();

    // Generate preview of what client would look like
    const clientPreview = mapLeadToClient(lead);
    const factsPreview = generateAtomicFacts(lead, 'preview_client_id');

    return new Response(JSON.stringify({
      success: true,
      already_converted: false,
      lead,
      segments: segments.results || [],
      contacts: contacts.results || [],
      activity_count: activityCount?.count || 0,
      days_in_pipeline: calculateDaysInPipeline(lead.created_at),
      conversion_preview: {
        client: clientPreview,
        atomic_facts: factsPreview.map(f => ({ key: f.key, value: f.value, category: f.category }))
      }
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Lead preview error:', error);
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
