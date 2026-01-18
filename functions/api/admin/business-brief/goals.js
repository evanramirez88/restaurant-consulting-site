/**
 * Business Brief Goals API
 *
 * GET  /api/admin/business-brief/goals - List goals
 * POST /api/admin/business-brief/goals - Create/update goals
 *
 * Track strategic business goals with milestones
 */

import { verifyAuth, unauthorizedResponse, getCorsOrigin, handleOptions } from '../../../_shared/auth.js';

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

function generateId() {
  return 'goal_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * GET /api/admin/business-brief/goals
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status'); // active, completed, archived
    const category = url.searchParams.get('category');
    const includeChildren = url.searchParams.get('includeChildren') !== 'false';

    // Build query
    let query = `SELECT * FROM business_goals WHERE 1=1`;
    const params = [];

    if (status && status !== 'all') {
      query += ` AND status = ?`;
      params.push(status);
    } else if (!status) {
      // Default to active goals
      query += ` AND status NOT IN ('archived')`;
    }

    if (category) {
      query += ` AND category = ?`;
      params.push(category);
    }

    // Only top-level goals unless children requested
    if (!includeChildren) {
      query += ` AND parent_goal_id IS NULL`;
    }

    query += ` ORDER BY priority ASC, deadline ASC`;

    const goals = await env.DB.prepare(query).bind(...params).all();

    // Get milestones for each goal
    const goalsWithMilestones = await Promise.all(
      (goals.results || []).map(async (goal) => {
        const milestones = await env.DB.prepare(`
          SELECT * FROM goal_milestones
          WHERE goal_id = ?
          ORDER BY target_date ASC
        `).bind(goal.id).all();

        // Get children if this is a parent goal
        let children = [];
        if (!goal.parent_goal_id) {
          const childGoals = await env.DB.prepare(`
            SELECT * FROM business_goals
            WHERE parent_goal_id = ?
            ORDER BY priority ASC
          `).bind(goal.id).all();
          children = childGoals.results || [];
        }

        // Calculate progress
        const progress = goal.target_value > 0
          ? (goal.current_value / goal.target_value) * 100
          : 0;

        // Determine if on track based on time vs progress
        const now = Math.floor(Date.now() / 1000);
        let calculatedStatus = goal.status;

        if (goal.status === 'active' && goal.deadline && goal.start_date) {
          const totalDuration = goal.deadline - goal.start_date;
          const elapsed = now - goal.start_date;
          const expectedProgress = (elapsed / totalDuration) * 100;

          if (progress >= 100) {
            calculatedStatus = 'completed';
          } else if (progress >= expectedProgress - 10) {
            calculatedStatus = 'on_track';
          } else if (progress >= expectedProgress - 25) {
            calculatedStatus = 'at_risk';
          } else {
            calculatedStatus = 'behind';
          }
        }

        return {
          ...goal,
          milestones: milestones.results || [],
          children: children,
          progress: Math.round(progress * 10) / 10,
          calculatedStatus: calculatedStatus
        };
      })
    );

    return new Response(JSON.stringify({
      success: true,
      data: goalsWithMilestones
    }), {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Goals list error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * POST /api/admin/business-brief/goals
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    const auth = await verifyAuth(request, env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const body = await request.json();
    const now = Math.floor(Date.now() / 1000);
    const operation = body.operation || 'create';

    switch (operation) {
      case 'create': {
        if (!body.title || !body.category || body.targetValue === undefined) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Missing required fields: title, category, targetValue'
          }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const id = body.id || generateId();

        await env.DB.prepare(`
          INSERT INTO business_goals (
            id, title, description, category,
            target_value, current_value, unit,
            start_date, deadline, status, priority,
            parent_goal_id, calculation_method, calculation_config,
            color, icon, notes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id,
          body.title,
          body.description || null,
          body.category,
          body.targetValue,
          body.currentValue || 0,
          body.unit || 'count',
          body.startDate || now,
          body.deadline || null,
          body.status || 'active',
          body.priority || 1,
          body.parentGoalId || null,
          body.calculationMethod || 'manual',
          body.calculationConfig ? JSON.stringify(body.calculationConfig) : null,
          body.color || null,
          body.icon || null,
          body.notes || null,
          now,
          now
        ).run();

        // Create milestones if provided
        if (body.milestones && Array.isArray(body.milestones)) {
          for (const milestone of body.milestones) {
            const msId = 'ms_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
            await env.DB.prepare(`
              INSERT INTO goal_milestones (id, goal_id, title, target_date, target_value, notes, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).bind(
              msId,
              id,
              milestone.title || null,
              milestone.targetDate,
              milestone.targetValue,
              milestone.notes || null,
              now
            ).run();
          }
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Goal created',
          id: id
        }), {
          headers: corsHeaders
        });
      }

      case 'update': {
        if (!body.id) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Missing goal id'
          }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const updates = [];
        const params = [];

        if (body.title !== undefined) { updates.push('title = ?'); params.push(body.title); }
        if (body.description !== undefined) { updates.push('description = ?'); params.push(body.description); }
        if (body.targetValue !== undefined) { updates.push('target_value = ?'); params.push(body.targetValue); }
        if (body.currentValue !== undefined) { updates.push('current_value = ?'); params.push(body.currentValue); }
        if (body.status !== undefined) { updates.push('status = ?'); params.push(body.status); }
        if (body.deadline !== undefined) { updates.push('deadline = ?'); params.push(body.deadline); }
        if (body.priority !== undefined) { updates.push('priority = ?'); params.push(body.priority); }
        if (body.notes !== undefined) { updates.push('notes = ?'); params.push(body.notes); }

        updates.push('updated_at = ?');
        params.push(now);
        params.push(body.id);

        await env.DB.prepare(`
          UPDATE business_goals SET ${updates.join(', ')} WHERE id = ?
        `).bind(...params).run();

        // Record value change if currentValue updated
        if (body.currentValue !== undefined) {
          const historyId = 'gh_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
          await env.DB.prepare(`
            INSERT INTO goal_value_history (id, goal_id, recorded_value, recorded_at, change_type, change_reason)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(
            historyId,
            body.id,
            body.currentValue,
            now,
            body.changeType || 'manual',
            body.changeReason || null
          ).run();
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Goal updated'
        }), {
          headers: corsHeaders
        });
      }

      case 'update_value': {
        // Shorthand for just updating current value
        if (!body.id || body.value === undefined) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Missing goal id or value'
          }), {
            status: 400,
            headers: corsHeaders
          });
        }

        await env.DB.prepare(`
          UPDATE business_goals
          SET current_value = ?, updated_at = ?
          WHERE id = ?
        `).bind(body.value, now, body.id).run();

        // Record history
        const historyId = 'gh_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        await env.DB.prepare(`
          INSERT INTO goal_value_history (id, goal_id, recorded_value, recorded_at, change_type, change_reason)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          historyId,
          body.id,
          body.value,
          now,
          'manual',
          body.reason || null
        ).run();

        return new Response(JSON.stringify({
          success: true,
          message: 'Goal value updated'
        }), {
          headers: corsHeaders
        });
      }

      case 'add_milestone': {
        if (!body.goalId || !body.targetDate || body.targetValue === undefined) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Missing required fields: goalId, targetDate, targetValue'
          }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const msId = body.id || ('ms_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5));

        await env.DB.prepare(`
          INSERT INTO goal_milestones (id, goal_id, title, target_date, target_value, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          msId,
          body.goalId,
          body.title || null,
          body.targetDate,
          body.targetValue,
          body.notes || null,
          now
        ).run();

        return new Response(JSON.stringify({
          success: true,
          message: 'Milestone added',
          id: msId
        }), {
          headers: corsHeaders
        });
      }

      case 'update_milestone': {
        if (!body.id) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Missing milestone id'
          }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const updates = [];
        const params = [];

        if (body.actualValue !== undefined) {
          updates.push('actual_value = ?');
          params.push(body.actualValue);

          if (body.actualValue >= (body.targetValue || 0)) {
            updates.push('achieved_at = ?');
            params.push(now);
          }
        }
        if (body.notes !== undefined) { updates.push('notes = ?'); params.push(body.notes); }

        params.push(body.id);

        if (updates.length > 0) {
          await env.DB.prepare(`
            UPDATE goal_milestones SET ${updates.join(', ')} WHERE id = ?
          `).bind(...params).run();
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Milestone updated'
        }), {
          headers: corsHeaders
        });
      }

      case 'archive': {
        if (!body.id) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Missing goal id'
          }), {
            status: 400,
            headers: corsHeaders
          });
        }

        await env.DB.prepare(`
          UPDATE business_goals
          SET status = 'archived', updated_at = ?
          WHERE id = ?
        `).bind(now, body.id).run();

        return new Response(JSON.stringify({
          success: true,
          message: 'Goal archived'
        }), {
          headers: corsHeaders
        });
      }

      case 'delete': {
        if (!body.id) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Missing goal id'
          }), {
            status: 400,
            headers: corsHeaders
          });
        }

        // Delete milestones first (cascade should handle this but being explicit)
        await env.DB.prepare(`DELETE FROM goal_milestones WHERE goal_id = ?`).bind(body.id).run();
        await env.DB.prepare(`DELETE FROM goal_value_history WHERE goal_id = ?`).bind(body.id).run();
        await env.DB.prepare(`DELETE FROM business_goals WHERE id = ?`).bind(body.id).run();

        return new Response(JSON.stringify({
          success: true,
          message: 'Goal deleted'
        }), {
          headers: corsHeaders
        });
      }

      case 'calculate': {
        // Auto-calculate goal values from system data
        const calculated = await calculateGoalValues(env);

        return new Response(JSON.stringify({
          success: true,
          message: `Calculated ${calculated} goal values`
        }), {
          headers: corsHeaders
        });
      }

      default:
        return new Response(JSON.stringify({
          success: false,
          error: `Unknown operation: ${operation}`
        }), {
          status: 400,
          headers: corsHeaders
        });
    }

  } catch (error) {
    console.error('Goals operation error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * Auto-calculate goal values from system data
 */
async function calculateGoalValues(env) {
  const now = Math.floor(Date.now() / 1000);
  let calculated = 0;

  // Get all goals with auto calculation methods
  const autoGoals = await env.DB.prepare(`
    SELECT * FROM business_goals
    WHERE calculation_method != 'manual'
    AND status IN ('active', 'on_track', 'at_risk', 'behind')
  `).all();

  for (const goal of (autoGoals.results || [])) {
    let newValue = null;

    switch (goal.calculation_method) {
      case 'auto_combined_revenue': {
        // Calculate from Stripe MRR + Square invoices
        const planBreakdown = await env.DB.prepare(`
          SELECT
            SUM(CASE WHEN support_plan_tier = 'core' THEN 1 ELSE 0 END) as core,
            SUM(CASE WHEN support_plan_tier = 'professional' THEN 1 ELSE 0 END) as professional,
            SUM(CASE WHEN support_plan_tier = 'premium' THEN 1 ELSE 0 END) as premium
          FROM clients
          WHERE support_plan_status = 'active'
        `).first();

        const mrr = ((planBreakdown?.core || 0) * 350) +
                    ((planBreakdown?.professional || 0) * 500) +
                    ((planBreakdown?.premium || 0) * 800);

        // For annual target, multiply by months since start
        if (goal.start_date) {
          const monthsElapsed = Math.max(1, Math.ceil((now - goal.start_date) / (30 * 86400)));
          newValue = mrr * monthsElapsed;
        } else {
          newValue = mrr;
        }
        break;
      }

      case 'auto_support_plan_count': {
        const count = await env.DB.prepare(`
          SELECT COUNT(*) as count FROM clients
          WHERE support_plan_status = 'active'
        `).first();
        newValue = count?.count || 0;
        break;
      }

      case 'auto_client_count': {
        const count = await env.DB.prepare(`
          SELECT COUNT(*) as count FROM clients
        `).first();
        newValue = count?.count || 0;
        break;
      }

      case 'auto_lead_count': {
        const count = await env.DB.prepare(`
          SELECT COUNT(*) as count FROM restaurant_leads
          WHERE status IN ('prospect', 'lead', 'qualified', 'opportunity')
        `).first();
        newValue = count?.count || 0;
        break;
      }

      case 'auto_stripe_mrr': {
        // This would query Stripe API or cached data
        // For now use plan breakdown calculation
        const planBreakdown = await env.DB.prepare(`
          SELECT
            SUM(CASE WHEN support_plan_tier = 'core' THEN 350 ELSE 0 END) +
            SUM(CASE WHEN support_plan_tier = 'professional' THEN 500 ELSE 0 END) +
            SUM(CASE WHEN support_plan_tier = 'premium' THEN 800 ELSE 0 END) as mrr
          FROM clients
          WHERE support_plan_status = 'active'
        `).first();
        newValue = planBreakdown?.mrr || 0;
        break;
      }
    }

    if (newValue !== null && newValue !== goal.current_value) {
      await env.DB.prepare(`
        UPDATE business_goals
        SET current_value = ?, updated_at = ?
        WHERE id = ?
      `).bind(newValue, now, goal.id).run();

      // Record history
      const historyId = 'gh_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      await env.DB.prepare(`
        INSERT INTO goal_value_history (id, goal_id, recorded_value, recorded_at, change_type)
        VALUES (?, ?, ?, ?, 'auto')
      `).bind(historyId, goal.id, newValue, now).run();

      calculated++;
    }
  }

  return calculated;
}

export async function onRequestOptions(context) {
  return handleOptions(context.request);
}
