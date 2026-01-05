/**
 * Quote Builder Text Parsing Handler
 *
 * POST /api/quote/parse-text
 *
 * Accepts extracted PDF text and uses AI to parse hardware items.
 * This avoids PDF-to-image conversion issues with vision models.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

const TOAST_TO_CATALOG_MAP = {
  'toast flex': 'toast-flex',
  'toast flex guest': 'toast-flex-guest',
  'guest display': 'toast-flex-guest',
  'toast go 2': 'toast-go2',
  'toast go': 'toast-go2',
  'handheld': 'toast-go2',
  'elo kitchen': 'toast-kds',
  'elo v4': 'toast-kds',
  'kitchen display': 'toast-kds',
  'kds': 'toast-kds',
  'toast printer': 'receipt-printer',
  'receipt printer': 'receipt-printer',
  'thermal printer': 'receipt-printer',
  'kitchen printer': 'impact-printer',
  'impact printer': 'impact-printer',
  'epson': 'impact-printer',
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
  'toast tap': 'card-reader-direct',
  'card reader': 'card-reader-direct',
  'tap to pay': 'card-reader-direct',
  'payment device': 'card-reader-direct',
  'cash drawer': 'cash-drawer',
  'drawer': 'cash-drawer',
  'charging dock': 'charging-dock',
  'dock': 'charging-dock',
  'stand': 'stand',
  'tablet stand': 'stand',
  'kiosk': 'kiosk',
  'self-serve': 'kiosk'
};

function mapProductToHardware(productName) {
  const mappedIds = [];
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

function parseHardwareFromText(text) {
  const items = [];
  const lines = text.split('\n').filter(l => l.trim());
  const hardwareKeywords = [
    'toast flex', 'toast go', 'toast tap', 'toast printer',
    'kitchen display', 'kds', 'elo', 'impact printer',
    'cash drawer', 'charging dock', 'meraki', 'router',
    'switch', 'poe', 'tp-link', 'ubiquiti'
  ];

  for (const line of lines) {
    const lineLower = line.toLowerCase();
    const hasHardware = hardwareKeywords.some(kw => lineLower.includes(kw));
    if (!hasHardware) continue;

    // Extract quantity if present
    let name = line;
    let qty = 1;

    const qtyMatch = line.match(/(\d+)\s*(?:x|×)/i) ||
                     line.match(/qty[:\s]*(\d+)/i) ||
                     line.match(/quantity[:\s]*(\d+)/i);
    if (qtyMatch) {
      qty = parseInt(qtyMatch[1]);
    }

    // Clean up product name
    name = name.replace(/[$\d,\.]+/g, ' ').trim();
    name = name.replace(/\s+/g, ' ').trim();
    name = name.substring(0, 100);

    if (name.length > 5) {
      const mappedIds = mapProductToHardware(name);
      items.push({
        id: 'extracted_' + (items.length + 1),
        productName: name,
        quantity: qty,
        mappedHardwareIds: mappedIds,
        confidence: mappedIds.length > 0 ? 0.85 : 0.5
      });
    }
  }
  return items;
}

async function aiParsing(env, text) {
  if (!env.AI) return null;

  try {
    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: 'You extract hardware items from Toast POS quotes. Return ONLY a valid JSON array with no other text: [{"name":"Product Name","qty":1}]. Include items like Toast Flex, Toast Go, printers, KDS, routers, switches, card readers, cash drawers.'
        },
        {
          role: 'user',
          content: 'Extract hardware items from this Toast quote:\n\n' + text.substring(0, 3000)
        }
      ],
      max_tokens: 1024
    });

    const responseText = response.response || '';
    console.log('AI response:', responseText.substring(0, 200));

    // Find JSON array in response
    const jsonMatch = responseText.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed.map((item, idx) => ({
          id: 'ai_' + (idx + 1),
          productName: item.name || item.product || '',
          quantity: parseInt(item.qty || item.quantity || 1),
          mappedHardwareIds: mapProductToHardware(item.name || item.product || ''),
          confidence: 0.9
        })).filter(i => i.productName);
      }
    }
  } catch (e) {
    console.error('AI parsing error:', e);
  }

  return null;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { text, fileName } = body;

    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing or invalid text content'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    console.log('Processing', text.length, 'chars from', fileName || 'unknown');

    // Try AI-enhanced parsing first
    let extractedItems = await aiParsing(env, text);

    // Fall back to pattern matching
    if (!extractedItems || extractedItems.length === 0) {
      console.log('AI parsing returned nothing, using pattern matching');
      extractedItems = parseHardwareFromText(text);
    }

    console.log('Extracted', extractedItems.length, 'items');

    return new Response(JSON.stringify({
      success: true,
      extractedItems: extractedItems,
      itemCount: extractedItems.length,
      method: extractedItems.length > 0 && extractedItems[0].id.startsWith('ai_') ? 'ai' : 'pattern'
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Parse error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to parse: ' + error.message
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
