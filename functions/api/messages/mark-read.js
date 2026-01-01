// Mark Messages as Read API
export async function onRequestPost(context) {
  try {
    const db = context.env.DB;
    const body = await context.request.json();

    const {
      threadId,
      messageId,
      messageIds,
      viewerType,
      viewerId
    } = body;

    // Validate viewer info
    if (!viewerType || !viewerId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Viewer type and ID are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const validViewerTypes = ['admin', 'client', 'rep'];
    if (!validViewerTypes.includes(viewerType)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid viewer type'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const now = Math.floor(Date.now() / 1000);
    let updatedCount = 0;

    if (threadId) {
      // Mark all unread messages in thread as read
      // Only mark messages not sent by the viewer
      let query;
      let bindings = [now, threadId];

      if (viewerType === 'admin') {
        // Admin marks all messages from clients and reps as read
        query = `
          UPDATE messages
          SET read_at = ?
          WHERE thread_id = ?
            AND read_at IS NULL
            AND sender_type != 'admin'
        `;
      } else if (viewerType === 'client') {
        // Client marks messages visible to them and not from them as read
        query = `
          UPDATE messages
          SET read_at = ?
          WHERE thread_id = ?
            AND read_at IS NULL
            AND visible_to_client = 1
            AND (sender_type != 'client' OR sender_id != ?)
        `;
        bindings.push(viewerId);
      } else if (viewerType === 'rep') {
        // Rep marks messages visible to them and not from them as read
        query = `
          UPDATE messages
          SET read_at = ?
          WHERE thread_id = ?
            AND read_at IS NULL
            AND visible_to_rep = 1
            AND (sender_type != 'rep' OR sender_id != ?)
        `;
        bindings.push(viewerId);
      }

      const result = await db.prepare(query).bind(...bindings).run();
      updatedCount = result.meta?.changes || 0;

    } else if (messageId) {
      // Mark single message as read
      const message = await db.prepare(
        'SELECT * FROM messages WHERE id = ?'
      ).bind(messageId).first();

      if (!message) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Message not found'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check visibility
      if (viewerType === 'client' && !message.visible_to_client) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Access denied'
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (viewerType === 'rep' && !message.visible_to_rep) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Access denied'
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Don't mark own messages as read
      if (message.sender_type === viewerType && message.sender_id === viewerId) {
        return new Response(JSON.stringify({
          success: true,
          data: { updated: 0 }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const result = await db.prepare(`
        UPDATE messages
        SET read_at = ?
        WHERE id = ? AND read_at IS NULL
      `).bind(now, messageId).run();

      updatedCount = result.meta?.changes || 0;

    } else if (messageIds && Array.isArray(messageIds) && messageIds.length > 0) {
      // Mark multiple specific messages as read
      // Build placeholders for IN clause
      const placeholders = messageIds.map(() => '?').join(',');
      let query;
      let bindings = [now];

      if (viewerType === 'admin') {
        query = `
          UPDATE messages
          SET read_at = ?
          WHERE id IN (${placeholders})
            AND read_at IS NULL
            AND sender_type != 'admin'
        `;
        bindings.push(...messageIds);
      } else if (viewerType === 'client') {
        query = `
          UPDATE messages
          SET read_at = ?
          WHERE id IN (${placeholders})
            AND read_at IS NULL
            AND visible_to_client = 1
            AND (sender_type != 'client' OR sender_id != ?)
        `;
        bindings.push(...messageIds, viewerId);
      } else if (viewerType === 'rep') {
        query = `
          UPDATE messages
          SET read_at = ?
          WHERE id IN (${placeholders})
            AND read_at IS NULL
            AND visible_to_rep = 1
            AND (sender_type != 'rep' OR sender_id != ?)
        `;
        bindings.push(...messageIds, viewerId);
      }

      const result = await db.prepare(query).bind(...bindings).run();
      updatedCount = result.meta?.changes || 0;

    } else {
      return new Response(JSON.stringify({
        success: false,
        error: 'Thread ID, message ID, or message IDs array required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        updated: updatedCount,
        read_at: now
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to mark messages as read:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
