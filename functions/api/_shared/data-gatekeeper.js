/**
 * Data Gatekeeper - Privacy Filter Layer
 * ========================================
 * CRITICAL: This module enforces the strict data boundary between
 * the Data Context Engine (personal + business data) and
 * the Business Platform (business data ONLY).
 *
 * RULE: Personal data NEVER enters the business database.
 *
 * Privacy Levels:
 *   'business' → ALLOW (business operations data)
 *   'public'   → ALLOW (publicly available info)
 *   'private'  → DISCARD (personal/private data)
 *
 * Tag-based filtering:
 *   Tags containing business keywords → ALLOW
 *   Tags containing 'personal' → DISCARD
 *   No tags + private level → DISCARD
 */

// Tags that indicate business-relevant data
const BUSINESS_TAGS = [
  'business', 'restaurant', 'lead', 'client', 'rep', 'toast', 'pos',
  'menu', 'support', 'billing', 'invoice', 'ticket', 'project',
  'meeting', 'discovery', 'onboarding', 'outreach', 'prospect',
  'implementation', 'training', 'audit', 'network', 'cabling',
  'quote', 'subscription', 'referral', 'commission'
];

// Tags that explicitly mark personal data (immediate discard)
const PERSONAL_TAGS = [
  'personal', 'private', 'health', 'medical', 'family',
  'hobby', 'dating', 'finance_personal', 'home', 'household'
];

// Sources that are always business-relevant
const BUSINESS_SOURCES = [
  'hubspot', 'square', 'stripe', 'resend', 'cal.com',
  'toast', 'builtwith', 'website', 'admin_portal'
];

// Sources that need tag-based filtering (could be personal or business)
const MIXED_SOURCES = [
  'gmail', 'calendar', 'drive', 'sms', 'call', 'limitless',
  'device', 'google', 'location'
];

/**
 * Determine if a single item passes the business data filter.
 *
 * @param {Object} item - The data item to evaluate
 * @param {string} item.privacy_level - 'private', 'business', or 'public'
 * @param {string} [item.tags] - Comma-separated tags
 * @param {string} [item.source] - Data source identifier
 * @param {string} [item.data_tag] - Explicit data classification tag
 * @returns {Object|null} - The item if it passes, null if filtered out
 */
export function filterItem(item) {
  if (!item) return null;

  const privacyLevel = (item.privacy_level || 'private').toLowerCase();
  const source = (item.source || '').toLowerCase();
  const dataTag = (item.data_tag || '').toLowerCase();

  // RULE 1: Explicit 'business' or 'public' privacy level → ALLOW
  if (privacyLevel === 'business' || privacyLevel === 'public') {
    return item;
  }

  // RULE 2: Explicit personal data_tag → DISCARD
  if (dataTag === 'personal' || PERSONAL_TAGS.includes(dataTag)) {
    return null;
  }

  // RULE 3: Explicit business data_tag → ALLOW
  if (dataTag === 'business' || dataTag === 'restaurant' || dataTag === 'lead') {
    return item;
  }

  // RULE 4: Known business source → ALLOW regardless of privacy_level
  if (BUSINESS_SOURCES.includes(source)) {
    return item;
  }

  // RULE 5: Check tags for business or personal indicators
  if (item.tags) {
    const tags = typeof item.tags === 'string'
      ? item.tags.split(',').map(t => t.trim().toLowerCase())
      : Array.isArray(item.tags) ? item.tags.map(t => t.toLowerCase()) : [];

    // Any personal tag → DISCARD
    if (tags.some(t => PERSONAL_TAGS.includes(t))) {
      return null;
    }

    // Any business tag → ALLOW
    if (tags.some(t => BUSINESS_TAGS.includes(t))) {
      return item;
    }
  }

  // RULE 6: Mixed source with no clear tags and private level → DISCARD
  // This is the conservative default: when in doubt, don't import
  if (privacyLevel === 'private') {
    return null;
  }

  // If we somehow get here (unknown privacy level, no tags), allow but log
  return item;
}

/**
 * Filter a batch of items through the gatekeeper.
 *
 * @param {Array} items - Array of data items
 * @returns {Object} - { allowed: [...], discarded: count }
 */
export function filterBatch(items) {
  if (!items || !Array.isArray(items)) {
    return { allowed: [], discarded: 0 };
  }

  const allowed = [];
  let discarded = 0;

  for (const item of items) {
    const result = filterItem(item);
    if (result !== null) {
      allowed.push(result);
    } else {
      discarded++;
    }
  }

  return { allowed, discarded };
}

/**
 * Apply privacy filter to a database query result.
 * Use this when reading FROM the database (defense in depth).
 *
 * @param {Array} rows - Database query results
 * @returns {Array} - Filtered rows (only business/public data)
 */
export function filterQueryResults(rows) {
  if (!rows || !Array.isArray(rows)) return [];

  return rows.filter(row => {
    const privacy = (row.privacy_level || 'private').toLowerCase();
    return privacy === 'business' || privacy === 'public';
  });
}

/**
 * Classify an item's privacy level based on its content and metadata.
 * Used when the source doesn't provide explicit privacy classification.
 *
 * @param {Object} item - The item to classify
 * @returns {string} - 'business', 'personal', or 'private' (unknown/default)
 */
export function classifyPrivacy(item) {
  const source = (item.source || '').toLowerCase();
  const content = (item.content || item.summary || '').toLowerCase();
  const tags = (item.tags || '').toLowerCase();

  // Known business sources
  if (BUSINESS_SOURCES.includes(source)) return 'business';

  // Content-based heuristics for business classification
  const businessKeywords = [
    'restaurant', 'toast', 'pos', 'menu', 'client', 'invoice',
    'support plan', 'implementation', 'discovery call', 'onboarding',
    'r&g consulting', 'cape cod cable', 'networking', 'cabling'
  ];

  if (businessKeywords.some(kw => content.includes(kw))) return 'business';
  if (BUSINESS_TAGS.some(t => tags.includes(t))) return 'business';
  if (PERSONAL_TAGS.some(t => tags.includes(t))) return 'personal';

  // Default: private (blocked until classified)
  return 'private';
}

/**
 * Get gatekeeper statistics for logging/monitoring.
 *
 * @param {Array} items - Original items before filtering
 * @param {Array} allowed - Items that passed the filter
 * @returns {Object} - Stats object for logging
 */
export function getFilterStats(items, allowed) {
  return {
    total: items.length,
    allowed: allowed.length,
    discarded: items.length - allowed.length,
    rate: items.length > 0
      ? Math.round((allowed.length / items.length) * 100)
      : 0
  };
}
