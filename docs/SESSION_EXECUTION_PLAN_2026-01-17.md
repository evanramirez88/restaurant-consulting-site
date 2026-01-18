# Master Execution Plan - January 17, 2026

**Generated:** 2026-01-17 (Cowork Mode)
**Status:** Ready for parallel execution

---

## ⚠️ CRITICAL REQUIREMENT: MOBILE-FIRST DESIGN

**Restaurant operators primarily use tablets and mobile devices, NOT desktop computers.**

All UI work MUST:
- Be designed mobile-first, then scale up to desktop
- Work well on tablets (iPad, Android tablets)
- Have touch-friendly tap targets (min 44px)
- Avoid cluttered layouts - use progressive disclosure
- Maintain readability on small screens
- Use responsive breakpoints properly
- Test on actual mobile viewport sizes

**Priority order:** Mobile → Tablet → Desktop

---

## DISCOVERY SUMMARY

### Already Complete (No Work Needed)
| Item | Status | Notes |
|------|--------|-------|
| Cal.com → Email Enrollment | ✅ DONE | `functions/api/webhooks/calcom.js` fully wired |
| Welcome Sequence | ✅ EXISTS | `seq_welcome_001` active |
| Payment Failed Sequence | ✅ EXISTS | `seq_payment_failed_001` active |
| Square API Module | ✅ EXISTS | `functions/api/_shared/square.js` (469 lines) |
| Square Invoice API | ✅ EXISTS | `functions/api/billing/invoices.js` (287 lines) |

### Work Required
| Item | Effort | Session |
|------|--------|---------|
| Load 20 test leads | 15 min | THIS SESSION |
| Document Resend webhook setup | 10 min | THIS SESSION |
| Test Stripe Checkout | 20 min | THIS SESSION |
| Test Rep Portal lead conversion | 20 min | SESSION B |
| Add Square Invoice UI to Admin | 1-2 hrs | SESSION C |

---

## SESSION A: THIS SESSION (You + Claude) - ✅ COMPLETED

### ✅ Task 1: Load 20 Quality Test Leads
**STATUS: DONE**

Loaded 20 Cape Cod restaurant test leads:
- 5 Toast Existing (support plan upsell targets) - lead-001 to 005
- 5 POS Switchers (Clover/Square/Upserve) - lead-006 to 010
- 5 Contactable (have email + phone) - lead-011 to 015
- 5 High Value (score 80+) - lead-016 to 020

All leads have `source = 'test_import'` for easy filtering.

### ✅ Task 2: Resend Webhook Documentation
**STATUS: DONE** - See `docs/RESEND_WEBHOOK_MANUAL_SETUP.md`

### YOUR MANUAL STEPS (5-10 min):
1. Go to https://resend.com/webhooks
2. Click "Add Webhook"
3. URL: `https://ccrestaurantconsulting.com/api/webhooks/resend`
4. Events: bounced, complained, delivered, opened, clicked
5. Copy the signing secret (starts with `whsec_`)
6. Run in terminal:
   ```bash
   cd C:\Users\evanr\projects\restaurant-consulting-site
   npx wrangler pages secret put RESEND_WEBHOOK_SECRET
   # Paste the secret when prompted
   ```

### ✅ Task 3: Stripe Checkout Test
**STATUS: DONE** - Stripe checkout is working!

Test result:
```json
{
  "success": true,
  "data": {
    "url": "https://checkout.stripe.com/c/pay/cs_live_..."
  }
}
```

The checkout redirects to Stripe's hosted page correctly.

---

## SESSION B: Rep Portal Testing

**Prompt to paste into new Claude Code session:**

```
Read C:\Users\evanr\projects\restaurant-consulting-site\docs\SESSION_EXECUTION_PLAN_2026-01-17.md

Execute SESSION B: Rep Portal Lead-to-Client Conversion Testing

CRITICAL: All UI must work on mobile/tablet devices. Restaurant operators primarily use mobile.

Tasks:
1. Test the rep portal at /rep/[slug] with a test rep account
2. Test mobile responsiveness of rep portal (use Chrome DevTools mobile mode)
3. Test lead creation via Intel submission
4. Test lead → client conversion flow
5. Verify Quote Builder works from rep portal on mobile
6. Verify referral credit tracking
7. Document any mobile UX issues found
8. Fix any critical mobile layout problems

Project: C:\Users\evanr\projects\restaurant-consulting-site
```

---

## SESSION C: Square Invoice Admin UI (Mobile-First)

**Prompt to paste into new Claude Code session:**

```
Read C:\Users\evanr\projects\restaurant-consulting-site\docs\SESSION_EXECUTION_PLAN_2026-01-17.md

Execute SESSION C: Add Square Invoice Creation to Admin Dashboard

⚠️ CRITICAL: Design MOBILE-FIRST. Restaurant operators use tablets/phones, not desktops.

Context:
- Square API module exists: functions/api/_shared/square.js
- Invoice API exists: functions/api/billing/invoices.js
- Admin Dashboard: pages/AdminDashboard.tsx

Tasks:
1. Add "Create Invoice" button to Admin Dashboard (Billing or Clients section)
2. Create InvoiceModal component with MOBILE-FIRST design:
   - Touch-friendly inputs (min 44px tap targets)
   - Full-width fields on mobile
   - Large, clear buttons
   - Client selector dropdown
   - Line items (service, quantity, amount)
   - Due date picker (native date input)
   - Title and description fields
   - "Create & Send" button
3. Wire to POST /api/billing/invoices endpoint
4. Show success/error feedback with clear mobile-friendly toasts
5. Test on mobile viewport (375px width)
6. Optionally add invoice list view (card-based for mobile)

Focus: Simple, functional, mobile-friendly. Not elaborate desktop-only UI.

Project: C:\Users\evanr\projects\restaurant-consulting-site
```

---

## SESSION D: Intelligence Scheduler (Future/Optional)

**Prompt for future session:**

```
Read C:\Users\evanr\projects\restaurant-consulting-site\docs\SESSION_EXECUTION_PLAN_2026-01-17.md

Execute SESSION D: Deploy Intelligence Scheduler Worker

Context:
- Migration exists: migrations/0039_intelligence_scheduler.sql
- Agents defined: functions/api/intelligence/agents.js

Tasks:
1. Create workers/intelligence-scheduler.js
2. Configure cron schedule (4-7 AM daily)
3. Deploy with wrangler
4. Test agent task execution
5. Wire daily brief to email

Project: C:\Users\evanr\projects\restaurant-consulting-site
```

---

## QUICK REFERENCE

### API Endpoints (Working)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/billing/invoices` | POST | Create Square invoice |
| `/api/billing/invoices` | GET | List invoices |
| `/api/stripe/checkout` | POST | Create Stripe checkout |
| `/api/stripe/webhook` | POST | Stripe events |
| `/api/webhooks/calcom` | POST | Cal.com bookings |
| `/api/webhooks/resend` | POST | Email tracking |
| `/api/email/enroll` | POST | Sequence enrollment |

### Email Sequences (All Active)
- seq_welcome_001 - New subscriber
- seq_payment_failed_001 - Payment recovery
- seq_booking_confirm_001 - Booking confirmation
- seq_post_meeting_001 - Post-meeting followup
- seq_noshow_001 - No-show re-engagement
- seq_toast_support_001 - Toast support outreach
- seq_pos_switcher_001 - POS switcher outreach
- seq_menu_work_001 - Menu work outreach
- seq_local_network_001 - Local network outreach
- seq_transition_001 - Ownership transition

### Square Config
- Location Lane A: L6GGMPCHFM6WR (Local Cape Cod)
- Location Lane B: LB8GE5HYZJYB7 (National Remote)
- API configured in Cloudflare env vars

---

## EXECUTION ORDER

1. **NOW:** Load 20 test leads (this session)
2. **NOW:** Document Resend webhook (manual steps)
3. **NOW:** Test Stripe checkout
4. **PARALLEL:** Spin up Session B for rep portal testing
5. **PARALLEL:** Spin up Session C for Square invoice UI
6. **LATER:** Session D for intelligence scheduler

---

*Plan created by Cowork Mode*
*Ready for execution*
