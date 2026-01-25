// Admin Toast Hub FAQ - Get, Update, Delete single FAQ
import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../_shared/auth.js';

export async function onRequestGet(context) {
  const { request, env, params } = context;
  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) return unauthorizedResponse(auth.error, request);

    const faq = await env.DB.prepare('SELECT * FROM toast_hub_faqs WHERE id = ?').bind(params.id).first();

    if (!faq) {
      return new Response(JSON.stringify({
        success: false,
        error: 'FAQ not found'
      }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

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

export async function onRequestPut(context) {
  const { request, env, params } = context;
  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) return unauthorizedResponse(auth.error, request);

    const db = env.DB;
    const body = await request.json();
    const now = Math.floor(Date.now() / 1000);

    const existing = await db.prepare('SELECT * FROM toast_hub_faqs WHERE id = ?').bind(params.id).first();
    if (!existing) {
      return new Response(JSON.stringify({
        success: false,
        error: 'FAQ not found'
      }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    await db.prepare(`
      UPDATE toast_hub_faqs SET
        question = ?,
        answer = ?,
        category = ?,
        display_order = ?,
        is_active = ?,
        updated_at = ?
      WHERE id = ?
    `).bind(
      body.question ?? existing.question,
      body.answer ?? existing.answer,
      body.category !== undefined ? body.category : existing.category,
      body.display_order ?? existing.display_order,
      body.is_active !== undefined ? (body.is_active ? 1 : 0) : existing.is_active,
      now,
      params.id
    ).run();

    const updated = await db.prepare('SELECT * FROM toast_hub_faqs WHERE id = ?').bind(params.id).first();

    return new Response(JSON.stringify({
      success: true,
      data: updated
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) return unauthorizedResponse(auth.error, request);

    await env.DB.prepare('DELETE FROM toast_hub_faqs WHERE id = ?').bind(params.id).run();

    return new Response(JSON.stringify({
      success: true
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
