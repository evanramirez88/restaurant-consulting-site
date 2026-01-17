/**
 * HubSpot → D1 Contact Sync Endpoint
 * Syncs HubSpot contacts with emails to D1 restaurant_leads table
 * Also enrolls synced contacts into email sequences based on segment/POS
 *
 * POST /api/sync/hubspot-contacts
 * Body: { mode: 'full' | 'incremental', limit?: number, enrollInSequences?: boolean }
 */

import { enrollFromHubSpotSync } from '../_shared/email-enrollment.js';

interface Env {
  DB: D1Database;
  HUBSPOT_API_KEY: string;
}

interface HubSpotContact {
  id: string;
  properties: {
    email?: string;
    firstname?: string;
    lastname?: string;
    company?: string;
    phone?: string;
    rg_segment?: string;
    rg_lead_score?: string;
    rg_current_pos?: string;
    rg_door?: string;
    rg_primary_pain?: string;
    rg_urgency_window?: string;
    rg_source_file?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface SyncResult {
  success: boolean;
  synced: number;
  skipped: number;
  enrolled: number;
  errors: Array<{ id: string; error: string }>;
  total: number;
  hasMore: boolean;
  nextAfter?: string;
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({})) as {
      mode?: string;
      limit?: number;
      after?: string;
      enrollInSequences?: boolean;
    };
    const mode = body.mode || 'incremental';
    const limit = Math.min(body.limit || 100, 100);
    const after = body.after;
    const enrollInSequences = body.enrollInSequences !== false; // Default to true

    // Build HubSpot search request
    const searchBody: any = {
      filterGroups: [{
        filters: [{
          propertyName: 'email',
          operator: 'HAS_PROPERTY'
        }]
      }],
      properties: [
        'email', 'firstname', 'lastname', 'company', 'phone',
        'rg_segment', 'rg_lead_score', 'rg_current_pos', 'rg_door',
        'rg_primary_pain', 'rg_urgency_window', 'rg_source_file'
      ],
      limit,
      sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }]
    };

    if (after) {
      searchBody.after = after;
    }

    // Fetch contacts from HubSpot
    const hubspotResponse = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.HUBSPOT_API_KEY}`
      },
      body: JSON.stringify(searchBody)
    });

    if (!hubspotResponse.ok) {
      const errorText = await hubspotResponse.text();
      return Response.json({ 
        success: false, 
        error: `HubSpot API error: ${hubspotResponse.status}`,
        details: errorText 
      }, { status: 502 });
    }

    const hubspotData = await hubspotResponse.json() as { 
      results: HubSpotContact[]; 
      total: number;
      paging?: { next?: { after: string } };
    };

    let synced = 0;
    let skipped = 0;
    let enrolled = 0;
    const errors: Array<{ id: string; error: string }> = [];

    // Process each contact
    for (const contact of hubspotData.results) {
      const email = contact.properties.email;
      if (!email) {
        skipped++;
        continue;
      }

      try {
        // Build full name
        const firstName = contact.properties.firstname || '';
        const lastName = contact.properties.lastname || '';
        const fullName = `${firstName} ${lastName}`.trim() || email.split('@')[0];

        // Parse lead score
        const leadScore = parseInt(contact.properties.rg_lead_score || '0') || 0;

        // Upsert to restaurant_leads
        await env.DB.prepare(`
          INSERT INTO restaurant_leads (
            hubspot_id, 
            primary_email, 
            name, 
            current_pos, 
            lead_score,
            status,
            source,
            hubspot_synced_at,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, 'lead', 'hubspot', ?, ?, ?)
          ON CONFLICT(hubspot_id) DO UPDATE SET
            primary_email = excluded.primary_email,
            name = excluded.name,
            current_pos = COALESCE(excluded.current_pos, restaurant_leads.current_pos),
            lead_score = CASE WHEN excluded.lead_score > 0 THEN excluded.lead_score ELSE restaurant_leads.lead_score END,
            hubspot_synced_at = excluded.hubspot_synced_at,
            updated_at = excluded.updated_at
        `).bind(
          contact.id,
          email,
          fullName,
          contact.properties.rg_current_pos || null,
          leadScore,
          Date.now(),
          Date.now(),
          Date.now()
        ).run();

        // Update HubSpot contact with D1 lead ID
        const d1Lead = await env.DB.prepare(
          'SELECT id FROM restaurant_leads WHERE hubspot_id = ?'
        ).bind(contact.id).first() as { id: string } | null;

        if (d1Lead) {
          await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contact.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${env.HUBSPOT_API_KEY}`
            },
            body: JSON.stringify({
              properties: {
                d1_lead_id: d1Lead.id,
                d1_synced_at: new Date().toISOString()
              }
            })
          });
        }

        synced++;

        // Enroll in email sequence if enabled
        if (enrollInSequences) {
          try {
            const enrollResult = await enrollFromHubSpotSync(env, contact);
            if (enrollResult.enrolled) {
              enrolled++;
              console.log(`Enrolled ${email} in sequence from HubSpot sync`);
            }
          } catch (enrollErr: any) {
            // Non-critical - log but don't add to errors
            console.log(`Email enrollment skipped for ${email}: ${enrollErr.message}`);
          }
        }
      } catch (e: any) {
        errors.push({ id: contact.id, error: e.message });
      }
    }

    const result: SyncResult = {
      success: true,
      synced,
      skipped,
      enrolled,
      errors,
      total: hubspotData.total,
      hasMore: !!hubspotData.paging?.next?.after,
      nextAfter: hubspotData.paging?.next?.after
    };

    return Response.json(result);

  } catch (error: any) {
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// GET endpoint to check sync status
export async function onRequestGet({ env }: { env: Env }): Promise<Response> {
  try {
    const stats = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total_leads,
        COUNT(CASE WHEN hubspot_id IS NOT NULL THEN 1 END) as hubspot_synced,
        COUNT(CASE WHEN hubspot_synced_at IS NOT NULL THEN 1 END) as recently_synced,
        MAX(hubspot_synced_at) as last_sync_time
      FROM restaurant_leads
    `).first();

    return Response.json({
      success: true,
      stats
    });
  } catch (error: any) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
