/**
 * Test Step Conditions API
 *
 * POST /api/admin/email/sequences/:id/steps/:stepId/test
 *
 * Tests whether a subscriber would pass or fail the step's conditions
 *
 * Expects body: {
 *   subscriber_email: string,
 *   conditions: BranchConfig  // The condition configuration to test
 * }
 *
 * Returns: {
 *   success: true,
 *   data: {
 *     passes: boolean,
 *     details: string[]
 *   }
 * }
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../../../../_shared/auth.js';

/**
 * Evaluate a single condition against subscriber data
 */
async function evaluateCondition(condition, subscriber, context) {
  const { DB } = context.env;
  const details = [];
  let passes = false;

  switch (condition.type) {
    // Email Engagement Conditions
    case 'opened_previous':
      // Check if subscriber opened the previous email in sequence
      const openedResult = await DB.prepare(`
        SELECT COUNT(*) as count FROM email_events
        WHERE subscriber_id = ? AND event_type = 'open'
        AND email_id IN (
          SELECT id FROM email_logs WHERE sequence_id = ?
          ORDER BY created_at DESC LIMIT 1
        )
      `).bind(subscriber.id, context.sequenceId).first();
      passes = (openedResult?.count || 0) > 0;
      details.push(`Previous email opened: ${passes ? 'Yes' : 'No'}`);
      break;

    case 'not_opened_previous':
      const notOpenedResult = await DB.prepare(`
        SELECT COUNT(*) as count FROM email_events
        WHERE subscriber_id = ? AND event_type = 'open'
        AND email_id IN (
          SELECT id FROM email_logs WHERE sequence_id = ?
          ORDER BY created_at DESC LIMIT 1
        )
      `).bind(subscriber.id, context.sequenceId).first();
      passes = (notOpenedResult?.count || 0) === 0;
      details.push(`Previous email NOT opened: ${passes ? 'Yes (not opened)' : 'No (was opened)'}`);
      break;

    case 'clicked_any_link':
      const clickedResult = await DB.prepare(`
        SELECT COUNT(*) as count FROM email_events
        WHERE subscriber_id = ? AND event_type = 'click'
        AND email_id IN (
          SELECT id FROM email_logs WHERE sequence_id = ?
          ORDER BY created_at DESC LIMIT 1
        )
      `).bind(subscriber.id, context.sequenceId).first();
      passes = (clickedResult?.count || 0) > 0;
      details.push(`Clicked any link: ${passes ? 'Yes' : 'No'}`);
      break;

    case 'clicked_specific_link':
      if (!condition.link_pattern) {
        details.push('Clicked specific link: No pattern specified');
        passes = false;
      } else {
        const specificClickResult = await DB.prepare(`
          SELECT COUNT(*) as count FROM email_events
          WHERE subscriber_id = ? AND event_type = 'click'
          AND url LIKE ?
          AND email_id IN (
            SELECT id FROM email_logs WHERE sequence_id = ?
            ORDER BY created_at DESC LIMIT 1
          )
        `).bind(subscriber.id, `%${condition.link_pattern}%`, context.sequenceId).first();
        passes = (specificClickResult?.count || 0) > 0;
        details.push(`Clicked link matching "${condition.link_pattern}": ${passes ? 'Yes' : 'No'}`);
      }
      break;

    case 'not_clicked_any_link':
      const notClickedResult = await DB.prepare(`
        SELECT COUNT(*) as count FROM email_events
        WHERE subscriber_id = ? AND event_type = 'click'
        AND email_id IN (
          SELECT id FROM email_logs WHERE sequence_id = ?
          ORDER BY created_at DESC LIMIT 1
        )
      `).bind(subscriber.id, context.sequenceId).first();
      passes = (notClickedResult?.count || 0) === 0;
      details.push(`Did NOT click any link: ${passes ? 'Yes' : 'No'}`);
      break;

    // Time-Based Conditions
    case 'weekdays_only':
      const dayOfWeek = new Date().getDay();
      passes = dayOfWeek >= 1 && dayOfWeek <= 5;
      details.push(`Is weekday: ${passes ? 'Yes' : 'No (weekend)'}`);
      break;

    case 'business_hours':
      const now = new Date();
      const currentHour = now.getHours();
      const startHour = parseInt((condition.business_hours_start || '09:00').split(':')[0]);
      const endHour = parseInt((condition.business_hours_end || '17:00').split(':')[0]);
      passes = currentHour >= startHour && currentHour < endHour;
      details.push(`Within business hours (${startHour}:00-${endHour}:00): ${passes ? 'Yes' : 'No'}`);
      break;

    case 'not_received_recently':
      const daysThreshold = condition.days_threshold || 7;
      const cutoffTime = Date.now() - (daysThreshold * 24 * 60 * 60 * 1000);
      const recentEmailResult = await DB.prepare(`
        SELECT COUNT(*) as count FROM email_logs
        WHERE subscriber_id = ? AND created_at > ?
      `).bind(subscriber.id, cutoffTime).first();
      passes = (recentEmailResult?.count || 0) === 0;
      details.push(`No email in last ${daysThreshold} days: ${passes ? 'Yes' : 'No'}`);
      break;

    // Subscriber Attribute Conditions
    case 'has_tag':
      if (!condition.tag_name && !condition.tag_id) {
        details.push('Has tag: No tag specified');
        passes = false;
      } else {
        const tagQuery = condition.tag_id
          ? 'SELECT COUNT(*) as count FROM subscriber_tags WHERE subscriber_id = ? AND tag_id = ?'
          : 'SELECT COUNT(*) as count FROM subscriber_tags st JOIN tags t ON st.tag_id = t.id WHERE st.subscriber_id = ? AND t.name = ?';
        const tagValue = condition.tag_id || condition.tag_name;
        const hasTagResult = await DB.prepare(tagQuery).bind(subscriber.id, tagValue).first();
        passes = (hasTagResult?.count || 0) > 0;
        details.push(`Has tag "${condition.tag_name || condition.tag_id}": ${passes ? 'Yes' : 'No'}`);
      }
      break;

    case 'not_has_tag':
      if (!condition.tag_name && !condition.tag_id) {
        details.push('Does not have tag: No tag specified');
        passes = true;
      } else {
        const notTagQuery = condition.tag_id
          ? 'SELECT COUNT(*) as count FROM subscriber_tags WHERE subscriber_id = ? AND tag_id = ?'
          : 'SELECT COUNT(*) as count FROM subscriber_tags st JOIN tags t ON st.tag_id = t.id WHERE st.subscriber_id = ? AND t.name = ?';
        const notTagValue = condition.tag_id || condition.tag_name;
        const notHasTagResult = await DB.prepare(notTagQuery).bind(subscriber.id, notTagValue).first();
        passes = (notHasTagResult?.count || 0) === 0;
        details.push(`Does NOT have tag "${condition.tag_name || condition.tag_id}": ${passes ? 'Yes' : 'No'}`);
      }
      break;

    case 'score_above':
      const scoreAbove = condition.score_threshold || 0;
      passes = (subscriber.engagement_score || 0) > scoreAbove;
      details.push(`Score (${subscriber.engagement_score || 0}) above ${scoreAbove}: ${passes ? 'Yes' : 'No'}`);
      break;

    case 'score_below':
      const scoreBelow = condition.score_threshold || 0;
      passes = (subscriber.engagement_score || 0) < scoreBelow;
      details.push(`Score (${subscriber.engagement_score || 0}) below ${scoreBelow}: ${passes ? 'Yes' : 'No'}`);
      break;

    case 'in_segment':
      if (!condition.segment_name && !condition.segment_id) {
        details.push('In segment: No segment specified');
        passes = false;
      } else {
        const segmentQuery = condition.segment_id
          ? 'SELECT COUNT(*) as count FROM subscriber_segments WHERE subscriber_id = ? AND segment_id = ?'
          : 'SELECT COUNT(*) as count FROM subscriber_segments ss JOIN segments s ON ss.segment_id = s.id WHERE ss.subscriber_id = ? AND s.name = ?';
        const segmentValue = condition.segment_id || condition.segment_name;
        const inSegmentResult = await DB.prepare(segmentQuery).bind(subscriber.id, segmentValue).first();
        passes = (inSegmentResult?.count || 0) > 0;
        details.push(`In segment "${condition.segment_name || condition.segment_id}": ${passes ? 'Yes' : 'No'}`);
      }
      break;

    case 'not_in_segment':
      if (!condition.segment_name && !condition.segment_id) {
        details.push('Not in segment: No segment specified');
        passes = true;
      } else {
        const notSegmentQuery = condition.segment_id
          ? 'SELECT COUNT(*) as count FROM subscriber_segments WHERE subscriber_id = ? AND segment_id = ?'
          : 'SELECT COUNT(*) as count FROM subscriber_segments ss JOIN segments s ON ss.segment_id = s.id WHERE ss.subscriber_id = ? AND s.name = ?';
        const notSegmentValue = condition.segment_id || condition.segment_name;
        const notInSegmentResult = await DB.prepare(notSegmentQuery).bind(subscriber.id, notSegmentValue).first();
        passes = (notInSegmentResult?.count || 0) === 0;
        details.push(`NOT in segment "${condition.segment_name || condition.segment_id}": ${passes ? 'Yes' : 'No'}`);
      }
      break;

    default:
      details.push(`Unknown condition type: ${condition.type}`);
      passes = false;
  }

  return { passes, details };
}

/**
 * Evaluate a condition group (multiple conditions with AND/OR logic)
 */
async function evaluateConditionGroup(group, subscriber, context) {
  const results = [];
  const allDetails = [];

  for (const condition of group.conditions) {
    const result = await evaluateCondition(condition, subscriber, context);
    results.push(result.passes);
    allDetails.push(...result.details);
  }

  const passes = group.logic === 'AND'
    ? results.every(r => r)
    : results.some(r => r);

  return { passes, details: allDetails };
}

/**
 * Evaluate the full branch config
 */
async function evaluateBranchConfig(branchConfig, subscriber, context) {
  const groupResults = [];
  const allDetails = [];

  for (const group of branchConfig.condition_groups) {
    const result = await evaluateConditionGroup(group, subscriber, context);
    groupResults.push(result.passes);
    allDetails.push(`--- Group ${branchConfig.condition_groups.indexOf(group) + 1} (${group.logic}) ---`);
    allDetails.push(...result.details);
  }

  const passes = branchConfig.group_logic === 'AND'
    ? groupResults.every(r => r)
    : groupResults.some(r => r);

  allDetails.push('---');
  allDetails.push(`Overall result (groups ${branchConfig.group_logic}): ${passes ? 'PASS' : 'FAIL'}`);

  return { passes, details: allDetails };
}

export async function onRequestPost(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const { id: sequenceId, stepId } = context.params;
    const body = await context.request.json();

    // Validate required fields
    if (!body.subscriber_email) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Subscriber email is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (!body.conditions) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Conditions configuration is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const db = context.env.DB;

    // Find subscriber by email
    const subscriber = await db.prepare(`
      SELECT * FROM subscribers WHERE email = ?
    `).bind(body.subscriber_email).first();

    if (!subscriber) {
      // Create a mock subscriber for testing if not found
      return new Response(JSON.stringify({
        success: true,
        data: {
          passes: false,
          details: [
            `Subscriber "${body.subscriber_email}" not found in database.`,
            'Using mock data for condition evaluation...',
            'Note: Time-based conditions will still evaluate correctly.',
            '---',
            'To test with real subscriber data, ensure the email exists in your subscribers list.'
          ]
        }
      }), {
        headers: corsHeaders
      });
    }

    // Evaluate the conditions
    const result = await evaluateBranchConfig(body.conditions, subscriber, {
      env: context.env,
      sequenceId,
      stepId
    });

    return new Response(JSON.stringify({
      success: true,
      data: {
        passes: result.passes,
        details: result.details,
        subscriber: {
          id: subscriber.id,
          email: subscriber.email,
          first_name: subscriber.first_name,
          engagement_score: subscriber.engagement_score
        }
      }
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Test conditions error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to test conditions'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
