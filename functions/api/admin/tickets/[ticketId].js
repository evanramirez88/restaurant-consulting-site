// Single Ticket API
// GET /api/admin/tickets/:ticketId - Get ticket details
// PUT /api/admin/tickets/:ticketId - Update ticket
// DELETE /api/admin/tickets/:ticketId - Delete ticket
import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    const { env, params } = context;
    const { ticketId } = params;

    // Verify authentication
    const auth = await verifyAuth(context.request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
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
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: ticket
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestPut(context) {
  try {
    const { env, request, params } = context;
    const { ticketId } = params;

    // Verify authentication
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const body = await request.json();
    const updates = [];
    const values = [];

    const allowedFields = ['subject', 'description', 'priority', 'status', 'category', 'assigned_to', 'project_id', 'target_date_label'];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    // Handle date fields - convert date strings to unix timestamps
    if (body.due_date !== undefined) {
      if (body.due_date === null || body.due_date === '') {
        updates.push('due_date = NULL');
      } else {
        updates.push('due_date = ?');
        values.push(Math.floor(new Date(body.due_date).getTime() / 1000));
      }
    }

    if (body.target_date !== undefined) {
      if (body.target_date === null || body.target_date === '') {
        updates.push('target_date = NULL');
      } else {
        updates.push('target_date = ?');
        values.push(Math.floor(new Date(body.target_date).getTime() / 1000));
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
        headers: corsHeaders
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
      headers: corsHeaders
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestDelete(context) {
  try {
    const { env, request, params } = context;
    const { ticketId } = params;

    // Verify authentication
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    await env.DB.prepare('DELETE FROM tickets WHERE id = ?').bind(ticketId).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Ticket deleted'
    }), {
      headers: corsHeaders
    });

  } catch (error) {
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
