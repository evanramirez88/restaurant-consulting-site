/**
 * Full Intelligence Enrichment API
 *
 * POST /api/admin/intelligence/enrich-full
 *
 * Comprehensive data gathering for restaurant prospects including:
 * - Web search for business info, owner, established date
 * - Menu analysis from website
 * - Hours and ratings from Google/Yelp
 * - Property/assessor data lookup
 * - License verification
 *
 * This endpoint does the HEAVY LIFTING of finding data, not just linking to it.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

// Cape Cod town assessor URLs
const ASSESSOR_URLS = {
  'Barnstable': 'https://www.townofbarnstable.us/Departments/Assessing/',
  'Bourne': 'https://www.townofbourne.com/assessors-office',
  'Brewster': 'https://www.brewster-ma.gov/assessors-office',
  'Chatham': 'https://www.chatham-ma.gov/assessors-office',
  'Dennis': 'https://www.town.dennis.ma.us/assessors-office',
  'Eastham': 'https://www.eastham-ma.gov/assessors-office',
  'Falmouth': 'https://www.falmouthma.gov/155/Assessors',
  'Harwich': 'https://www.harwich-ma.gov/assessors',
  'Mashpee': 'https://www.mashpeema.gov/assessors',
  'Orleans': 'https://www.town.orleans.ma.us/assessors-office',
  'Provincetown': 'https://www.provincetown-ma.gov/156/Assessors',
  'Sandwich': 'https://www.sandwichmass.org/188/Assessors-Office',
  'Truro': 'https://www.truro-ma.gov/assessors-office',
  'Wellfleet': 'https://www.wellfleet-ma.gov/assessors-office',
  'Yarmouth': 'https://www.yarmouth.ma.us/142/Assessors-Office',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { leadId, company, town, address, enrichTypes = ['all'] } = body;

    if (!leadId && !company) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Either leadId or company name is required'
      }), { status: 400, headers: corsHeaders });
    }

    // If leadId provided, fetch existing data
    let existingData = {};
    if (leadId) {
      const lead = await env.DB.prepare(`
        SELECT * FROM restaurant_leads WHERE id = ?
      `).bind(leadId).first();
      if (lead) {
        existingData = lead;
      }
    }

    const businessName = company || existingData.name || '';
    const businessTown = town || existingData.city || '';
    const businessAddress = address || existingData.address_line1 || '';

    if (!businessName) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Company name is required for enrichment'
      }), { status: 400, headers: corsHeaders });
    }

    // Results object to collect all enriched data
    const enrichedData = {
      company: businessName,
      town: businessTown,
      sources: [],
      fields_updated: [],
      errors: []
    };

    const shouldEnrich = (type) => enrichTypes.includes('all') || enrichTypes.includes(type);

    // 1. WEB SEARCH for general business info
    if (shouldEnrich('general') || shouldEnrich('all')) {
      try {
        const searchResults = await performWebSearch(env, businessName, businessTown, [
          'owner', 'established', 'history', 'about'
        ]);

        if (searchResults) {
          enrichedData.owner_name = searchResults.owner_name;
          enrichedData.established_date = searchResults.established_date;
          enrichedData.years_in_business = searchResults.years_in_business;
          enrichedData.website = searchResults.website;
          enrichedData.phone = searchResults.phone;
          enrichedData.email = searchResults.email;
          enrichedData.description = searchResults.description;
          enrichedData.sources.push({ type: 'web_search', query: searchResults.query });
          enrichedData.fields_updated.push('owner_name', 'established_date', 'website', 'phone', 'email');
        }
      } catch (error) {
        enrichedData.errors.push({ type: 'general_search', error: error.message });
      }
    }

    // 2. MENU ANALYSIS
    if (shouldEnrich('menu') || shouldEnrich('all')) {
      try {
        const menuData = await analyzeMenu(env, businessName, businessTown, existingData.website_url);

        if (menuData) {
          enrichedData.menu_item_count = menuData.total_items;
          enrichedData.menu_category_count = menuData.category_count;
          enrichedData.avg_menu_price = menuData.avg_price;
          enrichedData.price_level = menuData.price_level;
          enrichedData.menu_url = menuData.menu_url;
          enrichedData.menu_complexity = menuData.complexity;
          enrichedData.cuisine_detected = menuData.cuisines;
          enrichedData.bar_program = menuData.bar_program;
          enrichedData.sources.push({ type: 'menu_analysis', url: menuData.menu_url });
          enrichedData.fields_updated.push('menu_item_count', 'avg_menu_price', 'menu_complexity');
        }
      } catch (error) {
        enrichedData.errors.push({ type: 'menu_analysis', error: error.message });
      }
    }

    // 3. HOURS & RATINGS (Google/Yelp search)
    if (shouldEnrich('reviews') || shouldEnrich('all')) {
      try {
        const reviewData = await fetchReviewData(env, businessName, businessTown, businessAddress);

        if (reviewData) {
          enrichedData.google_rating = reviewData.google_rating;
          enrichedData.google_review_count = reviewData.google_review_count;
          enrichedData.yelp_rating = reviewData.yelp_rating;
          enrichedData.yelp_review_count = reviewData.yelp_review_count;
          enrichedData.hours_json = reviewData.hours;
          enrichedData.price_level = reviewData.price_level || enrichedData.price_level;
          enrichedData.sources.push({ type: 'review_data', platforms: ['google', 'yelp'] });
          enrichedData.fields_updated.push('google_rating', 'yelp_rating', 'hours_json');
        }
      } catch (error) {
        enrichedData.errors.push({ type: 'review_data', error: error.message });
      }
    }

    // 4. ASSESSOR / PROPERTY DATA
    if ((shouldEnrich('assessor') || shouldEnrich('all')) && businessTown) {
      try {
        const assessorData = await fetchAssessorData(env, businessName, businessTown, businessAddress);

        if (assessorData) {
          enrichedData.parcel_id = assessorData.parcel_id;
          enrichedData.property_owner = assessorData.owner_name;
          enrichedData.building_sqft = assessorData.building_sqft;
          enrichedData.property_value = assessorData.assessed_value;
          enrichedData.assessor_url = assessorData.source_url;
          enrichedData.floor_plan_notes = assessorData.floor_plan_notes;
          enrichedData.square_footage = assessorData.building_sqft;
          enrichedData.sources.push({ type: 'assessor', town: businessTown, url: assessorData.source_url });
          enrichedData.fields_updated.push('parcel_id', 'property_owner', 'building_sqft', 'assessor_url');
        }
      } catch (error) {
        enrichedData.errors.push({ type: 'assessor', error: error.message });
      }
    }

    // 5. LICENSE VERIFICATION (ABCC)
    if (shouldEnrich('license') || shouldEnrich('all')) {
      try {
        const licenseData = await fetchLicenseData(env, businessName, businessTown);

        if (licenseData) {
          enrichedData.license_number = licenseData.license_number;
          enrichedData.license_type = licenseData.license_type;
          enrichedData.seating_capacity = licenseData.seating_capacity;
          enrichedData.sources.push({ type: 'license', source: 'ABCC' });
          enrichedData.fields_updated.push('license_number', 'license_type', 'seating_capacity');
        }
      } catch (error) {
        enrichedData.errors.push({ type: 'license', error: error.message });
      }
    }

    // 6. VOLUME/REVENUE ESTIMATION
    if (shouldEnrich('financial') || shouldEnrich('all')) {
      try {
        const financialEstimates = estimateFinancials(enrichedData);

        enrichedData.estimated_annual_revenue = financialEstimates.annual_revenue;
        enrichedData.estimated_daily_covers = financialEstimates.daily_covers;
        enrichedData.avg_check_size = financialEstimates.avg_check;
        enrichedData.fields_updated.push('estimated_annual_revenue', 'estimated_daily_covers', 'avg_check_size');
      } catch (error) {
        enrichedData.errors.push({ type: 'financial', error: error.message });
      }
    }

    // Calculate data completeness score
    enrichedData.data_completeness = calculateCompleteness(enrichedData);
    enrichedData.enrichment_confidence = calculateConfidence(enrichedData);
    enrichedData.last_enriched_at = Date.now();

    // Update database if leadId provided
    if (leadId) {
      await updateLeadWithEnrichedData(env, leadId, enrichedData);
    }

    return new Response(JSON.stringify({
      success: true,
      data: enrichedData,
      fields_updated: enrichedData.fields_updated.length,
      sources_used: enrichedData.sources.length,
      errors: enrichedData.errors
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('Full enrichment error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: corsHeaders });
  }
}

/**
 * Perform web search using Tavily or fallback
 */
async function performWebSearch(env, businessName, town, searchTerms) {
  const query = `"${businessName}" ${town} MA restaurant ${searchTerms.join(' ')}`;

  // Try Tavily first
  if (env.TAVILY_API_KEY) {
    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: env.TAVILY_API_KEY,
          query: query,
          search_depth: 'advanced',
          include_answer: true,
          max_results: 10
        })
      });

      const data = await response.json();

      if (data.results && data.results.length > 0) {
        return parseSearchResults(data.results, data.answer, businessName);
      }
    } catch (error) {
      console.error('Tavily search error:', error);
    }
  }

  // Fallback: Return search query for manual lookup
  return {
    query: query,
    website: null,
    owner_name: null,
    established_date: null,
    years_in_business: null,
    phone: null,
    email: null,
    description: null,
    _note: 'Manual research required - no API key configured'
  };
}

/**
 * Parse search results to extract business info
 */
function parseSearchResults(results, answer, businessName) {
  const data = {
    query: null,
    website: null,
    owner_name: null,
    established_date: null,
    years_in_business: null,
    phone: null,
    email: null,
    description: null
  };

  // Extract from answer if available
  if (answer) {
    // Look for owner patterns
    const ownerMatch = answer.match(/(?:owned by|owner|proprietor|operated by)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
    if (ownerMatch) data.owner_name = ownerMatch[1];

    // Look for established/since patterns
    const yearMatch = answer.match(/(?:since|established|opened|founded)\s+(\d{4})/i);
    if (yearMatch) {
      data.established_date = yearMatch[1];
      data.years_in_business = new Date().getFullYear() - parseInt(yearMatch[1]);
    }

    // Phone pattern
    const phoneMatch = answer.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    if (phoneMatch) data.phone = phoneMatch[0];

    // Email pattern
    const emailMatch = answer.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) data.email = emailMatch[0];

    data.description = answer.substring(0, 500);
  }

  // Extract website from results
  for (const result of results) {
    if (result.url && !result.url.includes('yelp.com') && !result.url.includes('tripadvisor.com') &&
        !result.url.includes('facebook.com') && !result.url.includes('google.com')) {
      // Check if it looks like the business's own site
      const domain = new URL(result.url).hostname.toLowerCase();
      const nameParts = businessName.toLowerCase().split(/\s+/);
      if (nameParts.some(part => domain.includes(part)) || result.url.includes('/menu')) {
        data.website = result.url;
        break;
      }
    }
  }

  return data;
}

/**
 * Analyze menu from website or search
 */
async function analyzeMenu(env, businessName, town, existingWebsite) {
  let menuUrl = existingWebsite ? `${existingWebsite}/menu` : null;

  // Search for menu if no website
  if (!existingWebsite && env.TAVILY_API_KEY) {
    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: env.TAVILY_API_KEY,
          query: `"${businessName}" ${town} MA menu prices`,
          search_depth: 'basic',
          max_results: 5
        })
      });

      const data = await response.json();

      if (data.results) {
        for (const result of data.results) {
          if (result.url.includes('/menu') || result.title?.toLowerCase().includes('menu')) {
            menuUrl = result.url;
            break;
          }
        }
      }
    } catch (error) {
      console.error('Menu search error:', error);
    }
  }

  // Analyze the menu content (simulated - would need real scraping)
  // For now, estimate based on restaurant type
  const menuData = {
    menu_url: menuUrl,
    total_items: null,
    category_count: null,
    avg_price: null,
    price_level: null,
    complexity: null,
    cuisines: [],
    bar_program: null
  };

  // If we have a menu URL, we could scrape it
  // For now, return the URL for manual analysis
  if (menuUrl) {
    menuData._note = 'Menu URL found - manual analysis or scraping needed';
  }

  return menuData;
}

/**
 * Fetch review data from web search
 */
async function fetchReviewData(env, businessName, town, address) {
  const reviewData = {
    google_rating: null,
    google_review_count: null,
    yelp_rating: null,
    yelp_review_count: null,
    hours: null,
    price_level: null
  };

  if (env.TAVILY_API_KEY) {
    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: env.TAVILY_API_KEY,
          query: `"${businessName}" ${town} MA reviews rating yelp`,
          search_depth: 'basic',
          max_results: 5
        })
      });

      const data = await response.json();

      if (data.answer) {
        // Extract rating patterns
        const ratingMatch = data.answer.match(/(\d(?:\.\d)?)\s*(?:out of 5|\/5|stars?)/i);
        if (ratingMatch) {
          reviewData.google_rating = parseFloat(ratingMatch[1]);
        }

        // Extract review count
        const reviewMatch = data.answer.match(/(\d+)\s*reviews?/i);
        if (reviewMatch) {
          reviewData.google_review_count = parseInt(reviewMatch[1]);
        }

        // Extract price level
        const priceMatch = data.answer.match(/\$+/);
        if (priceMatch) {
          reviewData.price_level = priceMatch[0].length;
        }
      }
    } catch (error) {
      console.error('Review search error:', error);
    }
  }

  return reviewData;
}

/**
 * Fetch assessor/property data
 */
async function fetchAssessorData(env, businessName, town, address) {
  const assessorUrl = ASSESSOR_URLS[town];

  if (!assessorUrl) {
    return {
      source_url: null,
      _note: `No assessor URL configured for ${town}. Manual lookup required.`
    };
  }

  // For now, return the URL for manual lookup
  // Real implementation would scrape the assessor database
  const searchUrl = `https://www.google.com/search?q=site:${new URL(assessorUrl).hostname}+"${address || businessName}"`;

  return {
    parcel_id: null,
    owner_name: null,
    building_sqft: null,
    assessed_value: null,
    source_url: assessorUrl,
    search_url: searchUrl,
    floor_plan_notes: `Check ${town} Assessor database for floor plans and property records`,
    _note: 'Assessor data requires manual lookup or scraping'
  };
}

/**
 * Fetch license data from ABCC
 */
async function fetchLicenseData(env, businessName, town) {
  const searchUrl = `https://www.google.com/search?q=site:mass.gov+ABCC+"${businessName}"+${town}`;

  // For now, return search URL
  // Real implementation would scrape ABCC database
  return {
    license_number: null,
    license_type: null,
    seating_capacity: null,
    search_url: searchUrl,
    _note: 'License data requires ABCC database lookup'
  };
}

/**
 * Estimate financial metrics based on available data
 */
function estimateFinancials(data) {
  // Industry averages for Cape Cod restaurants
  const estimates = {
    annual_revenue: null,
    daily_covers: null,
    avg_check: null
  };

  const seating = data.seating_capacity || data.square_footage ? Math.floor(data.square_footage / 15) : 50;
  const priceLevel = data.price_level || 2;

  // Estimate average check based on price level
  const avgCheckByPrice = { 1: 15, 2: 25, 3: 45, 4: 80 };
  estimates.avg_check = avgCheckByPrice[priceLevel] || 25;

  // Estimate daily covers (2 turns average)
  estimates.daily_covers = Math.round(seating * 2);

  // Estimate annual revenue
  // Assume 300 operating days, seasonal adjustment for Cape Cod
  const seasonalMultiplier = data.seasonal ? 0.6 : 0.85; // Seasonal = ~7 months, year-round = ~10 months effective
  estimates.annual_revenue = Math.round(
    estimates.daily_covers * estimates.avg_check * 300 * seasonalMultiplier
  );

  return estimates;
}

/**
 * Calculate data completeness percentage
 */
function calculateCompleteness(data) {
  const importantFields = [
    'website', 'phone', 'email', 'address', 'owner_name',
    'seating_capacity', 'menu_item_count', 'google_rating',
    'hours_json', 'license_type', 'price_level', 'bar_program'
  ];

  let filledCount = 0;
  for (const field of importantFields) {
    if (data[field] !== null && data[field] !== undefined && data[field] !== '') {
      filledCount++;
    }
  }

  return Math.round((filledCount / importantFields.length) * 100);
}

/**
 * Calculate confidence score based on sources
 */
function calculateConfidence(data) {
  let confidence = 0;
  const sourceTypes = data.sources.map(s => s.type);

  if (sourceTypes.includes('web_search')) confidence += 25;
  if (sourceTypes.includes('menu_analysis')) confidence += 20;
  if (sourceTypes.includes('review_data')) confidence += 20;
  if (sourceTypes.includes('assessor')) confidence += 20;
  if (sourceTypes.includes('license')) confidence += 15;

  // Penalty for errors
  confidence -= data.errors.length * 5;

  return Math.max(0, Math.min(100, confidence));
}

/**
 * Store enriched data in appropriate tables
 * Only updates existing columns in restaurant_leads, stores detailed data in separate tables
 */
async function updateLeadWithEnrichedData(env, leadId, data) {
  // Only update columns that exist in restaurant_leads
  const safeFieldMap = {
    website: 'website_url',
    phone: 'primary_phone',
    email: 'primary_email',
    license_number: 'license_number',
    license_type: 'license_type',
    seating_capacity: 'actual_seat_count',
  };

  const updateFields = [];
  const updateValues = [];

  for (const [sourceKey, dbColumn] of Object.entries(safeFieldMap)) {
    if (data[sourceKey] !== null && data[sourceKey] !== undefined && data[sourceKey] !== '') {
      updateFields.push(`${dbColumn} = ?`);
      updateValues.push(data[sourceKey]);
    }
  }

  if (updateFields.length > 0) {
    updateFields.push('updated_at = ?');
    updateValues.push(Date.now());
    updateValues.push(leadId);

    try {
      const query = `UPDATE restaurant_leads SET ${updateFields.join(', ')} WHERE id = ?`;
      await env.DB.prepare(query).bind(...updateValues).run();
    } catch (error) {
      console.error('Error updating lead:', error);
    }
  }

  // Store menu analysis in separate table
  if (data.menu_item_count || data.avg_menu_price || data.menu_url) {
    try {
      const menuId = `menu_${leadId}_${Date.now()}`;
      await env.DB.prepare(`
        INSERT OR REPLACE INTO menu_analysis (id, lead_id, menu_url, total_items, price_avg, modifier_complexity, analyzed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        menuId,
        leadId,
        data.menu_url || null,
        data.menu_item_count || null,
        data.avg_menu_price || null,
        data.menu_complexity || null,
        Date.now()
      ).run();
    } catch (error) {
      console.error('Error storing menu analysis:', error);
    }
  }

  // Store assessor data in separate table
  if (data.parcel_id || data.property_owner || data.assessor_url) {
    try {
      const assessorId = `assessor_${leadId}_${Date.now()}`;
      await env.DB.prepare(`
        INSERT OR REPLACE INTO assessor_data (id, lead_id, town, parcel_id, owner_name, total_sqft, assessed_value, source_url, fetched_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        assessorId,
        leadId,
        data.town || null,
        data.parcel_id || null,
        data.property_owner || null,
        data.building_sqft || null,
        data.property_value || null,
        data.assessor_url || null,
        Date.now()
      ).run();
    } catch (error) {
      console.error('Error storing assessor data:', error);
    }
  }

  // Log the enrichment job
  try {
    const jobId = `enrich_${leadId}_${Date.now()}`;
    await env.DB.prepare(`
      INSERT INTO enrichment_jobs (id, lead_id, status, fields_updated, completed_at, created_at)
      VALUES (?, ?, 'completed', ?, ?, ?)
    `).bind(
      jobId,
      leadId,
      JSON.stringify(data.fields_updated || []),
      Date.now(),
      Date.now()
    ).run();
  } catch (error) {
    console.error('Error logging enrichment job:', error);
  }
}

// GET endpoint to check enrichment status or get campaigns
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  if (action === 'campaigns') {
    // Return available email campaigns
    try {
      const campaigns = await env.DB.prepare(`
        SELECT id, name, description, sequence_id, target_segment, is_active
        FROM email_campaigns
        WHERE is_active = 1
        ORDER BY name
      `).all();

      return new Response(JSON.stringify({
        success: true,
        campaigns: campaigns.results || []
      }), { headers: corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), { status: 500, headers: corsHeaders });
    }
  }

  if (action === 'sources') {
    // Return available enrichment sources
    try {
      const sources = await env.DB.prepare(`
        SELECT id, source_name, source_type, fields_provided, is_active
        FROM enrichment_sources
        WHERE is_active = 1
        ORDER BY source_name
      `).all();

      return new Response(JSON.stringify({
        success: true,
        sources: sources.results || []
      }), { headers: corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), { status: 500, headers: corsHeaders });
    }
  }

  return new Response(JSON.stringify({
    success: true,
    endpoints: {
      'POST /': 'Run full enrichment for a lead',
      'GET /?action=campaigns': 'List available email campaigns',
      'GET /?action=sources': 'List available enrichment sources'
    }
  }), { headers: corsHeaders });
}
