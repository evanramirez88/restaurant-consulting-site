/**
 * Business Brief Enricher - Recursive Profile Enrichment Worker
 *
 * Takes leads/contacts from D1 and recursively enriches them using FREE data sources:
 * - Web scraping (website tech stack, contacts, social)
 * - Brave Search API (100 free queries/day)
 * - Yelp public profiles (no login required)
 * - Google Maps links (extracted from websites)
 * - News/press mentions via search
 *
 * Enrichment continues until profile completeness threshold is met.
 */

// ============================================
// TYPES & INTERFACES
// ============================================

interface Env {
  DB: D1Database;
  RATE_LIMIT_KV: KVNamespace;
  BRAVE_API_KEY?: string;
  WORKER_API_KEY: string;
  GOOGLE_CUSTOM_SEARCH_KEY?: string;
  GOOGLE_CUSTOM_SEARCH_CX?: string;
}

interface BusinessBrief {
  // Core Identity
  id: string;
  leadId: string;
  companyName: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  email?: string;

  // Business Classification
  cuisineType?: string;
  serviceStyle?: string;
  priceLevel?: number; // 1-4
  seasonal?: boolean;
  establishedYear?: number;
  yearsInBusiness?: number;

  // Decision Makers
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  managerName?: string;
  decisionMakers: DecisionMaker[];

  // Tech Stack
  posSystem?: string;
  onlineOrdering?: string;
  reservationSystem?: string;
  websitePlatform?: string;
  paymentProcessor?: string;
  marketingTools: string[];
  loyaltyProgram?: string;

  // Online Presence
  facebookUrl?: string;
  instagramHandle?: string;
  twitterHandle?: string;
  yelpUrl?: string;
  googleMapsUrl?: string;
  tripAdvisorUrl?: string;

  // Ratings & Reviews
  googleRating?: number;
  googleReviewCount?: number;
  yelpRating?: number;
  yelpReviewCount?: number;
  tripAdvisorRating?: number;

  // Pain Signals (enriched from reviews/news)
  painSignals: PainSignal[];

  // Opportunity Analysis
  opportunityScore: number; // 0-100
  opportunityFactors: OpportunityFactor[];
  recommendedActions: string[];

  // Enrichment Metadata
  dataCompleteness: number; // 0-100 percentage
  enrichmentSources: string[];
  lastEnrichedAt: number;
  enrichmentRounds: number;
  gapAnalysis: GapAnalysis;
}

interface DecisionMaker {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  linkedIn?: string;
  source: string;
  confidence: number;
}

interface PainSignal {
  type: 'tech' | 'service' | 'operations' | 'staffing' | 'financial';
  description: string;
  severity: 'low' | 'medium' | 'high';
  source: string;
  detectedAt: number;
}

interface OpportunityFactor {
  factor: string;
  weight: number;
  description: string;
}

interface GapAnalysis {
  missingFields: string[];
  priorityGaps: string[];
  searchableGaps: string[];
  completenessBreakdown: Record<string, number>;
}

interface EnrichmentResult {
  success: boolean;
  leadId: string;
  fieldsEnriched: number;
  fieldsAttempted: number;
  sourcesUsed: string[];
  roundsCompleted: number;
  newCompleteness: number;
  previousCompleteness: number;
  gapsRemaining: string[];
  errors: string[];
  timestamp: number;
}

interface SearchResult {
  title: string;
  url: string;
  description: string;
}

interface RateLimits {
  braveSearchesUsed: number;
  braveSearchesLimit: number;
  googleSearchesUsed: number;
  googleSearchesLimit: number;
  websiteScrapes: number;
  lastReset: number;
}

// ============================================
// CONSTANTS & PATTERNS
// ============================================

const COMPLETENESS_THRESHOLD = 75; // Stop when 75% complete
const MAX_ENRICHMENT_ROUNDS = 5;
const DAILY_BRAVE_LIMIT = 95; // Leave 5 buffer
const DAILY_GOOGLE_LIMIT = 95;

// Field weights for completeness calculation
const FIELD_WEIGHTS: Record<string, number> = {
  companyName: 10,
  website: 8,
  phone: 8,
  email: 8,
  address: 5,
  cuisineType: 4,
  serviceStyle: 3,
  ownerName: 7,
  ownerEmail: 6,
  posSystem: 9,
  onlineOrdering: 5,
  reservationSystem: 4,
  googleRating: 3,
  yelpRating: 3,
  facebookUrl: 2,
  instagramHandle: 2,
  yelpUrl: 3,
  priceLevel: 2,
  seatingCapacity: 2,
  estimatedRevenue: 4,
};

const TECH_PATTERNS = {
  pos_systems: {
    'Toast': [/toast\.?pos/i, /toasttab\.com/i, /pos\.toasttab/i, /"toast"/i, /powered by toast/i],
    'Square': [/square\.?pos/i, /squareup\.com/i, /square for restaurants/i, /squarecdn/i],
    'Clover': [/clover\.com/i, /clover pos/i, /clover network/i],
    'Lightspeed': [/lightspeed/i, /lightspeedhq\.com/i, /lightspeed restaurant/i],
    'Aloha': [/aloha pos/i, /ncr\.com.*aloha/i, /aloha\.ncr/i],
    'Micros': [/micros/i, /oracle.*micros/i],
    'Upserve': [/upserve/i, /upserve\.com/i],
    'Revel': [/revelsystems/i, /revel pos/i],
    'TouchBistro': [/touchbistro/i],
    'SpotOn': [/spoton\.com/i, /spoton pos/i],
    'Heartland': [/heartland/i, /heartlandpaymentsystems/i],
    'NCR Silver': [/ncr silver/i, /ncrsilver/i],
  },
  online_ordering: {
    'Toast Online Ordering': [/order\.toasttab\.com/i, /toasttab\.com\/order/i],
    'ChowNow': [/chownow\.com/i, /ordering\.chownow/i],
    'DoorDash Storefront': [/doordash\.com.*storefront/i, /order\.doordash/i],
    'Square Online': [/squarespace.*order/i, /square.*online.*order/i],
    'BentoBox': [/bentobox/i, /getbento\.com/i],
    'Olo': [/olo\.com/i, /olo ordering/i],
    'Grubhub Direct': [/grubhub.*direct/i],
    'Popmenu': [/popmenu\.com/i],
    'Owner.com': [/owner\.com/i],
    'GloriaFood': [/gloriafood/i],
  },
  reservation_systems: {
    'OpenTable': [/opentable\.com/i, /opentable widget/i, /ot\.com/i],
    'Resy': [/resy\.com/i],
    'Yelp Reservations': [/yelp.*reservations/i, /yelp\.com\/reservations/i],
    'SevenRooms': [/sevenrooms/i],
    'Tock': [/exploretock\.com/i, /tock\.com/i],
    'Tablein': [/tablein/i],
  },
  website_platforms: {
    'BentoBox': [/getbento\.com/i, /bentobox/i],
    'Squarespace': [/squarespace/i, /static1\.squarespace/i],
    'Wix': [/wix\.com/i, /wixsite\.com/i],
    'WordPress': [/wp-content/i, /wordpress/i],
    'Shopify': [/shopify/i, /cdn\.shopify/i],
    'Weebly': [/weebly\.com/i],
    'Popmenu': [/popmenu\.com/i],
  },
  payment_processors: {
    'Stripe': [/stripe\.com/i, /js\.stripe\.com/i],
    'Square': [/squareup\.com\/pay/i],
    'PayPal': [/paypal\.com/i],
    'Heartland': [/heartland/i],
  }
};

const CONTACT_PATTERNS = {
  phone: /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
};

const CUISINE_PATTERNS: Record<string, RegExp> = {
  'Italian': /\b(italian|pasta|pizza|risotto|tiramisu|antipasto|trattoria|ristorante|pizzeria|lasagna|ravioli)\b/gi,
  'Mexican': /\b(mexican|tacos?|burritos?|enchiladas?|guacamole|cantina|taqueria|quesadilla|nachos|salsa)\b/gi,
  'Chinese': /\b(chinese|dim sum|wonton|szechuan|cantonese|mandarin|chow mein|kung pao|general tso)\b/gi,
  'Japanese': /\b(japanese|sushi|ramen|tempura|hibachi|izakaya|omakase|teriyaki|sake|miso)\b/gi,
  'Thai': /\b(thai|pad thai|curry|tom yum|basil|satay|larb)\b/gi,
  'Indian': /\b(indian|curry|tandoori|naan|biryani|masala|tikka|samosa|vindaloo)\b/gi,
  'French': /\b(french|bistro|brasserie|croissant|escargot|coq au vin|crepe|bouillabaisse)\b/gi,
  'American': /\b(american|burger|bbq|barbecue|steakhouse|grill|wings|ribs|smokehouse)\b/gi,
  'Seafood': /\b(seafood|oyster|lobster|crab|shrimp|fish|clam|scallop|raw bar|chowder)\b/gi,
  'Mediterranean': /\b(mediterranean|greek|hummus|falafel|kebab|shawarma|gyro|pita)\b/gi,
  'Korean': /\b(korean|kimchi|bibimbap|bulgogi|k-bbq|korean bbq|galbi)\b/gi,
  'Vietnamese': /\b(vietnamese|pho|banh mi|spring roll|bun)\b/gi,
  'Breakfast/Brunch': /\b(breakfast|brunch|pancakes|waffles|eggs benedict|mimosa|omelette)\b/gi,
  'Cafe/Coffee': /\b(cafe|coffee|espresso|latte|bakery|pastry|croissant)\b/gi,
  'Bar/Pub': /\b(bar|pub|tavern|brewery|taproom|gastropub|cocktail|craft beer)\b/gi,
};

const PAIN_SIGNAL_PATTERNS = [
  { pattern: /slow service|long wait|waited forever/gi, type: 'service' as const, severity: 'medium' as const },
  { pattern: /outdated|old fashioned|needs updating|ancient/gi, type: 'tech' as const, severity: 'high' as const },
  { pattern: /pos.*crash|system.*down|register.*broken/gi, type: 'tech' as const, severity: 'high' as const },
  { pattern: /understaffed|short staff|not enough servers/gi, type: 'staffing' as const, severity: 'medium' as const },
  { pattern: /overpriced|expensive.*for|not worth/gi, type: 'financial' as const, severity: 'low' as const },
  { pattern: /no online ordering|can't order online|call to order/gi, type: 'tech' as const, severity: 'high' as const },
  { pattern: /no reservations online|have to call/gi, type: 'tech' as const, severity: 'medium' as const },
  { pattern: /website.*broken|site.*down|can't find menu/gi, type: 'tech' as const, severity: 'medium' as const },
  { pattern: /cash only|no cards|don't take credit/gi, type: 'tech' as const, severity: 'high' as const },
];

// ============================================
// RATE LIMITING
// ============================================

async function getRateLimits(kv: KVNamespace): Promise<RateLimits> {
  const today = new Date().toISOString().split('T')[0];
  const key = `rate_limits:${today}`;

  const stored = await kv.get(key, 'json') as RateLimits | null;

  if (stored) {
    return stored;
  }

  return {
    braveSearchesUsed: 0,
    braveSearchesLimit: DAILY_BRAVE_LIMIT,
    googleSearchesUsed: 0,
    googleSearchesLimit: DAILY_GOOGLE_LIMIT,
    websiteScrapes: 0,
    lastReset: Date.now(),
  };
}

async function updateRateLimits(kv: KVNamespace, limits: RateLimits): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const key = `rate_limits:${today}`;
  await kv.put(key, JSON.stringify(limits), { expirationTtl: 86400 * 2 });
}

async function canUseSource(kv: KVNamespace, source: 'brave' | 'google'): Promise<boolean> {
  const limits = await getRateLimits(kv);

  if (source === 'brave') {
    return limits.braveSearchesUsed < limits.braveSearchesLimit;
  }
  if (source === 'google') {
    return limits.googleSearchesUsed < limits.googleSearchesLimit;
  }
  return true;
}

async function recordSourceUse(kv: KVNamespace, source: 'brave' | 'google'): Promise<void> {
  const limits = await getRateLimits(kv);

  if (source === 'brave') {
    limits.braveSearchesUsed++;
  } else if (source === 'google') {
    limits.googleSearchesUsed++;
  }

  await updateRateLimits(kv, limits);
}

// ============================================
// WEB SCRAPING
// ============================================

async function scrapeWebsite(url: string): Promise<{
  success: boolean;
  html?: string;
  data: Partial<BusinessBrief>;
  techStack: Record<string, string | null>;
  contacts: { phones: string[]; emails: string[] };
  social: Record<string, string>;
  error?: string;
}> {
  const result = {
    success: false,
    data: {} as Partial<BusinessBrief>,
    techStack: {} as Record<string, string | null>,
    contacts: { phones: [] as string[], emails: [] as string[] },
    social: {} as Record<string, string>,
  };

  try {
    // Normalize URL
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RGConsultingBot/1.0; +https://ccrestaurantconsulting.com)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return { ...result, error: `HTTP ${response.status}` };
    }

    const html = await response.text();
    const lowerHtml = html.toLowerCase();

    // Detect tech stack
    for (const [category, systems] of Object.entries(TECH_PATTERNS)) {
      for (const [name, patterns] of Object.entries(systems)) {
        for (const pattern of patterns) {
          if (pattern.test(html)) {
            result.techStack[category] = name;
            break;
          }
        }
        if (result.techStack[category]) break;
      }
    }

    // Extract contacts
    const phoneMatches = html.match(CONTACT_PATTERNS.phone) || [];
    result.contacts.phones = [...new Set(phoneMatches.map(normalizePhone))].slice(0, 3);

    const emailMatches = html.match(CONTACT_PATTERNS.email) || [];
    result.contacts.emails = [...new Set(emailMatches)]
      .filter(e => !e.includes('example.com') && !e.includes('sentry') && !e.includes('webpack'))
      .slice(0, 3);

    // Extract social links
    const socialPatterns = {
      facebookUrl: /href=["'](https?:\/\/(?:www\.)?facebook\.com\/[^"'\s]+)["']/i,
      instagramHandle: /href=["'](https?:\/\/(?:www\.)?instagram\.com\/([^"'\s/]+))["']/i,
      twitterHandle: /href=["'](https?:\/\/(?:www\.)?(?:twitter|x)\.com\/([^"'\s/]+))["']/i,
      yelpUrl: /href=["'](https?:\/\/(?:www\.)?yelp\.com\/biz\/[^"'\s]+)["']/i,
      tripAdvisorUrl: /href=["'](https?:\/\/(?:www\.)?tripadvisor\.com\/[^"'\s]+)["']/i,
      googleMapsUrl: /href=["'](https?:\/\/(?:www\.)?google\.com\/maps\/[^"'\s]+)["']/i,
    };

    for (const [key, pattern] of Object.entries(socialPatterns)) {
      const match = html.match(pattern);
      if (match) {
        result.social[key] = match[1];
        // Extract handle from URL for instagram/twitter
        if (key.endsWith('Handle') && match[2]) {
          result.social[key] = '@' + match[2].replace(/[/?#].*/, '');
        }
      }
    }

    // Detect cuisine type
    let bestCuisine = '';
    let bestCount = 0;
    for (const [cuisine, pattern] of Object.entries(CUISINE_PATTERNS)) {
      const matches = html.match(pattern);
      if (matches && matches.length > bestCount) {
        bestCount = matches.length;
        bestCuisine = cuisine;
      }
    }
    if (bestCuisine && bestCount >= 3) {
      result.data.cuisineType = bestCuisine;
    }

    // Extract menu/order URLs
    const menuMatch = html.match(/href=["']([^"']*(?:menu|food|dishes)[^"']*)["']/i);
    const orderMatch = html.match(/href=["']([^"']*(?:order|ordering|delivery|pickup)[^"']*)["']/i);

    // Extract owner/manager from common patterns
    const ownerPatterns = [
      /owner[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/i,
      /chef[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/i,
      /proprietor[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/i,
      /founded by[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/i,
    ];

    for (const pattern of ownerPatterns) {
      const match = html.match(pattern);
      if (match) {
        result.data.ownerName = match[1];
        break;
      }
    }

    result.success = true;
    return { ...result, html };
  } catch (error) {
    return { ...result, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

// ============================================
// SEARCH APIS (FREE TIER)
// ============================================

async function braveSearch(
  query: string,
  env: Env,
  count: number = 5
): Promise<{ success: boolean; results: SearchResult[]; error?: string }> {
  if (!env.BRAVE_API_KEY) {
    return { success: false, results: [], error: 'No Brave API key configured' };
  }

  if (!(await canUseSource(env.RATE_LIMIT_KV, 'brave'))) {
    return { success: false, results: [], error: 'Daily Brave search limit reached' };
  }

  try {
    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`,
      {
        headers: {
          'X-Subscription-Token': env.BRAVE_API_KEY,
          'Accept': 'application/json',
        },
      }
    );

    await recordSourceUse(env.RATE_LIMIT_KV, 'brave');

    if (!response.ok) {
      return { success: false, results: [], error: `HTTP ${response.status}` };
    }

    const data = await response.json() as {
      web?: { results?: Array<{ title: string; url: string; description: string }> };
    };

    const results = (data.web?.results || []).map(r => ({
      title: r.title,
      url: r.url,
      description: r.description,
    }));

    return { success: true, results };
  } catch (error) {
    return { success: false, results: [], error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function googleCustomSearch(
  query: string,
  env: Env,
  count: number = 5
): Promise<{ success: boolean; results: SearchResult[]; error?: string }> {
  if (!env.GOOGLE_CUSTOM_SEARCH_KEY || !env.GOOGLE_CUSTOM_SEARCH_CX) {
    return { success: false, results: [], error: 'Google Custom Search not configured' };
  }

  if (!(await canUseSource(env.RATE_LIMIT_KV, 'google'))) {
    return { success: false, results: [], error: 'Daily Google search limit reached' };
  }

  try {
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', env.GOOGLE_CUSTOM_SEARCH_KEY);
    url.searchParams.set('cx', env.GOOGLE_CUSTOM_SEARCH_CX);
    url.searchParams.set('q', query);
    url.searchParams.set('num', String(Math.min(count, 10)));

    const response = await fetch(url.toString());

    await recordSourceUse(env.RATE_LIMIT_KV, 'google');

    if (!response.ok) {
      return { success: false, results: [], error: `HTTP ${response.status}` };
    }

    const data = await response.json() as {
      items?: Array<{ title: string; link: string; snippet: string }>;
    };

    const results = (data.items || []).map(r => ({
      title: r.title,
      url: r.link,
      description: r.snippet,
    }));

    return { success: true, results };
  } catch (error) {
    return { success: false, results: [], error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Smart search with fallback
async function smartSearch(
  query: string,
  env: Env
): Promise<{ success: boolean; results: SearchResult[]; source: string }> {
  // Try Brave first
  let result = await braveSearch(query, env);
  if (result.success && result.results.length > 0) {
    return { ...result, source: 'brave' };
  }

  // Fallback to Google
  result = await googleCustomSearch(query, env);
  if (result.success && result.results.length > 0) {
    return { ...result, source: 'google' };
  }

  return { success: false, results: [], source: 'none' };
}

// ============================================
// DATA EXTRACTION FROM SEARCH RESULTS
// ============================================

function extractFromSearchResults(
  results: SearchResult[],
  gapType: string,
  companyName: string
): string | null {
  const combinedText = results.map(r => `${r.title} ${r.description}`).join(' ');

  switch (gapType) {
    case 'email': {
      const emailMatch = combinedText.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) {
        const email = emailMatch[0].toLowerCase();
        if (!email.includes('noreply') && !email.includes('support@') && !email.includes('info@google')) {
          return email;
        }
      }
      break;
    }
    case 'phone': {
      const phoneMatch = combinedText.match(/(?:\+1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/);
      if (phoneMatch) {
        return normalizePhone(phoneMatch[0]);
      }
      break;
    }
    case 'pos': {
      for (const [name, patterns] of Object.entries(TECH_PATTERNS.pos_systems)) {
        for (const pattern of patterns) {
          if (pattern.test(combinedText)) {
            return name;
          }
        }
      }
      break;
    }
    case 'yelp': {
      const yelpMatch = combinedText.match(/yelp\.com\/biz\/[\w-]+/);
      if (yelpMatch) {
        return 'https://www.' + yelpMatch[0];
      }
      break;
    }
    case 'owner': {
      // Look for owner name patterns
      const ownerPatterns = [
        new RegExp(`${companyName}.*owner[:\\s]+([A-Z][a-z]+ [A-Z][a-z]+)`, 'i'),
        /owner[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/i,
        /chef[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/i,
      ];
      for (const pattern of ownerPatterns) {
        const match = combinedText.match(pattern);
        if (match) return match[1];
      }
      break;
    }
    case 'cuisine': {
      for (const [cuisine, pattern] of Object.entries(CUISINE_PATTERNS)) {
        const matches = combinedText.match(pattern);
        if (matches && matches.length >= 2) {
          return cuisine;
        }
      }
      break;
    }
  }

  return null;
}

function extractPainSignals(text: string): PainSignal[] {
  const signals: PainSignal[] = [];

  for (const { pattern, type, severity } of PAIN_SIGNAL_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches.slice(0, 2)) {
        signals.push({
          type,
          description: match,
          severity,
          source: 'review_analysis',
          detectedAt: Date.now(),
        });
      }
    }
  }

  return signals;
}

// ============================================
// COMPLETENESS & GAP ANALYSIS
// ============================================

function calculateCompleteness(brief: Partial<BusinessBrief>): number {
  let totalWeight = 0;
  let filledWeight = 0;

  for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
    totalWeight += weight;
    const value = (brief as Record<string, unknown>)[field];
    if (value !== null && value !== undefined && value !== '') {
      filledWeight += weight;
    }
  }

  return Math.round((filledWeight / totalWeight) * 100);
}

function analyzeGaps(brief: Partial<BusinessBrief>): GapAnalysis {
  const missingFields: string[] = [];
  const priorityGaps: string[] = [];
  const searchableGaps: string[] = [];
  const completenessBreakdown: Record<string, number> = {};

  // Categories for breakdown
  const categories = {
    identity: ['companyName', 'website', 'phone', 'email', 'address'],
    decisionMakers: ['ownerName', 'ownerEmail', 'ownerPhone'],
    techStack: ['posSystem', 'onlineOrdering', 'reservationSystem'],
    online: ['facebookUrl', 'instagramHandle', 'yelpUrl', 'googleMapsUrl'],
    ratings: ['googleRating', 'yelpRating'],
  };

  for (const [category, fields] of Object.entries(categories)) {
    let filled = 0;
    for (const field of fields) {
      const value = (brief as Record<string, unknown>)[field];
      if (!value) {
        missingFields.push(field);

        // Priority gaps (high value fields)
        if (FIELD_WEIGHTS[field] >= 7) {
          priorityGaps.push(field);
        }

        // Searchable gaps (can find via web search)
        if (['phone', 'email', 'posSystem', 'yelpUrl', 'ownerName', 'cuisineType'].includes(field)) {
          searchableGaps.push(field);
        }
      } else {
        filled++;
      }
    }
    completenessBreakdown[category] = Math.round((filled / fields.length) * 100);
  }

  return {
    missingFields,
    priorityGaps,
    searchableGaps,
    completenessBreakdown,
  };
}

// ============================================
// OPPORTUNITY SCORING
// ============================================

function calculateOpportunityScore(brief: Partial<BusinessBrief>): {
  score: number;
  factors: OpportunityFactor[];
  recommendations: string[];
} {
  const factors: OpportunityFactor[] = [];
  const recommendations: string[] = [];
  let score = 50; // Start at neutral

  // Tech Stack Analysis
  if (!brief.posSystem || ['Unknown', 'None', 'Cash Register'].includes(brief.posSystem)) {
    score += 15;
    factors.push({
      factor: 'No Modern POS',
      weight: 15,
      description: 'Restaurant appears to lack a modern POS system',
    });
    recommendations.push('Offer POS consultation - high likelihood of technology upgrade need');
  } else if (['Square', 'Clover', 'Aloha'].includes(brief.posSystem)) {
    score += 10;
    factors.push({
      factor: 'Legacy POS',
      weight: 10,
      description: `Currently using ${brief.posSystem} - potential upgrade candidate`,
    });
    recommendations.push(`Current POS (${brief.posSystem}) may have limitations - explore switching benefits`);
  }

  // Online Ordering
  if (!brief.onlineOrdering) {
    score += 12;
    factors.push({
      factor: 'No Online Ordering',
      weight: 12,
      description: 'No online ordering system detected',
    });
    recommendations.push('Propose online ordering solution - major revenue opportunity');
  }

  // Pain Signals
  const painCount = brief.painSignals?.length || 0;
  if (painCount > 0) {
    const painScore = Math.min(painCount * 5, 15);
    score += painScore;
    factors.push({
      factor: 'Pain Signals Detected',
      weight: painScore,
      description: `${painCount} pain signal(s) identified from reviews/mentions`,
    });

    // Add specific recommendations based on pain types
    const techPains = brief.painSignals?.filter(p => p.type === 'tech') || [];
    if (techPains.length > 0) {
      recommendations.push('Technology pain points identified - lead with tech modernization pitch');
    }
  }

  // Rating Analysis
  if (brief.googleRating && brief.googleRating < 4.0) {
    score += 8;
    factors.push({
      factor: 'Below Average Rating',
      weight: 8,
      description: `Google rating of ${brief.googleRating} suggests room for improvement`,
    });
    recommendations.push('Low ratings may indicate operational issues - position consulting as reputation recovery');
  }

  // Website Quality (if we scraped and found issues)
  if (brief.website && !brief.websitePlatform) {
    score += 5;
    factors.push({
      factor: 'Basic Website',
      weight: 5,
      description: 'Website appears to use basic/outdated platform',
    });
  }

  // Cap score at 100
  score = Math.min(score, 100);

  // Generate generic recommendations if list is empty
  if (recommendations.length === 0) {
    recommendations.push('Standard outreach - explore operational improvements');
    recommendations.push('Request discovery call to identify hidden pain points');
  }

  return { score, factors, recommendations };
}

// ============================================
// RECURSIVE ENRICHMENT ENGINE
// ============================================

async function enrichBusinessBrief(
  leadId: string,
  env: Env,
  maxRounds: number = MAX_ENRICHMENT_ROUNDS
): Promise<EnrichmentResult> {
  const result: EnrichmentResult = {
    success: false,
    leadId,
    fieldsEnriched: 0,
    fieldsAttempted: 0,
    sourcesUsed: [],
    roundsCompleted: 0,
    newCompleteness: 0,
    previousCompleteness: 0,
    gapsRemaining: [],
    errors: [],
    timestamp: Date.now(),
  };

  try {
    // Fetch lead from D1
    const lead = await env.DB.prepare(`
      SELECT * FROM restaurant_leads WHERE id = ?
    `).bind(leadId).first() as Record<string, unknown> | null;

    if (!lead) {
      result.errors.push('Lead not found');
      return result;
    }

    // Initialize business brief from existing data
    const brief: Partial<BusinessBrief> = {
      id: `brief_${leadId}`,
      leadId,
      companyName: (lead.name || lead.company_name) as string,
      website: (lead.website_url || lead.website) as string,
      address: lead.address as string,
      city: lead.city as string,
      state: lead.state as string,
      zipCode: lead.zip_code as string,
      phone: (lead.primary_phone || lead.phone) as string,
      email: (lead.primary_email || lead.email) as string,
      cuisineType: (lead.cuisine_primary || lead.cuisine_type) as string,
      serviceStyle: lead.service_style as string,
      priceLevel: lead.price_level as number,
      ownerName: lead.owner_name as string,
      ownerEmail: lead.owner_email as string,
      ownerPhone: lead.owner_phone as string,
      posSystem: lead.current_pos as string,
      onlineOrdering: lead.online_ordering as string,
      reservationSystem: lead.reservation_system as string,
      facebookUrl: lead.facebook_url as string,
      instagramHandle: lead.instagram_handle as string,
      yelpUrl: lead.yelp_url as string,
      googleRating: lead.google_rating as number,
      googleReviewCount: lead.google_review_count as number,
      yelpRating: lead.yelp_rating as number,
      yelpReviewCount: lead.yelp_review_count as number,
      decisionMakers: [],
      painSignals: [],
      marketingTools: [],
      opportunityScore: 0,
      opportunityFactors: [],
      recommendedActions: [],
      dataCompleteness: 0,
      enrichmentSources: [],
      lastEnrichedAt: Date.now(),
      enrichmentRounds: 0,
      gapAnalysis: { missingFields: [], priorityGaps: [], searchableGaps: [], completenessBreakdown: {} },
    };

    result.previousCompleteness = calculateCompleteness(brief);

    // Recursive enrichment loop
    for (let round = 1; round <= maxRounds; round++) {
      result.roundsCompleted = round;

      const gaps = analyzeGaps(brief);
      brief.gapAnalysis = gaps;

      // Check if we've reached threshold
      const currentCompleteness = calculateCompleteness(brief);
      if (currentCompleteness >= COMPLETENESS_THRESHOLD) {
        console.log(`[Enricher] Round ${round}: Completeness ${currentCompleteness}% - threshold met`);
        break;
      }

      // No more searchable gaps
      if (gaps.searchableGaps.length === 0) {
        console.log(`[Enricher] Round ${round}: No more searchable gaps`);
        break;
      }

      console.log(`[Enricher] Round ${round}: Completeness ${currentCompleteness}%, gaps: ${gaps.searchableGaps.join(', ')}`);

      // Try website scraping first (free, no API limits)
      if (brief.website && !result.sourcesUsed.includes('website_scrape')) {
        const scrapeResult = await scrapeWebsite(brief.website);
        if (scrapeResult.success) {
          result.sourcesUsed.push('website_scrape');

          // Apply scraped data
          if (scrapeResult.techStack.pos_systems && !brief.posSystem) {
            brief.posSystem = scrapeResult.techStack.pos_systems;
            result.fieldsEnriched++;
          }
          if (scrapeResult.techStack.online_ordering && !brief.onlineOrdering) {
            brief.onlineOrdering = scrapeResult.techStack.online_ordering;
            result.fieldsEnriched++;
          }
          if (scrapeResult.techStack.reservation_systems && !brief.reservationSystem) {
            brief.reservationSystem = scrapeResult.techStack.reservation_systems;
            result.fieldsEnriched++;
          }
          if (scrapeResult.techStack.website_platforms) {
            brief.websitePlatform = scrapeResult.techStack.website_platforms;
          }
          if (scrapeResult.contacts.phones.length && !brief.phone) {
            brief.phone = scrapeResult.contacts.phones[0];
            result.fieldsEnriched++;
          }
          if (scrapeResult.contacts.emails.length && !brief.email) {
            brief.email = scrapeResult.contacts.emails[0];
            result.fieldsEnriched++;
          }
          if (scrapeResult.social.facebookUrl && !brief.facebookUrl) {
            brief.facebookUrl = scrapeResult.social.facebookUrl;
            result.fieldsEnriched++;
          }
          if (scrapeResult.social.instagramHandle && !brief.instagramHandle) {
            brief.instagramHandle = scrapeResult.social.instagramHandle;
            result.fieldsEnriched++;
          }
          if (scrapeResult.social.yelpUrl && !brief.yelpUrl) {
            brief.yelpUrl = scrapeResult.social.yelpUrl;
            result.fieldsEnriched++;
          }
          if (scrapeResult.data.cuisineType && !brief.cuisineType) {
            brief.cuisineType = scrapeResult.data.cuisineType;
            result.fieldsEnriched++;
          }
          if (scrapeResult.data.ownerName && !brief.ownerName) {
            brief.ownerName = scrapeResult.data.ownerName;
            result.fieldsEnriched++;
          }
        }
      }

      // Search-based enrichment for remaining gaps
      for (const gap of gaps.searchableGaps.slice(0, 3)) {
        result.fieldsAttempted++;

        let query = '';
        const company = brief.companyName || '';
        const location = [brief.city, brief.state].filter(Boolean).join(', ');

        switch (gap) {
          case 'phone':
            query = `"${company}" ${location} phone contact`;
            break;
          case 'email':
            query = `"${company}" ${location} email contact`;
            break;
          case 'posSystem':
            query = `"${company}" point of sale system OR "powered by" restaurant`;
            break;
          case 'yelpUrl':
            query = `"${company}" ${location} site:yelp.com`;
            break;
          case 'ownerName':
            query = `"${company}" ${location} owner chef proprietor`;
            break;
          case 'cuisineType':
            query = `"${company}" ${location} restaurant cuisine food`;
            break;
          default:
            continue;
        }

        const searchResult = await smartSearch(query, env);
        if (searchResult.success && searchResult.results.length > 0) {
          if (!result.sourcesUsed.includes(searchResult.source)) {
            result.sourcesUsed.push(searchResult.source);
          }

          const extracted = extractFromSearchResults(searchResult.results, gap, company);
          if (extracted) {
            (brief as Record<string, unknown>)[gap] = extracted;
            result.fieldsEnriched++;
            console.log(`[Enricher] Found ${gap}: ${extracted}`);
          }

          // Rate limit between searches
          await new Promise(resolve => setTimeout(resolve, 250));
        }
      }

      // Search for pain signals (once per enrichment)
      if (round === 1 && brief.companyName) {
        const reviewQuery = `"${brief.companyName}" ${brief.city || ''} review`;
        const reviewSearch = await smartSearch(reviewQuery, env);
        if (reviewSearch.success && reviewSearch.results.length > 0) {
          const combinedText = reviewSearch.results.map(r => r.description).join(' ');
          const signals = extractPainSignals(combinedText);
          brief.painSignals = signals;
        }
      }
    }

    // Calculate final metrics
    const opportunity = calculateOpportunityScore(brief);
    brief.opportunityScore = opportunity.score;
    brief.opportunityFactors = opportunity.factors;
    brief.recommendedActions = opportunity.recommendations;
    brief.dataCompleteness = calculateCompleteness(brief);
    brief.enrichmentRounds = result.roundsCompleted;
    brief.gapAnalysis = analyzeGaps(brief);

    result.newCompleteness = brief.dataCompleteness;
    result.gapsRemaining = brief.gapAnalysis.missingFields;

    // Persist enriched data back to D1
    await persistEnrichment(env.DB, leadId, brief);

    result.success = true;
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  return result;
}

async function persistEnrichment(db: D1Database, leadId: string, brief: Partial<BusinessBrief>): Promise<void> {
  // Update restaurant_leads with enriched data
  const updates: string[] = [];
  const values: unknown[] = [];

  const fieldMapping: Record<string, string> = {
    phone: 'primary_phone',
    email: 'primary_email',
    cuisineType: 'cuisine_primary',
    posSystem: 'current_pos',
    ownerName: 'owner_name',
    ownerEmail: 'owner_email',
    ownerPhone: 'owner_phone',
    googleRating: 'google_rating',
    googleReviewCount: 'google_review_count',
    yelpRating: 'yelp_rating',
    yelpReviewCount: 'yelp_review_count',
    onlineOrdering: 'online_ordering',
    reservationSystem: 'reservation_system',
    facebookUrl: 'facebook_url',
    instagramHandle: 'instagram_handle',
    yelpUrl: 'yelp_url',
    priceLevel: 'price_level',
    serviceStyle: 'service_style',
  };

  for (const [briefField, dbField] of Object.entries(fieldMapping)) {
    const value = (brief as Record<string, unknown>)[briefField];
    if (value !== null && value !== undefined && value !== '') {
      updates.push(`${dbField} = ?`);
      values.push(value);
    }
  }

  // Always update enrichment metadata
  updates.push('data_completeness = ?');
  values.push(brief.dataCompleteness);

  updates.push('enrichment_confidence = ?');
  values.push(brief.dataCompleteness); // Use completeness as proxy for confidence

  updates.push('last_enriched_at = ?');
  values.push(Math.floor(Date.now() / 1000));

  updates.push('gap_analysis_json = ?');
  values.push(JSON.stringify(brief.gapAnalysis));

  updates.push('updated_at = unixepoch()');

  // Calculate lead score boost from opportunity
  if (brief.opportunityScore && brief.opportunityScore > 50) {
    const scoreBoost = Math.floor((brief.opportunityScore - 50) / 5);
    updates.push('lead_score = COALESCE(lead_score, 50) + ?');
    values.push(scoreBoost);
  }

  values.push(leadId);

  if (updates.length > 0) {
    await db.prepare(`
      UPDATE restaurant_leads
      SET ${updates.join(', ')}
      WHERE id = ?
    `).bind(...values).run();
  }

  // Store opportunity analysis separately
  if (brief.opportunityScore !== undefined) {
    const analysisId = `opp_${leadId}_${Date.now()}`;
    await db.prepare(`
      INSERT OR REPLACE INTO lead_opportunity_analysis (
        id, lead_id, opportunity_score, factors_json, recommendations_json,
        pain_signals_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, unixepoch())
    `).bind(
      analysisId,
      leadId,
      brief.opportunityScore,
      JSON.stringify(brief.opportunityFactors),
      JSON.stringify(brief.recommendedActions),
      JSON.stringify(brief.painSignals)
    ).run().catch(() => {
      // Table may not exist - that's ok
    });
  }
}

// ============================================
// BATCH PROCESSING
// ============================================

async function processBatch(
  env: Env,
  batchSize: number = 10,
  minCompleteness: number = 0,
  maxCompleteness: number = 74
): Promise<{
  processed: number;
  enriched: number;
  skipped: number;
  errors: number;
  results: EnrichmentResult[];
}> {
  const stats = {
    processed: 0,
    enriched: 0,
    skipped: 0,
    errors: 0,
    results: [] as EnrichmentResult[],
  };

  // Get leads that need enrichment
  const leads = await env.DB.prepare(`
    SELECT id, name, company_name, website_url, data_completeness
    FROM restaurant_leads
    WHERE (data_completeness IS NULL OR data_completeness BETWEEN ? AND ?)
      AND (last_enriched_at IS NULL OR last_enriched_at < unixepoch() - 604800)
    ORDER BY
      CASE WHEN lead_score >= 70 THEN 0 ELSE 1 END,
      lead_score DESC NULLS LAST,
      data_completeness ASC NULLS FIRST
    LIMIT ?
  `).bind(minCompleteness, maxCompleteness, batchSize).all();

  for (const lead of leads.results || []) {
    stats.processed++;

    // Check rate limits before each lead
    const limits = await getRateLimits(env.RATE_LIMIT_KV);
    if (limits.braveSearchesUsed >= limits.braveSearchesLimit &&
        limits.googleSearchesUsed >= limits.googleSearchesLimit) {
      console.log('[Enricher] Rate limits reached, stopping batch');
      break;
    }

    try {
      const result = await enrichBusinessBrief(lead.id as string, env);
      stats.results.push(result);

      if (result.success && result.fieldsEnriched > 0) {
        stats.enriched++;
      } else if (result.success) {
        stats.skipped++;
      } else {
        stats.errors++;
      }

      // Small delay between leads
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      stats.errors++;
      console.error(`[Enricher] Error processing ${lead.id}:`, error);
    }
  }

  return stats;
}

// ============================================
// WORKER HANDLERS
// ============================================

export default {
  // Scheduled trigger for batch processing
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log(`[Enricher] Scheduled run at ${new Date(event.scheduledTime).toISOString()}`);

    const result = await processBatch(env, 15);

    console.log(`[Enricher] Batch complete: ${result.processed} processed, ${result.enriched} enriched, ${result.errors} errors`);
  },

  // HTTP handler for manual triggers and API
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Auth check
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ') || authHeader.slice(7) !== env.WORKER_API_KEY) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    // Health check
    if (url.pathname === '/health') {
      const limits = await getRateLimits(env.RATE_LIMIT_KV);
      return new Response(JSON.stringify({
        status: 'healthy',
        worker: 'business-brief-enricher',
        timestamp: new Date().toISOString(),
        rateLimits: {
          braveRemaining: limits.braveSearchesLimit - limits.braveSearchesUsed,
          googleRemaining: limits.googleSearchesLimit - limits.googleSearchesUsed,
        },
      }), { headers: corsHeaders });
    }

    // Enrich single lead
    if (url.pathname === '/enrich' && request.method === 'POST') {
      const body = await request.json() as { lead_id?: string; max_rounds?: number };

      if (!body.lead_id) {
        return new Response(JSON.stringify({ error: 'lead_id required' }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const result = await enrichBusinessBrief(body.lead_id, env, body.max_rounds || 5);
      return new Response(JSON.stringify(result), { headers: corsHeaders });
    }

    // Batch process
    if (url.pathname === '/batch' && request.method === 'POST') {
      const body = await request.json() as {
        batch_size?: number;
        min_completeness?: number;
        max_completeness?: number;
      };

      const result = await processBatch(
        env,
        body.batch_size || 10,
        body.min_completeness || 0,
        body.max_completeness || 74
      );

      return new Response(JSON.stringify({
        success: true,
        ...result,
        results: result.results.map(r => ({
          leadId: r.leadId,
          success: r.success,
          fieldsEnriched: r.fieldsEnriched,
          newCompleteness: r.newCompleteness,
        })),
      }), { headers: corsHeaders });
    }

    // Get enrichment stats
    if (url.pathname === '/stats' && request.method === 'GET') {
      const stats = await env.DB.prepare(`
        SELECT
          COUNT(*) as total_leads,
          AVG(data_completeness) as avg_completeness,
          COUNT(CASE WHEN data_completeness >= 75 THEN 1 END) as fully_enriched,
          COUNT(CASE WHEN data_completeness < 25 THEN 1 END) as needs_enrichment,
          COUNT(CASE WHEN last_enriched_at > unixepoch() - 86400 THEN 1 END) as enriched_today,
          COUNT(CASE WHEN current_pos IS NOT NULL THEN 1 END) as has_pos,
          COUNT(CASE WHEN primary_email IS NOT NULL THEN 1 END) as has_email
        FROM restaurant_leads
      `).first();

      const limits = await getRateLimits(env.RATE_LIMIT_KV);

      return new Response(JSON.stringify({
        success: true,
        stats,
        rateLimits: {
          braveUsed: limits.braveSearchesUsed,
          braveRemaining: limits.braveSearchesLimit - limits.braveSearchesUsed,
          googleUsed: limits.googleSearchesUsed,
          googleRemaining: limits.googleSearchesLimit - limits.googleSearchesUsed,
        },
      }), { headers: corsHeaders });
    }

    // Gap analysis for all leads
    if (url.pathname === '/gaps' && request.method === 'GET') {
      const gaps = await env.DB.prepare(`
        SELECT
          SUM(CASE WHEN primary_email IS NULL THEN 1 ELSE 0 END) as missing_email,
          SUM(CASE WHEN primary_phone IS NULL THEN 1 ELSE 0 END) as missing_phone,
          SUM(CASE WHEN current_pos IS NULL THEN 1 ELSE 0 END) as missing_pos,
          SUM(CASE WHEN website_url IS NULL THEN 1 ELSE 0 END) as missing_website,
          SUM(CASE WHEN owner_name IS NULL THEN 1 ELSE 0 END) as missing_owner,
          SUM(CASE WHEN cuisine_primary IS NULL THEN 1 ELSE 0 END) as missing_cuisine,
          SUM(CASE WHEN yelp_url IS NULL THEN 1 ELSE 0 END) as missing_yelp,
          COUNT(*) as total
        FROM restaurant_leads
      `).first();

      return new Response(JSON.stringify({
        success: true,
        gaps,
        enrichableLeads: await env.DB.prepare(`
          SELECT COUNT(*) as count
          FROM restaurant_leads
          WHERE website_url IS NOT NULL
            AND (data_completeness IS NULL OR data_completeness < 75)
        `).first(),
      }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({
      error: 'Not found',
      endpoints: [
        'GET /health - Health check and rate limits',
        'POST /enrich - Enrich single lead (body: { lead_id, max_rounds? })',
        'POST /batch - Batch process leads (body: { batch_size?, min_completeness?, max_completeness? })',
        'GET /stats - Get enrichment statistics',
        'GET /gaps - Get gap analysis across all leads',
      ],
    }), {
      status: 404,
      headers: corsHeaders,
    });
  },
};
