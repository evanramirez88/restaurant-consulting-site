// Client-Rep Unassignment API
// DELETE /api/admin/clients/:clientId/reps/:repId - Unassign a rep from a client

export async function onRequestDelete(context) {
  try {
    const { env, request, params } = context;
    const { clientId, repId } = params;

    // Check admin auth
    const authCookie = request.headers.get('Cookie')?.match(/admin_session=([^;]+)/)?.[1];
    if (!authCookie) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Delete the assignment
    await env.DB.prepare(`
      DELETE FROM client_rep_assignments
      WHERE client_id = ? AND rep_id = ?
    `).bind(clientId, repId).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Rep unassigned successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Unassign rep error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
