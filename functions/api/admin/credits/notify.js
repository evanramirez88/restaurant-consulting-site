// Admin API - Send notification for referral credit status change
// POST /api/admin/credits/notify
// Requires admin authentication
import { verifyAuth, getCorsOrigin } from '../../../_shared/auth.js';

const CORS_HEADERS = {
  'Content-Type': 'application/json'
};

function getCorsHeaders(request) {
  return {
    ...CORS_HEADERS,
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true'
  };
}

// Generate email HTML for credit approval notification
function generateApprovalEmailHtml(repName, creditAmount, creditType, description, clientCompany) {
  const creditTypeLabels = {
    referral_bonus: 'Referral Bonus',
    project_commission: 'Project Commission',
    support_plan_bonus: 'Support Plan Bonus',
    upsell_commission: 'Upsell Commission',
    lead_conversion: 'Lead Conversion Bonus',
    recurring_bonus: 'Recurring Bonus'
  };

  const typeLabel = creditTypeLabels[creditType] || creditType;
  const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(creditAmount);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Credit Approved</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #1a1a2e; padding: 30px 40px; text-align: center;">
              <h1 style="color: #22c55e; margin: 0; font-size: 24px;">Credit Approved! ✓</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Hi ${repName},
              </p>

              <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Great news! Your referral credit has been approved:
              </p>

              <!-- Credit Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; margin: 25px 0;">
                <tr>
                  <td style="padding: 25px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #666; font-size: 14px;">Type:</span>
                          <span style="color: #333; font-weight: 600; float: right;">${typeLabel}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-top: 1px solid #e5e5e5;">
                          <span style="color: #666; font-size: 14px;">Amount:</span>
                          <span style="color: #22c55e; font-weight: 700; font-size: 18px; float: right;">${formattedAmount}</span>
                        </td>
                      </tr>
                      ${clientCompany ? `
                      <tr>
                        <td style="padding: 8px 0; border-top: 1px solid #e5e5e5;">
                          <span style="color: #666; font-size: 14px;">Client:</span>
                          <span style="color: #333; font-weight: 600; float: right;">${clientCompany}</span>
                        </td>
                      </tr>
                      ` : ''}
                      ${description ? `
                      <tr>
                        <td style="padding: 8px 0; border-top: 1px solid #e5e5e5;">
                          <span style="color: #666; font-size: 14px;">Description:</span>
                          <span style="color: #333; float: right;">${description}</span>
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 0 0 25px;">
                This credit is now approved and will be included in your next payment cycle.
                Payments are typically processed monthly.
              </p>

              <p style="color: #333; font-size: 14px; margin: 0;">
                Keep up the great work!<br>
                <strong>Cape Cod Restaurant Consulting</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px 40px; text-align: center; border-top: 1px solid #e5e5e5;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} Cape Cod Restaurant Consulting | <a href="https://ccrestaurantconsulting.com" style="color: #22c55e; text-decoration: none;">ccrestaurantconsulting.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// Generate email HTML for credit payment notification
function generatePaymentEmailHtml(repName, creditAmount, creditType, description, clientCompany, paymentReference) {
  const creditTypeLabels = {
    referral_bonus: 'Referral Bonus',
    project_commission: 'Project Commission',
    support_plan_bonus: 'Support Plan Bonus',
    upsell_commission: 'Upsell Commission',
    lead_conversion: 'Lead Conversion Bonus',
    recurring_bonus: 'Recurring Bonus'
  };

  const typeLabel = creditTypeLabels[creditType] || creditType;
  const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(creditAmount);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Sent</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #1a1a2e; padding: 30px 40px; text-align: center;">
              <h1 style="color: #22c55e; margin: 0; font-size: 24px;">Payment Sent! 💰</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Hi ${repName},
              </p>

              <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Your payment has been processed:
              </p>

              <!-- Payment Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border: 2px solid #22c55e; border-radius: 8px; margin: 25px 0;">
                <tr>
                  <td style="padding: 25px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #666; font-size: 14px;">Amount Paid:</span>
                          <span style="color: #22c55e; font-weight: 700; font-size: 24px; float: right;">${formattedAmount}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-top: 1px solid #bbf7d0;">
                          <span style="color: #666; font-size: 14px;">Type:</span>
                          <span style="color: #333; font-weight: 600; float: right;">${typeLabel}</span>
                        </td>
                      </tr>
                      ${clientCompany ? `
                      <tr>
                        <td style="padding: 8px 0; border-top: 1px solid #bbf7d0;">
                          <span style="color: #666; font-size: 14px;">Client:</span>
                          <span style="color: #333; font-weight: 600; float: right;">${clientCompany}</span>
                        </td>
                      </tr>
                      ` : ''}
                      ${paymentReference ? `
                      <tr>
                        <td style="padding: 8px 0; border-top: 1px solid #bbf7d0;">
                          <span style="color: #666; font-size: 14px;">Reference:</span>
                          <span style="color: #333; float: right;">${paymentReference}</span>
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 0 0 25px;">
                Thank you for your continued partnership. We appreciate your hard work in bringing new clients to Cape Cod Restaurant Consulting!
              </p>

              <p style="color: #333; font-size: 14px; margin: 0;">
                Best regards,<br>
                <strong>Cape Cod Restaurant Consulting</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px 40px; text-align: center; border-top: 1px solid #e5e5e5;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} Cape Cod Restaurant Consulting | <a href="https://ccrestaurantconsulting.com" style="color: #22c55e; text-decoration: none;">ccrestaurantconsulting.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// POST /api/admin/credits/notify - Send notification for credit status change
export async function onRequestPost(context) {
  const corsHeaders = getCorsHeaders(context.request);

  try {
    // Verify admin authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.success) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), { status: 401, headers: corsHeaders });
    }

    const db = context.env.DB;
    const body = await context.request.json();
    const { credit_id, notification_type } = body;

    if (!credit_id || !notification_type) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing credit_id or notification_type'
      }), { status: 400, headers: corsHeaders });
    }

    if (!['approved', 'paid'].includes(notification_type)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'notification_type must be "approved" or "paid"'
      }), { status: 400, headers: corsHeaders });
    }

    // Get credit details with rep info
    const credit = await db.prepare(`
      SELECT
        rrc.*,
        r.name as rep_name,
        r.email as rep_email,
        r.slug as rep_slug,
        c.company as client_company
      FROM rep_referral_credits rrc
      JOIN reps r ON rrc.rep_id = r.id
      LEFT JOIN clients c ON rrc.client_id = c.id
      WHERE rrc.id = ?
    `).bind(credit_id).first();

    if (!credit) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Credit not found'
      }), { status: 404, headers: corsHeaders });
    }

    // Send email notification
    const RESEND_API_KEY = context.env.RESEND_API_KEY;

    if (!RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not configured, skipping email');
      return new Response(JSON.stringify({
        success: true,
        message: 'Notification logged but email not sent (RESEND_API_KEY not configured)',
        emailSent: false
      }), { headers: corsHeaders });
    }

    let emailHtml, emailSubject;

    if (notification_type === 'approved') {
      emailSubject = `✅ Credit Approved: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(credit.amount)}`;
      emailHtml = generateApprovalEmailHtml(
        credit.rep_name,
        credit.amount,
        credit.credit_type,
        credit.description,
        credit.client_company
      );
    } else {
      emailSubject = `💰 Payment Sent: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(credit.amount)}`;
      emailHtml = generatePaymentEmailHtml(
        credit.rep_name,
        credit.amount,
        credit.credit_type,
        credit.description,
        credit.client_company,
        credit.payment_reference
      );
    }

    // Send email via Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Cape Cod Restaurant Consulting <noreply@ccrestaurantconsulting.com>',
        to: [credit.rep_email],
        subject: emailSubject,
        html: emailHtml
      })
    });

    const emailResult = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error('Resend error:', emailResult);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to send email',
        details: emailResult
      }), { status: 500, headers: corsHeaders });
    }

    // Create in-app notification
    const notificationId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Math.floor(Date.now() / 1000);

    try {
      await db.prepare(`
        INSERT INTO rep_activity_log (id, rep_id, activity_type, credit_id, title, description, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        notificationId,
        credit.rep_id,
        notification_type === 'approved' ? 'credit_earned' : 'credit_paid',
        credit_id,
        notification_type === 'approved'
          ? `Credit approved: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(credit.amount)}`
          : `Payment received: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(credit.amount)}`,
        credit.description || '',
        now
      ).run();
    } catch (dbError) {
      console.warn('Failed to create activity log entry:', dbError);
      // Don't fail the request for this
    }

    return new Response(JSON.stringify({
      success: true,
      message: `${notification_type === 'approved' ? 'Approval' : 'Payment'} notification sent to ${credit.rep_email}`,
      emailSent: true,
      emailId: emailResult.id
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('Credit notification error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: corsHeaders });
  }
}

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': getCorsOrigin(context.request),
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    }
  });
}
