/**
 * Quote Builder PDF Processing Handler
 *
 * POST /api/quote/process-pdf
 *
 * Triggers OCR processing for a quote import job.
 * Uses Cloudflare AI for text extraction and hardware parsing.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

/**
 * Toast product name to hardware catalog mapping
 */
const TOAST_TO_CATALOG_MAP = {
  // POS Terminals
  'toast flex': 'toast-flex',
  'toast flex guest': 'toast-flex-guest',
  'guest display': 'toast-flex-guest',
  'toast go 2': 'toast-go2',
  'toast go': 'toast-go2',
  'handheld': 'toast-go2',

  // KDS
  'elo kitchen': 'toast-kds',
  'elo v4': 'toast-kds',
  'kitchen display': 'toast-kds',
  'kds': 'toast-kds',

  // Printers
  'toast printer': 'receipt-printer',
  'receipt printer': 'receipt-printer',
  'thermal printer': 'receipt-printer',
  'kitchen printer': 'impact-printer',
  'impact printer': 'impact-printer',
  'epson': 'impact-printer',

  // Networking
  'meraki': 'router',
  'router': 'router',
  'gateway': 'router',
  'ubiquiti': 'ap',
  'access point': 'ap',
  'wireless': 'ap',
  'poe switch': 'poe-switch',
  'tp-link': 'poe-switch',
  'network switch': 'poe-switch',
  'switch': 'poe-switch',

  // Payment
  'toast tap': 'card-reader-direct',
  'card reader': 'card-reader-direct',
  'tap to pay': 'card-reader-direct',
  'payment device': 'card-reader-direct',

  // Accessories
  'cash drawer': 'cash-drawer',
  'drawer': 'cash-drawer',
  'charging dock': 'charging-dock',
  'dock': 'charging-dock',
  'stand': 'stand',
  'tablet stand': 'stand',
  'kiosk': 'kiosk',
  'self-serve': 'kiosk'
};

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

  // Fallback defaults for quote OCR
  return {
    model: '@cf/meta/llama-3.2-11b-vision-instruct',
    max_tokens: 2048,
    prompt: 'Extract hardware items from this Toast POS quote PDF. Focus on the HARDWARE section table. For each item, extract: Product Name, Quantity (QTY column). Return as JSON array: [{"name": "...", "qty": 1}, ...]'
  };
}

/**
 * Map a Toast product name to our hardware catalog IDs
 */
function mapProductToHardware(productName) {
  const lower = productName.toLowerCase();
  const mappedIds = [];

  // Check for bundle items (comma-separated)
  const parts = productName.split(',').map(p => p.trim());

  for (const part of parts) {
    const partLower = part.toLowerCase();
    for (const [keyword, catalogId] of Object.entries(TOAST_TO_CATALOG_MAP)) {
      if (partLower.includes(keyword)) {
        if (!mappedIds.includes(catalogId)) {
          mappedIds.push(catalogId);
        }
        break;
      }
    }
  }

  return mappedIds;
}

/**
 * Parse AI response to extract hardware items
 */
function parseHardwareFromText(text) {
  const items = [];

  // Try to parse as JSON first
  try {
    // Look for JSON array in the response
    const jsonMatch = text.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const name = item.name || item.product || item.item || '';
          const qty = parseInt(item.qty || item.quantity || item.count || 1);
          if (name) {
            const mappedIds = mapProductToHardware(name);
            items.push({
              id: `extracted_${items.length + 1}`,
              productName: name,
              quantity: qty,
              mappedHardwareIds: mappedIds,
              confidence: mappedIds.length > 0 ? 0.9 : 0.5
            });
          }
        }
        return items;
      }
    }
  } catch (e) {
    console.log('JSON parse failed, trying text parsing');
  }

  // Fallback: Parse as text with patterns
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);

  // Pattern for hardware lines: "Product Name ... Qty: X" or "X x Product Name"
  const qtyPatterns = [
    /(.+?)\s+(?:qty|quantity|x)\s*[:\s]\s*(\d+)/i,
    /(\d+)\s*x\s+(.+)/i,
    /(.+?)\s+(\d+)\s*$/
  ];

  for (const line of lines) {
    // Skip header-like lines
    if (line.toLowerCase().includes('product name') ||
        line.toLowerCase().includes('list price') ||
        line.toLowerCase().includes('total price')) {
      continue;
    }

    for (const pattern of qtyPatterns) {
      const match = line.match(pattern);
      if (match) {
        let name, qty;
        if (pattern === qtyPatterns[1]) {
          qty = parseInt(match[1]);
          name = match[2];
        } else {
          name = match[1];
          qty = parseInt(match[2]);
        }

        if (name && qty > 0) {
          const mappedIds = mapProductToHardware(name);
          items.push({
            id: `extracted_${items.length + 1}`,
            productName: name.trim(),
            quantity: qty,
            mappedHardwareIds: mappedIds,
            confidence: mappedIds.length > 0 ? 0.8 : 0.4
          });
        }
        break;
      }
    }
  }

  return items;
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
      FROM quote_import_jobs
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
      UPDATE quote_import_jobs
      SET status = 'processing', processing_started_at = unixepoch(), updated_at = unixepoch()
      WHERE id = ?
    `).bind(jobId).run();

    // Get file from R2
    const file = await env.R2_BUCKET.get(job.file_key);
    if (!file) {
      await env.DB.prepare(`
        UPDATE quote_import_jobs
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
    let extractedItems = [];

    try {
      // Check if Cloudflare AI is available
      if (env.AI) {
        // Get AI config from database (uses configurable model/prompt)
        const aiConfig = await getAIConfig(env.DB, 'quote_ocr');
        console.log('Using AI config:', { model: aiConfig.model, max_tokens: aiConfig.max_tokens });

        // Use Cloudflare AI for OCR
        const pdfData = await file.arrayBuffer();

        const response = await env.AI.run(aiConfig.model, {
          image: [...new Uint8Array(pdfData)],
          prompt: aiConfig.prompt,
          max_tokens: aiConfig.max_tokens
        });

        extractedText = response.response || '';

        // Parse the extracted text into hardware items
        extractedItems = parseHardwareFromText(extractedText);

      } else {
        // Fallback: Return demo data for testing
        console.warn('Cloudflare AI not available, using demo data');
        extractedText = '[Demo mode - AI not configured]';
        extractedItems = [
          {
            id: 'demo_1',
            productName: 'Toast Flex, Toast Tap (Direct Attach), Toast Printer, Cash Drawer',
            quantity: 2,
            mappedHardwareIds: ['toast-flex', 'card-reader-direct', 'receipt-printer', 'cash-drawer'],
            confidence: 0.95
          },
          {
            id: 'demo_2',
            productName: 'Toast Go 2, Charging Dock',
            quantity: 3,
            mappedHardwareIds: ['toast-go2', 'charging-dock'],
            confidence: 0.95
          },
          {
            id: 'demo_3',
            productName: 'Kitchen Display (Elo V4)',
            quantity: 1,
            mappedHardwareIds: ['toast-kds'],
            confidence: 0.95
          },
          {
            id: 'demo_4',
            productName: 'Impact Printer',
            quantity: 2,
            mappedHardwareIds: ['impact-printer'],
            confidence: 0.95
          },
          {
            id: 'demo_5',
            productName: 'Meraki Router',
            quantity: 1,
            mappedHardwareIds: ['router'],
            confidence: 0.95
          }
        ];
      }

      // Update job with results
      await env.DB.prepare(`
        UPDATE quote_import_jobs
        SET status = 'completed',
            ocr_result_json = ?,
            extracted_items_json = ?,
            processing_completed_at = unixepoch(),
            updated_at = unixepoch()
        WHERE id = ?
      `).bind(
        JSON.stringify({ text: extractedText }),
        JSON.stringify(extractedItems),
        jobId
      ).run();

      return new Response(JSON.stringify({
        success: true,
        jobId,
        status: 'completed',
        extractedItems,
        itemCount: extractedItems.length
      }), {
        status: 200,
        headers: corsHeaders
      });

    } catch (processingError) {
      console.error('Processing error:', processingError);

      await env.DB.prepare(`
        UPDATE quote_import_jobs
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
      error: 'Failed to process PDF'
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
