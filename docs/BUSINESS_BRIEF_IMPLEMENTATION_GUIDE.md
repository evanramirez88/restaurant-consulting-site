# Business Brief Implementation Guide
## Immediate Action Items & Code Fixes

**Companion to:** BUSINESS_BRIEF_MASTER_ENHANCEMENT_PLAN.md
**Purpose:** Step-by-step implementation instructions

---

## Quick Start - Critical Fixes (Do First)

### Fix 1: CORS Vulnerability

**File:** `functions/api/admin/intelligence-console/chat.js`

```javascript
// LINE 19 - CHANGE THIS:
'Access-Control-Allow-Origin': '*'

// TO THIS:
'Access-Control-Allow-Origin': getCorsOrigin(request)

// Also add import at top:
import { getCorsOrigin } from '../../_shared/auth.js';
```

### Fix 2: SQL Injection

**File:** `functions/api/admin/business-brief/actions.js`

Find the bulk update function (around line 82) and replace:
```javascript
// CURRENT (VULNERABLE):
const query = `UPDATE business_brief_actions SET status = ? WHERE id IN ('${ids.join("','")}')`;

// FIXED (PARAMETERIZED):
const placeholders = ids.map(() => '?').join(',');
const query = `UPDATE business_brief_actions SET status = ? WHERE id IN (${placeholders})`;
await env.DB.prepare(query).bind(newStatus, ...ids).run();
```

### Fix 3: JSON Parsing Safety

**File:** `functions/api/admin/business-brief/reports.js`

Find line 165 (or similar JSON.parse calls) and wrap:
```javascript
// CURRENT:
const params = JSON.parse(r.parameters);

// FIXED:
let params = {};
try {
  params = JSON.parse(r.parameters || '{}');
} catch (e) {
  console.warn('Invalid JSON in report parameters:', r.id);
  params = {};
}
```

---

## Database Migrations

### Migration 0050: Dashboard Cache

Create `migrations/0050_dashboard_cache.sql`:
```sql
-- Dashboard metrics caching for performance
CREATE TABLE IF NOT EXISTS dashboard_metrics_cache (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  cache_key TEXT NOT NULL,
  data JSON NOT NULL,
  computed_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dashboard_cache_key ON dashboard_metrics_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_dashboard_cache_expires ON dashboard_metrics_cache(expires_at);

-- Lead score cache
ALTER TABLE restaurant_leads ADD COLUMN IF NOT EXISTS score_computed_at INTEGER;
ALTER TABLE restaurant_leads ADD COLUMN IF NOT EXISTS score_factors JSON;
ALTER TABLE restaurant_leads ADD COLUMN IF NOT EXISTS predicted_conversion_prob DECIMAL(5,2);

-- Client health tracking
ALTER TABLE clients ADD COLUMN IF NOT EXISTS health_score INTEGER DEFAULT 50;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS health_computed_at INTEGER;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS health_factors JSON;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS churn_risk TEXT DEFAULT 'low';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS clv_estimate DECIMAL(10,2);
```

### Migration 0051: Revenue Tracking

Create `migrations/0051_project_revenue.sql`:
```sql
-- Project and invoice revenue tracking
CREATE TABLE IF NOT EXISTS project_revenue (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  client_id TEXT,
  type TEXT NOT NULL CHECK(type IN ('invoice', 'subscription', 'refund', 'credit')),
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  invoice_number TEXT,
  source TEXT, -- 'stripe', 'square', 'manual'
  source_id TEXT, -- External ID
  paid_at INTEGER,
  period_start INTEGER,
  period_end INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE INDEX idx_revenue_client ON project_revenue(client_id);
CREATE INDEX idx_revenue_period ON project_revenue(period_start, period_end);
CREATE INDEX idx_revenue_source ON project_revenue(source, source_id);
CREATE INDEX idx_revenue_paid ON project_revenue(paid_at);

-- Revenue aggregation view
CREATE VIEW IF NOT EXISTS client_revenue_summary AS
SELECT
  client_id,
  SUM(CASE WHEN type != 'refund' THEN amount ELSE -amount END) as total_revenue,
  SUM(CASE WHEN type = 'subscription' AND period_end > unixepoch() THEN amount ELSE 0 END) as active_mrr,
  COUNT(DISTINCT invoice_number) as invoice_count,
  MAX(paid_at) as last_payment_at,
  MIN(paid_at) as first_payment_at
FROM project_revenue
GROUP BY client_id;
```

### Migration 0052: Operational Costs

Create `migrations/0052_operational_costs.sql`:
```sql
-- Cost tracking for profitability analysis
CREATE TABLE IF NOT EXISTS operational_costs (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK(category IN ('software', 'marketing', 'labor', 'infrastructure', 'other')),
  vendor TEXT,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  is_recurring BOOLEAN DEFAULT 0,
  billing_cycle TEXT CHECK(billing_cycle IN ('monthly', 'quarterly', 'annual', 'one-time')),
  next_billing_date INTEGER,
  active BOOLEAN DEFAULT 1,
  notes TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_costs_category ON operational_costs(category);
CREATE INDEX idx_costs_recurring ON operational_costs(is_recurring, next_billing_date);

-- Cost allocations to clients/projects
CREATE TABLE IF NOT EXISTS cost_allocations (
  id TEXT PRIMARY KEY,
  cost_id TEXT NOT NULL,
  client_id TEXT,
  project_id TEXT,
  allocation_type TEXT DEFAULT 'percentage', -- 'percentage', 'fixed'
  allocation_value DECIMAL(10,4) NOT NULL,
  period_start INTEGER,
  period_end INTEGER,
  notes TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (cost_id) REFERENCES operational_costs(id),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- Monthly cost summary view
CREATE VIEW IF NOT EXISTS monthly_cost_summary AS
SELECT
  strftime('%Y-%m', datetime(created_at, 'unixepoch')) as month,
  category,
  SUM(CASE WHEN billing_cycle = 'monthly' THEN amount
           WHEN billing_cycle = 'quarterly' THEN amount / 3
           WHEN billing_cycle = 'annual' THEN amount / 12
           ELSE amount END) as monthly_amount,
  COUNT(*) as item_count
FROM operational_costs
WHERE active = 1
GROUP BY month, category;
```

### Migration 0053: Competitive Intelligence

Create `migrations/0053_competitive_intelligence.sql`:
```sql
-- Competitor tracking
CREATE TABLE IF NOT EXISTS competitive_intel (
  id TEXT PRIMARY KEY,
  competitor_name TEXT NOT NULL,
  category TEXT CHECK(category IN ('pos_integrator', 'it_services', 'consultant', 'reseller', 'other')),
  region TEXT,
  website TEXT,
  pricing_info JSON,
  services_offered JSON,
  strengths TEXT,
  weaknesses TEXT,
  market_position TEXT CHECK(market_position IN ('leader', 'challenger', 'niche', 'emerging')),
  notes TEXT,
  last_researched_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_competitor_category ON competitive_intel(category);
CREATE INDEX idx_competitor_region ON competitive_intel(region);

-- Track when leads mention competitors
CREATE TABLE IF NOT EXISTS competitor_mentions (
  id TEXT PRIMARY KEY,
  competitor_id TEXT,
  lead_id TEXT,
  client_id TEXT,
  mention_type TEXT CHECK(mention_type IN ('current_vendor', 'considering', 'past_vendor', 'comparison')),
  context TEXT,
  sentiment TEXT CHECK(sentiment IN ('positive', 'negative', 'neutral')),
  source TEXT, -- 'call', 'email', 'form', 'research'
  mentioned_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (competitor_id) REFERENCES competitive_intel(id),
  FOREIGN KEY (lead_id) REFERENCES restaurant_leads(id),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE INDEX idx_mention_competitor ON competitor_mentions(competitor_id);
CREATE INDEX idx_mention_lead ON competitor_mentions(lead_id);
CREATE INDEX idx_mention_date ON competitor_mentions(mentioned_at);

-- Known competitors seed data
INSERT OR IGNORE INTO competitive_intel (id, competitor_name, category, market_position) VALUES
  ('comp_toast_direct', 'Toast Direct Support', 'pos_integrator', 'leader'),
  ('comp_restaurant_magic', 'Restaurant Magic', 'pos_integrator', 'challenger'),
  ('comp_local_it', 'Local IT Providers', 'it_services', 'niche'),
  ('comp_corporate_consultants', 'Corporate Restaurant Consultants', 'consultant', 'leader');
```

---

## API Enhancements

### Dashboard Cache Helper

Create `functions/api/_shared/cache.js`:
```javascript
/**
 * Dashboard cache utilities
 */

const CACHE_TTL = 300; // 5 minutes

export async function getCachedMetrics(env, cacheKey) {
  const now = Math.floor(Date.now() / 1000);

  const cached = await env.DB.prepare(`
    SELECT data FROM dashboard_metrics_cache
    WHERE cache_key = ? AND expires_at > ?
  `).bind(cacheKey, now).first();

  if (cached) {
    return JSON.parse(cached.data);
  }
  return null;
}

export async function setCachedMetrics(env, cacheKey, data, ttl = CACHE_TTL) {
  const now = Math.floor(Date.now() / 1000);

  await env.DB.prepare(`
    INSERT OR REPLACE INTO dashboard_metrics_cache (id, cache_key, data, computed_at, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    `cache_${cacheKey}`,
    cacheKey,
    JSON.stringify(data),
    now,
    now + ttl
  ).run();
}

export async function invalidateCache(env, cacheKey = null) {
  if (cacheKey) {
    await env.DB.prepare(`DELETE FROM dashboard_metrics_cache WHERE cache_key = ?`).bind(cacheKey).run();
  } else {
    await env.DB.prepare(`DELETE FROM dashboard_metrics_cache`).run();
  }
}
```

### Enhanced Lead Scoring

Create `functions/api/_shared/lead-scoring.js`:
```javascript
/**
 * Enhanced lead scoring algorithm v2
 */

const SCORING_CONFIG = {
  // Demographic factors (25 points max)
  demographic: {
    revenue_bands: {
      '1M+': 10, '500K-1M': 8, '250K-500K': 6, '100K-250K': 4, '<100K': 2
    },
    location: {
      'cape_cod': 8, 'massachusetts': 6, 'northeast': 4, 'us': 2
    },
    establishment: {
      'fine_dining': 7, 'full_service': 6, 'fast_casual': 5, 'qsr': 3, 'bar': 4
    }
  },

  // Technology fit (25 points max)
  technology: {
    current_pos: {
      'toast': 15, 'square': 10, 'clover': 10, 'upserve': 8,
      'aloha': 6, 'micros': 4, 'other': 2, 'none': 5
    },
    complexity_bonus: { 'high': 10, 'medium': 6, 'low': 3 }
  },

  // Engagement signals (30 points max)
  engagement: {
    email_opens: 2,      // per open, max 10
    email_clicks: 5,     // per click, max 10
    website_visits: 3,   // per visit, max 6
    call_scheduled: 8,   // per call
    quote_requested: 10  // one-time
  },

  // Urgency signals (20 points max)
  urgency: {
    contract_ending: 10,
    pain_expressed: 5,
    competitor_mentioned: 3,
    budget_confirmed: 7
  }
};

export function calculateLeadScore(lead, interactions = {}) {
  const factors = {};
  let total = 0;

  // Demographic scoring
  const demo = SCORING_CONFIG.demographic;
  factors.revenue = demo.revenue_bands[lead.revenue_band] || 2;
  factors.location = getLocationScore(lead);
  factors.establishment = demo.establishment[lead.establishment_type?.toLowerCase()] || 3;

  // Technology scoring
  const tech = SCORING_CONFIG.technology;
  factors.currentPos = tech.current_pos[lead.current_pos?.toLowerCase()] || 2;
  factors.complexity = tech.complexity_bonus[lead.tech_complexity] || 3;

  // Engagement scoring
  const eng = SCORING_CONFIG.engagement;
  factors.emailOpens = Math.min((interactions.emailOpens || 0) * eng.email_opens, 10);
  factors.emailClicks = Math.min((interactions.emailClicks || 0) * eng.email_clicks, 10);
  factors.websiteVisits = Math.min((interactions.websiteVisits || 0) * eng.website_visits, 6);
  factors.callScheduled = (interactions.callScheduled || 0) * eng.call_scheduled;
  factors.quoteRequested = interactions.quoteRequested ? eng.quote_requested : 0;

  // Urgency scoring
  const urg = SCORING_CONFIG.urgency;
  factors.contractEnding = lead.contract_ending_soon ? urg.contract_ending : 0;
  factors.painExpressed = (lead.pain_points?.length || 0) > 0 ? urg.pain_expressed : 0;
  factors.competitorMentioned = lead.competitor_mentioned ? urg.competitor_mentioned : 0;
  factors.budgetConfirmed = lead.budget_confirmed ? urg.budget_confirmed : 0;

  // Sum all factors
  total = Object.values(factors).reduce((a, b) => a + b, 0);

  // Normalize to 0-100
  const normalized = Math.min(100, Math.round(total));

  return {
    score: normalized,
    factors: factors,
    tier: normalized >= 80 ? 'hot' : normalized >= 60 ? 'warm' : normalized >= 40 ? 'cool' : 'cold',
    recommendations: generateRecommendations(factors, normalized)
  };
}

function getLocationScore(lead) {
  const loc = SCORING_CONFIG.demographic.location;
  const state = lead.state?.toLowerCase();
  const city = lead.city?.toLowerCase();

  // Cape Cod detection
  const capeZips = ['02601', '02630', '02631', '02632', '02633', '02637', '02638', '02639',
                    '02640', '02641', '02642', '02643', '02644', '02645', '02646', '02647',
                    '02648', '02649', '02650', '02651', '02652', '02653', '02655', '02657',
                    '02659', '02660', '02661', '02662', '02663', '02664', '02666', '02667',
                    '02668', '02669', '02670', '02671', '02672', '02673', '02675', '02713'];

  if (capeZips.includes(lead.zip)) return loc.cape_cod;
  if (state === 'ma' || state === 'massachusetts') return loc.massachusetts;
  if (['ct', 'ri', 'nh', 'vt', 'me', 'ny', 'nj'].includes(state)) return loc.northeast;
  return loc.us;
}

function generateRecommendations(factors, score) {
  const recs = [];

  if (factors.emailOpens === 0) {
    recs.push({ action: 'send_email', reason: 'No email engagement yet' });
  }
  if (!factors.callScheduled && score >= 60) {
    recs.push({ action: 'schedule_call', reason: 'Warm lead without scheduled call' });
  }
  if (factors.currentPos >= 10 && !factors.quoteRequested) {
    recs.push({ action: 'send_quote', reason: 'Good POS fit, no quote sent' });
  }
  if (factors.painExpressed > 0 && factors.callScheduled === 0) {
    recs.push({ action: 'urgent_outreach', reason: 'Pain expressed but no call scheduled' });
  }

  return recs;
}
```

### Client Health Calculator

Create `functions/api/_shared/client-health.js`:
```javascript
/**
 * Client health monitoring and churn prediction
 */

const HEALTH_WEIGHTS = {
  engagement: 0.40,   // 40% - Portal, email, ticket activity
  financial: 0.30,    // 30% - Payment history, contract value
  support: 0.30       // 30% - Ticket resolution, satisfaction
};

export function calculateClientHealth(client, interactions) {
  const factors = {
    engagement: calculateEngagementHealth(interactions),
    financial: calculateFinancialHealth(client),
    support: calculateSupportHealth(interactions)
  };

  // Weighted sum (0-100)
  const score = Object.entries(HEALTH_WEIGHTS).reduce((sum, [key, weight]) => {
    return sum + (factors[key] * weight);
  }, 0);

  // Determine risk level
  const riskLevel = score >= 70 ? 'low' :
                    score >= 50 ? 'medium' :
                    score >= 30 ? 'high' : 'critical';

  // Trend analysis (if historical data available)
  const trend = calculateTrend(client.health_history);

  return {
    score: Math.round(score),
    factors,
    riskLevel,
    trend,
    churnProbability: estimateChurnProbability(score, trend),
    recommendations: generateHealthRecommendations(factors, riskLevel)
  };
}

function calculateEngagementHealth(interactions) {
  const now = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo = now - 2592000;

  // Portal logins (0-40 points)
  const portalScore = Math.min((interactions.portalLogins30d || 0) * 5, 40);

  // Email engagement (0-30 points)
  const emailScore = Math.min(
    ((interactions.emailOpens30d || 0) * 3) + ((interactions.emailClicks30d || 0) * 5),
    30
  );

  // Ticket activity (0-30 points) - moderate activity is healthy
  const ticketCount = interactions.tickets30d || 0;
  const ticketScore = ticketCount === 0 ? 20 : // No issues
                      ticketCount <= 3 ? 30 :  // Normal usage
                      ticketCount <= 6 ? 20 :  // Moderate issues
                      10;                       // Many issues

  return portalScore + emailScore + ticketScore;
}

function calculateFinancialHealth(client) {
  // Payment timeliness (0-50 points)
  const paymentScore = client.payment_history === 'excellent' ? 50 :
                       client.payment_history === 'good' ? 40 :
                       client.payment_history === 'fair' ? 25 : 10;

  // Contract tier value (0-30 points)
  const tierScore = client.support_plan_tier === 'premium' ? 30 :
                    client.support_plan_tier === 'professional' ? 25 :
                    client.support_plan_tier === 'core' ? 20 : 5;

  // Contract tenure (0-20 points)
  const monthsActive = client.months_since_signup || 0;
  const tenureScore = Math.min(monthsActive * 2, 20);

  return paymentScore + tierScore + tenureScore;
}

function calculateSupportHealth(interactions) {
  // Resolution time (0-40 points)
  const avgResolution = interactions.avgResolutionHours || 24;
  const resolutionScore = avgResolution <= 4 ? 40 :
                          avgResolution <= 12 ? 35 :
                          avgResolution <= 24 ? 25 :
                          avgResolution <= 48 ? 15 : 5;

  // Satisfaction ratings (0-40 points)
  const satisfaction = interactions.avgSatisfaction || 3;
  const satisfactionScore = satisfaction * 8;

  // Escalation rate (0-20 points)
  const escalations = interactions.escalations30d || 0;
  const escalationScore = escalations === 0 ? 20 :
                          escalations === 1 ? 15 :
                          escalations === 2 ? 10 : 0;

  return resolutionScore + satisfactionScore + escalationScore;
}

function estimateChurnProbability(healthScore, trend) {
  // Base probability from health score
  let prob = 100 - healthScore;

  // Adjust for trend
  if (trend === 'declining') prob += 10;
  if (trend === 'improving') prob -= 10;

  return Math.max(0, Math.min(100, prob)) / 100;
}

function calculateTrend(history) {
  if (!history || history.length < 2) return 'stable';

  const recent = history.slice(-3);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const older = history.slice(-6, -3);

  if (older.length === 0) return 'stable';

  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
  const change = avg - olderAvg;

  if (change > 5) return 'improving';
  if (change < -5) return 'declining';
  return 'stable';
}

function generateHealthRecommendations(factors, riskLevel) {
  const recs = [];

  if (factors.engagement < 50) {
    recs.push({
      priority: 'high',
      action: 'increase_engagement',
      message: 'Schedule a check-in call to increase engagement'
    });
  }

  if (factors.financial < 50) {
    recs.push({
      priority: 'medium',
      action: 'review_billing',
      message: 'Review billing history and discuss payment options'
    });
  }

  if (factors.support < 50) {
    recs.push({
      priority: 'high',
      action: 'support_review',
      message: 'Review recent support tickets for recurring issues'
    });
  }

  if (riskLevel === 'critical') {
    recs.push({
      priority: 'critical',
      action: 'executive_outreach',
      message: 'Immediate executive outreach required'
    });
  }

  return recs;
}
```

---

## Frontend Component Structure

### AI Console Refactoring Plan

Split `BusinessBriefAIConsole.tsx` into:

```
src/components/admin/business-brief/ai-console/
├── index.tsx                  # Re-exports
├── AIConsole.tsx              # Main container
├── panels/
│   ├── ChatPanel.tsx          # Chat interface
│   ├── AssistantPanel.tsx     # Assistant management
│   ├── ContextPanel.tsx       # Context configuration
│   └── SettingsPanel.tsx      # Settings
├── components/
│   ├── SessionSidebar.tsx     # Session list
│   ├── MessageBubble.tsx      # Message rendering
│   ├── BuilderToolbar.tsx     # Mode toolbar
│   └── ContextIndicator.tsx   # Data context display
├── hooks/
│   ├── useChat.ts             # Chat state
│   ├── useSession.ts          # Session management
│   ├── useContext.ts          # Context loading
│   └── useAssistants.ts       # Assistant CRUD
└── types.ts                   # TypeScript interfaces
```

---

## Deployment Commands

### Apply Migrations
```bash
# In order:
npx wrangler d1 execute ccrc-db --remote --file=migrations/0050_dashboard_cache.sql
npx wrangler d1 execute ccrc-db --remote --file=migrations/0051_project_revenue.sql
npx wrangler d1 execute ccrc-db --remote --file=migrations/0052_operational_costs.sql
npx wrangler d1 execute ccrc-db --remote --file=migrations/0053_competitive_intelligence.sql
```

### Deploy to Cloudflare Pages
```bash
git add -A
git commit -m "Business Brief enhancements - security fixes and schema updates"
git push origin main
```

---

## Testing Checklist

### Security Tests
- [ ] CORS: Verify only allowed origins work
- [ ] SQL: Test with malicious input strings
- [ ] JSON: Test with malformed JSON data

### Performance Tests
- [ ] Dashboard load time < 1s
- [ ] Cache hit ratio > 80%
- [ ] No N+1 query patterns

### Functional Tests
- [ ] Lead scoring produces consistent results
- [ ] Client health updates on activity
- [ ] Revenue tracking captures all sources
- [ ] Anomaly detection triggers alerts

---

*Implementation Guide v1.0 - 2026-01-20*
