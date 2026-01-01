// Send Message API - POST to send a message
export async function onRequestPost(context) {
  try {
    const db = context.env.DB;
    const body = await context.request.json();

    const {
      threadId,
      senderType,
      senderId,
      recipientType,
      recipientId,
      subject,
      body: messageBody,
      bodyFormat = 'text',
      isPrivate = false,
      visibleToClient = true,
      visibleToRep = true,
      attachments
    } = body;

    // Validate required fields
    if (!threadId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Thread ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!messageBody || !messageBody.trim()) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Message body is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!senderType) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Sender type is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate sender type
    const validSenderTypes = ['admin', 'client', 'rep', 'system'];
    if (!validSenderTypes.includes(senderType)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid sender type'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate body format
    const validBodyFormats = ['text', 'html', 'markdown'];
    if (!validBodyFormats.includes(bodyFormat)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid body format'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if thread exists
    const thread = await db.prepare(
      'SELECT * FROM message_threads WHERE id = ?'
    ).bind(threadId).first();

    if (!thread) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Thread not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if thread is closed
    if (thread.status === 'closed') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Cannot send messages to a closed thread'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify sender permissions based on type
    if (senderType === 'client' && senderId) {
      if (thread.client_id !== senderId) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Access denied: You are not a participant in this thread'
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (senderType === 'rep' && senderId) {
      // Check if rep is assigned to this thread or client
      const assignment = await db.prepare(`
        SELECT 1 FROM client_rep_assignments
        WHERE rep_id = ? AND client_id = ?
      `).bind(senderId, thread.client_id).first();

      if (thread.rep_id !== senderId && !assignment) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Access denied: You are not a participant in this thread'
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Determine visibility based on sender type and privacy flag
    let finalVisibleToClient = visibleToClient;
    let finalVisibleToRep = visibleToRep;
    let finalIsPrivate = isPrivate;

    // If message is from client, it should be visible to all
    if (senderType === 'client') {
      finalVisibleToClient = true;
      finalVisibleToRep = true;
      finalIsPrivate = false;
    }

    // If message is private (admin to rep or rep to admin), hide from client
    if (finalIsPrivate) {
      finalVisibleToClient = false;
    }

    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    await db.prepare(`
      INSERT INTO messages (
        id, thread_id, sender_type, sender_id, recipient_type, recipient_id,
        subject, body, body_format, is_private, visible_to_client, visible_to_rep,
        attachments_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      threadId,
      senderType,
      senderId || null,
      recipientType || null,
      recipientId || null,
      subject || null,
      messageBody.trim(),
      bodyFormat,
      finalIsPrivate ? 1 : 0,
      finalVisibleToClient ? 1 : 0,
      finalVisibleToRep ? 1 : 0,
      attachments ? JSON.stringify(attachments) : null,
      now
    ).run();

    // Update thread's last_message_at
    await db.prepare(`
      UPDATE message_threads
      SET last_message_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(now, now, threadId).run();

    // If thread was resolved or pending and client/rep sends a message, reopen it
    if (senderType !== 'admin' && (thread.status === 'resolved' || thread.status === 'pending')) {
      await db.prepare(`
        UPDATE message_threads
        SET status = 'open', updated_at = ?
        WHERE id = ?
      `).bind(now, threadId).run();
    }

    // Fetch the created message with sender name
    const message = await db.prepare(`
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
      WHERE m.id = ?
    `).bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: message
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to send message:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
