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

// SECURITY: Actual pricing is calculated server-side via /api/quote/calculate
// These values are placeholders for UI display only
export const PRICING_CONSTANTS = {
  HOURLY_RATE: 0, // Actual rate is server-side
  TRAVEL_ZONES: [0, 0, 0],
  CABLING_PER_DROP: 0,
  TRAINING_RATE: 0,
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
  { name: 'Local Networking', path: '/local-networking' },
  { name: 'About', path: '/about' },
  { name: 'Quote Builder', path: '/quote' },
  { name: 'Menu Builder', path: '/menu-builder' },
  { name: 'Schedule', path: '/schedule' },
  { name: 'Contact', path: '/contact' },
];

// ============================================
// ADVANCED QUOTE BUILDER CONSTANTS
// ============================================

// SECURITY: Actual rates are calculated server-side via /api/quote/calculate
// These are placeholder values - real pricing is protected server-side
export const DEFAULT_RATES: Rates = {
  hourly: 0 // Actual rate is server-side only
};

// SECURITY: Travel rates are calculated server-side
export const DEFAULT_TRAVEL: TravelRates = {
  capeCod: 0,
  southShore: 0,
  southernNE: 0,
  newEngland100Plus: 0,
  islandBase: 0,
  islandVehicle: 0,
  islandLodging: 0,
  outOfRegionBase: 0
};

// SECURITY: TTI values are calculated server-side only
// This catalog is for UI display purposes - actual labor times are protected
export const HARDWARE_CATALOG: HardwareItem[] = [
  { id: "toast-flex", name: "Toast Flex Terminal", category: "POS", ttiMin: 0 },
  { id: "toast-flex-guest", name: "Guest Display (Flex)", category: "POS", ttiMin: 0 },
  { id: "toast-go2", name: "Toast Go 2 (Handheld)", category: "POS", ttiMin: 0 },
  { id: "toast-kds", name: "Kitchen Display (KDS)", category: "KDS", ttiMin: 0 },
  { id: "receipt-printer", name: "Thermal Receipt Printer", category: "Printers", ttiMin: 0 },
  { id: "impact-printer", name: "Kitchen Impact Printer", category: "Printers", ttiMin: 0 },
  { id: "label-printer", name: "Label Printer", category: "Printers", ttiMin: 0 },
  { id: "poe-switch", name: "Ethernet Switch (PoE)", category: "Network", ttiMin: 0 },
  { id: "ap", name: "Wi-Fi Access Point", category: "Network", ttiMin: 0 },
  { id: "router", name: "Toast Router / Hub", category: "Network", ttiMin: 0 },
  { id: "card-reader-direct", name: "Card Reader (Toast Direct Attach)", category: "Card", ttiMin: 0 },
  { id: "card-reader-guest", name: "Card Reader (Toast Guest Pay)", category: "Card", ttiMin: 0 },
  { id: "card-reader-employee", name: "Card Reader (Swipe to Pay - Employee)", category: "Card", ttiMin: 0 },
  { id: "ups", name: "UPS Battery Backup", category: "Power", ttiMin: 0 },
  { id: "cash-drawer", name: "Cash Drawer", category: "Accessories", ttiMin: 0 },
  { id: "barcode", name: "Barcode Scanner", category: "Retail", ttiMin: 0 },
  { id: "scale", name: "By-Weight Scale", category: "Retail", ttiMin: 0 },
  { id: "charging-dock", name: "Charging Dock", category: "Accessories", ttiMin: 0 },
  { id: "stand", name: "Tablet Stand", category: "Accessories", ttiMin: 0 },
  { id: "toast-tap", name: "Toast Tap (Payment Device)", category: "Card", ttiMin: 0 }
];

// SECURITY: Integration TTI values are calculated server-side only
export const INTEGRATIONS: IntegrationItem[] = [
  { id: "toast-payroll", name: "Toast Payroll & Team Mgmt", ttiMin: 0 },
  { id: "xtrachef", name: "xtraCHEF by Toast", ttiMin: 0 },
  { id: "loyalty", name: "Toast Loyalty", ttiMin: 0 },
  { id: "gift-cards", name: "Gift Cards", ttiMin: 0 },
  { id: "online-ordering", name: "Online Ordering", ttiMin: 0 },
  { id: "delivery-services", name: "Toast Delivery Services", ttiMin: 0 },
  { id: "3p-delivery", name: "3rd-Party Delivery (Uber/DoorDash/Grubhub)", ttiMin: 0 },
  { id: "opentable", name: "OpenTable", ttiMin: 0 },
  { id: "tables", name: "Toast Tables (Reservations)", ttiMin: 0 },
  { id: "email-mktg", name: "Email Marketing", ttiMin: 0 },
  { id: "7shifts", name: "7shifts Scheduling", ttiMin: 0 }
];

// SECURITY: Station template TTI values are calculated server-side only
// ttiMin values here are for display purposes only (placeholders)
export const STATION_TEMPLATES: StationTemplate[] = [
  {
    id: "tmpl-server",
    label: "Server Station",
    ttiMin: 0,
    items: ["toast-flex", "receipt-printer", "card-reader-direct"],
    color: "#38bdf8"
  },
  {
    id: "tmpl-bar-plus",
    label: "Bar Station Plus Service",
    ttiMin: 0,
    items: ["toast-flex", "receipt-printer", "card-reader-direct", "cash-drawer", "impact-printer"],
    color: "#22d3ee"
  },
  {
    id: "tmpl-bar",
    label: "Bar Station",
    ttiMin: 0,
    items: ["toast-flex", "receipt-printer", "card-reader-direct", "cash-drawer"],
    color: "#0ea5e9"
  },
  {
    id: "tmpl-host",
    label: "Host Stand",
    ttiMin: 0,
    items: ["toast-flex", "receipt-printer", "card-reader-direct", "cash-drawer"],
    color: "#a3e635"
  },
  {
    id: "tmpl-full-kitchen",
    label: "Full Kitchen",
    ttiMin: 0,
    items: ["toast-kds", "impact-printer"],
    color: "#fbbf24"
  },
  {
    id: "tmpl-takeout",
    label: "Takeout Station",
    ttiMin: 0,
    items: ["toast-flex", "receipt-printer", "card-reader-guest", "card-reader-employee", "cash-drawer", "toast-flex-guest"],
    color: "#f472b6"
  },
  {
    id: "tmpl-retail",
    label: "Retail Terminal",
    ttiMin: 0,
    items: ["receipt-printer", "card-reader-guest", "card-reader-employee", "cash-drawer", "toast-flex-guest"],
    color: "#34d399"
  },
  {
    id: "tmpl-retail-weighed",
    label: "Weighed Retail Terminal",
    ttiMin: 0,
    items: ["receipt-printer", "card-reader-guest", "card-reader-employee", "cash-drawer", "toast-flex-guest", "scale"],
    color: "#10b981"
  },
  {
    id: "tmpl-retail-full",
    label: "Full Retail Terminal",
    ttiMin: 0,
    items: ["receipt-printer", "card-reader-guest", "card-reader-employee", "cash-drawer", "toast-flex-guest", "barcode", "scale"],
    color: "#059669"
  },
  {
    id: "tmpl-kds",
    label: "Kitchen KDS",
    ttiMin: 0,
    items: ["toast-kds"],
    color: "#f59e0b"
  },
  {
    id: "tmpl-bar-service",
    label: "Bar Service Station",
    ttiMin: 0,
    items: ["impact-printer"],
    color: "#22c55e"
  },
  {
    id: "tmpl-barista",
    label: "Barista Station",
    ttiMin: 0,
    items: ["toast-flex", "receipt-printer", "card-reader-guest", "card-reader-employee", "cash-drawer", "toast-flex-guest", "label-printer"],
    color: "#8b5cf6"
  },
  {
    id: "tmpl-expo",
    label: "Expo Station",
    ttiMin: 0,
    items: ["toast-kds", "impact-printer"],
    color: "#f59e0b"
  },
  {
    id: "tmpl-network",
    label: "Networking Area",
    ttiMin: 0,
    items: ["router", "poe-switch"],
    color: "#14b8a6"
  },
  {
    id: "tmpl-ap",
    label: "Access Point",
    ttiMin: 0,
    items: ["ap"],
    color: "#06b6d4"
  },
  {
    id: "tmpl-switch",
    label: "Ethernet Switch",
    ttiMin: 0,
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
  // Seating
  { type: "Round Table (2)", w: 48, h: 48, color: "#6b7280" },
  { type: "Round Table (4)", w: 64, h: 64, color: "#6b7280" },
  { type: "Square Table", w: 64, h: 64, color: "#6b7280" },
  { type: "Rect Table (4)", w: 96, h: 64, color: "#6b7280" },
  { type: "Rect Table (6)", w: 128, h: 64, color: "#6b7280" },
  { type: "Booth", w: 96, h: 48, color: "#78716c" },
  { type: "High Top", w: 48, h: 48, color: "#71717a" },
  { type: "Patio Table", w: 80, h: 80, color: "#92400e" },
  // Bar/Service
  { type: "Bar Counter", w: 220, h: 44, color: "#4b5563" },
  { type: "Bar Stool", w: 24, h: 24, color: "#737373" },
  { type: "Wait Station", w: 48, h: 36, color: "#525252" },
  { type: "Bus Station", w: 48, h: 36, color: "#525252" },
  // Front Desk
  { type: "Host Stand", w: 60, h: 40, color: "#6b7280" },
  { type: "Cashier", w: 72, h: 36, color: "#6b7280" },
  { type: "Service Window", w: 120, h: 12, color: "#eab308" },
  { type: "Phone", w: 24, h: 24, color: "#94a3b8" }
];

// BOH Objects (back of house)
export const BOH_OBJECTS: ObjectDefinition[] = [
  // Prep & Storage
  { type: "Prep Table", w: 120, h: 50, color: "#7c3aed" },
  { type: "Cutting Board", w: 48, h: 32, color: "#a78bfa" },
  { type: "Sheet Rack", w: 32, h: 48, color: "#a1a1aa" },
  { type: "Dry Storage", w: 96, h: 48, color: "#78716c" },
  { type: "Shelf Unit", w: 72, h: 24, color: "#a8a29e" },
  // Refrigeration
  { type: "Walk-in Cooler", w: 160, h: 120, color: "#0ea5e9" },
  { type: "Walk-in Freezer", w: 120, h: 100, color: "#38bdf8" },
  { type: "Reach-in Fridge", w: 48, h: 32, color: "#22c55e" },
  { type: "Reach-in Freezer", w: 48, h: 32, color: "#3b82f6" },
  { type: "Prep Cooler", w: 72, h: 36, color: "#10b981" },
  // Cooking Equipment
  { type: "Oven", w: 60, h: 60, color: "#f97316" },
  { type: "Range", w: 96, h: 48, color: "#ea580c" },
  { type: "Flat Top", w: 72, h: 36, color: "#dc2626" },
  { type: "Charbroiler", w: 72, h: 36, color: "#ef4444" },
  { type: "Fryer Bank", w: 72, h: 48, color: "#f59e0b" },
  { type: "Steam Table", w: 96, h: 36, color: "#eab308" },
  { type: "Salamander", w: 36, h: 24, color: "#f97316" },
  { type: "Pizza Oven", w: 72, h: 72, color: "#dc2626" },
  // Wash/Utility
  { type: "3-Comp Sink", w: 96, h: 36, color: "#06b6d4" },
  { type: "Hand Sink", w: 24, h: 24, color: "#22d3ee" },
  { type: "Mop Sink", w: 36, h: 36, color: "#67e8f9" },
  { type: "Dishwasher", w: 48, h: 48, color: "#14b8a6" },
  { type: "Dish Table", w: 72, h: 36, color: "#5eead4" },
  // Other
  { type: "Ice Machine", w: 36, h: 36, color: "#a5f3fc" },
  { type: "Expo Line", w: 180, h: 24, color: "#fbbf24" },
  { type: "Pass Window", w: 120, h: 12, color: "#f59e0b" }
];

// Structure Objects
export const STRUCTURE_OBJECTS: ObjectDefinition[] = [
  // Walls
  { type: "Wall (H)", w: 220, h: 10, color: "#1f2937" },
  { type: "Wall (V)", w: 10, h: 160, color: "#1f2937" },
  { type: "Half Wall", w: 120, h: 8, color: "#374151" },
  { type: "Partition", w: 80, h: 6, color: "#4b5563" },
  // Doors/Windows
  { type: "Entry Door", w: 40, h: 6, color: "#94a3b8" },
  { type: "Exit Door", w: 40, h: 6, color: "#ef4444" },
  { type: "Double Door", w: 64, h: 6, color: "#94a3b8" },
  { type: "Kitchen Door", w: 36, h: 6, color: "#fbbf24" },
  { type: "Window", w: 60, h: 4, color: "#67e8f9" },
  // Special
  { type: "Stairs", w: 48, h: 72, color: "#6b7280" },
  { type: "Elevator", w: 48, h: 48, color: "#9ca3af" },
  { type: "Restroom", w: 80, h: 64, color: "#a78bfa" },
  { type: "Office", w: 96, h: 80, color: "#6366f1" },
  { type: "Storage", w: 72, h: 56, color: "#78716c" }
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

// Service mode labels and configuration
export const SERVICE_MODE_LABELS: Record<string, { label: string; description: string; icon: string }> = {
  onsite: { label: "On-Site", description: "Full on-site installation and support", icon: "Building2" },
  hybrid: { label: "Hybrid", description: "Remote configuration + on-site installation", icon: "Globe" },
  remote: { label: "Remote Only", description: "Fully remote setup and support", icon: "Wifi" }
};

// Recommended service mode by travel zone
// Cape Cod = on-site (local), distant zones = remote recommended
export const ZONE_RECOMMENDED_MODE: Record<string, 'onsite' | 'hybrid' | 'remote'> = {
  cape: "onsite",
  southShore: "hybrid",
  southernNE: "hybrid",
  "ne100+": "remote",
  island: "hybrid", // Islands can be on-site but need discussion
  outOfRegion: "remote"
};

// Zones that require travel discussion if on-site is selected
export const ZONES_REQUIRING_TRAVEL_DISCUSSION: string[] = [
  "ne100+",
  "island",
  "outOfRegion"
];

// Go-Live Support Options
// SECURITY: Actual pricing is calculated server-side via /api/quote/calculate
// These are placeholder values for UI display - real pricing is protected server-side
export interface GoLiveSupportOption {
  days: number;
  label: string;
  description: string;
  price: number; // Placeholder for UI - actual pricing server-side
}

export const GO_LIVE_SUPPORT_OPTIONS: GoLiveSupportOption[] = [
  { days: 1, label: "1 Day", description: "Opening day support (8 hours)", price: 0 },
  { days: 2, label: "2 Days", description: "Opening weekend coverage", price: 0 },
  { days: 3, label: "3 Days", description: "Extended opening support", price: 0 },
  { days: 5, label: "5 Days", description: "Full work week coverage", price: 0 },
  { days: 7, label: "7 Days", description: "Complete opening week support", price: 0 }
];
