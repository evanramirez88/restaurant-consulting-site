/**
 * Comprehensive Profiling System Types
 * Types for prospect/contact profiling, enrichment, research, and P-P-P scoring
 */

// =====================================================
// PROSPECT PROFILES
// =====================================================

export type IndustrySegment = 
  | 'fine_dining' 
  | 'casual_dining' 
  | 'fast_casual' 
  | 'quick_service'
  | 'bar_nightclub' 
  | 'cafe_bakery' 
  | 'food_truck' 
  | 'catering'
  | 'ghost_kitchen' 
  | 'hotel_restaurant' 
  | 'country_club' 
  | 'other';

export type BusinessModel = 
  | 'owner_operated' 
  | 'management_group' 
  | 'franchise' 
  | 'corporate_owned';

export type POSSatisfaction = 
  | 'very_satisfied' 
  | 'satisfied' 
  | 'neutral' 
  | 'dissatisfied' 
  | 'very_dissatisfied' 
  | 'unknown';

export type SeasonalPattern = 'year_round' | 'seasonal' | 'event_based' | 'unknown';

export type MenuComplexity = 'simple' | 'moderate' | 'complex' | 'very_complex';

export type FundingStage = 
  | 'bootstrapped' 
  | 'seed' 
  | 'series_a' 
  | 'series_b_plus' 
  | 'private_equity' 
  | 'public' 
  | 'unknown';

export type GrowthTrajectory = 'declining' | 'stable' | 'growing' | 'rapid_growth' | 'unknown';

export type ReviewSentiment = 
  | 'very_positive' 
  | 'positive' 
  | 'mixed' 
  | 'negative' 
  | 'very_negative';

export type ConfidenceLevel = 'exact' | 'estimated' | 'range';

export interface TechStack {
  online_ordering?: string;
  reservations?: string;
  accounting?: string;
  payroll?: string;
  inventory?: string;
  loyalty?: string;
  marketing?: string;
  analytics?: string;
  [key: string]: string | undefined;
}

export interface SocialProfiles {
  instagram?: string;
  facebook?: string;
  twitter?: string;
  linkedin?: string;
  tiktok?: string;
  youtube?: string;
  [key: string]: string | undefined;
}

export interface ProspectProfile {
  id: string;
  organizationId: string;
  
  // Business Classification
  industrySegment?: IndustrySegment;
  businessModel?: BusinessModel;
  
  // Size & Scale
  employeeCountMin?: number;
  employeeCountMax?: number;
  employeeCountConfidence?: ConfidenceLevel;
  locationCount?: number;
  annualRevenueMin?: number;
  annualRevenueMax?: number;
  revenueConfidence?: ConfidenceLevel;
  revenueSource?: string;
  
  // Technology Stack
  currentPos?: string;
  posContractEndDate?: number;
  posSatisfaction?: POSSatisfaction;
  posPainPoints?: string[];
  techStack?: TechStack;
  websitePlatform?: string;
  usesThirdPartyDelivery?: boolean;
  hasLoyaltyProgram?: boolean;
  hasGiftCards?: boolean;
  hasOnlineOrdering?: boolean;
  integrations?: Record<string, string>;
  integrationPainPoints?: string;
  
  // Operational Intelligence
  hoursOfOperation?: Record<string, string>;
  peakHours?: string[];
  seasonalPattern?: SeasonalPattern;
  seasonalNotes?: string;
  
  // Menu & Pricing
  avgCheckSizeMin?: number;
  avgCheckSizeMax?: number;
  menuItemCount?: number;
  menuComplexity?: MenuComplexity;
  priceTier?: 1 | 2 | 3 | 4;
  
  // Financial Health
  fundingStage?: FundingStage;
  knownInvestors?: string[];
  recentFundingAmount?: number;
  recentFundingDate?: number;
  isProfitable?: boolean | null;
  growthTrajectory?: GrowthTrajectory;
  
  // Digital Presence
  websiteUrl?: string;
  websiteLastUpdated?: number;
  websiteTech?: Record<string, string>;
  socialProfiles?: SocialProfiles;
  socialFollowerCountTotal?: number;
  socialEngagementRate?: number;
  
  // Reviews
  googleRating?: number;
  googleReviewCount?: number;
  yelpRating?: number;
  yelpReviewCount?: number;
  tripadvisorRating?: number;
  tripadvisorReviewCount?: number;
  avgReviewScore?: number;
  reviewSentiment?: ReviewSentiment;
  
  // Buying Signals
  recentTechChanges?: string[];
  jobPostings?: Array<{ title: string; url?: string; date?: string }>;
  expansionSignals?: Record<string, any>;
  painSignals?: Record<string, any>;
  
  // Competitive
  knownCompetitors?: string[];
  competitivePosition?: string;
  marketShareEstimate?: number;
  
  // Quality
  profileCompleteness?: number;
  dataFreshnessScore?: number;
  lastEnrichedAt?: number;
  enrichmentSources?: string[];
  
  createdAt?: number;
  updatedAt?: number;
}

// =====================================================
// CONTACT PROFILES
// =====================================================

export type SeniorityLevel = 'entry' | 'mid' | 'senior' | 'director' | 'vp' | 'c_level' | 'owner';

export type Department = 
  | 'operations' 
  | 'finance' 
  | 'marketing' 
  | 'it' 
  | 'hr' 
  | 'executive' 
  | 'culinary' 
  | 'other';

export type BuyingRole = 
  | 'economic_buyer'
  | 'technical_buyer'
  | 'user_buyer'
  | 'coach'
  | 'influencer'
  | 'gatekeeper'
  | 'unknown';

export type PreferredContactMethod = 'email' | 'phone' | 'text' | 'linkedin' | 'in_person';

export type CommunicationStyle = 'formal' | 'casual' | 'direct' | 'detailed' | 'unknown';

export type ResponseSpeed = 'immediate' | 'same_day' | 'few_days' | 'slow' | 'unknown';

export type RapportLevel = 'none' | 'cold' | 'warm' | 'strong' | 'advocate';

export type Sentiment = 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative' | 'unknown';

export interface WorkHistoryEntry {
  company: string;
  title: string;
  years?: string;
  startDate?: string;
  endDate?: string;
}

export interface EducationEntry {
  school: string;
  degree?: string;
  year?: string;
  field?: string;
}

export interface SentimentHistoryEntry {
  date: string;
  sentiment: Sentiment;
  reason?: string;
}

export interface VendorRelationship {
  vendor: string;
  relationship: string;
  sentiment?: Sentiment;
}

export interface ContactProfile {
  id: string;
  contactId: string;
  organizationId?: string;
  
  // Professional Identity
  linkedinUrl?: string;
  linkedinId?: string;
  linkedinConnections?: number;
  linkedinHeadline?: string;
  linkedinSummary?: string;
  
  // Career Info
  currentTitle?: string;
  seniorityLevel?: SeniorityLevel;
  department?: Department;
  yearsInRole?: number;
  yearsAtCompany?: number;
  yearsInIndustry?: number;
  workHistory?: WorkHistoryEntry[];
  education?: EducationEntry[];
  certifications?: string[];
  
  // Social Profiles
  twitterHandle?: string;
  twitterFollowers?: number;
  facebookUrl?: string;
  instagramHandle?: string;
  otherSocials?: Record<string, string>;
  
  // Communication Preferences
  preferredContactMethod?: PreferredContactMethod;
  bestTimeToContact?: string;
  communicationStyle?: CommunicationStyle;
  responseSpeed?: ResponseSpeed;
  
  // Engagement History
  firstContactDate?: number;
  lastContactDate?: number;
  totalTouchpoints?: number;
  emailsSent?: number;
  emailsOpened?: number;
  emailsClicked?: number;
  emailsReplied?: number;
  emailOpenRate?: number;
  avgReplyTimeHours?: number;
  meetingsScheduled?: number;
  meetingsAttended?: number;
  meetingsCancelled?: number;
  noShows?: number;
  callsAttempted?: number;
  callsConnected?: number;
  avgCallDurationMinutes?: number;
  
  // Decision-Making Profile
  isDecisionMaker?: boolean;
  isInfluencer?: boolean;
  isTechnicalEvaluator?: boolean;
  isEndUser?: boolean;
  isBudgetHolder?: boolean;
  isChampion?: boolean;
  isBlocker?: boolean;
  buyingRole?: BuyingRole;
  reportsTo?: string;
  directReports?: number;
  crossFunctionalInfluence?: string[];
  
  // Personality & Relationship
  personalityNotes?: string;
  interests?: string[];
  rapportLevel?: RapportLevel;
  relationshipOwner?: string;
  currentSentiment?: Sentiment;
  sentimentHistory?: SentimentHistoryEntry[];
  
  // Intelligence Notes
  painPoints?: string[];
  goals?: string[];
  objections?: string[];
  hotButtons?: string[];
  vendorRelationships?: VendorRelationship[];
  
  // Quality
  profileCompleteness?: number;
  lastEnrichedAt?: number;
  enrichmentSources?: string[];
  
  createdAt?: number;
  updatedAt?: number;
}

// =====================================================
// ENRICHMENT DATA
// =====================================================

export type EnrichmentEntityType = 
  | 'organization' 
  | 'location' 
  | 'contact' 
  | 'lead' 
  | 'prospect' 
  | 'competitor';

export type EnrichmentSourceType = 
  | 'web_scrape'
  | 'linkedin_profile'
  | 'linkedin_company'
  | 'google_places'
  | 'yelp_api'
  | 'tripadvisor'
  | 'facebook_page'
  | 'instagram_profile'
  | 'twitter_profile'
  | 'builtwith'
  | 'clearbit'
  | 'zoominfo'
  | 'apollo'
  | 'hunter_io'
  | 'whois'
  | 'press_release'
  | 'news_article'
  | 'job_posting'
  | 'sec_filing'
  | 'review_aggregation'
  | 'menu_scrape'
  | 'health_inspection'
  | 'liquor_license'
  | 'property_record'
  | 'manual_research'
  | 'other';

export type ProcessingStatus = 
  | 'raw'
  | 'parsed'
  | 'validated'
  | 'applied'
  | 'stale'
  | 'invalid';

export interface EnrichmentData {
  id: string;
  entityType: EnrichmentEntityType;
  entityId: string;
  
  // Source
  sourceType: EnrichmentSourceType;
  sourceUrl?: string;
  sourceName?: string;
  
  // Data
  rawData: Record<string, any>;
  extractedData?: Record<string, any>;
  
  // Quality
  dataQualityScore?: number;
  confidenceScore?: number;
  isVerified?: boolean;
  verifiedBy?: string;
  verifiedAt?: number;
  
  // Processing
  processingStatus: ProcessingStatus;
  appliedToProfile?: boolean;
  appliedAt?: number;
  
  // Freshness
  dataCapturedAt: number;
  dataAsOfDate?: number;
  expiresAt?: number;
  refreshPriority?: number;
  
  // Errors
  lastError?: string;
  errorCount?: number;
  
  // Metadata
  capturedBy?: string;
  tags?: string[];
  notes?: string;
  
  createdAt?: number;
  updatedAt?: number;
}

// =====================================================
// RESEARCH NOTES
// =====================================================

export type ResearchEntityType = 
  | 'organization' 
  | 'location' 
  | 'contact' 
  | 'lead' 
  | 'prospect'
  | 'competitor' 
  | 'territory' 
  | 'market_segment' 
  | 'general';

export type ResearchNoteType = 
  | 'observation'
  | 'insight'
  | 'hypothesis'
  | 'question'
  | 'finding'
  | 'warning'
  | 'opportunity'
  | 'relationship_map'
  | 'timeline'
  | 'competitive_intel'
  | 'market_intel'
  | 'technical_intel'
  | 'financial_intel'
  | 'other';

export type NoteConfidenceLevel = 'confirmed' | 'likely' | 'possible' | 'speculative' | 'unknown';

export type VerificationStatus = 'unverified' | 'verified' | 'disputed' | 'outdated';

export type NotePriority = 'low' | 'normal' | 'high' | 'critical';

export type NoteStatus = 'draft' | 'active' | 'archived' | 'superseded';

export type NoteVisibility = 'private' | 'internal' | 'team';

export type NoteAuthorType = 'agent' | 'admin' | 'rep' | 'system';

export interface KeyPoint {
  point: string;
  confidence?: number;
}

export interface Evidence {
  source: string;
  quote?: string;
  url?: string;
  date?: string;
}

export interface ActionItem {
  action: string;
  assignee?: string;
  due?: string;
  status?: string;
}

export interface NoteSource {
  type: string;
  url?: string;
  date?: string;
  name?: string;
}

export interface ResearchNote {
  id: string;
  entityType: ResearchEntityType;
  entityId?: string;
  
  // Classification
  noteType: ResearchNoteType;
  
  // Content
  title: string;
  content: string;
  summary?: string;
  
  // Structured Data
  keyPoints?: KeyPoint[];
  evidence?: Evidence[];
  actionItems?: ActionItem[];
  sources?: NoteSource[];
  primarySource?: string;
  
  // Quality
  confidenceLevel?: NoteConfidenceLevel;
  confidenceScore?: number;
  verificationStatus?: VerificationStatus;
  verifiedBy?: string;
  verifiedAt?: number;
  
  // Relevance
  priority?: NotePriority;
  relevanceScore?: number;
  impactAssessment?: string;
  
  // Time Sensitivity
  validFrom?: number;
  validUntil?: number;
  isTimeSensitive?: boolean;
  
  // Relationships
  relatedNotes?: string[];
  parentNoteId?: string;
  
  // Status
  status?: NoteStatus;
  supersededBy?: string;
  
  // Attribution
  authorType?: NoteAuthorType;
  authorId?: string;
  authorName?: string;
  
  // Visibility
  isConfidential?: boolean;
  visibility?: NoteVisibility;
  
  // Tags
  tags?: string[];
  
  createdAt?: number;
  updatedAt?: number;
}

// =====================================================
// PROFILE SCORES (P-P-P Framework)
// =====================================================

export type ScoreEntityType = 'organization' | 'contact' | 'lead';

export type ProblemCategory = 
  | 'pos_pain'
  | 'integration_gap'
  | 'support_void'
  | 'growth_constraint'
  | 'cost_optimization'
  | 'compliance_risk'
  | 'operational_inefficiency'
  | 'staff_training'
  | 'reporting_analytics'
  | 'other'
  | 'none_identified';

export type PainLevel = 'none' | 'mild' | 'moderate' | 'significant' | 'severe' | 'critical';

export type PainUrgency = 'not_urgent' | 'low' | 'moderate' | 'high' | 'immediate';

export type PriorityLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export type PPPGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export type SalesReadiness = 
  | 'not_ready'
  | 'early_stage'
  | 'nurture'
  | 'mql'
  | 'sql'
  | 'opportunity'
  | 'hot';

export interface ScoreEvidence {
  signal: string;
  source?: string;
  date?: string;
  confidence?: number;
}

export interface ScoreHistoryEntry {
  date: string;
  pppScore: number;
  reason?: string;
  changedBy?: string;
}

export interface ProfileScore {
  id: string;
  entityType: ScoreEntityType;
  entityId: string;
  
  // Problem Dimension
  problemIdentified?: boolean;
  problemScore: number;
  problemCategory?: ProblemCategory;
  problemDescription?: string;
  problemEvidence?: ScoreEvidence[];
  problemConfidence?: number;
  
  // Pain Dimension
  painLevel?: PainLevel;
  painScore: number;
  painUrgency?: PainUrgency;
  hasBudgetImpact?: boolean;
  hasOperationalImpact?: boolean;
  hasCustomerImpact?: boolean;
  hasComplianceImpact?: boolean;
  hasGrowthImpact?: boolean;
  painQuantified?: number;
  painQuantifiedPeriod?: string;
  painDescription?: string;
  painEvidence?: ScoreEvidence[];
  
  // Priority Dimension
  priorityLevel?: PriorityLevel;
  priorityScore: number;
  activeEvaluation?: boolean;
  budgetAllocated?: boolean;
  timelineDefined?: boolean;
  decisionMakerEngaged?: boolean;
  competitorShortlisted?: boolean;
  expectedDecisionDate?: number;
  expectedImplementationDate?: number;
  fiscalYearEnd?: number;
  budgetCycleTiming?: string;
  priorityDescription?: string;
  priorityEvidence?: ScoreEvidence[];
  
  // Composite Scores
  pppScore: number;
  pppGrade?: PPPGrade;
  salesReadiness?: SalesReadiness;
  recommendedAction?: string;
  nextBestAction?: string;
  actionPriority?: number;
  
  // Metadata
  scoringModelVersion?: string;
  lastScoredAt?: number;
  scoredBy?: string;
  scoreConfidence?: number;
  
  // Override
  isManualOverride?: boolean;
  overrideReason?: string;
  overrideBy?: string;
  overrideAt?: number;
  
  // History
  scoreHistory?: ScoreHistoryEntry[];
  
  createdAt?: number;
  updatedAt?: number;
}

// =====================================================
// COMPOSITE VIEWS / DTOs
// =====================================================

export interface OrganizationIntel360 {
  id: string;
  legalName: string;
  dbaName?: string;
  lifecycleStage: string;
  source?: string;
  
  // Prospect Profile
  industrySegment?: IndustrySegment;
  businessModel?: BusinessModel;
  employeeCountMin?: number;
  employeeCountMax?: number;
  annualRevenueMin?: number;
  annualRevenueMax?: number;
  currentPos?: string;
  techStack?: TechStack;
  avgReviewScore?: number;
  prospectProfileCompleteness?: number;
  
  // Scoring
  problemScore?: number;
  painScore?: number;
  priorityScore?: number;
  pppScore?: number;
  pppGrade?: PPPGrade;
  salesReadiness?: SalesReadiness;
  recommendedAction?: string;
  
  // Counts
  researchNoteCount?: number;
  enrichmentDataCount?: number;
  lastEnrichedAt?: number;
}

export interface ContactIntel360 {
  id: string;
  organizationId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  title?: string;
  roleType?: string;
  isPrimary?: boolean;
  
  // Contact Profile
  linkedinUrl?: string;
  seniorityLevel?: SeniorityLevel;
  department?: Department;
  buyingRole?: BuyingRole;
  isDecisionMaker?: boolean;
  isChampion?: boolean;
  isBlocker?: boolean;
  rapportLevel?: RapportLevel;
  currentSentiment?: Sentiment;
  contactProfileCompleteness?: number;
  
  // Engagement
  emailsSent?: number;
  emailsOpened?: number;
  emailsClicked?: number;
  meetingsAttended?: number;
  emailOpenRate?: number;
  
  // Scoring
  problemScore?: number;
  painScore?: number;
  priorityScore?: number;
  pppScore?: number;
  pppGrade?: PPPGrade;
}

export interface HotOpportunity {
  id: string;
  legalName: string;
  dbaName?: string;
  lifecycleStage: string;
  currentPos?: string;
  industrySegment?: IndustrySegment;
  pppScore: number;
  pppGrade: PPPGrade;
  salesReadiness: SalesReadiness;
  problemCategory?: ProblemCategory;
  painLevel?: PainLevel;
  priorityLevel?: PriorityLevel;
  recommendedAction?: string;
  expectedDecisionDate?: number;
  dmCount?: number;
  lastScoredAt?: number;
}

// =====================================================
// API TYPES
// =====================================================

export interface CreateProspectProfileRequest {
  organizationId: string;
  industrySegment?: IndustrySegment;
  businessModel?: BusinessModel;
  currentPos?: string;
  techStack?: TechStack;
  [key: string]: any;
}

export interface UpdateProfileScoreRequest {
  problemScore?: number;
  problemCategory?: ProblemCategory;
  problemDescription?: string;
  painScore?: number;
  painLevel?: PainLevel;
  priorityScore?: number;
  priorityLevel?: PriorityLevel;
  recommendedAction?: string;
  isManualOverride?: boolean;
  overrideReason?: string;
}

export interface CreateResearchNoteRequest {
  entityType: ResearchEntityType;
  entityId?: string;
  noteType: ResearchNoteType;
  title: string;
  content: string;
  priority?: NotePriority;
  confidenceLevel?: NoteConfidenceLevel;
  tags?: string[];
}

export interface EnrichmentRequest {
  entityType: EnrichmentEntityType;
  entityId: string;
  sourceTypes: EnrichmentSourceType[];
  priority?: number;
}
