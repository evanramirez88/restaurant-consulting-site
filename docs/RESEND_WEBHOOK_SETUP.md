# Resend Webhook Setup Guide

## Overview

The Resend webhook handler processes email events to track delivery, engagement, and handle bounces/complaints. This ensures the email suppression list stays current and subscriber engagement metrics are accurate.

## Webhook Endpoint

```
POST https://ccrestaurantconsulting.com/api/webhooks/resend
```

## Supported Events

| Event | Action |
|-------|--------|
| `email.delivered` | Update email log status to delivered |
| `email.opened` | Track open engagement, update subscriber stats |
| `email.clicked` | Track click engagement, log clicked URLs |
| `email.bounced` | Add to suppression list, mark subscriber as bounced, cancel sequences |
| `email.complained` | Add to suppression list, mark subscriber as complained, cancel sequences |
| `email.sent` | Acknowledged (no action) |
| `email.delivery_delayed` | Acknowledged (no action) |

## Setup Instructions

### Step 1: Get Webhook Signing Secret

1. Log in to [Resend Dashboard](https://resend.com/webhooks)
2. Click "Create Webhook" or edit existing webhook
3. Set the endpoint URL to: `https://ccrestaurantconsulting.com/api/webhooks/resend`
4. Select events to receive:
   - `email.bounced`
   - `email.complained`
   - `email.delivered`
   - `email.opened`
   - `email.clicked`
5. Copy the **Signing Secret** (starts with `whsec_`)

### Step 2: Configure Cloudflare Environment Variable

Add the signing secret to Cloudflare Pages:

```bash
# Via Wrangler CLI
npx wrangler pages secret put RESEND_WEBHOOK_SECRET --project-name restaurant-consulting-site

# When prompted, paste the signing secret (whsec_...)
```

Or via Cloudflare Dashboard:
1. Go to Workers & Pages > restaurant-consulting-site
2. Settings > Environment Variables
3. Add `RESEND_WEBHOOK_SECRET` with the signing secret value
4. Deploy to apply changes

### Step 3: Run Database Migration

Apply the migration to add webhook tracking tables:

```bash
npx wrangler d1 execute ccrc-db --remote --file=migrations/0039_resend_webhook_enhancements.sql
```

### Step 4: Test the Webhook

1. In Resend Dashboard, use "Send Test" feature on the webhook
2. Check Cloudflare logs for webhook processing
3. Verify event appears in `resend_webhook_events` table

```sql
-- Check recent webhook events
SELECT * FROM resend_webhook_events ORDER BY created_at DESC LIMIT 10;
```

## Database Tables Used

### email_suppression_list
Stores permanently suppressed email addresses:
- Hard bounces
- Spam complaints
- Manual suppressions

### email_logs
Tracks individual email delivery and engagement:
- `status`: queued, sending, sent, delivered, opened, clicked, bounced, complained
- `open_count`, `click_count`: Engagement counts
- `clicks_json`: Array of clicked URLs

### email_subscribers
Subscriber engagement metrics:
- `total_emails_opened`, `total_emails_clicked`
- `last_email_opened_at`, `last_email_clicked_at`
- `engagement_score`: 0-100 score (opens +5, clicks +10)

### resend_webhook_events
Audit log of all incoming webhook events for debugging.

## Troubleshooting

### Webhook Returns 401 Unauthorized

- Verify `RESEND_WEBHOOK_SECRET` is set correctly
- Check that the secret includes the `whsec_` prefix
- Ensure the secret was deployed (redeploy if needed)

### Events Not Processing

Check Cloudflare logs:
```bash
npx wrangler pages deployment tail --project-name restaurant-consulting-site
```

Common issues:
- Missing `message_id` in event data (check if email was sent via API with ID)
- Subscriber not found in database (webhook fires but no matching record)

### Suppression List Not Updating

Verify the suppression list table:
```sql
-- Check recent suppressions
SELECT * FROM email_suppression_list
WHERE source = 'resend_webhook'
ORDER BY created_at DESC LIMIT 10;
```

### Signature Verification Failing

- Ensure you're using the correct signing secret (not API key)
- Check for whitespace in the secret value
- Verify the webhook URL matches exactly (including https://)

## Webhook Payload Examples

### email.bounced
```json
{
  "type": "email.bounced",
  "created_at": "2026-01-17T10:00:00.000Z",
  "data": {
    "email_id": "em_abc123",
    "from": "noreply@ccrestaurantconsulting.com",
    "to": ["bounced@example.com"],
    "subject": "Welcome to R&G Consulting",
    "bounce": {
      "type": "hard",
      "message": "550 5.1.1 The email account does not exist"
    }
  }
}
```

### email.complained
```json
{
  "type": "email.complained",
  "created_at": "2026-01-17T10:00:00.000Z",
  "data": {
    "email_id": "em_abc123",
    "from": "noreply@ccrestaurantconsulting.com",
    "to": ["user@example.com"],
    "subject": "Welcome to R&G Consulting"
  }
}
```

### email.opened
```json
{
  "type": "email.opened",
  "created_at": "2026-01-17T10:05:00.000Z",
  "data": {
    "email_id": "em_abc123",
    "from": "noreply@ccrestaurantconsulting.com",
    "to": ["user@example.com"],
    "subject": "Welcome to R&G Consulting",
    "open": {
      "timestamp": "2026-01-17T10:05:00.000Z",
      "user_agent": "Mozilla/5.0...",
      "ip_address": "192.168.1.1"
    }
  }
}
```

### email.clicked
```json
{
  "type": "email.clicked",
  "created_at": "2026-01-17T10:10:00.000Z",
  "data": {
    "email_id": "em_abc123",
    "from": "noreply@ccrestaurantconsulting.com",
    "to": ["user@example.com"],
    "subject": "Welcome to R&G Consulting",
    "click": {
      "link": "https://ccrestaurantconsulting.com/pricing",
      "timestamp": "2026-01-17T10:10:00.000Z",
      "user_agent": "Mozilla/5.0...",
      "ip_address": "192.168.1.1"
    }
  }
}
```

## Security Notes

1. **Signature Verification**: All webhooks are verified using Svix HMAC-SHA256 signatures
2. **Timestamp Tolerance**: Webhooks older than 5 minutes are rejected (replay attack prevention)
3. **HTTPS Only**: Webhooks are only accepted over HTTPS
4. **No PII Logging**: Raw email content is not logged, only event metadata

## Related Documentation

- [Email Admin Guide](./EMAIL_ADMIN_GUIDE.md)
- [Stripe Billing Integration](./STRIPE_BILLING_INTEGRATION.md)
- [Resend API Documentation](https://resend.com/docs/api-reference/webhooks)

---

Last Updated: 2026-01-17
