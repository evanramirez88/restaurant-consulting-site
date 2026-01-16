/**
 * Web Scraping & Research Library
 *
 * Core utilities for:
 * - Scraping restaurant websites
 * - Detecting technology stacks (POS, online ordering, etc.)
 * - Extracting contact information
 * - Parsing business details from various sources
 */

// Technology detection patterns
export const TECH_PATTERNS = {
  pos_systems: {
    'Toast': [/toast\.?pos/i, /toasttab\.com/i, /pos\.toasttab/i, /"toast"/i],
    'Square': [/square\.?pos/i, /squareup\.com/i, /square for restaurants/i],
    'Clover': [/clover\.com/i, /clover pos/i, /clover network/i],
    'Lightspeed': [/lightspeed/i, /lightspeedhq\.com/i],
    'Aloha': [/aloha pos/i, /ncr\.com.*aloha/i],
    'Micros': [/micros/i, /oracle.*micros/i],
    'Upserve': [/upserve/i, /upserve\.com/i],
    'Revel': [/revelsystems/i, /revel pos/i],
    'TouchBistro': [/touchbistro/i],
    'SpotOn': [/spoton\.com/i, /spoton pos/i],
  },
  online_ordering: {
    'Toast Online Ordering': [/order\.toasttab\.com/i, /toasttab\.com\/order/i],
    'ChowNow': [/chownow\.com/i, /ordering\.chownow/i],
    'DoorDash Storefront': [/doordash\.com.*storefront/i],
    'Square Online': [/squarespace.*order/i, /square.*online.*order/i],
    'BentoBox': [/bentobox/i, /getbento\.com/i],
    'Olo': [/olo\.com/i, /olo ordering/i],
    'Grubhub Direct': [/grubhub.*direct/i],
  },
  reservation_systems: {
    'OpenTable': [/opentable\.com/i, /opentable widget/i],
    'Resy': [/resy\.com/i],
    'Yelp Reservations': [/yelp.*reservations/i],
    'SevenRooms': [/sevenrooms/i],
    'Tock': [/exploretock\.com/i],
  },
  website_platforms: {
    'BentoBox': [/getbento\.com/i, /bentobox/i],
    'Squarespace': [/squarespace/i, /static1\.squarespace/i],
    'Wix': [/wix\.com/i, /wixsite\.com/i],
    'WordPress': [/wp-content/i, /wordpress/i],
    'Shopify': [/shopify/i, /cdn\.shopify/i],
    'Weebly': [/weebly\.com/i],
  }
};

// Contact info extraction patterns
export const CONTACT_PATTERNS = {
  phone: /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  address: /\d+\s+[\w\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)\.?(?:\s*,?\s*(?:Suite|Ste|Unit|#)?\s*\d+)?/gi,
  hours: /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*(?:\s*-\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*)?\s*:?\s*\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?\s*-\s*\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?/gi,
};

/**
 * Scrape a restaurant website and extract all available information
 */
export async function scrapeRestaurantWebsite(url, options = {}) {
  const results = {
    url,
    scraped_at: Date.now(),
    success: false,
    data: {},
    tech_stack: {},
    contacts: {},
    errors: [],
  };

  try {
    // Normalize URL
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }

    // Fetch the page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RGConsultingBot/1.0; +https://ccrestaurantconsulting.com)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      results.errors.push(`HTTP ${response.status}: ${response.statusText}`);
      return results;
    }

    const html = await response.text();
    const lowerHtml = html.toLowerCase();

    // Extract page title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    results.data.page_title = titleMatch ? titleMatch[1].trim() : null;

    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    results.data.meta_description = descMatch ? descMatch[1].trim() : null;

    // Detect technology stack
    results.tech_stack = detectTechStack(html);

    // Extract contact information
    results.contacts = extractContactInfo(html);

    // Extract social media links
    results.data.social = extractSocialLinks(html);

    // Try to find menu link
    const menuMatch = html.match(/href=["']([^"']*(?:menu|food|dishes)[^"']*)["']/i);
    results.data.menu_url = menuMatch ? resolveUrl(url, menuMatch[1]) : null;

    // Try to find online ordering link
    const orderMatch = html.match(/href=["']([^"']*(?:order|ordering|delivery|pickup)[^"']*)["']/i);
    results.data.order_url = orderMatch ? resolveUrl(url, orderMatch[1]) : null;

    // Look for cuisine indicators
    results.data.cuisine_hints = detectCuisineType(html);

    // Look for service style indicators
    results.data.service_hints = detectServiceStyle(html);

    results.success = true;
  } catch (error) {
    results.errors.push(error.message);
  }

  return results;
}

/**
 * Detect technology stack from HTML
 */
export function detectTechStack(html) {
  const detected = {
    pos_system: null,
    online_ordering: null,
    reservation_system: null,
    website_platform: null,
  };

  for (const [category, systems] of Object.entries(TECH_PATTERNS)) {
    for (const [name, patterns] of Object.entries(systems)) {
      for (const pattern of patterns) {
        if (pattern.test(html)) {
          detected[category] = name;
          break;
        }
      }
      if (detected[category]) break;
    }
  }

  return detected;
}

/**
 * Extract contact information from HTML
 */
export function extractContactInfo(html) {
  const contacts = {
    phones: [],
    emails: [],
    addresses: [],
  };

  // Extract phones (dedupe)
  const phoneMatches = html.match(CONTACT_PATTERNS.phone) || [];
  contacts.phones = [...new Set(phoneMatches.map(p => normalizePhone(p)))].slice(0, 3);

  // Extract emails (dedupe, filter out common non-contact emails)
  const emailMatches = html.match(CONTACT_PATTERNS.email) || [];
  contacts.emails = [...new Set(emailMatches)]
    .filter(e => !e.includes('example.com') && !e.includes('sentry') && !e.includes('webpack'))
    .slice(0, 3);

  // Extract addresses
  const addressMatches = html.match(CONTACT_PATTERNS.address) || [];
  contacts.addresses = [...new Set(addressMatches)].slice(0, 2);

  return contacts;
}

/**
 * Extract social media links
 */
export function extractSocialLinks(html) {
  const social = {};

  const patterns = {
    facebook: /href=["'](https?:\/\/(?:www\.)?facebook\.com\/[^"'\s]+)["']/i,
    instagram: /href=["'](https?:\/\/(?:www\.)?instagram\.com\/[^"'\s]+)["']/i,
    twitter: /href=["'](https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^"'\s]+)["']/i,
    yelp: /href=["'](https?:\/\/(?:www\.)?yelp\.com\/biz\/[^"'\s]+)["']/i,
    tripadvisor: /href=["'](https?:\/\/(?:www\.)?tripadvisor\.com\/[^"'\s]+)["']/i,
    google_business: /href=["'](https?:\/\/(?:www\.)?google\.com\/maps\/[^"'\s]+)["']/i,
  };

  for (const [platform, pattern] of Object.entries(patterns)) {
    const match = html.match(pattern);
    if (match) {
      social[platform] = match[1];
    }
  }

  return social;
}

/**
 * Detect cuisine type from content
 */
export function detectCuisineType(html) {
  const cuisines = {
    'Italian': /\b(italian|pasta|pizza|risotto|tiramisu|antipasto|trattoria|ristorante)\b/gi,
    'Mexican': /\b(mexican|tacos?|burritos?|enchiladas?|guacamole|cantina|taqueria)\b/gi,
    'Chinese': /\b(chinese|dim sum|wonton|szechuan|cantonese|mandarin)\b/gi,
    'Japanese': /\b(japanese|sushi|ramen|tempura|hibachi|izakaya|omakase)\b/gi,
    'Thai': /\b(thai|pad thai|curry|tom yum|basil)\b/gi,
    'Indian': /\b(indian|curry|tandoori|naan|biryani|masala)\b/gi,
    'French': /\b(french|bistro|brasserie|croissant|escargot|coq au vin)\b/gi,
    'American': /\b(american|burger|bbq|barbecue|steakhouse|grill)\b/gi,
    'Seafood': /\b(seafood|oyster|lobster|crab|shrimp|fish|clam|scallop)\b/gi,
    'Mediterranean': /\b(mediterranean|greek|hummus|falafel|kebab|shawarma)\b/gi,
    'Korean': /\b(korean|kimchi|bibimbap|bulgogi|k-bbq)\b/gi,
    'Vietnamese': /\b(vietnamese|pho|banh mi|spring roll)\b/gi,
  };

  const detected = [];
  for (const [cuisine, pattern] of Object.entries(cuisines)) {
    const matches = html.match(pattern);
    if (matches && matches.length >= 2) {
      detected.push({ cuisine, mentions: matches.length });
    }
  }

  return detected.sort((a, b) => b.mentions - a.mentions).slice(0, 3);
}

/**
 * Detect service style from content
 */
export function detectServiceStyle(html) {
  const styles = {
    'Fine Dining': /\b(fine dining|upscale|elegant|white tablecloth|prix fixe|tasting menu)\b/gi,
    'Casual Dining': /\b(casual dining|family friendly|relaxed atmosphere)\b/gi,
    'Fast Casual': /\b(fast casual|counter service|order at counter|build your own)\b/gi,
    'Quick Service': /\b(quick service|fast food|drive.?thru|takeout|to.?go)\b/gi,
    'Bar/Pub': /\b(bar|pub|tavern|brewery|taproom|gastropub)\b/gi,
    'Cafe': /\b(cafe|coffee|espresso|bakery|pastry)\b/gi,
    'Food Truck': /\b(food truck|mobile kitchen|street food)\b/gi,
  };

  const detected = [];
  for (const [style, pattern] of Object.entries(styles)) {
    const matches = html.match(pattern);
    if (matches) {
      detected.push({ style, mentions: matches.length });
    }
  }

  return detected.sort((a, b) => b.mentions - a.mentions).slice(0, 2);
}

/**
 * Normalize phone number to consistent format
 */
function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

/**
 * Resolve relative URL to absolute
 */
function resolveUrl(base, relative) {
  if (!relative) return null;
  if (relative.startsWith('http')) return relative;
  if (relative.startsWith('//')) return 'https:' + relative;
  if (relative.startsWith('/')) {
    const baseUrl = new URL(base);
    return baseUrl.origin + relative;
  }
  return base.replace(/\/[^/]*$/, '/') + relative;
}

/**
 * Search for restaurants in a location using various methods
 */
export async function discoverRestaurants(location, options = {}) {
  const { radius = '10mi', limit = 50, cuisine = null } = options;
  const discovered = [];

  // This would integrate with:
  // 1. Google Places API (if key available)
  // 2. Yelp Fusion API (if key available)
  // 3. Web search via Brave/Google
  // For now, return structure for integration

  return {
    location,
    radius,
    discovered,
    sources_checked: [],
    timestamp: Date.now(),
  };
}

/**
 * Enrich a lead with additional data from web research
 */
export async function enrichLead(lead, options = {}) {
  const enrichment = {
    lead_id: lead.id,
    original_data: { ...lead },
    enriched_data: {},
    sources: [],
    confidence_scores: {},
    timestamp: Date.now(),
  };

  // If we have a website, scrape it
  if (lead.website) {
    const scrapeResult = await scrapeRestaurantWebsite(lead.website);
    if (scrapeResult.success) {
      enrichment.sources.push('website');

      // Merge tech stack
      if (scrapeResult.tech_stack.pos_system) {
        enrichment.enriched_data.pos_system = scrapeResult.tech_stack.pos_system;
        enrichment.confidence_scores.pos_system = 0.9;
      }
      if (scrapeResult.tech_stack.online_ordering) {
        enrichment.enriched_data.online_ordering = scrapeResult.tech_stack.online_ordering;
        enrichment.confidence_scores.online_ordering = 0.9;
      }
      if (scrapeResult.tech_stack.reservation_system) {
        enrichment.enriched_data.reservation_system = scrapeResult.tech_stack.reservation_system;
        enrichment.confidence_scores.reservation_system = 0.9;
      }

      // Merge contacts
      if (scrapeResult.contacts.phones.length && !lead.phone) {
        enrichment.enriched_data.phone = scrapeResult.contacts.phones[0];
        enrichment.confidence_scores.phone = 0.8;
      }
      if (scrapeResult.contacts.emails.length && !lead.email) {
        enrichment.enriched_data.email = scrapeResult.contacts.emails[0];
        enrichment.confidence_scores.email = 0.8;
      }

      // Merge social
      enrichment.enriched_data.social = scrapeResult.data.social;

      // Cuisine detection
      if (scrapeResult.data.cuisine_hints?.length) {
        enrichment.enriched_data.cuisine_type = scrapeResult.data.cuisine_hints[0].cuisine;
        enrichment.confidence_scores.cuisine_type = 0.7;
      }

      // Service style detection
      if (scrapeResult.data.service_hints?.length) {
        enrichment.enriched_data.service_style = scrapeResult.data.service_hints[0].style;
        enrichment.confidence_scores.service_style = 0.7;
      }
    }
  }

  return enrichment;
}
