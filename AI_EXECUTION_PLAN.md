# AI Execution Plan - R&G Consulting Website Completion
## Parallel Agent Strategy for Accelerated Development

**Created:** 2026-01-07
**Target Completion:** 5-6 days (compressed from 13-17 days)
**Execution Model:** 4+ parallel agents with coordinated handoffs

---

## EXECUTIVE SUMMARY

This plan leverages Claude Code's multi-agent capabilities to achieve **4x acceleration** through:
1. **Massive parallelization** - 4 agents working simultaneously
2. **Pre-defined interfaces** - Agents work to agreed contracts
3. **Continuous integration** - Merge-as-you-go prevents conflicts
4. **Background testing** - Quality assurance runs parallel to development

**Traditional Timeline:** 13-17 days (single developer)
**AI-Accelerated Timeline:** 5-6 days (4 parallel agents)

---

## WORK BREAKDOWN

### Priority 1: Email Admin UI (CRITICAL - Blocks Revenue)

**Original Estimate:** 13-17 days
**Compressed Estimate:** 4 days with 4 parallel agents

| Component | Lines Est. | API Endpoints | Agent |
|-----------|------------|---------------|-------|
| Campaign Dashboard | 400-500 | 3 | Agent A |
| Campaign Editor | 600-800 | 4 | Agent A |
| Subscriber List | 500-600 | 4 | Agent B |
| Subscriber Import | 300-400 | 2 | Agent B |
| Sequence Step Editor | 500-600 | 3 | Agent C |
| Email Template Editor | 400-500 | 3 | Agent C |
| Segment Builder | 400-500 | 3 | Agent D |
| Analytics Dashboard | 500-600 | 4 | Agent D |
| A/B Testing UI | 300-400 | 2 | Agent A (Day 3) |
| Enrollment Interface | 200-300 | 2 | Agent B (Day 3) |

**Total:** ~4,100-5,200 lines of React + ~30 API endpoints

### Priority 2: Quick Fixes (Can parallelize on Day 1)

| Task | Time | Agent |
|------|------|-------|
| Quote Builder: Move hardcoded contacts to env vars | 30 min | Background |
| Menu Builder: Add JWT auth to API endpoints | 1 hour | Background |
| Invoice Generation: Complete Square integration | 4 hours | Background |

### Priority 3: PDF Processing Completion (Day 5)

| Task | Time | Agent |
|------|------|-------|
| Quote Builder PDF OCR completion | 4 hours | Agent C |
| Menu Builder multi-page PDF support | 4 hours | Agent D |

---

## DAY-BY-DAY EXECUTION PLAN

### DAY 1: Foundation + Quick Fixes

**Morning Block (4 parallel agents)**

| Agent | Task | Deliverable |
|-------|------|-------------|
| **Agent A** | Campaign Dashboard + List API | `EmailCampaigns.tsx` + `/api/admin/email/sequences/*` |
| **Agent B** | Subscriber List + API | `EmailSubscribers.tsx` + `/api/admin/email/subscribers/*` |
| **Agent C** | Sequence Step Editor + API | `SequenceStepEditor.tsx` + `/api/admin/email/steps/*` |
| **Agent D** | Quick Fixes (Quote, Menu, Invoice) | Environment config, auth middleware, Square API |

**Afternoon Block (4 parallel agents)**

| Agent | Task | Deliverable |
|-------|------|-------------|
| **Agent A** | Campaign Create/Edit Form | `CampaignEditor.tsx` modal |
| **Agent B** | Subscriber Import UI | `SubscriberImport.tsx` + CSV parsing |
| **Agent C** | Template Editor | `EmailTemplateEditor.tsx` |
| **Agent D** | Integration Testing | Test all Day 1 components |

**Day 1 Checkpoint:**
- [ ] 4 admin pages functional (Campaign, Subscribers, Steps, Templates)
- [ ] 8+ API endpoints working
- [ ] Quick fixes deployed
- [ ] All tests passing

---

### DAY 2: Advanced Features

**Morning Block (4 parallel agents)**

| Agent | Task | Deliverable |
|-------|------|-------------|
| **Agent A** | Segment Builder UI | `SegmentBuilder.tsx` + query builder |
| **Agent B** | Subscriber Search/Filter | Advanced filtering, pagination |
| **Agent C** | Step Conditions Editor | Conditional logic UI (skip if opened, etc.) |
| **Agent D** | Analytics Foundation | `EmailAnalytics.tsx` + aggregation queries |

**Afternoon Block (4 parallel agents)**

| Agent | Task | Deliverable |
|-------|------|-------------|
| **Agent A** | Segment API + Testing | `/api/admin/email/segments/*` |
| **Agent B** | Bulk Actions UI | Select all, tag, enroll, delete |
| **Agent C** | Template Preview | Live preview with sample data |
| **Agent D** | Analytics Charts | Open rate, click rate, bounce rate charts |

**Day 2 Checkpoint:**
- [ ] Segment builder working
- [ ] Bulk subscriber operations functional
- [ ] Email preview working
- [ ] Basic analytics displaying

---

### DAY 3: A/B Testing + Enrollment + Integration

**Morning Block (4 parallel agents)**

| Agent | Task | Deliverable |
|-------|------|-------------|
| **Agent A** | A/B Testing UI | `ABTestingPanel.tsx` + variant management |
| **Agent B** | Enrollment Interface | `EnrollmentWizard.tsx` + batch enrollment |
| **Agent C** | Full Sequence Flow Testing | End-to-end test: create → enroll → send |
| **Agent D** | Analytics Polish | Funnel visualization, export capability |

**Afternoon Block (4 parallel agents)**

| Agent | Task | Deliverable |
|-------|------|-------------|
| **Agent A** | A/B Test Results UI | Statistical significance display |
| **Agent B** | Manual Enrollment | Individual contact enrollment |
| **Agent C** | Error Recovery UI | Failed email handling, retry interface |
| **Agent D** | Send Time Optimization UI | Scheduling interface |

**Day 3 Checkpoint:**
- [ ] A/B testing fully functional
- [ ] Enrollment working (batch + individual)
- [ ] Full sequence lifecycle tested
- [ ] Analytics complete

---

### DAY 4: PDF Processing + Polish

**Morning Block (4 parallel agents)**

| Agent | Task | Deliverable |
|-------|------|-------------|
| **Agent A** | Quote Builder PDF OCR | Complete process-pdf.js implementation |
| **Agent B** | Menu Builder multi-page PDF | PDF page extraction + processing |
| **Agent C** | UI Polish - Campaign Management | Loading states, error handling, responsive |
| **Agent D** | UI Polish - Subscriber Management | Performance optimization, virtual scrolling |

**Afternoon Block (4 parallel agents)**

| Agent | Task | Deliverable |
|-------|------|-------------|
| **Agent A** | Quote PDF Testing | Test with real Toast PDFs |
| **Agent B** | Menu PDF Testing | Test with real menu PDFs |
| **Agent C** | Admin Navigation Integration | Add Email tab to admin dashboard |
| **Agent D** | Full System Integration Test | All features working together |

**Day 4 Checkpoint:**
- [ ] PDF processing working for both Quote and Menu builders
- [ ] Email admin fully integrated into dashboard
- [ ] All UI polished and responsive
- [ ] Integration tests passing

---

### DAY 5: Security + Documentation + Deploy

**Morning Block (4 parallel agents)**

| Agent | Task | Deliverable |
|-------|------|-------------|
| **Agent A** | Security Audit | CORS, auth, rate limiting |
| **Agent B** | API Documentation | OpenAPI spec for email endpoints |
| **Agent C** | User Documentation | Admin guide for email campaigns |
| **Agent D** | Performance Testing | Load testing, optimization |

**Afternoon Block (2 parallel agents)**

| Agent | Task | Deliverable |
|-------|------|-------------|
| **Agent A** | Final Bug Fixes | Address any issues from testing |
| **Agent B** | Production Deploy + Verification | Deploy, smoke test, monitoring |

**Day 5 Checkpoint:**
- [ ] Security audit passed
- [ ] Documentation complete
- [ ] Production deployed
- [ ] All features verified working

---

## COMPONENT SPECIFICATIONS

### 1. EmailCampaigns.tsx (Campaign Dashboard)

```typescript
// Required features:
- List all email_sequences with status badges
- Filter by: status (active/paused/draft), type (drip/behavior/etc.)
- Search by name
- Quick actions: Pause, Resume, Duplicate, Delete
- Stats columns: Subscribers, Sent, Opened, Clicked
- Create New Campaign button → CampaignEditor modal

// API endpoints needed:
GET /api/admin/email/sequences - List with filters
POST /api/admin/email/sequences - Create
PUT /api/admin/email/sequences/:id - Update
DELETE /api/admin/email/sequences/:id - Delete
POST /api/admin/email/sequences/:id/duplicate - Clone
```

### 2. CampaignEditor.tsx (Create/Edit Campaign)

```typescript
// Required features:
- Step 1: Basic Info (name, type, description)
- Step 2: Trigger Settings (manual, on signup, on tag, on segment)
- Step 3: Email Steps (add/edit/reorder steps)
- Step 4: Schedule (start date, daily limits, timezone)
- Step 5: Review & Activate

// Each step configurable:
- Subject line (with A/B variant option)
- Email body (rich text or HTML)
- Delay (minutes, hours, days)
- Conditions (skip if opened previous, skip if clicked, etc.)
```

### 3. EmailSubscribers.tsx (Subscriber List)

```typescript
// Required features:
- Virtual scrolling (42,967 subscribers)
- Columns: Email, Name, Company, POS, Status, Score, Tags
- Filters: Status, POS type, Geographic tier, Score range, Tags
- Search by email/name/company
- Bulk actions: Tag, Enroll, Delete, Export
- Click row → Subscriber detail modal

// API endpoints needed:
GET /api/admin/email/subscribers - List with pagination + filters
GET /api/admin/email/subscribers/:id - Single subscriber detail
PUT /api/admin/email/subscribers/:id - Update
DELETE /api/admin/email/subscribers/:id - Delete
POST /api/admin/email/subscribers/bulk - Bulk operations
```

### 4. SubscriberImport.tsx (Import Interface)

```typescript
// Required features:
- Drag-and-drop CSV upload
- Column mapping UI (auto-detect common fields)
- Preview first 10 rows
- Validation errors display
- Tag assignment on import
- Progress bar for large imports
- Import history list

// Supported fields:
email (required), first_name, last_name, company, phone,
pos_system, geographic_tier, lead_source, tags
```

### 5. SequenceStepEditor.tsx (Step Configuration)

```typescript
// Required features:
- Drag-and-drop reordering
- Add step: Email, Delay, Condition, Tag
- Email step config:
  - Subject (with {{tokens}})
  - Body (with {{tokens}})
  - From name
  - A/B variant toggle
- Delay step config:
  - Amount + unit (minutes/hours/days)
- Condition step:
  - If opened previous → skip/continue
  - If clicked link → skip/continue
  - If has tag → skip/continue

// API endpoints needed:
GET /api/admin/email/sequences/:id/steps - List steps
POST /api/admin/email/sequences/:id/steps - Add step
PUT /api/admin/email/sequences/:id/steps/:stepId - Update
DELETE /api/admin/email/sequences/:id/steps/:stepId - Delete
PUT /api/admin/email/sequences/:id/steps/reorder - Reorder
```

### 6. EmailTemplateEditor.tsx (Template Management)

```typescript
// Required features:
- Template list with preview thumbnails
- Create/Edit template modal
- Rich text editor OR raw HTML toggle
- Token insertion dropdown: {{first_name}}, {{company}}, etc.
- Preview with sample data
- Save as template from campaign step

// API endpoints needed:
GET /api/admin/email/templates - List
POST /api/admin/email/templates - Create
PUT /api/admin/email/templates/:id - Update
DELETE /api/admin/email/templates/:id - Delete
```

### 7. SegmentBuilder.tsx (Segment Management)

```typescript
// Required features:
- Dynamic segment query builder:
  - Field dropdown (pos_system, geographic_tier, status, etc.)
  - Operator dropdown (equals, contains, greater than, etc.)
  - Value input
  - AND/OR logic between conditions
- Static segment (manual membership)
- Preview matching subscribers count
- Refresh segment membership

// API endpoints needed:
GET /api/admin/email/segments - List
POST /api/admin/email/segments - Create
PUT /api/admin/email/segments/:id - Update
DELETE /api/admin/email/segments/:id - Delete
POST /api/admin/email/segments/:id/preview - Preview matches
POST /api/admin/email/segments/:id/refresh - Refresh membership
```

### 8. EmailAnalytics.tsx (Analytics Dashboard)

```typescript
// Required features:
- Campaign selector (or show aggregate)
- Key metrics cards: Sent, Delivered, Opened, Clicked, Bounced, Unsubscribed
- Time series chart: Sends/Opens/Clicks over time
- Per-step funnel visualization
- Top performing campaigns table
- Export to CSV

// Data aggregation queries:
- SELECT COUNT(*) FROM email_logs WHERE status = 'delivered'
- SELECT COUNT(*) FROM email_logs WHERE opened_at IS NOT NULL
- etc.
```

### 9. ABTestingPanel.tsx (A/B Test Management)

```typescript
// Required features:
- List active A/B tests
- Create test: Select step, add variant
- Traffic split slider (50/50, 70/30, etc.)
- Winning metric selector (open rate, click rate)
- Statistical significance indicator
- Declare winner button
- Test results display

// Fields in sequence_steps:
ab_variant_id, ab_variant_name, ab_traffic_percentage
```

### 10. EnrollmentWizard.tsx (Enrollment Interface)

```typescript
// Required features:
- Select sequence from dropdown
- Choose source:
  - Manual: Paste emails
  - Segment: Select segment
  - All subscribers (with confirmation)
- Schedule: Immediate or future date
- Preview enrollment count
- Confirm and enroll
- Progress indicator for large batches

// API endpoints needed:
POST /api/admin/email/sequences/:id/enroll - Enroll subscribers
GET /api/admin/email/sequences/:id/enrollments - Enrollment history
```

---

## INTEGRATION POINTS

### Admin Dashboard Integration

Add "Email Campaigns" tab to existing admin dashboard:

```typescript
// src/components/admin/AdminDashboard.tsx
const tabs = [
  { id: 'overview', label: 'Overview', component: AdminOverview },
  { id: 'clients', label: 'Clients', component: ClientsManager },
  // ... existing tabs ...
  { id: 'email', label: 'Email Campaigns', component: EmailCampaignsManager }, // NEW
];
```

### Feature Flag

Enable email automation when admin UI is ready:

```sql
UPDATE feature_flags SET enabled = 1 WHERE key = 'email_automation_enabled';
```

### Dispatcher Activation

Once UI is built, the existing `email-dispatcher.ts` will automatically:
1. Query pending emails every 5 minutes
2. Personalize content with subscriber data
3. Queue for delivery via `email-consumer.ts`
4. Track opens/clicks via `resend.ts` webhooks

---

## QUALITY ASSURANCE STRATEGY

### Parallel Testing

While development proceeds, a dedicated agent runs:

1. **Unit Tests** - Component isolation tests
2. **API Tests** - Endpoint contract validation
3. **Integration Tests** - Full flow testing
4. **E2E Tests** - User journey simulation

### Test Coverage Targets

| Category | Target |
|----------|--------|
| API Endpoints | 100% |
| UI Components | 80% |
| Database Operations | 100% |
| Edge Cases | 90% |

### Continuous Integration

After each agent completes work:
1. Run `npm run build` - Verify compilation
2. Run `npm run test` - Execute test suite
3. Deploy to preview - Verify in staging
4. Merge to main - Production deploy

---

## RISK MITIGATION

### Risk 1: Merge Conflicts
**Mitigation:** Each agent works in isolated directories:
- Agent A: `src/components/admin/email/campaigns/`
- Agent B: `src/components/admin/email/subscribers/`
- Agent C: `src/components/admin/email/sequences/`
- Agent D: `src/components/admin/email/analytics/`

### Risk 2: API Contract Drift
**Mitigation:** Define interfaces upfront, all agents implement to spec.

### Risk 3: Performance with 42K Subscribers
**Mitigation:** Virtual scrolling, pagination, indexed queries from Day 1.

### Risk 4: Feature Creep
**Mitigation:** Strict scope - only build what's specified here.

---

## SUCCESS METRICS

### Day 1 Success
- [ ] Campaign list displays
- [ ] Subscriber list loads (virtualized)
- [ ] Quick fixes deployed
- [ ] 8+ API endpoints functional

### Day 3 Success
- [ ] Full campaign lifecycle working
- [ ] A/B testing functional
- [ ] Enrollment working
- [ ] Analytics displaying

### Day 5 Success (PROJECT COMPLETE)
- [ ] All 10 UI components built
- [ ] All ~30 API endpoints working
- [ ] PDF processing complete
- [ ] Production deployed
- [ ] Documentation complete
- [ ] 42,967 leads ready for enrollment

---

## COMMAND SEQUENCES

### Starting Day 1

```bash
# Agent A - Campaigns
claude "Build EmailCampaigns.tsx dashboard component and API endpoints for listing, creating, updating, deleting email sequences. Follow spec in AI_EXECUTION_PLAN.md"

# Agent B - Subscribers (parallel)
claude "Build EmailSubscribers.tsx list component with virtual scrolling for 42K+ records, filters, search, and bulk actions. Follow spec in AI_EXECUTION_PLAN.md"

# Agent C - Steps (parallel)
claude "Build SequenceStepEditor.tsx for managing email sequence steps with drag-drop reorder, conditions, and delays. Follow spec in AI_EXECUTION_PLAN.md"

# Agent D - Quick Fixes (parallel)
claude "Fix Quote Builder hardcoded contacts, add JWT auth to Menu Builder APIs, complete Square invoice generation. See SYSTEM_AUDIT.md for details."
```

### Integration Command

```bash
# After Day 1 components complete
claude "Integrate EmailCampaigns, EmailSubscribers, SequenceStepEditor into admin dashboard. Add 'Email Campaigns' tab. Run full test suite."
```

---

## ESTIMATED OUTCOMES

### Timeline Comparison

| Approach | Duration | Quality |
|----------|----------|---------|
| Single Human Developer | 13-17 days | Variable |
| Single AI Agent | 8-10 days | High |
| **4 Parallel AI Agents** | **5-6 days** | **Very High** |

### Code Quality

- TypeScript throughout (zero `any` types)
- Full error handling
- Loading states on all async operations
- Responsive design (mobile-first)
- Accessibility (ARIA labels, keyboard nav)
- Performance optimized (virtual scroll, pagination)

### Revenue Impact

Once complete:
- 42,967 leads can be enrolled in sequences
- 6 HubSpot sequences ready to deploy
- Automated nurturing drives conversions
- **OPERATION BREAKOUT unblocked**

---

**Plan Approved:** 2026-01-07
**Execution Start:** On User Command
**Expected Completion:** 5-6 days from start

