// Message Thread Detail API - GET thread with messages, PATCH to update
export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    const { id } = context.params;
    const url = new URL(context.request.url);
    const viewerType = url.searchParams.get('viewerType') || 'admin';
    const viewerId = url.searchParams.get('viewerId');

    // Fetch the thread
    const thread = await db.prepare(`
      SELECT
        mt.*,
        c.name as client_name,
        c.company as client_company,
        c.email as client_email,
        r.name as rep_name,
        r.email as rep_email
      FROM message_threads mt
      LEFT JOIN clients c ON mt.client_id = c.id
      LEFT JOIN reps r ON mt.rep_id = r.id
      WHERE mt.id = ?
    `).bind(id).first();

    if (!thread) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Thread not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check permissions based on viewer type
    if (viewerType === 'client' && viewerId) {
      if (thread.client_id !== viewerId) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Access denied'
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      // Clients can't see private threads
      if (thread.thread_type === 'private') {
        return new Response(JSON.stringify({
          success: false,
          error: 'Access denied'
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (viewerType === 'rep' && viewerId) {
      // Check if rep is assigned to this thread or client
      const assignment = await db.prepare(`
        SELECT 1 FROM client_rep_assignments
        WHERE rep_id = ? AND client_id = ?
      `).bind(viewerId, thread.client_id).first();

      if (thread.rep_id !== viewerId && !assignment) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Access denied'
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Fetch messages based on visibility
    let messagesQuery;
    let messagesBindings = [id];

    if (viewerType === 'admin') {
      // Admin sees all messages
      messagesQuery = `
        SELECT
          m.*,
          CASE m.sender_type
            WHEN 'client' THEN c.name
            WHEN 'rep' THEN r.name
            WHEN 'admin' THEN 'Admin'
            ELSE 'System'
          END as sender_name
        FROM messages m
        LEFT JOIN clients c ON m.sender_type = 'client' AND m.sender_id = c.id
        LEFT JOIN reps r ON m.sender_type = 'rep' AND m.sender_id = r.id
        WHERE m.thread_id = ?
        ORDER BY m.created_at ASC
      `;
    } else if (viewerType === 'client') {
      // Client sees only messages visible to clients
      messagesQuery = `
        SELECT
          m.*,
          CASE m.sender_type
            WHEN 'client' THEN c.name
            WHEN 'rep' THEN r.name
            WHEN 'admin' THEN 'Admin'
            ELSE 'System'
          END as sender_name
        FROM messages m
        LEFT JOIN clients c ON m.sender_type = 'client' AND m.sender_id = c.id
        LEFT JOIN reps r ON m.sender_type = 'rep' AND m.sender_id = r.id
        WHERE m.thread_id = ?
          AND m.visible_to_client = 1
        ORDER BY m.created_at ASC
      `;
    } else if (viewerType === 'rep') {
      // Rep sees only messages visible to reps
      messagesQuery = `
        SELECT
          m.*,
          CASE m.sender_type
            WHEN 'client' THEN c.name
            WHEN 'rep' THEN r.name
            WHEN 'admin' THEN 'Admin'
            ELSE 'System'
          END as sender_name
        FROM messages m
        LEFT JOIN clients c ON m.sender_type = 'client' AND m.sender_id = c.id
        LEFT JOIN reps r ON m.sender_type = 'rep' AND m.sender_id = r.id
        WHERE m.thread_id = ?
          AND m.visible_to_rep = 1
        ORDER BY m.created_at ASC
      `;
    }

    const { results: messages } = await db.prepare(messagesQuery)
      .bind(...messagesBindings)
      .all();

    return new Response(JSON.stringify({
      success: true,
      data: {
        thread,
        messages: messages || []
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to fetch thread:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPatch(context) {
  try {
    const db = context.env.DB;
    const { id } = context.params;
    const body = await context.request.json();

    // Check if thread exists
    const existing = await db.prepare(
      'SELECT * FROM message_threads WHERE id = ?'
    ).bind(id).first();

    if (!existing) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Thread not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const updates = [];
    const bindings = [];

    // Build dynamic update query
    if (body.title !== undefined) {
      updates.push('title = ?');
      bindings.push(body.title);
    }

    if (body.status !== undefined) {
      const validStatuses = ['open', 'pending', 'resolved', 'closed'];
      if (!validStatuses.includes(body.status)) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid status'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      updates.push('status = ?');
      bindings.push(body.status);
    }

    if (body.priority !== undefined) {
      const validPriorities = ['low', 'normal', 'high', 'urgent'];
      if (!validPriorities.includes(body.priority)) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid priority'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      updates.push('priority = ?');
      bindings.push(body.priority);
    }

    if (body.threadType !== undefined) {
      const validTypes = ['ticket', 'project', 'general', 'support', 'private'];
      if (!validTypes.includes(body.threadType)) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid thread type'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      updates.push('thread_type = ?');
      bindings.push(body.threadType);
    }

    if (body.clientId !== undefined) {
      updates.push('client_id = ?');
      bindings.push(body.clientId);
    }

    if (body.repId !== undefined) {
      updates.push('rep_id = ?');
      bindings.push(body.repId);
    }

    if (body.participants !== undefined) {
      updates.push('participants_json = ?');
      bindings.push(JSON.stringify(body.participants));
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No valid updates provided'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Add updated_at
    const now = Math.floor(Date.now() / 1000);
    updates.push('updated_at = ?');
    bindings.push(now);

    // Add ID for WHERE clause
    bindings.push(id);

    await db.prepare(`
      UPDATE message_threads
      SET ${updates.join(', ')}
      WHERE id = ?
    `).bind(...bindings).run();

    // Fetch updated thread
    const thread = await db.prepare(`
      SELECT
        mt.*,
        c.name as client_name,
        c.company as client_company,
        r.name as rep_name
      FROM message_threads mt
      LEFT JOIN clients c ON mt.client_id = c.id
      LEFT JOIN reps r ON mt.rep_id = r.id
      WHERE mt.id = ?
    `).bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: thread
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to update thread:', error);
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
    const db = context.env.DB;
    const { id } = context.params;

    // Check if thread exists
    const existing = await db.prepare(
      'SELECT * FROM message_threads WHERE id = ?'
    ).bind(id).first();

    if (!existing) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Thread not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Delete all messages in the thread first
    await db.prepare('DELETE FROM messages WHERE thread_id = ?').bind(id).run();

    // Delete the thread
    await db.prepare('DELETE FROM message_threads WHERE id = ?').bind(id).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Thread deleted successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to delete thread:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
