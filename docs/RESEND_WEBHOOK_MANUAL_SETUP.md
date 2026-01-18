# Resend Webhook Manual Setup Guide

**Time Required:** 5-10 minutes
**Prerequisites:** Resend account with verified domain

---

## Step 1: Create Webhook in Resend Dashboard

1. Go to **https://resend.com/webhooks**
2. Click **"Add Webhook"**
3. Configure:
   - **Endpoint URL:** `https://ccrestaurantconsulting.com/api/webhooks/resend`
   - **Events to subscribe:**
     - ✅ `email.bounced` - Track hard bounces
     - ✅ `email.complained` - Track spam complaints
     - ✅ `email.delivered` - Confirm delivery
     - ✅ `email.opened` - Track opens (engagement)
     - ✅ `email.clicked` - Track clicks (engagement)
4. Click **"Create Webhook"**
5. **IMPORTANT:** Copy the signing secret (starts with `whsec_...`)

---

## Step 2: Add Secret to Cloudflare

Open terminal in the project directory and run:

```bash
cd C:\Users\evanr\projects\restaurant-consulting-site
npx wrangler pages secret put RESEND_WEBHOOK_SECRET
```

When prompted, paste the signing secret from Step 1.

---

## Step 3: Test the Webhook

1. In Resend dashboard, go to your webhook
2. Click **"Send Test"**
3. Select any event type
4. Click **"Send"**
5. Check the webhook status shows "200 OK"

---

## Step 4: Verify in Database

After testing, check that events are being recorded:

```bash
npx wrangler d1 execute rg-consulting-forms --remote --command "SELECT * FROM resend_webhook_events ORDER BY created_at DESC LIMIT 5"
```

---

## What the Webhook Does

The webhook handler at `/api/webhooks/resend` will:

1. **Verify signature** - Ensures request is from Resend
2. **Log events** - Stores in `resend_webhook_events` table
3. **Update email logs** - Marks emails as delivered/bounced/etc
4. **Handle bounces** - Adds to suppression list
5. **Handle complaints** - Adds to suppression list, pauses sequences
6. **Track engagement** - Updates open/click counts

---

## Troubleshooting

### Webhook returns 401
- Secret not configured or wrong
- Run `npx wrangler pages secret put RESEND_WEBHOOK_SECRET` again

### Webhook returns 500
- Check Cloudflare Pages logs: `wrangler pages deployment tail`
- Verify table exists: `resend_webhook_events`

### Events not showing in database
- Ensure D1 binding is correct in wrangler.toml
- Check that migration 0039_resend_webhook_enhancements.sql was applied

---

## Resend Dashboard Links

- Webhooks: https://resend.com/webhooks
- API Keys: https://resend.com/api-keys
- Emails Sent: https://resend.com/emails
- Domain Verification: https://resend.com/domains

---

*Last Updated: 2026-01-17*
