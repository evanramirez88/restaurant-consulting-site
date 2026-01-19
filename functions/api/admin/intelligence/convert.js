/**
 * Convert Lead to Client API
 *
 * POST /api/admin/intelligence/convert
 * Converts a prospect/lead from restaurant_leads to a client in the clients table
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { lead_id, email, name, company, phone, address, town, state, pos_system } = body;

    if (!lead_id || !email) {
      return new Response(JSON.stringify({
        success: false,
        error: 'lead_id and email are required'
      }), { status: 400, headers: corsHeaders });
    }

    // Generate client ID
    const clientId = 'client_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);

    // Check if client already exists
    const existingClient = await env.DB.prepare(
      'SELECT id FROM clients WHERE email = ?'
    ).bind(email).first();

    if (existingClient) {
      return new Response(JSON.stringify({
        success: false,
        error: 'A client with this email already exists',
        existing_client_id: existingClient.id
      }), { status: 409, headers: corsHeaders });
    }

    // Create the client
    await env.DB.prepare(`
      INSERT INTO clients (
        id, name, email, phone, company, address, city, state,
        notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      clientId,
      name || email.split('@')[0],
      email,
      phone || null,
      company || null,
      address || null,
      town || null,
      state || 'MA',
      pos_system ? `POS: ${pos_system}. Source: Intelligence conversion` : 'Source: Intelligence conversion',
      Date.now(),
      Date.now()
    ).run();

    // Update the lead record to mark it as converted
    await env.DB.prepare(`
      UPDATE restaurant_leads
      SET
        converted_to_client_id = ?,
        status = 'converted',
        updated_at = ?
      WHERE id = ?
    `).bind(clientId, Date.now(), lead_id).run();

    // Log the conversion
    console.log(`Converted lead ${lead_id} to client ${clientId}`);

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully converted ${company || name} to client`,
      client_id: clientId,
      lead_id: lead_id
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('Convert error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: corsHeaders });
  }
}
