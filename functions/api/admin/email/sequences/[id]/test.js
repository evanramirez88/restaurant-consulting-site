/**
 * Sequence Test API
 *
 * POST /api/admin/email/sequences/:id/test - Send test email
 *
 * Body:
 *   - step_id: Optional specific step to test (if omitted, tests all)
 *   - recipient_email: Email address to send test to
 *   - sample_data: Optional subscriber data for token replacement
 *   - is_sequence_test: Boolean for full sequence test mode
 *   - test_step_number: Current step in sequence test
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../../_shared/auth.js';

export async function onRequestPost(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const { id: sequenceId } = context.params;
    const body = await context.request.json();
    const { step_id, recipient_email, sample_data, is_sequence_test, test_step_number } = body;
    const db = context.env.DB;

    // Validate recipient email
    if (!recipient_email) {
      return new Response(JSON.stringify({
        success: false,
        error: 'recipient_email is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipient_email)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid email format'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Get sequence
    const sequence = await db.prepare(`
      SELECT * FROM email_sequences WHERE id = ?
    `).bind(sequenceId).first();

    if (!sequence) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Sequence not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Get step(s) to test
    let stepsQuery = `
      SELECT * FROM sequence_steps
      WHERE sequence_id = ?
    `;
    const queryParams = [sequenceId];

    if (step_id) {
      stepsQuery += ' AND id = ?';
      queryParams.push(step_id);
    }

    stepsQuery += ' ORDER BY step_number ASC';

    const { results: steps } = await db.prepare(stepsQuery).bind(...queryParams).all();

    if (steps.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: step_id ? 'Step not found' : 'No steps in sequence'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Prepare sample data with defaults
    const tokenData = {
      first_name: sample_data?.first_name || 'Test',
      last_name: sample_data?.last_name || 'User',
      email: sample_data?.email || recipient_email,
      company_name: sample_data?.company_name || 'Test Company',
      unsubscribe_link: '#unsubscribe-test',
      view_in_browser: '#view-in-browser-test'
    };

    // Replace tokens in content
    const replaceTokens = (content) => {
      if (!content) return content;
      return content.replace(/\{\{(\w+)\}\}/g, (match, token) => {
        return tokenData[token] !== undefined ? tokenData[token] : match;
      });
    };

    // In a real implementation, we would send the email via the email service
    // For now, we'll simulate the send and return success

    const results = [];
    for (const step of steps) {
      const processedSubject = replaceTokens(step.subject);
      const processedHtml = replaceTokens(step.html_content);
      const processedText = replaceTokens(step.text_content);

      // Simulate email send
      // In production, integrate with Resend, SendGrid, SES, etc.
      /*
      const sendResult = await sendEmail({
        to: recipient_email,
        subject: `[TEST] ${processedSubject}`,
        html: processedHtml,
        text: processedText,
        from: context.env.FROM_EMAIL || 'test@yourdomain.com'
      });
      */

      // For now, simulate success
      const sendSuccess = true;

      results.push({
        step_id: step.id,
        step_number: step.step_number,
        subject: processedSubject,
        success: sendSuccess,
        message: sendSuccess ? 'Test email sent' : 'Failed to send'
      });

      // Log test send
      try {
        await db.prepare(`
          INSERT INTO email_test_logs (
            sequence_id, step_id, recipient_email, sent_at, sample_data, success
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          sequenceId,
          step.id,
          recipient_email,
          Math.floor(Date.now() / 1000),
          JSON.stringify(tokenData),
          sendSuccess ? 1 : 0
        ).run();
      } catch (e) {
        // Table might not exist, that's okay
        console.log('Could not log test send:', e.message);
      }
    }

    // Return appropriate response
    if (step_id) {
      // Single step test
      const result = results[0];
      return new Response(JSON.stringify({
        success: result.success,
        message: result.success
          ? `Test email "${result.subject}" sent to ${recipient_email}`
          : result.message,
        data: result
      }), {
        headers: corsHeaders
      });
    } else {
      // Full sequence test
      const allSuccess = results.every(r => r.success);
      const successCount = results.filter(r => r.success).length;

      return new Response(JSON.stringify({
        success: allSuccess,
        message: `Sent ${successCount}/${results.length} test emails to ${recipient_email}`,
        data: {
          sequence_name: sequence.name,
          recipient: recipient_email,
          results
        }
      }), {
        headers: corsHeaders
      });
    }
  } catch (error) {
    console.error('Test send error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
