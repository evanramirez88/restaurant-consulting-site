/**
 * Zone Information API for Quote Builder
 *
 * GET /api/quote/zone-info?address=<address>
 * GET /api/quote/zone-info?city=<city>&state=<state>
 * GET /api/quote/zone-info?lead_id=<id>
 *
 * Returns geographic zone classification for travel cost calculations.
 * Integrates with Discovery Targets for zone rotation scheduling.
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

// Zone definitions with travel costs and characteristics
// Based on ~1.5-1.75 hour drive from Brewster, MA (02631)
// Outer limits: Providence - Worcester - Boston triangle
const ZONES = {
  cape: {
    id: 'cape',
    name: 'Cape Cod',
    description: 'Home base - no travel fee',
    travelCost: 0,
    estimatedDrive: '0-45 min',
    seasonal: true,
    towns: [
      'barnstable', 'bourne', 'brewster', 'chatham', 'dennis', 'eastham',
      'falmouth', 'harwich', 'mashpee', 'orleans', 'provincetown', 'sandwich',
      'truro', 'wellfleet', 'yarmouth', 'hyannis', 'centerville', 'cotuit',
      'osterville', 'west yarmouth', 'south yarmouth', 'west dennis',
      'dennisport', 'north chatham', 'south chatham', 'west chatham',
      'east orleans', 'north eastham', 'south wellfleet', 'north truro'
    ]
  },
  island: {
    id: 'island',
    name: 'Islands',
    description: 'Nantucket & Martha\'s Vineyard - ferry required',
    travelCost: 150,           // Base ferry + time (walk-on)
    vehicleFee: 150,           // Additional if bringing vehicle
    lodgingFee: 250,           // If overnight stay needed
    estimatedDrive: 'Ferry + 30 min',
    seasonal: true,
    requiresFerry: true,
    note: 'Vehicle and lodging optional - depends on scope of work',
    subzones: {
      nantucket: {
        name: 'Nantucket',
        ferryFrom: 'Hyannis',
        ferryDuration: '1-2.5 hours',
        towns: ['nantucket', 'siasconset', 'madaket', 'surfside', 'miacomet']
      },
      marthas_vineyard: {
        name: 'Martha\'s Vineyard',
        ferryFrom: 'Woods Hole/Falmouth',
        ferryDuration: '45-75 min',
        towns: [
          'edgartown', 'oak bluffs', 'vineyard haven', 'west tisbury',
          'chilmark', 'aquinnah', 'menemsha'
        ]
      }
    }
  },
  // Everything within ~1.5-1.75 hours of Brewster - NO CHARGE
  // This includes South Shore, SouthCoast, most of SE Mass
  driveZone: {
    id: 'driveZone',
    name: 'Drive Zone',
    description: 'Within ~1.5-1.75 hours of Brewster - no travel fee',
    travelCost: 0,
    estimatedDrive: '45-105 min',
    seasonal: false,
    towns: [
      // South Shore
      'plymouth', 'kingston', 'duxbury', 'marshfield', 'scituate', 'cohasset',
      'norwell', 'hanover', 'hingham', 'hull', 'weymouth', 'braintree',
      'quincy', 'abington', 'rockland', 'whitman', 'halifax', 'pembroke',
      'carver', 'wareham', 'middleborough', 'lakeville',
      // SouthCoast
      'fall river', 'new bedford', 'dartmouth', 'westport', 'fairhaven',
      'mattapoisett', 'marion', 'rochester', 'acushnet', 'freetown',
      'somerset', 'swansea', 'seekonk', 'rehoboth',
      // Metro South
      'taunton', 'raynham', 'easton', 'mansfield', 'foxborough', 'norton',
      'attleboro', 'north attleboro', 'sharon', 'canton', 'stoughton',
      'randolph', 'holbrook', 'avon', 'brockton', 'bridgewater', 'west bridgewater',
      // MetroWest (within range)
      'franklin', 'milford', 'bellingham', 'medway', 'millis', 'norfolk',
      'wrentham', 'plainville', 'medfield', 'walpole', 'norwood', 'dedham'
    ]
  },
  // Rhode Island - part of the triangle, no problem
  rhodeIsland: {
    id: 'rhodeIsland',
    name: 'Rhode Island',
    description: 'Providence area - within the triangle',
    travelCost: 0,             // Fine with RI, it's within limits
    estimatedDrive: '1-1.5 hours',
    seasonal: false,
    towns: [
      'providence', 'warwick', 'cranston', 'pawtucket', 'east providence',
      'newport', 'bristol', 'narragansett', 'westerly', 'woonsocket',
      'cumberland', 'lincoln', 'smithfield', 'johnston', 'north providence',
      'barrington', 'warren', 'portsmouth', 'middletown', 'tiverton',
      'little compton', 'jamestown', 'north kingstown', 'south kingstown',
      'charlestown', 'hopkinton', 'richmond', 'exeter', 'west greenwich',
      'east greenwich', 'coventry', 'west warwick', 'scituate'
    ],
    note: 'Block Island may need ferry consideration'
  },
  // Boston - special case, parking/traffic hassle
  boston: {
    id: 'boston',
    name: 'Greater Boston',
    description: 'City parking & traffic consideration',
    travelCost: 50,            // Small fee for parking/hassle, optional
    parkingNote: 'Parking in the city is a pain - small fee to cover it',
    estimatedDrive: '1-1.5 hours + parking',
    seasonal: false,
    towns: [
      'boston', 'cambridge', 'somerville', 'brookline', 'chelsea',
      'revere', 'everett', 'malden', 'medford', 'charlestown'
    ],
    note: 'Not a fan of big apartment buildings and corporate stuff, but will do it'
  },
  // Worcester area - edge of the triangle
  worcester: {
    id: 'worcester',
    name: 'Worcester Area',
    description: 'Western edge of service area',
    travelCost: 0,             // Still within the triangle
    estimatedDrive: '1.25-1.75 hours',
    seasonal: false,
    towns: [
      'worcester', 'shrewsbury', 'westborough', 'northborough', 'southborough',
      'grafton', 'millbury', 'auburn', 'oxford', 'webster', 'dudley',
      'sturbridge', 'charlton', 'southbridge', 'spencer', 'leicester',
      'holden', 'rutland', 'paxton', 'princeton', 'sterling'
    ]
  },
  // Beyond the triangle - client pays
  extended: {
    id: 'extended',
    name: 'Extended Travel',
    description: 'Beyond Providence-Worcester-Boston - client covers travel',
    travelCost: null,          // Quote based on actual travel
    travelNote: 'Will travel anywhere if you\'re paying for it',
    estimatedDrive: '2+ hours',
    seasonal: false,
    clientPays: true,
    includes: [
      'Connecticut',
      'New Hampshire',
      'Vermont',
      'Maine',
      'Western MA',
      'Anywhere nationally'
    ]
  }
};

// Classify address to zone
function classifyAddress(address) {
  if (!address) return null;

  const a = address.toLowerCase().trim();

  // Check islands first (most specific)
  for (const town of ZONES.island.subzones.nantucket.towns) {
    if (a.includes(town)) {
      return {
        zone: 'island',
        subzone: 'nantucket',
        town: town,
        ...ZONES.island,
        subzoneInfo: ZONES.island.subzones.nantucket
      };
    }
  }

  for (const town of ZONES.island.subzones.marthas_vineyard.towns) {
    if (a.includes(town)) {
      return {
        zone: 'island',
        subzone: 'marthas_vineyard',
        town: town,
        ...ZONES.island,
        subzoneInfo: ZONES.island.subzones.marthas_vineyard
      };
    }
  }

  // Block Island is special
  if (a.includes('block island')) {
    return {
      zone: 'island',
      subzone: 'block_island',
      town: 'block island',
      ...ZONES.island,
      note: 'Block Island - ferry from Point Judith, RI'
    };
  }

  // Check Cape Cod (home base)
  for (const town of ZONES.cape.towns) {
    if (a.includes(town)) {
      return {
        zone: 'cape',
        town: town,
        ...ZONES.cape
      };
    }
  }
  if (a.includes('cape cod')) {
    return { zone: 'cape', ...ZONES.cape };
  }

  // Check Boston (special - parking/traffic fee)
  for (const town of ZONES.boston.towns) {
    if (a.includes(town)) {
      return {
        zone: 'boston',
        town: town,
        ...ZONES.boston
      };
    }
  }

  // Check Drive Zone (South Shore, SouthCoast, Metro South - all free)
  for (const town of ZONES.driveZone.towns) {
    if (a.includes(town)) {
      return {
        zone: 'driveZone',
        town: town,
        ...ZONES.driveZone
      };
    }
  }

  // Check Rhode Island (within the triangle - free)
  for (const town of ZONES.rhodeIsland.towns) {
    if (a.includes(town)) {
      return {
        zone: 'rhodeIsland',
        town: town,
        ...ZONES.rhodeIsland
      };
    }
  }

  // Check Worcester area (edge of triangle - free)
  for (const town of ZONES.worcester.towns) {
    if (a.includes(town)) {
      return {
        zone: 'worcester',
        town: town,
        ...ZONES.worcester
      };
    }
  }

  // State-level matching for unrecognized towns
  if (a.includes('rhode island') || a.includes(', ri')) {
    return { zone: 'rhodeIsland', ...ZONES.rhodeIsland };
  }

  // Massachusetts - try to figure out if it's within range
  if (a.includes('massachusetts') || a.includes(', ma')) {
    // Check if it might be within the triangle
    // MetroWest towns not explicitly listed
    const metroWestExtra = ['framingham', 'natick', 'wellesley', 'needham', 'newton',
      'watertown', 'waltham', 'lexington', 'arlington', 'belmont', 'woburn',
      'burlington', 'bedford', 'concord', 'sudbury', 'wayland', 'wellesley'];
    for (const town of metroWestExtra) {
      if (a.includes(town)) {
        return {
          zone: 'driveZone',
          town: town,
          ...ZONES.driveZone,
          note: 'MetroWest - within drive range'
        };
      }
    }
    // Default MA to drive zone (most of eastern MA is reachable)
    return { zone: 'driveZone', ...ZONES.driveZone };
  }

  // Beyond the Providence-Worcester-Boston triangle = extended
  if (a.includes('connecticut') || a.includes(', ct')) {
    return { zone: 'extended', state: 'Connecticut', ...ZONES.extended };
  }
  if (a.includes('new hampshire') || a.includes(', nh')) {
    return { zone: 'extended', state: 'New Hampshire', ...ZONES.extended };
  }
  if (a.includes('maine') || a.includes(', me')) {
    return { zone: 'extended', state: 'Maine', ...ZONES.extended };
  }
  if (a.includes('vermont') || a.includes(', vt')) {
    return { zone: 'extended', state: 'Vermont', ...ZONES.extended };
  }
  if (a.includes('new york') || a.includes(', ny')) {
    return { zone: 'extended', state: 'New York', ...ZONES.extended };
  }

  // Default to extended for anywhere else
  return { zone: 'extended', ...ZONES.extended };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  // Rate limiting
  const rateLimitResponse = await rateLimit(
    request,
    env.RATE_LIMIT_KV,
    'quote-zone',
    RATE_LIMITS.API_READ,
    corsHeaders
  );
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const url = new URL(request.url);
    const address = url.searchParams.get('address');
    const city = url.searchParams.get('city');
    const state = url.searchParams.get('state');
    const leadId = url.searchParams.get('lead_id');

    let lookupAddress = address;

    // Fetch address from lead if lead_id provided
    if (leadId && !address) {
      try {
        const lead = await env.DB.prepare(`
          SELECT full_address, city, state
          FROM restaurant_leads
          WHERE id = ?
        `).bind(leadId).first();

        if (lead) {
          lookupAddress = lead.full_address ||
            `${lead.city || ''}, ${lead.state || ''}`;
        }
      } catch (e) {
        console.log('Lead lookup error:', e.message);
      }
    }

    // Build address from city/state if not provided
    if (!lookupAddress && city) {
      lookupAddress = `${city}${state ? ', ' + state : ''}`;
    }

    if (!lookupAddress) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Address, city, or lead_id is required'
      }), { status: 400, headers: corsHeaders });
    }

    const zoneInfo = classifyAddress(lookupAddress);

    if (!zoneInfo) {
      return new Response(JSON.stringify({
        success: true,
        found: false,
        query: lookupAddress,
        message: 'Could not classify address'
      }), { status: 200, headers: corsHeaders });
    }

    // Fetch discovery targets for this zone (rotation scheduling)
    let discoveryTargets = [];
    try {
      const targets = await env.DB.prepare(`
        SELECT id, target_type, target_value, frequency_hours, last_run_at,
               next_run_at, total_leads_found
        FROM discovery_targets
        WHERE is_active = 1 AND target_type = 'location'
          AND LOWER(target_value) LIKE ?
        ORDER BY next_run_at ASC
        LIMIT 5
      `).bind(`%${zoneInfo.zone}%`).all();

      discoveryTargets = targets.results || [];
    } catch (e) {
      // Non-fatal
    }

    // Count leads in this zone
    let leadCount = 0;
    try {
      const count = await env.DB.prepare(`
        SELECT COUNT(*) as count
        FROM restaurant_leads
        WHERE LOWER(city) IN (${zoneInfo.towns?.map(() => '?').join(',') || '""'})
           OR LOWER(full_address) LIKE ?
      `).bind(...(zoneInfo.towns || []), `%${zoneInfo.zone}%`).first();

      leadCount = count?.count || 0;
    } catch (e) {
      // Non-fatal
    }

    return new Response(JSON.stringify({
      success: true,
      query: lookupAddress,
      zone: {
        id: zoneInfo.zone,
        name: zoneInfo.name,
        description: zoneInfo.description,
        travelCost: zoneInfo.travelCost,
        vehicleFee: zoneInfo.vehicleFee || 0,
        lodgingFee: zoneInfo.lodgingFee || 0,
        estimatedDrive: zoneInfo.estimatedDrive,
        seasonal: zoneInfo.seasonal,
        requiresFerry: zoneInfo.requiresFerry || false,
        remotePreferred: zoneInfo.remotePreferred || false
      },
      subzone: zoneInfo.subzone || null,
      subzoneInfo: zoneInfo.subzoneInfo || null,
      matchedTown: zoneInfo.town || null,
      discoveryTargets,
      leadCount,
      allZones: Object.keys(ZONES).map(k => ({
        id: k,
        name: ZONES[k].name,
        travelCost: ZONES[k].travelCost
      }))
    }), { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('Zone lookup error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to lookup zone'
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
