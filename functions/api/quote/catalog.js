/**
 * Quote Builder Catalog API - Sanitized Data
 *
 * GET /api/quote/catalog
 *
 * Returns hardware and template catalogs for display purposes only.
 * TTI (time-to-install) and pricing data is NOT exposed.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

// ============================================
// PUBLIC CATALOG DATA (No pricing/TTI exposed)
// ============================================

const HARDWARE_CATALOG = [
  { id: 'toast-flex', name: 'Toast Flex Terminal', category: 'POS' },
  { id: 'toast-flex-guest', name: 'Guest Display (Flex)', category: 'POS' },
  { id: 'toast-go2', name: 'Toast Go 2 (Handheld)', category: 'POS' },
  { id: 'toast-kds', name: 'Kitchen Display (KDS)', category: 'KDS' },
  { id: 'receipt-printer', name: 'Thermal Receipt Printer', category: 'Printers' },
  { id: 'impact-printer', name: 'Kitchen Impact Printer', category: 'Printers' },
  { id: 'label-printer', name: 'Label Printer', category: 'Printers' },
  { id: 'poe-switch', name: 'Ethernet Switch (PoE)', category: 'Network' },
  { id: 'ap', name: 'Wi-Fi Access Point', category: 'Network' },
  { id: 'router', name: 'Toast Router / Hub', category: 'Network' },
  { id: 'card-reader-direct', name: 'Card Reader (Toast Direct Attach)', category: 'Card' },
  { id: 'card-reader-guest', name: 'Card Reader (Toast Guest Pay)', category: 'Card' },
  { id: 'card-reader-employee', name: 'Card Reader (Swipe to Pay - Employee)', category: 'Card' },
  { id: 'ups', name: 'UPS Battery Backup', category: 'Power' },
  { id: 'cash-drawer', name: 'Cash Drawer', category: 'Accessories' },
  { id: 'barcode', name: 'Barcode Scanner', category: 'Retail' },
  { id: 'scale', name: 'By-Weight Scale', category: 'Retail' }
];

const INTEGRATIONS_CATALOG = [
  { id: 'toast-payroll', name: 'Toast Payroll & Team Mgmt' },
  { id: 'xtrachef', name: 'xtraCHEF by Toast' },
  { id: 'loyalty', name: 'Toast Loyalty' },
  { id: 'gift-cards', name: 'Gift Cards' },
  { id: 'online-ordering', name: 'Online Ordering' },
  { id: 'delivery-services', name: 'Toast Delivery Services' },
  { id: '3p-delivery', name: '3rd-Party Delivery (Uber/DoorDash/Grubhub)' },
  { id: 'opentable', name: 'OpenTable' },
  { id: 'tables', name: 'Toast Tables (Reservations)' },
  { id: 'email-mktg', name: 'Email Marketing' },
  { id: '7shifts', name: '7shifts Scheduling' }
];

const STATION_TEMPLATES = [
  { id: 'tmpl-server', label: 'Server Station', items: ['toast-flex', 'receipt-printer', 'card-reader-direct'], color: '#38bdf8' },
  { id: 'tmpl-bar-plus', label: 'Bar Station Plus Service', items: ['toast-flex', 'receipt-printer', 'card-reader-direct', 'cash-drawer', 'impact-printer'], color: '#22d3ee' },
  { id: 'tmpl-bar', label: 'Bar Station', items: ['toast-flex', 'receipt-printer', 'card-reader-direct', 'cash-drawer'], color: '#0ea5e9' },
  { id: 'tmpl-host', label: 'Host Stand', items: ['toast-flex', 'receipt-printer', 'card-reader-direct', 'cash-drawer'], color: '#a3e635' },
  { id: 'tmpl-full-kitchen', label: 'Full Kitchen', items: ['toast-kds', 'impact-printer'], color: '#fbbf24' },
  { id: 'tmpl-takeout', label: 'Takeout Station', items: ['toast-flex', 'receipt-printer', 'card-reader-guest', 'card-reader-employee', 'cash-drawer', 'toast-flex-guest'], color: '#f472b6' },
  { id: 'tmpl-retail', label: 'Retail Terminal', items: ['receipt-printer', 'card-reader-guest', 'card-reader-employee', 'cash-drawer', 'toast-flex-guest'], color: '#34d399' },
  { id: 'tmpl-retail-weighed', label: 'Weighed Retail Terminal', items: ['receipt-printer', 'card-reader-guest', 'card-reader-employee', 'cash-drawer', 'toast-flex-guest', 'scale'], color: '#10b981' },
  { id: 'tmpl-retail-full', label: 'Full Retail Terminal', items: ['receipt-printer', 'card-reader-guest', 'card-reader-employee', 'cash-drawer', 'toast-flex-guest', 'barcode', 'scale'], color: '#059669' },
  { id: 'tmpl-kds', label: 'Kitchen KDS', items: ['toast-kds'], color: '#f59e0b' },
  { id: 'tmpl-bar-service', label: 'Bar Service Station', items: ['impact-printer'], color: '#22c55e' },
  { id: 'tmpl-barista', label: 'Barista Station', items: ['toast-flex', 'receipt-printer', 'card-reader-guest', 'card-reader-employee', 'cash-drawer', 'toast-flex-guest', 'label-printer'], color: '#8b5cf6' },
  { id: 'tmpl-expo', label: 'Expo Station', items: ['toast-kds', 'impact-printer'], color: '#f59e0b' },
  { id: 'tmpl-network', label: 'Networking Area', items: ['router', 'poe-switch'], color: '#14b8a6' },
  { id: 'tmpl-ap', label: 'Access Point', items: ['ap'], color: '#06b6d4' },
  { id: 'tmpl-switch', label: 'Ethernet Switch', items: ['poe-switch'], color: '#22c55e' }
];

const COMMON_STATION_NAMES = [
  'Networking Area',
  'Server Station',
  'Bar Station',
  'Bar Service Station',
  'Takeout Station',
  'Host Station',
  'Barista Station',
  'Retail Station',
  'Expo Station',
  'Print Kitchen Station',
  'KDS Kitchen Station',
  'Full Kitchen Station',
  'Access Point',
  'Ethernet Switch'
];

const TRAVEL_ZONES = [
  { id: 'cape', label: 'Cape Cod' },
  { id: 'southShore', label: 'South Shore (60 mi)' },
  { id: 'southernNE', label: 'Southern New England (60-100 mi)' },
  { id: 'ne100+', label: 'New England >100 mi' },
  { id: 'island', label: 'Islands (MV/Nantucket)' },
  { id: 'outOfRegion', label: 'Outside New England' }
];

const SUPPORT_TIERS = [
  { id: 0, label: 'None', pct: 0 },
  { id: 10, label: 'Basic', pct: 10 },
  { id: 20, label: 'Standard', pct: 20 },
  { id: 30, label: 'Premium', pct: 30 }
];

// ============================================
// REQUEST HANDLERS
// ============================================

export async function onRequestGet() {
  return new Response(JSON.stringify({
    success: true,
    catalog: {
      hardware: HARDWARE_CATALOG,
      integrations: INTEGRATIONS_CATALOG,
      stationTemplates: STATION_TEMPLATES,
      commonStationNames: COMMON_STATION_NAMES,
      travelZones: TRAVEL_ZONES,
      supportTiers: SUPPORT_TIERS
    }
  }), {
    status: 200,
    headers: corsHeaders
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}
