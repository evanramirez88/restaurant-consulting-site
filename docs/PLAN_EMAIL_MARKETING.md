# Email Marketing System Plan
## Tracking, Analytics, and Sequency Feature Parity
**Created:** January 26, 2026
**Priority:** HIGH

---

## Issues Addressed

| ID | Severity | Issue |
|----|----------|-------|
| EM-1 | HIGH | 0% open/click rates across 300+ sent emails |
| EM-4 | HIGH | Missing features vs Sequency reference |
| EM-2/EM-3 | CRITICAL | D1 schema errors (see PLAN_DATABASE_FIXES.md) |

---

## Current State Analysis

### What's Working
- Email dispatcher: 100/day cap, 25/run batches
- 8 sequences with 22 steps defined
- 77 subscribers enrolled (50 POS Switcher, 27 Toast Support)
- Resend integration for sending
- Basic webhook endpoint exists

### What's Broken
- **Open tracking**: No 1x1 pixel in email templates
- **Click tracking**: Links not wrapped with redirect tracking
- **Webhook processing**: Events received but not updating email_logs
- **Conversion tracking**: No attribution from email → client

---

## Phase 1: Fix Email Tracking (Week 1)

### 1.1 Add Tracking Pixel to Templates

**File:** `functions/api/email/send.js` (or wherever email HTML is generated)

```javascript
// Add before closing </body> tag in every email
const trackingPixel = `<img src="https://ccrestaurantconsulting.com/api/email/track/open/${emailLogId}" width="1" height="1" style="display:none" alt="" />`;
```

**Endpoint:** `functions/api/email/track/open/[id].js`

```javascript
export async function onRequestGet(context) {
  const { id } = context.params;
  const db = context.env.DB;
  const now = Math.floor(Date.now() / 1000);

  // Record open event
  await db.prepare(`
    UPDATE email_logs
    SET opened_at = COALESCE(opened_at, ?),
        open_count = COALESCE(open_count, 0) + 1,
        updated_at = ?
    WHERE id = ?
  `).bind(now, now, id).run();

  // Return 1x1 transparent GIF
  const pixel = new Uint8Array([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00,
    0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
    0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
    0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
    0x01, 0x00, 0x3b
  ]);

  return new Response(pixel, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    }
  });
}
```

### 1.2 Wrap Links for Click Tracking

**Function:** `wrapLinksForTracking(html, emailLogId)`

```javascript
function wrapLinksForTracking(html, emailLogId) {
  // Replace href="URL" with href="tracking-redirect?url=URL&id=emailLogId"
  return html.replace(
    /href="(https?:\/\/[^"]+)"/gi,
    (match, url) => {
      const encodedUrl = encodeURIComponent(url);
      return `href="https://ccrestaurantconsulting.com/api/email/track/click/${emailLogId}?url=${encodedUrl}"`;
    }
  );
}
```

**Endpoint:** `functions/api/email/track/click/[id].js`

```javascript
export async function onRequestGet(context) {
  const { id } = context.params;
  const url = new URL(context.request.url);
  const destinationUrl = url.searchParams.get('url');
  const db = context.env.DB;
  const now = Math.floor(Date.now() / 1000);

  // Record click event
  await db.prepare(`
    UPDATE email_logs
    SET clicked_at = COALESCE(clicked_at, ?),
        click_count = COALESCE(click_count, 0) + 1,
        last_clicked_url = ?,
        updated_at = ?
    WHERE id = ?
  `).bind(now, destinationUrl, now, id).run();

  // Redirect to actual destination
  return Response.redirect(decodeURIComponent(destinationUrl), 302);
}
```

### 1.3 Fix Resend Webhook Handler

**File:** `functions/api/webhooks/resend.js`

**Current Issue:** Webhook receives events but doesn't update email_logs correctly

**Fix:**
```javascript
export async function onRequestPost(context) {
  const body = await context.request.json();
  const db = context.env.DB;
  const now = Math.floor(Date.now() / 1000);

  // Resend sends email_id in webhook payload
  const { type, data } = body;
  const resendId = data.email_id;

  // Find our email_log by resend_id
  const emailLog = await db.prepare(`
    SELECT id FROM email_logs WHERE resend_id = ? OR message_id = ?
  `).bind(resendId, resendId).first();

  if (!emailLog) {
    console.error(`No email_log found for resend_id: ${resendId}`);
    return new Response('OK', { status: 200 });
  }

  switch (type) {
    case 'email.delivered':
      await db.prepare(`
        UPDATE email_logs
        SET status = 'delivered', delivered_at = ?, updated_at = ?
        WHERE id = ?
      `).bind(now, now, emailLog.id).run();
      break;

    case 'email.opened':
      await db.prepare(`
        UPDATE email_logs
        SET opened_at = COALESCE(opened_at, ?),
            open_count = COALESCE(open_count, 0) + 1,
            updated_at = ?
        WHERE id = ?
      `).bind(now, now, emailLog.id).run();
      break;

    case 'email.clicked':
      await db.prepare(`
        UPDATE email_logs
        SET clicked_at = COALESCE(clicked_at, ?),
            click_count = COALESCE(click_count, 0) + 1,
            updated_at = ?
        WHERE id = ?
      `).bind(now, now, emailLog.id).run();
      break;

    case 'email.bounced':
      await db.prepare(`
        UPDATE email_logs
        SET status = 'bounced',
            error_type = 'bounced',
            error_message = ?,
            failed_at = ?,
            updated_at = ?
        WHERE id = ?
      `).bind(data.bounce_type || 'unknown', now, now, emailLog.id).run();

      // Also mark subscriber as bounced
      await db.prepare(`
        UPDATE email_subscribers
        SET status = 'bounced', bounced_at = ?
        WHERE id = (SELECT subscriber_id FROM email_logs WHERE id = ?)
      `).bind(now, emailLog.id).run();
      break;

    case 'email.complained':
      await db.prepare(`
        UPDATE email_logs
        SET status = 'complained', updated_at = ?
        WHERE id = ?
      `).bind(now, emailLog.id).run();

      // Mark subscriber as unsubscribed
      await db.prepare(`
        UPDATE email_subscribers
        SET status = 'unsubscribed', complained_at = ?
        WHERE id = (SELECT subscriber_id FROM email_logs WHERE id = ?)
      `).bind(now, emailLog.id).run();
      break;
  }

  return new Response('OK', { status: 200 });
}
```

---

## Phase 2: Analytics Dashboard (Week 2)

### 2.1 Campaign Metrics API

**File:** `functions/api/admin/email/campaigns/[id]/metrics.js`

```javascript
export async function onRequestGet(context) {
  const { id } = context.params;
  const db = context.env.DB;

  const metrics = await db.prepare(`
    SELECT
      COUNT(*) as total_sent,
      SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
      SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
      SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked,
      SUM(CASE WHEN status = 'bounced' THEN 1 ELSE 0 END) as bounced,
      SUM(CASE WHEN converted_at IS NOT NULL THEN 1 ELSE 0 END) as converted,
      SUM(COALESCE(open_count, 0)) as total_opens,
      SUM(COALESCE(click_count, 0)) as total_clicks
    FROM email_logs
    WHERE sequence_id = ?
  `).bind(id).first();

  const rates = {
    delivery_rate: metrics.total_sent > 0 ? (metrics.delivered / metrics.total_sent * 100).toFixed(1) : 0,
    open_rate: metrics.delivered > 0 ? (metrics.opened / metrics.delivered * 100).toFixed(1) : 0,
    click_rate: metrics.opened > 0 ? (metrics.clicked / metrics.opened * 100).toFixed(1) : 0,
    conversion_rate: metrics.clicked > 0 ? (metrics.converted / metrics.clicked * 100).toFixed(1) : 0,
    bounce_rate: metrics.total_sent > 0 ? (metrics.bounced / metrics.total_sent * 100).toFixed(1) : 0
  };

  return Response.json({ success: true, data: { ...metrics, ...rates } });
}
```

### 2.2 Update Campaign List Component

**File:** `src/components/admin/email/CampaignList.tsx`

**Change:** Replace hardcoded 0% rates with API-fetched metrics

```typescript
// Fetch real metrics for each campaign
useEffect(() => {
  campaigns.forEach(async (campaign) => {
    const res = await fetch(`/api/admin/email/campaigns/${campaign.id}/metrics`);
    const data = await res.json();
    setCampaignMetrics(prev => ({ ...prev, [campaign.id]: data.data }));
  });
}, [campaigns]);
```

---

## Phase 3: Sequency Feature Parity (Weeks 3-4)

### Features to Implement

| Feature | Priority | Effort |
|---------|----------|--------|
| Unsubscribe Management | HIGH | 1 day |
| Bounce Auto-Suppression | HIGH | 1 day |
| Email Preview | MEDIUM | 2 days |
| A/B Subject Testing | MEDIUM | 3 days |
| Engagement Scoring | LOW | 2 days |
| Visual Sequence Builder | LOW | 5 days |

### 3.1 Unsubscribe Flow

**Endpoint:** `functions/api/email/unsubscribe/[token].js`

- Generate unique unsubscribe token per subscriber
- Add unsubscribe link to email footer
- Landing page with confirmation
- Update subscriber status to 'unsubscribed'
- Log unsubscribe event

### 3.2 Bounce Auto-Suppression

- On bounce webhook: mark subscriber as bounced
- Prevent future sends to bounced addresses
- Admin can manually reactivate

### 3.3 Email Preview

**Component:** `EmailPreviewModal.tsx`

- Render email template with sample data
- Show desktop and mobile views
- Test send to admin email

---

## Database Schema Additions

**File:** `migrations/0084_email_tracking_enhancements.sql`

```sql
-- Add tracking columns to email_logs
ALTER TABLE email_logs ADD COLUMN open_count INTEGER DEFAULT 0;
ALTER TABLE email_logs ADD COLUMN click_count INTEGER DEFAULT 0;
ALTER TABLE email_logs ADD COLUMN last_clicked_url TEXT;
ALTER TABLE email_logs ADD COLUMN delivered_at INTEGER;

-- Add unsubscribe tracking
ALTER TABLE email_subscribers ADD COLUMN unsubscribe_token TEXT UNIQUE;
ALTER TABLE email_subscribers ADD COLUMN unsubscribe_reason TEXT;

-- Create index for token lookups
CREATE INDEX IF NOT EXISTS idx_subscribers_unsubscribe_token ON email_subscribers(unsubscribe_token);

-- A/B testing support
CREATE TABLE IF NOT EXISTS email_ab_tests (
  id TEXT PRIMARY KEY,
  sequence_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  variant_a_subject TEXT NOT NULL,
  variant_b_subject TEXT NOT NULL,
  variant_a_sent INTEGER DEFAULT 0,
  variant_b_sent INTEGER DEFAULT 0,
  variant_a_opens INTEGER DEFAULT 0,
  variant_b_opens INTEGER DEFAULT 0,
  winner TEXT,
  status TEXT DEFAULT 'running',
  created_at INTEGER DEFAULT (unixepoch())
);

-- Engagement scoring
ALTER TABLE email_subscribers ADD COLUMN engagement_score INTEGER DEFAULT 50;
ALTER TABLE email_subscribers ADD COLUMN last_engagement_at INTEGER;
```

---

## Verification Checklist

### Phase 1
- [ ] Tracking pixel renders in email HTML
- [ ] Open event records in email_logs
- [ ] Click tracking redirects work
- [ ] Resend webhooks update email_logs
- [ ] Bounce/complaint marks subscriber appropriately

### Phase 2
- [ ] Campaign list shows real open/click rates
- [ ] Individual campaign metrics endpoint works
- [ ] Rates update within 5 minutes of event

### Phase 3
- [ ] Unsubscribe link in all emails
- [ ] Unsubscribe flow works end-to-end
- [ ] Bounced subscribers auto-suppressed
- [ ] Email preview modal functional

---

## Resend Webhook Configuration

**Resend Dashboard:** https://resend.com/webhooks

**Webhook URL:** `https://ccrestaurantconsulting.com/api/webhooks/resend`

**Events to Enable:**
- email.sent
- email.delivered
- email.opened
- email.clicked
- email.bounced
- email.complained

**Verification:**
1. Send test email
2. Check Resend webhook logs
3. Verify email_logs updated

---

*Author: Claude Opus 4.5*
*For: R&G Consulting Platform*
