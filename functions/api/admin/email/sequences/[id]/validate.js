/**
 * Sequence Validation API
 *
 * POST /api/admin/email/sequences/:id/validate - Validate sequence configuration
 *
 * Body:
 *   - steps: Optional array of steps to validate (uses DB steps if not provided)
 *
 * Returns:
 *   - issues: Array of validation issues with severity (error/warning/info)
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
    const db = context.env.DB;

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

    // Get steps from body or database
    let steps = body.steps;
    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      const { results } = await db.prepare(`
        SELECT * FROM sequence_steps
        WHERE sequence_id = ?
        ORDER BY step_number ASC
      `).bind(sequenceId).all();
      steps = results;
    }

    const issues = [];

    // Sequence-level validations
    if (!sequence.name || sequence.name.trim() === '') {
      issues.push({
        severity: 'error',
        type: 'missing_name',
        message: 'Sequence is missing a name'
      });
    }

    if (steps.length === 0) {
      issues.push({
        severity: 'error',
        type: 'no_steps',
        message: 'Sequence has no email steps'
      });
      return new Response(JSON.stringify({
        success: true,
        data: {
          valid: false,
          issues,
          step_count: 0
        }
      }), {
        headers: corsHeaders
      });
    }

    // Valid tokens for replacement
    const validTokens = [
      'first_name', 'last_name', 'email', 'company_name',
      'unsubscribe_link', 'view_in_browser', 'full_name',
      'subscriber_id', 'subscription_date'
    ];

    // Step-level validations
    steps.forEach((step, index) => {
      const stepNum = step.step_number || index + 1;

      // Missing subject
      if (!step.subject || step.subject.trim() === '') {
        issues.push({
          step_id: step.id,
          step_number: stepNum,
          severity: 'error',
          type: 'missing_subject',
          message: `Step ${stepNum} is missing a subject line`,
          field: 'subject'
        });
      }

      // Missing content
      if (!step.html_content && !step.text_content) {
        issues.push({
          step_id: step.id,
          step_number: stepNum,
          severity: 'error',
          type: 'missing_content',
          message: `Step ${stepNum} has no email content`,
          field: 'content'
        });
      }

      // Very short content (might be placeholder)
      const contentLength = (step.html_content || '').length + (step.text_content || '').length;
      if (contentLength > 0 && contentLength < 50) {
        issues.push({
          step_id: step.id,
          step_number: stepNum,
          severity: 'warning',
          type: 'short_content',
          message: `Step ${stepNum} has very short content (might be incomplete)`,
          field: 'content'
        });
      }

      // Check for tokens in all text fields
      const allText = (step.subject || '') + (step.html_content || '') + (step.text_content || '');
      const tokenRegex = /\{\{([^}]+)\}\}/g;
      let match;

      while ((match = tokenRegex.exec(allText)) !== null) {
        const token = match[1].trim();
        if (!validTokens.includes(token)) {
          issues.push({
            step_id: step.id,
            step_number: stepNum,
            severity: 'warning',
            type: 'unknown_token',
            message: `Step ${stepNum} uses unknown token: {{${token}}}`,
            field: 'content'
          });
        }
      }

      // Check for broken or suspicious links in HTML
      if (step.html_content) {
        const linkRegex = /href=["']([^"']+)["']/gi;
        let linkMatch;

        while ((linkMatch = linkRegex.exec(step.html_content)) !== null) {
          const url = linkMatch[1];

          // Skip valid patterns
          if (url.startsWith('http://') || url.startsWith('https://') ||
              url.startsWith('{{') || url.startsWith('mailto:') ||
              url.startsWith('#') || url.startsWith('tel:')) {
            continue;
          }

          issues.push({
            step_id: step.id,
            step_number: stepNum,
            severity: 'warning',
            type: 'suspicious_link',
            message: `Step ${stepNum} has a potentially invalid link: ${url.substring(0, 50)}${url.length > 50 ? '...' : ''}`,
            field: 'content'
          });
        }

        // Check for empty href
        if (step.html_content.includes('href=""') || step.html_content.includes("href=''")) {
          issues.push({
            step_id: step.id,
            step_number: stepNum,
            severity: 'warning',
            type: 'empty_link',
            message: `Step ${stepNum} has an empty link (href="")`,
            field: 'content'
          });
        }

        // Check for missing alt text on images
        const imgRegex = /<img[^>]+>/gi;
        let imgMatch;
        while ((imgMatch = imgRegex.exec(step.html_content)) !== null) {
          const imgTag = imgMatch[0];
          if (!imgTag.includes('alt=')) {
            issues.push({
              step_id: step.id,
              step_number: stepNum,
              severity: 'info',
              type: 'missing_alt_text',
              message: `Step ${stepNum} has an image without alt text (accessibility issue)`,
              field: 'content'
            });
          }
        }
      }

      // Check delay configuration
      if (index > 0) {
        const delayMinutes = step.delay_minutes || 0;

        if (delayMinutes === 0) {
          issues.push({
            step_id: step.id,
            step_number: stepNum,
            severity: 'warning',
            type: 'no_delay',
            message: `Step ${stepNum} has no delay (will send immediately after previous)`,
            field: 'delay'
          });
        }

        if (delayMinutes > 30 * 24 * 60) { // More than 30 days
          issues.push({
            step_id: step.id,
            step_number: stepNum,
            severity: 'info',
            type: 'long_delay',
            message: `Step ${stepNum} has a delay of ${Math.round(delayMinutes / 1440)} days (subscribers may forget context)`,
            field: 'delay'
          });
        }
      }

      // Validate send conditions if present
      if (step.send_conditions) {
        try {
          const conditions = typeof step.send_conditions === 'string'
            ? JSON.parse(step.send_conditions)
            : step.send_conditions;

          if (conditions.condition_groups) {
            for (const group of conditions.condition_groups) {
              if (!group.conditions || group.conditions.length === 0) {
                issues.push({
                  step_id: step.id,
                  step_number: stepNum,
                  severity: 'warning',
                  type: 'empty_condition_group',
                  message: `Step ${stepNum} has an empty condition group`,
                  field: 'conditions'
                });
              }

              for (const condition of group.conditions || []) {
                // Check for incomplete tag conditions
                if (condition.type === 'has_tag' || condition.type === 'not_has_tag') {
                  if (!condition.tag_name && !condition.tag_id) {
                    issues.push({
                      step_id: step.id,
                      step_number: stepNum,
                      severity: 'error',
                      type: 'incomplete_condition',
                      message: `Step ${stepNum} has a tag condition without specifying a tag`,
                      field: 'conditions'
                    });
                  }
                }

                // Check for incomplete segment conditions
                if (condition.type === 'in_segment' || condition.type === 'not_in_segment') {
                  if (!condition.segment_name && !condition.segment_id) {
                    issues.push({
                      step_id: step.id,
                      step_number: stepNum,
                      severity: 'error',
                      type: 'incomplete_condition',
                      message: `Step ${stepNum} has a segment condition without specifying a segment`,
                      field: 'conditions'
                    });
                  }
                }

                // Check for score conditions without threshold
                if (condition.type === 'score_above' || condition.type === 'score_below') {
                  if (condition.score_threshold === undefined || condition.score_threshold === null) {
                    issues.push({
                      step_id: step.id,
                      step_number: stepNum,
                      severity: 'error',
                      type: 'incomplete_condition',
                      message: `Step ${stepNum} has a score condition without specifying a threshold`,
                      field: 'conditions'
                    });
                  }
                }
              }
            }
          }
        } catch (e) {
          issues.push({
            step_id: step.id,
            step_number: stepNum,
            severity: 'error',
            type: 'invalid_conditions',
            message: `Step ${stepNum} has invalid condition configuration: ${e.message}`,
            field: 'conditions'
          });
        }
      }
    });

    // Check for missing unsubscribe link (if HTML content exists)
    const hasHtmlContent = steps.some(s => s.html_content);
    const hasUnsubscribeLink = steps.some(s =>
      (s.html_content || '').includes('{{unsubscribe_link}}') ||
      (s.text_content || '').includes('{{unsubscribe_link}}')
    );

    if (hasHtmlContent && !hasUnsubscribeLink) {
      issues.push({
        severity: 'warning',
        type: 'no_unsubscribe',
        message: 'None of the steps include an unsubscribe link (required by CAN-SPAM)'
      });
    }

    // Check trigger configuration
    if (sequence.trigger_type === 'on_tag') {
      try {
        const triggerConfig = JSON.parse(sequence.trigger_config || '{}');
        if (!triggerConfig.tagId) {
          issues.push({
            severity: 'error',
            type: 'missing_trigger_config',
            message: 'Tag trigger is selected but no tag is specified'
          });
        }
      } catch (e) {
        issues.push({
          severity: 'error',
          type: 'invalid_trigger_config',
          message: 'Trigger configuration is invalid'
        });
      }
    }

    if (sequence.trigger_type === 'on_segment') {
      try {
        const triggerConfig = JSON.parse(sequence.trigger_config || '{}');
        if (!triggerConfig.segmentId) {
          issues.push({
            severity: 'error',
            type: 'missing_trigger_config',
            message: 'Segment trigger is selected but no segment is specified'
          });
        }
      } catch (e) {
        issues.push({
          severity: 'error',
          type: 'invalid_trigger_config',
          message: 'Trigger configuration is invalid'
        });
      }
    }

    // Sort issues by severity (errors first, then warnings, then info)
    const severityOrder = { error: 0, warning: 1, info: 2 };
    issues.sort((a, b) => {
      const orderDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (orderDiff !== 0) return orderDiff;
      return (a.step_number || 0) - (b.step_number || 0);
    });

    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;

    return new Response(JSON.stringify({
      success: true,
      data: {
        valid: errorCount === 0,
        issues,
        summary: {
          step_count: steps.length,
          error_count: errorCount,
          warning_count: warningCount,
          info_count: issues.filter(i => i.severity === 'info').length
        }
      }
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Validation error:', error);
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
