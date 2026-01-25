// Admin Toast Hub FAQs - List and Create
import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../_shared/auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) return unauthorizedResponse(auth.error, request);

    const db = env.DB;
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const activeOnly = url.searchParams.get('active');

    let query = 'SELECT * FROM toast_hub_faqs WHERE 1=1';
    const params = [];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    if (activeOnly === '1') {
      query += ' AND is_active = 1';
    }

    query += ' ORDER BY display_order ASC, created_at ASC';

    const { results } = await db.prepare(query).bind(...params).all();

    return new Response(JSON.stringify({
      success: true,
      data: results || []
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) return unauthorizedResponse(auth.error, request);

    const db = env.DB;
    const body = await request.json();

    if (!body.question || !body.answer) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Question and answer are required'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const id = `faq_${crypto.randomUUID().slice(0, 8)}`;
    const now = Math.floor(Date.now() / 1000);

    // Get max display_order
    const maxOrder = await db.prepare('SELECT MAX(display_order) as max_order FROM toast_hub_faqs').first();
    const displayOrder = body.display_order ?? ((maxOrder?.max_order || 0) + 1);

    await db.prepare(`
      INSERT INTO toast_hub_faqs (id, question, answer, category, display_order, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.question,
      body.answer,
      body.category || null,
      displayOrder,
      body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1,
      now,
      now
    ).run();

    const faq = await db.prepare('SELECT * FROM toast_hub_faqs WHERE id = ?').bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      data: faq
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}

// Bulk reorder endpoint
export async function onRequestPut(context) {
  const { request, env } = context;
  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) return unauthorizedResponse(auth.error, request);

    const db = env.DB;
    const body = await request.json();

    if (!body.order || !Array.isArray(body.order)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'order array is required'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Update display_order for each FAQ
    const stmt = db.prepare('UPDATE toast_hub_faqs SET display_order = ?, updated_at = ? WHERE id = ?');
    const now = Math.floor(Date.now() / 1000);
    const batch = body.order.map((id, idx) => stmt.bind(idx + 1, now, id));
    await db.batch(batch);

    return new Response(JSON.stringify({
      success: true,
      message: `Reordered ${body.order.length} FAQs`
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
