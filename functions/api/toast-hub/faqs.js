// Public Toast Hub FAQs - Active FAQs ordered for display
import { corsHeaders, handleOptions } from '../../_shared/auth.js';

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const db = env.DB;

    const { results } = await db.prepare(`
      SELECT id, question, answer, category, display_order
      FROM toast_hub_faqs
      WHERE is_active = 1
      ORDER BY display_order ASC
    `).all();

    return new Response(JSON.stringify({
      success: true,
      data: results || []
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      }
    });
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
