/**
 * P-P-P (Problem-Pain-Priority) Prospect Research Types
 * 
 * Framework for evaluating prospect readiness:
 * - Problem: What problem does this prospect have?
 * - Pain: How severe is their pain (scale/symptoms)?
 * - Priority: How urgent is solving it for them?
 */

export interface PPPScores {
  problem: number | null;    // 1-10 scale
  pain: number | null;       // 1-10 scale
  priority: number | null;   // 1-10 scale
  composite: number | null;  // Calculated: (problem + pain + priority) / 3 * 10
}

export interface ResearchNotes {
  problemDescription: string | null;   // Detailed problem identification
  painSymptoms: string | null;         // Observable pain symptoms
  prioritySignals: string | null;      // Urgency indicators
  generalNotes: string | null;         // Free-form research notes
  webData: WebResearchData | null;     // Scraped/enriched data
}

export interface WebResearchData {
  website?: WebsiteResearch;
  googlePlaces?: GooglePlacesResearch;
  social?: SocialMediaResearch;
  news?: NewsResearch[];
  lastUpdated?: number;
}

export interface WebsiteResearch {
  url: string;
  title?: string;
  description?: string;
  techStack?: string[];
  hasOnlineOrdering?: boolean;
  hasReservations?: boolean;
  menuUrl?: string;
  lastScraped?: number;
}

export interface GooglePlacesResearch {
  placeId?: string;
  rating?: number;
  reviewCount?: number;
  priceLevel?: number;
  openingHours?: string[];
  recentReviews?: ReviewSummary[];
}

export interface SocialMediaResearch {
  facebook?: SocialProfile;
  instagram?: SocialProfile;
  twitter?: SocialProfile;
}

export interface SocialProfile {
  url: string;
  followers?: number;
  lastPost?: string;
  engagement?: string;
}

export interface NewsResearch {
  title: string;
  url: string;
  source: string;
  date: string;
  snippet: string;
}

export interface ReviewSummary {
  rating: number;
  text: string;
  date: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

export interface PPPProspect {
  id: string;
  
  // Basic identity
  name: string;
  dbaName?: string;
  domain?: string;
  
  // Location
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  region?: string;
  
  // Contact
  email?: string;
  phone?: string;
  website?: string;
  
  // Classification
  cuisine?: string;
  serviceStyle?: string;
  posSystem?: string;
  posConfidence?: number;
  
  // Lead status
  status: string;
  leadScore?: number;
  segment?: string;
  
  // P-P-P Scores
  ppp: PPPScores;
  
  // Research notes
  research: ResearchNotes;
  
  // Timestamps
  pppLastScoredAt?: number;
  pppScoredBy?: string;
  researchLastUpdatedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface PPPScoreFormData {
  problemScore: number;
  painScore: number;
  priorityScore: number;
  problemDescription?: string;
  painSymptoms?: string;
  prioritySignals?: string;
}

export interface ResearchLogEntry {
  id: string;
  leadId: string;
  activityType: 'ppp_scored' | 'note_added' | 'web_research' | 'status_change';
  problemScore?: number;
  painScore?: number;
  priorityScore?: number;
  compositeScore?: number;
  notes?: string;
  performedBy?: string;
  createdAt: number;
}

// API Response types
export interface PPPProspectListResponse {
  success: boolean;
  data: PPPProspect[];
  total: number;
  scored: number;
  unscored: number;
  avgComposite: number;
}

export interface PPPUpdateResponse {
  success: boolean;
  data?: PPPProspect;
  error?: string;
}

// Filter/Sort options
export type PPPSortField = 'composite' | 'problem' | 'pain' | 'priority' | 'leadScore' | 'updated';
export type PPPSortOrder = 'asc' | 'desc';

export interface PPPFilters {
  search?: string;
  status?: string;
  region?: string;
  posSystem?: string;
  minComposite?: number;
  maxComposite?: number;
  scoredOnly?: boolean;
  unscoredOnly?: boolean;
}

// Problem categories for structured input
export const PROBLEM_CATEGORIES = [
  { id: 'pos_outdated', label: 'Outdated POS System', weight: 8 },
  { id: 'pos_expensive', label: 'High POS Costs', weight: 7 },
  { id: 'pos_limited', label: 'Limited POS Features', weight: 6 },
  { id: 'training_issues', label: 'Staff Training Problems', weight: 5 },
  { id: 'support_poor', label: 'Poor Support Experience', weight: 7 },
  { id: 'integration_gaps', label: 'Missing Integrations', weight: 6 },
  { id: 'reporting_weak', label: 'Weak Reporting/Analytics', weight: 5 },
  { id: 'hardware_failing', label: 'Hardware Issues', weight: 8 },
  { id: 'online_ordering_missing', label: 'No Online Ordering', weight: 6 },
  { id: 'scaling_blocked', label: 'Growth Limitations', weight: 7 },
] as const;

// Pain severity indicators
export const PAIN_INDICATORS = [
  { id: 'losing_money', label: 'Actively Losing Money', severity: 10 },
  { id: 'losing_customers', label: 'Losing Customers', severity: 9 },
  { id: 'staff_frustrated', label: 'Staff Frustrated/Quitting', severity: 8 },
  { id: 'daily_workarounds', label: 'Daily Manual Workarounds', severity: 7 },
  { id: 'frequent_downtime', label: 'Frequent System Downtime', severity: 9 },
  { id: 'compliance_risk', label: 'Compliance/Security Risk', severity: 8 },
  { id: 'seasonal_pressure', label: 'Seasonal Pressure', severity: 6 },
  { id: 'expansion_blocked', label: 'Can\'t Expand', severity: 7 },
  { id: 'poor_reviews', label: 'Bad Reviews (Tech-Related)', severity: 6 },
  { id: 'owner_exhausted', label: 'Owner Burnout', severity: 8 },
] as const;

// Priority signals (urgency indicators)
export const PRIORITY_SIGNALS = [
  { id: 'contract_ending', label: 'Contract Ending Soon', urgency: 10 },
  { id: 'season_approaching', label: 'Busy Season Coming', urgency: 9 },
  { id: 'renovation_planned', label: 'Renovation/Remodel', urgency: 8 },
  { id: 'new_location', label: 'Opening New Location', urgency: 9 },
  { id: 'ownership_change', label: 'New Ownership', urgency: 8 },
  { id: 'competitor_switched', label: 'Competitor Just Switched', urgency: 7 },
  { id: 'funding_available', label: 'Budget Available', urgency: 8 },
  { id: 'actively_shopping', label: 'Actively Shopping', urgency: 10 },
  { id: 'referral_warm', label: 'Warm Referral', urgency: 7 },
  { id: 'event_driven', label: 'Event/Deadline Driven', urgency: 9 },
] as const;
