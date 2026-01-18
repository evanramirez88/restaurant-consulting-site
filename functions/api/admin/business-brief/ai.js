// Business Brief AI Console API - Workers AI Integration
// GET: Returns context and quick actions
// POST: Process AI queries

export async function onRequestGet(context) {
  const { env } = context;

  try {
    const now = Math.floor(Date.now() / 1000);

    // Quick AI actions
    const quickActions = [
      {
        id: 'summarize-today',
        label: 'Summarize Today',
        icon: 'FileText',
        prompt: 'Give me a 2-minute executive summary of today\'s business activity, highlighting any urgent items.',
        category: 'overview'
      },
      {
        id: 'top-priorities',
        label: 'What should I focus on?',
        icon: 'Target',
        prompt: 'Based on current data, what are my top 3 priorities right now and why?',
        category: 'planning'
      },
      {
        id: 'revenue-analysis',
        label: 'Revenue Deep Dive',
        icon: 'DollarSign',
        prompt: 'Analyze my revenue trends and identify specific opportunities to hit my $400K goal by May 1, 2026.',
        category: 'financial'
      },
      {
        id: 'lead-opportunities',
        label: 'Best Lead Opportunities',
        icon: 'Users',
        prompt: 'Which leads have the highest conversion potential right now and what\'s the best approach for each?',
        category: 'sales'
      },
      {
        id: 'client-health',
        label: 'Client Health Check',
        icon: 'Heart',
        prompt: 'Are any clients at risk of churning? What proactive steps should I take to retain them?',
        category: 'retention'
      },
      {
        id: 'weekly-plan',
        label: 'Plan My Week',
        icon: 'Calendar',
        prompt: 'Create a prioritized task list for this week based on all pending items and opportunities.',
        category: 'planning'
      },
      {
        id: 'email-outreach',
        label: 'Draft Outreach',
        icon: 'Mail',
        prompt: 'Draft a personalized follow-up email for the highest-scoring lead that hasn\'t been contacted recently.',
        category: 'sales'
      },
      {
        id: 'support-analysis',
        label: 'Support Patterns',
        icon: 'Headphones',
        prompt: 'What patterns do you see in support tickets? Are there systemic issues I should address?',
        category: 'operations'
      }
    ];

    // Get current business context summary
    const businessContext = await getBusinessContext(env);

    return new Response(JSON.stringify({
      success: true,
      timestamp: now,
      quickActions,
      context: businessContext,
      capabilities: [
        'Answer questions about business performance',
        'Analyze specific clients or leads',
        'Generate outreach messages',
        'Create reports on demand',
        'Suggest strategic actions',
        'Summarize complex data',
        'Draft proposals and quotes',
        'Explain trends and anomalies'
      ],
      modelInfo: {
        available: !!env.AI,
        model: '@cf/meta/llama-3.1-70b-instruct'
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('AI Console GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    const body = await request.json();
    const { action, query, conversationHistory } = body;

    if (!action && !query) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Either action or query is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const now = Math.floor(Date.now() / 1000);

    // Get business context
    const businessContext = await getBusinessContext(env);

    // Build the prompt
    let userPrompt = query;
    if (action) {
      userPrompt = getActionPrompt(action);
    }

    // Build system prompt with business context
    const systemPrompt = buildSystemPrompt(businessContext);

    // Check if Workers AI is available
    if (!env.AI) {
      // Return a mock response if AI is not available
      return new Response(JSON.stringify({
        success: true,
        response: generateMockResponse(userPrompt, businessContext),
        context: businessContext,
        modelUsed: 'mock',
        timestamp: now
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build messages array for chat completion
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history if provided
    if (conversationHistory && Array.isArray(conversationHistory)) {
      conversationHistory.slice(-6).forEach(msg => {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      });
    }

    // Add current query
    messages.push({ role: 'user', content: userPrompt });

    // Call Workers AI
    const aiResponse = await env.AI.run('@cf/meta/llama-3.1-70b-instruct', {
      messages,
      max_tokens: 1024,
      temperature: 0.7
    });

    const responseText = aiResponse.response || aiResponse.text || 'Unable to generate response.';

    // Log the query for audit
    await logAIQuery(env, userPrompt, responseText, now);

    return new Response(JSON.stringify({
      success: true,
      response: responseText,
      context: {
        metricsSnapshot: {
          mrr: businessContext.revenue.mrr,
          clients: businessContext.clients.total,
          hotLeads: businessContext.leads.hot,
          openTickets: businessContext.support.openTickets
        }
      },
      modelUsed: '@cf/meta/llama-3.1-70b-instruct',
      timestamp: now
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('AI Console POST error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function getBusinessContext(env) {
  const now = Math.floor(Date.now() / 1000);
  const todayStart = now - (now % 86400);
  const sevenDaysAgo = now - (7 * 86400);

  const [clients, leads, tickets, quotes, subscriptions, actions] = await Promise.all([
    // Client metrics
    env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN support_plan_status = 'active' THEN 1 END) as active_plans,
        COUNT(CASE WHEN support_plan_tier = 'core' AND support_plan_status = 'active' THEN 1 END) as core,
        COUNT(CASE WHEN support_plan_tier = 'professional' AND support_plan_status = 'active' THEN 1 END) as professional,
        COUNT(CASE WHEN support_plan_tier = 'premium' AND support_plan_status = 'active' THEN 1 END) as premium
      FROM clients
      WHERE status = 'active' OR status IS NULL
    `).first().catch(() => ({})),

    // Lead metrics
    env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN lead_score >= 80 THEN 1 END) as hot,
        COUNT(CASE WHEN lead_score >= 60 AND lead_score < 80 THEN 1 END) as warm,
        COUNT(CASE WHEN created_at > ? THEN 1 END) as new_7d,
        COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as with_email
      FROM restaurant_leads
    `).bind(sevenDaysAgo).first().catch(() => ({})),

    // Ticket metrics
    env.DB.prepare(`
      SELECT
        COUNT(CASE WHEN status != 'resolved' THEN 1 END) as open_tickets,
        COUNT(CASE WHEN priority = 'urgent' AND status != 'resolved' THEN 1 END) as urgent,
        COUNT(CASE WHEN created_at > ? THEN 1 END) as new_today
      FROM tickets
    `).bind(todayStart).first().catch(() => ({})),

    // Quote metrics
    env.DB.prepare(`
      SELECT
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as pending,
        SUM(CASE WHEN status = 'sent' THEN total_amount ELSE 0 END) as pending_value,
        COUNT(CASE WHEN status = 'accepted' AND updated_at > ? THEN 1 END) as accepted_7d
      FROM quotes
    `).bind(sevenDaysAgo).first().catch(() => ({})),

    // Stripe subscriptions
    env.DB.prepare(`
      SELECT
        COUNT(*) as active,
        SUM(mrr_amount) as total_mrr
      FROM stripe_subscriptions
      WHERE status = 'active'
    `).first().catch(() => ({})),

    // Pending actions
    env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN priority = 'critical' THEN 1 END) as critical,
        COUNT(CASE WHEN priority = 'high' THEN 1 END) as high
      FROM business_brief_actions
      WHERE status = 'pending'
    `).first().catch(() => ({}))
  ]);

  // Calculate MRR from plan counts
  const planMRR = (clients?.core || 0) * 350 +
    (clients?.professional || 0) * 500 +
    (clients?.premium || 0) * 800;

  const stripeMRR = subscriptions?.total_mrr || 0;
  const totalMRR = Math.max(planMRR, stripeMRR);

  return {
    timestamp: now,
    revenue: {
      mrr: totalMRR,
      arr: totalMRR * 12,
      target: 400000,
      targetDate: '2026-05-01',
      daysToTarget: Math.floor((new Date('2026-05-01').getTime() / 1000 - now) / 86400),
      progress: Math.round((totalMRR * 12 / 400000) * 100)
    },
    clients: {
      total: clients?.total || 0,
      activePlans: clients?.active_plans || 0,
      byTier: {
        core: clients?.core || 0,
        professional: clients?.professional || 0,
        premium: clients?.premium || 0
      },
      targets: { core: 15, professional: 25, premium: 5 }
    },
    leads: {
      total: leads?.total || 0,
      hot: leads?.hot || 0,
      warm: leads?.warm || 0,
      new7d: leads?.new_7d || 0,
      withEmail: leads?.with_email || 0
    },
    support: {
      openTickets: tickets?.open_tickets || 0,
      urgent: tickets?.urgent || 0,
      newToday: tickets?.new_today || 0
    },
    pipeline: {
      pendingQuotes: quotes?.pending || 0,
      pendingValue: quotes?.pending_value || 0,
      accepted7d: quotes?.accepted_7d || 0
    },
    actions: {
      total: actions?.total || 0,
      critical: actions?.critical || 0,
      high: actions?.high || 0
    }
  };
}

function buildSystemPrompt(context) {
  return `You are the AI Business Advisor for R&G Consulting LLC, a restaurant technology consulting firm specializing in Toast POS systems. You have access to real-time business data and should provide actionable, data-driven advice.

BUSINESS IDENTITY:
- Company: R&G Consulting LLC (DBA: Cape Cod Cable Contractors)
- Owner: Evan Ramirez
- Services: Toast POS consulting, support plans, menu builds, network installations
- Primary Goal: $400,000 revenue by May 1, 2026

CURRENT METRICS (Real-time):
- MRR: $${context.revenue.mrr.toLocaleString()} (${context.revenue.progress}% to goal)
- ARR: $${context.revenue.arr.toLocaleString()}
- Days to Target: ${context.revenue.daysToTarget}

CLIENTS:
- Total Active: ${context.clients.total}
- Core Plan: ${context.clients.byTier.core} (target: ${context.clients.targets.core})
- Professional Plan: ${context.clients.byTier.professional} (target: ${context.clients.targets.professional})
- Premium Plan: ${context.clients.byTier.premium} (target: ${context.clients.targets.premium})

LEADS:
- Total: ${context.leads.total.toLocaleString()}
- Hot (80+ score): ${context.leads.hot}
- Warm (60-79 score): ${context.leads.warm}
- New This Week: ${context.leads.new7d}

SUPPORT:
- Open Tickets: ${context.support.openTickets}
- Urgent: ${context.support.urgent}

PIPELINE:
- Pending Quotes: ${context.pipeline.pendingQuotes}
- Pending Value: $${context.pipeline.pendingValue.toLocaleString()}

PRIORITIES:
- Critical Actions: ${context.actions.critical}
- High Priority Actions: ${context.actions.high}

PRICING REFERENCE:
- Core Support: $350/mo ($1,050/qtr)
- Professional Support: $500/mo ($1,500/qtr)
- Premium Support: $800/mo ($2,400/qtr)
- Menu Build (Remote): $1,500-$2,500
- Implementation: $3,500 + $350/station

GUIDELINES:
1. Be concise but thorough - restaurant owners are busy
2. Always tie recommendations back to the $400K goal
3. Prioritize revenue-generating activities
4. Identify quick wins when possible
5. Be specific with numbers and actionable steps
6. Flag any concerning trends proactively
7. Consider both Lane A (local Cape Cod) and Lane B (national remote) strategies`;
}

function getActionPrompt(action) {
  const prompts = {
    'summarize-today': 'Give me a 2-minute executive summary of today\'s business activity, highlighting any urgent items that need my attention.',
    'top-priorities': 'Based on current data, what are my top 3 priorities right now? Explain why each is important and what specific action I should take.',
    'revenue-analysis': 'Analyze my revenue situation. How am I tracking toward the $400K goal? What are the biggest opportunities to accelerate growth?',
    'lead-opportunities': 'Which leads have the highest conversion potential right now? For each, recommend a specific outreach approach.',
    'client-health': 'Are any clients showing warning signs of churn? What proactive steps should I take to improve retention?',
    'weekly-plan': 'Create a prioritized task list for this week. Focus on high-impact activities that drive revenue.',
    'email-outreach': 'Draft a personalized follow-up email for a high-potential lead. Make it professional but warm.',
    'support-analysis': 'What patterns do you see in the support ticket data? Are there systemic issues I should address?'
  };
  return prompts[action] || action;
}

function generateMockResponse(query, context) {
  // Generate a helpful mock response when Workers AI is unavailable
  const queryLower = query.toLowerCase();

  if (queryLower.includes('summary') || queryLower.includes('today')) {
    return `**Daily Business Summary**

Based on current data:
- **Revenue**: $${context.revenue.mrr.toLocaleString()} MRR (${context.revenue.progress}% toward $400K goal)
- **Active Clients**: ${context.clients.total} total, ${context.clients.activePlans} with support plans
- **Hot Leads**: ${context.leads.hot} leads with 80+ scores ready for outreach
- **Support**: ${context.support.openTickets} open tickets (${context.support.urgent} urgent)
- **Pipeline**: ${context.pipeline.pendingQuotes} pending quotes worth $${context.pipeline.pendingValue.toLocaleString()}

**Recommended Focus Areas**:
1. Follow up with ${context.leads.hot} hot leads to convert pipeline
2. Address ${context.support.urgent} urgent support tickets
3. Close pending quotes to boost revenue

*Note: AI analysis temporarily using cached insights. Full AI will be available shortly.*`;
  }

  if (queryLower.includes('priorities') || queryLower.includes('focus')) {
    return `**Top 3 Priorities**

1. **Convert Hot Leads** (${context.leads.hot} available)
   - These leads scored 80+ and are prime for conversion
   - Action: Personal outreach within 24 hours

2. **Close Pending Quotes** ($${context.pipeline.pendingValue.toLocaleString()} in pipeline)
   - ${context.pipeline.pendingQuotes} quotes awaiting response
   - Action: Follow up on quotes older than 3 days

3. **Support Plan Expansion**
   - Current: ${context.clients.byTier.core} Core, ${context.clients.byTier.professional} Professional, ${context.clients.byTier.premium} Premium
   - Gap to target: ${Math.max(0, 15 - context.clients.byTier.core)} Core, ${Math.max(0, 25 - context.clients.byTier.professional)} Professional, ${Math.max(0, 5 - context.clients.byTier.premium)} Premium
   - Action: Identify upsell candidates from existing client base`;
  }

  if (queryLower.includes('revenue') || queryLower.includes('400k')) {
    const gap = 400000 - context.revenue.arr;
    return `**Revenue Analysis**

**Current Status**:
- MRR: $${context.revenue.mrr.toLocaleString()}
- ARR: $${context.revenue.arr.toLocaleString()}
- Progress: ${context.revenue.progress}% of $400K goal
- Gap: $${gap.toLocaleString()} needed
- Days Remaining: ${context.revenue.daysToTarget}

**Path to $400K**:
To hit target, you need approximately $${Math.round(gap / context.revenue.daysToTarget * 7).toLocaleString()}/week in new revenue.

**Opportunities**:
1. Convert ${context.leads.hot} hot leads (potential: ~$${(context.leads.hot * 450).toLocaleString()}/mo)
2. Close pending quotes ($${context.pipeline.pendingValue.toLocaleString()})
3. Upsell existing clients to higher tiers`;
  }

  return `I understand you're asking about "${query.substring(0, 50)}..."

Based on your current metrics:
- MRR: $${context.revenue.mrr.toLocaleString()} (${context.revenue.progress}% to goal)
- Clients: ${context.clients.total} active
- Hot Leads: ${context.leads.hot}
- Open Tickets: ${context.support.openTickets}

I can provide more specific analysis on:
- Revenue and goal tracking
- Lead conversion strategies
- Client health and retention
- Support optimization

What aspect would you like me to focus on?`;
}

async function logAIQuery(env, query, response, timestamp) {
  try {
    await env.DB.prepare(`
      INSERT INTO ai_query_log (query, response_preview, created_at)
      VALUES (?, ?, ?)
    `).bind(
      query.substring(0, 500),
      response.substring(0, 200),
      timestamp
    ).run();
  } catch (e) {
    // Log table might not exist, ignore
  }
}
