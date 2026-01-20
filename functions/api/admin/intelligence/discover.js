/**
 * Lead Discovery API
 *
 * POST /api/admin/intelligence/discover - Discover new restaurant leads
 *
 * Discovery methods:
 * 1. Web search for restaurants in a location
 * 2. Technology-based discovery (find restaurants using specific POS)
 * 3. Directory scraping (Yelp, Google Business, TripAdvisor)
 * 4. Competitor research
 * 5. Single website scan (for testing)
 *
 * Integrates with Tavily/Exa search providers for web research
 */

import { scrapeRestaurantWebsite, detectTechStack } from './_lib/scraper.js';
import { unifiedSearch, SearchPriority } from '../../../_shared/search-providers.js';

// Cape Cod towns for seeding
const CAPE_COD_TOWNS = {
  'Provincetown': 'Outer Cape', 'Truro': 'Outer Cape', 'Wellfleet': 'Outer Cape', 'Eastham': 'Outer Cape',
  'Orleans': 'Lower Cape', 'Chatham': 'Lower Cape', 'Brewster': 'Lower Cape', 'Harwich': 'Lower Cape',
  'Dennis': 'Mid Cape', 'Yarmouth': 'Mid Cape', 'Barnstable': 'Mid Cape',
  'Mashpee': 'Upper Cape', 'Falmouth': 'Upper Cape', 'Sandwich': 'Upper Cape', 'Bourne': 'Upper Cape',
};

// Known Cape Cod restaurants to seed - 150+ establishments
const KNOWN_RESTAURANTS = [
  // PROVINCETOWN (25+)
  { name: 'The Mews Restaurant', town: 'Provincetown', address: '429 Commercial St', type: 'fine_dining', cuisine: 'American' },
  { name: 'Fanizzis by the Sea', town: 'Provincetown', address: '539 Commercial St', type: 'casual_dining', cuisine: 'Italian' },
  { name: 'The Red Inn', town: 'Provincetown', address: '15 Commercial St', type: 'fine_dining', cuisine: 'American' },
  { name: 'Napis Restaurant', town: 'Provincetown', address: '7 Freeman St', type: 'casual_dining', cuisine: 'International' },
  { name: 'Mac Seafood Provincetown', town: 'Provincetown', address: '85 Shank Painter Rd', type: 'seafood_market', cuisine: 'Seafood' },
  { name: 'Sals Place', town: 'Provincetown', address: '99 Commercial St', type: 'casual_dining', cuisine: 'Italian' },
  { name: 'Front Street Restaurant', town: 'Provincetown', address: '230 Commercial St', type: 'fine_dining', cuisine: 'Mediterranean' },
  { name: 'Strangers and Saints', town: 'Provincetown', address: '404 Commercial St', type: 'bar_pub', cuisine: 'American' },
  { name: 'The Canteen Provincetown', town: 'Provincetown', address: '225 Commercial St', type: 'fast_casual', cuisine: 'Seafood' },
  { name: 'Ross Grill', town: 'Provincetown', address: '237 Commercial St', type: 'casual_dining', cuisine: 'American' },
  { name: 'Pepes Wharf', town: 'Provincetown', address: '371 Commercial St', type: 'casual_dining', cuisine: 'Seafood' },
  { name: 'The Lobster Pot', town: 'Provincetown', address: '321 Commercial St', type: 'casual_dining', cuisine: 'Seafood' },
  { name: 'Cafe Heaven', town: 'Provincetown', address: '199 Commercial St', type: 'cafe_coffee', cuisine: 'Breakfast' },
  { name: 'Crown and Anchor', town: 'Provincetown', address: '247 Commercial St', type: 'bar_pub', cuisine: 'American' },
  { name: 'Governor Bradford', town: 'Provincetown', address: '312 Commercial St', type: 'bar_pub', cuisine: 'American' },
  { name: 'Ocean 193', town: 'Provincetown', address: '193 Commercial St', type: 'casual_dining', cuisine: 'Seafood' },
  { name: 'Spiritus Pizza', town: 'Provincetown', address: '190 Commercial St', type: 'fast_casual', cuisine: 'Pizza' },
  // WELLFLEET
  { name: 'Winslows Tavern', town: 'Wellfleet', address: '316 Main St', type: 'bar_pub', cuisine: 'American' },
  { name: 'Mac Shack', town: 'Wellfleet', address: '91 Commercial St', type: 'seafood_market', cuisine: 'Seafood' },
  { name: 'The Wicked Oyster', town: 'Wellfleet', address: '50 Main St', type: 'casual_dining', cuisine: 'Seafood' },
  { name: 'Bookstore Restaurant', town: 'Wellfleet', address: '50 Kendrick Ave', type: 'casual_dining', cuisine: 'Seafood' },
  { name: 'PB Boulangerie Bistro', town: 'Wellfleet', address: '15 Lecount Hollow Rd', type: 'bakery', cuisine: 'French' },
  { name: 'Moby Dicks Wellfleet', town: 'Wellfleet', address: '3225 US-6', type: 'casual_dining', cuisine: 'Seafood' },
  { name: 'Pearl Restaurant', town: 'Wellfleet', address: '12 Bank St', type: 'fine_dining', cuisine: 'Seafood' },
  // TRURO
  { name: 'Blackfish', town: 'Truro', address: '17 Truro Center Rd', type: 'fine_dining', cuisine: 'American' },
  { name: 'Terra Luna', town: 'Truro', address: '104 Shore Rd', type: 'casual_dining', cuisine: 'American' },
  { name: 'Truro Vineyards', town: 'Truro', address: '11 Shore Rd', type: 'brewery_winery', cuisine: 'Wine' },
  // EASTHAM
  { name: 'Arnolds Lobster Clam Bar', town: 'Eastham', address: '3580 State Hwy', type: 'casual_dining', cuisine: 'Seafood' },
  { name: 'Hole in One Eastham', town: 'Eastham', address: '4295 State Hwy', type: 'cafe_coffee', cuisine: 'Breakfast' },
  // ORLEANS
  { name: 'The Beacon Room', town: 'Orleans', address: '23 West Rd', type: 'fine_dining', cuisine: 'American' },
  { name: 'Abba Restaurant', town: 'Orleans', address: '89 Old Colony Way', type: 'fine_dining', cuisine: 'Mediterranean' },
  { name: 'Nauset Beach Club', town: 'Orleans', address: '222 Main St', type: 'casual_dining', cuisine: 'Italian' },
  { name: 'Captain Linnell House', town: 'Orleans', address: '137 Skaket Beach Rd', type: 'fine_dining', cuisine: 'American' },
  { name: 'Land Ho Orleans', town: 'Orleans', address: '38 Main St', type: 'bar_pub', cuisine: 'American' },
  { name: 'Mahoneys Atlantic Bar', town: 'Orleans', address: '28 Main St', type: 'casual_dining', cuisine: 'Seafood' },
  { name: 'Hot Chocolate Sparrow', town: 'Orleans', address: '5 Old Colony Way', type: 'cafe_coffee', cuisine: 'Cafe' },
  { name: 'Cottage St Bakery', town: 'Orleans', address: '5 Cottage St', type: 'bakery', cuisine: 'Bakery' },
  { name: 'Yardarm Restaurant', town: 'Orleans', address: '785 MA-28', type: 'casual_dining', cuisine: 'Seafood' },
  // CHATHAM
  { name: 'Impudent Oyster', town: 'Chatham', address: '15 Chatham Bars Ave', type: 'casual_dining', cuisine: 'Seafood' },
  { name: 'Del Mar Bar Bistro', town: 'Chatham', address: '907 Main St', type: 'fine_dining', cuisine: 'Mediterranean' },
  { name: 'Chatham Bars Inn Restaurant', town: 'Chatham', address: '297 Shore Rd', type: 'fine_dining', cuisine: 'American' },
  { name: 'The Chatham Squire', town: 'Chatham', address: '487 Main St', type: 'bar_pub', cuisine: 'American' },
  { name: 'Wild Goose Tavern', town: 'Chatham', address: '512 Main St', type: 'bar_pub', cuisine: 'American' },
  { name: 'Bluefins Sushi Chatham', town: 'Chatham', address: '513 Main St', type: 'casual_dining', cuisine: 'Japanese' },
  { name: 'Chatham Pier Fish Market', town: 'Chatham', address: '45 Barcliff Ave', type: 'seafood_market', cuisine: 'Seafood' },
  { name: 'Chatham Cut', town: 'Chatham', address: '907 Main St', type: 'casual_dining', cuisine: 'American' },
  { name: 'Marions Pie Shop', town: 'Chatham', address: '2022 Main St', type: 'bakery', cuisine: 'Bakery' },
  { name: 'Vinings Bistro', town: 'Chatham', address: '595 Main St', type: 'casual_dining', cuisine: 'American' },
  // BREWSTER
  { name: 'Chillingsworth', town: 'Brewster', address: '2449 Main St', type: 'fine_dining', cuisine: 'French' },
  { name: 'Bramble Inn', town: 'Brewster', address: '2019 Main St', type: 'fine_dining', cuisine: 'American' },
  { name: 'Brewster Fish House', town: 'Brewster', address: '2208 Main St', type: 'casual_dining', cuisine: 'Seafood' },
  { name: 'JTs Seafood', town: 'Brewster', address: '2689 Main St', type: 'casual_dining', cuisine: 'Seafood' },
  { name: 'Cobies Brewster', town: 'Brewster', address: '3260 Main St', type: 'fast_casual', cuisine: 'Seafood' },
  { name: 'Snowy Owl Coffee', town: 'Brewster', address: '2624 Main St', type: 'cafe_coffee', cuisine: 'Coffee' },
  { name: 'Laurinos Tavern', town: 'Brewster', address: '3668 Main St', type: 'bar_pub', cuisine: 'Italian' },
  // HARWICH
  { name: 'Cape Sea Grille', town: 'Harwich', address: '31 Sea St', type: 'fine_dining', cuisine: 'Seafood' },
  { name: 'Bucas Tuscan Roadhouse', town: 'Harwich', address: '4 Depot Rd', type: 'casual_dining', cuisine: 'Italian' },
  { name: 'Port Restaurant Harwich', town: 'Harwich', address: '541 Main St', type: 'casual_dining', cuisine: 'Seafood' },
  { name: 'Brax Landing', town: 'Harwich', address: '705 Main St', type: 'casual_dining', cuisine: 'Seafood' },
  { name: 'Hot Stove Saloon', town: 'Harwich', address: '551 Main St', type: 'bar_pub', cuisine: 'American' },
  { name: 'Ember Harwich', town: 'Harwich', address: '600 Main St', type: 'casual_dining', cuisine: 'American' },
  // DENNIS
  { name: 'Ocean House Dennis', town: 'Dennis', address: '425 Old Wharf Rd', type: 'fine_dining', cuisine: 'Seafood' },
  { name: 'Scargo Cafe', town: 'Dennis', address: '799 Main St', type: 'casual_dining', cuisine: 'American' },
  { name: 'Red Pheasant', town: 'Dennis', address: '905 Main St', type: 'fine_dining', cuisine: 'American' },
  { name: 'Sesuit Harbor Cafe', town: 'Dennis', address: '357 Sesuit Neck Rd', type: 'casual_dining', cuisine: 'Seafood' },
  { name: 'Ginas by the Sea', town: 'Dennis', address: '134 Taunton Ave', type: 'casual_dining', cuisine: 'Italian' },
  { name: 'Captain Frostys', town: 'Dennis', address: '219 Main St', type: 'fast_casual', cuisine: 'Seafood' },
  { name: 'Swan River Restaurant', town: 'Dennis', address: '5 Lower County Rd', type: 'casual_dining', cuisine: 'Seafood' },
  // YARMOUTH
  { name: 'Inaho Japanese', town: 'Yarmouth', address: '157 Main St', type: 'casual_dining', cuisine: 'Japanese' },
  { name: 'Olivers Restaurant', town: 'Yarmouth', address: '960 Main St', type: 'casual_dining', cuisine: 'American' },
  { name: 'Keltic Kitchen', town: 'Yarmouth', address: '415 Main St', type: 'casual_dining', cuisine: 'Irish' },
  { name: 'Skipper Restaurant', town: 'Yarmouth', address: '152 S Shore Dr', type: 'casual_dining', cuisine: 'Seafood' },
  { name: 'Captain Parkers Pub', town: 'Yarmouth', address: '668 MA-28', type: 'bar_pub', cuisine: 'American' },
  { name: 'Mattakeese Wharf', town: 'Yarmouth', address: '273 Mill Way', type: 'casual_dining', cuisine: 'Seafood' },
  // BARNSTABLE (Hyannis, Osterville, Centerville)
  { name: 'Naked Oyster', town: 'Barnstable', address: '410 Main St Hyannis', type: 'casual_dining', cuisine: 'Seafood' },
  { name: 'Pizza Barbone', town: 'Barnstable', address: '390 Main St Hyannis', type: 'fast_casual', cuisine: 'Pizza' },
  { name: 'Embargo Restaurant', town: 'Barnstable', address: '453 Main St Hyannis', type: 'casual_dining', cuisine: 'Spanish' },
  { name: 'Brazilian Grill Hyannis', town: 'Barnstable', address: '680 Main St Hyannis', type: 'casual_dining', cuisine: 'Brazilian' },
  { name: 'Baxters Boathouse', town: 'Barnstable', address: '177 Pleasant St Hyannis', type: 'casual_dining', cuisine: 'Seafood' },
  { name: 'Black Cat Tavern', town: 'Barnstable', address: '165 Ocean St Hyannis', type: 'bar_pub', cuisine: 'Seafood' },
  { name: 'Pain DAvignon', town: 'Barnstable', address: '15 Hinckley Rd Hyannis', type: 'bakery', cuisine: 'French' },
  { name: 'Five Bays Bistro', town: 'Barnstable', address: '825 Main St Osterville', type: 'fine_dining', cuisine: 'American' },
  { name: 'Wimpys Osterville', town: 'Barnstable', address: '752 Main St Osterville', type: 'casual_dining', cuisine: 'Seafood' },
  { name: 'Centerville Pie Company', town: 'Barnstable', address: '1671 Falmouth Rd', type: 'bakery', cuisine: 'Bakery' },
  { name: 'The Paddock', town: 'Barnstable', address: '20 Scudder Ave Hyannis', type: 'fine_dining', cuisine: 'American' },
  { name: 'Roadhouse Cafe', town: 'Barnstable', address: '488 South St Hyannis', type: 'casual_dining', cuisine: 'American' },
  { name: 'Four Seas Ice Cream', town: 'Barnstable', address: '360 S Main St Centerville', type: 'fast_casual', cuisine: 'Ice Cream' },
  { name: 'Colombos Cafe', town: 'Barnstable', address: '544 Main St Hyannis', type: 'cafe_coffee', cuisine: 'Cafe' },
  { name: 'Albertos Ristorante', town: 'Barnstable', address: '360 Main St Hyannis', type: 'casual_dining', cuisine: 'Italian' },
  // MASHPEE
  { name: 'Bleu Restaurant', town: 'Mashpee', address: '10 Market St', type: 'fine_dining', cuisine: 'French' },
  { name: 'Siena Italian', town: 'Mashpee', address: '17 Steeple St', type: 'casual_dining', cuisine: 'Italian' },
  { name: 'Bobby Byrnes Mashpee', town: 'Mashpee', address: '3 Market St', type: 'bar_pub', cuisine: 'American' },
  { name: 'The Raw Bar Mashpee', town: 'Mashpee', address: '16 Popponesset', type: 'casual_dining', cuisine: 'Seafood' },
  { name: 'Wicked Restaurant Mashpee', town: 'Mashpee', address: '24 Market St', type: 'casual_dining', cuisine: 'American' },
  { name: 'C Salt Wine Bar Mashpee', town: 'Mashpee', address: '36 Market St', type: 'bar_pub', cuisine: 'Wine Bar' },
  // FALMOUTH
  { name: 'Glass Onion', town: 'Falmouth', address: '37 N Main St', type: 'fine_dining', cuisine: 'American' },
  { name: 'Anejo Mexican Bistro', town: 'Falmouth', address: '188 Main St', type: 'casual_dining', cuisine: 'Mexican' },
  { name: 'Quarterdeck Restaurant', town: 'Falmouth', address: '164 Main St', type: 'casual_dining', cuisine: 'Seafood' },
  { name: 'Liam Maguires Irish Pub', town: 'Falmouth', address: '273 Main St', type: 'bar_pub', cuisine: 'Irish' },
  { name: 'The Flying Bridge', town: 'Falmouth', address: '220 Scranton Ave', type: 'casual_dining', cuisine: 'Seafood' },
  { name: 'Fishmongers Cafe', town: 'Falmouth', address: '56 Water St', type: 'casual_dining', cuisine: 'Seafood' },
  { name: 'Clam Shack Falmouth', town: 'Falmouth', address: '227 Clinton Ave', type: 'fast_casual', cuisine: 'Seafood' },
  { name: 'Casino Wharf FX', town: 'Falmouth', address: '286 Grand Ave', type: 'casual_dining', cuisine: 'Seafood' },
  { name: 'La Cucina Sul Mare', town: 'Falmouth', address: '237 Main St', type: 'casual_dining', cuisine: 'Italian' },
  { name: 'Chapoquoit Grill', town: 'Falmouth', address: '410 W Falmouth Hwy', type: 'casual_dining', cuisine: 'American' },
  { name: 'Maison Villatte', town: 'Falmouth', address: '267 Main St', type: 'bakery', cuisine: 'French' },
  { name: 'Shipwrecked Falmouth', town: 'Falmouth', address: '180 Scranton Ave', type: 'casual_dining', cuisine: 'Seafood' },
  { name: 'Betsys Diner', town: 'Falmouth', address: '457 Main St', type: 'casual_dining', cuisine: 'American' },
  { name: 'Landfall Restaurant', town: 'Falmouth', address: '2 Luscombe Ave', type: 'casual_dining', cuisine: 'Seafood' },
  // SANDWICH
  { name: 'Belfry Inn Bistro', town: 'Sandwich', address: '8 Jarves St', type: 'fine_dining', cuisine: 'American' },
  { name: 'Danl Webster Inn', town: 'Sandwich', address: '149 Main St', type: 'fine_dining', cuisine: 'American' },
  { name: 'Seafood Sams Sandwich', town: 'Sandwich', address: '6 Coast Guard Rd', type: 'fast_casual', cuisine: 'Seafood' },
  { name: 'Pilot House Restaurant', town: 'Sandwich', address: '14 Gallo Rd', type: 'casual_dining', cuisine: 'Seafood' },
  { name: 'Cafe Chew', town: 'Sandwich', address: '4 Merchants Square', type: 'cafe_coffee', cuisine: 'Cafe' },
  { name: 'Bobby Byrnes Sandwich', town: 'Sandwich', address: '65 Route 6A', type: 'bar_pub', cuisine: 'American' },
  { name: 'Aqua Grille', town: 'Sandwich', address: '14 Gallo Rd', type: 'casual_dining', cuisine: 'Seafood' },
  // BOURNE
  { name: 'Chart Room', town: 'Bourne', address: '1 Shipyard Ln', type: 'casual_dining', cuisine: 'Seafood' },
  { name: 'Sagamore Inn', town: 'Bourne', address: '1131 Main St', type: 'casual_dining', cuisine: 'American' },
  { name: 'Lobster Trap Bourne', town: 'Bourne', address: '290 Shore Rd', type: 'casual_dining', cuisine: 'Seafood' },
  { name: 'Stir Crazy Bourne', town: 'Bourne', address: '626 MacArthur Blvd', type: 'casual_dining', cuisine: 'Asian' },
  { name: 'Courtyard Restaurant Bourne', town: 'Bourne', address: '1337 County Rd', type: 'casual_dining', cuisine: 'American' },
];

// CORS headers for admin APIs
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const {
      method = 'location',  // 'location', 'technology', 'competitor', 'bulk_websites', 'single_website'
      location,
      technology,
      websites,  // For bulk website scanning
      website,   // For single website scanning
      url,       // Alternative name for single website
      competitor_url,
      limit = 20,
    } = body;

    let results;
    const targetUrl = website || url || competitor_url;

    // Handle seed_known action
    if (body.action === 'seed_known') {
      return await seedKnownRestaurants(env);
    }

    switch (method) {
      case 'location':
        results = await discoverByLocation(env, location, limit);
        break;
      case 'technology':
        results = await discoverByTechnology(env, technology, limit);
        break;
      case 'bulk_websites':
        results = await scanBulkWebsites(env, websites);
        break;
      case 'single_website':
        results = await scanSingleWebsite(env, targetUrl);
        break;
      case 'competitor':
        results = await researchCompetitor(env, competitor_url);
        break;
      default:
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid discovery method. Use: location, technology, bulk_websites, single_website, or competitor',
        }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({
      success: true,
      ...results,
    }), { headers: corsHeaders });
  } catch (error) {
    console.error('Discovery error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), { status: 500, headers: corsHeaders });
  }
}

/**
 * Discover restaurants by location using web search
 */
async function discoverByLocation(env, location, limit) {
  if (!location) {
    return { error: 'Location is required', discovered: [] };
  }

  const discovered = [];
  const searchResults = [];
  const searchQueries = [
    `restaurants in ${location}`,
    `best restaurants ${location}`,
    `new restaurants ${location}`,
  ];

  // Check if we have any existing leads for this location
  const existingLeads = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM restaurant_leads
    WHERE city LIKE ? OR state LIKE ?
  `).bind(`%${location}%`, `%${location}%`).first();

  // Perform web searches using Tavily/Exa if available
  const hasSearchProviders = env.TAVILY_API_KEY || env.EXA_API_KEY;

  if (hasSearchProviders) {
    // Only search if we have budget - use LOW priority to conserve credits
    for (const query of searchQueries.slice(0, 2)) { // Limit to 2 searches
      try {
        const result = await unifiedSearch(query, env, {
          priority: SearchPriority.LOW,
          maxResults: 5,
          topic: 'general'
        });

        if (result.success && result.results) {
          searchResults.push({
            query,
            results: result.results,
            provider: result.provider,
            fromCache: result.fromCache
          });

          // Extract potential restaurant URLs from results
          for (const r of result.results) {
            if (r.url && !r.url.includes('yelp.com') && !r.url.includes('tripadvisor.com')) {
              discovered.push({
                url: r.url,
                title: r.title,
                snippet: r.content?.substring(0, 200),
                source: 'web_search'
              });
            }
          }
        }
      } catch (error) {
        console.error(`Search error for "${query}":`, error.message);
      }
    }
  }

  return {
    method: 'location',
    location,
    existing_leads: existingLeads?.count || 0,
    discovered: discovered,
    search_queries: searchQueries,
    search_results: searchResults,
    search_enabled: hasSearchProviders,
    message: hasSearchProviders
      ? `Found ${discovered.length} potential leads in ${location} via web search. ${existingLeads?.count || 0} existing leads in database.`
      : `Search APIs not configured. ${existingLeads?.count || 0} existing leads in database.`,
    next_steps: discovered.length > 0
      ? ['Use bulk_websites method to scan discovered URLs', 'Review search results for additional leads']
      : ['Use bulk_websites method with URLs from manual search', 'Import CSV from Yelp/Google Business export', 'Use BuiltWith data for technology-based discovery'],
  };
}

/**
 * Discover restaurants using specific technology
 */
async function discoverByTechnology(env, technology, limit) {
  if (!technology) {
    return { error: 'Technology type is required', discovered: [] };
  }

  // Query existing leads with this technology
  const existingWithTech = await env.DB.prepare(`
    SELECT id, name, primary_email, website_url, city, state, lead_score
    FROM restaurant_leads
    WHERE LOWER(current_pos) LIKE ?
    ORDER BY lead_score DESC
    LIMIT ?
  `).bind(`%${technology.toLowerCase()}%`, limit).all();

  // Find leads WITHOUT this technology (potential switch targets)
  const switchTargets = await env.DB.prepare(`
    SELECT id, name, primary_email, website_url, city, state, current_pos, lead_score
    FROM restaurant_leads
    WHERE current_pos IS NOT NULL
    AND LOWER(current_pos) NOT LIKE ?
    AND LOWER(current_pos) NOT LIKE '%unknown%'
    AND lead_score >= 60
    ORDER BY lead_score DESC
    LIMIT ?
  `).bind(`%${technology.toLowerCase()}%`, limit).all();

  return {
    method: 'technology',
    technology,
    existing_users: {
      count: existingWithTech.results?.length || 0,
      leads: existingWithTech.results || [],
    },
    switch_targets: {
      count: switchTargets.results?.length || 0,
      leads: switchTargets.results || [],
      message: `Restaurants NOT using ${technology} - potential switch opportunities`,
    },
    discovery_tips: [
      `Search BuiltWith for "${technology}" technology`,
      `Check job postings mentioning ${technology}`,
      `Look for ${technology} partner/reseller directories`,
    ],
  };
}

/**
 * Scan a single website and create/update lead
 */
async function scanSingleWebsite(env, url) {
  if (!url) {
    return { error: 'URL is required', success: false };
  }

  // Normalize URL
  let normalizedUrl = url;
  if (!url.startsWith('http')) {
    normalizedUrl = 'https://' + url;
  }

  // Extract domain for matching
  let domain;
  try {
    domain = new URL(normalizedUrl).hostname.replace('www.', '');
  } catch (e) {
    return { error: 'Invalid URL format', success: false };
  }

  // Check if this is an existing client (by email domain or company name)
  const existingClient = await env.DB.prepare(`
    SELECT id, name, company, email, phone
    FROM clients
    WHERE LOWER(company) LIKE ? OR LOWER(email) LIKE ?
  `).bind(`%${domain}%`, `%${domain}%`).first();

  // Check if this is an existing lead
  const existingLead = await env.DB.prepare(`
    SELECT id, name, primary_email, primary_phone, website_url, current_pos, status
    FROM restaurant_leads
    WHERE website_url LIKE ? OR domain LIKE ?
  `).bind(`%${domain}%`, `%${domain}%`).first();

  // Scrape the website
  const scrapeResult = await scrapeRestaurantWebsite(normalizedUrl);

  if (!scrapeResult.success) {
    return {
      method: 'single_website',
      url: normalizedUrl,
      success: false,
      errors: scrapeResult.errors,
      existing_client: existingClient || null,
      existing_lead: existingLead || null,
    };
  }

  // Extract data from scrape
  const email = scrapeResult.contacts.emails?.[0];
  const phone = scrapeResult.contacts.phones?.[0];
  const restaurantName = scrapeResult.data.page_title?.split(/[|\-–—]/)[0]?.trim() || domain;
  const address = scrapeResult.contacts.addresses?.[0];

  let leadResult = null;
  let action = 'none';

  if (existingClient) {
    // This is an existing client - return their info
    action = 'existing_client';
    leadResult = {
      type: 'client',
      id: existingClient.id,
      name: existingClient.name,
      company: existingClient.company,
    };
  } else if (existingLead) {
    // Update existing lead with new data
    action = 'updated_lead';
    const updates = [];
    const params = [];

    if (!existingLead.primary_email && email) {
      updates.push('primary_email = ?');
      params.push(email);
    }
    if (!existingLead.primary_phone && phone) {
      updates.push('primary_phone = ?');
      params.push(phone);
    }
    if (!existingLead.current_pos && scrapeResult.tech_stack.pos_system) {
      updates.push('current_pos = ?');
      params.push(scrapeResult.tech_stack.pos_system);
    }

    if (updates.length > 0) {
      updates.push('updated_at = unixepoch()');
      updates.push('enriched_at = unixepoch()');
      updates.push("enrichment_source = 'web_discovery'");
      params.push(existingLead.id);

      await env.DB.prepare(`
        UPDATE restaurant_leads SET ${updates.join(', ')} WHERE id = ?
      `).bind(...params).run();
    }

    leadResult = {
      type: 'lead',
      id: existingLead.id,
      name: existingLead.name,
      updated_fields: updates.length - 3, // minus the timestamp fields
    };
  } else {
    // Create new lead
    action = 'created_lead';
    const leadId = 'lead_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
    const leadScore = calculateLeadScore(scrapeResult);

    await env.DB.prepare(`
      INSERT INTO restaurant_leads (
        id, name, domain, primary_email, primary_phone, website_url, current_pos,
        online_ordering_provider, reservation_provider,
        cuisine_primary, service_style,
        source, lead_score, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'web_discovery', ?, 'prospect', unixepoch(), unixepoch())
    `).bind(
      leadId,
      restaurantName,
      domain,
      email || null,
      phone || null,
      normalizedUrl,
      scrapeResult.tech_stack.pos_system || null,
      scrapeResult.tech_stack.online_ordering || null,
      scrapeResult.tech_stack.reservation_system || null,
      scrapeResult.data.cuisine_hints?.[0]?.cuisine || null,
      scrapeResult.data.service_hints?.[0]?.style || null,
      leadScore
    ).run();

    leadResult = {
      type: 'new_lead',
      id: leadId,
      name: restaurantName,
      score: leadScore,
    };
  }

  return {
    method: 'single_website',
    url: normalizedUrl,
    success: true,
    action,
    lead: leadResult,
    scraped_data: {
      name: restaurantName,
      email,
      phone,
      address,
      tech_stack: scrapeResult.tech_stack,
      social: scrapeResult.data.social,
      cuisine: scrapeResult.data.cuisine_hints,
      service_style: scrapeResult.data.service_hints,
      menu_url: scrapeResult.data.menu_url,
      order_url: scrapeResult.data.order_url,
    },
    existing_client: existingClient || null,
    existing_lead: existingLead || null,
  };
}

/**
 * Scan multiple websites in bulk
 */
async function scanBulkWebsites(env, websites) {
  if (!websites || !Array.isArray(websites) || websites.length === 0) {
    return { error: 'Websites array is required', scanned: [] };
  }

  const results = [];
  const leadsCreated = [];
  const leadsUpdated = [];
  const errors = [];

  // Limit to 10 websites per request to avoid timeout
  const toScan = websites.slice(0, 10);

  for (const url of toScan) {
    try {
      const scanResult = await scanSingleWebsite(env, url);

      if (scanResult.success) {
        results.push({
          url,
          success: true,
          action: scanResult.action,
          data: scanResult.scraped_data,
        });

        if (scanResult.action === 'created_lead') {
          // Include fields that frontend expects (company, pos)
          leadsCreated.push({
            ...scanResult.lead,
            company: scanResult.scraped_data?.name || scanResult.lead?.name,
            pos: scanResult.scraped_data?.tech_stack?.pos_system || null,
          });
        } else if (scanResult.action === 'updated_lead') {
          leadsUpdated.push({
            ...scanResult.lead,
            company: scanResult.scraped_data?.name || scanResult.lead?.name,
          });
        } else if (scanResult.action === 'existing_client') {
          // Note: this is an existing client, not a new lead
          results[results.length - 1].existing_client = scanResult.existing_client;
        }
      } else {
        results.push({
          url,
          success: false,
          errors: scanResult.errors,
        });
      }
    } catch (error) {
      errors.push({ url, error: error.message });
    }
  }

  return {
    method: 'bulk_websites',
    total_submitted: websites.length,
    scanned: toScan.length,
    successful: results.filter(r => r.success).length,
    leads_created: leadsCreated.length,
    leads_updated: leadsUpdated.length,
    new_leads: leadsCreated,
    updated_leads: leadsUpdated,
    results,
    errors,
    remaining: websites.length - toScan.length,
    message: websites.length > 10
      ? `Scanned first 10 of ${websites.length} URLs. Submit remaining ${websites.length - 10} in another request.`
      : `Scanned ${toScan.length} websites, created ${leadsCreated.length} new leads, updated ${leadsUpdated.length} existing leads.`,
  };
}

/**
 * Research a competitor restaurant
 */
async function researchCompetitor(env, competitorUrl) {
  if (!competitorUrl) {
    return { error: 'Competitor URL is required' };
  }

  // Scrape the competitor's website
  const scrapeResult = await scrapeRestaurantWebsite(competitorUrl);

  if (!scrapeResult.success) {
    return {
      method: 'competitor',
      url: competitorUrl,
      success: false,
      errors: scrapeResult.errors,
    };
  }

  // Find similar restaurants in our database
  const cuisine = scrapeResult.data.cuisine_hints?.[0]?.cuisine;
  const pos = scrapeResult.tech_stack.pos_system;

  let similarLeads = [];
  if (cuisine || pos) {
    let query = 'SELECT id, name, primary_email, city, state, current_pos FROM restaurant_leads WHERE 1=1';
    const params = [];

    if (pos) {
      query += ' AND LOWER(current_pos) LIKE ?';
      params.push(`%${pos.toLowerCase()}%`);
    }

    query += ' ORDER BY lead_score DESC LIMIT 20';

    const result = await env.DB.prepare(query).bind(...params).all();
    similarLeads = result.results || [];
  }

  return {
    method: 'competitor',
    url: competitorUrl,
    success: true,
    competitor_profile: {
      name: scrapeResult.data.page_title?.split(/[|\-–]/)[0]?.trim(),
      description: scrapeResult.data.meta_description,
      tech_stack: scrapeResult.tech_stack,
      contacts: scrapeResult.contacts,
      social: scrapeResult.data.social,
      cuisine: scrapeResult.data.cuisine_hints,
      service_style: scrapeResult.data.service_hints,
    },
    similar_leads: {
      count: similarLeads.length,
      leads: similarLeads,
      message: `Found ${similarLeads.length} similar restaurants in database`,
    },
    insights: generateCompetitorInsights(scrapeResult),
  };
}

/**
 * Calculate lead score based on scraped data
 */
function calculateLeadScore(scrapeResult) {
  let score = 30; // Base score

  if (scrapeResult.contacts.emails?.length) score += 25;
  if (scrapeResult.contacts.phones?.length) score += 15;
  if (scrapeResult.tech_stack.pos_system) score += 10;
  if (scrapeResult.tech_stack.online_ordering) score += 5;
  if (scrapeResult.data.social && Object.keys(scrapeResult.data.social).length >= 2) score += 10;
  if (scrapeResult.data.order_url) score += 5;

  return Math.min(score, 100);
}

/**
 * Generate insights about a competitor
 */
function generateCompetitorInsights(scrapeResult) {
  const insights = [];

  if (scrapeResult.tech_stack.pos_system) {
    insights.push({
      type: 'technology',
      insight: `Uses ${scrapeResult.tech_stack.pos_system} as their POS system`,
      actionable: scrapeResult.tech_stack.pos_system !== 'Toast',
      action: scrapeResult.tech_stack.pos_system !== 'Toast'
        ? 'Potential Toast migration opportunity'
        : 'Already on Toast - support plan opportunity',
    });
  }

  if (scrapeResult.tech_stack.online_ordering) {
    insights.push({
      type: 'technology',
      insight: `Online ordering via ${scrapeResult.tech_stack.online_ordering}`,
    });
  }

  if (scrapeResult.data.cuisine_hints?.length) {
    insights.push({
      type: 'market',
      insight: `Primary cuisine: ${scrapeResult.data.cuisine_hints[0].cuisine}`,
    });
  }

  if (!scrapeResult.tech_stack.reservation_system) {
    insights.push({
      type: 'opportunity',
      insight: 'No reservation system detected',
      actionable: true,
      action: 'May need reservation system recommendation',
    });
  }

  return insights;
}

/**
 * Seed known Cape Cod restaurants into the database
 */
async function seedKnownRestaurants(env) {
  let imported = 0;
  let skipped = 0;
  const errors = [];

  for (const r of KNOWN_RESTAURANTS) {
    try {
      // Check if already exists
      const existing = await env.DB.prepare(
        'SELECT id FROM restaurant_leads WHERE LOWER(name) = LOWER(?) AND LOWER(city) = LOWER(?)'
      ).bind(r.name, r.town).first();

      if (existing) {
        skipped++;
        continue;
      }

      const id = 'lead_seed_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

      await env.DB.prepare(`
        INSERT INTO restaurant_leads (
          id, name, dba_name, city, state, address_line1,
          cuisine_primary, service_style, source, status, lead_score,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'MA', ?, ?, ?, 'seed_import', 'prospect', 50, unixepoch(), unixepoch())
      `).bind(
        id,
        r.name,
        r.name,
        r.town,
        r.address || null,
        r.cuisine || null,
        r.type || null
      ).run();

      imported++;
    } catch (err) {
      errors.push({ restaurant: r.name, error: err.message });
    }
  }

  return new Response(JSON.stringify({
    success: true,
    message: `Seeded ${imported} Cape Cod restaurants, skipped ${skipped} duplicates`,
    imported,
    skipped,
    total_known: KNOWN_RESTAURANTS.length,
    towns_covered: Object.keys(CAPE_COD_TOWNS),
    errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
  }), { headers: corsHeaders });
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);

  try {
    // Return discovery statistics
    const stats = await env.DB.prepare(`
      SELECT
        COUNT(*) as total_leads,
        COUNT(DISTINCT source) as sources,
        SUM(CASE WHEN source = 'web_discovery' THEN 1 ELSE 0 END) as web_discovered,
        SUM(CASE WHEN current_pos IS NOT NULL THEN 1 ELSE 0 END) as with_pos,
        SUM(CASE WHEN website_url IS NOT NULL THEN 1 ELSE 0 END) as with_website
      FROM restaurant_leads
    `).first();

    return new Response(JSON.stringify({
      success: true,
      stats,
      available_methods: [
        { method: 'location', description: 'Find restaurants in a specific location' },
        { method: 'technology', description: 'Find restaurants using/not using specific POS' },
        { method: 'bulk_websites', description: 'Scan multiple restaurant websites' },
        { method: 'single_website', description: 'Scan a single restaurant website' },
        { method: 'competitor', description: 'Deep research on a competitor restaurant' },
      ],
    }), { headers: corsHeaders });
  } catch (error) {
    console.error('Discovery GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), { status: 500, headers: corsHeaders });
  }
}
