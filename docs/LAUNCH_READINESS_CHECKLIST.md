# Platform Launch Readiness Checklist

**Created:** 2026-01-16
**Target Launch:** Ready for soft launch NOW
**Overall Readiness:** 78%

---

## CRITICAL PATH - MUST COMPLETE BEFORE LAUNCH

### Email Marketing System

- [x] Email dispatcher cron configured (*/5 * * * *)
- [x] Resend API key configured (RESEND_API_KEY in Cloudflare)
- [x] 8 email sequences created and active
- [x] 22 email steps with full HTML content
- [x] Enrollment API working (/api/email/enroll)
- [x] Suppression list table ready
- [ ] **ACTION REQUIRED:** Run lead import to D1
  ```bash
  cd C:\Users\evanr\projects\restaurant-consulting-site
  node scripts/process_leads.cjs --import --limit 5000
  ```

### Billing System

- [x] Stripe account live (acct_1SpyMgGbzgCk7YTG)
- [x] 6 products created
- [x] 18 prices configured (monthly/quarterly/annual)
- [x] Checkout endpoint working (/api/stripe/checkout)
- [x] Customer Portal configured
- [x] Webhook endpoint deployed (/api/stripe/webhook)

### Lead Capture

- [x] Contact form working on website
- [x] Cal.com scheduling integrated
- [x] HubSpot syncing (215 contacts)
- [x] Quote Builder enabled
- [x] Menu Builder enabled (feature flag on)

### Infrastructure

- [x] Cloudflare Pages deployed
- [x] D1 database running
- [x] KV namespace configured
- [x] R2 bucket ready
- [x] Custom domain active (ccrestaurantconsulting.com)

---

## HIGH PRIORITY - COMPLETE WITHIN FIRST WEEK

### Lead Import & Enrollment

- [ ] Import Toast Upcoming segment (1,614 leads)
  ```bash
  node scripts/process_leads.cjs --import --segment B --limit 1614
  ```
- [ ] Import High Value segment (477 leads)
- [ ] Enroll Toast Upcoming in seq_toast_support_001
- [ ] Monitor first 24 hours of email delivery
- [ ] Check email_logs table for errors

### Monitoring Setup

- [ ] Verify Cloudflare cron is executing
  - Dashboard → Workers & Pages → rg-email-dispatcher → Cron Triggers
- [ ] Set up email delivery alerts
- [ ] Monitor Resend dashboard for bounces
- [ ] Check D1 database growth

### Local Business

- [ ] **HUMAN TASK:** Create Google Business Profile
  - Business name: R&G Consulting LLC (DBA Cape Cod Cable Contractors)
  - Address: Cape Cod, MA
  - Category: Business Consultant
  - Link to website

---

## MEDIUM PRIORITY - COMPLETE WITHIN 2 WEEKS

### Email Tracking Enhancements

- [ ] Implement Resend webhook handler
  - File: `functions/api/webhooks/resend.ts`
  - Events: open, click, bounce, complaint
- [ ] Update subscriber engagement_score on events
- [ ] Add open/click columns to email_logs
- [ ] Create analytics dashboard view

### Intelligence System Activation

- [ ] Configure Brave Search API key
- [ ] Connect Hunter agent to MA ABCC licensing
- [ ] Test Analyst agent with real POS data
- [ ] Run first Strategist daily brief

### Admin Portal Improvements

- [ ] Port FactReviewCard to admin dashboard
- [ ] Add profile completeness indicator
- [ ] Create lead pipeline visualization
- [ ] Add email campaign performance view

---

## LOW PRIORITY - COMPLETE WITHIN 30 DAYS

### Content & Marketing

- [ ] Document first 3 client case studies
- [ ] Add testimonials to website
- [ ] Create segment-specific landing pages
- [ ] Set up Google Analytics AI referral tracking

### System Optimization

- [ ] Enable send time optimization
- [ ] Implement dynamic segment refresh cron
- [ ] Add real-time lead scoring updates
- [ ] Configure local storage sync (Seagate)

### AI Phone System (Phase 4)

- [ ] Sign up for Retell.ai free tier
- [ ] Configure basic FAQ responses
- [ ] Test Twilio integration
- [ ] Create n8n workflow for call handling

---

## LAUNCH DAY VERIFICATION

### Morning Check (Before Announcing)

```bash
# 1. Verify website is live
curl -I https://ccrestaurantconsulting.com

# 2. Check D1 database
npx wrangler d1 execute ccrc-db --remote --command "SELECT COUNT(*) FROM restaurant_leads"

# 3. Verify email sequences active
npx wrangler d1 execute ccrc-db --remote --command "SELECT id, name, status FROM email_sequences"

# 4. Check Stripe products
curl https://ccrestaurantconsulting.com/api/stripe/health

# 5. Test contact form submission
# Submit test form on website

# 6. Verify Cal.com booking
# Test booking link: https://cal.com/r-g-consulting
```

### Monitoring Dashboard Links

- Cloudflare Dashboard: https://dash.cloudflare.com/373a6cef1f9ccf5d26bfd9687a91c0a6
- HubSpot Portal: https://app.hubspot.com/contacts/243379742
- Stripe Dashboard: https://dashboard.stripe.com
- Resend Dashboard: https://resend.com/emails
- Cal.com Dashboard: https://app.cal.com

---

## ROLLBACK PROCEDURES

### If Email System Fails

```bash
# Pause all sequences
npx wrangler d1 execute ccrc-db --remote --command "UPDATE email_sequences SET status = 'paused'"

# Check dispatcher logs
wrangler tail rg-email-dispatcher
```

### If Payment System Fails

- Fall back to manual Square invoicing
- Square Dashboard: https://squareup.com/dashboard/invoices
- Create manual invoice with support plan line item

### If Website Down

- Check Cloudflare Pages deployment status
- Verify DNS pointing to Pages
- Check for build errors in Cloudflare dashboard

---

## SUCCESS METRICS - WEEK 1

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Emails sent | 4,000+ | `SELECT COUNT(*) FROM email_logs WHERE status = 'sent'` |
| Delivery rate | >95% | Resend dashboard |
| Bounces | <2% | `SELECT COUNT(*) FROM email_logs WHERE status = 'bounced'` |
| Discovery calls | 5+ | Cal.com bookings |
| Website visits | 500+ | Cloudflare Analytics |

---

## EMERGENCY CONTACTS

| Role | Contact | When to Use |
|------|---------|-------------|
| Cloudflare Support | Dashboard tickets | Infrastructure issues |
| Resend Support | support@resend.com | Email delivery issues |
| Stripe Support | Dashboard tickets | Payment issues |
| Cal.com Support | support@cal.com | Scheduling issues |

---

**Checklist Last Updated:** 2026-01-16
**Next Review:** After first 100 emails sent
**Status:** READY FOR SOFT LAUNCH
