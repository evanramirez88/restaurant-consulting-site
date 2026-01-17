/**
 * Cloudflare Pages Function - Contact Form Handler
 *
 * Environment Variables Required (set in Cloudflare Pages dashboard):
 * - RESEND_API_KEY: Your Resend API key
 * - HUBSPOT_API_KEY: Your HubSpot private app access token
 *
 * Also enrolls contacts in email sequences based on service selection.
 */

import { getCorsOrigin } from '../_shared/auth.js';
import { rateLimit, RATE_LIMITS } from '../_shared/rate-limit.js';
import { enrollFromContactForm } from './_shared/email-enrollment.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS headers - use dynamic origin for security
  const corsHeaders = {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };

  // Rate limiting - 5 requests per 5 minutes per IP
  const rateLimitResponse = await rateLimit(
    request,
    env.RATE_LIMIT_KV,
    'contact',
    RATE_LIMITS.CONTACT_FORM,
    corsHeaders
  );
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const data = await request.json();

    // Honeypot check - if this field has any value, it's a bot
    if (data.website) {
      // Silently reject but return success to fool bots
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: corsHeaders
      });
    }

    // Validate required fields
    const requiredFields = ['name', 'email', 'message'];
    for (const field of requiredFields) {
      if (!data[field] || data[field].trim() === '') {
        return new Response(JSON.stringify({
          success: false,
          error: `Missing required field: ${field}`
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid email address'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Send email via Resend API
    let emailSent = false;
    if (env.RESEND_API_KEY) {
      try {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Cape Cod Restaurant Consulting <noreply@ccrestaurantconsulting.com>',
            to: ['ramirezconsulting.rg@gmail.com'],
            subject: `New Contact: ${data.name} - ${data.service || 'General Inquiry'}`,
            html: `
              <h2>New Contact Form Submission</h2>
              <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
                <tr style="border-bottom: 1px solid #ddd;">
                  <td style="padding: 12px; font-weight: bold; width: 150px;">Name:</td>
                  <td style="padding: 12px;">${escapeHtml(data.name)}</td>
                </tr>
                <tr style="border-bottom: 1px solid #ddd;">
                  <td style="padding: 12px; font-weight: bold;">Email:</td>
                  <td style="padding: 12px;"><a href="mailto:${escapeHtml(data.email)}">${escapeHtml(data.email)}</a></td>
                </tr>
                <tr style="border-bottom: 1px solid #ddd;">
                  <td style="padding: 12px; font-weight: bold;">Phone:</td>
                  <td style="padding: 12px;">${escapeHtml(data.phone || 'Not provided')}</td>
                </tr>
                <tr style="border-bottom: 1px solid #ddd;">
                  <td style="padding: 12px; font-weight: bold;">Business:</td>
                  <td style="padding: 12px;">${escapeHtml(data.businessName || 'Not provided')}</td>
                </tr>
                <tr style="border-bottom: 1px solid #ddd;">
                  <td style="padding: 12px; font-weight: bold;">Service:</td>
                  <td style="padding: 12px;">${escapeHtml(data.service || 'Not specified')}</td>
                </tr>
                <tr>
                  <td style="padding: 12px; font-weight: bold; vertical-align: top;">Message:</td>
                  <td style="padding: 12px; white-space: pre-wrap;">${escapeHtml(data.message)}</td>
                </tr>
              </table>
              <p style="color: #666; font-size: 12px; margin-top: 20px;">
                Submitted at: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET
              </p>
            `
          })
        });

        if (emailResponse.ok) {
          emailSent = true;
        } else {
          console.error('Resend API error:', await emailResponse.text());
        }
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
      }
    }

    // Push to HubSpot CRM
    let hubspotCreated = false;
    if (env.HUBSPOT_API_KEY) {
      try {
        const hubspotResponse = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.HUBSPOT_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            properties: {
              email: data.email,
              firstname: data.name.split(' ')[0],
              lastname: data.name.split(' ').slice(1).join(' ') || '',
              phone: data.phone || '',
              company: data.businessName || '',
              hs_lead_status: 'NEW',
              lifecyclestage: 'lead'
            }
          })
        });

        if (hubspotResponse.ok) {
          hubspotCreated = true;
        } else {
          const errorData = await hubspotResponse.json();
          // Check if contact already exists (409 conflict)
          if (hubspotResponse.status === 409) {
            // Contact exists, try to update instead
            const existingContactId = errorData.message?.match(/ID: (\d+)/)?.[1];
            if (existingContactId) {
              const updateResponse = await fetch(
                `https://api.hubapi.com/crm/v3/objects/contacts/${existingContactId}`,
                {
                  method: 'PATCH',
                  headers: {
                    'Authorization': `Bearer ${env.HUBSPOT_API_KEY}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    properties: {
                      phone: data.phone || '',
                      company: data.businessName || '',
                    }
                  })
                }
              );
              hubspotCreated = updateResponse.ok;
            }
          } else {
            console.error('HubSpot API error:', errorData);
          }
        }
      } catch (hubspotError) {
        console.error('HubSpot integration failed:', hubspotError);
      }
    }

    // Enroll in email sequence based on service selection
    let emailEnrolled = false;
    let enrollmentInfo = null;
    if (env.DB) {
      try {
        const enrollResult = await enrollFromContactForm(env, data);
        emailEnrolled = enrollResult.enrolled === true;
        enrollmentInfo = enrollResult;
        if (enrollResult.enrolled) {
          console.log(`Contact ${data.email} enrolled in sequence: ${enrollResult.sequenceName}`);
        } else if (enrollResult.reason) {
          console.log(`Contact ${data.email} not enrolled: ${enrollResult.reason}`);
        }
      } catch (enrollError) {
        console.error('Email enrollment failed:', enrollError);
        // Non-critical - don't fail the form submission
      }
    }

    return new Response(JSON.stringify({
      success: true,
      emailSent,
      hubspotCreated,
      emailEnrolled,
      enrollmentInfo,
      message: 'Thank you! Your message has been received. We\'ll be in touch soon.'
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Contact form error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'An error occurred processing your request. Please try again.'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

// Handle CORS preflight
export async function onRequestOptions(context) {
  const { request } = context;
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': getCorsOrigin(request),
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    }
  });
}

// Helper function to escape HTML to prevent XSS
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.toString().replace(/[&<>"']/g, char => map[char]);
}
