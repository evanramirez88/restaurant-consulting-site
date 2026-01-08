/**
 * Restaurant Classification API
 *
 * POST /api/admin/automation/classify
 * Classifies a restaurant based on available data sources (website, menu, user input)
 * and returns recommended Toast configuration.
 */

const CLASSIFICATION_PROMPT = `You are a restaurant industry expert analyzing a business to determine optimal POS configuration.

Analyze the provided data and classify this restaurant:

DATA PROVIDED:
{{DATA}}

Based on this analysis, provide a classification in JSON format:

{
  "service_style": "counter|full_service|hybrid|quick_service",
  "establishment_type": "cafe|coffee_shop|bar|cocktail_bar|wine_bar|brewery|nightclub|fine_dining|casual_dining|fast_casual|quick_service|food_truck|pizzeria|deli|bakery|ice_cream|juice_bar|other",
  "beverage_focus": "coffee|cocktail|wine|beer|mixed|non_alcoholic|none",
  "cuisine_types": ["array of cuisine types"],
  "hours_pattern": "breakfast_lunch|lunch_dinner|dinner_only|late_night|all_day|variable",
  "volume_level": "low|medium|high|very_high",
  "price_point": "budget|moderate|upscale|fine_dining",
  "has_bar": true/false,
  "has_patio": true/false,
  "has_delivery": true/false,
  "has_takeout": true/false,
  "has_reservations": true/false,
  "confidence": 0-100,
  "reasoning": "Brief explanation of classification"
}

Be specific and accurate. If uncertain about a field, use your best judgment based on the establishment type.`;

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // Verify admin authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { client_id, restaurant_id, data_sources } = body;

    if (!client_id) {
      return new Response(JSON.stringify({ success: false, error: 'client_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Gather data from sources
    const classificationData = await gatherClassificationData(env, client_id, restaurant_id, data_sources || {});

    // Run AI classification
    const classification = await runAIClassification(env, classificationData);

    // Match to configuration template
    const template = await matchConfigTemplate(env, classification);

    // Get applicable modifier rules
    const modifierRules = template ? await getModifierRules(env, template.id) : [];

    // Save classification to database
    const classificationId = crypto.randomUUID();
    await saveClassification(env, {
      id: classificationId,
      client_id,
      restaurant_id,
      ...classification,
      config_template_id: template?.id || null,
      data_sources_json: JSON.stringify(Object.keys(data_sources || {})),
      ai_analysis_json: JSON.stringify(classification),
      ai_model_used: 'claude-sonnet-4-20250514'
    });

    return new Response(JSON.stringify({
      success: true,
      data: {
        classification_id: classificationId,
        classification,
        template,
        modifier_rules: modifierRules,
        confidence: classification.confidence
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Classification error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Classification failed'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Gather classification data from various sources
 */
async function gatherClassificationData(env, clientId, restaurantId, dataSources) {
  const data = {
    sources_used: [],
    client_info: null,
    website_analysis: null,
    menu_analysis: null,
    user_input: null
  };

  // Get client info from database
  try {
    const client = await env.DB.prepare(`
      SELECT name, company_name, email, phone, notes
      FROM clients WHERE id = ?
    `).bind(clientId).first();

    if (client) {
      data.client_info = client;
      data.sources_used.push('client_database');
    }
  } catch (e) {
    console.error('Error fetching client:', e);
  }

  // If website URL provided, analyze it
  if (dataSources.website_url) {
    try {
      data.website_analysis = await analyzeWebsite(dataSources.website_url);
      data.sources_used.push('website');
    } catch (e) {
      console.error('Website analysis failed:', e);
    }
  }

  // If menu data provided (from Menu Builder)
  if (dataSources.menu_data) {
    data.menu_analysis = analyzeMenu(dataSources.menu_data);
    data.sources_used.push('menu');
  }

  // User-provided inputs
  if (dataSources.user_input) {
    data.user_input = dataSources.user_input;
    data.sources_used.push('user_input');
  }

  // Google Business info (if available)
  if (dataSources.google_place_id) {
    // Future: integrate Google Places API
    data.sources_used.push('google_business');
  }

  return data;
}

/**
 * Analyze website for classification signals
 */
async function analyzeWebsite(url) {
  // Basic website analysis - fetch and extract key information
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RestaurantClassifier/1.0)' }
    });

    if (!response.ok) {
      return { error: 'Could not fetch website', url };
    }

    const html = await response.text();

    // Extract useful signals
    const analysis = {
      url,
      title: extractTitle(html),
      description: extractMetaDescription(html),
      keywords: extractKeywords(html),
      hasOnlineOrdering: html.toLowerCase().includes('order online') ||
                         html.toLowerCase().includes('online ordering'),
      hasReservations: html.toLowerCase().includes('reservation') ||
                       html.toLowerCase().includes('opentable') ||
                       html.toLowerCase().includes('resy'),
      hasDelivery: html.toLowerCase().includes('delivery') ||
                   html.toLowerCase().includes('doordash') ||
                   html.toLowerCase().includes('ubereats'),
      mentionsCocktails: html.toLowerCase().includes('cocktail') ||
                         html.toLowerCase().includes('mixology'),
      mentionsCoffee: html.toLowerCase().includes('coffee') ||
                      html.toLowerCase().includes('espresso') ||
                      html.toLowerCase().includes('latte'),
      mentionsWine: html.toLowerCase().includes('wine list') ||
                    html.toLowerCase().includes('sommelier'),
      mentionsBrunch: html.toLowerCase().includes('brunch'),
      mentionsHappyHour: html.toLowerCase().includes('happy hour')
    };

    return analysis;
  } catch (e) {
    return { error: e.message, url };
  }
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : null;
}

function extractMetaDescription(html) {
  const match = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  return match ? match[1].trim() : null;
}

function extractKeywords(html) {
  const match = html.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["']/i);
  return match ? match[1].split(',').map(k => k.trim()) : [];
}

/**
 * Analyze menu data for classification signals
 */
function analyzeMenu(menuData) {
  const analysis = {
    total_items: 0,
    categories: [],
    price_range: { min: null, max: null, avg: null },
    has_cocktails: false,
    has_wine: false,
    has_beer: false,
    has_coffee: false,
    has_breakfast: false,
    has_lunch: false,
    has_dinner: false,
    cuisine_signals: []
  };

  if (!menuData || !menuData.items) return analysis;

  const items = menuData.items;
  analysis.total_items = items.length;

  // Analyze categories
  if (menuData.categories) {
    analysis.categories = menuData.categories.map(c => c.name || c);
  }

  // Analyze prices
  const prices = items.filter(i => i.price).map(i => parseFloat(i.price));
  if (prices.length > 0) {
    analysis.price_range.min = Math.min(...prices);
    analysis.price_range.max = Math.max(...prices);
    analysis.price_range.avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  }

  // Check for beverage types
  const allText = items.map(i => `${i.name} ${i.description || ''}`).join(' ').toLowerCase();
  analysis.has_cocktails = /cocktail|martini|margarita|old fashioned|manhattan|negroni/.test(allText);
  analysis.has_wine = /wine|cabernet|chardonnay|pinot|merlot|rosé/.test(allText);
  analysis.has_beer = /beer|ipa|lager|ale|stout|pilsner|draft/.test(allText);
  analysis.has_coffee = /coffee|espresso|latte|cappuccino|americano|cold brew/.test(allText);

  // Check for meal types
  analysis.has_breakfast = /breakfast|eggs|pancake|waffle|omelette|bacon|toast/.test(allText);
  analysis.has_lunch = /lunch|sandwich|wrap|salad|soup|burger/.test(allText);
  analysis.has_dinner = /dinner|steak|salmon|chicken|pasta|entree/.test(allText);

  return analysis;
}

/**
 * Run AI classification using Claude
 */
async function runAIClassification(env, data) {
  // For now, use heuristics-based classification
  // In production, this would call Claude API

  const classification = {
    service_style: 'full_service',
    establishment_type: 'casual_dining',
    beverage_focus: 'mixed',
    cuisine_types: ['american'],
    hours_pattern: 'all_day',
    volume_level: 'medium',
    price_point: 'moderate',
    has_bar: false,
    has_patio: false,
    has_delivery: false,
    has_takeout: true,
    has_reservations: false,
    confidence: 60,
    reasoning: 'Default classification - insufficient data for AI analysis'
  };

  // Apply heuristics based on gathered data
  if (data.website_analysis) {
    const web = data.website_analysis;

    if (web.mentionsCocktails) {
      classification.beverage_focus = 'cocktail';
      classification.establishment_type = 'bar';
      classification.has_bar = true;
      classification.confidence += 10;
    }

    if (web.mentionsCoffee && !web.mentionsCocktails) {
      classification.beverage_focus = 'coffee';
      classification.establishment_type = 'cafe';
      classification.service_style = 'counter';
      classification.confidence += 10;
    }

    if (web.hasReservations) {
      classification.has_reservations = true;
      classification.service_style = 'full_service';
      classification.confidence += 5;
    }

    if (web.hasDelivery) {
      classification.has_delivery = true;
    }
  }

  if (data.menu_analysis) {
    const menu = data.menu_analysis;

    if (menu.has_cocktails) {
      classification.beverage_focus = 'cocktail';
      classification.has_bar = true;
    }

    if (menu.has_coffee && menu.has_breakfast && !menu.has_cocktails) {
      classification.establishment_type = 'cafe';
      classification.service_style = 'counter';
      classification.beverage_focus = 'coffee';
    }

    // Price point analysis
    if (menu.price_range.avg) {
      if (menu.price_range.avg < 10) {
        classification.price_point = 'budget';
        classification.establishment_type = 'fast_casual';
      } else if (menu.price_range.avg < 20) {
        classification.price_point = 'moderate';
      } else if (menu.price_range.avg < 40) {
        classification.price_point = 'upscale';
      } else {
        classification.price_point = 'fine_dining';
        classification.establishment_type = 'fine_dining';
      }
      classification.confidence += 10;
    }
  }

  // User input overrides
  if (data.user_input) {
    const input = data.user_input;
    if (input.service_style) classification.service_style = input.service_style;
    if (input.establishment_type) classification.establishment_type = input.establishment_type;
    if (input.beverage_focus) classification.beverage_focus = input.beverage_focus;
    classification.confidence = Math.min(100, classification.confidence + 20);
  }

  return classification;
}

/**
 * Match classification to a configuration template
 */
async function matchConfigTemplate(env, classification) {
  const templates = await env.DB.prepare(`
    SELECT * FROM toast_config_templates
    WHERE is_active = 1
    ORDER BY priority DESC
  `).all();

  if (!templates.results || templates.results.length === 0) {
    return null;
  }

  for (const template of templates.results) {
    const criteria = JSON.parse(template.applies_to_json);

    // Check service style match
    if (criteria.service_styles &&
        !criteria.service_styles.includes(classification.service_style)) {
      continue;
    }

    // Check establishment type match
    if (criteria.establishment_types &&
        !criteria.establishment_types.includes(classification.establishment_type)) {
      continue;
    }

    // Check beverage focus match (if specified)
    if (criteria.beverage_focus &&
        !criteria.beverage_focus.includes(classification.beverage_focus)) {
      continue;
    }

    // Match found
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      menu_structure: JSON.parse(template.menu_structure_json),
      kds_config: JSON.parse(template.kds_config_json),
      order_flow: JSON.parse(template.order_flow_json)
    };
  }

  // No match - return first template as fallback
  const fallback = templates.results[0];
  return {
    id: fallback.id,
    name: fallback.name,
    description: fallback.description,
    menu_structure: JSON.parse(fallback.menu_structure_json),
    kds_config: JSON.parse(fallback.kds_config_json),
    order_flow: JSON.parse(fallback.order_flow_json)
  };
}

/**
 * Get modifier rules for a template
 */
async function getModifierRules(env, templateId) {
  const rules = await env.DB.prepare(`
    SELECT * FROM modifier_rules
    WHERE (template_id = ? OR template_id IS NULL)
      AND is_active = 1
    ORDER BY priority DESC
  `).bind(templateId).all();

  if (!rules.results) return [];

  return rules.results.map(rule => ({
    id: rule.id,
    rule_name: rule.rule_name,
    rule_category: rule.rule_category,
    trigger_type: rule.trigger_type,
    trigger_pattern: rule.trigger_pattern,
    modifier_group_name: rule.modifier_group_name,
    modifier_group_type: rule.modifier_group_type,
    modifier_options: JSON.parse(rule.modifier_options_json),
    is_required: rule.is_required === 1,
    priority: rule.priority
  }));
}

/**
 * Save classification to database
 */
async function saveClassification(env, data) {
  await env.DB.prepare(`
    INSERT INTO restaurant_classifications (
      id, client_id, restaurant_id,
      service_style, establishment_type, beverage_focus,
      cuisine_types_json, hours_pattern, volume_level, price_point,
      has_bar, has_patio, has_delivery, has_takeout, has_reservations,
      classification_confidence, data_sources_json, ai_analysis_json, ai_model_used,
      config_template_id,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
  `).bind(
    data.id,
    data.client_id,
    data.restaurant_id || null,
    data.service_style,
    data.establishment_type,
    data.beverage_focus,
    JSON.stringify(data.cuisine_types || []),
    data.hours_pattern,
    data.volume_level,
    data.price_point,
    data.has_bar ? 1 : 0,
    data.has_patio ? 1 : 0,
    data.has_delivery ? 1 : 0,
    data.has_takeout ? 1 : 0,
    data.has_reservations ? 1 : 0,
    data.confidence,
    data.data_sources_json,
    data.ai_analysis_json,
    data.ai_model_used,
    data.config_template_id
  ).run();

  return data.id;
}
