/**
 * Public Records Links API
 *
 * GET /api/directory/public-records?restaurantId=xxx - Get public record links for a restaurant
 * GET /api/directory/public-records?type=abcc&license=xxx - Build search URL directly
 *
 * Generates clickable links to:
 * - MA ABCC (Alcoholic Beverages Control Commission)
 * - Town business registries
 * - Health inspection records
 * - Google Maps verification
 * - Yelp business pages
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

// Build URL from template with placeholders
function buildUrl(template, data) {
  if (!template) return null;

  let url = template;

  // Replace all placeholders
  for (const [key, value] of Object.entries(data)) {
    const placeholder = `{${key}}`;
    const encodedValue = encodeURIComponent(value || '');
    url = url.replace(new RegExp(placeholder, 'g'), encodedValue);
  }

  // Remove any remaining unreplaced placeholders
  url = url.replace(/\{[^}]+\}/g, '');

  return url;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  try {
    // Option 1: Get links for a specific restaurant
    const restaurantId = url.searchParams.get('restaurantId');
    if (restaurantId) {
      // Get restaurant data
      const restaurant = await env.DB.prepare(`
        SELECT * FROM cape_cod_restaurants WHERE id = ?
      `).bind(restaurantId).first();

      if (!restaurant) {
        return new Response(
          JSON.stringify({ success: false, error: 'Restaurant not found' }),
          { status: 404, headers: corsHeaders }
        );
      }

      // Get all public records links for this town (and universal ones)
      const links = await env.DB.prepare(`
        SELECT * FROM public_records_links
        WHERE town = ? OR town IS NULL
        ORDER BY record_type
      `).bind(restaurant.town).all();

      // Build actual URLs for each link
      const data = {
        business_name: restaurant.name,
        license_number: restaurant.license_number,
        address: restaurant.address,
        town: restaurant.town,
        state: 'MA',
      };

      const builtLinks = (links.results || []).map(link => ({
        id: link.id,
        type: link.record_type,
        description: link.description,
        search_url: buildUrl(link.url_template, data),
        registry_url: link.search_url,
        town: link.town,
      }));

      // Group by type for easier UI consumption
      const grouped = {
        license: builtLinks.filter(l => l.type.includes('license') || l.type.includes('abcc')),
        business: builtLinks.filter(l => l.type.includes('business')),
        health: builtLinks.filter(l => l.type.includes('health')),
        verification: builtLinks.filter(l => l.type.includes('address') || l.type.includes('maps')),
        reviews: builtLinks.filter(l => l.type.includes('review') || l.type.includes('yelp')),
      };

      return new Response(
        JSON.stringify({
          success: true,
          restaurant: {
            id: restaurant.id,
            name: restaurant.name,
            town: restaurant.town,
            license_number: restaurant.license_number,
            address: restaurant.address,
          },
          links: builtLinks,
          grouped,
        }),
        { headers: corsHeaders }
      );
    }

    // Option 2: Build a direct search URL
    const recordType = url.searchParams.get('type');
    const license = url.searchParams.get('license');
    const businessName = url.searchParams.get('name');
    const town = url.searchParams.get('town');
    const address = url.searchParams.get('address');

    if (recordType) {
      // Find the appropriate link template
      let linkQuery = `SELECT * FROM public_records_links WHERE record_type LIKE ?`;
      const params = [`%${recordType}%`];

      if (town) {
        linkQuery += ` AND (town = ? OR town IS NULL)`;
        params.push(town);
      }

      const link = await env.DB.prepare(linkQuery).bind(...params).first();

      if (!link) {
        return new Response(
          JSON.stringify({ success: false, error: 'Record type not found' }),
          { status: 404, headers: corsHeaders }
        );
      }

      const data = {
        license_number: license,
        business_name: businessName,
        address: address,
        town: town,
        state: 'MA',
      };

      const searchUrl = buildUrl(link.url_template, data);

      return new Response(
        JSON.stringify({
          success: true,
          type: link.record_type,
          search_url: searchUrl,
          registry_url: link.search_url,
          description: link.description,
        }),
        { headers: corsHeaders }
      );
    }

    // Option 3: List all available record types
    const allTypes = await env.DB.prepare(`
      SELECT DISTINCT record_type, description FROM public_records_links ORDER BY record_type
    `).all();

    const allTowns = await env.DB.prepare(`
      SELECT DISTINCT town FROM public_records_links WHERE town IS NOT NULL ORDER BY town
    `).all();

    return new Response(
      JSON.stringify({
        success: true,
        record_types: (allTypes.results || []).map(r => ({
          type: r.record_type,
          description: r.description,
        })),
        towns_with_links: (allTowns.results || []).map(t => t.town),
        usage: {
          by_restaurant: '/api/directory/public-records?restaurantId=xxx',
          by_type: '/api/directory/public-records?type=abcc&license=xxx',
          with_town: '/api/directory/public-records?type=business&name=xxx&town=Provincetown',
        },
      }),
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Public records API error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}
