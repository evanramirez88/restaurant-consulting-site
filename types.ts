import { LucideIcon } from 'lucide-react';

export interface ServiceItem {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  link: string;
}

export interface Testimonial {
  id: string;
  quote: string;
  author: string;
  role: string;
  restaurant: string;
}

// Legacy station types (kept for compatibility)
export enum StationType {
  EXPO = 'Expo (KDS)',
  SERVER = 'Server Station',
  BAR = 'Bartender Station',
  TAKEOUT = 'Take-Out Station',
  MANAGER = 'Manager Station'
}

export interface StationConfig {
  type: StationType;
  baseCost: number;
  complexityScore: number;
  hardware: string[];
}

export interface PlacedStation {
  id: string;
  type: StationType;
  x: number;
  y: number;
}

export interface QuoteState {
  stations: PlacedStation[];
  travelZone: number;
  cablingNeeded: boolean;
  trainingHours: number;
}

// ============================================
// ADVANCED QUOTE BUILDER TYPES
// ============================================

export interface HardwareItem {
  id: string;
  name: string;
  category: 'POS' | 'KDS' | 'Printers' | 'Network' | 'Card' | 'Power' | 'Accessories' | 'Retail';
  ttiMin: number; // Time-to-install in minutes
}

export interface IntegrationItem {
  id: string;
  name: string;
  ttiMin: number;
}

export interface StationTemplate {
  id: string;
  label: string;
  ttiMin: number;
  items: string[]; // Hardware IDs
  color: string;
}

export interface HardwareFlags {
  existing: boolean;
  replace: boolean;
}

export interface HardwareAssociation {
  hid: string; // Hardware ID reference
  nickname: string;
  notes: string;
  flags: HardwareFlags;
}

export interface StationFlags {
  existing: boolean;
  replace: boolean;
}

export interface AdvancedStation {
  id: string;
  name: string;
  type: string;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
  nickname: string;
  notes: string;
  dept: string;
  flags: StationFlags;
  hardware: HardwareAssociation[];
}

export interface FloorObject {
  id: string;
  kind: 'object';
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  rot: number;
}

export interface FloorLabel {
  id: string;
  kind: 'label';
  text: string;
  x: number;
  y: number;
  rot: number;
}

export interface CableRun {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  lengthFt: number;
  ttiMin: number;
}

export interface FloorLayer {
  id: string;
  name: string;
  type: 'base' | 'network' | 'generic';
  visible: boolean;
  cableRuns: CableRun[];
}

export interface Floor {
  id: string;
  name: string;
  stations: AdvancedStation[];
  objects: FloorObject[];
  labels: FloorLabel[];
  layers: FloorLayer[];
  scalePxPerFt: number;
}

export interface TravelSettings {
  zone: 'cape' | 'southShore' | 'southernNE' | 'ne100+' | 'island' | 'outOfRegion';
  islandVehicle: boolean;
  lodging: boolean;
  remote: boolean;
}

export interface Location {
  id: string;
  name: string;
  address: string;
  travel: TravelSettings;
  subscriptionPct: number;
  integrationIds: string[];
  floors: Floor[];
}

export interface TravelRates {
  capeCod: number;
  southShore: number;
  southernNE: number;
  newEngland100Plus: number;
  islandBase: number;
  islandVehicle: number;
  islandLodging: number;
  outOfRegionBase: number;
}

export interface Rates {
  hourly: number;
}

export interface EstimateItem {
  type: 'hardware' | 'overhead' | 'integration' | 'cabling';
  label: string;
  minutes: number;
  dollars: number;
}

export interface EstimateResult {
  items: EstimateItem[];
  mins: {
    hardware: number;
    overhead: number;
    integrations: number;
    cabling: number;
  };
  totalMin: number;
  installCost: number;
  travelCost: number;
  supportMonthly: number;
  supportAnnual: number;
  combinedFirst: number;
}

export interface ObjectDefinition {
  type: string;
  w: number;
  h: number;
  color: string;
}

export type SupportPeriod = 'monthly' | 'annual';

export interface Selection {
  kind: 'station' | 'object' | 'label' | null;
  id: string | null;
}

// ============================================
// QUOTE BUILDER PDF IMPORT TYPES
// ============================================

/**
 * Hardware item extracted from Toast PDF via OCR
 */
export interface ExtractedHardware {
  id: string;
  productName: string;
  quantity: number;
  mappedHardwareIds: string[];  // Maps to HARDWARE_CATALOG ids
  confidence: number;           // OCR confidence score (0-1)
}

/**
 * Status of a PDF import job
 */
export type ImportStatus = 'idle' | 'uploading' | 'processing' | 'complete' | 'error';

/**
 * Response from the import-status API
 */
export interface ImportStatusResponse {
  success: boolean;
  jobId: string;
  status: 'uploaded' | 'processing' | 'completed' | 'failed';
  fileName?: string;
  extractedItems: ExtractedHardware[];
  itemCount: number;
  error?: string;
  timing?: {
    createdAt: number;
    processingStartedAt: number | null;
    processingCompletedAt: number | null;
  };
}
