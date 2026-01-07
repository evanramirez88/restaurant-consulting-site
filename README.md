# R&G Consulting - Restaurant Consulting Website

**Production URL:** https://ccrestaurantconsulting.com
**Owner:** R&G Consulting LLC (Evan M. Ramirez)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19.2.1 + TypeScript 5.8.2 + Vite 6.2.0 |
| Styling | Tailwind CSS 4.1.17 |
| Backend | Cloudflare Pages Functions |
| Database | Cloudflare D1 (SQLite) |
| Storage | Cloudflare R2 |
| Cache | Cloudflare KV |
| AI/OCR | Cloudflare Workers AI (LLaVA 1.5 7B) |
| Email | Resend API |
| CRM | HubSpot API |
| Payments | Square API |
| Scheduling | Cal.com API |
| Contracts | PandaDoc API |

---

## Project Structure

```
restaurant-consulting-site/
├── pages/                    # Page components
│   ├── portal/              # Client portal (9 pages)
│   ├── rep/                 # Rep portal (6 pages)
│   ├── QuoteBuilder.tsx     # Interactive quote builder (2,620 lines)
│   └── MenuBuilder.tsx      # AI-powered menu migration (1,204 lines)
├── src/
│   └── components/
│       └── admin/           # Admin dashboard components
├── functions/
│   └── api/                 # Cloudflare Pages Functions (83 endpoints)
│       ├── auth/            # Authentication
│       ├── admin/           # Admin management
│       ├── portal/          # Client portal API
│       ├── rep/             # Rep portal API
│       ├── quote/           # Quote system
│       ├── menu/            # Menu processing
│       ├── billing/         # Square integration
│       └── webhooks/        # External webhooks
├── migrations/              # D1 database migrations (12 files)
├── hubspot-sequences/       # Email sequence templates
├── docs/                    # Technical documentation
├── SYSTEM_AUDIT.md         # Current system status
├── CONTINUITY_LEDGER.md    # Session activity log
├── CLOUDFLARE_STATUS.md    # Infrastructure status
└── HUMAN_TASKS.md          # Human-required tasks
```

---

## Features

### Production Ready
- Public website (18 pages)
- Contact form with HubSpot + Resend integration
- Quote Builder - Interactive floor planning & pricing
- Menu Builder - AI-powered OCR menu migration
- Admin Dashboard (9 tabs, full CRUD)
- Client Portal (slug-based, magic link auth)
- Rep Portal (commission tracking, referrals)
- JWT authentication + magic links
- Feature flags system

### Partially Implemented
- Email Automation (backend 100%, admin UI 0%)
- Toast Automation (framework built)
- Billing/Invoicing (Square integration, incomplete)

---

## Quick Start

### Prerequisites
- Node.js 18+
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account with Pages access

### Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run with Cloudflare bindings (D1, R2, KV)
wrangler pages dev dist --d1=DB --r2=R2_BUCKET --kv=RATE_LIMIT_KV
```

### Database Migrations

```bash
# Local development
npm run db:migrate:local

# Production
npm run db:migrate
```

### Deploy

```bash
# Build
npm run build

# Deploy to Cloudflare Pages (auto-deploys on git push)
git push origin main
```

---

## Environment Variables

Configure in Cloudflare Pages Dashboard → Settings → Environment Variables:

| Variable | Required | Purpose |
|----------|----------|---------|
| ADMIN_PASSWORD_HASH | Yes | Admin auth (SHA-256) |
| JWT_SECRET | Yes | Session tokens |
| CLIENT_JWT_SECRET | Yes | Client portal auth |
| RESEND_API_KEY | Yes | Email delivery |
| HUBSPOT_API_KEY | Yes | CRM sync |
| SQUARE_ACCESS_TOKEN | Yes | Billing |
| SQUARE_APPLICATION_ID | Yes | Billing |

---

## API Endpoints (83 total)

| Category | Count | Base Path |
|----------|-------|-----------|
| Authentication | 12 | `/api/auth/*`, `/api/client/auth/*`, `/api/rep/*/auth/*` |
| Admin Management | 25 | `/api/admin/*` |
| Portal API | 15 | `/api/portal/*` |
| Quote System | 7 | `/api/quote/*` |
| Menu Processing | 3 | `/api/menu/*` |
| Billing | 5 | `/api/billing/*` |
| Messaging | 8 | `/api/messages/*` |
| Automation | 11 | `/api/automation/*` |
| Webhooks | 3 | `/api/webhooks/*` |
| Public | 5 | `/api/availability`, `/api/config` |

---

## Database Schema

40+ tables across these categories:
- **Core:** clients, reps, restaurants, projects, tickets, quotes
- **Portal:** portals, portal_sessions, message_threads, messages
- **Automation:** automation_jobs, toast_credentials, toast_selectors
- **Email:** email_sequences, sequence_steps, email_subscribers, email_logs (10 tables)
- **Billing:** payment_logs, invoices, support_hour_logs
- **System:** audit_logs, feature_flags, api_configs, site_content

---

## Current Status

**Overall Completion: 92%**

| Component | Status | Notes |
|-----------|--------|-------|
| Client Portal | 95% | 9/9 pages working |
| Rep Portal | 100% | 6/6 pages working |
| Quote Builder | 80% | Contact info configurable |
| Menu Builder | 75% | JWT auth added |
| Email Automation | 95% | Full admin UI + A/B testing + enrollment (Day 1-3) |
| Billing | 50% | Square integration improved |

See `SYSTEM_AUDIT.md` for detailed component analysis.

---

## Documentation

| File | Purpose |
|------|---------|
| SYSTEM_AUDIT.md | Comprehensive system audit |
| CONTINUITY_LEDGER.md | Session activity log |
| CLOUDFLARE_STATUS.md | Infrastructure configuration |
| HUMAN_TASKS.md | Tasks requiring human action |
| AI_EXECUTION_PLAN.md | AI agent development plan |
| docs/TOAST_AUTOMATION_INTEGRATION_PLAN.md | Toast automation specs |
| docs/PANDADOC_TEMPLATE_GUIDE.md | Contract template guide |

---

## Contributing

This is a private business repository. Development is managed through Claude Code CLI.

---

## License

Proprietary - R&G Consulting LLC

