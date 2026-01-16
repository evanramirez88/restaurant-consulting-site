/**
 * Data Sync API for Intelligence Dashboard
 *
 * POST /api/admin/intelligence/sync - Trigger data synchronization
 * GET /api/admin/intelligence/sync - Get sync status
 *
 * Syncs data from:
 * - HubSpot CRM (contacts, deals)
 * - Internal leads to client profiles
 * - Recalculates lead scores
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json().catch(() => ({}));
    const syncType = body.type || 'all';

    const results = {
      lead_scores_updated: 0,
      profiles_created: 0,
      hubspot_synced: 0,
      errors: [],
    };

    // 1. Recalculate lead scores
    if (syncType === 'all' || syncType === 'scores') {
      const scoreResult = await recalculateLeadScores(env);
      results.lead_scores_updated = scoreResult.updated;
      if (scoreResult.error) results.errors.push(scoreResult.error);
    }

    // 2. Create/update client profiles for clients without them
    if (syncType === 'all' || syncType === 'profiles') {
      const profileResult = await syncClientProfiles(env);
      results.profiles_created = profileResult.created;
      if (profileResult.error) results.errors.push(profileResult.error);
    }

    // 3. Sync from HubSpot if API key available
    if ((syncType === 'all' || syncType === 'hubspot') && env.HUBSPOT_API_KEY) {
      const hubspotResult = await syncFromHubSpot(env);
      results.hubspot_synced = hubspotResult.synced;
      if (hubspotResult.error) results.errors.push(hubspotResult.error);
    }

    // 4. Update intelligence stats cache
    await updateStatsCache(env);

    return Response.json({
      success: results.errors.length === 0,
      results,
      synced_at: Date.now(),
      message: `Sync completed: ${results.lead_scores_updated} scores updated, ${results.profiles_created} profiles created`,
    });
  } catch (error) {
    console.error('Sync error:', error);
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

export async function onRequestGet(context) {
  const { env } = context;

  try {
    // Get last sync info
    const syncStatus = await env.DB.prepare(`
      SELECT
        (SELECT COUNT(*) FROM restaurant_leads) as total_leads,
        (SELECT COUNT(*) FROM clients) as total_clients,
        (SELECT COUNT(*) FROM client_profiles) as total_profiles,
        (SELECT COUNT(*) FROM client_atomic_facts WHERE status = 'pending') as pending_facts,
        (SELECT MAX(created_at) FROM file_imports) as last_import,
        (SELECT MAX(created_at) FROM research_sessions) as last_research
    `).first();

    // Check HubSpot connection
    const hubspotConfigured = !!env.HUBSPOT_API_KEY;

    return Response.json({
      success: true,
      status: {
        total_leads: syncStatus?.total_leads || 0,
        total_clients: syncStatus?.total_clients || 0,
        total_profiles: syncStatus?.total_profiles || 0,
        pending_facts: syncStatus?.pending_facts || 0,
        last_import: syncStatus?.last_import,
        last_research: syncStatus?.last_research,
        hubspot_configured: hubspotConfigured,
      },
    });
  } catch (error) {
    console.error('Sync status error:', error);
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

async function recalculateLeadScores(env) {
  try {
    // Lead scoring algorithm based on available data
    // +30 for email, +20 for phone, +10 for US, +10 for company name,
    // +15 for food vertical, +15 for recent activity

    const result = await env.DB.prepare(`
      UPDATE restaurant_leads
      SET lead_score = (
        CASE WHEN email IS NOT NULL AND email != '' THEN 30 ELSE 0 END +
        CASE WHEN phone IS NOT NULL AND phone != '' THEN 20 ELSE 0 END +
        CASE WHEN country = 'US' OR country IS NULL THEN 10 ELSE 0 END +
        CASE WHEN company_name IS NOT NULL AND company_name != '' THEN 10 ELSE 0 END +
        CASE WHEN vertical LIKE '%Food%' OR vertical LIKE '%Restaurant%' THEN 15 ELSE 5 END +
        CASE
          WHEN updated_at > unixepoch() - 7776000 THEN 15
          WHEN updated_at > unixepoch() - 15552000 THEN 10
          WHEN updated_at > unixepoch() - 31104000 THEN 5
          ELSE 0
        END
      )
      WHERE lead_score IS NULL OR lead_score = 0
    `).run();

    return { updated: result.changes || 0 };
  } catch (error) {
    return { updated: 0, error: `Score calculation failed: ${error.message}` };
  }
}

async function syncClientProfiles(env) {
  try {
    // Find clients without profiles
    const clientsWithoutProfiles = await env.DB.prepare(`
      SELECT c.id, c.name, c.company, c.email, c.phone
      FROM clients c
      LEFT JOIN client_profiles cp ON c.id = cp.client_id
      WHERE cp.id IS NULL
    `).all();

    let created = 0;

    for (const client of (clientsWithoutProfiles.results || [])) {
      const profileId = 'profile_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);

      // Try to find matching lead data
      const leadData = await env.DB.prepare(`
        SELECT current_pos, city, state, vertical, revenue_estimate, employee_estimate
        FROM restaurant_leads
        WHERE email = ? OR company_name = ?
        LIMIT 1
      `).bind(client.email, client.company).first();

      await env.DB.prepare(`
        INSERT INTO client_profiles (
          id, client_id, pos_system, cuisine_type, estimated_revenue_tier,
          employee_count, client_score, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 50, unixepoch(), unixepoch())
      `).bind(
        profileId,
        client.id,
        leadData?.current_pos || null,
        leadData?.vertical || null,
        mapRevenueTier(leadData?.revenue_estimate),
        leadData?.employee_estimate || null
      ).run();

      created++;
    }

    return { created };
  } catch (error) {
    return { created: 0, error: `Profile sync failed: ${error.message}` };
  }
}

function mapRevenueTier(estimate) {
  if (!estimate) return null;
  const lower = estimate.toLowerCase();
  if (lower.includes('5m') || lower.includes('5 m') || lower.includes('over')) return 'over_5m';
  if (lower.includes('2m') || lower.includes('2 m')) return '2m_5m';
  if (lower.includes('1m') || lower.includes('1 m')) return '1m_2m';
  if (lower.includes('500k') || lower.includes('500 k')) return '500k_1m';
  return 'under_500k';
}

async function syncFromHubSpot(env) {
  try {
    // Fetch recent contacts from HubSpot
    const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=email,firstname,lastname,company,phone,website', {
      headers: {
        'Authorization': `Bearer ${env.HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return { synced: 0, error: `HubSpot API error: ${error}` };
    }

    const data = await response.json();
    let synced = 0;

    for (const contact of (data.results || [])) {
      const props = contact.properties;
      const email = props.email;

      if (!email) continue;

      // Check if already exists
      const exists = await env.DB.prepare(
        'SELECT id FROM restaurant_leads WHERE email = ?'
      ).bind(email).first();

      if (!exists) {
        const leadId = 'lead_hubspot_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);

        await env.DB.prepare(`
          INSERT INTO restaurant_leads (
            id, company_name, contact_name, email, phone, website,
            source, hubspot_contact_id, lead_score, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'hubspot', ?, 60, unixepoch())
        `).bind(
          leadId,
          props.company || '',
          `${props.firstname || ''} ${props.lastname || ''}`.trim(),
          email,
          props.phone || '',
          props.website || '',
          contact.id
        ).run();

        synced++;
      } else {
        // Update existing lead with HubSpot ID
        await env.DB.prepare(`
          UPDATE restaurant_leads
          SET hubspot_contact_id = ?, hubspot_synced_at = unixepoch()
          WHERE email = ? AND hubspot_contact_id IS NULL
        `).bind(contact.id, email).run();
      }
    }

    return { synced };
  } catch (error) {
    return { synced: 0, error: `HubSpot sync failed: ${error.message}` };
  }
}

async function updateStatsCache(env) {
  // This could update a KV cache with pre-computed stats
  // For now, stats are calculated on-demand in the stats endpoint
  return true;
}
