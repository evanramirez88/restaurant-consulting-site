# Business Brief System Architecture

## The Platform's Central Intelligence

> **Version:** 1.0
> **Created:** 2026-01-18
> **Status:** SPECIFICATION COMPLETE - AWAITING IMPLEMENTATION

---

## Executive Summary

The **Business Brief** is NOT a daily newsletter widget - it is the **central nervous system** of the R&G Consulting platform. This system serves as the brain/conscious of the business, aggregating data from ALL platform systems, generating AI-powered insights, and providing actionable intelligence for strategic decision-making.

### Core Design Principles

1. **Complete Integration** - Touches every system in the platform
2. **Proactive Intelligence** - Surfaces opportunities and risks before they become urgent
3. **AI-Powered Analysis** - Uses Workers AI to synthesize data into actionable insights
4. **Claude Ready** - Architected for future Claude integration as "business consciousness"
5. **Mobile-First** - Restaurant operators live on mobile/tablet
6. **Real-Time Updates** - Live data with intelligent refresh strategies

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BUSINESS BRIEF TAB                                    │
│  (New Major Tab - Same Level as Overview, Contacts, Tickets, Email, etc.)   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                 │
│  │   DASHBOARD    │  │    PULSE       │  │   STRATEGY     │                 │
│  │   (Sub-Tab)    │  │   (Sub-Tab)    │  │   (Sub-Tab)    │                 │
│  └────────────────┘  └────────────────┘  └────────────────┘                 │
│                                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                 │
│  │  INTELLIGENCE  │  │    REPORTS     │  │   AI CONSOLE   │                 │
│  │   (Sub-Tab)    │  │   (Sub-Tab)    │  │   (Sub-Tab)    │                 │
│  └────────────────┘  └────────────────┘  └────────────────┘                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Sub-Tab Architecture

### Sub-Tab 1: DASHBOARD (Executive Summary)

**Purpose:** The 30-second daily check-in. What do I need to know RIGHT NOW?

#### Components:

##### 1.1 Daily Brief Card
```typescript
interface DailyBrief {
  date: string;                    // "Saturday, January 18, 2026"
  aiSummary: string;               // 2-3 sentence AI-generated overview
  urgentCount: number;             // Items needing immediate attention
  opportunitiesCount: number;      // Money on the table
  healthScore: number;             // 0-100 business health index
  trend: 'up' | 'down' | 'stable'; // vs. last period
}
```

##### 1.2 Priority Action Queue
```typescript
interface ActionItem {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'revenue' | 'support' | 'leads' | 'operations' | 'compliance';
  title: string;
  description: string;
  source: string;                  // Which system generated this
  sourceLink: string;              // Deep link to relevant admin section
  estimatedValue?: number;         // Dollar value if applicable
  deadline?: string;               // When this becomes urgent
  suggestedAction: string;         // What to do about it
  createdAt: number;
  acknowledgedAt?: number;
}
```

##### 1.3 Today's Numbers (KPI Snapshot)
```typescript
interface TodayMetrics {
  revenue: {
    today: number;
    mtd: number;
    target: number;
    percentToGoal: number;
  };
  pipeline: {
    activeQuotes: number;
    quoteValue: number;
    avgCloseRate: number;
    projectedValue: number;
  };
  support: {
    openTickets: number;
    avgResponseTime: number;     // hours
    satisfactionScore: number;   // 0-100
  };
  marketing: {
    emailsSentToday: number;
    openRate: number;
    clickRate: number;
    newLeadsToday: number;
  };
}
```

##### 1.4 Quick Wins Board
AI-identified opportunities that can be actioned immediately:
- Leads with high scores that haven't been contacted
- Quotes about to expire that need follow-up
- Clients approaching renewal dates
- Upsell opportunities based on support patterns

---

### Sub-Tab 2: PULSE (Real-Time Business Health)

**Purpose:** Monitor all vital signs of the business in real-time.

#### Components:

##### 2.1 Revenue Pulse
```typescript
interface RevenuePulse {
  // Stripe + Square combined
  mrr: number;                     // Monthly Recurring Revenue
  arr: number;                     // Annual Recurring Revenue
  churnRate: number;               // Last 30 days
  expansionRevenue: number;        // Upsells, add-ons

  // By service line
  byServiceLine: {
    toastGuardian: { active: number; mrr: number; };
    networkSupport: { active: number; mrr: number; };
    projectWork: { revenue: number; pending: number; };
    menuBuilds: { completed: number; inProgress: number; };
  };

  // Forecasting
  projected30Day: number;
  projected90Day: number;
  riskToRevenue: number;           // Clients at risk of churning
}
```

##### 2.2 Pipeline Pulse
```typescript
interface PipelinePulse {
  // Lead funnel
  funnel: {
    prospects: number;             // restaurant_leads count
    leads: number;                 // status = 'lead'
    qualified: number;             // status = 'qualified'
    opportunities: number;         // status = 'opportunity'
    clients: number;               // converted
  };

  // Quote pipeline
  quotes: {
    draft: { count: number; value: number; };
    sent: { count: number; value: number; };
    viewed: { count: number; value: number; };
    accepted: { count: number; value: number; };
    declined: { count: number; value: number; };
    expired: { count: number; value: number; };
  };

  // Conversion metrics
  leadToQuoteRate: number;
  quoteToCloseRate: number;
  avgSalesCycle: number;           // days
  avgDealSize: number;
}
```

##### 2.3 Operations Pulse
```typescript
interface OperationsPulse {
  // Support metrics
  tickets: {
    open: number;
    inProgress: number;
    avgAgeOpen: number;            // hours
    slaBreaches: number;
    urgentCount: number;
  };

  // Automation health
  automation: {
    jobsRunToday: number;
    successRate: number;
    queueDepth: number;
    failedJobsNeedingAttention: number;
  };

  // Email system
  email: {
    queuedToSend: number;
    sentToday: number;
    bounceRate: number;
    deliverabilityScore: number;
  };

  // Portal engagement
  portals: {
    activeClientSessions: number;
    activeRepSessions: number;
    clientLoginsToday: number;
    repLoginsToday: number;
  };
}
```

##### 2.4 Market Pulse
```typescript
interface MarketPulse {
  // Lead database health
  leads: {
    total: number;
    withValidEmail: number;
    withValidPhone: number;
    enrichedLast30Days: number;
    gapFillsNeeded: number;
  };

  // Segment health
  segments: {
    name: string;
    count: number;
    lastContacted: string;
    responseRate: number;
    conversionRate: number;
  }[];

  // Competitive intel (from Beacon)
  competitiveInsights: {
    toastPainPoints: string[];     // From Reddit scraping
    marketTrends: string[];
    emergingOpportunities: string[];
  };
}
```

---

### Sub-Tab 3: STRATEGY (Planning & Goals)

**Purpose:** Strategic planning, goal tracking, and business direction.

#### Components:

##### 3.1 Goal Tracker
```typescript
interface BusinessGoal {
  id: string;
  title: string;
  description: string;
  category: 'revenue' | 'clients' | 'operations' | 'growth';
  targetValue: number;
  currentValue: number;
  unit: string;                    // '$', 'clients', '%', etc.
  deadline: string;
  milestones: {
    date: string;
    target: number;
    actual?: number;
  }[];
  status: 'on_track' | 'at_risk' | 'behind' | 'completed';
  aiRecommendations?: string[];
}

// Pre-configured for $400K by May 1, 2026 goal
const primaryGoal: BusinessGoal = {
  id: 'revenue-2026-q2',
  title: '$400K Revenue by May 1, 2026',
  targetValue: 400000,
  milestones: [
    { date: '2026-02-01', target: 100000 },
    { date: '2026-03-01', target: 200000 },
    { date: '2026-04-01', target: 300000 },
    { date: '2026-05-01', target: 400000 },
  ]
};
```

##### 3.2 Support Plan Mix Tracker
```typescript
interface SupportPlanMix {
  current: {
    core: number;           // Target: 15
    professional: number;   // Target: 25
    premium: number;        // Target: 5
  };
  target: {
    core: 15;
    professional: 25;
    premium: 5;
  };
  revenue: {
    core: number;           // $350/mo × count
    professional: number;   // $500/mo × count
    premium: number;        // $800/mo × count
    total: number;
  };
  projectedMRR: number;     // If targets hit: $23,400/mo
}
```

##### 3.3 Lane Strategy Dashboard
```typescript
interface LaneStrategy {
  laneA: {                  // Local Cape Cod
    activeClients: number;
    revenue: number;
    targetRevenue: number;
    topOpportunities: Lead[];
    serviceBreakdown: {
      menuBuilds: number;
      onSiteSupport: number;
      networkInstalls: number;
      training: number;
    };
  };
  laneB: {                  // National Remote
    activeClients: number;
    revenue: number;
    targetRevenue: number;
    topOpportunities: Lead[];
    serviceBreakdown: {
      toastGuardian: number;
      remoteMenuBuilds: number;
      consultations: number;
      referrals: number;
    };
  };
}
```

##### 3.4 Scenario Planner
AI-powered "what if" analysis:
- "If I convert 20% of Toast Upcoming leads..."
- "If I increase quote acceptance by 10%..."
- "If I add 5 Premium clients..."

---

### Sub-Tab 4: INTELLIGENCE (Deep Analysis)

**Purpose:** Deep dive into data patterns, trends, and insights.

#### Components:

##### 4.1 Lead Intelligence Dashboard
```typescript
interface LeadIntelligence {
  // Segment analysis
  segments: {
    name: string;
    totalLeads: number;
    avgScore: number;
    topScoreLeads: Lead[];
    emailSequence: string;
    sequencePerformance: {
      enrolled: number;
      currentStep: number;
      completions: number;
      conversions: number;
    };
  }[];

  // POS distribution
  posDistribution: {
    pos: string;
    count: number;
    switcherPotential: 'high' | 'medium' | 'low';
    recommendedApproach: string;
  }[];

  // Geographic analysis
  geoAnalysis: {
    region: string;
    leadCount: number;
    clientCount: number;
    penetrationRate: number;
    topOpportunities: Lead[];
  }[];
}
```

##### 4.2 Client Intelligence Dashboard
```typescript
interface ClientIntelligence {
  // Health scores
  clientHealth: {
    clientId: string;
    name: string;
    healthScore: number;         // 0-100
    factors: {
      ticketVolume: number;      // Lower is better
      responseTime: number;
      featureAdoption: number;
      communicationFrequency: number;
      paymentHistory: number;
    };
    riskLevel: 'low' | 'medium' | 'high';
    churnProbability: number;
    recommendations: string[];
  }[];

  // Upsell opportunities
  upsellOpportunities: {
    clientId: string;
    name: string;
    currentPlan: string;
    recommendedPlan: string;
    reason: string;
    estimatedRevenue: number;
    confidence: number;
  }[];

  // Engagement patterns
  engagementPatterns: {
    portalUsage: { daily: number; weekly: number; monthly: number; };
    supportPatterns: string[];    // "Heavy Monday usage", etc.
    satisfactionTrends: number[]; // Last 12 weeks
  };
}
```

##### 4.3 Agent Intelligence Feed
Real-time feed from the Core 4 Intelligence Agents:
```typescript
interface AgentIntelligenceFeed {
  hunter: {
    lastRun: string;
    newLeadsFound: number;
    newPermitsDetected: number;
    realEstateAlerts: string[];
    findings: IntelligenceFinding[];
  };
  analyst: {
    lastRun: string;
    posAuditResults: POSAuditItem[];
    hiringSignals: HiringSignal[];
    techTrends: string[];
    toastReadyLeads: Lead[];
  };
  operator: {
    lastRun: string;
    automationHealth: HealthMetric[];
    integrationStatus: IntegrationStatus[];
    staleDataCleaned: number;
    alerts: OperationalAlert[];
  };
  strategist: {
    lastRun: string;
    leadsScored: number;
    gapFillSearches: number;
    priorityTargets: Lead[];
    dailyBriefSummary: string;
    recommendations: Recommendation[];
  };
}
```

##### 4.4 Beacon Content Intelligence
Insights from aggregated content (Reddit, Toast docs, etc.):
```typescript
interface BeaconIntelligence {
  // Pain point trends
  painPointTrends: {
    topic: string;
    frequency: number;
    sentiment: 'frustrated' | 'confused' | 'neutral';
    samplePosts: BeaconItem[];
    suggestedContent: string;     // What to create in response
  }[];

  // Content opportunities
  contentOpportunities: {
    topic: string;
    searchVolume: number;
    competitorCoverage: 'low' | 'medium' | 'high';
    recommendedFormat: 'blog' | 'sop' | 'infographic' | 'video';
    estimatedImpact: number;
  }[];

  // Approved content pipeline
  contentPipeline: {
    pending: number;
    approved: number;
    published: number;
    topPerformers: BeaconPublication[];
  };
}
```

---

### Sub-Tab 5: REPORTS (Generated Reports)

**Purpose:** Pre-built and on-demand reports for analysis and decision-making.

#### Components:

##### 5.1 Report Library
```typescript
interface ReportDefinition {
  id: string;
  name: string;
  description: string;
  category: 'financial' | 'sales' | 'operations' | 'marketing' | 'custom';
  frequency: 'daily' | 'weekly' | 'monthly' | 'on_demand';
  lastGenerated?: string;
  format: 'dashboard' | 'pdf' | 'excel' | 'email';
  recipients?: string[];          // For automated delivery
  parameters?: ReportParameter[];
}

// Pre-built reports
const standardReports: ReportDefinition[] = [
  {
    id: 'daily-executive',
    name: 'Daily Executive Brief',
    description: 'AI-generated daily summary with key metrics and actions',
    category: 'financial',
    frequency: 'daily',
    format: 'email',
  },
  {
    id: 'weekly-pipeline',
    name: 'Weekly Pipeline Report',
    description: 'Lead funnel, quote status, and conversion analysis',
    category: 'sales',
    frequency: 'weekly',
    format: 'dashboard',
  },
  {
    id: 'monthly-revenue',
    name: 'Monthly Revenue Analysis',
    description: 'Complete revenue breakdown by service line and client',
    category: 'financial',
    frequency: 'monthly',
    format: 'excel',
  },
  {
    id: 'client-health',
    name: 'Client Health Scorecard',
    description: 'Health scores, risk indicators, and recommendations',
    category: 'operations',
    frequency: 'weekly',
    format: 'dashboard',
  },
  {
    id: 'email-performance',
    name: 'Email Campaign Performance',
    description: 'Sequence analytics, A/B results, and optimization suggestions',
    category: 'marketing',
    frequency: 'weekly',
    format: 'dashboard',
  },
  {
    id: 'intelligence-digest',
    name: 'Intelligence Agent Digest',
    description: 'Summary of all agent findings and recommendations',
    category: 'sales',
    frequency: 'daily',
    format: 'dashboard',
  },
];
```

##### 5.2 Report Builder
Custom report creation with drag-and-drop:
- Data source selection (which tables/APIs)
- Metric selection with calculations
- Visualization options
- Filter configuration
- Scheduling options
- Export formats

##### 5.3 Report Archive
Historical reports with comparison capability.

---

### Sub-Tab 6: AI CONSOLE (Claude Integration Point)

**Purpose:** Direct interaction with AI for analysis, insights, and assistance.

#### Components:

##### 6.1 Business Context Chat
```typescript
interface AIConsoleConfig {
  // System prompt includes:
  systemContext: {
    businessIdentity: 'R&G Consulting LLC';
    currentMetrics: TodayMetrics;
    recentActivity: ActivityItem[];
    openIssues: ActionItem[];
    goals: BusinessGoal[];
    clientRoster: ClientSummary[];
    leadPipeline: PipelineSummary;
  };

  // Conversation capabilities
  capabilities: [
    'Answer questions about business performance',
    'Analyze specific clients or leads',
    'Generate outreach messages',
    'Create reports on demand',
    'Suggest strategic actions',
    'Summarize complex data',
    'Draft proposals and quotes',
    'Explain trends and anomalies',
  ];
}
```

##### 6.2 Quick AI Actions
Pre-built prompts for common needs:
```typescript
const quickActions: AIAction[] = [
  {
    id: 'summarize-today',
    label: 'Summarize Today',
    prompt: 'Give me a 2-minute executive summary of today\'s business activity',
  },
  {
    id: 'top-priorities',
    label: 'What should I focus on?',
    prompt: 'Based on current data, what are my top 3 priorities right now?',
  },
  {
    id: 'revenue-analysis',
    label: 'Revenue Deep Dive',
    prompt: 'Analyze my revenue trends and identify opportunities to hit my $400K goal',
  },
  {
    id: 'client-outreach',
    label: 'Draft Outreach',
    prompt: 'Draft a follow-up email for the highest-scoring lead that hasn\'t been contacted',
  },
  {
    id: 'weekly-plan',
    label: 'Plan My Week',
    prompt: 'Create a prioritized task list for this week based on all pending items',
  },
];
```

##### 6.3 Insight Generation
On-demand AI analysis of specific areas:
- "Why did conversions drop this week?"
- "Which leads are most likely to convert?"
- "What's causing increased support tickets?"
- "Suggest pricing optimization strategies"

##### 6.4 Agent Orchestration (Future)
Direct control of the Core 4 agents:
- Trigger manual agent runs
- Adjust agent parameters
- Review and approve agent recommendations
- Configure agent schedules

---

## Data Integration Map

### All Systems Feeding Business Brief

| System | Data Points | Refresh Rate |
|--------|-------------|--------------|
| **Clients** | Count, health scores, plan distribution, portal usage | 5 min |
| **Leads** | Count by segment, scores, conversion funnel | 15 min |
| **Quotes** | Active, sent, viewed, accepted, total value | 5 min |
| **Tickets** | Open, SLA status, avg response time, satisfaction | 5 min |
| **Email** | Queue, sent today, open/click rates, bounces | 5 min |
| **Billing (Stripe)** | MRR, ARR, subscriptions, payments, churn | 15 min |
| **Billing (Square)** | Invoices, payments, pending | 15 min |
| **Portals** | Active sessions, logins, feature usage | 1 min |
| **Automation** | Job queue, success rate, failures | 1 min |
| **Intelligence Agents** | Last run, findings, recommendations | On completion |
| **Beacon** | New content, pending review, published | 30 min |
| **Cal.com** | Upcoming bookings, availability | 5 min |
| **HubSpot** | Contact sync status, new contacts | 15 min |
| **Toast Hub** | New posts, trending content | 30 min |

---

## API Architecture

### New Endpoints Required

```
# Business Brief Core APIs
GET  /api/admin/business-brief/dashboard
GET  /api/admin/business-brief/pulse
GET  /api/admin/business-brief/strategy
GET  /api/admin/business-brief/intelligence
GET  /api/admin/business-brief/reports
POST /api/admin/business-brief/reports/generate
GET  /api/admin/business-brief/ai/context
POST /api/admin/business-brief/ai/query

# Action Items API
GET  /api/admin/business-brief/actions
POST /api/admin/business-brief/actions/acknowledge
POST /api/admin/business-brief/actions/complete
POST /api/admin/business-brief/actions/snooze

# Goals API
GET  /api/admin/business-brief/goals
POST /api/admin/business-brief/goals
PUT  /api/admin/business-brief/goals/{id}
DELETE /api/admin/business-brief/goals/{id}

# AI Summary Generation
POST /api/admin/business-brief/ai/generate-summary
POST /api/admin/business-brief/ai/generate-recommendations
POST /api/admin/business-brief/ai/analyze
```

### Database Schema Additions

```sql
-- Business Brief Action Items
CREATE TABLE IF NOT EXISTS business_brief_actions (
  id TEXT PRIMARY KEY,
  priority TEXT NOT NULL CHECK(priority IN ('critical', 'high', 'medium', 'low')),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  source_type TEXT NOT NULL,    -- 'ticket', 'lead', 'quote', 'email', 'automation', 'agent'
  source_id TEXT,               -- ID in source system
  source_link TEXT,             -- Deep link URL
  estimated_value INTEGER,      -- Dollar value if applicable
  deadline INTEGER,             -- Unix timestamp
  suggested_action TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'acknowledged', 'completed', 'snoozed', 'dismissed')),
  acknowledged_at INTEGER,
  completed_at INTEGER,
  snoozed_until INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_actions_status ON business_brief_actions(status);
CREATE INDEX idx_actions_priority ON business_brief_actions(priority);
CREATE INDEX idx_actions_deadline ON business_brief_actions(deadline);

-- Business Goals
CREATE TABLE IF NOT EXISTS business_goals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK(category IN ('revenue', 'clients', 'operations', 'growth', 'custom')),
  target_value REAL NOT NULL,
  current_value REAL DEFAULT 0,
  unit TEXT NOT NULL,           -- '$', 'clients', '%', 'count'
  deadline INTEGER,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'on_track', 'at_risk', 'behind', 'completed', 'archived')),
  parent_goal_id TEXT,          -- For sub-goals
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (parent_goal_id) REFERENCES business_goals(id)
);

-- Goal Milestones
CREATE TABLE IF NOT EXISTS goal_milestones (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL,
  target_date INTEGER NOT NULL,
  target_value REAL NOT NULL,
  actual_value REAL,
  notes TEXT,
  FOREIGN KEY (goal_id) REFERENCES business_goals(id) ON DELETE CASCADE
);

-- AI Generated Summaries (cached)
CREATE TABLE IF NOT EXISTS ai_summaries (
  id TEXT PRIMARY KEY,
  summary_type TEXT NOT NULL,   -- 'daily_brief', 'weekly_analysis', 'client_health', etc.
  context_key TEXT,             -- For client-specific: client_id, etc.
  summary_text TEXT NOT NULL,
  recommendations TEXT,         -- JSON array
  generated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL,
  model_used TEXT,
  input_token_count INTEGER,
  output_token_count INTEGER
);

CREATE INDEX idx_summaries_type ON ai_summaries(summary_type, context_key);
CREATE INDEX idx_summaries_expires ON ai_summaries(expires_at);

-- Business Brief Sessions (for AI context)
CREATE TABLE IF NOT EXISTS brief_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,        -- admin user
  context_snapshot TEXT,        -- JSON of business state at session start
  messages TEXT,                -- JSON array of chat messages
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_activity INTEGER NOT NULL DEFAULT (unixepoch())
);
```

---

## Implementation Phases

### Phase 1: Foundation (Current Sprint)
- [ ] Database migrations for new tables
- [ ] Core `/api/admin/business-brief/dashboard` endpoint
- [ ] Business Brief tab in AdminDashboard
- [ ] Dashboard sub-tab UI with daily brief card
- [ ] Action items list with acknowledge/complete
- [ ] Basic KPI snapshot from existing APIs

### Phase 2: Pulse & Strategy
- [ ] Pulse sub-tab with real-time metrics
- [ ] Strategy sub-tab with goal tracker
- [ ] Support plan mix visualization
- [ ] Lane A/B strategy dashboard
- [ ] Revenue projections

### Phase 3: Intelligence Integration
- [ ] Intelligence sub-tab
- [ ] Agent feed integration
- [ ] Lead intelligence dashboard
- [ ] Client health scoring
- [ ] Beacon content insights

### Phase 4: Reports & AI
- [ ] Reports sub-tab with report library
- [ ] Report generation APIs
- [ ] AI Console sub-tab
- [ ] Workers AI integration for summaries
- [ ] Quick AI actions
- [ ] Context-aware chat

### Phase 5: Polish & Automation
- [ ] Automated report delivery
- [ ] Smart notification system
- [ ] Mobile optimization
- [ ] Claude integration preparation
- [ ] Performance optimization

---

## UI/UX Specifications

### Color System (Priority-Based)
```css
/* Action Item Priorities */
--priority-critical: #ef4444;   /* Red 500 */
--priority-high: #f97316;       /* Orange 500 */
--priority-medium: #eab308;     /* Yellow 500 */
--priority-low: #22c55e;        /* Green 500 */

/* Health Scores */
--health-excellent: #22c55e;    /* 80-100 */
--health-good: #84cc16;         /* 60-79 */
--health-fair: #eab308;         /* 40-59 */
--health-poor: #ef4444;         /* 0-39 */

/* Trends */
--trend-up: #22c55e;
--trend-down: #ef4444;
--trend-stable: #6b7280;
```

### Component Library
- Use existing admin UI patterns
- Mobile-first responsive design
- Expandable/collapsible sections
- Real-time update indicators
- Loading skeletons for all data

### Navigation
- Business Brief as new primary tab (position 2, after Overview)
- Sub-tabs as horizontal pills on mobile, vertical sidebar on desktop
- Breadcrumb trail for deep navigation
- Quick-jump to source system from any data point

---

## Success Metrics

### Business Brief Effectiveness
- Daily check-in completion rate
- Time to action on high-priority items
- Goal milestone achievement rate
- AI recommendation acceptance rate
- Report generation frequency

### Technical Performance
- Dashboard load time < 2 seconds
- Real-time updates latency < 5 seconds
- AI summary generation < 10 seconds
- 99.9% uptime for all endpoints

---

## Security Considerations

- Admin-only access (existing auth)
- AI queries logged for audit
- Sensitive data masking in AI context
- Rate limiting on AI endpoints
- Goal data encryption at rest

---

## Future Enhancements

1. **Voice Integration** - "Hey Claude, what's my business looking like today?"
2. **Predictive Alerts** - AI predicts issues before they happen
3. **Automated Actions** - AI executes routine tasks with approval
4. **External Integrations** - QuickBooks, bank feeds, social media
5. **Team Collaboration** - Shared goals, task assignment, comments
6. **White-Label** - Customizable for client-facing dashboards

---

## Conclusion

The Business Brief transforms the Admin Portal from a management tool into an intelligent business partner. By aggregating data from all systems, generating AI-powered insights, and presenting actionable intelligence, this system enables data-driven decision-making at every level of the business.

This is not a dashboard - it's the consciousness of R&G Consulting.

---

*Document Version: 1.0*
*Last Updated: 2026-01-18*
*Author: Claude Opus 4.5*
*Status: Ready for Implementation Approval*
