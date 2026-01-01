// Single Ticket API
// GET /api/admin/tickets/:ticketId - Get ticket details
// PUT /api/admin/tickets/:ticketId - Update ticket
// DELETE /api/admin/tickets/:ticketId - Delete ticket

export async function onRequestGet(context) {
  try {
    const { env, params } = context;
    const { ticketId } = params;

    // Check admin auth
    const authCookie = context.request.headers.get('Cookie')?.match(/admin_session=([^;]+)/)?.[1];
    if (!authCookie) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const ticket = await env.DB.prepare(`
      SELECT t.*, c.name as client_name, c.company as client_company
      FROM tickets t
      LEFT JOIN clients c ON t.client_id = c.id
      WHERE t.id = ?
    `).bind(ticketId).first();

    if (!ticket) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Ticket not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: ticket
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPut(context) {
  try {
    const { env, request, params } = context;
    const { ticketId } = params;

    // Check admin auth
    const authCookie = request.headers.get('Cookie')?.match(/admin_session=([^;]+)/)?.[1];
    if (!authCookie) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const updates = [];
    const values = [];

    const allowedFields = ['subject', 'description', 'priority', 'status', 'category', 'assigned_to', 'project_id'];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    // Handle resolved_at for status changes
    if (body.status === 'resolved' || body.status === 'closed') {
      updates.push('resolved_at = unixepoch()');
    } else if (body.status) {
      updates.push('resolved_at = NULL');
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No valid fields to update'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    updates.push('updated_at = unixepoch()');
    values.push(ticketId);

    await env.DB.prepare(`
      UPDATE tickets SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run();

    // Fetch updated ticket
    const ticket = await env.DB.prepare(`
      SELECT t.*, c.name as client_name, c.company as client_company
      FROM tickets t
      LEFT JOIN clients c ON t.client_id = c.id
      WHERE t.id = ?
    `).bind(ticketId).first();

    return new Response(JSON.stringify({
      success: true,
      data: ticket
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestDelete(context) {
  try {
    const { env, request, params } = context;
    const { ticketId } = params;

    // Check admin auth
    const authCookie = request.headers.get('Cookie')?.match(/admin_session=([^;]+)/)?.[1];
    if (!authCookie) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await env.DB.prepare('DELETE FROM tickets WHERE id = ?').bind(ticketId).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Ticket deleted'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
