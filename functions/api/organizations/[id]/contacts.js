/**
 * Organization Contacts API
 *
 * GET /api/organizations/:id/contacts - List contacts
 * POST /api/organizations/:id/contacts - Add contact
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

export async function onRequestGet(context) {
  const { params, env } = context;
  const { id } = params;

  try {
    const db = env.DB;

    const contacts = await db.prepare(`
      SELECT * FROM org_contacts
      WHERE organization_id = ?
      ORDER BY is_primary DESC, created_at ASC
    `).bind(id).all();

    return new Response(JSON.stringify({
      success: true,
      data: contacts.results
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Get contacts error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch contacts'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestPost(context) {
  const { params, env, request } = context;
  const { id } = params;

  try {
    const body = await request.json();
    const db = env.DB;

    // Verify organization exists
    const org = await db.prepare('SELECT id FROM organizations WHERE id = ?').bind(id).first();
    if (!org) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Organization not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    const contactId = 'con_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);

    // If this is marked primary, update others
    if (body.is_primary) {
      await db.prepare(`
        UPDATE org_contacts SET is_primary = 0 WHERE organization_id = ?
      `).bind(id).run();
    }

    // Check if this should be primary (first contact)
    const existingCount = await db.prepare(`
      SELECT COUNT(*) as count FROM org_contacts WHERE organization_id = ?
    `).bind(id).first();
    const isPrimary = body.is_primary || existingCount.count === 0 ? 1 : 0;

    // Generate slug if email provided and portal enabled
    let slug = null;
    if (body.portal_enabled && body.email) {
      slug = body.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-');
    }

    await db.prepare(`
      INSERT INTO org_contacts (
        id, organization_id, location_id, first_name, last_name, email, phone,
        title, role_type, is_primary, is_decision_maker,
        portal_enabled, slug, preferred_contact_method, timezone,
        hubspot_contact_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
    `).bind(
      contactId,
      id,
      body.location_id || null,
      body.first_name || null,
      body.last_name || null,
      body.email || null,
      body.phone || null,
      body.title || null,
      body.role_type || 'other',
      isPrimary,
      body.is_decision_maker ? 1 : 0,
      body.portal_enabled ? 1 : 0,
      slug,
      body.preferred_contact_method || 'email',
      body.timezone || 'America/New_York',
      body.hubspot_contact_id || null
    ).run();

    const contact = await db.prepare('SELECT * FROM org_contacts WHERE id = ?').bind(contactId).first();

    return new Response(JSON.stringify({
      success: true,
      data: contact
    }), {
      status: 201,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Create contact error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to create contact'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}
