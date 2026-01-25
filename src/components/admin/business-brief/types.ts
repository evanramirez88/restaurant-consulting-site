// Business Brief Shared Types
// Centralized type definitions for all Business Brief components

// ============================================
// METRICS & TRENDS TYPES
// ============================================

export interface MetricSnapshot {
  id: string;
  snapshotDate: string;
  metricType: 'revenue' | 'clients' | 'pipeline' | 'email' | 'support' | 'engagement';
  metricValue: number;
  metricMeta?: Record<string, unknown>;
  createdAt: number;
}

export interface TrendDirection {
  previous: number;
  change: number;
  direction: 'up' | 'down' | 'stable';
}

export interface RevenueTrend {
  current: number;
  wow: TrendDirection;
  mom: TrendDirection;
  sparkline: { date: string; value: number }[];
}

export interface ClientsTrend {
  current: number;
  wow: TrendDirection;
  sparkline: { date: string; value: number }[];
}

export interface PipelineTrend {
  current: number;
  activeQuotes: number;
  sparkline: { date: string; value: number }[];
}

export interface EmailTrend {
  currentOpenRate: number;
  wow: TrendDirection;
}

export interface TrendsData {
  success: boolean;
  generatedAt: number;
  period: {
    today: string;
    oneWeekAgo: string;
    oneMonthAgo: string;
  };
  trends: {
    revenue: RevenueTrend;
    clients: ClientsTrend;
    pipeline: PipelineTrend;
    email: EmailTrend;
    support: {
      openTickets: number;
      resolvedThisWeek: number;
      wow: TrendDirection;
    };
    conversions: {
      thisWeek: number;
      lastWeek: number;
      change: number;
      direction: 'up' | 'down' | 'stable';
    };
  };
}

// ============================================
// HEALTH SCORE TYPES
// ============================================

export interface HealthScoreComponent {
  score: number;
  weight: number;
  contribution: number;
  metric: number;
  metricLabel: string;
  target?: number;
  targetLabel?: string;
}

export interface HealthScoreData {
  overall: number;
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  trend: 'improving' | 'declining' | 'stable';
  components: {
    revenue: HealthScoreComponent;
    clients: HealthScoreComponent;
    pipeline: HealthScoreComponent;
    email: HealthScoreComponent;
    retention: HealthScoreComponent;
  };
}

export interface HealthScoreRecommendation {
  component: string;
  priority: 'high' | 'medium' | 'low';
  message: string;
}

export interface HealthScoreResponse {
  success: boolean;
  generatedAt: number;
  healthScore: HealthScoreData;
  recommendations: HealthScoreRecommendation[];
  history: {
    date: string;
    overall: number;
    revenue?: number;
    clients?: number;
    pipeline?: number;
    email?: number;
    retention?: number;
  }[];
}

// ============================================
// REVENUE EVENTS TYPES
// ============================================

export interface RevenueEvent {
  id: string;
  clientId?: string;
  clientName?: string;
  eventType: 'invoice_paid' | 'subscription_started' | 'subscription_cancelled' | 'subscription_renewed' | 'refund' | 'project_payment';
  amount: number;
  eventDate: number;
  source: 'stripe' | 'square' | 'manual';
  referenceId?: string;
  meta?: Record<string, unknown>;
}

export interface RevenueData {
  success: boolean;
  period: {
    days: number;
    startDate: string;
    endDate: string;
  };
  summary: {
    totalRevenue: number;
    totalRefunds: number;
    netRevenue: number;
    currentMRR: number;
    currentARR: number;
    activeSubscriptions: number;
  };
  bySource: Record<string, { total: number; count: number }>;
  byType: Record<string, { total: number; count: number }>;
  dailyData: {
    date: string;
    revenue: number;
    refunds: number;
    netRevenue: number;
    eventCount: number;
  }[];
  events: RevenueEvent[];
  eventCount: number;
}

// ============================================
// DASHBOARD TYPES
// ============================================

export interface DashboardAction {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'revenue' | 'support' | 'leads' | 'operations' | 'compliance' | 'email' | 'automation';
  title: string;
  description?: string;
  sourceType: string;
  sourceId?: string;
  sourceLink?: string;
  estimatedValue?: number;
  deadline?: number;
  suggestedAction?: string;
  status: 'pending' | 'acknowledged' | 'in_progress' | 'completed' | 'snoozed' | 'dismissed';
  createdAt: number;
}

export interface DashboardData {
  success: boolean;
  timestamp: number;
  lastUpdated: string;
  actions: DashboardAction[];
  summary: {
    criticalCount: number;
    highCount: number;
    pendingValue: number;
    todayActions: number;
    resolvedToday: number;
  };
  quickStats: {
    mrr: number;
    openTickets: number;
    hotLeads: number;
    pendingQuotes: number;
    pipelineValue: number;
    emailsToday: number;
  };
}

// ============================================
// PULSE TYPES
// ============================================

export interface PulseRevenue {
  mrr: number;
  arr: number;
  mrrFormatted: string;
  arrFormatted: string;
  churnRate: number;
  activeSubscriptions: number;
  stripeRevenue30d: number;
  squareRevenue30d: number;
  totalRevenue30d: number;
  byServiceLine: {
    toastGuardian: { active: number; mrr: number };
    networkSupport: { active: number; mrr: number };
    projectWork: { revenue: number; pending: number };
  };
  projected30Day: number;
  projected90Day: number;
}

export interface PulsePipeline {
  funnel: {
    prospects: number;
    leads: number;
    qualified: number;
    opportunities: number;
    clients: number;
  };
  quotes: Record<string, { count: number; value: number }>;
  leadToQuoteRate: number;
  quoteToCloseRate: number;
  avgSalesCycle: number;
  avgDealSize: number;
  recentConversions: {
    count: number;
    value: number;
  };
}

export interface PulseOperations {
  tickets: {
    total: number;
    open: number;
    inProgress: number;
    resolvedToday: number;
    urgent: number;
    avgAgeHours: number;
    slaBreaches: number;
  };
  automation: {
    jobsToday: number;
    completed: number;
    failed: number;
    queued: number;
    successRate: number;
  };
  email: {
    queueDepth: number;
    sentToday: number;
    bounceRate: number;
    openRate: number;
    deliverabilityScore: number;
  };
  portals: {
    clientLoginsToday: number;
    repLoginsToday: number;
    activeClientSessions: number;
    activeRepSessions: number;
  };
}

export interface PulseMarket {
  leads: {
    total: number;
    withValidEmail: number;
    withValidPhone: number;
    hotLeads: number;
    enrichedLast30Days: number;
    emailCoverage: string;
    phoneCoverage: string;
  };
  segments: Array<{
    name: string;
    key: string;
    count: number;
    avgScore: number;
  }>;
  beacon: {
    pendingReview: number;
    approved: number;
    published: number;
    newToday: number;
  };
}

export interface PulseData {
  success: boolean;
  timestamp: number;
  lastUpdated: string;
  revenue: PulseRevenue;
  pipeline: PulsePipeline;
  operations: PulseOperations;
  market: PulseMarket;
}

// ============================================
// STRATEGY TYPES
// ============================================

export interface Goal {
  id: string;
  title: string;
  description?: string;
  category: string;
  target_value: number;
  current_value: number;
  unit: string;
  deadline?: number;
  status: string;
  milestones: GoalMilestone[];
  percentComplete: number;
  daysRemaining?: number;
  remainingValue: number;
  requiredDailyRate?: number;
  formattedDeadline?: string;
}

export interface GoalMilestone {
  id: string;
  title?: string;
  targetDate: number;
  targetValue: number;
  actualValue?: number;
  achieved: boolean;
}

export interface SupportPlanMix {
  current: {
    core: number;
    professional: number;
    premium: number;
    none: number;
  };
  target: {
    core: number;
    professional: number;
    premium: number;
    totalMRR: number;
  };
  mrr: {
    current: number;
    target: number;
    byTier: {
      core: number;
      professional: number;
      premium: number;
    };
  };
  progress: {
    core: string;
    professional: string;
    premium: string;
  };
}

export interface Lane {
  name: string;
  description: string;
  clients: number;
  revenue30d: number;
  pendingRevenue: number;
  leads: {
    total: number;
    hot: number;
  };
  services: string[];
  squareLocation: string;
}

export interface Scenario {
  label: string;
  assumedCloseRate: number;
  projectedValue: number;
  description: string;
}

export interface ScenarioResult {
  additionalMRR: number;
  additionalARR: number;
  projectedPipelineConversion: number;
  totalProjectedImpact: number;
  breakdown: {
    fromNewClients: number;
    fromPipeline: number;
  };
}

export interface StrategyData {
  success: boolean;
  timestamp: number;
  lastUpdated: string;
  goals: Goal[];
  supportPlanMix: SupportPlanMix;
  lanes: {
    a: Lane;
    b: Lane;
  };
  pipeline: {
    activeQuotes: number;
    pipelineValue: number;
    closeRate: number;
    recentWins: number;
    recentValue: number;
  };
  scenarios: {
    conservative: Scenario;
    moderate: Scenario;
    optimistic: Scenario;
  };
}

// ============================================
// INTELLIGENCE TYPES
// ============================================

export interface LeadSegment {
  id: string;
  name: string;
  key: string;
  description?: string;
  leadCount: number;
  avgScore: number;
  hotCount: number;
  emailSequence?: string;
}

export interface POSDistribution {
  pos: string;
  count: number;
  avgScore: number;
  hotCount: number;
  switcherPotential: 'high' | 'medium' | 'low';
}

export interface GeoDistribution {
  state: string;
  leadCount: number;
  avgScore: number;
  emailCoverage: number;
}

export interface TopLead {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  location: string;
  pos?: string;
  score: number;
  status?: string;
}

export interface LeadIntelligence {
  segments: LeadSegment[];
  posDistribution: POSDistribution[];
  geoDistribution: GeoDistribution[];
  topLeads: TopLead[];
  recentlyEnriched: number;
}

export interface ClientHealth {
  id: string;
  name: string;
  company?: string;
  plan: string;
  planStatus?: string;
  ticketCount: number;
  openTickets: number;
  healthScore: number;
  riskLevel: 'high' | 'medium' | 'low';
}

export interface ClientEngagement {
  id: string;
  name: string;
  activityCount: number;
  lastActivity?: number;
}

export interface UpsellOpportunity {
  id: string;
  name: string;
  company?: string;
  currentPlan: string;
  recentTickets: number;
  recommendedPlan: string;
  reason: string;
}

export interface ClientIntelligence {
  healthScores: ClientHealth[];
  engagement: ClientEngagement[];
  upsellOpportunities: UpsellOpportunity[];
}

export interface AgentStatus {
  name: string;
  lastRun: number | null;
  status: 'healthy' | 'error' | 'idle';
  findings: number;
  completedRuns?: number;
  failedRuns?: number;
}

export interface AgentFinding {
  id: string;
  priority: string;
  category: string;
  title: string;
  description?: string;
  source: string;
  value?: number;
  timestamp: number;
}

export interface AgentIntelligence {
  agents: {
    hunter: AgentStatus;
    analyst: AgentStatus;
    operator: AgentStatus;
    strategist: AgentStatus;
  };
  recentFindings: AgentFinding[];
}

export interface BeaconStats {
  total: number;
  pending: number;
  approved: number;
  published: number;
  rejected: number;
  newLast7Days: number;
}

export interface BeaconContent {
  id: string;
  title: string;
  source: string;
  category: string;
  status: string;
  relevanceScore: number;
  createdAt: number;
  summary?: string;
}

export interface BeaconIntelligence {
  stats: BeaconStats;
  topContent: BeaconContent[];
  pendingReview: BeaconContent[];
}

export interface IntelligenceData {
  success: boolean;
  timestamp: number;
  lastUpdated: string;
  leadIntelligence: LeadIntelligence;
  clientIntelligence: ClientIntelligence;
  agentIntelligence: AgentIntelligence;
  beaconIntelligence: BeaconIntelligence;
}

// ============================================
// REPORTS TYPES
// ============================================

export interface ReportDefinition {
  id: string;
  name: string;
  description: string;
  category: 'financial' | 'sales' | 'operations' | 'marketing';
  frequency: 'daily' | 'weekly' | 'monthly';
  format: 'email' | 'dashboard' | 'excel';
  icon: string;
  estimatedTime: string;
  dataPoints: string[];
}

export interface ReportHistory {
  id: string;
  type: string;
  title: string;
  parameters?: Record<string, unknown>;
  format: string;
  status: string;
  generatedAt: number;
  fileUrl?: string;
  fileSize?: number;
  recipientCount?: number;
  error?: string;
}

export interface ScheduledReport {
  id: string;
  type: string;
  title: string;
  description?: string;
  frequency: string;
  format: string;
  recipients: string[];
  parameters?: Record<string, unknown>;
  nextRunAt: number;
  lastRunAt?: number;
  isActive: boolean;
}

export interface ReportsData {
  success: boolean;
  timestamp: number;
  library: ReportDefinition[];
  history: ReportHistory[];
  scheduled: ScheduledReport[];
  stats: {
    totalGenerated: number;
    successRate: number;
    scheduledActive: number;
    mostUsed: string | null;
  };
}

// ============================================
// AI CONSOLE TYPES
// ============================================

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  prompt: string;
  category: string;
}

export interface AIContext {
  timestamp: number;
  revenue: {
    mrr: number;
    arr: number;
    target: number;
    targetDate: string;
    daysToTarget: number;
    progress: number;
  };
  clients: {
    total: number;
    activePlans: number;
    byTier: {
      core: number;
      professional: number;
      premium: number;
    };
    targets: {
      core: number;
      professional: number;
      premium: number;
    };
  };
  leads: {
    total: number;
    hot: number;
    warm: number;
    new7d: number;
    withEmail: number;
  };
  support: {
    openTickets: number;
    urgent: number;
    newToday: number;
  };
  pipeline: {
    pendingQuotes: number;
    pendingValue: number;
    accepted7d: number;
  };
  actions: {
    total: number;
    critical: number;
    high: number;
  };
}

export interface AIConsoleData {
  success: boolean;
  timestamp: number;
  quickActions: QuickAction[];
  context: AIContext;
  capabilities: string[];
  modelInfo: {
    available: boolean;
    model: string;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface AIResponse {
  success: boolean;
  response: string;
  context?: {
    metricsSnapshot?: {
      mrr: number;
      clients: number;
      hotLeads: number;
      openTickets: number;
    };
  };
  modelUsed: string;
  timestamp: number;
}

// ============================================
// COMMON / UTILITY TYPES
// ============================================

export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type Status = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface ApiError {
  success: false;
  error: string;
}

export type ApiResponse<T> = T | ApiError;

export function isApiError(response: unknown): response is ApiError {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    (response as ApiError).success === false
  );
}
