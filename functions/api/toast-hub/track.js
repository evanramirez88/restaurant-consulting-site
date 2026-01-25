// Public Toast Hub Analytics - Track page views
import { corsHeaders, handleOptions } from '../../_shared/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const db = env.DB;
    const body = await request.json();

    if (!body.post_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'post_id is required'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Create visitor hash from IP + UA (privacy-preserving)
    const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
    const ua = request.headers.get('User-Agent') || 'unknown';
    const hashData = new TextEncoder().encode(`${ip}:${ua}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', hashData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const visitorHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const id = crypto.randomUUID();
    const referrer = request.headers.get('Referer') || body.referrer || null;

    // Parse UTM params if present
    let utmSource = null, utmMedium = null, utmCampaign = null;
    if (referrer) {
      try {
        const refUrl = new URL(referrer);
        utmSource = refUrl.searchParams.get('utm_source');
        utmMedium = refUrl.searchParams.get('utm_medium');
        utmCampaign = refUrl.searchParams.get('utm_campaign');
      } catch {}
    }

    await db.prepare(`
      INSERT INTO toast_hub_page_views (id, post_id, visitor_hash, referrer, utm_source, utm_medium, utm_campaign, time_on_page, scroll_depth)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.post_id,
      visitorHash,
      referrer,
      utmSource,
      utmMedium,
      utmCampaign,
      body.time_on_page || null,
      body.scroll_depth || null
    ).run();

    // Increment view count on post
    await db.prepare(`
      UPDATE toast_hub_posts SET view_count = view_count + 1 WHERE id = ?
    `).bind(body.post_id).run();

    return new Response(JSON.stringify({
      success: true
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    // Don't fail silently but don't expose errors
    return new Response(JSON.stringify({
      success: false
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
