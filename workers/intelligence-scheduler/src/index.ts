/**
 * R&G Consulting - Intelligence Scheduler Worker
 *
 * Runs the Core 4 Intelligence Agents on a scheduled basis:
 * - Hunter (4 AM EST): Licensing board scans, real estate monitoring
 * - Analyst (5 AM EST): Tech stack auditing, LinkedIn network mapping
 * - Operator (6 AM EST): SMS log auditing, automation health checks
 * - Strategist (7 AM EST): Lead scoring and prioritization
 *
 * After the Strategist runs, sends a daily brief email.
 */

interface Env {
  DB: D1Database;
  RATE_LIMIT_KV: KVNamespace;
  API_BASE_URL: string;
  ADMIN_EMAIL: string;
  WORKER_API_KEY: string;
  RESEND_API_KEY: string;
  BRAVE_API_KEY?: string;
}

interface AgentResult {
  success: boolean;
  timestamp: string;
  agents: Array<{
    id: string;
    name: string;
    result: {
      agent: string;
      started: number;
      ended: number;
      tasks: Array<{
        task: string;
        status: string;
        [key: string]: unknown;
      }>;
      dailyBrief?: DailyBrief;
      scoredLeads?: number;
      gapsIdentified?: number;
      posBreakdown?: Record<string, number>;
      healthChecks?: Record<string, unknown>;
      alerts?: Array<{
        type: string;
        severity: string;
        count: number;
        jobs?: unknown[];
      }>;
    };
    duration: number;
  }>;
}

interface DailyBrief {
  date: string;
  newLeads: number;
  highValueLeads: Array<{
    company_name: string;
    city: string;
    state: string;
    lead_score: number;
    current_pos: string;
  }>;
  scoreDistribution: Record<string, number>;
  recommendations: string[];
}

interface AgentLog {
  id: string;
  agent: string;
  status: 'started' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  started_at: number;
  ended_at?: number;
}

// Map UTC hours to agent names
// Times adjusted from EST to UTC (+5 hours)
const AGENT_SCHEDULE: Record<number, string> = {
  9: 'hunter',     // 4 AM EST
  10: 'analyst',   // 5 AM EST
  11: 'operator',  // 6 AM EST
  12: 'strategist' // 7 AM EST
};

/**
 * Run a specific intelligence agent via API call
 */
async function runAgent(env: Env, agent: string): Promise<AgentResult | null> {
  const startTime = Date.now();
  console.log(`[Intelligence] Starting ${agent} agent at ${new Date().toISOString()}`);

  try {
    const response = await fetch(
      `${env.API_BASE_URL}/api/intelligence/agents?agent=${agent}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.WORKER_API_KEY}`,
          'Content-Type': 'application/json',
          'X-Worker-Source': 'intelligence-scheduler'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Intelligence] ${agent} API error: ${response.status} - ${errorText}`);

      // Log failure to DB
      await logAgentRun(env, agent, 'failed', null, `API error: ${response.status}`);
      return null;
    }

    const result = await response.json() as AgentResult;
    const duration = Date.now() - startTime;

    console.log(`[Intelligence] ${agent} completed in ${duration}ms`);

    // Log success to DB
    await logAgentRun(env, agent, 'completed', result, null);

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Intelligence] ${agent} error:`, error);

    // Log failure to DB
    await logAgentRun(env, agent, 'failed', null, errorMessage);
    return null;
  }
}

/**
 * Log agent run to database
 */
async function logAgentRun(
  env: Env,
  agent: string,
  status: 'started' | 'completed' | 'failed',
  result: unknown,
  error: string | null
): Promise<void> {
  try {
    const logId = `intel_${agent}_${Date.now()}`;

    await env.DB.prepare(`
      INSERT INTO automation_jobs (id, client_id, job_type, status, input, output, error_message, created_at, updated_at, completed_at)
      VALUES (?, 'system', ?, ?, ?, ?, ?, unixepoch(), unixepoch(), ${status === 'completed' ? 'unixepoch()' : 'NULL'})
    `).bind(
      logId,
      `intelligence_${agent}`,
      status === 'completed' ? 'completed' : 'failed',
      JSON.stringify({ agent, scheduled: true }),
      result ? JSON.stringify(result) : null,
      error
    ).run();
  } catch (dbError) {
    console.error(`[Intelligence] Failed to log agent run:`, dbError);
  }
}

/**
 * Send daily brief email after Strategist completes
 */
async function sendDailyBrief(env: Env, result: AgentResult): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.log('[Intelligence] No RESEND_API_KEY, skipping daily brief email');
    return;
  }

  // Extract daily brief from strategist result
  const strategistAgent = result.agents.find(a => a.id === 'strategist');
  const dailyBrief = strategistAgent?.result?.dailyBrief;

  if (!dailyBrief) {
    console.log('[Intelligence] No daily brief data available');
    return;
  }

  // Format high value leads table
  const highValueTable = dailyBrief.highValueLeads
    .map((lead, i) =>
      `${i + 1}. ${lead.company_name} (${lead.city}, ${lead.state}) - Score: ${lead.lead_score} - POS: ${lead.current_pos || 'Unknown'}`
    )
    .join('\n');

  // Format score distribution
  const distribution = Object.entries(dailyBrief.scoreDistribution)
    .map(([tier, count]) => `  - ${tier.charAt(0).toUpperCase() + tier.slice(1)}: ${count}`)
    .join('\n');

  // Build email HTML
  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f8f9fa; padding: 20px; border: 1px solid #e9ecef; }
    .stat-box { display: inline-block; background: white; padding: 15px 25px; margin: 5px; border-radius: 8px; border: 1px solid #e9ecef; }
    .stat-number { font-size: 28px; font-weight: bold; color: #1a1a2e; }
    .stat-label { font-size: 12px; color: #6c757d; text-transform: uppercase; }
    .lead-item { background: white; padding: 10px 15px; margin: 5px 0; border-radius: 4px; border-left: 3px solid #28a745; }
    .score-hot { color: #dc3545; font-weight: bold; }
    .score-warm { color: #fd7e14; }
    .recommendation { background: #e7f3ff; padding: 10px 15px; margin: 5px 0; border-radius: 4px; border-left: 3px solid #007bff; }
    .footer { background: #1a1a2e; color: #adb5bd; padding: 15px 20px; font-size: 12px; border-radius: 0 0 8px 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">Intelligence Daily Brief</h1>
      <p style="margin: 5px 0 0; opacity: 0.8;">${dailyBrief.date} - R&G Consulting</p>
    </div>

    <div class="content">
      <h2 style="margin-top: 0;">Overview</h2>
      <div style="text-align: center;">
        <div class="stat-box">
          <div class="stat-number">${dailyBrief.newLeads}</div>
          <div class="stat-label">New Leads Today</div>
        </div>
        <div class="stat-box">
          <div class="stat-number">${dailyBrief.highValueLeads.length}</div>
          <div class="stat-label">High Value (80+)</div>
        </div>
        <div class="stat-box">
          <div class="stat-number">${strategistAgent?.result?.scoredLeads || 0}</div>
          <div class="stat-label">Leads Scored</div>
        </div>
      </div>

      <h2>Score Distribution</h2>
      <div style="background: white; padding: 15px; border-radius: 8px;">
        ${Object.entries(dailyBrief.scoreDistribution).map(([tier, count]) => {
          const colors: Record<string, string> = { hot: '#dc3545', warm: '#fd7e14', cool: '#17a2b8', cold: '#6c757d' };
          return `<div style="margin: 5px 0;"><span style="display: inline-block; width: 60px; font-weight: bold; color: ${colors[tier] || '#333'};">${tier.charAt(0).toUpperCase() + tier.slice(1)}</span> ${count} leads</div>`;
        }).join('')}
      </div>

      <h2>High Value Leads Ready for Outreach</h2>
      ${dailyBrief.highValueLeads.length > 0 ?
        dailyBrief.highValueLeads.map((lead, i) => `
          <div class="lead-item">
            <strong>${i + 1}. ${lead.company_name}</strong><br>
            <span style="color: #6c757d;">${lead.city}, ${lead.state}</span> |
            <span class="score-hot">Score: ${lead.lead_score}</span> |
            POS: ${lead.current_pos || 'Unknown'}
          </div>
        `).join('') :
        '<p style="color: #6c757d;">No high-value leads identified today.</p>'
      }

      <h2>Recommendations</h2>
      ${dailyBrief.recommendations.map(rec => `
        <div class="recommendation">${rec}</div>
      `).join('')}

      <h2>Agent Performance</h2>
      <div style="background: white; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 12px;">
        ${result.agents.map(agent => `
          <div style="margin: 5px 0;">
            <span style="color: #28a745;">&#10003;</span> ${agent.name}: ${agent.duration}ms - ${agent.result.tasks.length} tasks
          </div>
        `).join('')}
      </div>
    </div>

    <div class="footer">
      <p style="margin: 0;">This is an automated daily brief from R&G Consulting Intelligence System.</p>
      <p style="margin: 5px 0 0;">
        <a href="${env.API_BASE_URL}/admin/leads" style="color: #adb5bd;">View All Leads</a> |
        <a href="${env.API_BASE_URL}/admin/intelligence" style="color: #adb5bd;">Intelligence Dashboard</a>
      </p>
    </div>
  </div>
</body>
</html>
`;

  // Send via Resend
  try {
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'R&G Intelligence <intelligence@ccrestaurantconsulting.com>',
        to: [env.ADMIN_EMAIL],
        subject: `[Daily Brief] ${dailyBrief.date} - ${dailyBrief.highValueLeads.length} High-Value Leads`,
        html: emailHtml
      })
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error('[Intelligence] Failed to send daily brief:', errorText);
    } else {
      console.log('[Intelligence] Daily brief email sent successfully');
    }
  } catch (error) {
    console.error('[Intelligence] Error sending daily brief:', error);
  }
}

/**
 * Run gap-fill searches using Brave Search API
 */
async function runGapFillSearches(env: Env): Promise<{ searched: number; filled: number }> {
  if (!env.BRAVE_API_KEY) {
    console.log('[Intelligence] No BRAVE_API_KEY configured, skipping gap-fill');
    return { searched: 0, filled: 0 };
  }

  let searched = 0;
  let filled = 0;

  try {
    // Get leads with gaps that haven't been searched recently
    const leadsWithGaps = await env.DB.prepare(`
      SELECT id, company_name, city, state, email, phone, website, current_pos
      FROM restaurant_leads
      WHERE (email IS NULL OR phone IS NULL OR current_pos IS NULL)
        AND company_name IS NOT NULL
        AND (gap_fill_attempted_at IS NULL OR gap_fill_attempted_at < unixepoch() - 604800)
      ORDER BY lead_score DESC NULLS LAST
      LIMIT 20
    `).all();

    for (const lead of leadsWithGaps.results || []) {
      const gaps: string[] = [];
      if (!lead.email) gaps.push('email');
      if (!lead.phone) gaps.push('phone');
      if (!lead.current_pos) gaps.push('pos');

      for (const gapType of gaps) {
        if (searched >= 50) break; // Rate limit

        let query = '';
        switch (gapType) {
          case 'email':
            query = `"${lead.company_name}" ${lead.city || ''} contact email`;
            break;
          case 'phone':
            query = `"${lead.company_name}" ${lead.city || ''} phone number`;
            break;
          case 'pos':
            query = `"${lead.company_name}" point of sale system OR "powered by" restaurant`;
            break;
        }

        try {
          const searchResponse = await fetch(
            `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
            {
              headers: {
                'X-Subscription-Token': env.BRAVE_API_KEY
              }
            }
          );

          searched++;

          if (searchResponse.ok) {
            const searchData = await searchResponse.json() as {
              web?: {
                results?: Array<{
                  title: string;
                  url: string;
                  description: string;
                }>;
              };
            };

            // Extract data from search results
            const results = searchData.web?.results || [];
            const extractedValue = extractFromSearchResults(results, gapType, lead.company_name as string);

            if (extractedValue) {
              // Update the lead with found data
              const updateField = gapType === 'pos' ? 'current_pos' : gapType;
              await env.DB.prepare(`
                UPDATE restaurant_leads
                SET ${updateField} = ?, gap_fill_attempted_at = unixepoch(), updated_at = unixepoch()
                WHERE id = ?
              `).bind(extractedValue, lead.id).run();

              filled++;
              console.log(`[GapFill] Found ${gapType} for ${lead.company_name}: ${extractedValue}`);
            }
          }

          // Rate limiting - wait 200ms between requests
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (searchError) {
          console.error(`[GapFill] Search error for ${lead.company_name}:`, searchError);
        }
      }

      // Mark that we attempted gap fill
      await env.DB.prepare(`
        UPDATE restaurant_leads
        SET gap_fill_attempted_at = unixepoch()
        WHERE id = ?
      `).bind(lead.id).run();
    }
  } catch (error) {
    console.error('[GapFill] Error:', error);
  }

  console.log(`[GapFill] Completed: ${searched} searches, ${filled} gaps filled`);
  return { searched, filled };
}

/**
 * Extract relevant data from search results based on gap type
 */
function extractFromSearchResults(
  results: Array<{ title: string; url: string; description: string }>,
  gapType: string,
  companyName: string
): string | null {
  const combinedText = results.map(r => `${r.title} ${r.description}`).join(' ');

  switch (gapType) {
    case 'email': {
      // Look for email patterns
      const emailMatch = combinedText.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) {
        const email = emailMatch[0].toLowerCase();
        // Filter out common non-contact emails
        if (!email.includes('noreply') && !email.includes('support@') && !email.includes('info@google')) {
          return email;
        }
      }
      break;
    }
    case 'phone': {
      // Look for phone patterns
      const phoneMatch = combinedText.match(/(?:\+1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/);
      if (phoneMatch) {
        return phoneMatch[0].replace(/[^\d]/g, '').slice(-10);
      }
      break;
    }
    case 'pos': {
      // Look for POS system mentions
      const posPatterns = [
        { pattern: /toast|toasttab/i, value: 'Toast' },
        { pattern: /square.*pos|powered by square/i, value: 'Square' },
        { pattern: /clover/i, value: 'Clover' },
        { pattern: /aloha/i, value: 'Aloha' },
        { pattern: /micros/i, value: 'MICROS' },
        { pattern: /revel/i, value: 'Revel' },
        { pattern: /lightspeed/i, value: 'Lightspeed' },
        { pattern: /touchbistro/i, value: 'TouchBistro' },
        { pattern: /upserve/i, value: 'Upserve' },
        { pattern: /harbortouch/i, value: 'Harbortouch' }
      ];

      for (const { pattern, value } of posPatterns) {
        if (pattern.test(combinedText)) {
          return value;
        }
      }
      break;
    }
  }

  return null;
}

/**
 * Main scheduled event handler
 */
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const scheduledDate = new Date(event.scheduledTime);
    const utcHour = scheduledDate.getUTCHours();

    console.log(`[Intelligence] Cron triggered at ${scheduledDate.toISOString()}, UTC hour: ${utcHour}`);

    const agent = AGENT_SCHEDULE[utcHour];

    if (!agent) {
      console.log(`[Intelligence] No agent scheduled for UTC hour ${utcHour}`);
      return;
    }

    console.log(`[Intelligence] Running ${agent} agent`);

    // Run the agent
    const result = await runAgent(env, agent);

    if (result) {
      // If this was the strategist, send daily brief and run gap-fill
      if (agent === 'strategist') {
        ctx.waitUntil(sendDailyBrief(env, result));
        ctx.waitUntil(runGapFillSearches(env));
      }
    }
  },

  // HTTP handler for manual triggers and testing
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'healthy',
        worker: 'rg-intelligence-scheduler',
        timestamp: new Date().toISOString(),
        schedule: AGENT_SCHEDULE
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Manual trigger (requires auth)
    if (url.pathname === '/trigger') {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.slice(7) !== env.WORKER_API_KEY) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const agent = url.searchParams.get('agent') || 'all';

      if (agent === 'all') {
        // Run all agents in sequence
        const results: AgentResult[] = [];
        for (const agentName of ['hunter', 'analyst', 'operator', 'strategist']) {
          const result = await runAgent(env, agentName);
          if (result) results.push(result);
        }

        // Send daily brief after all complete
        if (results.length > 0) {
          const lastResult = results[results.length - 1];
          ctx.waitUntil(sendDailyBrief(env, lastResult));
          ctx.waitUntil(runGapFillSearches(env));
        }

        return new Response(JSON.stringify({
          success: true,
          agents_run: results.length,
          results
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        const result = await runAgent(env, agent);

        if (agent === 'strategist' && result) {
          ctx.waitUntil(sendDailyBrief(env, result));
          ctx.waitUntil(runGapFillSearches(env));
        }

        return new Response(JSON.stringify({
          success: !!result,
          result
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Gap-fill trigger
    if (url.pathname === '/gap-fill') {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.slice(7) !== env.WORKER_API_KEY) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const gapFillResult = await runGapFillSearches(env);
      return new Response(JSON.stringify({
        success: true,
        ...gapFillResult
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      error: 'Not found',
      available_endpoints: ['/health', '/trigger?agent=hunter|analyst|operator|strategist|all', '/gap-fill']
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
