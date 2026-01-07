# Email Admin System - User Guide

## Overview

The Email Admin system provides comprehensive email marketing capabilities for Cape Cod Restaurant Consulting. This guide covers all features available in the admin dashboard.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Email Templates](#email-templates)
3. [Email Sequences](#email-sequences)
4. [Subscriber Management](#subscriber-management)
5. [Segments](#segments)
6. [Analytics](#analytics)
7. [A/B Testing](#ab-testing)
8. [Error Handling](#error-handling)
9. [Best Practices](#best-practices)

---

## Getting Started

### Accessing the Admin Dashboard

1. Navigate to `https://ccrestaurantconsulting.com/admin`
2. Log in with your admin credentials
3. Select "Email" from the sidebar navigation

### Dashboard Overview

The email dashboard displays:
- Total subscribers count
- Recent sends and performance
- Active sequences status
- Any pending errors requiring attention

---

## Email Templates

Templates are reusable email designs that can be used for one-off sends or automated sequences.

### Creating a Template

1. Navigate to **Email > Templates**
2. Click **"New Template"**
3. Fill in the required fields:
   - **Name**: Internal identifier (not shown to recipients)
   - **Subject**: Email subject line (supports variables)
   - **Content**: HTML email body

### Using Variables

Templates support dynamic variables using double curly braces:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{firstName}}` | Subscriber's first name | "John" |
| `{{lastName}}` | Subscriber's last name | "Smith" |
| `{{email}}` | Subscriber's email | "john@example.com" |
| `{{company}}` | Company name | "Joe's Diner" |
| `{{unsubscribeUrl}}` | Unsubscribe link | Auto-generated |

### Template Types

- **Transactional**: Order confirmations, receipts, notifications
- **Marketing**: Newsletters, promotions, announcements
- **Sequence**: Templates used in automated email sequences

### Preview and Testing

Before sending:
1. Click **"Preview"** to see rendered template
2. Click **"Send Test"** to receive a test email
3. Enter your email address and click send

---

## Email Sequences

Sequences are automated email campaigns triggered by specific events.

### Creating a Sequence

1. Navigate to **Email > Sequences**
2. Click **"New Sequence"**
3. Configure:
   - **Name**: Sequence identifier
   - **Trigger**: What starts the sequence
   - **Steps**: Individual emails in the sequence

### Trigger Types

| Trigger | Description |
|---------|-------------|
| **Signup** | When someone subscribes |
| **Tag** | When a specific tag is added |
| **Manual** | Manually enrolled by admin |

### Adding Steps

Each step requires:
- **Template**: Which email to send
- **Delay**: Time to wait before sending (days/hours)
- **Conditions**: Optional criteria for sending

Example sequence:
```
Step 1: Welcome email (immediately)
Step 2: Getting started guide (2 days)
Step 3: Feature highlights (5 days)
Step 4: Check-in email (14 days)
```

### Managing Sequences

- **Pause**: Temporarily stop all sends
- **Resume**: Continue paused sequence
- **Duplicate**: Copy sequence structure

### Viewing Enrollments

1. Click on a sequence
2. Select **"Enrollments"** tab
3. View active, completed, and cancelled enrollments

---

## Subscriber Management

### Adding Subscribers

**Single Subscriber:**
1. Navigate to **Email > Subscribers**
2. Click **"Add Subscriber"**
3. Enter email and optional details
4. Click **Save**

**Bulk Import:**
1. Navigate to **Email > Subscribers > Import**
2. Upload CSV file with headers: `email, firstName, lastName, company`
3. Map columns to fields
4. Click **Import**

### Subscriber Status

| Status | Description |
|--------|-------------|
| **Active** | Can receive emails |
| **Unsubscribed** | Opted out, no emails sent |
| **Bounced** | Email address invalid |

### Managing Subscribers

- **Edit**: Update subscriber information
- **View History**: See all emails sent to subscriber
- **Add Tags**: Categorize for segmentation
- **Unsubscribe**: Manually opt out subscriber

### Exporting Subscribers

1. Navigate to **Email > Subscribers > Export**
2. Select format (CSV or JSON)
3. Optionally filter by segment
4. Click **Export**

---

## Segments

Segments are dynamic groups of subscribers based on rules.

### Creating a Segment

1. Navigate to **Email > Segments**
2. Click **"New Segment"**
3. Define rules:
   - Field to check
   - Operator (equals, contains, etc.)
   - Value to match

### Rule Examples

| Use Case | Rule |
|----------|------|
| Restaurant owners | `company` contains "restaurant" |
| New subscribers | `createdAt` greater than "30 days ago" |
| Tagged leads | `tags` contains "hot-lead" |

### Using Segments

- Target email sends to specific segments
- Enroll segment members in sequences
- View segment analytics

---

## Analytics

### Overview Metrics

| Metric | Description |
|--------|-------------|
| **Sends** | Total emails sent |
| **Opens** | Unique opens (%) |
| **Clicks** | Unique clicks (%) |
| **Bounces** | Failed deliveries |
| **Unsubscribes** | Opt-out rate |

### Time Series Reports

View trends over time:
1. Navigate to **Email > Analytics**
2. Select metric and date range
3. Choose interval (hour/day/week/month)

### Top Content

See best performing:
- Templates by open rate
- Links by click rate
- Sequences by completion rate

### Exporting Reports

1. Configure desired report
2. Click **"Export"**
3. Download CSV for further analysis

---

## A/B Testing

Test different versions of emails to optimize performance.

### Creating an A/B Test

1. Navigate to **Email > A/B Tests**
2. Click **"New Test"**
3. Configure:
   - **Name**: Test identifier
   - **Variant A**: First template
   - **Variant B**: Second template
   - **Metric**: Opens or clicks
   - **Sample Size**: Recipients per variant

### Running Tests

1. Create test with both variants
2. Click **"Start Test"**
3. System sends to sample audience
4. Monitor results in real-time

### Declaring a Winner

1. Review test results
2. Ensure statistical significance
3. Click **"Declare Winner"**
4. Winning variant becomes default

### Best Practices

- Test one variable at a time (subject, CTA, etc.)
- Use adequate sample sizes (100+ per variant)
- Wait for statistical significance before deciding

---

## Error Handling

### Error Types

| Type | Description | Action |
|------|-------------|--------|
| **Bounce** | Invalid email address | Remove or update |
| **Complaint** | Marked as spam | Auto-unsubscribed |
| **Failed** | Temporary delivery failure | Retry possible |

### Resolving Errors

1. Navigate to **Email > Errors**
2. Filter by error type
3. For each error:
   - **Retry**: Attempt to resend (failed only)
   - **Suppress**: Prevent future sends
   - **Resolve**: Mark as handled

### Bulk Actions

- **Bulk Retry**: Retry all failed emails
- **Bulk Suppress**: Suppress multiple addresses
- **Bulk Resolve**: Clear resolved errors

---

## Best Practices

### Email Deliverability

1. **Maintain clean lists**: Remove bounces promptly
2. **Honor unsubscribes**: Never email opted-out addresses
3. **Use consistent From address**: Build sender reputation
4. **Include unsubscribe link**: Required by law (CAN-SPAM)

### Content Guidelines

1. **Clear subject lines**: Be specific, avoid spam triggers
2. **Mobile-friendly design**: Most opens are on mobile
3. **Personalize when possible**: Use subscriber variables
4. **Clear call-to-action**: One primary CTA per email

### Send Timing

1. **Respect quiet hours**: Default 9 PM - 8 AM local time
2. **Consider time zones**: Subscriber's local time
3. **Test optimal times**: A/B test send times

### Compliance

- **CAN-SPAM**: Include physical address, unsubscribe link
- **GDPR**: Obtain explicit consent for EU subscribers
- **CCPA**: Honor California privacy requests

---

## Troubleshooting

### Common Issues

**Emails not sending:**
- Check Resend API key is configured
- Verify subscriber is active status
- Check for rate limiting

**Low open rates:**
- Review subject lines
- Check spam folder placement
- Verify from address reputation

**Images not displaying:**
- Use absolute URLs for images
- Host images on reliable CDN
- Add alt text fallbacks

### Getting Help

- Check API documentation: `/docs/api/email-api.yaml`
- Contact support: ramirezconsulting.rg@gmail.com

---

Last Updated: January 2026
Version: 1.0
