/**
 * Email Subscribers Bulk Operations API
 *
 * POST /api/admin/email/subscribers/bulk
 *
 * Actions:
 * - tag: Add a tag to multiple subscribers
 * - remove_tag: Remove a tag from multiple subscribers
 * - enroll: Enroll subscribers in a sequence
 * - delete: Delete multiple subscribers
 * - update_status: Update status for multiple subscribers
 *
 * Supports:
 * - ids: Array of subscriber IDs to operate on
 * - selectAllMatching: Boolean to apply to all subscribers matching filters
 * - filters: Filter object when selectAllMatching is true
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../_shared/auth.js';

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

  // Status filter (multi-value)
  if (filters.statuses && filters.statuses.length > 0) {
    const statusList = Array.isArray(filters.statuses) ? filters.statuses : filters.statuses.split(',');
    const placeholders = statusList.map(() => '?').join(',');
    conditions.push(`status IN (${placeholders})`);
    params.push(...statusList);
  }

  // POS System filter (multi-value)
  if (filters.pos_systems && filters.pos_systems.length > 0) {
    const posList = Array.isArray(filters.pos_systems) ? filters.pos_systems : filters.pos_systems.split(',');
    const placeholders = posList.map(() => '?').join(',');
    conditions.push(`pos_system IN (${placeholders})`);
    params.push(...posList);
  }

  // Geographic Tier filter (multi-value)
  if (filters.geographic_tiers && filters.geographic_tiers.length > 0) {
    const tierList = Array.isArray(filters.geographic_tiers) ? filters.geographic_tiers : filters.geographic_tiers.split(',');
    const placeholders = tierList.map(() => '?').join(',');
    conditions.push(`geographic_tier IN (${placeholders})`);
    params.push(...tierList);
  }

  // Lead Source filter (multi-value)
  if (filters.lead_sources && filters.lead_sources.length > 0) {
    const sourceList = Array.isArray(filters.lead_sources) ? filters.lead_sources : filters.lead_sources.split(',');
    const placeholders = sourceList.map(() => '?').join(',');
    conditions.push(`lead_source IN (${placeholders})`);
    params.push(...sourceList);
  }

  // Score range
  if (filters.score_min !== undefined && filters.score_min > 0) {
    conditions.push('engagement_score >= ?');
    params.push(parseInt(filters.score_min));
  }

  if (filters.score_max !== undefined && filters.score_max < 100) {
    conditions.push('engagement_score <= ?');
    params.push(parseInt(filters.score_max));
  }

  // Tags filter
  if (filters.tags && filters.tags.length > 0) {
    const tagList = Array.isArray(filters.tags) ? filters.tags : filters.tags.split(',');
    const tagConditions = tagList.map(() => `tags LIKE ?`);
    conditions.push(`(${tagConditions.join(' OR ')})`);
    tagList.forEach(tag => params.push(`%"${tag.trim()}"%`));
  }

  // Date range filters
  if (filters.created_after) {
    const timestamp = Math.floor(new Date(filters.created_after).getTime() / 1000);
    if (!isNaN(timestamp)) {
      conditions.push('created_at >= ?');
      params.push(timestamp);
    }
  }

  if (filters.created_before) {
    const date = new Date(filters.created_before);
    date.setHours(23, 59, 59, 999);
    const timestamp = Math.floor(date.getTime() / 1000);
    if (!isNaN(timestamp)) {
      conditions.push('created_at <= ?');
      params.push(timestamp);
    }
  }

  return { conditions, params };
}

/**
 * Get subscriber IDs from filters
 */
async function getSubscriberIdsFromFilters(db, filters, limit = 10000) {
  const { conditions, params } = buildFilterConditions(filters);
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `SELECT id FROM email_subscribers ${whereClause} LIMIT ?`;
  const { results } = await db.prepare(query).bind(...params, limit).all();

  return (results || []).map(r => r.id);
}

export async function onRequestPost(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const body = await context.request.json();

    const { action, selectAllMatching, filters } = body;
    let ids = body.ids;

    // If selectAllMatching is true, get IDs from filters
    if (selectAllMatching && filters) {
      ids = await getSubscriberIdsFromFilters(db, filters);
    }

    if (!action) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Action is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No subscribers match the criteria'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Limit bulk operations to 10000 items for safety
    if (ids.length > 10000) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Maximum 10,000 items per bulk operation'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const now = Math.floor(Date.now() / 1000);
    let affected = 0;

    switch (action) {
      case 'tag': {
        const { tag } = body;
        if (!tag || typeof tag !== 'string' || !tag.trim()) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Tag is required for tag action'
          }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const tagName = tag.trim();

        // Process in batches to avoid hitting D1 limits
        const batchSize = 50;
        for (let i = 0; i < ids.length; i += batchSize) {
          const batch = ids.slice(i, i + batchSize);

          for (const id of batch) {
            try {
              // Get current tags
              const subscriber = await db.prepare(
                'SELECT tags FROM email_subscribers WHERE id = ?'
              ).bind(id).first();

              if (subscriber) {
                let currentTags = [];
                try {
                  currentTags = subscriber.tags ? JSON.parse(subscriber.tags) : [];
                } catch (e) {
                  currentTags = [];
                }

                if (!currentTags.includes(tagName)) {
                  currentTags.push(tagName);
                  await db.prepare(
                    'UPDATE email_subscribers SET tags = ?, updated_at = ? WHERE id = ?'
                  ).bind(JSON.stringify(currentTags), now, id).run();
                  affected++;
                }
              }
            } catch (e) {
              console.error(`Error tagging subscriber ${id}:`, e);
            }
          }
        }

        return new Response(JSON.stringify({
          success: true,
          affected,
          message: `Added tag "${tagName}" to ${affected} subscriber(s)`
        }), {
          headers: corsHeaders
        });
      }

      case 'remove_tag': {
        const { tag } = body;
        if (!tag || typeof tag !== 'string' || !tag.trim()) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Tag is required for remove_tag action'
          }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const tagName = tag.trim();

        const batchSize = 50;
        for (let i = 0; i < ids.length; i += batchSize) {
          const batch = ids.slice(i, i + batchSize);

          for (const id of batch) {
            try {
              const subscriber = await db.prepare(
                'SELECT tags FROM email_subscribers WHERE id = ?'
              ).bind(id).first();

              if (subscriber && subscriber.tags) {
                let currentTags = [];
                try {
                  currentTags = JSON.parse(subscriber.tags);
                } catch (e) {
                  continue;
                }

                const index = currentTags.indexOf(tagName);
                if (index > -1) {
                  currentTags.splice(index, 1);
                  await db.prepare(
                    'UPDATE email_subscribers SET tags = ?, updated_at = ? WHERE id = ?'
                  ).bind(JSON.stringify(currentTags), now, id).run();
                  affected++;
                }
              }
            } catch (e) {
              console.error(`Error removing tag from subscriber ${id}:`, e);
            }
          }
        }

        return new Response(JSON.stringify({
          success: true,
          affected,
          message: `Removed tag "${tagName}" from ${affected} subscriber(s)`
        }), {
          headers: corsHeaders
        });
      }

      case 'enroll': {
        const { sequence_id } = body;
        if (!sequence_id) {
          return new Response(JSON.stringify({
            success: false,
            error: 'sequence_id is required for enroll action'
          }), {
            status: 400,
            headers: corsHeaders
          });
        }

        // Check if sequence exists
        let sequence;
        try {
          sequence = await db.prepare(
            'SELECT id, name FROM email_sequences WHERE id = ?'
          ).bind(sequence_id).first();
        } catch (e) {
          // Sequences table might not exist yet
          return new Response(JSON.stringify({
            success: false,
            error: 'Email sequences not yet configured'
          }), {
            status: 400,
            headers: corsHeaders
          });
        }

        if (!sequence) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Sequence not found'
          }), {
            status: 404,
            headers: corsHeaders
          });
        }

        // Enroll subscribers
        const batchSize = 50;
        for (let i = 0; i < ids.length; i += batchSize) {
          const batch = ids.slice(i, i + batchSize);

          for (const subscriberId of batch) {
            try {
              // Check if already enrolled
              const existingEnrollment = await db.prepare(`
                SELECT id FROM sequence_enrollments
                WHERE subscriber_id = ? AND sequence_id = ? AND status IN ('active', 'paused')
              `).bind(subscriberId, sequence_id).first();

              if (!existingEnrollment) {
                const enrollmentId = crypto.randomUUID();
                await db.prepare(`
                  INSERT INTO sequence_enrollments (
                    id, subscriber_id, sequence_id, status, current_step, enrolled_at
                  ) VALUES (?, ?, ?, 'active', 1, ?)
                `).bind(enrollmentId, subscriberId, sequence_id, now).run();
                affected++;
              }
            } catch (e) {
              console.error(`Error enrolling subscriber ${subscriberId}:`, e);
            }
          }
        }

        return new Response(JSON.stringify({
          success: true,
          affected,
          message: `Enrolled ${affected} subscriber(s) in sequence "${sequence.name}"`
        }), {
          headers: corsHeaders
        });
      }

      case 'delete': {
        // Process in batches
        const batchSize = 50;
        for (let i = 0; i < ids.length; i += batchSize) {
          const batch = ids.slice(i, i + batchSize);

          for (const id of batch) {
            try {
              // Delete related records
              try {
                await db.prepare('DELETE FROM sequence_enrollments WHERE subscriber_id = ?').bind(id).run();
              } catch (e) {}

              try {
                await db.prepare('DELETE FROM email_log WHERE subscriber_id = ?').bind(id).run();
              } catch (e) {}

              // Delete subscriber
              const result = await db.prepare(
                'DELETE FROM email_subscribers WHERE id = ?'
              ).bind(id).run();

              if (result.meta?.changes > 0) {
                affected++;
              }
            } catch (e) {
              console.error(`Error deleting subscriber ${id}:`, e);
            }
          }
        }

        return new Response(JSON.stringify({
          success: true,
          affected,
          message: `Deleted ${affected} subscriber(s)`
        }), {
          headers: corsHeaders
        });
      }

      case 'update_status': {
        const { status } = body;
        const validStatuses = ['active', 'unsubscribed', 'bounced', 'complained'];

        if (!status || !validStatuses.includes(status)) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Valid status is required (active, unsubscribed, bounced, complained)'
          }), {
            status: 400,
            headers: corsHeaders
          });
        }

        // Process in batches for large operations
        const batchSize = 100;
        for (let i = 0; i < ids.length; i += batchSize) {
          const batch = ids.slice(i, i + batchSize);
          const placeholders = batch.map(() => '?').join(',');

          try {
            const result = await db.prepare(`
              UPDATE email_subscribers SET status = ?, updated_at = ? WHERE id IN (${placeholders})
            `).bind(status, now, ...batch).run();

            affected += result.meta?.changes || 0;
          } catch (e) {
            console.error(`Error updating status for batch starting at ${i}:`, e);
          }
        }

        return new Response(JSON.stringify({
          success: true,
          affected,
          message: `Updated ${affected} subscriber(s) to status "${status}"`
        }), {
          headers: corsHeaders
        });
      }

      default:
        return new Response(JSON.stringify({
          success: false,
          error: `Unknown action: ${action}. Valid actions: tag, remove_tag, enroll, delete, update_status`
        }), {
          status: 400,
          headers: corsHeaders
        });
    }
  } catch (error) {
    console.error('Subscribers bulk error:', error);
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
