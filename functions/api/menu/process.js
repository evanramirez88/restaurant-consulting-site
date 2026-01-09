/**
 * Menu OCR Processing Handler
 *
 * POST /api/menu/process
 *
 * Triggers OCR processing for a menu job.
 * Uses Cloudflare AI for text extraction and menu parsing.
 *
 * AUTHENTICATION: Requires admin or client JWT authentication
 */

import { verifyAuth, verifyClientAuth, unauthorizedResponse, handleOptions, getCorsOrigin } from '../../_shared/auth.js';

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

/**
 * Parse extracted text into menu structure
 * Enhanced parsing with multiple price formats and category detection
 */
/**
 * Get AI config from database
 * Returns config with model, max_tokens, and prompt
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

  // Fallback defaults
  if (service === 'menu_ocr') {
    return {
      model: '@cf/llava-hf/llava-1.5-7b-hf',
      max_tokens: 2048,
      prompt: 'Extract all text from this menu image. List each menu item with its name, description, and price. Format: "Item Name - Description... $Price"'
    };
  }

  return {
    model: '@cf/meta/llama-3.2-11b-vision-instruct',
    max_tokens: 2048,
    prompt: 'Extract all text from this document.'
  };
}

function parseMenuText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const items = [];
  const categories = new Set();
  const modifierGroups = new Set();

  let currentCategory = 'Uncategorized';
  let pendingDescription = null;

  // Multiple price patterns for various formats
  const pricePatterns = [
    /\$\d+\.\d{2}/,           // $14.99
    /\$\d+(?:\s|$)/,          // $14 (no cents)
    /\d+\.\d{2}(?:\s|$)/,     // 14.99 (no dollar sign)
    /(?:^|\s)\d{1,3}(?:\s|$)/ // Just a number like "14" at end
  ];

  // Expanded category patterns for restaurant menus
  const categoryPatterns = [
    /^(appetizers?|starters?|small plates?)/i,
    /^(entrees?|main courses?|mains?|large plates?)/i,
    /^(desserts?|sweets?|dolci)/i,
    /^(beverages?|drinks?|cocktails?|wines?|beers?)/i,
    /^(salads?|greens?)/i,
    /^(soups?|broths?)/i,
    /^(sandwiches?|wraps?|subs?|hoagies?)/i,
    /^(sides?|side dishes?|extras?)/i,
    /^(breakfast|brunch|morning)/i,
    /^(lunch)/i,
    /^(dinner)/i,
    /^(specials?|features?|today)/i,
    /^(kids?|children|lil)/i,
    /^(pizza|pies?)/i,
    /^(pasta|noodles?)/i,
    /^(seafood|fish|shellfish|from the sea)/i,
    /^(burgers?|sliders?)/i,
    /^(tacos?|burritos?|mexican)/i,
    /^(sushi|rolls?|japanese)/i,
    /^(shareables?|for the table)/i,
    /^(raw bar|oysters?)/i,
    /^(wings?|fingers?|tenders?)/i,
    /^(flatbreads?)/i,
    /^(bowls?|grain bowls?)/i,
    /^(vegetarian|vegan|plant.?based)/i,
    /^(gluten.?free)/i
  ];

  // Function to extract price from a line
  const extractPrice = (line) => {
    for (const pattern of pricePatterns) {
      const match = line.match(pattern);
      if (match) {
        let price = match[0].replace('$', '').trim();
        // Ensure price has decimal
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

    // Check if line is a category header
    const matchedCategory = categoryPatterns.find(pattern => pattern.test(line));
    const isAllCaps = line.toUpperCase() === line && line.length > 3 && line.length < 40;
    const hasNoPrice = !extractPrice(line);

    if ((matchedCategory || isAllCaps) && hasNoPrice) {
      currentCategory = line.replace(/[:\-–—]/g, '').trim();
      // Capitalize first letter of each word
      currentCategory = currentCategory.split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
      categories.add(currentCategory);
      continue;
    }

    // Try to extract menu item with price
    const priceInfo = extractPrice(line);
    if (priceInfo) {
      const namePart = line.substring(0, priceInfo.index).trim();
      const afterPrice = line.substring(priceInfo.index + priceInfo.price.length + 1).trim();

      if (namePart.length > 2) {
        // Try to split name and description using various separators
        const separatorMatch = namePart.match(/^(.+?)(?:[\-–—:|]|\s{2,})(.+)$/);
        let name, description;

        if (separatorMatch) {
          name = separatorMatch[1].trim();
          description = separatorMatch[2].trim();
        } else {
          name = namePart;
          description = afterPrice || '';
        }

        // Check if next line might be a description (no price, shorter text)
        if (!description && nextLine && !extractPrice(nextLine) && nextLine.length < 100) {
          const isLikelyDescription = !categoryPatterns.some(p => p.test(nextLine)) &&
                                      nextLine.toUpperCase() !== nextLine;
          if (isLikelyDescription) {
            description = nextLine;
            i++; // Skip the next line since we used it
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

  // Enhanced modifier detection
  const modifierKeywords = {
    'Protein Add-Ons': ['add chicken', 'add shrimp', 'add salmon', 'add steak', 'add tofu', 'add protein', 'grilled chicken', 'blackened'],
    'Temperature': ['rare', 'medium rare', 'medium', 'medium well', 'well done', 'temperature', 'cooked to order'],
    'Sauce Options': ['sauce', 'dressing', 'aioli', 'gravy', 'glaze', 'reduction', 'drizzle'],
    'Side Choices': ['side of', 'choice of', 'served with', 'comes with', 'includes', 'pick your'],
    'Spice Level': ['mild', 'medium heat', 'hot', 'extra hot', 'spicy', 'heat level'],
    'Size Options': ['small', 'medium', 'large', 'half', 'full', 'regular', 'jumbo', 'petite'],
    'Dietary Options': ['gluten free', 'gf', 'vegan', 'vegetarian', 'dairy free', 'keto']
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

  // If no categories were detected, try to auto-categorize based on item names
  if (categories.size === 0 || (categories.size === 1 && categories.has('Uncategorized'))) {
    const autoCategoryKeywords = {
      'Appetizers': ['wings', 'nachos', 'dip', 'fries', 'rings', 'bites', 'sticks', 'poppers'],
      'Salads': ['salad', 'greens', 'slaw'],
      'Sandwiches': ['sandwich', 'burger', 'wrap', 'sub', 'hoagie', 'club', 'melt'],
      'Entrees': ['steak', 'salmon', 'chicken breast', 'pork chop', 'filet', 'ribeye'],
      'Seafood': ['shrimp', 'lobster', 'crab', 'oyster', 'clam', 'mussel', 'scallop'],
      'Pizza': ['pizza', 'pie', 'flatbread'],
      'Pasta': ['pasta', 'spaghetti', 'fettuccine', 'penne', 'linguine', 'ravioli'],
      'Desserts': ['cake', 'pie', 'ice cream', 'cheesecake', 'brownie', 'cookie'],
      'Beverages': ['coffee', 'tea', 'soda', 'juice', 'lemonade', 'smoothie']
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

  try {
    // Verify authentication - require either admin or client session
    const adminAuth = await verifyAuth(request, env);
    let authenticatedUser = null;

    if (adminAuth.authenticated) {
      authenticatedUser = { type: 'admin', payload: adminAuth.payload };
    } else {
      // Try client authentication
      const clientAuth = await verifyClientAuth(request, env);
      if (clientAuth.authenticated) {
        authenticatedUser = { type: 'client', clientId: clientAuth.clientId, payload: clientAuth.payload };
      }
    }

    if (!authenticatedUser) {
      return unauthorizedResponse('Authentication required to process menu files');
    }

    const body = await request.json();
    const { jobId } = body;

    if (!jobId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing jobId'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Check required bindings
    if (!env.DB || !env.R2_BUCKET) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Required services not configured'
      }), {
        status: 503,
        headers: corsHeaders
      });
    }

    // Get job from database
    const job = await env.DB.prepare(`
      SELECT id, file_key, file_type, status
      FROM menu_jobs
      WHERE id = ?
    `).bind(jobId).first();

    if (!job) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Job not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    if (job.status !== 'uploaded') {
      return new Response(JSON.stringify({
        success: false,
        error: `Job cannot be processed (current status: ${job.status})`
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Update status to processing
    await env.DB.prepare(`
      UPDATE menu_jobs
      SET status = 'processing', processing_started_at = unixepoch(), updated_at = unixepoch()
      WHERE id = ?
    `).bind(jobId).run();

    // Get file from R2
    const file = await env.R2_BUCKET.get(job.file_key);
    if (!file) {
      await env.DB.prepare(`
        UPDATE menu_jobs
        SET status = 'failed', error_message = 'File not found in storage', updated_at = unixepoch()
        WHERE id = ?
      `).bind(jobId).run();

      return new Response(JSON.stringify({
        success: false,
        error: 'File not found in storage'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    let extractedText = '';
    let parsedMenu = null;

    try {
      // Check if Cloudflare AI is available
      if (env.AI) {
        // Get AI config from database (uses configurable model/prompt)
        const aiConfig = await getAIConfig(env.DB, 'menu_ocr');
        console.log('Using AI config:', { model: aiConfig.model, max_tokens: aiConfig.max_tokens });

        // Use Cloudflare AI for OCR
        const imageData = await file.arrayBuffer();

        if (job.file_type.startsWith('image/')) {
          // Image OCR using configurable AI model
          const response = await env.AI.run(aiConfig.model, {
            image: [...new Uint8Array(imageData)],
            prompt: aiConfig.prompt,
            max_tokens: aiConfig.max_tokens
          });

          extractedText = response.response || '';
        } else if (job.file_type === 'application/pdf') {
          // PDF - use vision model with first page as image
          // Note: This is simplified - full PDF support would need pdf-to-image conversion
          const response = await env.AI.run(aiConfig.model, {
            image: [...new Uint8Array(imageData)],
            prompt: aiConfig.prompt,
            max_tokens: aiConfig.max_tokens
          });

          extractedText = response.response || '';
        }

        // Parse the extracted text
        parsedMenu = parseMenuText(extractedText);

      } else {
        // Fallback: Return mock data for testing
        console.warn('Cloudflare AI not available, using mock data');
        parsedMenu = {
          categories: ['Appetizers', 'Entrees', 'Desserts', 'Beverages'],
          modifierGroups: ['Protein Add-Ons', 'Sauce Options', 'Side Choices', 'Temperature'],
          items: [
            { id: '1', name: 'Crispy Calamari', description: 'Lightly breaded and fried, served with marinara', price: '14.99', category: 'Appetizers', modifiers: ['Sauce Options'] },
            { id: '2', name: 'Grilled Salmon', description: 'Atlantic salmon with lemon herb butter', price: '28.99', category: 'Entrees', modifiers: ['Side Choices', 'Temperature'] },
            { id: '3', name: 'Caesar Salad', description: 'Romaine, parmesan, croutons, house caesar', price: '12.99', category: 'Appetizers', modifiers: ['Protein Add-Ons'] }
          ]
        };
        extractedText = '[Mock data - AI not configured]';
      }

      // Update job with results
      await env.DB.prepare(`
        UPDATE menu_jobs
        SET status = 'completed',
            ocr_result_json = ?,
            parsed_menu_json = ?,
            processing_completed_at = unixepoch(),
            updated_at = unixepoch()
        WHERE id = ?
      `).bind(
        JSON.stringify({ text: extractedText }),
        JSON.stringify(parsedMenu),
        jobId
      ).run();

      return new Response(JSON.stringify({
        success: true,
        jobId,
        status: 'completed',
        parsedMenu
      }), {
        status: 200,
        headers: corsHeaders
      });

    } catch (processingError) {
      console.error('Processing error:', processingError);

      await env.DB.prepare(`
        UPDATE menu_jobs
        SET status = 'failed', error_message = ?, updated_at = unixepoch()
        WHERE id = ?
      `).bind(processingError.message, jobId).run();

      return new Response(JSON.stringify({
        success: false,
        error: 'Processing failed: ' + processingError.message
      }), {
        status: 500,
        headers: corsHeaders
      });
    }

  } catch (error) {
    console.error('Process error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to process menu'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions(context) {
  return handleOptions(context.request);
}
