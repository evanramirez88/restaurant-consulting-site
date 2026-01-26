// Toast Hub Newsletter Subscription
// POST /api/toast-hub/subscribe - Subscribe to Toast Hub newsletter
// Public endpoint - no auth required

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

export async function onRequestPost(context) {
  try {
    const db = context.env.DB;
    const body = await context.request.json();
    const now = Math.floor(Date.now() / 1000);

    const { email, first_name, source = 'toast_hub' } = body;

    if (!email) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Email is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid email format'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Check if already subscribed
    const existing = await db.prepare(`
      SELECT id, status FROM email_subscribers WHERE email = ?
    `).bind(normalizedEmail).first();

    if (existing) {
      if (existing.status === 'active') {
        return new Response(JSON.stringify({
          success: true,
          message: 'You\'re already subscribed to Toast Hub updates!'
        }), {
          headers: corsHeaders
        });
      } else {
        // Reactivate existing subscriber
        await db.prepare(`
          UPDATE email_subscribers
          SET status = 'active', source = ?, updated_at = ?
          WHERE id = ?
        `).bind(source, now, existing.id).run();

        return new Response(JSON.stringify({
          success: true,
          message: 'Welcome back! You\'ve been re-subscribed to Toast Hub.'
        }), {
          headers: corsHeaders
        });
      }
    }

    // Create new subscriber
    const id = crypto.randomUUID();

    await db.prepare(`
      INSERT INTO email_subscribers (
        id, email, first_name, status, source, segment, created_at, updated_at
      ) VALUES (?, ?, ?, 'active', ?, 'toast_hub_newsletter', ?, ?)
    `).bind(
      id,
      normalizedEmail,
      first_name || null,
      source,
      now,
      now
    ).run();

    // Send welcome email if Resend is configured
    if (context.env.RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${context.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: context.env.RESEND_FROM_EMAIL || 'Toast Hub <noreply@ccrestaurantconsulting.com>',
            to: normalizedEmail,
            subject: 'Welcome to Toast Hub!',
            html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome to Toast Hub</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="background-color: #1a1a1a; padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #f59e0b; font-size: 24px;">Toast Hub</h1>
              <p style="margin: 10px 0 0; color: #9ca3af; font-size: 14px;">R&G Consulting</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px; color: #1a1a1a; font-size: 24px;">Welcome${first_name ? `, ${first_name}` : ''}!</h2>
              <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Thank you for subscribing to Toast Hub. You'll now receive:
              </p>
              <ul style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.8;">
                <li>Expert Toast POS tips and tricks</li>
                <li>Industry news and trends</li>
                <li>New article notifications</li>
                <li>Exclusive guides and resources</li>
              </ul>
              <a href="https://ccrestaurantconsulting.com/#/toast-hub" style="display: inline-block; padding: 14px 28px; background-color: #f59e0b; color: #1a1a1a; text-decoration: none; font-weight: 600; border-radius: 6px;">
                Explore Toast Hub
              </a>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                R&G Consulting LLC | Cape Cod, MA<br>
                <a href="https://ccrestaurantconsulting.com" style="color: #9ca3af;">ccrestaurantconsulting.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
            `.trim()
          })
        });
      } catch (emailErr) {
        console.error('Welcome email failed:', emailErr);
        // Don't fail the subscription if email fails
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Successfully subscribed! Check your inbox for a welcome email.'
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Subscription error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Subscription failed. Please try again.'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}
