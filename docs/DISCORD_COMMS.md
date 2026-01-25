# R&G Consulting - Discord Communication Channel

## Overview

The business platform has a dedicated Discord server with webhook-based notifications. Any AI CLI agent or automated process working on this project can send alerts, files, and status updates to Evan's phone instantly.

## Discord Server: R&G Consulting

| Item | Value |
|------|-------|
| **Guild ID** | `1241431364155347077` |
| **Category** | Business Platform |
| **Bot** | SAGE Bot#5442 (in server) |

### Channels

| Channel | ID | Purpose |
|---------|-----|---------|
| `#platform-alerts` | `1464565052387627174` | Leads, payments, bookings, form submissions |
| `#client-activity` | `1464565057806405633` | CRM updates, client interactions, HubSpot sync |
| `#system-status` | `1464565063619707013` | Website health, email dispatcher, infrastructure |
| `#owner-commands` | `1464565068929695836` | Evan sends commands to business platform |

### Webhook URLs

| Channel | Webhook |
|---------|---------|
| platform-alerts | `https://discord.com/api/webhooks/1464565074080305224/pb94oWNHtDZ5sEu5Dv51Rkz9hu4S5TtlLFmEysdOdQz8ErglawFkBOzmZJLh4nEGbGe5` |
| client-activity | `https://discord.com/api/webhooks/1464565079230906502/weOqMMTzwohnVf19YT2ivNvmMvk5BPC7uvFxLNg1q5UTs9klmX_v-_0SdhbmD8dtJGop` |
| system-status | `https://discord.com/api/webhooks/1464565084645888020/RMaMPESPGOCidzBY549xkT_x0aVkFf45Aork7ov7IbfyPx21tU9IdIDowxszy6kmE5M6` |

## Usage

### From Any CLI Session

```bash
# Quick business alert
node "D:\USER_DATA\Desktop\ANTIGRAVITY\SAGE_BRAIN\communication\channels\sage-notify.js" \
  --server rg-consulting --webhook platform-alerts \
  --agent "Email-Dispatcher" "New lead submitted: John's Pizza"

# System status update
node "D:\USER_DATA\Desktop\ANTIGRAVITY\SAGE_BRAIN\communication\channels\sage-notify.js" \
  --server rg-consulting --webhook system-status \
  --agent "Health-Monitor" "Website healthy, 23 emails sent today"

# Client activity
node "D:\USER_DATA\Desktop\ANTIGRAVITY\SAGE_BRAIN\communication\channels\sage-notify.js" \
  --server rg-consulting --webhook client-activity \
  --agent "HubSpot-Sync" "Contact updated: Jane Doe moved to 'Qualified Lead'"

# Send a file (quote, report, etc)
node "D:\USER_DATA\Desktop\ANTIGRAVITY\SAGE_BRAIN\communication\channels\sage-notify.js" \
  --server rg-consulting --webhook platform-alerts \
  --file ./generated-quote.pdf --agent "Quote-Builder" "New quote generated for Tony's Bistro"
```

### Direct Webhook (from Workers/Scripts)

```javascript
// Use in Cloudflare Workers, Node scripts, or any HTTP client
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1464565074080305224/pb94oWNHtDZ5sEu5Dv51Rkz9hu4S5TtlLFmEysdOdQz8ErglawFkBOzmZJLh4nEGbGe5';

await fetch(WEBHOOK_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'Email-Dispatcher',  // Shows as sender name
    embeds: [{
      title: 'New Lead',
      description: 'John Smith submitted contact form',
      color: 0x5865F2,  // Blue
      fields: [
        { name: 'Restaurant', value: "John's Pizza", inline: true },
        { name: 'POS', value: 'Toast', inline: true },
        { name: 'Location', value: 'Boston, MA', inline: true },
      ],
      timestamp: new Date().toISOString(),
    }]
  })
});
```

### From Python

```python
import subprocess
subprocess.run([
    'node',
    r'D:\USER_DATA\Desktop\ANTIGRAVITY\SAGE_BRAIN\communication\channels\sage-notify.js',
    '--server', 'rg-consulting',
    '--webhook', 'platform-alerts',
    '--agent', 'Lead-Enricher',
    '--priority', 'high',
    'High-value lead detected: Score 92, Toast user, 3 locations'
])
```

## Integration Points

### Email Dispatcher (Cloudflare Worker)
When emails are sent/bounced/opened, notify via `#platform-alerts`:
```javascript
// In the worker's send handler
await notifyDiscord('platform-alerts', {
  title: 'Email Delivered',
  description: `Sent to ${contact.email}`,
  color: 0x00FF00,
});
```

### Contact Form Submissions
When a form is submitted on ccrestaurantconsulting.com, notify via `#platform-alerts`:
```javascript
await notifyDiscord('platform-alerts', {
  title: 'New Form Submission',
  description: `${name} - ${restaurant}`,
  fields: [{ name: 'Email', value: email }],
});
```

### Cal.com Bookings
When a booking is made, notify via `#client-activity`:
```javascript
await notifyDiscord('client-activity', {
  title: 'New Booking',
  description: `${name} booked ${eventType}`,
  fields: [{ name: 'Time', value: startTime }],
});
```

### Stripe Payments
When a payment is received, notify via `#platform-alerts`:
```javascript
await notifyDiscord('platform-alerts', {
  title: 'Payment Received',
  description: `$${amount} from ${customer}`,
  color: 0x00FF00,
});
```

## Also Available: ntfy Push Notifications

For instant phone buzzes (lighter than Discord embeds):
```bash
node sage-notify.js --channel ntfy --priority high "New lead just submitted!"
```

ntfy topic: `sage-evan-2026` (install ntfy app, subscribe to this topic)

## Full Documentation

See: `D:\USER_DATA\Desktop\ANTIGRAVITY\SAGE_BRAIN\communication\COMMS_PROTOCOL.md`
