/**
 * Client Intelligence System Types
 * Full type definitions for the Client Intelligence platform
 */

export type Region = "Upper Cape" | "Mid Cape" | "Lower Cape" | "Outer Cape" | "National";

export type PosSystem = "Toast" | "Square" | "Aloha" | "Micros" | "Clover" | "Lightspeed" | "Upserve" | "Unknown";

export type FactStatus = 'pending' | 'approved' | 'rejected';

export type LicenseType = "Common Victualler" | "Liquor (Full)" | "Liquor (Beer/Wine)" | "Seasonal" | "Unknown";

export type OnlineOrderingPlatform = "Toast" | "Grubhub" | "UberEats" | "DoorDash" | "Direct" | "None";

export interface HistoryRecord {
  period: string;
  name: string;
  notes: string;
}

export interface AtomicFact {
  id: string;
  clientId: string;
  field: string;
  value: any;
  originalText: string;
  confidence: number;
  status: FactStatus;
  source?: string;
  aiProviderId?: string;
  createdAt?: number;
}

export interface ClientSocials {
  instagram?: string;
  facebook?: string;
  twitter?: string;
  linkedin?: string;
  yelp?: string;
}

export interface Client {
  id: string;
  name: string;
  company?: string;
  town?: string;
  region?: Region;
  type?: string;
  price?: 1 | 2 | 3 | 4;
  rating?: number;
  seasonal?: boolean;
  desc?: string;

  // Business Intelligence Fields
  address?: string;
  phone?: string;
  email?: string;
  licenseNumber?: string;
  licenseType?: LicenseType;
  seatingCapacity?: number;
  healthScore?: number;
  lastInspectionDate?: string;
  employeeCount?: number;
  annualRevenue?: string;

  // Tech Stack
  posSystem?: PosSystem;
  onlineOrdering?: OnlineOrderingPlatform;
  reservationSystem?: string;
  paymentProcessor?: string;

  // Digital Presence
  website?: string;
  socials?: ClientSocials;

  // Location History / Genealogy
  locationHistory?: HistoryRecord[];

  // Pending facts for this client
  pendingFacts?: AtomicFact[];

  // Metadata
  createdAt?: number;
  updatedAt?: number;
  status?: string;
}

export interface AIProvider {
  id: string;
  name: string;
  providerType: 'openai' | 'anthropic' | 'google' | 'cloudflare' | 'custom';
  modelId: string;
  apiEndpoint?: string;
  maxTokens?: number;
  temperature?: number;
  isActive: boolean;
  isDefault: boolean;
  systemPrompt?: string;
  supportsVision?: boolean;
  supportsFunctionCalling?: boolean;
  contextWindow?: number;
  costPer1kInput?: number;
  costPer1kOutput?: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface ResearchSession {
  id: string;
  title: string;
  clientId: string;
  clientName?: string;
  targetType: 'client' | 'market' | 'competitor';
  researchType: 'discovery' | 'enrichment' | 'verification' | 'competitive';
  query?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  factsFound?: number;
  aiProviderId?: string;
  aiProviderName?: string;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

export interface FileImport {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  factsExtracted?: number;
  processedAt?: number;
  error?: string;
}

export interface SyncStep {
  message: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

export interface FilterState {
  town: string;
  category: string;
  region: string;
  posSystem: string;
  seasonalOnly: boolean;
  searchQuery: string;
}

// POS System URLs for reference
export const POS_URLS: Record<PosSystem, string> = {
  "Toast": "https://pos.toasttab.com/",
  "Square": "https://squareup.com/us/en/point-of-sale/restaurants",
  "Aloha": "https://www.ncrvoyix.com/restaurants/aloha-pos",
  "Micros": "https://www.oracle.com/industries/food-beverage/restaurant-pos-systems/",
  "Clover": "https://www.clover.com/",
  "Lightspeed": "https://www.lightspeedhq.com/pos/restaurant/",
  "Upserve": "https://www.lightspeedhq.com/upserve/",
  "Unknown": "#"
};

// Scheduled sync times (5 AM and 5 PM)
export const SYNC_TIMES = [5, 17];

// Chart color palettes
export const CHART_COLORS = {
  primary: ['#4A879E', '#2D5A6E', '#D97706', '#E2DBC6', '#1A2F45', '#9CA3AF', '#60A5FA', '#34D399'],
  regions: {
    'Outer Cape': '#60A5FA',
    'Lower Cape': '#2DD4BF',
    'Mid Cape': '#FB923C',
    'Upper Cape': '#818CF8',
    'National': '#A78BFA'
  } as Record<string, string>
};
