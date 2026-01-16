/**
 * Property Data API for Quote Builder
 *
 * GET /api/quote/property-data?address=<address>
 * GET /api/quote/property-data?lead_id=<id>
 *
 * Returns property information for pre-populating Quote Builder floor plans:
 * - Building dimensions (from assessor records)
 * - Lot size and layout
 * - Building permits
 * - Occupancy info
 *
 * Data Sources:
 * - MA Assessor databases (via scraping or API when available)
 * - Building permit records
 * - Property tax records
 * - Previously scraped/cached data
 *
 * NOTE: Full assessor map integration requires access to local
 * municipal data sources. This endpoint provides the framework
 * and returns cached/estimated data when available.
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

// Estimate floor layout from seating capacity and service style
function estimateLayout(seatingCapacity, serviceStyle) {
  const seats = parseInt(seatingCapacity, 10);
  if (isNaN(seats) || seats <= 0) return null;

  // Square footage estimates
  // Fine dining: 18-20 sq ft per seat
  // Casual dining: 15-18 sq ft per seat
  // Fast casual: 12-15 sq ft per seat
  // Counter/QSR: 10-12 sq ft per seat

  let sqFtPerSeat;
  switch (serviceStyle) {
    case 'fine_dining':
      sqFtPerSeat = 19;
      break;
    case 'upscale_casual':
      sqFtPerSeat = 17;
      break;
    case 'full_service':
      sqFtPerSeat = 16;
      break;
    case 'fast_casual':
      sqFtPerSeat = 13;
      break;
    case 'quick_service':
    case 'counter':
      sqFtPerSeat = 11;
      break;
    case 'cafe':
      sqFtPerSeat = 14;
      break;
    default:
      sqFtPerSeat = 15;
  }

  const diningArea = seats * sqFtPerSeat;

  // Kitchen typically 30-40% of dining
  const kitchenPct = serviceStyle === 'fine_dining' ? 0.40 :
    serviceStyle === 'fast_casual' ? 0.35 : 0.30;
  const kitchenArea = diningArea * kitchenPct;

  // Bar area if applicable (additional)
  const hasBar = seats > 40 || serviceStyle === 'full_service';
  const barArea = hasBar ? Math.min(seats * 0.15, 30) * sqFtPerSeat : 0;

  // Other areas (restrooms, storage, office) ~15%
  const otherArea = (diningArea + kitchenArea + barArea) * 0.15;

  const totalSqFt = Math.round(diningArea + kitchenArea + barArea + otherArea);

  // Estimate dimensions (assume roughly rectangular, 1.5:1 ratio)
  const width = Math.round(Math.sqrt(totalSqFt / 1.5));
  const length = Math.round(totalSqFt / width);

  return {
    estimated: true,
    confidence: 0.5,
    totalSqFt,
    dimensions: {
      width,
      length,
      ratio: '1.5:1'
    },
    areas: {
      dining: { sqFt: Math.round(diningArea), pct: Math.round((diningArea / totalSqFt) * 100) },
      kitchen: { sqFt: Math.round(kitchenArea), pct: Math.round((kitchenArea / totalSqFt) * 100) },
      bar: hasBar ? { sqFt: Math.round(barArea), pct: Math.round((barArea / totalSqFt) * 100) } : null,
      other: { sqFt: Math.round(otherArea), pct: Math.round((otherArea / totalSqFt) * 100) }
    },
    suggestedGrid: {
      // For Quote Builder canvas
      scale: totalSqFt > 5000 ? 8 : totalSqFt > 2000 ? 12 : 16, // px per foot
      gridSize: totalSqFt > 5000 ? 5 : totalSqFt > 2000 ? 2 : 1, // feet per grid cell
      canvasWidth: Math.min(width * (totalSqFt > 5000 ? 8 : 16), 1200),
      canvasHeight: Math.min(length * (totalSqFt > 5000 ? 8 : 16), 800)
    },
    stations: estimateStationPlacement(diningArea, kitchenArea, hasBar, serviceStyle)
  };
}

// Estimate station placement recommendations
function estimateStationPlacement(diningArea, kitchenArea, hasBar, serviceStyle) {
  const recommendations = [];

  // Server stations
  const serverStations = Math.ceil(diningArea / 800); // 1 per ~50 seats / 800 sq ft
  for (let i = 0; i < serverStations; i++) {
    recommendations.push({
      type: 'Server Station',
      location: i === 0 ? 'Near entrance/host stand' : `Dining area ${i + 1}`,
      priority: 'high',
      hardware: ['toast-flex', 'receipt-printer']
    });
  }

  // Kitchen stations
  const kitchenStations = kitchenArea > 1000 ? 3 : kitchenArea > 500 ? 2 : 1;
  const kitchenTypes = ['Hot Line', 'Cold Prep', 'Expo'];
  for (let i = 0; i < kitchenStations; i++) {
    recommendations.push({
      type: kitchenTypes[i] || 'Kitchen',
      location: 'Kitchen area',
      priority: 'high',
      hardware: i === kitchenStations - 1 ? ['toast-kds'] : ['toast-kds', 'impact-printer']
    });
  }

  // Bar station
  if (hasBar) {
    recommendations.push({
      type: 'Bar Station',
      location: 'Bar area',
      priority: 'medium',
      hardware: ['toast-flex', 'receipt-printer', 'card-reader-direct']
    });
  }

  // Network station
  recommendations.push({
    type: 'Networking Area',
    location: 'Back office / utility area',
    priority: 'high',
    hardware: ['router', 'poe-switch', 'ups']
  });

  return recommendations;
}

// Known assessor data sources by region
const ASSESSOR_SOURCES = {
  barnstable_county: {
    name: 'Barnstable County Registry of Deeds',
    url: 'https://www.barnstabledeeds.org/',
    type: 'manual_lookup',
    coverage: ['barnstable', 'bourne', 'brewster', 'chatham', 'dennis', 'eastham',
      'falmouth', 'harwich', 'mashpee', 'orleans', 'provincetown', 'sandwich',
      'truro', 'wellfleet', 'yarmouth']
  },
  nantucket: {
    name: 'Nantucket Assessor',
    url: 'https://www.nantucket-ma.gov/292/Assessors',
    type: 'manual_lookup',
    coverage: ['nantucket']
  },
  marthas_vineyard: {
    name: 'Dukes County',
    url: 'https://www.dukescounty.org/',
    type: 'manual_lookup',
    coverage: ['edgartown', 'oak bluffs', 'tisbury', 'west tisbury', 'chilmark', 'aquinnah']
  },
  plymouth_county: {
    name: 'Plymouth County Registry',
    url: 'https://www.plymouthdeeds.org/',
    type: 'manual_lookup',
    coverage: ['plymouth', 'kingston', 'duxbury', 'marshfield', 'scituate', 'hanover', 'pembroke']
  }
};

// Find assessor source for address
function findAssessorSource(address) {
  if (!address) return null;

  const a = address.toLowerCase();

  for (const [id, source] of Object.entries(ASSESSOR_SOURCES)) {
    for (const town of source.coverage) {
      if (a.includes(town)) {
        return { id, ...source, matchedTown: town };
      }
    }
  }

  return null;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  // Rate limiting
  const rateLimitResponse = await rateLimit(
    request,
    env.RATE_LIMIT_KV,
    'quote-property',
    RATE_LIMITS.API_READ,
    corsHeaders
  );
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const url = new URL(request.url);
    const address = url.searchParams.get('address');
    const leadId = url.searchParams.get('lead_id');
    const clientId = url.searchParams.get('client_id');

    let lookupAddress = address;
    let seatingCapacity = null;
    let serviceStyle = null;

    // Fetch data from lead/client if ID provided
    if (leadId && !address) {
      try {
        const lead = await env.DB.prepare(`
          SELECT full_address, city, state, service_style_hint
          FROM restaurant_leads
          WHERE id = ?
        `).bind(leadId).first();

        if (lead) {
          lookupAddress = lead.full_address ||
            `${lead.city || ''}, ${lead.state || ''}`;
          serviceStyle = lead.service_style_hint;
        }
      } catch (e) {
        console.log('Lead lookup error:', e.message);
      }
    }

    if (clientId && !address) {
      try {
        const client = await env.DB.prepare(`
          SELECT c.address, cp.seating_capacity, cp.service_style
          FROM clients c
          LEFT JOIN client_profiles cp ON cp.client_id = c.id
          WHERE c.id = ?
        `).bind(clientId).first();

        if (client) {
          lookupAddress = client.address;
          seatingCapacity = client.seating_capacity;
          serviceStyle = client.service_style;
        }
      } catch (e) {
        console.log('Client lookup error:', e.message);
      }
    }

    const result = {
      success: true,
      address: lookupAddress,
      propertyData: null,
      layoutEstimate: null,
      assessorSource: null,
      permits: [],
      cached: false
    };

    // Check for cached property data
    if (lookupAddress && env.DB) {
      try {
        // Check scraped_data_cache for any property info
        const urlHash = await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(lookupAddress)
        );
        const hashHex = Array.from(new Uint8Array(urlHash))
          .map(b => b.toString(16).padStart(2, '0')).join('');

        const cached = await env.DB.prepare(`
          SELECT scraped_data_json
          FROM scraped_data_cache
          WHERE url_hash = ? AND expires_at > unixepoch()
        `).bind(hashHex).first();

        if (cached?.scraped_data_json) {
          const data = JSON.parse(cached.scraped_data_json);
          if (data.property) {
            result.propertyData = data.property;
            result.cached = true;
          }
        }
      } catch (e) {
        // Non-fatal
      }
    }

    // Find assessor source
    result.assessorSource = findAssessorSource(lookupAddress);

    // Generate layout estimate if we have seating capacity or can estimate
    if (seatingCapacity || serviceStyle) {
      result.layoutEstimate = estimateLayout(
        seatingCapacity || 50, // Default to 50 seats if unknown
        serviceStyle || 'full_service'
      );
    } else {
      // Provide minimal estimate without specific data
      result.layoutEstimate = {
        estimated: true,
        confidence: 0.3,
        message: 'Limited data available. Link a lead or provide seating capacity for better estimates.',
        suggestedGrid: {
          scale: 12,
          gridSize: 2,
          canvasWidth: 800,
          canvasHeight: 600
        }
      };
    }

    // If no property data found, provide guidance
    if (!result.propertyData && result.assessorSource) {
      result.manualLookup = {
        message: `Property data not cached. Manual lookup available at: ${result.assessorSource.name}`,
        url: result.assessorSource.url,
        instructions: [
          `Visit ${result.assessorSource.url}`,
          `Search for address: ${lookupAddress}`,
          'Look for building dimensions, year built, and square footage',
          'Building permit history may show recent renovations'
        ]
      };
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Property data error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch property data'
    }), { status: 500, headers: corsHeaders });
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
