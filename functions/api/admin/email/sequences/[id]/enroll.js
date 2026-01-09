/**
 * Enrollment API - Batch enroll subscribers into a sequence
 *
 * POST /api/admin/email/sequences/[id]/enroll
 *
 * Request body:
 * {
 *   source: 'manual' | 'segment' | 'all',
 *   emails?: string[], // For manual source
 *   segment_id?: string, // For segment source
 *   filters?: object, // For all source with filters
 *   schedule: 'immediate' | 'scheduled' | 'drip',
 *   scheduled_at?: number, // Unix timestamp for scheduled
 *   timezone?: string,
 *   drip_config?: {
 *     per_hour?: number,
 *     per_day?: number,
 *     start_at: number
 *   },
 *   exclude_enrolled?: boolean
 * }
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../../_shared/auth.js';

/**
 * Calculate delay in seconds from value and unit
 */
function calculateDelaySeconds(value, unit) {
  switch (unit) {
    case 'minutes': return value * 60;
    case 'hours': return value * 60 * 60;
    case 'days': return value * 60 * 60 * 24;
    case 'weeks': return value * 60 * 60 * 24 * 7;
    default: return value * 60 * 60; // Default to hours
  }
}

/**
 * Build WHERE clause from filters
 */
function buildFilterConditions(filters) {
  const conditions = [];
  const params = [];

  if (!filters) return { conditions, params };

  // Search
  if (filters.search) {
    conditions.push(`(email LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR company LIKE ?)`);
    const searchPattern = `%${filters.search}%`;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  // Status filter
  if (filters.status && filters.status.length > 0) {
    const statusList = Array.isArray(filters.status) ? filters.status : filters.status.split(',');
    const placeholders = statusList.map(() => '?').join(',');
    conditions.push(`status IN (${placeholders})`);
    params.push(...statusList);
  }

  // POS System filter
  if (filters.pos_system && filters.pos_system.length > 0) {
    const posList = Array.isArray(filters.pos_system) ? filters.pos_system : filters.pos_system.split(',');
    const placeholders = posList.map(() => '?').join(',');
    conditions.push(`pos_system IN (${placeholders})`);
    params.push(...posList);
  }

  // Geographic Tier filter
  if (filters.geographic_tier && filters.geographic_tier.length > 0) {
    const tierList = Array.isArray(filters.geographic_tier) ? filters.geographic_tier : filters.geographic_tier.split(',');
    const placeholders = tierList.map(() => '?').join(',');
    conditions.push(`geographic_tier IN (${placeholders})`);
    params.push(...tierList);
  }

  return { conditions, params };
}

/**
 * Get subscriber IDs by email addresses
 */
async function getSubscriberIdsByEmails(db, emails) {
  if (!emails || emails.length === 0) return [];

  const results = [];
  const batchSize = 50;

  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    const placeholders = batch.map(() => '?').join(',');

    const { results: batchResults } = await db.prepare(`
      SELECT id, email FROM email_subscribers WHERE LOWER(email) IN (${placeholders})
    `).bind(...batch.map(e => e.toLowerCase())).all();

    results.push(...(batchResults || []));
  }

  return results;
}

/**
 * Get subscriber IDs from segment
 */
async function getSubscriberIdsFromSegment(db, segmentId) {
  // First check if it's a static or dynamic segment
  // FIXED: Use email_segments table (not subscriber_segments)
  const segment = await db.prepare('SELECT * FROM email_segments WHERE id = ?').bind(segmentId).first();

  if (!segment) {
    throw new Error('Segment not found');
  }

  if (segment.segment_type === 'static') {
    // Get members from email_segment_members table (not segment_members)
    const { results } = await db.prepare(`
      SELECT subscriber_id FROM email_segment_members WHERE segment_id = ?
    `).bind(segmentId).all();

    return (results || []).map(r => r.subscriber_id);
  } else {
    // Dynamic segment - execute the query
    const query = segment.query_json ? JSON.parse(segment.query_json) : null;

    if (!query) {
      return [];
    }

    // Build and execute the segment query
    // This is simplified - a full implementation would need to handle the full query builder
    const { conditions, params } = buildSegmentQuery(query);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { results } = await db.prepare(`
      SELECT id FROM email_subscribers ${whereClause} LIMIT 10000
    `).bind(...params).all();

    return (results || []).map(r => r.id);
  }
}

/**
 * Allowed fields for segment queries (prevents SQL injection)
 */
const ALLOWED_SEGMENT_FIELDS = [
  'email', 'first_name', 'last_name', 'company', 'phone',
  'restaurant_name', 'restaurant_type', 'pos_system', 'pos_satisfaction',
  'city', 'state', 'zip', 'geo_tier', 'timezone',
  'source', 'source_detail', 'utm_source', 'utm_medium', 'utm_campaign',
  'engagement_score', 'total_emails_sent', 'total_emails_opened',
  'total_emails_clicked', 'status', 'lead_status', 'lead_score',
  'created_at', 'updated_at'
];

/**
 * Validate and sanitize field name for SQL query
 */
function validateFieldName(field) {
  if (!field || typeof field !== 'string') return null;
  const cleanField = field.toLowerCase().trim();
  return ALLOWED_SEGMENT_FIELDS.includes(cleanField) ? cleanField : null;
}

/**
 * Build query from segment conditions
 */
function buildSegmentQuery(query) {
  const conditions = [];
  const params = [];

  if (!query || !query.groups) return { conditions, params };

  const groupConditions = [];

  for (const group of query.groups) {
    if (!group.conditions || group.conditions.length === 0) continue;

    const conditionStrings = [];

    for (const condition of group.conditions) {
      const { field, operator, value } = condition;

      // Validate field name to prevent SQL injection
      const validField = validateFieldName(field);
      if (!validField) {
        console.warn(`Invalid segment field rejected: ${field}`);
        continue;
      }

      switch (operator) {
        case 'equals':
          conditionStrings.push(`${validField} = ?`);
          params.push(value);
          break;
        case 'not_equals':
          conditionStrings.push(`${validField} != ?`);
          params.push(value);
          break;
        case 'contains':
          conditionStrings.push(`${validField} LIKE ?`);
          params.push(`%${value}%`);
          break;
        case 'not_contains':
          conditionStrings.push(`${validField} NOT LIKE ?`);
          params.push(`%${value}%`);
          break;
        case 'greater_than':
          conditionStrings.push(`${validField} > ?`);
          params.push(value);
          break;
        case 'less_than':
          conditionStrings.push(`${validField} < ?`);
          params.push(value);
          break;
        case 'in_list':
          if (Array.isArray(value) && value.length > 0) {
            const placeholders = value.map(() => '?').join(',');
            conditionStrings.push(`${validField} IN (${placeholders})`);
            params.push(...value);
          }
          break;
        case 'is_empty':
          conditionStrings.push(`(${validField} IS NULL OR ${validField} = '')`);
          break;
        case 'is_not_empty':
          conditionStrings.push(`${validField} IS NOT NULL AND ${validField} != ''`);
          break;
      }
    }

    if (conditionStrings.length > 0) {
      const groupLogic = group.logic === 'OR' ? ' OR ' : ' AND ';
      groupConditions.push(`(${conditionStrings.join(groupLogic)})`);
    }
  }

  if (groupConditions.length > 0) {
    const mainLogic = query.logic === 'OR' ? ' OR ' : ' AND ';
    conditions.push(`(${groupConditions.join(mainLogic)})`);
  }

  return { conditions, params };
}

/**
 * Get subscriber IDs from filters (for "all" source)
 */
async function getSubscriberIdsFromFilters(db, filters, limit = 10000) {
  const { conditions, params } = buildFilterConditions(filters);
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `SELECT id FROM email_subscribers ${whereClause} LIMIT ?`;
  const { results } = await db.prepare(query).bind(...params, limit).all();

  return (results || []).map(r => r.id);
}

/**
 * Process enrollment for subscribers
 * CRITICAL: Uses subscriber_sequences table (not sequence_enrollments) to match email dispatcher
 */
async function processEnrollment(db, enrollmentId, sequenceId, subscriberIds, excludeEnrolled) {
  const now = Math.floor(Date.now() / 1000);
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  const errors = [];

  // Get the first step of the sequence to set up the enrollment
  const firstStep = await db.prepare(`
    SELECT id, delay_value, delay_unit
    FROM sequence_steps
    WHERE sequence_id = ? AND step_number = 1 AND status = 'active'
  `).bind(sequenceId).first();

  if (!firstStep) {
    throw new Error('Sequence has no active first step');
  }

  // Calculate when the first email should be sent
  const delaySeconds = calculateDelaySeconds(firstStep.delay_value, firstStep.delay_unit);
  const nextStepScheduledAt = now + delaySeconds;

  // Get sequence A/B test config
  const sequence = await db.prepare(`
    SELECT ab_test_enabled, ab_test_split_percentage FROM email_sequences WHERE id = ?
  `).bind(sequenceId).first();

  const batchSize = 50;

  for (let i = 0; i < subscriberIds.length; i += batchSize) {
    const batch = subscriberIds.slice(i, i + batchSize);

    for (const subscriberId of batch) {
      try {
        // Check if already enrolled (if excludeEnrolled is true)
        // Uses subscriber_sequences - the table the dispatcher actually reads!
        if (excludeEnrolled) {
          const existing = await db.prepare(`
            SELECT id FROM subscriber_sequences
            WHERE subscriber_id = ? AND sequence_id = ? AND status IN ('active', 'queued', 'paused')
          `).bind(subscriberId, sequenceId).first();

          if (existing) {
            skippedCount++;
            continue;
          }
        }

        // Assign A/B variant if A/B testing is enabled
        let abVariant = null;
        if (sequence?.ab_test_enabled) {
          const splitPct = sequence.ab_test_split_percentage || 50;
          abVariant = Math.random() * 100 < splitPct ? 'A' : 'B';
        }

        // Create enrollment in subscriber_sequences (the table dispatcher reads!)
        const enrollmentRecordId = crypto.randomUUID();
        await db.prepare(`
          INSERT INTO subscriber_sequences (
            id, subscriber_id, sequence_id, current_step_id, current_step_number,
            status, ab_variant, enrolled_at, started_at, next_step_scheduled_at,
            emails_sent, emails_opened, emails_clicked, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 1, 'active', ?, ?, ?, ?, 0, 0, 0, ?, ?)
        `).bind(
          enrollmentRecordId, subscriberId, sequenceId, firstStep.id,
          abVariant, now, now, nextStepScheduledAt, now, now
        ).run();

        successCount++;
      } catch (err) {
        errorCount++;
        errors.push({
          subscriber_id: subscriberId,
          error: err.message
        });
      }
    }

    // Update progress
    await db.prepare(`
      UPDATE batch_enrollments
      SET processed_count = processed_count + ?,
          success_count = success_count + ?,
          error_count = error_count + ?,
          updated_at = ?
      WHERE id = ?
    `).bind(batch.length, successCount, errorCount, now, enrollmentId).run();
  }

  // Mark as completed
  await db.prepare(`
    UPDATE batch_enrollments
    SET status = 'completed', completed_at = ?, updated_at = ?
    WHERE id = ?
  `).bind(now, now, enrollmentId).run();

  return { successCount, errorCount, errors };
}

export async function onRequestPost(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const sequenceId = context.params.id;
    const body = await context.request.json();

    // Validate sequence exists
    const sequence = await db.prepare(
      'SELECT id, name, status FROM email_sequences WHERE id = ?'
    ).bind(sequenceId).first();

    if (!sequence) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Sequence not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Validate request body
    const {
      source,
      emails,
      segment_id,
      filters,
      schedule,
      scheduled_at,
      timezone,
      drip_config,
      exclude_enrolled = true
    } = body;

    if (!source || !['manual', 'segment', 'all'].includes(source)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid source. Must be "manual", "segment", or "all"'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (!schedule || !['immediate', 'scheduled', 'drip'].includes(schedule)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid schedule. Must be "immediate", "scheduled", or "drip"'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Get subscriber IDs based on source
    let subscriberIds = [];
    let sourceDetails = {};

    if (source === 'manual') {
      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Emails array is required for manual source'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }

      const subscribers = await getSubscriberIdsByEmails(db, emails);
      subscriberIds = subscribers.map(s => s.id);
      sourceDetails = {
        emails: emails,
        found_count: subscribers.length,
        not_found: emails.filter(e =>
          !subscribers.find(s => s.email.toLowerCase() === e.toLowerCase())
        )
      };

      if (subscriberIds.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: 'No matching subscribers found for the provided emails'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
    } else if (source === 'segment') {
      if (!segment_id) {
        return new Response(JSON.stringify({
          success: false,
          error: 'segment_id is required for segment source'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }

      try {
        subscriberIds = await getSubscriberIdsFromSegment(db, segment_id);
      } catch (err) {
        return new Response(JSON.stringify({
          success: false,
          error: err.message || 'Failed to load segment members'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }

      sourceDetails = { segment_id };
    } else {
      // 'all' source
      subscriberIds = await getSubscriberIdsFromFilters(db, filters || {});
      sourceDetails = { filters: filters || {} };
    }

    if (subscriberIds.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No subscribers match the specified criteria'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Create batch enrollment record
    const now = Math.floor(Date.now() / 1000);
    const enrollmentId = crypto.randomUUID();

    await db.prepare(`
      INSERT INTO batch_enrollments (
        id, sequence_id, source, source_details, schedule_type,
        scheduled_at, timezone, drip_config, total_count, processed_count,
        success_count, error_count, status, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, ?, ?)
    `).bind(
      enrollmentId,
      sequenceId,
      source,
      JSON.stringify(sourceDetails),
      schedule,
      scheduled_at || null,
      timezone || 'America/New_York',
      drip_config ? JSON.stringify(drip_config) : null,
      subscriberIds.length,
      schedule === 'immediate' ? 'processing' : 'pending',
      auth.user?.email || 'admin',
      now,
      now
    ).run();

    // For immediate enrollment, process now
    if (schedule === 'immediate') {
      // Start processing in background (in a real implementation,
      // this would use Cloudflare Durable Objects or a queue)
      // For now, we process synchronously but could be optimized

      // Process enrollment
      const result = await processEnrollment(
        db,
        enrollmentId,
        sequenceId,
        subscriberIds,
        exclude_enrolled
      );

      // Get final enrollment status
      const enrollment = await db.prepare(
        'SELECT * FROM batch_enrollments WHERE id = ?'
      ).bind(enrollmentId).first();

      return new Response(JSON.stringify({
        success: true,
        data: {
          id: enrollmentId,
          status: enrollment?.status || 'completed',
          total_count: subscriberIds.length,
          processed_count: enrollment?.processed_count || subscriberIds.length,
          success_count: enrollment?.success_count || result.successCount,
          error_count: enrollment?.error_count || result.errorCount
        }
      }), {
        status: 201,
        headers: corsHeaders
      });
    }

    // For scheduled/drip, just return the pending enrollment
    return new Response(JSON.stringify({
      success: true,
      data: {
        id: enrollmentId,
        status: 'pending',
        total_count: subscriberIds.length,
        processed_count: 0,
        success_count: 0,
        error_count: 0,
        scheduled_at: scheduled_at,
        drip_config: drip_config
      }
    }), {
      status: 201,
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Enrollment POST error:', error);
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
