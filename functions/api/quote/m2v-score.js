/**
 * M2V (Menu to Venue) Scoring API
 *
 * POST /api/quote/m2v-score
 * GET /api/quote/m2v-score?lead_id=xxx or ?client_id=xxx
 *
 * Composite assessment equation for venue scoring:
 * M2V = w_M·Q̃ + w_P·CM̃ + w_O·Occ̃ - w_R·RevPASH̃ + w_L·(1-Labor%̃) - w_S·(1-TCÕ) + w_V·SI_peak
 *
 * Determines optimal:
 * - Menu structure
 * - Modifier configurations
 * - POS station layout
 * - Integration recommendations
 */

import { getCorsOrigin } from '../../_shared/auth.js';
import { rateLimit, RATE_LIMITS } from '../../_shared/rate-limit.js';

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

// ============================================
// M2V WEIGHTS BY RESTAURANT CATEGORY
// Calibrated coefficients for venue-specific recommendations
// ============================================

const M2V_WEIGHTS = {
  fine_dining: {
    w_M: 0.20,   // Demand sensitivity weight
    w_P: 0.25,   // Contribution margin weight
    w_O: 0.15,   // Occupancy rate weight
    w_R: 0.10,   // RevPASH weight (negative in formula)
    w_L: 0.10,   // Labor efficiency weight
    w_S: 0.10,   // TCO weight (negative in formula)
    w_V: 0.10,   // Peak sourcing complexity weight
    description: 'Emphasis on contribution margin and demand sensitivity'
  },
  upscale_casual: {
    w_M: 0.18,
    w_P: 0.22,
    w_O: 0.18,
    w_R: 0.12,
    w_L: 0.12,
    w_S: 0.08,
    w_V: 0.10,
    description: 'Balanced approach with slight margin emphasis'
  },
  full_service: {
    w_M: 0.15,
    w_P: 0.20,
    w_O: 0.20,
    w_R: 0.15,
    w_L: 0.12,
    w_S: 0.10,
    w_V: 0.08,
    description: 'Occupancy and margin balance'
  },
  fast_casual: {
    w_M: 0.12,
    w_P: 0.18,
    w_O: 0.22,
    w_R: 0.18,
    w_L: 0.15,
    w_S: 0.08,
    w_V: 0.07,
    description: 'Volume and efficiency focus'
  },
  quick_service: {
    w_M: 0.10,
    w_P: 0.15,
    w_O: 0.25,
    w_R: 0.20,
    w_L: 0.18,
    w_S: 0.07,
    w_V: 0.05,
    description: 'High throughput and labor efficiency priority'
  },
  bar_forward: {
    w_M: 0.15,
    w_P: 0.28,   // High margin on drinks
    w_O: 0.18,
    w_R: 0.12,
    w_L: 0.08,
    w_S: 0.08,
    w_V: 0.11,   // Sourcing complexity for spirits
    description: 'Beverage margin optimization'
  },
  cafe: {
    w_M: 0.14,
    w_P: 0.22,
    w_O: 0.20,
    w_R: 0.16,
    w_L: 0.14,
    w_S: 0.08,
    w_V: 0.06,
    description: 'Steady flow with margin focus'
  },
  food_truck: {
    w_M: 0.08,
    w_P: 0.20,
    w_O: 0.15,
    w_R: 0.22,   // Speed is critical
    w_L: 0.20,   // Labor efficiency critical
    w_S: 0.10,
    w_V: 0.05,
    description: 'Speed and labor efficiency for mobile operation'
  }
};

// ============================================
// NORMALIZATION FUNCTIONS
// Convert raw metrics to 0-1 scale
// ============================================

/**
 * Normalize demand sensitivity (0-1)
 * Based on price elasticity and seasonal variation
 */
function normalizeDemandSensitivity(data) {
  const { priceElasticity = 0, seasonalVariation = 0, menuItemCount = 50 } = data;

  // Lower elasticity = less sensitive = better for pricing power
  const elasticityScore = Math.max(0, 1 - Math.abs(priceElasticity));

  // Lower seasonal variation = more stable
  const seasonalScore = Math.max(0, 1 - (seasonalVariation / 100));

  // Menu flexibility based on item count
  const menuScore = Math.min(1, menuItemCount / 150);

  return (elasticityScore * 0.4 + seasonalScore * 0.3 + menuScore * 0.3);
}

/**
 * Normalize contribution margin (0-1)
 * Target: 70%+ food cost for fine dining, 60%+ for casual
 */
function normalizeContributionMargin(data) {
  const { foodCostPct = 30, beverageCostPct = 20, overallMargin = 0 } = data;

  // Food margin: 100 - food cost %
  const foodMargin = (100 - foodCostPct) / 100;

  // Beverage margin (typically higher)
  const bevMargin = (100 - beverageCostPct) / 100;

  // Overall margin if provided, otherwise blend
  const blendedMargin = overallMargin > 0
    ? overallMargin / 100
    : (foodMargin * 0.65 + bevMargin * 0.35);

  // Normalize to 0-1 with target at 0.70 = 1.0
  return Math.min(1, blendedMargin / 0.70);
}

/**
 * Normalize occupancy rate (0-1)
 */
function normalizeOccupancy(data) {
  const { avgOccupancy = 50, peakOccupancy = 80, seatingCapacity = 50 } = data;

  // Weighted average of normal and peak occupancy
  const occupancyPct = (avgOccupancy * 0.7 + peakOccupancy * 0.3) / 100;

  return Math.min(1, occupancyPct);
}

/**
 * Normalize RevPASH (Revenue Per Available Seat Hour)
 * Higher is better, normalized against industry benchmarks
 */
function normalizeRevPASH(data, serviceStyle) {
  const { revPASH = 0, avgCheck = 0, turnRate = 0, seatingCapacity = 50 } = data;

  // Calculate RevPASH if not provided
  let calculatedRevPASH = revPASH;
  if (!revPASH && avgCheck && turnRate) {
    calculatedRevPASH = avgCheck * turnRate;
  }

  // Benchmarks by service style ($ per seat per hour)
  const benchmarks = {
    fine_dining: 45,
    upscale_casual: 35,
    full_service: 25,
    fast_casual: 40,
    quick_service: 50,
    bar_forward: 30,
    cafe: 15,
    food_truck: 35
  };

  const benchmark = benchmarks[serviceStyle] || 25;

  return Math.min(1, calculatedRevPASH / benchmark);
}

/**
 * Normalize labor cost percentage (0-1)
 * Lower is better, inverted in formula
 */
function normalizeLaborCost(data) {
  const { laborCostPct = 30, fohLabor = 15, bohLabor = 15 } = data;

  const totalLabor = laborCostPct || (fohLabor + bohLabor);

  // Target labor cost: 25-30% is ideal
  // Higher = worse, so we invert: 1 - (labor/40)
  return Math.max(0, Math.min(1, 1 - (totalLabor / 40)));
}

/**
 * Normalize Total Cost of Ownership (0-1)
 * Lower is better, inverted in formula
 */
function normalizeTCO(data) {
  const {
    monthlyPOSCost = 0,
    monthlyIntegrations = 0,
    hardwareAmortized = 0,
    maintenanceCost = 0
  } = data;

  const totalMonthlyTCO = monthlyPOSCost + monthlyIntegrations + hardwareAmortized + maintenanceCost;

  // Benchmark: $500/month is typical, $1500/month is high
  // Normalize: lower is better
  return Math.max(0, Math.min(1, 1 - (totalMonthlyTCO / 1500)));
}

/**
 * Normalize Peak Sourcing Complexity (0-1)
 * Based on menu complexity, supplier count, seasonal ingredients
 */
function normalizeSourcingComplexity(data) {
  const {
    menuItemCount = 50,
    uniqueIngredients = 0,
    supplierCount = 5,
    seasonalItems = 0,
    localSourcingPct = 0
  } = data;

  // More ingredients = more complexity (can be positive for uniqueness)
  const ingredientScore = Math.min(1, uniqueIngredients / 200);

  // More suppliers = more complexity but also resilience
  const supplierScore = Math.min(1, supplierCount / 15);

  // Seasonal items add value but complexity
  const seasonalScore = Math.min(1, seasonalItems / menuItemCount);

  // Local sourcing is positive
  const localScore = localSourcingPct / 100;

  return (ingredientScore * 0.3 + supplierScore * 0.2 + seasonalScore * 0.3 + localScore * 0.2);
}

// ============================================
// M2V CALCULATION
// ============================================

/**
 * Calculate M2V Score
 *
 * M2V = w_M·Q̃ + w_P·CM̃ + w_O·Occ̃ - w_R·RevPASH̃ + w_L·(1-Labor%̃) - w_S·(1-TCÕ) + w_V·SI_peak
 */
function calculateM2V(data, serviceStyle = 'full_service') {
  const weights = M2V_WEIGHTS[serviceStyle] || M2V_WEIGHTS.full_service;

  // Normalize all inputs
  const Q = normalizeDemandSensitivity(data);
  const CM = normalizeContributionMargin(data);
  const Occ = normalizeOccupancy(data);
  const RevPASH = normalizeRevPASH(data, serviceStyle);
  const Labor = normalizeLaborCost(data);
  const TCO = normalizeTCO(data);
  const SI = normalizeSourcingComplexity(data);

  // Apply M2V formula
  // Note: RevPASH is subtracted because higher is better (we want to reward high RevPASH)
  // Similarly for TCO
  const m2vScore = (
    (weights.w_M * Q) +
    (weights.w_P * CM) +
    (weights.w_O * Occ) -
    (weights.w_R * (1 - RevPASH)) +  // Subtract penalty for low RevPASH
    (weights.w_L * Labor) -           // Labor already inverted in normalization
    (weights.w_S * (1 - TCO)) +       // Subtract penalty for high TCO
    (weights.w_V * SI)
  );

  // Normalize final score to 0-100
  const normalizedScore = Math.round(Math.max(0, Math.min(100, m2vScore * 100)));

  return {
    score: normalizedScore,
    components: {
      demand_sensitivity: { value: Q, weight: weights.w_M, contribution: Q * weights.w_M },
      contribution_margin: { value: CM, weight: weights.w_P, contribution: CM * weights.w_P },
      occupancy: { value: Occ, weight: weights.w_O, contribution: Occ * weights.w_O },
      revPASH: { value: RevPASH, weight: weights.w_R, contribution: -(1 - RevPASH) * weights.w_R },
      labor_efficiency: { value: Labor, weight: weights.w_L, contribution: Labor * weights.w_L },
      tco_efficiency: { value: TCO, weight: weights.w_S, contribution: -(1 - TCO) * weights.w_S },
      sourcing_complexity: { value: SI, weight: weights.w_V, contribution: SI * weights.w_V }
    },
    weights,
    serviceStyle
  };
}

/**
 * Generate recommendations based on M2V score and components
 */
function generateRecommendations(m2vResult) {
  const recommendations = {
    menuStructure: [],
    modifiers: [],
    pos: [],
    integrations: [],
    pricing: []
  };

  const { components, serviceStyle, score } = m2vResult;

  // Menu structure recommendations
  if (components.contribution_margin.value < 0.6) {
    recommendations.menuStructure.push({
      priority: 'high',
      action: 'Review menu pricing',
      detail: 'Contribution margin below target. Consider menu engineering to identify low-margin items.'
    });
  }

  if (components.sourcing_complexity.value > 0.7) {
    recommendations.menuStructure.push({
      priority: 'medium',
      action: 'Streamline ingredient sourcing',
      detail: 'High sourcing complexity. Consider ingredient consolidation for prep efficiency.'
    });
  }

  // Modifier recommendations
  if (['fine_dining', 'upscale_casual', 'bar_forward'].includes(serviceStyle)) {
    recommendations.modifiers.push({
      priority: 'medium',
      action: 'Implement comprehensive modifier groups',
      detail: 'Service style benefits from detailed customization options.'
    });
  }

  if (serviceStyle === 'bar_forward') {
    recommendations.modifiers.push({
      priority: 'high',
      action: 'Use spirit-state modifier model',
      detail: 'Implement Martini/Manhattan inventory logic for accurate spirit tracking.'
    });
  }

  // POS recommendations
  if (components.labor_efficiency.value < 0.5) {
    recommendations.pos.push({
      priority: 'high',
      action: 'Optimize station placement',
      detail: 'Labor efficiency below target. Review station layout for reduced steps.'
    });
  }

  if (components.revPASH.value > 0.8) {
    recommendations.pos.push({
      priority: 'medium',
      action: 'Consider additional payment terminals',
      detail: 'High throughput venue. Additional terminals reduce checkout bottlenecks.'
    });
  }

  // Integration recommendations
  if (components.tco_efficiency.value < 0.5) {
    recommendations.integrations.push({
      priority: 'medium',
      action: 'Audit integration stack',
      detail: 'TCO above benchmarks. Review integration necessity and consolidate where possible.'
    });
  }

  if (components.occupancy.value > 0.7 && serviceStyle !== 'quick_service') {
    recommendations.integrations.push({
      priority: 'medium',
      action: 'Consider reservation system',
      detail: 'High occupancy rates suggest demand for table management.'
    });
  }

  // Pricing recommendations
  if (components.demand_sensitivity.value > 0.7) {
    recommendations.pricing.push({
      priority: 'medium',
      action: 'Implement dynamic pricing capability',
      detail: 'Low price sensitivity enables strategic pricing adjustments.'
    });
  }

  // Overall score-based recommendations
  if (score >= 80) {
    recommendations.overall = {
      status: 'Optimized',
      summary: 'Venue metrics are well-aligned. Focus on maintaining performance.',
      priority_focus: 'Innovation and expansion opportunities'
    };
  } else if (score >= 60) {
    recommendations.overall = {
      status: 'Performing',
      summary: 'Good foundation with optimization opportunities.',
      priority_focus: recommendations.menuStructure.length > 0 ? 'Menu engineering' : 'Operational efficiency'
    };
  } else if (score >= 40) {
    recommendations.overall = {
      status: 'Developing',
      summary: 'Multiple areas need attention. Prioritize high-impact changes.',
      priority_focus: 'Core operations stabilization'
    };
  } else {
    recommendations.overall = {
      status: 'Needs Attention',
      summary: 'Significant improvements needed. Start with fundamentals.',
      priority_focus: 'Basic menu and labor optimization'
    };
  }

  return recommendations;
}

// ============================================
// API HANDLERS
// ============================================

export async function onRequestGet(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  const rateLimitResponse = await rateLimit(
    request, env.RATE_LIMIT_KV, 'm2v-score', RATE_LIMITS.API_READ, corsHeaders
  );
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const url = new URL(request.url);
    const leadId = url.searchParams.get('lead_id');
    const clientId = url.searchParams.get('client_id');

    if (!leadId && !clientId) {
      // Return formula documentation
      return new Response(JSON.stringify({
        success: true,
        data: {
          formula: 'M2V = w_M·Q̃ + w_P·CM̃ + w_O·Occ̃ - w_R·RevPASH̃ + w_L·(1-Labor%̃) - w_S·(1-TCÕ) + w_V·SI_peak',
          components: {
            'Q̃': 'Demand Sensitivity (price elasticity, seasonal variation)',
            'CM̃': 'Contribution Margin (food cost, beverage cost)',
            'Occ̃': 'Occupancy Rate (average and peak)',
            'RevPASH̃': 'Revenue Per Available Seat Hour',
            'Labor%̃': 'Labor Cost Percentage',
            'TCÕ': 'Total Cost of Ownership (POS, integrations, maintenance)',
            'SI_peak': 'Peak Sourcing Complexity'
          },
          weights: M2V_WEIGHTS,
          usage: 'POST with venue data, or GET with lead_id/client_id'
        }
      }), { headers: corsHeaders });
    }

    // Fetch venue data from database
    let venueData = null;
    let serviceStyle = 'full_service';

    if (clientId) {
      const profile = await env.DB.prepare(`
        SELECT cp.*, c.company
        FROM client_profiles cp
        JOIN clients c ON c.id = cp.client_id
        WHERE cp.client_id = ?
      `).bind(clientId).first();

      if (profile) {
        serviceStyle = profile.service_style || 'full_service';
        venueData = {
          seatingCapacity: profile.seating_capacity || 50,
          menuItemCount: profile.menu_item_count || 50,
          avgCheck: profile.avg_check || 0,
          avgOccupancy: profile.avg_occupancy || 50,
          foodCostPct: profile.food_cost_pct || 30,
          laborCostPct: profile.labor_cost_pct || 30
        };
      }
    }

    if (leadId && !venueData) {
      const lead = await env.DB.prepare(`
        SELECT * FROM restaurant_leads WHERE id = ?
      `).bind(leadId).first();

      if (lead) {
        serviceStyle = lead.service_style_hint || 'full_service';
        venueData = {
          seatingCapacity: lead.seating_capacity_hint || 50,
          menuItemCount: lead.menu_size_hint || 50,
          avgOccupancy: 50 // Default estimate
        };
      }
    }

    if (!venueData) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Client or lead not found'
      }), { status: 404, headers: corsHeaders });
    }

    const m2vResult = calculateM2V(venueData, serviceStyle);
    const recommendations = generateRecommendations(m2vResult);

    return new Response(JSON.stringify({
      success: true,
      data: {
        m2v_score: m2vResult.score,
        service_style: serviceStyle,
        components: m2vResult.components,
        recommendations
      }
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('M2V GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: corsHeaders });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  const rateLimitResponse = await rateLimit(
    request, env.RATE_LIMIT_KV, 'm2v-score', RATE_LIMITS.API_WRITE, corsHeaders
  );
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const { venueData, serviceStyle = 'full_service' } = body;

    if (!venueData) {
      return new Response(JSON.stringify({
        success: false,
        error: 'venueData is required'
      }), { status: 400, headers: corsHeaders });
    }

    const m2vResult = calculateM2V(venueData, serviceStyle);
    const recommendations = generateRecommendations(m2vResult);

    return new Response(JSON.stringify({
      success: true,
      data: {
        m2v_score: m2vResult.score,
        service_style: serviceStyle,
        components: m2vResult.components,
        weights_used: m2vResult.weights,
        recommendations,
        formula: 'M2V = w_M·Q̃ + w_P·CM̃ + w_O·Occ̃ - w_R·RevPASH̃ + w_L·(1-Labor%̃) - w_S·(1-TCÕ) + w_V·SI_peak'
      }
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('M2V POST error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: corsHeaders });
  }
}

export async function onRequestOptions(context) {
  const { request } = context;
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': getCorsOrigin(request),
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    }
  });
}
