// Business Brief Strategy API - Planning, Goals & Lane Strategy
// GET: Returns strategy data (goals, support plan mix, lane breakdown, scenarios)

export async function onRequestGet(context) {
  const { env } = context;

  try {
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - (30 * 86400);

    // Parallel fetch all strategy data
    const [
      // Goals
      goals,
      goalMilestones,

      // Support plan breakdown
      supportPlanClients,
      stripeSubscriptions,

      // Lane A (Local Cape Cod) - Massachusetts clients
      laneAClients,
      laneARevenue,
      laneALeads,

      // Lane B (National Remote) - Non-MA clients
      laneBClients,
      laneBRevenue,
      laneBLeads,

      // Quote metrics for projections
      activeQuotes,
      recentConversions
    ] = await Promise.all([
      // Get all active goals
      env.DB.prepare(`
        SELECT * FROM business_goals
        WHERE status IN ('active', 'on_track', 'at_risk', 'behind')
        ORDER BY deadline ASC
      `).all().catch(() => ({ results: [] })),

      // Get goal milestones
      env.DB.prepare(`
        SELECT gm.*, bg.title as goal_title
        FROM goal_milestones gm
        JOIN business_goals bg ON gm.goal_id = bg.id
        ORDER BY gm.target_date ASC
      `).all().catch(() => ({ results: [] })),

      // Support plan client breakdown
      env.DB.prepare(`
        SELECT
          COALESCE(support_plan_tier, 'none') as tier,
          COUNT(*) as count
        FROM clients
        WHERE status = 'active' OR status IS NULL
        GROUP BY support_plan_tier
      `).all().catch(() => ({ results: [] })),

      // Stripe subscriptions by product
      env.DB.prepare(`
        SELECT
          product_name,
          COUNT(*) as count,
          SUM(CASE WHEN billing_interval = 'month' THEN amount ELSE amount / 12 END) as mrr
        FROM stripe_subscriptions
        WHERE status = 'active'
        GROUP BY product_name
      `).all().catch(() => ({ results: [] })),

      // Lane A: Massachusetts clients
      env.DB.prepare(`
        SELECT COUNT(*) as count
        FROM clients
        WHERE (state = 'MA' OR state = 'Massachusetts')
        AND (status = 'active' OR status IS NULL)
      `).first().catch(() => ({ count: 0 })),

      // Lane A: Revenue from MA (Square Location L6GGMPCHFM6WR)
      env.DB.prepare(`
        SELECT
          COALESCE(SUM(CASE WHEN status = 'PAID' THEN total END), 0) as paid,
          COALESCE(SUM(CASE WHEN status = 'UNPAID' THEN total END), 0) as pending
        FROM invoices
        WHERE location_id = 'L6GGMPCHFM6WR' OR location_id IS NULL
        AND created_at > ?
      `).bind(thirtyDaysAgo).first().catch(() => ({ paid: 0, pending: 0 })),

      // Lane A: MA leads
      env.DB.prepare(`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN lead_score >= 80 THEN 1 END) as hot
        FROM restaurant_leads
        WHERE state = 'MA' OR state = 'Massachusetts'
      `).first().catch(() => ({ total: 0, hot: 0 })),

      // Lane B: Non-MA clients
      env.DB.prepare(`
        SELECT COUNT(*) as count
        FROM clients
        WHERE (state != 'MA' AND state != 'Massachusetts' AND state IS NOT NULL)
        OR state IS NULL
        AND (status = 'active' OR status IS NULL)
      `).first().catch(() => ({ count: 0 })),

      // Lane B: Revenue from National (Square Location LB8GE5HYZJYB7 + Stripe)
      env.DB.prepare(`
        SELECT
          COALESCE(SUM(CASE WHEN status = 'PAID' THEN total END), 0) as paid,
          COALESCE(SUM(CASE WHEN status = 'UNPAID' THEN total END), 0) as pending
        FROM invoices
        WHERE location_id = 'LB8GE5HYZJYB7'
        AND created_at > ?
      `).bind(thirtyDaysAgo).first().catch(() => ({ paid: 0, pending: 0 })),

      // Lane B: Non-MA leads
      env.DB.prepare(`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN lead_score >= 80 THEN 1 END) as hot
        FROM restaurant_leads
        WHERE state != 'MA' AND state != 'Massachusetts'
      `).first().catch(() => ({ total: 0, hot: 0 })),

      // Active quotes for projections
      env.DB.prepare(`
        SELECT
          COUNT(*) as count,
          COALESCE(SUM(total_amount), 0) as value
        FROM quotes
        WHERE status IN ('draft', 'sent', 'viewed')
      `).first().catch(() => ({ count: 0, value: 0 })),

      // Recent conversions for close rate
      env.DB.prepare(`
        SELECT
          COUNT(CASE WHEN status = 'accepted' THEN 1 END) as won,
          COUNT(CASE WHEN status IN ('declined', 'expired') THEN 1 END) as lost,
          COALESCE(SUM(CASE WHEN status = 'accepted' THEN total_amount END), 0) as value
        FROM quotes
        WHERE updated_at > ?
      `).bind(thirtyDaysAgo).first().catch(() => ({ won: 0, lost: 0, value: 0 }))
    ]);

    // Process support plan breakdown
    const planBreakdown = {
      core: 0,
      professional: 0,
      premium: 0,
      none: 0
    };

    (supportPlanClients?.results || []).forEach(row => {
      const tier = (row.tier || 'none').toLowerCase();
      if (tier.includes('core')) planBreakdown.core = row.count;
      else if (tier.includes('professional') || tier.includes('pro')) planBreakdown.professional = row.count;
      else if (tier.includes('premium')) planBreakdown.premium = row.count;
      else planBreakdown.none = row.count;
    });

    // Calculate MRR from plans
    const planMRR = {
      core: planBreakdown.core * 350,
      professional: planBreakdown.professional * 500,
      premium: planBreakdown.premium * 800
    };
    const totalMRR = planMRR.core + planMRR.professional + planMRR.premium;

    // Target plan mix from $400K goal
    const targetMix = {
      core: 15,
      professional: 25,
      premium: 5,
      totalMRR: (15 * 350) + (25 * 500) + (5 * 800) // $21,750/mo
    };

    // Process Stripe subscriptions for additional breakdown
    const stripeBreakdown = {};
    (stripeSubscriptions?.results || []).forEach(sub => {
      stripeBreakdown[sub.product_name || 'Unknown'] = {
        count: sub.count,
        mrr: sub.mrr || 0
      };
    });

    // Process goals with milestones
    const processedGoals = (goals?.results || []).map(goal => {
      const milestones = (goalMilestones?.results || [])
        .filter(m => m.goal_id === goal.id)
        .map(m => ({
          id: m.id,
          title: m.title,
          targetDate: m.target_date,
          targetValue: m.target_value,
          actualValue: m.actual_value,
          achieved: m.actual_value && m.actual_value >= m.target_value
        }));

      const percentComplete = goal.target_value > 0
        ? ((goal.current_value / goal.target_value) * 100)
        : 0;

      // Calculate days remaining
      const daysRemaining = goal.deadline
        ? Math.ceil((goal.deadline - now) / 86400)
        : null;

      // Calculate required daily rate to hit target
      const remainingValue = goal.target_value - goal.current_value;
      const requiredDailyRate = daysRemaining && daysRemaining > 0
        ? remainingValue / daysRemaining
        : null;

      return {
        ...goal,
        milestones,
        percentComplete,
        daysRemaining,
        remainingValue,
        requiredDailyRate,
        formattedDeadline: goal.deadline
          ? new Date(goal.deadline * 1000).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            })
          : null
      };
    });

    // Calculate close rate
    const totalDecided = (recentConversions?.won || 0) + (recentConversions?.lost || 0);
    const closeRate = totalDecided > 0
      ? ((recentConversions.won / totalDecided) * 100).toFixed(1)
      : 0;

    // Build scenario projections
    const scenarios = {
      conservative: {
        label: 'Conservative',
        assumedCloseRate: Math.max(parseFloat(closeRate) - 10, 10),
        projectedValue: (activeQuotes?.value || 0) * 0.15,
        description: 'Based on 15% of active pipeline'
      },
      moderate: {
        label: 'Moderate',
        assumedCloseRate: parseFloat(closeRate) || 25,
        projectedValue: (activeQuotes?.value || 0) * 0.25,
        description: 'Based on current close rate'
      },
      optimistic: {
        label: 'Optimistic',
        assumedCloseRate: Math.min(parseFloat(closeRate) + 15, 50),
        projectedValue: (activeQuotes?.value || 0) * 0.40,
        description: 'Based on improved conversion efforts'
      }
    };

    // Build response
    const strategy = {
      timestamp: now,
      lastUpdated: new Date().toISOString(),

      goals: processedGoals,

      supportPlanMix: {
        current: planBreakdown,
        target: targetMix,
        mrr: {
          current: totalMRR,
          target: targetMix.totalMRR,
          byTier: planMRR
        },
        progress: {
          core: targetMix.core > 0 ? ((planBreakdown.core / targetMix.core) * 100).toFixed(0) : 0,
          professional: targetMix.professional > 0 ? ((planBreakdown.professional / targetMix.professional) * 100).toFixed(0) : 0,
          premium: targetMix.premium > 0 ? ((planBreakdown.premium / targetMix.premium) * 100).toFixed(0) : 0
        },
        stripeProducts: stripeBreakdown
      },

      lanes: {
        a: {
          name: 'Lane A: Local Cape Cod',
          description: 'On-site services, menu builds, training, IT/networking',
          clients: laneAClients?.count || 0,
          revenue30d: laneARevenue?.paid || 0,
          pendingRevenue: laneARevenue?.pending || 0,
          leads: {
            total: laneALeads?.total || 0,
            hot: laneALeads?.hot || 0
          },
          services: [
            'Menu Builds (On-site)',
            'Staff Training',
            'Network Installation',
            'On-site Support'
          ],
          squareLocation: 'L6GGMPCHFM6WR'
        },
        b: {
          name: 'Lane B: National Remote',
          description: 'Remote Toast consulting, support plans, referrals',
          clients: laneBClients?.count || 0,
          revenue30d: laneBRevenue?.paid || 0,
          pendingRevenue: laneBRevenue?.pending || 0,
          leads: {
            total: laneBLeads?.total || 0,
            hot: laneBLeads?.hot || 0
          },
          services: [
            'Toast Guardian Plans',
            'Remote Menu Builds',
            'Consultations',
            'Toast Referrals'
          ],
          squareLocation: 'LB8GE5HYZJYB7'
        }
      },

      pipeline: {
        activeQuotes: activeQuotes?.count || 0,
        pipelineValue: activeQuotes?.value || 0,
        closeRate: parseFloat(closeRate),
        recentWins: recentConversions?.won || 0,
        recentValue: recentConversions?.value || 0
      },

      scenarios
    };

    return new Response(JSON.stringify({
      success: true,
      ...strategy
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Strategy API error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// POST: Run scenario analysis
export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    const body = await request.json();
    const { operation } = body;

    if (operation === 'calculate_scenario') {
      const {
        additionalClients = {},
        improvedCloseRate = 0,
        pipelineValue = 0
      } = body;

      // Calculate projected impact
      const mrrImpact =
        (additionalClients.core || 0) * 350 +
        (additionalClients.professional || 0) * 500 +
        (additionalClients.premium || 0) * 800;

      const projectedPipelineConversion = pipelineValue * (improvedCloseRate / 100);

      return new Response(JSON.stringify({
        success: true,
        scenario: {
          additionalMRR: mrrImpact,
          additionalARR: mrrImpact * 12,
          projectedPipelineConversion,
          totalProjectedImpact: projectedPipelineConversion + (mrrImpact * 3), // 3 months
          breakdown: {
            fromNewClients: mrrImpact * 3,
            fromPipeline: projectedPipelineConversion
          }
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Unknown operation'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
