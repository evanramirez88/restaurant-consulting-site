/**
 * Quote Calculation API - Server-Side Pricing
 *
 * POST /api/quote/calculate
 *
 * SECURITY: All proprietary pricing logic is kept server-side.
 * The client sends the floor plan configuration, and this API returns
 * calculated prices without exposing the underlying formulas.
 *
 * INTEGRATION: Supports client_id or lead_id to auto-populate from
 * Client Intelligence system (client_profiles, restaurant_leads, client_atomic_facts)
 */

import { getCorsOrigin } from '../../_shared/auth.js';
import { rateLimit, RATE_LIMITS } from '../../_shared/rate-limit.js';

// ============================================
// CLIENT INTELLIGENCE INTEGRATION
// ============================================

/**
 * Map cuisine types to likely service styles
 */
const CUISINE_TO_SERVICE_STYLE = {
  'italian': 'full_service',
  'french': 'fine_dining',
  'japanese': 'upscale_casual',
  'sushi': 'upscale_casual',
  'mexican': 'fast_casual',
  'chinese': 'full_service',
  'thai': 'fast_casual',
  'indian': 'full_service',
  'american': 'full_service',
  'seafood': 'upscale_casual',
  'steakhouse': 'fine_dining',
  'pizza': 'fast_casual',
  'cafe': 'cafe',
  'coffee': 'cafe',
  'bakery': 'counter',
  'deli': 'counter',
  'sandwich': 'quick_service',
  'burger': 'quick_service',
  'fast food': 'quick_service',
  'food truck': 'food_truck',
  'bar': 'full_service',
  'pub': 'full_service',
  'brewery': 'full_service',
};

/**
 * Estimate station count from seating capacity
 */
function estimateStationsFromSeating(seatingCapacity) {
  const seats = parseInt(seatingCapacity, 10);
  if (isNaN(seats) || seats <= 0) return null;

  // Rule of thumb: 1 server station per 20-30 seats, plus bar, plus kitchen stations
  const serverStations = Math.ceil(seats / 25);
  const hasBar = seats > 50; // Assume bar for larger venues
  const kitchenStations = seats > 100 ? 3 : seats > 50 ? 2 : 1;

  return {
    estimated: serverStations + (hasBar ? 1 : 0) + kitchenStations,
    breakdown: {
      server: serverStations,
      bar: hasBar ? 1 : 0,
      kitchen: kitchenStations
    }
  };
}

/**
 * Fetch intelligence data from client_profiles, restaurant_leads, or client_atomic_facts
 */
async function fetchClientIntelligence(env, config) {
  const { client_id, lead_id } = config;

  if (!client_id && !lead_id) {
    return { found: false, source: null, data: null };
  }

  // Try client_profiles first (for known clients)
  if (client_id) {
    try {
      // Get client profile with extended intelligence
      const profile = await env.DB.prepare(`
        SELECT
          cp.*,
          c.name as client_name,
          c.company as company_name,
          c.email,
          c.phone,
          c.address
        FROM client_profiles cp
        JOIN clients c ON c.id = cp.client_id
        WHERE cp.client_id = ?
      `).bind(client_id).first();

      if (profile) {
        // Also get approved atomic facts for this client
        const facts = await env.DB.prepare(`
          SELECT field_name, field_value, confidence
          FROM client_atomic_facts
          WHERE client_id = ? AND status = 'approved'
          ORDER BY confidence DESC
        `).bind(client_id).all();

        return {
          found: true,
          source: 'client_profile',
          data: {
            name: profile.company_name || profile.client_name,
            address: profile.address || profile.full_address,
            cuisine_type: profile.cuisine_type,
            service_style: profile.service_style,
            bar_program: profile.bar_program,
            menu_complexity: profile.menu_complexity,
            seating_capacity: profile.seating_capacity,
            employee_count: profile.employee_count,
            pos_system: profile.pos_system,
            client_score: profile.client_score,
            facts: facts.results || []
          },
          confidence: 0.9 // High confidence for client profiles
        };
      }
    } catch (e) {
      console.log('Client profile lookup failed:', e.message);
    }
  }

  // Try restaurant_leads (for prospects)
  if (lead_id) {
    try {
      const lead = await env.DB.prepare(`
        SELECT
          id,
          company_name,
          contact_name,
          email,
          phone,
          website,
          city,
          state,
          full_address,
          vertical as category,
          current_pos as pos_system,
          employee_estimate,
          revenue_estimate,
          lead_score,
          cuisine_hint,
          service_style_hint
        FROM restaurant_leads
        WHERE id = ?
      `).bind(lead_id).first();

      if (lead) {
        // Infer service style from cuisine if not explicitly set
        let inferredServiceStyle = lead.service_style_hint;
        if (!inferredServiceStyle && lead.cuisine_hint) {
          const lowerCuisine = lead.cuisine_hint.toLowerCase();
          for (const [cuisine, style] of Object.entries(CUISINE_TO_SERVICE_STYLE)) {
            if (lowerCuisine.includes(cuisine)) {
              inferredServiceStyle = style;
              break;
            }
          }
        }

        // Infer from category/vertical
        if (!inferredServiceStyle && lead.category) {
          const lowerCat = lead.category.toLowerCase();
          if (lowerCat.includes('fast') || lowerCat.includes('quick')) {
            inferredServiceStyle = 'quick_service';
          } else if (lowerCat.includes('cafe') || lowerCat.includes('coffee')) {
            inferredServiceStyle = 'cafe';
          } else if (lowerCat.includes('bar') || lowerCat.includes('pub')) {
            inferredServiceStyle = 'full_service';
          }
        }

        return {
          found: true,
          source: 'restaurant_lead',
          data: {
            name: lead.company_name,
            address: lead.full_address || `${lead.city || ''}, ${lead.state || ''}`.trim(),
            cuisine_type: lead.cuisine_hint,
            service_style: inferredServiceStyle,
            bar_program: null, // Not in leads table yet
            menu_complexity: null,
            seating_capacity: null,
            employee_count: lead.employee_estimate,
            pos_system: lead.pos_system,
            lead_score: lead.lead_score,
            facts: []
          },
          confidence: inferredServiceStyle ? 0.6 : 0.4 // Lower confidence for inferred data
        };
      }
    } catch (e) {
      console.log('Lead lookup failed:', e.message);
    }
  }

  return { found: false, source: null, data: null };
}

/**
 * Apply intelligence data to quote configuration
 */
function applyIntelligenceToConfig(config, intelligence) {
  if (!intelligence.found) return config;

  const enhanced = { ...config };
  const data = intelligence.data;

  // Apply service style if not already set
  if (data.service_style && !config.serviceStyle) {
    enhanced.serviceStyle = data.service_style;
    enhanced._intelligenceApplied = enhanced._intelligenceApplied || [];
    enhanced._intelligenceApplied.push({
      field: 'serviceStyle',
      value: data.service_style,
      source: intelligence.source,
      confidence: intelligence.confidence
    });
  }

  // Apply menu complexity if not already set
  if (data.menu_complexity && !config.menuComplexity) {
    enhanced.menuComplexity = data.menu_complexity;
    enhanced._intelligenceApplied = enhanced._intelligenceApplied || [];
    enhanced._intelligenceApplied.push({
      field: 'menuComplexity',
      value: data.menu_complexity,
      source: intelligence.source,
      confidence: intelligence.confidence
    });
  }

  // Apply bar program if not already set
  if (data.bar_program && !config.barProgram) {
    enhanced.barProgram = data.bar_program;
    enhanced._intelligenceApplied = enhanced._intelligenceApplied || [];
    enhanced._intelligenceApplied.push({
      field: 'barProgram',
      value: data.bar_program,
      source: intelligence.source,
      confidence: intelligence.confidence
    });
  }

  // Mark as existing client if from client_profiles
  if (intelligence.source === 'client_profile' && data.client_score >= 70) {
    enhanced.isExistingClient = true;
    enhanced._intelligenceApplied = enhanced._intelligenceApplied || [];
    enhanced._intelligenceApplied.push({
      field: 'isExistingClient',
      value: true,
      source: intelligence.source,
      confidence: 0.95
    });
  }

  return enhanced;
}

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
  driveZone: 0,
  rhodeIsland: 0,
  worcester: 0,
  boston: 50,
  island: 150,
  islandVehicle: 150,
  islandLodging: 250,
  extended: null  // Quote based on actual travel
};

// ============================================
// VARIABILITY DATABASE - TIME-MOTION VALUES
// Core trade secret: TTI with variance ranges
// Format: { expected, min, max, failureRate, recoveryMin }
// ============================================

const VARIABILITY_DB = {
  hardware: {
    'toast-flex': { expected: 45, min: 35, max: 60, failureRate: 0.02, recoveryMin: 20 },
    'toast-flex-guest': { expected: 30, min: 20, max: 45, failureRate: 0.02, recoveryMin: 15 },
    'toast-go2': { expected: 25, min: 15, max: 35, failureRate: 0.03, recoveryMin: 10 },
    'toast-kds': { expected: 30, min: 20, max: 45, failureRate: 0.04, recoveryMin: 25 },
    'receipt-printer': { expected: 20, min: 12, max: 30, failureRate: 0.05, recoveryMin: 15 },
    'impact-printer': { expected: 20, min: 12, max: 35, failureRate: 0.06, recoveryMin: 20 },
    'label-printer': { expected: 40, min: 25, max: 55, failureRate: 0.04, recoveryMin: 25 },
    'poe-switch': { expected: 10, min: 5, max: 20, failureRate: 0.01, recoveryMin: 10 },
    'ap': { expected: 25, min: 15, max: 40, failureRate: 0.02, recoveryMin: 15 },
    'router': { expected: 25, min: 15, max: 40, failureRate: 0.02, recoveryMin: 20 },
    'card-reader-direct': { expected: 20, min: 12, max: 30, failureRate: 0.03, recoveryMin: 10 },
    'card-reader-guest': { expected: 20, min: 12, max: 30, failureRate: 0.03, recoveryMin: 10 },
    'card-reader-employee': { expected: 20, min: 12, max: 30, failureRate: 0.03, recoveryMin: 10 },
    'ups': { expected: 15, min: 10, max: 25, failureRate: 0.01, recoveryMin: 10 },
    'cash-drawer': { expected: 15, min: 10, max: 25, failureRate: 0.02, recoveryMin: 10 },
    'barcode': { expected: 15, min: 10, max: 25, failureRate: 0.02, recoveryMin: 10 },
    'scale': { expected: 45, min: 30, max: 60, failureRate: 0.03, recoveryMin: 20 }
  },
  integrations: {
    'toast-payroll': { expected: 90, min: 60, max: 120, failureRate: 0.08, recoveryMin: 30 },
    'xtrachef': { expected: 90, min: 60, max: 120, failureRate: 0.06, recoveryMin: 25 },
    'loyalty': { expected: 60, min: 40, max: 90, failureRate: 0.05, recoveryMin: 20 },
    'gift-cards': { expected: 45, min: 30, max: 60, failureRate: 0.04, recoveryMin: 15 },
    'online-ordering': { expected: 60, min: 40, max: 90, failureRate: 0.07, recoveryMin: 25 },
    'delivery-services': { expected: 30, min: 20, max: 45, failureRate: 0.05, recoveryMin: 15 },
    '3p-delivery': { expected: 60, min: 40, max: 90, failureRate: 0.08, recoveryMin: 30 },
    'opentable': { expected: 60, min: 45, max: 90, failureRate: 0.06, recoveryMin: 25 },
    'tables': { expected: 90, min: 60, max: 120, failureRate: 0.05, recoveryMin: 30 },
    'email-mktg': { expected: 45, min: 30, max: 60, failureRate: 0.04, recoveryMin: 15 },
    '7shifts': { expected: 75, min: 50, max: 100, failureRate: 0.05, recoveryMin: 25 }
  },
  cabling: {
    // Per-foot cabling time with variance
    cat6Standard: { expected: 0.5, min: 0.3, max: 0.8, failureRate: 0.02, recoveryMin: 5 },
    cat6Grease: { expected: 0.7, min: 0.5, max: 1.2, failureRate: 0.05, recoveryMin: 10 },
    cat6Historic: { expected: 0.9, min: 0.6, max: 1.5, failureRate: 0.08, recoveryMin: 15 }
  }
};

// Station Criticality Weights - affects DCI score
const STATION_CRITICALITY_WEIGHTS = {
  'toast-kds': 1.5,      // Kitchen Display: mission-critical
  'receipt-printer': 1.3, // Receipt printer: high impact
  'impact-printer': 1.3,  // Kitchen printer: high impact
  'label-printer': 1.2,   // Label printer: moderate impact
  'toast-flex': 1.0,      // Terminal: baseline
  'toast-flex-guest': 0.9, // Guest terminal: lower criticality
  'toast-go2': 0.9,       // Mobile device: lower criticality
  'card-reader-direct': 1.1,
  'card-reader-guest': 0.9,
  'card-reader-employee': 1.0,
  'poe-switch': 1.4,      // Network: high criticality
  'router': 1.5,          // Network: highest criticality
  'ap': 1.3,              // Network: high criticality
  'ups': 1.2,             // Power: moderate-high
  'cash-drawer': 0.8,     // Cash: lower criticality
  'barcode': 0.7,         // Accessory: low criticality
  'scale': 0.8            // Accessory: low criticality
};

// Environmental Multipliers - affects installation time
const ENVIRONMENTAL_MULTIPLIERS = {
  standard: 1.0,
  historicBuilding: 1.5,   // Old construction, difficult cabling
  greaseHeavy: 1.25,       // Kitchen areas with grease buildup
  outdoorPatio: 1.3,       // Weather considerations
  basement: 1.2,           // Below-grade installations
  multiLevel: 1.15,        // Multi-floor buildings
  limitedAccess: 1.35      // Restricted work hours or access
};

// Legacy compatibility: flat TTI values derived from Variability DB
const HARDWARE_TTI = Object.fromEntries(
  Object.entries(VARIABILITY_DB.hardware).map(([k, v]) => [k, v.expected])
);

const INTEGRATION_TTI = Object.fromEntries(
  Object.entries(VARIABILITY_DB.integrations).map(([k, v]) => [k, v.expected])
);

// Station overhead per new station
const STATION_OVERHEAD_MIN = 15;

// Support plan discount for annual
const ANNUAL_DISCOUNT = 0.95;

// ============================================
// DCI ALGORITHM - PROPRIETARY PRICING INTELLIGENCE
// ============================================

// Service Style Complexity Multipliers
const SERVICE_STYLE_MODIFIERS = {
  'fine_dining': 1.25,     // +25% - table management, coursing, extensive service
  'upscale_casual': 1.15,  // +15% - elevated service expectations
  'full_service': 1.10,    // +10% - standard table service
  'fast_casual': 1.05,     // +5%  - counter + table hybrid
  'quick_service': 1.00,   // baseline
  'counter': 0.95,         // -5%  - simple counter operations
  'cafe': 0.90,            // -10% - minimal menu, basic ops
  'food_truck': 0.85       // -15% - mobile, simplified setup
};

// Menu Complexity Multipliers
const MENU_COMPLEXITY_MODIFIERS = {
  'ultra': 1.30,           // +30% - 200+ items, extensive modifiers, coursing
  'complex': 1.15,         // +15% - 100-200 items, moderate modifiers
  'moderate': 1.05,        // +5%  - 50-100 items
  'simple': 0.90           // -10% - <50 items, minimal modifiers
};

// Bar Program Multipliers
const BAR_PROGRAM_MODIFIERS = {
  'craft_cocktail': 1.25,  // +25% - extensive recipes, inventory tracking
  'full_bar': 1.15,        // +15% - complete liquor program
  'wine_focus': 1.10,      // +10% - wine list management
  'beer_wine': 1.05,       // +5%  - limited beverage program
  'none': 1.00             // baseline - no alcohol
};

// Volume Discount Tiers
const VOLUME_DISCOUNT_TIERS = [
  { minDevices: 50, discount: 0.15 },  // 15% off for 50+ devices
  { minDevices: 30, discount: 0.10 },  // 10% off for 30-49 devices
  { minDevices: 15, discount: 0.05 }   // 5% off for 15-29 devices
];

// Multi-location discount per additional location
const MULTI_LOCATION_DISCOUNT_PER = 0.05;  // 5% per additional location
const MAX_MULTI_LOCATION_DISCOUNT = 0.20;  // Cap at 20%

/**
 * Calculate environmental modifier from venue characteristics
 */
function getEnvironmentalModifier(config) {
  let modifier = 1.0;
  const factors = [];

  // Check for environmental flags
  const environment = config.environment || {};

  if (environment.historicBuilding) {
    modifier *= ENVIRONMENTAL_MULTIPLIERS.historicBuilding;
    factors.push({
      type: 'environment',
      value: 'historic_building',
      modifier: ENVIRONMENTAL_MULTIPLIERS.historicBuilding,
      reason: 'Historic building - difficult cabling paths'
    });
  }

  if (environment.greaseHeavy) {
    modifier *= ENVIRONMENTAL_MULTIPLIERS.greaseHeavy;
    factors.push({
      type: 'environment',
      value: 'grease_heavy',
      modifier: ENVIRONMENTAL_MULTIPLIERS.greaseHeavy,
      reason: 'Grease-heavy environment - additional protection needed'
    });
  }

  if (environment.outdoorPatio) {
    modifier *= ENVIRONMENTAL_MULTIPLIERS.outdoorPatio;
    factors.push({
      type: 'environment',
      value: 'outdoor_patio',
      modifier: ENVIRONMENTAL_MULTIPLIERS.outdoorPatio,
      reason: 'Outdoor installation - weather considerations'
    });
  }

  if (environment.basement) {
    modifier *= ENVIRONMENTAL_MULTIPLIERS.basement;
    factors.push({
      type: 'environment',
      value: 'basement',
      modifier: ENVIRONMENTAL_MULTIPLIERS.basement,
      reason: 'Below-grade installation'
    });
  }

  if (environment.multiLevel) {
    modifier *= ENVIRONMENTAL_MULTIPLIERS.multiLevel;
    factors.push({
      type: 'environment',
      value: 'multi_level',
      modifier: ENVIRONMENTAL_MULTIPLIERS.multiLevel,
      reason: 'Multi-floor building'
    });
  }

  if (environment.limitedAccess) {
    modifier *= ENVIRONMENTAL_MULTIPLIERS.limitedAccess;
    factors.push({
      type: 'environment',
      value: 'limited_access',
      modifier: ENVIRONMENTAL_MULTIPLIERS.limitedAccess,
      reason: 'Limited work hours or access restrictions'
    });
  }

  return { modifier: Math.round(modifier * 100) / 100, factors };
}

/**
 * Calculate Station Criticality Index using weighted hardware criticality
 */
function calculateStationCriticalityIndex(floors) {
  let totalWeight = 0;
  let hardwareCount = 0;
  const criticalItems = [];

  (floors || []).forEach(floor => {
    (floor.stations || []).forEach(station => {
      (station.hardware || []).forEach(hw => {
        const weight = STATION_CRITICALITY_WEIGHTS[hw.hid] || 1.0;
        totalWeight += weight;
        hardwareCount++;

        if (weight >= 1.3) {
          criticalItems.push({
            hardware: hw.hid,
            station: station.name,
            weight
          });
        }
      });
    });
  });

  const avgCriticality = hardwareCount > 0 ? totalWeight / hardwareCount : 1.0;

  return {
    totalWeight: Math.round(totalWeight * 100) / 100,
    avgCriticality: Math.round(avgCriticality * 100) / 100,
    criticalItems,
    // Modifier based on avg criticality: if above 1.1, add that excess as percentage
    modifier: avgCriticality > 1.1 ? avgCriticality : 1.0
  };
}

/**
 * Calculate time ranges using Variability Database
 */
function calculateTimeWithVariance(floors, integrationIds, environmentModifier) {
  const result = {
    hardware: { expected: 0, min: 0, max: 0, failureRisk: 0 },
    integrations: { expected: 0, min: 0, max: 0, failureRisk: 0 },
    cabling: { expected: 0, min: 0, max: 0, failureRisk: 0 },
    overhead: 0
  };

  // Hardware time with variance
  (floors || []).forEach(floor => {
    (floor.stations || []).forEach(station => {
      const stationExisting = station.flags?.existing && !station.flags?.replace;

      if (!stationExisting) {
        result.overhead += STATION_OVERHEAD_MIN;
      }

      (station.hardware || []).forEach(hw => {
        const varData = VARIABILITY_DB.hardware[hw.hid];
        if (!varData) return;

        const hwExisting = hw.flags?.existing && !hw.flags?.replace;
        if (stationExisting || hwExisting) return;

        // Apply environmental modifier to time
        result.hardware.expected += varData.expected * environmentModifier;
        result.hardware.min += varData.min * environmentModifier;
        result.hardware.max += varData.max * environmentModifier;

        // Calculate expected failure time contribution
        result.hardware.failureRisk += varData.failureRate * varData.recoveryMin;
      });
    });

    // Cabling with variance
    (floor.layers || []).filter(l => l.type === 'network').forEach(layer => {
      (layer.cableRuns || []).forEach(run => {
        // Determine cabling type based on environment
        const env = floor.environment || {};
        let cablingType = 'cat6Standard';
        if (env.greaseHeavy) cablingType = 'cat6Grease';
        if (env.historicBuilding) cablingType = 'cat6Historic';

        const varData = VARIABILITY_DB.cabling[cablingType];
        const lengthFt = run.lengthFt || 0;

        result.cabling.expected += lengthFt * varData.expected * environmentModifier;
        result.cabling.min += lengthFt * varData.min * environmentModifier;
        result.cabling.max += lengthFt * varData.max * environmentModifier;
        result.cabling.failureRisk += varData.failureRate * varData.recoveryMin;
      });
    });
  });

  // Integrations with variance
  (integrationIds || []).forEach(id => {
    const varData = VARIABILITY_DB.integrations[id];
    if (!varData) return;

    result.integrations.expected += varData.expected;
    result.integrations.min += varData.min;
    result.integrations.max += varData.max;
    result.integrations.failureRisk += varData.failureRate * varData.recoveryMin;
  });

  return result;
}

/**
 * Calculate DCI complexity modifier based on restaurant characteristics
 * DCI = f(T, F, I) where:
 *   T = Variability of Work (time variance)
 *   F = Failure Rate (historical probability)
 *   I = Hardware Interactions (network topology complexity)
 */
function getComplexityModifier(config) {
  let modifier = 1.0;
  const factors = [];

  // Service Style
  if (config.serviceStyle && SERVICE_STYLE_MODIFIERS[config.serviceStyle]) {
    const styleModifier = SERVICE_STYLE_MODIFIERS[config.serviceStyle];
    modifier *= styleModifier;
    if (styleModifier !== 1.0) {
      factors.push({
        type: 'service_style',
        value: config.serviceStyle,
        modifier: styleModifier
      });
    }
  }

  // Menu Complexity
  if (config.menuComplexity && MENU_COMPLEXITY_MODIFIERS[config.menuComplexity]) {
    const menuModifier = MENU_COMPLEXITY_MODIFIERS[config.menuComplexity];
    modifier *= menuModifier;
    if (menuModifier !== 1.0) {
      factors.push({
        type: 'menu_complexity',
        value: config.menuComplexity,
        modifier: menuModifier
      });
    }
  }

  // Bar Program
  if (config.barProgram && BAR_PROGRAM_MODIFIERS[config.barProgram]) {
    const barModifier = BAR_PROGRAM_MODIFIERS[config.barProgram];
    modifier *= barModifier;
    if (barModifier !== 1.0) {
      factors.push({
        type: 'bar_program',
        value: config.barProgram,
        modifier: barModifier
      });
    }
  }

  // Environmental factors
  const envResult = getEnvironmentalModifier(config);
  if (envResult.modifier !== 1.0) {
    modifier *= envResult.modifier;
    factors.push(...envResult.factors);
  }

  // Station Criticality Index
  const criticalityResult = calculateStationCriticalityIndex(config.floors);
  if (criticalityResult.modifier > 1.0) {
    modifier *= criticalityResult.modifier;
    factors.push({
      type: 'station_criticality',
      value: criticalityResult.avgCriticality,
      modifier: criticalityResult.modifier,
      criticalItems: criticalityResult.criticalItems
    });
  }

  // Station complexity: >5 stations adds 3% per extra station
  const stationCount = (config.floors || []).reduce(
    (sum, f) => sum + (f.stations?.length || 0), 0
  );
  if (stationCount > 5) {
    const stationModifier = 1 + ((stationCount - 5) * 0.03);
    modifier *= stationModifier;
    factors.push({
      type: 'station_count',
      value: stationCount,
      modifier: stationModifier
    });
  }

  // KDS presence adds 10%
  const hasKDS = (config.floors || []).some(f =>
    (f.stations || []).some(s =>
      (s.hardware || []).some(hw => hw.hid === 'toast-kds')
    )
  );
  if (hasKDS) {
    modifier *= 1.10;
    factors.push({
      type: 'kds_present',
      value: true,
      modifier: 1.10
    });
  }

  // Multiple printers adds 8% (routing complexity)
  const printerCount = (config.floors || []).reduce((sum, f) =>
    sum + (f.stations || []).reduce((s, st) =>
      s + (st.hardware || []).filter(hw =>
        ['receipt-printer', 'impact-printer', 'label-printer'].includes(hw.hid)
      ).length, 0
    ), 0
  );
  if (printerCount > 2) {
    modifier *= 1.08;
    factors.push({
      type: 'multi_printer',
      value: printerCount,
      modifier: 1.08
    });
  }

  return { modifier: Math.round(modifier * 100) / 100, factors };
}

/**
 * Calculate applicable discounts
 */
function calculateDiscounts(config, baseTotal, deviceCount) {
  const discounts = [];
  let totalDiscount = 0;

  // Volume discount based on device count
  for (const tier of VOLUME_DISCOUNT_TIERS) {
    if (deviceCount >= tier.minDevices) {
      discounts.push({
        type: 'volume',
        reason: `${tier.minDevices}+ devices`,
        percentage: tier.discount
      });
      totalDiscount += tier.discount;
      break; // Only apply highest tier
    }
  }

  // Multi-location discount
  const locationCount = config.locationCount || 1;
  if (locationCount > 1) {
    const multiLocDiscount = Math.min(
      (locationCount - 1) * MULTI_LOCATION_DISCOUNT_PER,
      MAX_MULTI_LOCATION_DISCOUNT
    );
    discounts.push({
      type: 'multi_location',
      reason: `${locationCount} locations`,
      percentage: multiLocDiscount
    });
    totalDiscount += multiLocDiscount;
  }

  // Loyalty discount for existing clients
  if (config.isExistingClient) {
    discounts.push({
      type: 'loyalty',
      reason: 'Existing client',
      percentage: 0.10
    });
    totalDiscount += 0.10;
  }

  // Referral credit (Toast referral)
  let referralCredit = 0;
  if (config.hasToastReferral) {
    referralCredit = 1000; // $1,000 flat credit
    discounts.push({
      type: 'referral',
      reason: 'Toast referral credit',
      creditAmount: referralCredit
    });
  }

  // Cap total percentage discount at 30%
  totalDiscount = Math.min(totalDiscount, 0.30);

  const discountAmount = baseTotal * totalDiscount;
  const finalTotal = baseTotal - discountAmount - referralCredit;

  return {
    discounts,
    totalPercentage: Math.round(totalDiscount * 100) / 100,
    discountAmount: Math.round(discountAmount * 100) / 100,
    referralCredit,
    finalTotal: Math.max(0, Math.round(finalTotal * 100) / 100)
  };
}

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

  // Get environmental modifier first (affects time calculations)
  const envResult = getEnvironmentalModifier(config);

  // Calculate time with variance from Variability Database
  const timeVariance = calculateTimeWithVariance(floors, integrationIds, envResult.modifier);

  const breakdown = {
    items: [],
    mins: { hardware: 0, overhead: 0, integrations: 0, cabling: 0 },
    variance: timeVariance
  };

  // Track device count for volume discounts
  let deviceCount = 0;

  // Calculate labor for all floors (using expected values for pricing)
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

        deviceCount++; // Count all devices for volume discount

        const hwExisting = hw.flags?.existing && !hw.flags?.replace;
        if (stationExisting || hwExisting) return;

        // Apply environmental modifier to hardware TTI
        const adjustedTTI = tti * envResult.modifier;
        breakdown.mins.hardware += adjustedTTI;
        breakdown.items.push({
          type: 'hardware',
          label: `${hw.hid} - ${station.name}`,
          minutes: adjustedTTI,
          criticality: STATION_CRITICALITY_WEIGHTS[hw.hid] || 1.0
        });
      });
    });

    // Cable runs
    (floor.layers || []).filter(l => l.type === 'network').forEach(layer => {
      (layer.cableRuns || []).forEach(run => {
        const adjustedTTI = run.ttiMin * envResult.modifier;
        breakdown.mins.cabling += adjustedTTI;
        breakdown.items.push({
          type: 'cabling',
          label: `Cable run ${run.lengthFt} ft`,
          minutes: adjustedTTI
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

  // Calculate base totals using expected times
  const totalMin = Object.values(breakdown.mins).reduce((a, b) => a + b, 0);
  const baseInstallCost = (totalMin / 60) * RATES.hourly;
  const travelCost = calculateTravelCost(travel);

  // Apply DCI Algorithm
  const complexityResult = getComplexityModifier(config);
  const adjustedInstallCost = baseInstallCost * complexityResult.modifier;

  // Calculate discounts on the complexity-adjusted total
  const subtotalBeforeDiscount = adjustedInstallCost + travelCost;
  const discountResult = calculateDiscounts(config, subtotalBeforeDiscount, deviceCount);

  // Support plan calculations (based on adjusted install cost)
  const tierPct = (supportTier || 0) / 100;
  const supportMonthly = tierPct * adjustedInstallCost;
  const supportAnnual = supportMonthly * 12 * ANNUAL_DISCOUNT;
  const supportNow = supportPeriod === 'annual' ? supportAnnual : supportMonthly;

  // Final totals
  const installAfterDiscount = discountResult.finalTotal;
  const combinedFirst = installAfterDiscount + supportNow;

  // Calculate time range from Variability Database
  const totalExpected = timeVariance.hardware.expected +
    timeVariance.integrations.expected +
    timeVariance.cabling.expected +
    timeVariance.overhead;
  const totalMin_low = timeVariance.hardware.min +
    timeVariance.integrations.min +
    timeVariance.cabling.min +
    timeVariance.overhead;
  const totalMax = timeVariance.hardware.max +
    timeVariance.integrations.max +
    timeVariance.cabling.max +
    timeVariance.overhead;

  // Calculate expected failure time contribution
  const failureRiskTime = timeVariance.hardware.failureRisk +
    timeVariance.integrations.failureRisk +
    timeVariance.cabling.failureRisk;

  // Station criticality calculation
  const criticalityResult = calculateStationCriticalityIndex(floors);

  return {
    // Detailed breakdown (without revealing TTI formulas)
    items: breakdown.items.map(item => ({
      type: item.type,
      label: item.label,
      // Don't expose minutes - only show dollars
      cost: (item.minutes / 60) * RATES.hourly,
      criticality: item.criticality
    })),
    // Summary totals
    summary: {
      hardwareCost: (breakdown.mins.hardware / 60) * RATES.hourly,
      overheadCost: (breakdown.mins.overhead / 60) * RATES.hourly,
      integrationsCost: (breakdown.mins.integrations / 60) * RATES.hourly,
      cablingCost: (breakdown.mins.cabling / 60) * RATES.hourly,
      baseInstallCost,
      complexityAdjustment: adjustedInstallCost - baseInstallCost,
      environmentalAdjustment: envResult.modifier !== 1.0 ?
        (baseInstallCost * (envResult.modifier - 1)) : 0,
      installCost: adjustedInstallCost,
      travelCost,
      subtotalBeforeDiscount,
      discountAmount: discountResult.discountAmount,
      referralCredit: discountResult.referralCredit,
      installAfterDiscount,
      supportMonthly,
      supportAnnual,
      totalFirst: combinedFirst
    },
    // DCI Intelligence breakdown (for transparency)
    dci: {
      complexityModifier: complexityResult.modifier,
      complexityFactors: complexityResult.factors,
      environmentalModifier: envResult.modifier,
      environmentalFactors: envResult.factors,
      stationCriticality: {
        avgCriticality: criticalityResult.avgCriticality,
        totalWeight: criticalityResult.totalWeight,
        criticalItems: criticalityResult.criticalItems.slice(0, 5) // Limit for response size
      },
      discounts: discountResult.discounts,
      totalDiscountPercent: discountResult.totalPercentage,
      deviceCount
    },
    // Time estimate from Variability Database (range, not exact)
    timeEstimate: {
      minHours: Math.floor(totalMin_low / 60),
      expectedHours: Math.round(totalExpected / 60),
      maxHours: Math.ceil(totalMax / 60),
      failureRiskMinutes: Math.round(failureRiskTime),
      // Confidence range: min to max with failure buffer
      withBuffer: {
        optimistic: Math.floor(totalMin_low / 60),
        expected: Math.round((totalExpected + failureRiskTime * 0.5) / 60),
        conservative: Math.ceil((totalMax + failureRiskTime) / 60)
      }
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

    // ============================================
    // CLIENT INTELLIGENCE INTEGRATION
    // Fetch and apply intelligence if client_id or lead_id provided
    // ============================================
    let intelligence = { found: false, source: null, data: null };
    let enhancedConfig = config;

    if ((config.client_id || config.lead_id) && env.DB) {
      try {
        intelligence = await fetchClientIntelligence(env, config);
        if (intelligence.found) {
          enhancedConfig = applyIntelligenceToConfig(config, intelligence);
        }
      } catch (e) {
        console.log('Intelligence lookup error (non-fatal):', e.message);
      }
    }

    const quote = calculateQuote(enhancedConfig);

    // Add intelligence metadata to response
    const response = {
      success: true,
      quote,
      generatedAt: new Date().toISOString()
    };

    // Include intelligence data if found
    if (intelligence.found) {
      response.intelligence = {
        source: intelligence.source,
        confidence: intelligence.confidence,
        applied: enhancedConfig._intelligenceApplied || [],
        profile: {
          name: intelligence.data.name,
          address: intelligence.data.address,
          cuisine_type: intelligence.data.cuisine_type,
          service_style: intelligence.data.service_style,
          bar_program: intelligence.data.bar_program,
          menu_complexity: intelligence.data.menu_complexity,
          seating_capacity: intelligence.data.seating_capacity,
          pos_system: intelligence.data.pos_system
        },
        stationEstimate: intelligence.data.seating_capacity
          ? estimateStationsFromSeating(intelligence.data.seating_capacity)
          : null
      };
    }

    return new Response(JSON.stringify(response), {
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
