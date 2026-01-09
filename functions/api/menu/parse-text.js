/**
 * Menu Text Parsing Handler
 *
 * POST /api/menu/parse-text
 *
 * Accepts extracted text from PDFs (client-side extraction via unpdf)
 * and parses it into structured menu data using AI.
 *
 * This enables multi-page PDF support by extracting text client-side.
 */

import { handleOptions, getCorsOrigin } from '../../_shared/auth.js';
import { rateLimit, RATE_LIMITS } from '../../_shared/rate-limit.js';

// Maximum text input size (100KB should be plenty for menu text)
const MAX_TEXT_LENGTH = 100000;

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

/**
 * Get AI config from database
 */
async function getAIConfig(db, service) {
  try {
    const config = await db.prepare(
      'SELECT config_json FROM api_configs WHERE service = ? AND is_active = 1'
    ).bind(service).first();

    if (config?.config_json) {
      return JSON.parse(config.config_json);
    }
  } catch (e) {
    console.error('Error loading AI config:', e);
  }

  // Fallback defaults for text parsing
  return {
    model: '@cf/meta/llama-3.1-8b-instruct',
    max_tokens: 4096,
    temperature: 0.1
  };
}

/**
 * Parse menu text using AI
 */
async function parseMenuWithAI(text, env) {
  const aiConfig = await getAIConfig(env.DB, 'menu_text_parser');

  const prompt = `You are a menu parser. Extract menu items from this text and return ONLY valid JSON.

TEXT:
${text.substring(0, 8000)}

Return JSON in this exact format:
{
  "items": [
    {"name": "Item Name", "description": "Description", "price": "12.99", "category": "Category"}
  ],
  "categories": ["Category1", "Category2"],
  "modifierGroups": ["Modifier1", "Modifier2"]
}

Rules:
- Extract all menu items with name, description, price
- Detect categories (Appetizers, Entrees, Desserts, Beverages, etc.)
- Identify modifier groups (Add-Ons, Sauce Options, Temperature, Sides)
- Price should be just the number (no $ symbol)
- If description is missing, use empty string
- Return ONLY the JSON, no other text`;

  try {
    const response = await env.AI.run(aiConfig.model, {
      prompt,
      max_tokens: aiConfig.max_tokens,
      temperature: aiConfig.temperature || 0.1
    });

    const responseText = response.response || '';

    // Try to extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return null;
  } catch (e) {
    console.error('AI parsing error:', e);
    return null;
  }
}

/**
 * Fallback pattern-based parsing (when AI unavailable)
 */
function parseMenuText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const items = [];
  const categories = new Set();
  const modifierGroups = new Set();

  let currentCategory = 'Uncategorized';

  // Price patterns
  const pricePatterns = [
    /\$\d+\.\d{2}/,
    /\$\d+(?:\s|$)/,
    /\d+\.\d{2}(?:\s|$)/,
    /(?:^|\s)\d{1,3}(?:\s|$)/
  ];

  // Category patterns
  const categoryPatterns = [
    /^(appetizers?|starters?|small plates?)/i,
    /^(entrees?|main courses?|mains?|large plates?)/i,
    /^(desserts?|sweets?)/i,
    /^(beverages?|drinks?|cocktails?|wines?|beers?)/i,
    /^(salads?|greens?)/i,
    /^(soups?)/i,
    /^(sandwiches?|wraps?|subs?)/i,
    /^(sides?|side dishes?|extras?)/i,
    /^(breakfast|brunch)/i,
    /^(lunch|dinner)/i,
    /^(specials?|features?)/i,
    /^(kids?|children)/i,
    /^(pizza|pasta|seafood|burgers?)/i
  ];

  const extractPrice = (line) => {
    for (const pattern of pricePatterns) {
      const match = line.match(pattern);
      if (match) {
        let price = match[0].replace('$', '').trim();
        if (!price.includes('.')) {
          price = price + '.00';
        }
        return { price, index: match.index };
      }
    }
    return null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] || '';

    // Check for category header
    const matchedCategory = categoryPatterns.find(pattern => pattern.test(line));
    const isAllCaps = line.toUpperCase() === line && line.length > 3 && line.length < 40;
    const hasNoPrice = !extractPrice(line);

    if ((matchedCategory || isAllCaps) && hasNoPrice) {
      currentCategory = line.replace(/[:\-–—]/g, '').trim();
      currentCategory = currentCategory.split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
      categories.add(currentCategory);
      continue;
    }

    // Extract menu item
    const priceInfo = extractPrice(line);
    if (priceInfo) {
      const namePart = line.substring(0, priceInfo.index).trim();
      const afterPrice = line.substring(priceInfo.index + priceInfo.price.length + 1).trim();

      if (namePart.length > 2) {
        const separatorMatch = namePart.match(/^(.+?)(?:[\-–—:|]|\s{2,})(.+)$/);
        let name, description;

        if (separatorMatch) {
          name = separatorMatch[1].trim();
          description = separatorMatch[2].trim();
        } else {
          name = namePart;
          description = afterPrice || '';
        }

        // Check next line for description
        if (!description && nextLine && !extractPrice(nextLine) && nextLine.length < 100) {
          const isLikelyDescription = !categoryPatterns.some(p => p.test(nextLine)) &&
                                      nextLine.toUpperCase() !== nextLine;
          if (isLikelyDescription) {
            description = nextLine;
            i++;
          }
        }

        items.push({
          id: `item_${items.length + 1}`,
          name: name.replace(/\.+$/, '').trim(),
          description: description.replace(/\.+$/, '').trim(),
          price: priceInfo.price,
          category: currentCategory,
          modifiers: []
        });
      }
    }
  }

  // Detect modifiers
  const modifierKeywords = {
    'Protein Add-Ons': ['add chicken', 'add shrimp', 'add salmon', 'add steak', 'add tofu', 'add protein'],
    'Temperature': ['rare', 'medium rare', 'medium', 'medium well', 'well done'],
    'Sauce Options': ['sauce', 'dressing', 'aioli', 'gravy'],
    'Side Choices': ['side of', 'choice of', 'served with', 'comes with'],
    'Spice Level': ['mild', 'medium heat', 'hot', 'extra hot', 'spicy'],
    'Size Options': ['small', 'medium', 'large', 'half', 'full'],
    'Dietary Options': ['gluten free', 'gf', 'vegan', 'vegetarian']
  };

  items.forEach(item => {
    const fullText = `${item.name} ${item.description}`.toLowerCase();
    Object.entries(modifierKeywords).forEach(([group, keywords]) => {
      if (keywords.some(kw => fullText.includes(kw.toLowerCase()))) {
        if (!item.modifiers.includes(group)) {
          item.modifiers.push(group);
          modifierGroups.add(group);
        }
      }
    });
  });

  // Auto-categorize uncategorized items
  if (categories.size === 0 || (categories.size === 1 && categories.has('Uncategorized'))) {
    const autoCategoryKeywords = {
      'Appetizers': ['wings', 'nachos', 'dip', 'fries', 'rings', 'bites'],
      'Salads': ['salad', 'greens', 'slaw'],
      'Sandwiches': ['sandwich', 'burger', 'wrap', 'sub', 'melt'],
      'Entrees': ['steak', 'salmon', 'chicken breast', 'pork chop'],
      'Seafood': ['shrimp', 'lobster', 'crab', 'oyster', 'scallop'],
      'Pizza': ['pizza', 'pie', 'flatbread'],
      'Pasta': ['pasta', 'spaghetti', 'fettuccine', 'penne'],
      'Desserts': ['cake', 'pie', 'ice cream', 'cheesecake'],
      'Beverages': ['coffee', 'tea', 'soda', 'juice', 'lemonade']
    };

    items.forEach(item => {
      if (item.category === 'Uncategorized') {
        const itemText = `${item.name} ${item.description}`.toLowerCase();
        for (const [category, keywords] of Object.entries(autoCategoryKeywords)) {
          if (keywords.some(kw => itemText.includes(kw))) {
            item.category = category;
            categories.add(category);
            break;
          }
        }
      }
    });
    categories.delete('Uncategorized');
  }

  return {
    items,
    categories: Array.from(categories),
    modifierGroups: Array.from(modifierGroups)
  };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  // Rate limiting - 10 parses per 5 minutes per IP (uses AI which has costs)
  const rateLimitResponse = await rateLimit(
    request,
    env.RATE_LIMIT_KV,
    'menu-parse-text',
    RATE_LIMITS.QUOTE_FORM, // 10 per 5 minutes
    corsHeaders
  );
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const body = await request.json();
    const { text, totalPages, fileName } = body;

    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing or invalid text parameter'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Validate text size to prevent abuse
    if (text.length > MAX_TEXT_LENGTH) {
      return new Response(JSON.stringify({
        success: false,
        error: `Text too large. Maximum ${MAX_TEXT_LENGTH} characters allowed.`
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    console.log(`[Menu Parse] Processing ${totalPages || 1} pages from ${fileName || 'unknown'}`);
    console.log(`[Menu Parse] Text length: ${text.length} characters`);

    let parsedMenu = null;

    // Try AI parsing first
    if (env.AI) {
      try {
        parsedMenu = await parseMenuWithAI(text, env);
        if (parsedMenu && parsedMenu.items && parsedMenu.items.length > 0) {
          console.log(`[Menu Parse] AI extracted ${parsedMenu.items.length} items`);
        } else {
          console.log('[Menu Parse] AI returned no items, falling back to pattern matching');
          parsedMenu = null;
        }
      } catch (aiError) {
        console.error('[Menu Parse] AI error:', aiError);
      }
    }

    // Fallback to pattern-based parsing
    if (!parsedMenu) {
      parsedMenu = parseMenuText(text);
      console.log(`[Menu Parse] Pattern matching extracted ${parsedMenu.items.length} items`);
    }

    // Ensure all items have IDs
    parsedMenu.items = parsedMenu.items.map((item, idx) => ({
      ...item,
      id: item.id || `item_${idx + 1}`
    }));

    return new Response(JSON.stringify({
      success: true,
      parsedMenu,
      metadata: {
        totalPages: totalPages || 1,
        fileName: fileName || 'unknown',
        itemCount: parsedMenu.items.length,
        categoryCount: parsedMenu.categories.length,
        modifierGroupCount: parsedMenu.modifierGroups.length,
        method: env.AI ? 'ai' : 'pattern'
      }
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('[Menu Parse] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to parse menu text'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions(context) {
  return handleOptions(context.request);
}
