# Codebase Documentation
## R&G Consulting - Restaurant Consulting Website

**Last Updated:** 2026-01-07
**Completion:** 92% Production Ready
**Repository:** https://github.com/evanramirez88/restaurant-consulting-site

---

## QUICK REFERENCE

### Key Paths
```
Git Repo:     C:\Users\evanr\projects\restaurant-consulting-site
Business Docs: C:\Users\evanr\OneDrive\Desktop\restaurant-consulting-site
```

### Live URLs
- Production: https://ccrestaurantconsulting.com
- Pages Direct: https://restaurant-consulting-site.pages.dev

### Cloudflare Account
```
Email:      ramirezconsulting.rg@gmail.com
Account ID: 373a6cef1f9ccf5d26bfd9687a91c0a6
API Token:  24aujAQSZ8JEky8IFrnk7MeUhOrcn_Yj6MnsCCAk
```

---

## 1. TECHNOLOGY STACK

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React | 19.2.1 |
| Language | TypeScript | 5.8.2 |
| Build | Vite | 6.2.0 |
| Styling | Tailwind CSS | 4.1.17 |
| Router | React Router | 7.10.1 |
| Backend | Cloudflare Pages Functions | Latest |
| Database | Cloudflare D1 (SQLite) | Latest |
| Storage | Cloudflare R2 | Latest |
| Cache | Cloudflare KV | Latest |
| AI/ML | Cloudflare Workers AI | Latest |
| Email | Resend | Latest |
| CRM | HubSpot | Portal 243379742 |
| Payments | Square | Latest |
| Contracts | PandaDoc | Latest |
| Scheduling | Cal.com | v7 |

---

## 2. DIRECTORY STRUCTURE

```
restaurant-consulting-site/
├── src/components/           # React components
│   ├── admin/               # Admin dashboard (37 files)
│   │   ├── automation/      # Toast automation UI (9)
│   │   ├── email/           # Email campaigns (16)
│   │   ├── clients/         # Client management
│   │   ├── reps/            # Rep management
│   │   ├── tickets/         # Support tickets
│   │   └── ...
│   └── messaging/           # Message components (4)
├── pages/                   # Full-page components (20)
│   ├── portal/              # Client portal (9)
│   └── rep/                 # Rep portal (6)
├── functions/api/           # Cloudflare Functions (140+ endpoints)
│   ├── _shared/             # Shared utilities
│   ├── admin/               # Admin API (25+)
│   ├── admin/email/         # Email API (35+)
│   ├── auth/                # Admin auth
│   ├── client/auth/         # Client auth
│   ├── rep/[slug]/          # Rep portal API
│   ├── portal/[slug]/       # Client portal API
│   ├── quote/               # Quote system
│   ├── menu/                # Menu builder
│   ├── billing/             # Square billing
│   ├── automation/          # Toast automation
│   └── webhooks/            # External webhooks
├── migrations/              # D1 migrations (15)
├── docs/                    # Technical docs
├── hubspot-sequences/       # Email templates (6)
└── automation/              # Node.js scripts
```

---

## 3. DATABASE SCHEMA OVERVIEW

### Core Tables (8)
| Table | Purpose |
|-------|---------|
| `clients` | Client accounts with portal access |
| `restaurants` | Multi-location client restaurants |
| `reps` | Sales representatives |
| `referrals` | Rep referral tracking |
| `projects` | Client projects |
| `tickets` | Support tickets |
| `quotes` | Quote records |
| `menu_jobs` | Menu processing jobs |

### Email Automation (10)
| Table | Purpose |
|-------|---------|
| `email_sequences` | Campaign definitions |
| `sequence_steps` | Individual emails in drip |
| `email_templates` | Template library |
| `email_subscribers` | Lead database (42,967 potential) |
| `subscriber_sequences` | Progress tracking |
| `email_logs` | Delivery tracking |
| `email_suppression_list` | Bounce/complaint list |
| `ab_test_variants` | A/B test variants |
| `ab_test_enrollments` | Test participation |
| `send_time_preferences` | Optimal send times |

### Portal & Communication (5)
| Table | Purpose |
|-------|---------|
| `portals` | Portal configuration |
| `portal_sessions` | Session management |
| `message_threads` | Conversation groups |
| `messages` | Individual messages |
| `client_rep_assignments` | Rep-client relationships |

### Toast Automation (4)
| Table | Purpose |
|-------|---------|
| `toast_credentials` | Encrypted login credentials |
| `automation_jobs` | Job queue |
| `automation_job_steps` | Step progress |
| `toast_selectors` | UI element mappings |

### Configuration (6)
| Table | Purpose |
|-------|---------|
| `site_config` | Key-value store |
| `availability` | Status singleton |
| `feature_flags` | Feature toggles |
| `api_configs` | API settings |
| `audit_logs` | Activity tracking |
| `login_attempts` | Rate limiting |

---

## 4. API ENDPOINTS SUMMARY

### Authentication (12 endpoints)
- **Admin:** `/api/auth/login`, `/api/auth/verify`, `/api/auth/logout`
- **Client:** `/api/client/auth/*` (5 endpoints)
- **Rep:** `/api/rep/[slug]/auth/*` (4 endpoints)

### Admin Management (25 endpoints)
- **Clients:** `/api/admin/clients/*` (4)
- **Reps:** `/api/admin/reps/*` (4)
- **Tickets:** `/api/admin/tickets/*` (3)
- **Availability:** `/api/admin/availability/*` (3)
- **Configuration:** `/api/admin/api-configs`, `/api/admin/feature-flags`, etc. (7)

### Email Automation (35+ endpoints)
- **Sequences:** `/api/admin/email/sequences/*` (11)
- **Steps:** `/api/admin/email/sequences/[id]/steps/*` (7)
- **Templates:** `/api/admin/email/templates/*` (4)
- **Subscribers:** `/api/admin/email/subscribers/*` (7)
- **Segments:** `/api/admin/email/segments/*` (5)
- **A/B Tests:** `/api/admin/email/ab-tests/*` (5)
- **Analytics:** `/api/admin/email/analytics/*` (9)
- **Errors:** `/api/admin/email/errors/*` (7)

### Portal APIs (9 endpoints)
- **Client Portal:** `/api/portal/[slug]/*` (5)
- **Rep Portal:** `/api/rep/[slug]/*` (4)

### Feature APIs
- **Quote System:** `/api/quote/*` (7)
- **Menu Builder:** `/api/menu/*` (4)
- **Billing:** `/api/billing/*` (3)
- **Automation:** `/api/automation/*` (11)
- **Messaging:** `/api/messages/*` (4)
- **Contracts:** `/api/contracts/*` (3)
- **Toast Hub:** `/api/toast-hub/*` (3)

### Public APIs (5 endpoints)
- `/api/contact` - Contact form
- `/api/availability` - Status check
- `/api/config/*` - Public config

### Webhooks (3 endpoints)
- `/api/webhooks/resend` - Email events
- `/api/webhooks/square` - Payment events
- `/api/webhooks/pandadoc` - Contract events

---

## 5. REACT COMPONENTS

### Public Pages (12)
| Component | Path | Purpose |
|-----------|------|---------|
| `Home.tsx` | `/` | Landing page |
| `About.tsx` | `/about` | Company info + contact |
| `Services.tsx` | `/services` | Service offerings |
| `Schedule.tsx` | `/schedule` | Cal.com integration |
| `LocalNetworking.tsx` | `/local-networking` | Local services |
| `QuoteBuilder.tsx` | `/quote-builder` | Interactive floor planner |
| `MenuBuilder.tsx` | `/menu-builder` | OCR menu parser |
| `ToastAutomate.tsx` | `/toast-automate` | Toast automation info |
| `ToastHub.tsx` | `/toast-hub` | Blog listing |
| `ToastHubPost.tsx` | `/toast-hub/:slug` | Blog post |
| `AdminLogin.tsx` | `/admin/login` | Admin auth |
| `AdminDashboard.tsx` | `/admin` | Admin panel |

### Client Portal (9)
| Component | Path | Purpose |
|-----------|------|---------|
| `PortalLayout.tsx` | - | Navigation wrapper |
| `PortalLanding.tsx` | `/p/:slug` | Entry point |
| `PortalLogin.tsx` | `/p/:slug/login` | Magic link auth |
| `PortalDashboard.tsx` | `/p/:slug/dashboard` | Overview |
| `PortalProjects.tsx` | `/p/:slug/projects` | Project tracking |
| `PortalFiles.tsx` | `/p/:slug/files` | File browser |
| `PortalMessages.tsx` | `/p/:slug/messages` | Messaging |
| `PortalBilling.tsx` | `/p/:slug/billing` | Billing info |

### Rep Portal (6)
| Component | Path | Purpose |
|-----------|------|---------|
| `RepLayout.tsx` | - | Navigation wrapper |
| `RepLogin.tsx` | `/rep/:slug/login` | Magic link auth |
| `RepDashboard.tsx` | `/rep/:slug/dashboard` | Stats & clients |
| `RepClients.tsx` | `/rep/:slug/clients` | Client list |
| `RepReferrals.tsx` | `/rep/:slug/referrals` | Referral tracking |
| `RepMessages.tsx` | `/rep/:slug/messages` | Admin messages |

### Admin Components (37)

**Email Automation (16)**
- `EmailCampaigns.tsx` - Campaign management
- `EmailTemplateEditor.tsx` - Template builder
- `SequenceStepEditor.tsx` - Step configuration
- `ABTestingPanel.tsx` - A/B testing
- `SegmentBuilder.tsx` - Audience segmentation
- `EmailSubscribers.tsx` - Subscriber management
- `SubscriberImport.tsx` - Bulk import
- `EmailAnalytics.tsx` - Campaign metrics
- `EnrollmentWizard.tsx` - Enrollment flow
- `ErrorRecovery.tsx` - Error handling
- + 6 more support components

**Toast Automation (9)**
- `AutomationDashboard.tsx` - Overview
- `JobQueue.tsx` - Job listing
- `ManualTrigger.tsx` - Manual execution
- `ClientCredentials.tsx` - Credential management
- + 5 more support components

**Other Admin (12)**
- `ClientList.tsx` / `ClientForm.tsx`
- `RepList.tsx` / `RepForm.tsx`
- `TicketingDashboard.tsx`
- `PortalManagement.tsx`
- `ToastHubManager.tsx`
- + more

---

## 6. RESOURCE BINDINGS

### Cloudflare D1 Database
```
Name: rg-consulting-forms
ID: eb39c9a2-24ed-426e-9260-a1fb55d899cb
Binding: DB
```

### Cloudflare KV
```
Name: rg-consulting-sessions
ID: 57fda5bf0515423db01df17ed5b335e6
Binding: RATE_LIMIT_KV
```

### Cloudflare R2
```
Bucket: ccrc-uploads
Binding: R2_BUCKET
```

### Workers AI
```
Binding: AI
Status: Enabled
```

---

## 7. ENVIRONMENT VARIABLES

### Authentication
| Variable | Purpose |
|----------|---------|
| `ADMIN_PASSWORD_HASH` | SHA-256 admin password |
| `JWT_SECRET` | Admin JWT signing |
| `CLIENT_JWT_SECRET` | Client JWT signing |
| `CREDENTIAL_ENCRYPTION_KEY` | Toast credential encryption |
| `WORKER_API_KEY` | Internal API auth |

### External Services
| Variable | Service | Format |
|----------|---------|--------|
| `RESEND_API_KEY` | Email delivery | `re_*` |
| `HUBSPOT_API_KEY` | CRM sync | `pat-na2-*` |
| `SQUARE_ACCESS_TOKEN` | Payments | `EAAA*` |
| `SQUARE_APPLICATION_ID` | Square app | `sq0idp-*` |
| `PANDADOC_API_KEY` | E-signatures | API key |

### Square Locations
| Variable | Location |
|----------|----------|
| `SQUARE_LOCATION_ID_LANE_A` | L6GGMPCHFM6WR (Local) |
| `SQUARE_LOCATION_ID_LANE_B` | LB8GE5HYZJYB7 (National) |

---

## 8. FEATURE COMPLETION STATUS

| Feature | Status | Notes |
|---------|--------|-------|
| **Public Website** | 100% | All pages live |
| **Admin Dashboard** | 98% | 10 tabs functional |
| **Email Admin UI** | 95% | Full campaign management |
| **Client Portal** | 95% | 9 pages working |
| **Rep Portal** | 100% | Fully implemented |
| **Quote Builder** | 80% | PDF import WIP |
| **Menu Builder** | 75% | OCR working |
| **Toast Automation** | 60% | Framework only |
| **Billing Integration** | 50% | Square connected |

### Overall: 92% Production Ready

---

## 9. SECURITY IMPLEMENTATION

### CORS Configuration
- Dynamic origin validation (no wildcard)
- Allowed origins: production + dev environments
- Credentials support enabled

### Rate Limiting
| Endpoint | Limit | Window |
|----------|-------|--------|
| Contact Form | 5 | 5 min |
| Quote Form | 10 | 5 min |
| API Read | 100 | 1 min |
| API Write | 30 | 1 min |
| Auth Login | 5 | 15 min |

### Authentication
- Admin: Password + JWT
- Client: Magic link + JWT
- Rep: Magic link + JWT
- All JWTs expire in 24 hours

---

## 10. EXTERNAL INTEGRATIONS

### Active Integrations
| Service | Purpose | Status |
|---------|---------|--------|
| HubSpot | CRM (614 contacts) | Active |
| Resend | Email delivery | Active |
| Square | Payments (4 locations) | Active |
| Cal.com | Scheduling | Active |
| Cloudflare AI | OCR processing | Active |

### Configured (Not Active)
| Service | Purpose |
|---------|---------|
| PandaDoc | Contract e-signatures |

---

## 11. BUILD & DEPLOY

### Local Development
```bash
cd C:\Users\evanr\projects\restaurant-consulting-site
npm install
npm run dev     # Start dev server on port 3000
```

### Production Build
```bash
npm run build   # Output to dist/
```

### Deployment
- Automatic via Cloudflare Pages
- Trigger: Push to `main` branch
- Build command: `npm run build`
- Output directory: `dist`

### Database Migrations
```bash
# Local
wrangler d1 migrations apply rg-consulting-forms --local

# Production
wrangler d1 migrations apply rg-consulting-forms --remote
```

---

## 12. KEY FILES REFERENCE

### Configuration
| File | Purpose |
|------|---------|
| `vite.config.ts` | Vite build configuration |
| `wrangler.toml` | Cloudflare Pages config |
| `tsconfig.json` | TypeScript settings |
| `package.json` | Dependencies |
| `.dev.vars` | Local environment |

### Entry Points
| File | Purpose |
|------|---------|
| `index.html` | HTML shell |
| `index.tsx` | React entry |
| `App.tsx` | Router configuration |
| `index.css` | Global styles |

### Shared Utilities
| File | Purpose |
|------|---------|
| `functions/_shared/auth.js` | Auth utilities + CORS |
| `functions/_shared/rate-limit.js` | Rate limiting |
| `functions/_shared/square.js` | Square API |
| `functions/_shared/pandadoc.js` | PandaDoc API |
| `constants.ts` | Business constants |
| `types.ts` | TypeScript definitions |

### Documentation
| File | Purpose |
|------|---------|
| `MASTER_EXECUTION_PLAN.md` | Development roadmap |
| `CONTINUITY_LEDGER.md` | Session history |
| `CLOUDFLARE_STATUS.md` | Infrastructure |
| `CODEBASE_DOCUMENTATION.md` | This file |

---

## 13. COMMON TASKS

### Add New API Endpoint
1. Create file in `functions/api/[path].js`
2. Export `onRequestGet`, `onRequestPost`, etc.
3. Import auth utilities from `../_shared/auth.js`
4. Add CORS headers using `getCorsHeaders(request)`

### Add New React Component
1. Create file in `src/components/` or `pages/`
2. Add route in `App.tsx` if page component
3. Use Tailwind CSS for styling
4. Import icons from `lucide-react`

### Add Database Table
1. Create migration file: `migrations/00XX_[name].sql`
2. Run locally: `wrangler d1 migrations apply rg-consulting-forms --local`
3. Test thoroughly
4. Run in production: `--remote` flag

### Update Environment Variable
1. Add to `.dev.vars` for local
2. Add in Cloudflare Pages dashboard for production
3. Document in `CLOUDFLARE_STATUS.md`

---

**Document Version:** 1.0
**Created:** 2026-01-07
