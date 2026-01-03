// Rep Info API - Get rep information by slug
// Supports demo mode for slugs starting with "demo-"

// Demo rep data for testing
const DEMO_REPS = {
  'demo-rep': {
    id: 'demo-rep-001',
    name: 'Demo Sales Rep',
    email: 'demo-rep@example.com',
    territory: 'Cape Cod',
    slug: 'demo-rep',
    avatar_url: null,
    portal_enabled: true
  }
};

export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    const { slug } = context.params;

    if (!slug) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Rep slug is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check for demo mode - slug starts with "demo-"
    const url = new URL(context.request.url);
    const isDemoMode = slug.startsWith('demo-') || url.searchParams.get('demo') === 'true';

    if (isDemoMode && DEMO_REPS[slug]) {
      return new Response(JSON.stringify({
        success: true,
        data: DEMO_REPS[slug]
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const rep = await db.prepare(`
      SELECT id, email, name, territory, slug, phone, portal_enabled, status, avatar_url, notes
      FROM reps
      WHERE slug = ? AND portal_enabled = 1
    `).bind(slug).first();

    if (!rep) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Rep not found or portal not enabled'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: rep.id,
        name: rep.name,
        email: rep.email,
        territory: rep.territory,
        slug: rep.slug,
        avatar_url: rep.avatar_url,
        portal_enabled: Boolean(rep.portal_enabled)
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Rep info error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
