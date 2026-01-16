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
const ZONES = {
  cape: {
    id: 'cape',
    name: 'Cape Cod',
    description: 'Primary service area - no travel fee',
    travelCost: 0,
    estimatedDrive: '0-60 min',
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
    travelCost: 300,
    vehicleFee: 200,
    lodgingFee: 250,
    estimatedDrive: 'Ferry + 30 min',
    seasonal: true,
    requiresFerry: true,
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
  southShore: {
    id: 'southShore',
    name: 'South Shore',
    description: 'Plymouth to Quincy corridor',
    travelCost: 100,
    estimatedDrive: '45-90 min',
    seasonal: false,
    towns: [
      'plymouth', 'kingston', 'duxbury', 'marshfield', 'scituate', 'cohasset',
      'norwell', 'hanover', 'hingham', 'hull', 'weymouth', 'braintree',
      'quincy', 'abington', 'rockland', 'whitman', 'halifax', 'pembroke',
      'carver', 'wareham', 'middleborough', 'lakeville'
    ]
  },
  southernNE: {
    id: 'southernNE',
    name: 'Southern New England',
    description: 'Greater Boston, RI, CT, South NH',
    travelCost: 250,
    estimatedDrive: '1.5-3 hours',
    seasonal: false,
    subzones: {
      boston: {
        name: 'Greater Boston',
        towns: [
          'boston', 'cambridge', 'somerville', 'brookline', 'newton',
          'watertown', 'waltham', 'medford', 'malden', 'everett', 'chelsea',
          'revere', 'arlington', 'belmont', 'lexington', 'woburn', 'stoneham'
        ]
      },
      metrowest: {
        name: 'MetroWest',
        towns: [
          'framingham', 'natick', 'wellesley', 'needham', 'dedham', 'norwood',
          'sharon', 'canton', 'stoughton', 'easton', 'foxborough', 'mansfield',
          'attleboro', 'taunton', 'fall river', 'new bedford'
        ]
      },
      rhode_island: {
        name: 'Rhode Island',
        towns: [
          'providence', 'warwick', 'cranston', 'pawtucket', 'east providence',
          'newport', 'bristol', 'narragansett', 'westerly', 'block island'
        ]
      },
      connecticut: {
        name: 'Connecticut',
        towns: [
          'stamford', 'norwalk', 'bridgeport', 'new haven', 'hartford',
          'greenwich', 'westport', 'fairfield', 'milford', 'new london',
          'mystic', 'old saybrook', 'madison', 'guilford'
        ]
      }
    }
  },
  'ne100+': {
    id: 'ne100+',
    name: 'Northern New England',
    description: 'Vermont, NH, Maine - 100+ miles',
    travelCost: 400,
    estimatedDrive: '2-4 hours',
    seasonal: false,
    subzones: {
      new_hampshire: {
        name: 'New Hampshire',
        regions: ['seacoast', 'lakes region', 'white mountains', 'upper valley']
      },
      maine: {
        name: 'Maine',
        regions: ['southern maine', 'portland area', 'midcoast', 'downeast']
      },
      vermont: {
        name: 'Vermont',
        regions: ['southern vt', 'central vt', 'burlington', 'ski country']
      }
    }
  },
  outOfRegion: {
    id: 'outOfRegion',
    name: 'Out of Region',
    description: 'National - remote support prioritized',
    travelCost: 800,
    estimatedDrive: '4+ hours or flight',
    seasonal: false,
    remotePreferred: true
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

  // Check Cape Cod
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

  // Check South Shore
  for (const town of ZONES.southShore.towns) {
    if (a.includes(town)) {
      return {
        zone: 'southShore',
        town: town,
        ...ZONES.southShore
      };
    }
  }

  // Check Southern NE subzones
  for (const [subzoneId, subzone] of Object.entries(ZONES.southernNE.subzones)) {
    for (const town of subzone.towns) {
      if (a.includes(town)) {
        return {
          zone: 'southernNE',
          subzone: subzoneId,
          town: town,
          ...ZONES.southernNE,
          subzoneInfo: subzone
        };
      }
    }
  }

  // Check state-level matches
  if (a.includes('massachusetts') || a.includes(', ma')) {
    // Default to southernNE for unrecognized MA towns
    return { zone: 'southernNE', ...ZONES.southernNE };
  }
  if (a.includes('rhode island') || a.includes(', ri')) {
    return {
      zone: 'southernNE',
      subzone: 'rhode_island',
      ...ZONES.southernNE,
      subzoneInfo: ZONES.southernNE.subzones.rhode_island
    };
  }
  if (a.includes('connecticut') || a.includes(', ct')) {
    return {
      zone: 'southernNE',
      subzone: 'connecticut',
      ...ZONES.southernNE,
      subzoneInfo: ZONES.southernNE.subzones.connecticut
    };
  }
  if (a.includes('new hampshire') || a.includes(', nh')) {
    return { zone: 'ne100+', subzone: 'new_hampshire', ...ZONES['ne100+'] };
  }
  if (a.includes('maine') || a.includes(', me')) {
    return { zone: 'ne100+', subzone: 'maine', ...ZONES['ne100+'] };
  }
  if (a.includes('vermont') || a.includes(', vt')) {
    return { zone: 'ne100+', subzone: 'vermont', ...ZONES['ne100+'] };
  }

  // Default to out of region
  return { zone: 'outOfRegion', ...ZONES.outOfRegion };
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
