/**
 * Email Subscribers Bulk Operations API
 *
 * POST /api/admin/email/subscribers/bulk
 *
 * Actions:
 * - tag: Add a tag to multiple subscribers
 * - enroll: Enroll subscribers in a sequence
 * - delete: Delete multiple subscribers
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../../../_shared/auth.js';

export async function onRequestPost(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;
    const body = await context.request.json();

    const { action, ids } = body;

    if (!action || !ids || !Array.isArray(ids) || ids.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Action and ids array are required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Limit bulk operations to 1000 items
    if (ids.length > 1000) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Maximum 1000 items per bulk operation'
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
        for (const subscriberId of ids) {
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

        return new Response(JSON.stringify({
          success: true,
          affected,
          message: `Enrolled ${affected} subscriber(s) in sequence`
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

        for (const id of ids) {
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

        return new Response(JSON.stringify({
          success: true,
          affected,
          message: `Removed tag "${tagName}" from ${affected} subscriber(s)`
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

        // Use placeholders for batch update
        const placeholders = ids.map(() => '?').join(',');
        const result = await db.prepare(`
          UPDATE email_subscribers SET status = ?, updated_at = ? WHERE id IN (${placeholders})
        `).bind(status, now, ...ids).run();

        affected = result.meta?.changes || 0;

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
