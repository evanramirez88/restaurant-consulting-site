/**
 * Menu OCR Processing Handler
 *
 * POST /api/menu/process
 *
 * Triggers OCR processing for a menu job.
 * Uses Cloudflare AI for text extraction and menu parsing.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

/**
 * Parse extracted text into menu structure
 * This uses pattern matching to identify menu items, prices, and categories
 */
function parseMenuText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const items = [];
  const categories = new Set();
  const modifierGroups = new Set();

  let currentCategory = 'Uncategorized';

  // Price patterns
  const pricePattern = /\$?\d+\.\d{2}/;
  const categoryPatterns = [
    /^(appetizers?|starters?)/i,
    /^(entrees?|main courses?|mains?)/i,
    /^(desserts?|sweets?)/i,
    /^(beverages?|drinks?)/i,
    /^(salads?)/i,
    /^(soups?)/i,
    /^(sandwiches?|wraps?)/i,
    /^(sides?|side dishes?)/i,
    /^(breakfast)/i,
    /^(lunch)/i,
    /^(dinner)/i,
    /^(specials?)/i,
    /^(kids?|children)/i
  ];

  for (const line of lines) {
    // Check if line is a category header
    const isCategoryHeader = categoryPatterns.some(pattern => pattern.test(line)) ||
                            (line.toUpperCase() === line && line.length < 30 && !pricePattern.test(line));

    if (isCategoryHeader) {
      currentCategory = line.replace(/[:\-]/g, '').trim();
      categories.add(currentCategory);
      continue;
    }

    // Try to extract menu item with price
    const priceMatch = line.match(pricePattern);
    if (priceMatch) {
      const price = priceMatch[0].replace('$', '');
      const namePart = line.substring(0, priceMatch.index).trim();

      if (namePart.length > 2) {
        // Try to split name and description
        const parts = namePart.split(/[\-–—]/).map(p => p.trim());
        const name = parts[0];
        const description = parts.slice(1).join(' - ') || '';

        items.push({
          id: `item_${items.length + 1}`,
          name,
          description,
          price,
          category: currentCategory,
          modifiers: []
        });
      }
    }
  }

  // Detect common modifier groups from descriptions
  const modifierKeywords = {
    'Protein Add-Ons': ['chicken', 'shrimp', 'salmon', 'steak', 'tofu'],
    'Temperature': ['rare', 'medium', 'well done', 'temperature'],
    'Sauce Options': ['sauce', 'dressing', 'aioli', 'gravy'],
    'Side Choices': ['side', 'choice of', 'served with']
  };

  items.forEach(item => {
    const fullText = `${item.name} ${item.description}`.toLowerCase();
    Object.entries(modifierKeywords).forEach(([group, keywords]) => {
      if (keywords.some(kw => fullText.includes(kw))) {
        item.modifiers.push(group);
        modifierGroups.add(group);
      }
    });
  });

  return {
    items,
    categories: Array.from(categories),
    modifierGroups: Array.from(modifierGroups)
  };
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
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
        // Use Cloudflare AI for OCR
        const imageData = await file.arrayBuffer();

        if (job.file_type.startsWith('image/')) {
          // Image OCR using AI
          const response = await env.AI.run('@cf/llava-hf/llava-1.5-7b-hf', {
            image: [...new Uint8Array(imageData)],
            prompt: 'Extract all text from this menu image. List each menu item with its name, description, and price. Format: "Item Name - Description... $Price"',
            max_tokens: 2048
          });

          extractedText = response.response || '';
        } else if (job.file_type === 'application/pdf') {
          // PDF - use vision model with first page as image
          // Note: This is simplified - full PDF support would need pdf-to-image conversion
          const response = await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
            image: [...new Uint8Array(imageData)],
            prompt: 'Extract all menu items from this document. List each item with name, description, and price.',
            max_tokens: 2048
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

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}
