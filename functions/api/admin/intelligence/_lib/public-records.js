/**
 * Public Records Integration Library
 *
 * Fetches and parses public data from:
 * - Health inspection databases
 * - Business license registries
 * - Liquor license databases
 * - Secretary of State business filings
 * - Building/permit databases
 *
 * Focus: Massachusetts (primary) + other states as available
 */

// Massachusetts-specific data sources
export const MA_DATA_SOURCES = {
  // MA DPH - Health Inspections (many cities publish on their own)
  health_inspections: {
    boston: {
      name: 'Boston Health Inspections',
      url: 'https://data.boston.gov/api/3/action/datastore_search',
      resource_id: 'f1e13724-284d-478c-b8bc-ef042aa5b70b',
      type: 'ckan_api',
    },
    cambridge: {
      name: 'Cambridge Health Inspections',
      type: 'scrape',
      url: 'https://www.cambridgema.gov/inspection',
    },
  },
  // MA ABCC - Liquor Licenses
  liquor_licenses: {
    state: {
      name: 'MA ABCC Liquor Licenses',
      url: 'https://www.mass.gov/abcc',
      type: 'scrape',
    },
  },
  // MA Secretary of State - Business Filings
  business_filings: {
    state: {
      name: 'MA Corporations Division',
      url: 'https://corp.sec.state.ma.us/CorpWeb/CorpSearch/CorpSearch.aspx',
      type: 'search_form',
    },
  },
};

// Common health violation categories
export const HEALTH_VIOLATION_CATEGORIES = {
  critical: [
    'temperature', 'food temp', 'cold holding', 'hot holding',
    'cross contamination', 'raw meat', 'handwashing', 'bare hand',
    'pest', 'rodent', 'insect', 'vermin', 'sewage', 'plumbing',
  ],
  major: [
    'sanitizer', 'cleaning', 'food storage', 'labeling', 'date marking',
    'employee illness', 'hygiene', 'hair restraint',
  ],
  minor: [
    'floor', 'wall', 'ceiling', 'lighting', 'ventilation', 'garbage',
    'signage', 'license display',
  ],
};

/**
 * Fetch health inspection data for a restaurant
 */
export async function fetchHealthInspections(restaurantName, city, state = 'MA') {
  const results = {
    source: null,
    inspections: [],
    latest_score: null,
    violations: [],
    last_inspection_date: null,
    status: 'not_found',
  };

  try {
    if (state === 'MA') {
      // Try Boston data if city is Boston
      if (city?.toLowerCase() === 'boston') {
        const bostonData = await fetchBostonHealthData(restaurantName);
        if (bostonData.found) {
          return bostonData;
        }
      }

      // Try general MA approach
      const maData = await searchMAHealthRecords(restaurantName, city);
      if (maData.found) {
        return maData;
      }
    }

    // Generic search approach for other states
    return await searchGenericHealthRecords(restaurantName, city, state);
  } catch (error) {
    results.error = error.message;
    return results;
  }
}

/**
 * Fetch Boston health inspection data from open data portal
 */
async function fetchBostonHealthData(restaurantName) {
  const result = {
    source: 'Boston Open Data Portal',
    found: false,
    inspections: [],
    latest_score: null,
    violations: [],
  };

  try {
    const searchName = restaurantName.replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 50);
    const url = `https://data.boston.gov/api/3/action/datastore_search?resource_id=f1e13724-284d-478c-b8bc-ef042aa5b70b&q=${encodeURIComponent(searchName)}&limit=20`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      return result;
    }

    const data = await response.json();

    if (data.success && data.result?.records?.length > 0) {
      result.found = true;

      // Group by inspection date
      const inspections = {};
      for (const record of data.result.records) {
        const date = record.VIESSION_DATE || record.resultdate;
        if (!inspections[date]) {
          inspections[date] = {
            date,
            violations: [],
            business_name: record.businessname,
            address: record.address,
            license_status: record.LICENSESTATUS,
          };
        }
        if (record.VIESSION_LEVEL) {
          inspections[date].violations.push({
            level: record.VIESSION_LEVEL,
            description: record.ViolDesc || record.VIESSION_DESCRIPTION,
            status: record.ViolStatus,
          });
        }
      }

      result.inspections = Object.values(inspections).sort((a, b) =>
        new Date(b.date) - new Date(a.date)
      );

      if (result.inspections.length > 0) {
        result.last_inspection_date = result.inspections[0].date;
        result.violations = result.inspections[0].violations;
      }
    }
  } catch (error) {
    result.error = error.message;
  }

  return result;
}

/**
 * Search MA health records (generic approach)
 */
async function searchMAHealthRecords(restaurantName, city) {
  // Many MA cities use different systems
  // This would need to be expanded per-city
  return {
    source: 'MA Health Records',
    found: false,
    message: 'Direct API not available - requires city-specific lookup',
    suggestions: [
      `Search ${city} health department website`,
      'Check local board of health records',
      'Request via public records request',
    ],
  };
}

/**
 * Generic health records search
 */
async function searchGenericHealthRecords(restaurantName, city, state) {
  return {
    source: 'Generic Search',
    found: false,
    message: 'Automated health record lookup not available for this location',
    manual_lookup_urls: [
      `https://www.google.com/search?q=${encodeURIComponent(`${restaurantName} ${city} ${state} health inspection`)}`,
      `https://www.yelp.com/search?find_desc=${encodeURIComponent(restaurantName)}&find_loc=${encodeURIComponent(`${city}, ${state}`)}`,
    ],
  };
}

/**
 * Fetch liquor license information
 */
export async function fetchLiquorLicense(restaurantName, city, state = 'MA') {
  const results = {
    source: null,
    found: false,
    license_type: null,
    license_number: null,
    status: null,
    expiration_date: null,
    holder_name: null,
    dba: null,
    address: null,
  };

  try {
    if (state === 'MA') {
      // MA ABCC doesn't have a public API, but we can structure the search
      results.source = 'MA ABCC';
      results.message = 'MA liquor licenses require manual lookup';
      results.lookup_url = `https://www.mass.gov/orgs/alcoholic-beverages-control-commission`;
      results.lookup_instructions = [
        'Visit MA ABCC website',
        `Search for "${restaurantName}" in ${city}`,
        'License types: All Alcohol, Beer/Wine, Seasonal',
      ];
    }
  } catch (error) {
    results.error = error.message;
  }

  return results;
}

/**
 * Fetch business registration information
 */
export async function fetchBusinessRegistration(businessName, state = 'MA') {
  const results = {
    source: null,
    found: false,
    entity_name: null,
    entity_type: null,
    status: null,
    date_formed: null,
    registered_agent: null,
    principal_address: null,
    filing_number: null,
  };

  try {
    if (state === 'MA') {
      results.source = 'MA Secretary of State';
      results.lookup_url = 'https://corp.sec.state.ma.us/CorpWeb/CorpSearch/CorpSearch.aspx';
      results.lookup_instructions = [
        'Visit MA Corps Division website',
        `Search for "${businessName}"`,
        'Note: May be registered under different name (LLC, Inc, etc.)',
      ];
    }
  } catch (error) {
    results.error = error.message;
  }

  return results;
}

/**
 * Aggregate all public records for a restaurant
 */
export async function fetchAllPublicRecords(restaurantInfo) {
  const { name, city, state = 'MA', address } = restaurantInfo;

  const [healthData, liquorData, businessData] = await Promise.all([
    fetchHealthInspections(name, city, state),
    fetchLiquorLicense(name, city, state),
    fetchBusinessRegistration(name, state),
  ]);

  return {
    restaurant: restaurantInfo,
    fetched_at: Date.now(),
    health_inspections: healthData,
    liquor_license: liquorData,
    business_registration: businessData,
    completeness: calculateRecordCompleteness(healthData, liquorData, businessData),
  };
}

/**
 * Calculate how complete the public records are
 */
function calculateRecordCompleteness(health, liquor, business) {
  let score = 0;
  let max = 0;

  // Health inspection data (40% weight)
  max += 40;
  if (health.found) score += 40;
  else if (health.lookup_url) score += 10;

  // Liquor license data (30% weight)
  max += 30;
  if (liquor.found) score += 30;
  else if (liquor.lookup_url) score += 10;

  // Business registration (30% weight)
  max += 30;
  if (business.found) score += 30;
  else if (business.lookup_url) score += 10;

  return {
    score: Math.round((score / max) * 100),
    max: 100,
    breakdown: {
      health: health.found ? 'complete' : (health.lookup_url ? 'manual_lookup' : 'unavailable'),
      liquor: liquor.found ? 'complete' : (liquor.lookup_url ? 'manual_lookup' : 'unavailable'),
      business: business.found ? 'complete' : (business.lookup_url ? 'manual_lookup' : 'unavailable'),
    },
  };
}

/**
 * Parse health score from various formats
 */
export function parseHealthScore(scoreData) {
  // Different jurisdictions use different scoring systems
  // A = 90-100, B = 80-89, C = 70-79, etc.
  // Or numeric: 0-100
  // Or Pass/Fail

  if (typeof scoreData === 'number') {
    return { score: scoreData, grade: numberToGrade(scoreData), system: 'numeric' };
  }

  if (typeof scoreData === 'string') {
    const upper = scoreData.toUpperCase().trim();

    // Letter grade
    if (/^[A-F][+-]?$/.test(upper)) {
      return { score: gradeToNumber(upper), grade: upper, system: 'letter' };
    }

    // Pass/Fail
    if (upper === 'PASS' || upper === 'PASSED') {
      return { score: 85, grade: 'PASS', system: 'pass_fail' };
    }
    if (upper === 'FAIL' || upper === 'FAILED') {
      return { score: 50, grade: 'FAIL', system: 'pass_fail' };
    }

    // Try to extract numeric
    const numMatch = scoreData.match(/(\d+)/);
    if (numMatch) {
      const num = parseInt(numMatch[1], 10);
      if (num <= 100) {
        return { score: num, grade: numberToGrade(num), system: 'numeric' };
      }
    }
  }

  return { score: null, grade: null, system: 'unknown' };
}

function numberToGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function gradeToNumber(grade) {
  const baseScores = { 'A': 95, 'B': 85, 'C': 75, 'D': 65, 'F': 50 };
  const base = baseScores[grade.charAt(0)] || 70;
  if (grade.includes('+')) return Math.min(100, base + 3);
  if (grade.includes('-')) return base - 3;
  return base;
}

/**
 * Extract structured data from Yelp page
 */
export async function scrapeYelpBusiness(yelpUrl) {
  const result = {
    source: 'Yelp',
    found: false,
    name: null,
    rating: null,
    review_count: null,
    price_range: null,
    categories: [],
    address: null,
    phone: null,
    hours: null,
    website: null,
  };

  try {
    const response = await fetch(yelpUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RGConsultingBot/1.0)',
        'Accept': 'text/html',
      },
    });

    if (!response.ok) {
      return result;
    }

    const html = await response.text();
    result.found = true;

    // Extract business name
    const nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    if (nameMatch) result.name = nameMatch[1].trim();

    // Extract rating
    const ratingMatch = html.match(/(\d+\.?\d*)\s*star/i);
    if (ratingMatch) result.rating = parseFloat(ratingMatch[1]);

    // Extract review count
    const reviewMatch = html.match(/(\d+)\s*reviews?/i);
    if (reviewMatch) result.review_count = parseInt(reviewMatch[1], 10);

    // Extract price range
    const priceMatch = html.match(/(\${1,4})/);
    if (priceMatch) result.price_range = priceMatch[1];

    // Extract phone
    const phoneMatch = html.match(/\((\d{3})\)\s*(\d{3})-(\d{4})/);
    if (phoneMatch) result.phone = phoneMatch[0];

  } catch (error) {
    result.error = error.message;
  }

  return result;
}

/**
 * Extract structured data from Google Business page
 */
export async function scrapeGoogleBusiness(googleUrl) {
  const result = {
    source: 'Google Business',
    found: false,
    name: null,
    rating: null,
    review_count: null,
    address: null,
    phone: null,
    website: null,
    place_id: null,
  };

  // Note: Google Maps/Business scraping is complex and often blocked
  // This is a placeholder for when proper API access is available
  result.message = 'Google Business data requires Places API access';
  result.api_needed = 'GOOGLE_PLACES_API_KEY';

  return result;
}
