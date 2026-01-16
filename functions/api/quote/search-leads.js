/**
 * Lead/Client Search API for Quote Builder
 *
 * GET /api/quote/search-leads?q=<search>&limit=<limit>
 *
 * Searches restaurant_leads and clients tables to find matching
 * businesses for pre-populating Quote Builder with intelligence data.
 */

import { getCorsOrigin } from '../../_shared/auth.js';
import { rateLimit, RATE_LIMITS } from '../../_shared/rate-limit.js';

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  // Rate limiting
  const rateLimitResponse = await rateLimit(
    request,
    env.RATE_LIMIT_KV,
    'quote-search',
    RATE_LIMITS.API_READ,
    corsHeaders
  );
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || '';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50);

    if (!query || query.length < 2) {
      return new Response(JSON.stringify({
        success: true,
        results: [],
        message: 'Search query must be at least 2 characters'
      }), {
        status: 200,
        headers: corsHeaders
      });
    }

    const searchPattern = `%${query}%`;
    const results = [];

    // Search clients first (higher priority)
    try {
      const clients = await env.DB.prepare(`
        SELECT
          c.id,
          c.name as contact_name,
          c.company,
          c.email,
          c.phone,
          c.address,
          'client' as type,
          COALESCE(cp.service_style, '') as service_style,
          COALESCE(cp.cuisine_type, '') as cuisine_type,
          COALESCE(cp.pos_system, '') as pos_system,
          COALESCE(cp.seating_capacity, 0) as seating_capacity,
          COALESCE(cp.bar_program, '') as bar_program,
          COALESCE(cp.menu_complexity, '') as menu_complexity,
          COALESCE(cp.menu_item_count, 0) as menu_item_count,
          COALESCE(cp.employee_count, 0) as employee_count,
          COALESCE(cp.client_score, 50) as score
        FROM clients c
        LEFT JOIN client_profiles cp ON cp.client_id = c.id
        WHERE c.company LIKE ? OR c.name LIKE ? OR c.email LIKE ?
        ORDER BY cp.client_score DESC NULLS LAST
        LIMIT ?
      `).bind(searchPattern, searchPattern, searchPattern, Math.ceil(limit / 2)).all();

      for (const client of (clients.results || [])) {
        results.push({
          id: client.id,
          type: 'client',
          name: client.company || client.contact_name,
          contact: client.contact_name,
          email: client.email,
          phone: client.phone,
          address: client.address,
          service_style: client.service_style || null,
          cuisine_type: client.cuisine_type || null,
          pos_system: client.pos_system || null,
          seating_capacity: client.seating_capacity || null,
          bar_program: client.bar_program || null,
          menu_complexity: client.menu_complexity || null,
          menu_item_count: client.menu_item_count || null,
          employee_count: client.employee_count || null,
          score: client.score
        });
      }
    } catch (e) {
      console.log('Client search error:', e.message);
    }

    // Search restaurant_leads (prospects)
    try {
      const leads = await env.DB.prepare(`
        SELECT
          id,
          company_name,
          contact_name,
          email,
          phone,
          website,
          full_address,
          city,
          state,
          'lead' as type,
          current_pos as pos_system,
          cuisine_hint as cuisine_type,
          service_style_hint as service_style,
          bar_program_hint as bar_program,
          menu_size_hint as menu_item_count,
          employee_estimate,
          revenue_estimate,
          lead_score as score
        FROM restaurant_leads
        WHERE company_name LIKE ? OR contact_name LIKE ? OR email LIKE ? OR city LIKE ?
        ORDER BY lead_score DESC
        LIMIT ?
      `).bind(searchPattern, searchPattern, searchPattern, searchPattern, limit).all();

      for (const lead of (leads.results || [])) {
        // Skip if we already have this business from clients (by email)
        if (results.some(r => r.email === lead.email)) continue;

        // Infer menu complexity from size hint
        let menuComplexity = null;
        if (lead.menu_item_count) {
          const count = parseInt(lead.menu_item_count, 10);
          if (count > 200) menuComplexity = 'ultra';
          else if (count > 100) menuComplexity = 'complex';
          else if (count > 50) menuComplexity = 'moderate';
          else menuComplexity = 'simple';
        }

        results.push({
          id: lead.id,
          type: 'lead',
          name: lead.company_name,
          contact: lead.contact_name,
          email: lead.email,
          phone: lead.phone,
          website: lead.website,
          address: lead.full_address || `${lead.city || ''}, ${lead.state || ''}`.trim(),
          service_style: lead.service_style || null,
          cuisine_type: lead.cuisine_type || null,
          pos_system: lead.pos_system || null,
          bar_program: lead.bar_program || null,
          menu_complexity: menuComplexity,
          menu_item_count: lead.menu_item_count || null,
          employee_count: lead.employee_estimate || null,
          seating_capacity: null,
          score: lead.score || 50
        });
      }
    } catch (e) {
      console.log('Lead search error:', e.message);
    }

    // Sort combined results by score, clients first
    results.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'client' ? -1 : 1;
      return (b.score || 0) - (a.score || 0);
    });

    return new Response(JSON.stringify({
      success: true,
      results: results.slice(0, limit),
      total: results.length
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Search error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Search failed'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions(context) {
  const { request } = context;
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': getCorsOrigin(request),
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    }
  });
}
