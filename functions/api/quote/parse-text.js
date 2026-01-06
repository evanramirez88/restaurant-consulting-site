/**
 * Quote Builder Enhanced Text Parsing Handler
 *
 * POST /api/quote/parse-text
 *
 * Parses Toast POS quote PDFs to extract:
 * - Hardware items (split bundled items, auto-grouped by station)
 * - Client information (name, address, contact)
 * - Software/integrations
 * - Rates and charges (admin-only data)
 * - Toast rep information
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

// ============================================
// HARDWARE MAPPING
// ============================================

const TOAST_TO_CATALOG_MAP = {
  // POS Terminals
  'toast flex': 'toast-flex',
  'flex terminal': 'toast-flex',
  'pos terminal': 'toast-flex',
  'toast flex guest': 'toast-flex-guest',
  'guest display': 'toast-flex-guest',
  'customer display': 'toast-flex-guest',
  'toast go 2': 'toast-go2',
  'toast go': 'toast-go2',
  'handheld': 'toast-go2',
  'mobile device': 'toast-go2',

  // KDS
  'elo kitchen': 'toast-kds',
  'elo v4': 'toast-kds',
  'kitchen display': 'toast-kds',
  'kds': 'toast-kds',
  'expo display': 'toast-kds',

  // Printers
  'toast printer': 'receipt-printer',
  'receipt printer': 'receipt-printer',
  'thermal printer': 'receipt-printer',
  'front printer': 'receipt-printer',
  'kitchen printer': 'impact-printer',
  'impact printer': 'impact-printer',
  'epson': 'impact-printer',
  'dot matrix': 'impact-printer',
  'label printer': 'label-printer',

  // Network
  'meraki': 'router',
  'router': 'router',
  'gateway': 'router',
  'toast hub': 'router',
  'ubiquiti': 'ap',
  'access point': 'ap',
  'wireless': 'ap',
  'wifi': 'ap',
  'unifi': 'ap',
  'poe switch': 'poe-switch',
  'tp-link': 'poe-switch',
  'network switch': 'poe-switch',
  'switch': 'poe-switch',
  'ethernet switch': 'poe-switch',

  // Card Readers
  'toast tap': 'card-reader-direct',
  'card reader': 'card-reader-direct',
  'tap to pay': 'card-reader-direct',
  'payment device': 'card-reader-direct',
  'contactless': 'card-reader-direct',
  'nfc reader': 'card-reader-direct',

  // Accessories
  'cash drawer': 'cash-drawer',
  'drawer': 'cash-drawer',
  'charging dock': 'charging-dock',
  'dock': 'charging-dock',
  'stand': 'stand',
  'tablet stand': 'stand',
  'kiosk': 'kiosk',
  'self-serve': 'kiosk',
  'self-ordering': 'kiosk',
  'ups': 'ups',
  'battery backup': 'ups',
  'barcode': 'barcode',
  'scanner': 'barcode',
  'scale': 'scale',
  'weight scale': 'scale'
};

// Bundle separator patterns
const BUNDLE_SEPARATORS = /\s*[+&,]\s*|\s+with\s+|\s+and\s+/i;

// Software/integration keywords
const SOFTWARE_KEYWORDS = {
  'payroll': { id: 'toast-payroll', name: 'Toast Payroll & Team Mgmt' },
  'team management': { id: 'toast-payroll', name: 'Toast Payroll & Team Mgmt' },
  'xtrachef': { id: 'xtrachef', name: 'xtraCHEF by Toast' },
  'invoicing': { id: 'xtrachef', name: 'xtraCHEF by Toast' },
  'inventory': { id: 'xtrachef', name: 'xtraCHEF by Toast' },
  'loyalty': { id: 'loyalty', name: 'Toast Loyalty' },
  'rewards': { id: 'loyalty', name: 'Toast Loyalty' },
  'gift card': { id: 'gift-cards', name: 'Gift Cards' },
  'online ordering': { id: 'online-ordering', name: 'Online Ordering' },
  'olo': { id: 'online-ordering', name: 'Online Ordering' },
  'takeout': { id: 'online-ordering', name: 'Online Ordering' },
  'delivery services': { id: 'delivery-services', name: 'Toast Delivery Services' },
  'toast delivery': { id: 'delivery-services', name: 'Toast Delivery Services' },
  'doordash': { id: '3p-delivery', name: '3rd-Party Delivery' },
  'uber eats': { id: '3p-delivery', name: '3rd-Party Delivery' },
  'grubhub': { id: '3p-delivery', name: '3rd-Party Delivery' },
  'opentable': { id: 'opentable', name: 'OpenTable' },
  'reservations': { id: 'tables', name: 'Toast Tables' },
  'tables': { id: 'tables', name: 'Toast Tables' },
  'waitlist': { id: 'tables', name: 'Toast Tables' },
  'email marketing': { id: 'email-mktg', name: 'Email Marketing' },
  'marketing': { id: 'email-mktg', name: 'Email Marketing' },
  '7shifts': { id: '7shifts', name: '7shifts Scheduling' },
  'scheduling': { id: '7shifts', name: '7shifts Scheduling' },
  'sling': { id: 'sling', name: 'Sling Scheduling' }
};

// ============================================
// BUNDLED ITEM SPLITTER
// ============================================

/**
 * Split a bundled product line like "Toast Flex + Tap + Printer + Cash Drawer"
 * into individual hardware items.
 *
 * IMPORTANT: For bundled items representing a complete station setup,
 * each item gets qty=1 (the station GROUP gets the multiplier).
 * Example: "Toast Flex + Tap + Printer + Cash Drawer 5" becomes:
 *   stationQuantity: 5
 *   items: [{name: "Toast Flex", qty: 1}, {name: "Toast Tap", qty: 1}, ...]
 *
 * This is handled by returning isStationBundle=true when 3+ items are bundled.
 */
function splitBundledItems(productName, quantity) {
  const items = [];
  const parts = productName.split(BUNDLE_SEPARATORS).map(p => p.trim()).filter(p => p.length > 2);

  // If no splits found, treat as single item
  if (parts.length <= 1) {
    return { items: [{ name: productName, qty: quantity, catalogId: null }], isStationBundle: false, stationQuantity: 1 };
  }

  // Multiple items bundled together - this represents a station configuration
  // Each item in the bundle gets qty=1, but we track the station multiplier
  const isStationBundle = parts.length >= 3; // 3+ items = likely a full station bundle
  const itemQty = isStationBundle ? 1 : quantity;

  for (const part of parts) {
    // Check if this part contains a hardware keyword
    const partLower = part.toLowerCase();
    let matched = false;

    for (const [keyword, catalogId] of Object.entries(TOAST_TO_CATALOG_MAP)) {
      if (partLower.includes(keyword)) {
        items.push({
          name: part,
          qty: itemQty,
          catalogId: catalogId
        });
        matched = true;
        break;
      }
    }

    // If no direct match, still include it for review
    if (!matched && part.length > 3) {
      items.push({
        name: part,
        qty: itemQty,
        catalogId: null
      });
    }
  }

  return {
    items: items.length > 0 ? items : [{ name: productName, qty: quantity, catalogId: null }],
    isStationBundle: isStationBundle,
    stationQuantity: isStationBundle ? quantity : 1
  };
}

/**
 * Map a single product name to catalog ID(s)
 */
function mapProductToHardware(productName) {
  const mappedIds = [];
  const nameLower = productName.toLowerCase();

  for (const [keyword, catalogId] of Object.entries(TOAST_TO_CATALOG_MAP)) {
    if (nameLower.includes(keyword)) {
      if (!mappedIds.includes(catalogId)) {
        mappedIds.push(catalogId);
      }
    }
  }

  return mappedIds;
}

// ============================================
// CLIENT INFO EXTRACTION
// ============================================

function extractClientInfo(text) {
  const info = {
    businessName: null,
    address: null,
    city: null,
    state: null,
    zip: null,
    phone: null,
    email: null,
    contactName: null
  };

  const lines = text.split('\n');

  // Look for common patterns
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineLower = line.toLowerCase();

    // Email pattern
    const emailMatch = line.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch && !info.email) {
      info.email = emailMatch[1];
    }

    // Phone pattern
    const phoneMatch = line.match(/(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
    if (phoneMatch && !info.phone) {
      info.phone = phoneMatch[1];
    }

    // Address pattern (street address)
    const addressMatch = line.match(/^\d+\s+[A-Za-z0-9\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Way|Court|Ct|Place|Pl)\b/i);
    if (addressMatch && !info.address) {
      info.address = line;
      // Check next line for city/state/zip
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        const cityStateZip = nextLine.match(/([A-Za-z\s]+),?\s*([A-Z]{2})\s*(\d{5}(-\d{4})?)?/);
        if (cityStateZip) {
          info.city = cityStateZip[1].trim();
          info.state = cityStateZip[2];
          info.zip = cityStateZip[3] || null;
        }
      }
    }

    // Business name often appears after "Customer:" or "Restaurant:" or at top
    if (lineLower.includes('customer:') || lineLower.includes('restaurant:') || lineLower.includes('business:')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        info.businessName = line.substring(colonIdx + 1).trim();
      }
    }

    // Contact name
    if (lineLower.includes('contact:') || lineLower.includes('attn:') || lineLower.includes('attention:')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        info.contactName = line.substring(colonIdx + 1).trim();
      }
    }
  }

  return info;
}

// ============================================
// SOFTWARE/INTEGRATIONS EXTRACTION
// ============================================

function extractSoftware(text) {
  const software = [];
  const textLower = text.toLowerCase();
  const seenIds = new Set();

  for (const [keyword, sw] of Object.entries(SOFTWARE_KEYWORDS)) {
    if (textLower.includes(keyword) && !seenIds.has(sw.id)) {
      seenIds.add(sw.id);

      // Try to extract monthly cost
      const costPattern = new RegExp(keyword + '[^$]*\\$([\\d,]+(?:\\.\\d{2})?)', 'i');
      const costMatch = text.match(costPattern);

      software.push({
        id: sw.id,
        name: sw.name,
        monthlyCost: costMatch ? parseFloat(costMatch[1].replace(',', '')) : null,
        detected: true
      });
    }
  }

  return software;
}

// ============================================
// RATES & CHARGES EXTRACTION (Admin Only)
// ============================================

function extractRatesAndCharges(text) {
  const data = {
    processingRates: {
      cardPresent: null,
      cardNotPresent: null,
      perTransaction: null
    },
    recurringCharges: [],
    oneTimeCharges: [],
    promotions: [],
    repInfo: {
      name: null,
      email: null,
      phone: null
    }
  };

  const lines = text.split('\n');

  for (const line of lines) {
    const lineLower = line.toLowerCase();

    // Processing rates (e.g., "2.49% + $0.15")
    const rateMatch = line.match(/(\d+\.\d+)\s*%\s*\+?\s*\$?(\d+\.\d+)?/);
    if (rateMatch && (lineLower.includes('processing') || lineLower.includes('card') || lineLower.includes('rate'))) {
      if (lineLower.includes('present') || lineLower.includes('swiped') || lineLower.includes('chip')) {
        data.processingRates.cardPresent = rateMatch[1] + '%';
        if (rateMatch[2]) data.processingRates.perTransaction = '$' + rateMatch[2];
      } else if (lineLower.includes('keyed') || lineLower.includes('online') || lineLower.includes('not present')) {
        data.processingRates.cardNotPresent = rateMatch[1] + '%';
      }
    }

    // Monthly/recurring charges
    if (lineLower.includes('/mo') || lineLower.includes('per month') || lineLower.includes('monthly')) {
      const amountMatch = line.match(/\$([0-9,]+(?:\.\d{2})?)/);
      if (amountMatch) {
        const amount = parseFloat(amountMatch[1].replace(',', ''));
        // Extract what the charge is for
        const beforeDollar = line.substring(0, line.indexOf('$')).trim();
        if (beforeDollar.length > 3 && amount > 0) {
          data.recurringCharges.push({
            description: beforeDollar.substring(0, 50),
            amount: amount,
            period: 'monthly'
          });
        }
      }
    }

    // One-time charges
    if (lineLower.includes('one-time') || lineLower.includes('one time') || lineLower.includes('installation') || lineLower.includes('setup')) {
      const amountMatch = line.match(/\$([0-9,]+(?:\.\d{2})?)/);
      if (amountMatch) {
        const amount = parseFloat(amountMatch[1].replace(',', ''));
        const beforeDollar = line.substring(0, line.indexOf('$')).trim();
        if (beforeDollar.length > 3 && amount > 0) {
          data.oneTimeCharges.push({
            description: beforeDollar.substring(0, 50),
            amount: amount
          });
        }
      }
    }

    // Promotions/discounts
    if (lineLower.includes('promo') || lineLower.includes('discount') || lineLower.includes('waived') || lineLower.includes('free')) {
      data.promotions.push(line.trim().substring(0, 100));
    }

    // Toast rep info
    if (lineLower.includes('sales rep') || lineLower.includes('account exec') || lineLower.includes('representative')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        data.repInfo.name = line.substring(colonIdx + 1).trim();
      }
    }
  }

  return data;
}

// ============================================
// HARDWARE PARSING WITH GROUPING
// ============================================

function parseHardwareFromText(text) {
  const stationGroups = [];
  const ungroupedItems = [];
  let currentGroup = null;

  const lines = text.split('\n').filter(l => l.trim());
  const hardwareKeywords = [
    'toast flex', 'toast go', 'toast tap', 'toast printer',
    'kitchen display', 'kds', 'elo', 'impact printer',
    'receipt printer', 'thermal printer', 'kitchen printer',
    'cash drawer', 'charging dock', 'meraki', 'router',
    'switch', 'poe', 'tp-link', 'ubiquiti', 'access point',
    'card reader', 'tap to pay', 'handheld', 'mobile device',
    'guest display', 'customer display', 'kiosk', 'self-serve',
    'ups', 'battery backup', 'barcode', 'scanner', 'scale'
  ];

  // Station type indicators - these start new groups
  const stationIndicators = [
    'pos station', 'server station', 'bar station', 'host station',
    'hostess stand', 'takeout station', 'kitchen station', 'expo station',
    'bar pos', 'front of house', 'back of house', 'retail',
    'checkout', 'register', 'terminal'
  ];

  for (const line of lines) {
    const lineLower = line.toLowerCase();

    // Check if this line starts a new station group
    const isStationHeader = stationIndicators.some(ind => lineLower.includes(ind));
    if (isStationHeader) {
      // Save previous group if it has items
      if (currentGroup && currentGroup.items.length > 0) {
        stationGroups.push(currentGroup);
      }
      // Start new group
      currentGroup = {
        name: line.replace(/[$\d,\.]+/g, '').trim().substring(0, 50),
        items: [],
        quantity: 1
      };

      // Extract quantity from station header (e.g., "POS Station x5" or "5x Server Stations")
      const qtyMatch = line.match(/(\d+)\s*x|x\s*(\d+)/i) || line.match(/(\d+)\s+station/i);
      if (qtyMatch) {
        currentGroup.quantity = parseInt(qtyMatch[1] || qtyMatch[2]);
      }
      continue;
    }

    // Check if this line contains hardware
    const hasHardware = hardwareKeywords.some(kw => lineLower.includes(kw));
    if (!hasHardware) continue;

    // Extract quantity
    let qty = 1;
    const qtyMatch = line.match(/(\d+)\s*(?:x|×)/i) ||
                     line.match(/qty[:\s]*(\d+)/i) ||
                     line.match(/quantity[:\s]*(\d+)/i) ||
                     line.match(/^\s*(\d+)\s+(?![\d$])/);
    if (qtyMatch) {
      qty = parseInt(qtyMatch[1]);
    }

    // Clean up product name
    let name = line.replace(/[$\d,\.]+/g, ' ').trim();
    name = name.replace(/\s+/g, ' ').trim();
    name = name.substring(0, 100);

    if (name.length > 5) {
      // Split bundled items
      const splitResult = splitBundledItems(name, qty);
      const { items: splitItems, isStationBundle, stationQuantity } = splitResult;

      // If this is a station bundle (3+ items), create a new station group for it
      if (isStationBundle && stationQuantity >= 1) {
        // Create a new station group for this bundle
        const bundleGroup = {
          name: 'POS Station',
          quantity: stationQuantity,
          items: []
        };

        for (const item of splitItems) {
          const mappedIds = item.catalogId ? [item.catalogId] : mapProductToHardware(item.name);
          bundleGroup.items.push({
            id: 'extracted_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            productName: item.name,
            quantity: item.qty,
            mappedHardwareIds: mappedIds,
            confidence: mappedIds.length > 0 ? 0.85 : 0.5
          });
        }

        // Add as a new station group (bundles always create their own group)
        if (bundleGroup.items.length > 0) {
          stationGroups.push(bundleGroup);
        }
      } else {
        // Not a station bundle - add items individually
        for (const item of splitItems) {
          const mappedIds = item.catalogId ? [item.catalogId] : mapProductToHardware(item.name);

          const hwItem = {
            id: 'extracted_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            productName: item.name,
            quantity: item.qty,
            mappedHardwareIds: mappedIds,
            confidence: mappedIds.length > 0 ? 0.85 : 0.5
          };

          if (currentGroup) {
            currentGroup.items.push(hwItem);
          } else {
            ungroupedItems.push(hwItem);
          }
        }
      }
    }
  }

  // Don't forget the last group
  if (currentGroup && currentGroup.items.length > 0) {
    stationGroups.push(currentGroup);
  }

  return { stationGroups, ungroupedItems };
}

// ============================================
// AI ENHANCED PARSING
// ============================================

async function aiParsing(env, text) {
  if (!env.AI) return null;

  try {
    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: `You extract data from Toast POS quotes. Return ONLY valid JSON with this structure:
{
  "stationGroups": [
    {
      "name": "Station Name (e.g. Bar Station)",
      "quantity": 1,
      "items": [{"name": "Toast Flex", "qty": 1}, {"name": "Toast Tap", "qty": 1}]
    }
  ],
  "ungroupedItems": [{"name": "Router", "qty": 1}],
  "clientInfo": {
    "businessName": "Restaurant Name",
    "address": "123 Main St",
    "city": "Boston",
    "state": "MA",
    "phone": "555-123-4567",
    "email": "email@example.com"
  },
  "software": ["Online Ordering", "Toast Payroll", "Loyalty"],
  "repName": "Sales Rep Name"
}

IMPORTANT:
- Split bundled items like "Toast Flex + Tap + Printer" into separate items
- Group hardware into stations when possible (POS Station, Bar, Kitchen, etc.)
- Extract ALL hardware: terminals, printers, KDS, card readers, switches, routers, cash drawers
- Extract client contact info if present
- List any software/integrations mentioned`
        },
        {
          role: 'user',
          content: 'Extract all data from this Toast quote:\n\n' + text.substring(0, 4000)
        }
      ],
      max_tokens: 2048
    });

    const responseText = response.response || '';
    console.log('AI response:', responseText.substring(0, 300));

    // Find JSON in response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed;
    }
  } catch (e) {
    console.error('AI parsing error:', e);
  }

  return null;
}

/**
 * Convert AI response to our standard format
 */
function normalizeAiResponse(aiData) {
  const result = {
    stationGroups: [],
    ungroupedItems: [],
    clientInfo: aiData.clientInfo || {},
    software: [],
    adminData: {
      repInfo: { name: aiData.repName || null }
    }
  };

  // Process station groups
  if (aiData.stationGroups && Array.isArray(aiData.stationGroups)) {
    for (const group of aiData.stationGroups) {
      const processedGroup = {
        name: group.name || 'Station',
        quantity: group.quantity || 1,
        items: []
      };

      if (group.items && Array.isArray(group.items)) {
        for (const item of group.items) {
          const mappedIds = mapProductToHardware(item.name || '');
          processedGroup.items.push({
            id: 'ai_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            productName: item.name || '',
            quantity: item.qty || 1,
            mappedHardwareIds: mappedIds,
            confidence: mappedIds.length > 0 ? 0.9 : 0.6
          });
        }
      }

      if (processedGroup.items.length > 0) {
        result.stationGroups.push(processedGroup);
      }
    }
  }

  // Process ungrouped items
  if (aiData.ungroupedItems && Array.isArray(aiData.ungroupedItems)) {
    for (const item of aiData.ungroupedItems) {
      const mappedIds = mapProductToHardware(item.name || '');
      result.ungroupedItems.push({
        id: 'ai_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        productName: item.name || '',
        quantity: item.qty || 1,
        mappedHardwareIds: mappedIds,
        confidence: mappedIds.length > 0 ? 0.9 : 0.6
      });
    }
  }

  // Process software
  if (aiData.software && Array.isArray(aiData.software)) {
    for (const swName of aiData.software) {
      const swLower = swName.toLowerCase();
      for (const [keyword, sw] of Object.entries(SOFTWARE_KEYWORDS)) {
        if (swLower.includes(keyword)) {
          result.software.push({
            id: sw.id,
            name: sw.name,
            monthlyCost: null,
            detected: true
          });
          break;
        }
      }
    }
  }

  return result;
}

// ============================================
// MAIN HANDLER
// ============================================

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
    let result = null;
    const aiData = await aiParsing(env, text);

    if (aiData) {
      console.log('AI parsing succeeded, normalizing response');
      result = normalizeAiResponse(aiData);
    }

    // If AI didn't work or returned nothing, use pattern matching
    if (!result || (result.stationGroups.length === 0 && result.ungroupedItems.length === 0)) {
      console.log('Using pattern matching fallback');
      const hwData = parseHardwareFromText(text);
      result = {
        stationGroups: hwData.stationGroups,
        ungroupedItems: hwData.ungroupedItems,
        clientInfo: extractClientInfo(text),
        software: extractSoftware(text),
        adminData: extractRatesAndCharges(text)
      };
    } else {
      // AI worked, but let's supplement with pattern-matched data
      const patternClientInfo = extractClientInfo(text);
      const patternSoftware = extractSoftware(text);
      const patternAdminData = extractRatesAndCharges(text);

      // Merge client info (prefer AI but fill gaps with pattern matching)
      result.clientInfo = {
        ...patternClientInfo,
        ...result.clientInfo
      };

      // Merge software (combine both)
      const seenSw = new Set(result.software.map(s => s.id));
      for (const sw of patternSoftware) {
        if (!seenSw.has(sw.id)) {
          result.software.push(sw);
        }
      }

      // Use pattern-matched admin data (usually more reliable for specific rates)
      result.adminData = {
        ...patternAdminData,
        repInfo: {
          ...patternAdminData.repInfo,
          ...(result.adminData?.repInfo || {})
        }
      };
    }

    // Calculate totals
    const totalGroupedItems = result.stationGroups.reduce((sum, g) => sum + g.items.length, 0);
    const totalItems = totalGroupedItems + result.ungroupedItems.length;

    console.log('Extracted:', {
      stationGroups: result.stationGroups.length,
      ungroupedItems: result.ungroupedItems.length,
      software: result.software.length,
      hasClientInfo: !!result.clientInfo?.businessName || !!result.clientInfo?.email
    });

    // Create flat extractedItems for backward compatibility
    const extractedItems = [
      ...result.stationGroups.flatMap(g => g.items),
      ...result.ungroupedItems
    ];

    return new Response(JSON.stringify({
      success: true,
      // New structured format
      stationGroups: result.stationGroups,
      ungroupedItems: result.ungroupedItems,
      clientInfo: result.clientInfo,
      software: result.software,
      adminData: result.adminData,
      // Backward compatible format
      extractedItems: extractedItems,
      itemCount: totalItems,
      method: aiData ? 'ai' : 'pattern'
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
