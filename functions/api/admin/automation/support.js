/**
 * Support Ticket Automation API
 *
 * Endpoints for processing support tickets and managing automation approvals.
 * Part of Phase 5 - Support Ticket Integration
 */

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Worker-Key',
    'Content-Type': 'application/json'
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the action from query param or path
    const action = url.searchParams.get('action') || 'status';

    switch (action) {
      case 'analyze':
        return await handleAnalyze(request, env, corsHeaders);

      case 'process':
        return await handleProcess(request, env, corsHeaders);

      case 'approvals':
        return await handleApprovals(request, env, corsHeaders);

      case 'approve':
        return await handleApprove(request, env, corsHeaders);

      case 'reject':
        return await handleReject(request, env, corsHeaders);

      case 'stats':
        return await handleStats(request, env, corsHeaders);

      case 'status':
      default:
        return await handleStatus(request, env, corsHeaders);
    }

  } catch (error) {
    console.error('Support API error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * GET/POST ?action=status - Get support automation status
 */
async function handleStatus(request, env, corsHeaders) {
  // Get pending approvals count from D1
  const pendingResult = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM automation_approvals
    WHERE status = 'pending'
  `).first();

  // Get recent processing stats
  const statsResult = await env.DB.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as succeeded,
      SUM(CASE WHEN status = 'queued_for_approval' THEN 1 ELSE 0 END) as queued,
      SUM(CASE WHEN status = 'manual_required' THEN 1 ELSE 0 END) as manual,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM support_ticket_logs
    WHERE created_at > unixepoch() - 86400 * 7
  `).first();

  return new Response(JSON.stringify({
    status: 'active',
    pending_approvals: pendingResult?.count || 0,
    last_7_days: {
      total: statsResult?.total || 0,
      succeeded: statsResult?.succeeded || 0,
      queued_for_approval: statsResult?.queued || 0,
      manual_required: statsResult?.manual || 0,
      failed: statsResult?.failed || 0
    },
    features: {
      ticket_analysis: true,
      decision_engine: true,
      approval_workflow: true,
      auto_execute: true
    }
  }), { headers: corsHeaders });
}

/**
 * POST ?action=analyze - Analyze a support ticket
 */
async function handleAnalyze(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders
    });
  }

  const body = await request.json();
  const { ticket } = body;

  if (!ticket || !ticket.subject || !ticket.body) {
    return new Response(JSON.stringify({
      error: 'Ticket with subject and body required'
    }), { status: 400, headers: corsHeaders });
  }

  // Call the automation worker to analyze
  // In production, this would call the local automation server
  // For now, we use Cloudflare AI as a fallback

  const analysisPrompt = `Analyze this support ticket and determine if it can be automated:

Subject: ${ticket.subject}
Body: ${ticket.body}

Respond with JSON containing:
- task_type: one of [menu_add_items, menu_update_items, menu_delete_items, menu_update_prices, menu_add_category, menu_add_modifier, menu_86_item, kds_add_station, kds_update_routing, info_request, requires_manual, unclear]
- confidence: 0.0 to 1.0
- can_automate: true/false
- summary: 1-2 sentence summary
- extracted_data: { items: [], categories: [], etc }
- missing_info: [] list of missing information`;

  try {
    const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      prompt: analysisPrompt,
      max_tokens: 1024
    });

    // Try to parse the AI response as JSON
    let analysis;
    try {
      const jsonMatch = aiResponse.response.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      analysis = {
        task_type: 'unclear',
        confidence: 0.3,
        can_automate: false,
        summary: 'Could not parse ticket analysis',
        raw_response: aiResponse.response
      };
    }

    // Log the analysis
    await env.DB.prepare(`
      INSERT INTO support_ticket_logs (id, ticket_id, subject, analysis, status, created_at)
      VALUES (?, ?, ?, ?, 'analyzed', unixepoch())
    `).bind(
      crypto.randomUUID(),
      ticket.id || crypto.randomUUID(),
      ticket.subject,
      JSON.stringify(analysis)
    ).run();

    return new Response(JSON.stringify({
      analysis,
      can_automate: analysis.can_automate,
      recommended_action: getRecommendedAction(analysis)
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('Analysis error:', error);
    return new Response(JSON.stringify({
      error: 'Analysis failed',
      details: error.message
    }), { status: 500, headers: corsHeaders });
  }
}

/**
 * POST ?action=process - Process a support ticket through the full pipeline
 */
async function handleProcess(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders
    });
  }

  const body = await request.json();
  const { ticket, client_id, restaurant_id, auto_execute = false } = body;

  if (!ticket || !client_id) {
    return new Response(JSON.stringify({
      error: 'Ticket and client_id required'
    }), { status: 400, headers: corsHeaders });
  }

  const ticketId = ticket.id || crypto.randomUUID();

  // 1. Analyze the ticket
  const analysis = await analyzeWithAI(env, ticket);

  // 2. Make decision
  const decision = makeDecision(analysis, { auto_execute });

  // 3. Based on decision, create approval or job
  let result = {
    ticket_id: ticketId,
    status: decision.decision,
    analysis,
    decision
  };

  if (decision.decision === 'auto_execute' && auto_execute) {
    // Create and queue the job
    const jobId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO automation_jobs (id, type, status, client_id, restaurant_id, job_data, source, created_at)
      VALUES (?, ?, 'queued', ?, ?, ?, 'support_ticket', unixepoch())
    `).bind(
      jobId,
      decision.job_type || 'menu_update',
      client_id,
      restaurant_id,
      JSON.stringify({
        ticket_id: ticketId,
        task_type: analysis.task_type,
        extracted_data: analysis.extracted_data
      })
    ).run();

    result.job_id = jobId;

  } else if (decision.decision === 'needs_approval') {
    // Create approval request
    const approvalId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO automation_approvals (id, ticket_id, client_id, restaurant_id, task_type, summary, analysis, status, priority, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, unixepoch(), unixepoch() + 259200)
    `).bind(
      approvalId,
      ticketId,
      client_id,
      restaurant_id,
      analysis.task_type,
      analysis.summary,
      JSON.stringify(analysis),
      analysis.priority || 'medium'
    ).run();

    result.approval_id = approvalId;
  }

  // Log the processing
  await env.DB.prepare(`
    INSERT INTO support_ticket_logs (id, ticket_id, subject, analysis, decision, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, unixepoch())
  `).bind(
    crypto.randomUUID(),
    ticketId,
    ticket.subject,
    JSON.stringify(analysis),
    JSON.stringify(decision),
    decision.decision
  ).run();

  return new Response(JSON.stringify(result), { headers: corsHeaders });
}

/**
 * GET ?action=approvals - List pending approvals
 */
async function handleApprovals(request, env, corsHeaders) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get('client_id');
  const status = url.searchParams.get('status') || 'pending';
  const limit = parseInt(url.searchParams.get('limit') || '50');

  let query = `
    SELECT * FROM automation_approvals
    WHERE status = ?
  `;
  const params = [status];

  if (clientId) {
    query += ` AND client_id = ?`;
    params.push(clientId);
  }

  query += ` ORDER BY
    CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
    created_at ASC
    LIMIT ?`;
  params.push(limit);

  const results = await env.DB.prepare(query).bind(...params).all();

  // Parse JSON fields
  const approvals = results.results.map(a => ({
    ...a,
    analysis: JSON.parse(a.analysis || '{}')
  }));

  return new Response(JSON.stringify({
    approvals,
    count: approvals.length
  }), { headers: corsHeaders });
}

/**
 * POST ?action=approve - Approve an automation request
 */
async function handleApprove(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders
    });
  }

  const body = await request.json();
  const { approval_id, reviewed_by = 'admin', notes = '' } = body;

  if (!approval_id) {
    return new Response(JSON.stringify({ error: 'approval_id required' }), {
      status: 400,
      headers: corsHeaders
    });
  }

  // Get the approval
  const approval = await env.DB.prepare(`
    SELECT * FROM automation_approvals WHERE id = ?
  `).bind(approval_id).first();

  if (!approval) {
    return new Response(JSON.stringify({ error: 'Approval not found' }), {
      status: 404,
      headers: corsHeaders
    });
  }

  if (approval.status !== 'pending') {
    return new Response(JSON.stringify({ error: 'Approval is not pending' }), {
      status: 400,
      headers: corsHeaders
    });
  }

  // Create the automation job
  const jobId = crypto.randomUUID();
  const analysis = JSON.parse(approval.analysis || '{}');

  await env.DB.prepare(`
    INSERT INTO automation_jobs (id, type, status, client_id, restaurant_id, job_data, source, created_at)
    VALUES (?, ?, 'queued', ?, ?, ?, 'support_approval', unixepoch())
  `).bind(
    jobId,
    getJobType(analysis.task_type),
    approval.client_id,
    approval.restaurant_id,
    JSON.stringify({
      approval_id,
      ticket_id: approval.ticket_id,
      task_type: analysis.task_type,
      extracted_data: analysis.extracted_data
    })
  ).run();

  // Update approval status
  await env.DB.prepare(`
    UPDATE automation_approvals
    SET status = 'approved', reviewed_by = ?, reviewed_at = unixepoch(), review_notes = ?, automation_job_id = ?
    WHERE id = ?
  `).bind(reviewed_by, notes, jobId, approval_id).run();

  return new Response(JSON.stringify({
    success: true,
    approval_id,
    job_id: jobId,
    message: 'Approval processed, automation job created'
  }), { headers: corsHeaders });
}

/**
 * POST ?action=reject - Reject an automation request
 */
async function handleReject(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders
    });
  }

  const body = await request.json();
  const { approval_id, reviewed_by = 'admin', reason = 'Rejected by admin' } = body;

  if (!approval_id) {
    return new Response(JSON.stringify({ error: 'approval_id required' }), {
      status: 400,
      headers: corsHeaders
    });
  }

  // Update approval status
  const result = await env.DB.prepare(`
    UPDATE automation_approvals
    SET status = 'rejected', reviewed_by = ?, reviewed_at = unixepoch(), review_notes = ?
    WHERE id = ? AND status = 'pending'
  `).bind(reviewed_by, reason, approval_id).run();

  if (result.changes === 0) {
    return new Response(JSON.stringify({ error: 'Approval not found or not pending' }), {
      status: 404,
      headers: corsHeaders
    });
  }

  return new Response(JSON.stringify({
    success: true,
    approval_id,
    message: 'Approval rejected'
  }), { headers: corsHeaders });
}

/**
 * GET ?action=stats - Get support automation statistics
 */
async function handleStats(request, env, corsHeaders) {
  // Approval stats
  const approvalStats = await env.DB.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
      SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired
    FROM automation_approvals
  `).first();

  // Processing stats (last 30 days)
  const processingStats = await env.DB.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as auto_executed,
      SUM(CASE WHEN status = 'queued_for_approval' THEN 1 ELSE 0 END) as queued,
      SUM(CASE WHEN status = 'manual_required' THEN 1 ELSE 0 END) as manual,
      SUM(CASE WHEN status = 'needs_info' THEN 1 ELSE 0 END) as needs_info,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM support_ticket_logs
    WHERE created_at > unixepoch() - 86400 * 30
  `).first();

  // Task type breakdown
  const taskTypes = await env.DB.prepare(`
    SELECT
      json_extract(analysis, '$.task_type') as task_type,
      COUNT(*) as count
    FROM support_ticket_logs
    WHERE created_at > unixepoch() - 86400 * 30
    GROUP BY task_type
    ORDER BY count DESC
  `).all();

  const total = processingStats?.total || 0;
  const automated = (processingStats?.auto_executed || 0) + (processingStats?.queued || 0);

  return new Response(JSON.stringify({
    approvals: approvalStats,
    processing_30d: processingStats,
    task_types: taskTypes.results,
    automation_rate: total > 0 ? ((automated / total) * 100).toFixed(1) + '%' : '0%',
    average_approval_rate: approvalStats?.total > 0
      ? ((approvalStats.approved / approvalStats.total) * 100).toFixed(1) + '%'
      : '0%'
  }), { headers: corsHeaders });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function analyzeWithAI(env, ticket) {
  // Use Cloudflare AI for analysis
  try {
    const prompt = `Analyze this support ticket for a restaurant POS system. Return JSON only.

Ticket Subject: ${ticket.subject}
Ticket Body: ${ticket.body}

Return JSON with:
{
  "task_type": "menu_add_items|menu_update_items|menu_delete_items|menu_update_prices|menu_add_category|menu_add_modifier|menu_86_item|kds_add_station|kds_update_routing|info_request|requires_manual|unclear",
  "confidence": 0.0-1.0,
  "can_automate": true/false,
  "summary": "brief summary",
  "priority": "low|medium|high|urgent",
  "extracted_data": { "items": [], "categories": [] },
  "missing_info": []
}`;

    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      prompt,
      max_tokens: 1024
    });

    const jsonMatch = response.response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('AI analysis failed:', error);
  }

  return {
    task_type: 'unclear',
    confidence: 0,
    can_automate: false,
    summary: 'Analysis failed',
    priority: 'medium',
    extracted_data: {},
    missing_info: ['Could not analyze ticket']
  };
}

function makeDecision(analysis, options = {}) {
  const riskLevels = {
    menu_add_items: 'low',
    menu_update_items: 'medium',
    menu_delete_items: 'high',
    menu_update_prices: 'medium',
    menu_add_category: 'low',
    menu_add_modifier: 'low',
    menu_86_item: 'low',
    kds_add_station: 'medium',
    kds_update_routing: 'medium'
  };

  const risk = riskLevels[analysis.task_type] || 'high';

  if (!analysis.can_automate) {
    return { decision: 'manual_only', risk, reasons: ['Cannot be automated'] };
  }

  if (analysis.confidence < 0.6) {
    return { decision: 'manual_only', risk, reasons: ['Low confidence'] };
  }

  if (analysis.missing_info?.length > 0) {
    return { decision: 'needs_info', risk, reasons: ['Missing information'], missing: analysis.missing_info };
  }

  if (analysis.confidence >= 0.85 && risk === 'low' && options.auto_execute) {
    return { decision: 'auto_execute', risk, job_type: getJobType(analysis.task_type), reasons: ['High confidence, low risk'] };
  }

  return { decision: 'needs_approval', risk, job_type: getJobType(analysis.task_type), reasons: ['Requires human review'] };
}

function getRecommendedAction(analysis) {
  if (!analysis.can_automate) return 'manual_handling';
  if (analysis.confidence >= 0.85) return 'auto_execute';
  if (analysis.confidence >= 0.6) return 'queue_for_approval';
  return 'manual_handling';
}

function getJobType(taskType) {
  const mapping = {
    menu_add_items: 'menu_upload',
    menu_update_items: 'menu_update',
    menu_delete_items: 'menu_update',
    menu_update_prices: 'menu_update',
    menu_add_category: 'menu_update',
    menu_add_modifier: 'menu_update',
    menu_86_item: 'menu_update',
    kds_add_station: 'kds_update',
    kds_update_routing: 'kds_update'
  };
  return mapping[taskType] || 'support_task';
}
