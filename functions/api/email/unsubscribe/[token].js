/**
 * Email Unsubscribe Handler
 *
 * GET /api/email/unsubscribe/[token] - Display unsubscribe confirmation page
 * POST /api/email/unsubscribe/[token] - Process unsubscribe request
 *
 * Uses unique tokens per subscriber for secure unsubscribe without authentication
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

/**
 * Generate unsubscribe confirmation page HTML
 */
function generateUnsubscribePage(email, token, alreadyUnsubscribed = false) {
  const pageTitle = alreadyUnsubscribed
    ? 'Already Unsubscribed'
    : 'Unsubscribe from Emails';

  const content = alreadyUnsubscribed
    ? `
      <div class="status-message">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20,6 9,17 4,12"></polyline>
        </svg>
        <h2>You're Already Unsubscribed</h2>
        <p>The email address <strong>${email}</strong> is not currently subscribed to our mailing list.</p>
      </div>
    `
    : `
      <div class="unsubscribe-form">
        <h2>Unsubscribe from Our Emails</h2>
        <p>You are about to unsubscribe <strong>${email}</strong> from R&G Consulting email communications.</p>

        <form method="POST" action="/api/email/unsubscribe/${token}">
          <div class="reason-section">
            <label>Help us improve (optional):</label>
            <select name="reason">
              <option value="">Select a reason...</option>
              <option value="too_many">Too many emails</option>
              <option value="not_relevant">Content not relevant</option>
              <option value="never_signed_up">I never signed up</option>
              <option value="switched_services">Switched to a different service</option>
              <option value="other">Other reason</option>
            </select>
          </div>

          <button type="submit" class="unsubscribe-button">
            Confirm Unsubscribe
          </button>
        </form>

        <p class="note">You can always re-subscribe by contacting us at <a href="mailto:support@ccrestaurantconsulting.com">support@ccrestaurantconsulting.com</a></p>
      </div>
    `;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle} | R&G Consulting</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: #fff;
      border-radius: 12px;
      padding: 40px;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    .logo {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo h1 {
      color: #f59e0b;
      font-size: 24px;
      font-weight: 700;
    }
    .logo span {
      color: #64748b;
      font-size: 14px;
    }
    h2 {
      color: #1e293b;
      font-size: 20px;
      margin-bottom: 16px;
      text-align: center;
    }
    p {
      color: #475569;
      line-height: 1.6;
      margin-bottom: 20px;
      text-align: center;
    }
    strong {
      color: #1e293b;
    }
    .reason-section {
      margin-bottom: 24px;
    }
    label {
      display: block;
      color: #475569;
      margin-bottom: 8px;
      font-size: 14px;
    }
    select {
      width: 100%;
      padding: 12px;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      font-size: 16px;
      color: #1e293b;
      background: #fff;
      cursor: pointer;
    }
    select:focus {
      outline: none;
      border-color: #f59e0b;
    }
    .unsubscribe-button {
      width: 100%;
      padding: 14px 24px;
      background: #ef4444;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .unsubscribe-button:hover {
      background: #dc2626;
    }
    .note {
      font-size: 13px;
      color: #94a3b8;
      margin-top: 20px;
    }
    .note a {
      color: #f59e0b;
    }
    .status-message {
      text-align: center;
    }
    .icon {
      width: 64px;
      height: 64px;
      color: #22c55e;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <h1>R&G Consulting</h1>
      <span>Cape Cod Restaurant Consulting</span>
    </div>
    ${content}
  </div>
</body>
</html>
  `;
}

/**
 * Generate unsubscribe success page HTML
 */
function generateSuccessPage(email) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribed | R&G Consulting</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: #fff;
      border-radius: 12px;
      padding: 40px;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      text-align: center;
    }
    .logo {
      margin-bottom: 30px;
    }
    .logo h1 {
      color: #f59e0b;
      font-size: 24px;
      font-weight: 700;
    }
    .logo span {
      color: #64748b;
      font-size: 14px;
    }
    .icon {
      width: 64px;
      height: 64px;
      color: #22c55e;
      margin-bottom: 20px;
    }
    h2 {
      color: #1e293b;
      font-size: 20px;
      margin-bottom: 16px;
    }
    p {
      color: #475569;
      line-height: 1.6;
      margin-bottom: 20px;
    }
    strong {
      color: #1e293b;
    }
    .back-link {
      display: inline-block;
      margin-top: 20px;
      padding: 12px 24px;
      background: #f59e0b;
      color: #fff;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      transition: background 0.2s;
    }
    .back-link:hover {
      background: #d97706;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <h1>R&G Consulting</h1>
      <span>Cape Cod Restaurant Consulting</span>
    </div>
    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="20,6 9,17 4,12"></polyline>
    </svg>
    <h2>You've Been Unsubscribed</h2>
    <p><strong>${email}</strong> has been removed from our mailing list.</p>
    <p>We're sorry to see you go. If you change your mind, you can always contact us to re-subscribe.</p>
    <a href="https://ccrestaurantconsulting.com" class="back-link">Return to Website</a>
  </div>
</body>
</html>
  `;
}

/**
 * GET /api/email/unsubscribe/[token]
 * Display unsubscribe confirmation page
 */
export async function onRequestGet(context) {
  const { token } = context.params;
  const db = context.env.DB;

  try {
    // Find subscriber by unsubscribe token
    const subscriber = await db.prepare(`
      SELECT id, email, status
      FROM email_subscribers
      WHERE unsubscribe_token = ?
    `).bind(token).first();

    if (!subscriber) {
      return new Response('Invalid or expired unsubscribe link', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // Check if already unsubscribed
    const alreadyUnsubscribed = subscriber.status === 'unsubscribed';

    return new Response(
      generateUnsubscribePage(subscriber.email, token, alreadyUnsubscribed),
      {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      }
    );
  } catch (error) {
    console.error('[Unsubscribe] Error:', error);
    return new Response('An error occurred. Please try again later.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

/**
 * POST /api/email/unsubscribe/[token]
 * Process unsubscribe request
 */
export async function onRequestPost(context) {
  const { token } = context.params;
  const db = context.env.DB;
  const now = Math.floor(Date.now() / 1000);

  try {
    // Parse form data or JSON
    const contentType = context.request.headers.get('Content-Type') || '';
    let reason = null;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await context.request.formData();
      reason = formData.get('reason') || null;
    } else if (contentType.includes('application/json')) {
      const body = await context.request.json();
      reason = body.reason || null;
    }

    // Find subscriber by unsubscribe token
    const subscriber = await db.prepare(`
      SELECT id, email, status
      FROM email_subscribers
      WHERE unsubscribe_token = ?
    `).bind(token).first();

    if (!subscriber) {
      return new Response('Invalid or expired unsubscribe link', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // Skip if already unsubscribed
    if (subscriber.status === 'unsubscribed') {
      return new Response(generateSuccessPage(subscriber.email), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    // Get request metadata
    const ipAddress = context.request.headers.get('CF-Connecting-IP') || null;
    const userAgent = context.request.headers.get('User-Agent') || null;

    // Update subscriber status
    await db.prepare(`
      UPDATE email_subscribers
      SET status = 'unsubscribed',
          unsubscribed_at = ?,
          unsubscribe_reason = ?,
          unsubscribe_source = 'link',
          updated_at = ?
      WHERE id = ?
    `).bind(now, reason, now, subscriber.id).run();

    // Cancel all active sequences for this subscriber
    await db.prepare(`
      UPDATE subscriber_sequences
      SET status = 'unsubscribed',
          cancelled_at = ?,
          cancel_reason = 'User unsubscribed via email link',
          updated_at = ?
      WHERE subscriber_id = ? AND status IN ('active', 'processing', 'paused', 'queued')
    `).bind(now, now, subscriber.id).run();

    // Log unsubscribe event
    const logId = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO email_unsubscribe_log (
        id, subscriber_id, email, unsubscribe_token, reason, source,
        ip_address, user_agent, unsubscribed_at, created_at
      ) VALUES (?, ?, ?, ?, ?, 'link', ?, ?, ?, ?)
    `).bind(
      logId,
      subscriber.id,
      subscriber.email,
      token,
      reason,
      ipAddress,
      userAgent,
      now,
      now
    ).run();

    console.log(`[Unsubscribe] Successfully unsubscribed: ${subscriber.email}`);

    // Return success page
    return new Response(generateSuccessPage(subscriber.email), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  } catch (error) {
    console.error('[Unsubscribe] Error:', error);
    return new Response('An error occurred. Please try again later.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

/**
 * OPTIONS /api/email/unsubscribe/[token]
 * Handle CORS preflight
 */
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}
