/**
 * Support Plan Pricing Constants
 *
 * SINGLE SOURCE OF TRUTH for all support plan pricing.
 * This file is the authoritative source - all other files should import from here.
 *
 * NOTE: Frontend files (PortalBilling.tsx, ClientForm.tsx) have their own copies
 * for display purposes. Those should be updated manually if pricing changes.
 *
 * Pricing last updated: 2026-01-08
 */

// Valid support plan tiers
export const SUPPORT_PLAN_TIERS = ['core', 'professional', 'premium'];

// Monthly prices in cents (for Square API)
export const SUPPORT_PLAN_PRICES_CENTS = {
  core: 35000,         // $350/month
  professional: 50000, // $500/month
  premium: 80000       // $800/month
};

// Monthly prices in dollars (for display)
export const SUPPORT_PLAN_PRICES = {
  core: 350,
  professional: 500,
  premium: 800
};

// Quarterly prices in cents (3 months, no discount)
export const SUPPORT_PLAN_QUARTERLY_CENTS = {
  core: 105000,        // $1,050/quarter
  professional: 150000, // $1,500/quarter
  premium: 240000      // $2,400/quarter
};

// Annual prepay prices in cents (11 months - 1 month free)
export const SUPPORT_PLAN_ANNUAL_CENTS = {
  core: 385000,        // $3,850/year (saves $350)
  professional: 550000, // $5,500/year (saves $500)
  premium: 880000      // $8,800/year (saves $800)
};

// Monthly support hours included
export const SUPPORT_PLAN_HOURS = {
  core: 1.5,
  professional: 3,
  premium: 5
};

// Response time SLAs
export const SUPPORT_PLAN_SLA = {
  core: '24-48 hours',
  professional: '4 hours',
  premium: '2 hours'
};

// Plan descriptions
export const SUPPORT_PLAN_DESCRIPTIONS = {
  core: 'Essential coverage for single-location restaurants',
  professional: 'Comprehensive support with faster response',
  premium: 'Full-service partnership for high-volume operations'
};

// Hourly rates for overages and non-plan clients
export const HOURLY_RATES = {
  planOverage: 100,      // $100-125/hr for plan holder overage
  planOverageMax: 125,
  nonPlanSupport: 175,   // $175/hr for clients without support plan
  onSite: 200,           // $200/hr (2hr min) for on-site work
  emergency: 250,        // $250/hr for same-day emergency
  afterHours: 225        // $225/hr for after-hours support
};

// Project pricing
export const PROJECT_PRICING = {
  remoteMenuAudit: 800,
  remoteMenuBuildSmall: 1500,   // ≤100 items
  remoteMenuBuildMedium: 2500,  // 101-250 items
  remoteConfigCleanup: 400,
  fullImplementationBase: 3500,
  fullImplementationPerStation: 350,
  networkInstall: 5000,         // + materials
  toastReferral: 1000           // passive referral income
};

/**
 * Validate if a tier value is valid
 * @param {string} tier - Tier to validate
 * @returns {boolean}
 */
export function isValidTier(tier) {
  return SUPPORT_PLAN_TIERS.includes(tier);
}

/**
 * Get plan details by tier
 * @param {string} tier - Support plan tier
 * @returns {object|null}
 */
export function getPlanDetails(tier) {
  if (!isValidTier(tier)) return null;

  return {
    tier,
    name: tier.charAt(0).toUpperCase() + tier.slice(1),
    priceMonthly: SUPPORT_PLAN_PRICES[tier],
    priceMonthlyCents: SUPPORT_PLAN_PRICES_CENTS[tier],
    priceQuarterlyCents: SUPPORT_PLAN_QUARTERLY_CENTS[tier],
    priceAnnualCents: SUPPORT_PLAN_ANNUAL_CENTS[tier],
    hours: SUPPORT_PLAN_HOURS[tier],
    sla: SUPPORT_PLAN_SLA[tier],
    description: SUPPORT_PLAN_DESCRIPTIONS[tier]
  };
}

/**
 * Normalize tier name (handles legacy 'essential' -> 'core' mapping)
 * @param {string} tier - Tier to normalize
 * @returns {string|null}
 */
export function normalizeTier(tier) {
  if (!tier) return null;

  // Map legacy 'essential' to 'core'
  if (tier === 'essential') return 'core';

  // Return if valid, null otherwise
  return isValidTier(tier) ? tier : null;
}
