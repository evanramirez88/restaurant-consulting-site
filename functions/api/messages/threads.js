// Messages Threads API - List and Create threads
export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    const url = new URL(context.request.url);
    const viewerType = url.searchParams.get('viewerType') || 'admin';
    const viewerId = url.searchParams.get('viewerId');

    let query;
    let bindings = [];

    if (viewerType === 'admin') {
      // Admin can see all threads
      query = `
        SELECT
          mt.*,
          c.name as client_name,
          c.company as client_company,
          r.name as rep_name,
          (
            SELECT COUNT(*)
            FROM messages m
            WHERE m.thread_id = mt.id
              AND m.read_at IS NULL
              AND m.sender_type != 'admin'
          ) as unread_count
        FROM message_threads mt
        LEFT JOIN clients c ON mt.client_id = c.id
        LEFT JOIN reps r ON mt.rep_id = r.id
        ORDER BY
          CASE mt.priority
            WHEN 'urgent' THEN 1
            WHEN 'high' THEN 2
            WHEN 'normal' THEN 3
            WHEN 'low' THEN 4
          END,
          COALESCE(mt.last_message_at, mt.created_at) DESC
      `;
    } else if (viewerType === 'client' && viewerId) {
      // Client can see their own threads (excluding private ones)
      query = `
        SELECT
          mt.*,
          c.name as client_name,
          c.company as client_company,
          r.name as rep_name,
          (
            SELECT COUNT(*)
            FROM messages m
            WHERE m.thread_id = mt.id
              AND m.read_at IS NULL
              AND m.sender_type != 'client'
              AND m.visible_to_client = 1
          ) as unread_count
        FROM message_threads mt
        LEFT JOIN clients c ON mt.client_id = c.id
        LEFT JOIN reps r ON mt.rep_id = r.id
        WHERE mt.client_id = ?
          AND mt.thread_type != 'private'
        ORDER BY
          COALESCE(mt.last_message_at, mt.created_at) DESC
      `;
      bindings = [viewerId];
    } else if (viewerType === 'rep' && viewerId) {
      // Rep can see threads they're assigned to
      query = `
        SELECT
          mt.*,
          c.name as client_name,
          c.company as client_company,
          r.name as rep_name,
          (
            SELECT COUNT(*)
            FROM messages m
            WHERE m.thread_id = mt.id
              AND m.read_at IS NULL
              AND m.sender_type != 'rep'
              AND m.visible_to_rep = 1
          ) as unread_count
        FROM message_threads mt
        LEFT JOIN clients c ON mt.client_id = c.id
        LEFT JOIN reps r ON mt.rep_id = r.id
        WHERE mt.rep_id = ?
          OR mt.client_id IN (
            SELECT client_id FROM client_rep_assignments WHERE rep_id = ?
          )
        ORDER BY
          CASE mt.priority
            WHEN 'urgent' THEN 1
            WHEN 'high' THEN 2
            WHEN 'normal' THEN 3
            WHEN 'low' THEN 4
          END,
          COALESCE(mt.last_message_at, mt.created_at) DESC
      `;
      bindings = [viewerId, viewerId];
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid viewer type or missing viewer ID'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const stmt = db.prepare(query);
    const { results } = bindings.length > 0
      ? await stmt.bind(...bindings).all()
      : await stmt.all();

    return new Response(JSON.stringify({
      success: true,
      data: results || []
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to fetch threads:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) {
  try {
    const db = context.env.DB;
    const body = await context.request.json();

    const {
      title,
      threadType = 'general',
      clientId,
      repId,
      projectId,
      ticketId,
      status = 'open',
      priority = 'normal',
      participants
    } = body;

    // Validate thread type
    const validTypes = ['ticket', 'project', 'general', 'support', 'private'];
    if (!validTypes.includes(threadType)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid thread type'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate status
    const validStatuses = ['open', 'pending', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid status'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate priority
    const validPriorities = ['low', 'normal', 'high', 'urgent'];
    if (!validPriorities.includes(priority)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid priority'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    await db.prepare(`
      INSERT INTO message_threads (
        id, title, thread_type, client_id, rep_id, project_id, ticket_id,
        status, priority, participants_json, last_message_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      title || null,
      threadType,
      clientId || null,
      repId || null,
      projectId || null,
      ticketId || null,
      status,
      priority,
      participants ? JSON.stringify(participants) : null,
      null,
      now,
      now
    ).run();

    // Fetch the created thread with related data
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
    console.error('Failed to create thread:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
