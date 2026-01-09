/**
 * Quote Calculation API - Server-Side Pricing
 *
 * POST /api/quote/calculate
 *
 * SECURITY: All proprietary pricing logic is kept server-side.
 * The client sends the floor plan configuration, and this API returns
 * calculated prices without exposing the underlying formulas.
 */

import { getCorsOrigin } from '../../_shared/auth.js';
import { rateLimit, RATE_LIMITS } from '../../_shared/rate-limit.js';

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

// ============================================
// PROPRIETARY PRICING DATA (SERVER-SIDE ONLY)
// ============================================

const RATES = {
  hourly: 110
};

const TRAVEL_RATES = {
  cape: 0,
  southShore: 100,
  southernNE: 250,
  'ne100+': 400,
  island: 300,
  islandVehicle: 200,
  islandLodging: 250,
  outOfRegion: 800
};

// Hardware TTI (time-to-install in minutes) - PROPRIETARY
const HARDWARE_TTI = {
  'toast-flex': 45,
  'toast-flex-guest': 30,
  'toast-go2': 25,
  'toast-kds': 30,
  'receipt-printer': 20,
  'impact-printer': 20,
  'label-printer': 40,
  'poe-switch': 10,
  'ap': 25,
  'router': 25,
  'card-reader-direct': 20,
  'card-reader-guest': 20,
  'card-reader-employee': 20,
  'ups': 15,
  'cash-drawer': 15,
  'barcode': 15,
  'scale': 45
};

// Integration TTI - PROPRIETARY
const INTEGRATION_TTI = {
  'toast-payroll': 90,
  'xtrachef': 90,
  'loyalty': 60,
  'gift-cards': 45,
  'online-ordering': 60,
  'delivery-services': 30,
  '3p-delivery': 60,
  'opentable': 60,
  'tables': 90,
  'email-mktg': 45,
  '7shifts': 75
};

// Station overhead per new station
const STATION_OVERHEAD_MIN = 15;

// Support plan discount for annual
const ANNUAL_DISCOUNT = 0.95;

// ============================================
// CALCULATION FUNCTIONS
// ============================================

function calculateTravelCost(travel) {
  if (!travel || travel.remote) return 0;

  const zone = travel.zone || 'cape';

  if (zone === 'cape') return TRAVEL_RATES.cape;
  if (zone === 'southShore') return TRAVEL_RATES.southShore;
  if (zone === 'southernNE') return TRAVEL_RATES.southernNE;
  if (zone === 'ne100+') return TRAVEL_RATES['ne100+'];
  if (zone === 'outOfRegion') return TRAVEL_RATES.outOfRegion;

  if (zone === 'island') {
    let cost = TRAVEL_RATES.island;
    if (travel.islandVehicle) cost += TRAVEL_RATES.islandVehicle;
    if (travel.islandLodging) cost += TRAVEL_RATES.islandLodging;
    return cost;
  }

  return 0;
}

function calculateQuote(config) {
  const { floors, travel, integrationIds, supportTier, supportPeriod } = config;

  const breakdown = {
    items: [],
    mins: { hardware: 0, overhead: 0, integrations: 0, cabling: 0 }
  };

  // Calculate labor for all floors
  (floors || []).forEach(floor => {
    // Stations & hardware
    (floor.stations || []).forEach(station => {
      const stationExisting = station.flags?.existing && !station.flags?.replace;

      if (!stationExisting) {
        breakdown.mins.overhead += STATION_OVERHEAD_MIN;
        breakdown.items.push({
          type: 'overhead',
          label: `Station setup - ${station.name}`,
          minutes: STATION_OVERHEAD_MIN
        });
      }

      (station.hardware || []).forEach(hw => {
        const tti = HARDWARE_TTI[hw.hid];
        if (!tti) return;

        const hwExisting = hw.flags?.existing && !hw.flags?.replace;
        if (stationExisting || hwExisting) return;

        breakdown.mins.hardware += tti;
        breakdown.items.push({
          type: 'hardware',
          label: `${hw.hid} - ${station.name}`,
          minutes: tti
        });
      });
    });

    // Cable runs
    (floor.layers || []).filter(l => l.type === 'network').forEach(layer => {
      (layer.cableRuns || []).forEach(run => {
        breakdown.mins.cabling += run.ttiMin;
        breakdown.items.push({
          type: 'cabling',
          label: `Cable run ${run.lengthFt} ft`,
          minutes: run.ttiMin
        });
      });
    });
  });

  // Integrations
  (integrationIds || []).forEach(id => {
    const tti = INTEGRATION_TTI[id];
    if (!tti) return;

    breakdown.mins.integrations += tti;
    breakdown.items.push({
      type: 'integration',
      label: `Integration - ${id}`,
      minutes: tti
    });
  });

  // Calculate totals
  const totalMin = Object.values(breakdown.mins).reduce((a, b) => a + b, 0);
  const installCost = (totalMin / 60) * RATES.hourly;
  const travelCost = calculateTravelCost(travel);

  // Support plan calculations
  const tierPct = (supportTier || 0) / 100;
  const supportMonthly = tierPct * installCost;
  const supportAnnual = supportMonthly * 12 * ANNUAL_DISCOUNT;
  const supportNow = supportPeriod === 'annual' ? supportAnnual : supportMonthly;

  const combinedFirst = installCost + travelCost + supportNow;

  return {
    // Detailed breakdown (without revealing TTI formulas)
    items: breakdown.items.map(item => ({
      type: item.type,
      label: item.label,
      // Don't expose minutes - only show dollars
      cost: (item.minutes / 60) * RATES.hourly
    })),
    // Summary totals
    summary: {
      hardwareCost: (breakdown.mins.hardware / 60) * RATES.hourly,
      overheadCost: (breakdown.mins.overhead / 60) * RATES.hourly,
      integrationsCost: (breakdown.mins.integrations / 60) * RATES.hourly,
      cablingCost: (breakdown.mins.cabling / 60) * RATES.hourly,
      installCost,
      travelCost,
      supportMonthly,
      supportAnnual,
      totalFirst: combinedFirst
    },
    // Time estimate (approximate range, not exact)
    timeEstimate: {
      minHours: Math.floor(totalMin * 0.85 / 60),
      maxHours: Math.ceil(totalMin * 1.15 / 60)
    }
  };
}

// ============================================
// REQUEST HANDLERS
// ============================================

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  // Rate limiting - 30 calculations per minute per IP
  const rateLimitResponse = await rateLimit(
    request,
    env.RATE_LIMIT_KV,
    'quote-calculate',
    RATE_LIMITS.API_WRITE,
    corsHeaders
  );
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const config = await request.json();

    // Validate input
    if (!config || typeof config !== 'object') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid request body'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Validate payload size to prevent abuse
    const floors = config.floors || [];
    if (floors.length > 20) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Too many floors. Maximum 20 allowed.'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const totalStations = floors.reduce((sum, f) => sum + (f.stations?.length || 0), 0);
    if (totalStations > 100) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Too many stations. Maximum 100 allowed.'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const quote = calculateQuote(config);

    return new Response(JSON.stringify({
      success: true,
      quote,
      generatedAt: new Date().toISOString()
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Quote calculation error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to calculate quote'
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    }
  });
}
