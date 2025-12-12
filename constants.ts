import {
  StationType,
  StationConfig,
  HardwareItem,
  IntegrationItem,
  StationTemplate,
  TravelRates,
  Rates,
  ObjectDefinition
} from './types';

export const COMPANY_NAME = "Cape Cod Restaurant Consulting";
export const OWNER_NAME = "Evan Ramirez";
export const PHONE_NUMBER = "(508) 247-4936";
export const EMAIL_ADDRESS = "evanramirez@ccrestaurantconsulting.com";

// Legacy pricing constants (for backward compatibility)
export const PRICING_CONSTANTS = {
  HOURLY_RATE: 110,
  TRAVEL_ZONES: [0, 150, 300],
  CABLING_PER_DROP: 225,
  TRAINING_RATE: 150,
};

export const STATION_CONFIGS: Record<StationType, StationConfig> = {
  [StationType.EXPO]: {
    type: StationType.EXPO,
    baseCost: 450,
    complexityScore: 1.5,
    hardware: ['KDS Screen', 'Mount', 'Impact Printer', 'Switch']
  },
  [StationType.SERVER]: {
    type: StationType.SERVER,
    baseCost: 350,
    complexityScore: 1.0,
    hardware: ['Terminal', 'Receipt Printer', 'Cash Drawer']
  },
  [StationType.BAR]: {
    type: StationType.BAR,
    baseCost: 400,
    complexityScore: 1.2,
    hardware: ['Terminal', 'Receipt Printer', 'Cash Drawer', 'Mount']
  },
  [StationType.TAKEOUT]: {
    type: StationType.TAKEOUT,
    baseCost: 250,
    complexityScore: 0.8,
    hardware: ['Terminal', 'Receipt Printer']
  },
  [StationType.MANAGER]: {
    type: StationType.MANAGER,
    baseCost: 200,
    complexityScore: 0.5,
    hardware: ['All-in-One PC', 'Network Bridge']
  }
};

export const NAVIGATION = [
  { name: 'Home', path: '/' },
  { name: 'Services', path: '/services' },
  { name: 'About', path: '/about' },
  { name: 'Quote Builder', path: '/quote' },
  { name: 'Menu Builder', path: '/menu-builder' },
  { name: 'Schedule', path: '/schedule' },
  { name: 'Contact', path: '/contact' },
];

// ============================================
// ADVANCED QUOTE BUILDER CONSTANTS
// ============================================

export const DEFAULT_RATES: Rates = {
  hourly: 110
};

export const DEFAULT_TRAVEL: TravelRates = {
  capeCod: 0,
  southShore: 100,        // <= 60 mi over the bridge
  southernNE: 250,        // 60-100 mi
  newEngland100Plus: 400, // > 100 mi
  islandBase: 300,
  islandVehicle: 200,
  islandLodging: 250,
  outOfRegionBase: 800
};

// Toast Hardware Catalog with Time-to-Install (TTI) minutes
export const HARDWARE_CATALOG: HardwareItem[] = [
  { id: "toast-flex", name: "Toast Flex Terminal", category: "POS", ttiMin: 45 },
  { id: "toast-flex-guest", name: "Guest Display (Flex)", category: "POS", ttiMin: 30 },
  { id: "toast-go2", name: "Toast Go 2 (Handheld)", category: "POS", ttiMin: 25 },
  { id: "toast-kds", name: "Kitchen Display (KDS)", category: "KDS", ttiMin: 30 },
  { id: "receipt-printer", name: "Thermal Receipt Printer", category: "Printers", ttiMin: 20 },
  { id: "impact-printer", name: "Kitchen Impact Printer", category: "Printers", ttiMin: 20 },
  { id: "label-printer", name: "Label Printer", category: "Printers", ttiMin: 40 },
  { id: "poe-switch", name: "Ethernet Switch (PoE)", category: "Network", ttiMin: 10 },
  { id: "ap", name: "Wi-Fi Access Point", category: "Network", ttiMin: 25 },
  { id: "router", name: "Toast Router / Hub", category: "Network", ttiMin: 25 },
  { id: "card-reader-direct", name: "Card Reader (Toast Direct Attach)", category: "Card", ttiMin: 20 },
  { id: "card-reader-guest", name: "Card Reader (Toast Guest Pay)", category: "Card", ttiMin: 20 },
  { id: "card-reader-employee", name: "Card Reader (Swipe to Pay - Employee)", category: "Card", ttiMin: 20 },
  { id: "ups", name: "UPS Battery Backup", category: "Power", ttiMin: 15 },
  { id: "cash-drawer", name: "Cash Drawer", category: "Accessories", ttiMin: 15 },
  { id: "barcode", name: "Barcode Scanner", category: "Retail", ttiMin: 15 },
  { id: "scale", name: "By-Weight Scale", category: "Retail", ttiMin: 45 }
];

// Integrations with TTI
export const INTEGRATIONS: IntegrationItem[] = [
  { id: "toast-payroll", name: "Toast Payroll & Team Mgmt", ttiMin: 90 },
  { id: "xtrachef", name: "xtraCHEF by Toast", ttiMin: 90 },
  { id: "loyalty", name: "Toast Loyalty", ttiMin: 60 },
  { id: "gift-cards", name: "Gift Cards", ttiMin: 45 },
  { id: "online-ordering", name: "Online Ordering", ttiMin: 60 },
  { id: "delivery-services", name: "Toast Delivery Services", ttiMin: 30 },
  { id: "3p-delivery", name: "3rd-Party Delivery (Uber/DoorDash/Grubhub)", ttiMin: 60 },
  { id: "opentable", name: "OpenTable", ttiMin: 60 },
  { id: "tables", name: "Toast Tables (Reservations)", ttiMin: 90 },
  { id: "email-mktg", name: "Email Marketing", ttiMin: 45 },
  { id: "7shifts", name: "7shifts Scheduling", ttiMin: 75 }
];

// Prebuilt Station Templates
export const STATION_TEMPLATES: StationTemplate[] = [
  {
    id: "tmpl-server",
    label: "Server Station",
    ttiMin: 85,
    items: ["toast-flex", "receipt-printer", "card-reader-direct"],
    color: "#38bdf8"
  },
  {
    id: "tmpl-bar-plus",
    label: "Bar Station Plus Service",
    ttiMin: 120,
    items: ["toast-flex", "receipt-printer", "card-reader-direct", "cash-drawer", "impact-printer"],
    color: "#22d3ee"
  },
  {
    id: "tmpl-bar",
    label: "Bar Station",
    ttiMin: 100,
    items: ["toast-flex", "receipt-printer", "card-reader-direct", "cash-drawer"],
    color: "#0ea5e9"
  },
  {
    id: "tmpl-host",
    label: "Host Stand",
    ttiMin: 100,
    items: ["toast-flex", "receipt-printer", "card-reader-direct", "cash-drawer"],
    color: "#a3e635"
  },
  {
    id: "tmpl-full-kitchen",
    label: "Full Kitchen",
    ttiMin: 50,
    items: ["toast-kds", "impact-printer"],
    color: "#fbbf24"
  },
  {
    id: "tmpl-takeout",
    label: "Takeout Station",
    ttiMin: 150,
    items: ["toast-flex", "receipt-printer", "card-reader-guest", "card-reader-employee", "cash-drawer", "toast-flex-guest"],
    color: "#f472b6"
  },
  {
    id: "tmpl-retail",
    label: "Retail Terminal",
    ttiMin: 120,
    items: ["receipt-printer", "card-reader-guest", "card-reader-employee", "cash-drawer", "toast-flex-guest"],
    color: "#34d399"
  },
  {
    id: "tmpl-retail-weighed",
    label: "Weighed Retail Terminal",
    ttiMin: 150,
    items: ["receipt-printer", "card-reader-guest", "card-reader-employee", "cash-drawer", "toast-flex-guest", "scale"],
    color: "#10b981"
  },
  {
    id: "tmpl-retail-full",
    label: "Full Retail Terminal",
    ttiMin: 165,
    items: ["receipt-printer", "card-reader-guest", "card-reader-employee", "cash-drawer", "toast-flex-guest", "barcode", "scale"],
    color: "#059669"
  },
  {
    id: "tmpl-kds",
    label: "Kitchen KDS",
    ttiMin: 30,
    items: ["toast-kds"],
    color: "#f59e0b"
  },
  {
    id: "tmpl-bar-service",
    label: "Bar Service Station",
    ttiMin: 20,
    items: ["impact-printer"],
    color: "#22c55e"
  },
  {
    id: "tmpl-barista",
    label: "Barista Station",
    ttiMin: 190,
    items: ["toast-flex", "receipt-printer", "card-reader-guest", "card-reader-employee", "cash-drawer", "toast-flex-guest", "label-printer"],
    color: "#8b5cf6"
  },
  {
    id: "tmpl-expo",
    label: "Expo Station",
    ttiMin: 50,
    items: ["toast-kds", "impact-printer"],
    color: "#f59e0b"
  },
  {
    id: "tmpl-network",
    label: "Networking Area",
    ttiMin: 35,
    items: ["router", "poe-switch"],
    color: "#14b8a6"
  },
  {
    id: "tmpl-ap",
    label: "Access Point",
    ttiMin: 25,
    items: ["ap"],
    color: "#06b6d4"
  },
  {
    id: "tmpl-switch",
    label: "Ethernet Switch",
    ttiMin: 10,
    items: ["poe-switch"],
    color: "#22c55e"
  }
];

// Common station type names for quick-add
export const COMMON_STATION_NAMES = [
  "Networking Area",
  "Server Station",
  "Bar Station",
  "Bar Service Station",
  "Takeout Station",
  "Host Station",
  "Barista Station",
  "Retail Station",
  "Expo Station",
  "Print Kitchen Station",
  "KDS Kitchen Station",
  "Full Kitchen Station",
  "Access Point",
  "Ethernet Switch"
];

// FOH Objects (front of house)
export const FOH_OBJECTS: ObjectDefinition[] = [
  { type: "Table", w: 80, h: 80, color: "#6b7280" },
  { type: "Bar Counter", w: 220, h: 44, color: "#4b5563" },
  { type: "Host Stand", w: 60, h: 40, color: "#6b7280" },
  { type: "Phone", w: 24, h: 24, color: "#94a3b8" },
  { type: "Service Window", w: 120, h: 12, color: "#eab308" }
];

// BOH Objects (back of house)
export const BOH_OBJECTS: ObjectDefinition[] = [
  { type: "Prep Table", w: 120, h: 50, color: "#7c3aed" },
  { type: "Walk-in", w: 160, h: 120, color: "#0ea5e9" },
  { type: "Sink", w: 60, h: 40, color: "#06b6d4" },
  { type: "Oven", w: 60, h: 60, color: "#f97316" },
  { type: "Fryer", w: 50, h: 50, color: "#f59e0b" },
  { type: "Grill", w: 120, h: 60, color: "#ef4444" },
  { type: "Fridge", w: 60, h: 60, color: "#22c55e" }
];

// Structure Objects
export const STRUCTURE_OBJECTS: ObjectDefinition[] = [
  { type: "Wall", w: 220, h: 10, color: "#1f2937" },
  { type: "Door (Entry)", w: 36, h: 4, color: "#94a3b8" },
  { type: "Door (Exit)", w: 36, h: 4, color: "#94a3b8" }
];

// Station overhead per station (in minutes)
export const STATION_OVERHEAD_MIN = 15;

// Support tier options (percentage of install cost)
export const SUPPORT_TIERS = [0, 10, 20, 30];

// Local storage key prefix
export const LS_KEY = "ccrc_quote_builder_v4";

// Travel zone labels for display
export const TRAVEL_ZONE_LABELS: Record<string, string> = {
  cape: "Cape Cod",
  southShore: "South Shore (60 mi)",
  southernNE: "Southern New England (60-100 mi)",
  "ne100+": "New England >100 mi",
  island: "Islands (MV/Nantucket)",
  outOfRegion: "Outside New England"
};
