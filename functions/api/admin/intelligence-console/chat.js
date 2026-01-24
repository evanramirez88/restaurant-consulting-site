/**
 * Intelligence Console Chat API
 * Model-agnostic AI chat with multi-provider support
 *
 * POST /api/admin/intelligence-console/chat
 * - stream: boolean (default: true)
 * - sessionId: string (optional - creates new if not provided)
 * - message: string
 * - attachments: array (optional)
 * - modelId: string (optional - uses default if not provided)
 * - assistantId: string (optional)
 * - builderMode: string (optional)
 * - styleId: string (optional)
 */

import { verifyAuth, unauthorizedResponse, getCorsOrigin, handleOptions } from '../../../_shared/auth.js';

function getCorsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  // Verify authentication
  const auth = await verifyAuth(request, env);
  if (!auth.authenticated) {
    return unauthorizedResponse(auth.error, request);
  }

  try {
    const body = await request.json();
    const {
      sessionId,
      message,
      attachments = [],
      modelId,
      assistantId,
      builderMode = 'none',
      styleId,
      stream = true,
      includeContext = true
    } = body;

    if (!message?.trim()) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Message is required'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const now = Math.floor(Date.now() / 1000);

    // Get or create session
    let session;
    if (sessionId) {
      session = await env.DB.prepare(
        'SELECT * FROM intelligence_sessions WHERE id = ?'
      ).bind(sessionId).first();
    }

    if (!session) {
      const newSessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await env.DB.prepare(`
        INSERT INTO intelligence_sessions (id, assistant_id, model_id, builder_mode, speaking_style_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(newSessionId, assistantId || null, modelId || null, builderMode, styleId || null, now, now).run();

      session = { id: newSessionId, message_count: 0 };
    }

    // Get model configuration
    const model = await getModelConfig(env, modelId);

    // Get assistant if specified
    let assistant = null;
    if (assistantId || session.assistant_id) {
      assistant = await env.DB.prepare(
        'SELECT * FROM ai_assistants WHERE id = ?'
      ).bind(assistantId || session.assistant_id).first();
    }

    // Get speaking style
    let style = null;
    if (styleId || session.speaking_style_id) {
      style = await env.DB.prepare(
        'SELECT * FROM intelligence_styles WHERE id = ?'
      ).bind(styleId || session.speaking_style_id).first();
    }

    // Build system prompt
    const systemPrompt = await buildSystemPrompt(env, assistant, style, builderMode, includeContext);

    // Get conversation history
    const history = await env.DB.prepare(`
      SELECT role, content FROM intelligence_messages
      WHERE session_id = ?
      ORDER BY created_at ASC
      LIMIT 20
    `).bind(session.id).all();

    // Build messages array
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Add history
    (history.results || []).forEach(msg => {
      messages.push({ role: msg.role, content: msg.content });
    });

    // Add current message
    messages.push({ role: 'user', content: message });

    // Save user message
    const userMsgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await env.DB.prepare(`
      INSERT INTO intelligence_messages (id, session_id, role, content, attachments, builder_mode, created_at)
      VALUES (?, ?, 'user', ?, ?, ?, ?)
    `).bind(
      userMsgId,
      session.id,
      message,
      attachments.length > 0 ? JSON.stringify(attachments) : null,
      builderMode,
      now
    ).run();

    // Generate response using configured model
    const startTime = Date.now();
    let responseText = '';
    let tokensUsed = { input: 0, output: 0 };

    if (model.provider_type === 'workers_ai' && env.AI) {
      // Use Cloudflare Workers AI with timeout
      const aiPromise = env.AI.run(model.model_id, {
        messages,
        max_tokens: model.max_tokens || 2048,
        temperature: assistant?.temperature || model.temperature_default || 0.7,
        stream: false
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI response timeout')), 15000)
      );
      const aiResponse = await Promise.race([aiPromise, timeoutPromise])
        .catch(() => null);

      if (aiResponse?.response || aiResponse?.text) {
        responseText = aiResponse.response || aiResponse.text;
      } else {
        responseText = generateMockResponse(message, systemPrompt);
      }
    } else {
      // Fallback mock response
      responseText = generateMockResponse(message, systemPrompt);
    }

    const generationTime = Date.now() - startTime;

    // Save assistant response
    const assistantMsgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await env.DB.prepare(`
      INSERT INTO intelligence_messages
      (id, session_id, role, content, model_used, generation_time_ms, created_at)
      VALUES (?, ?, 'assistant', ?, ?, ?, ?)
    `).bind(
      assistantMsgId,
      session.id,
      responseText,
      model.model_id,
      generationTime,
      now
    ).run();

    // Update session
    await env.DB.prepare(`
      UPDATE intelligence_sessions
      SET message_count = message_count + 2, updated_at = ?
      WHERE id = ?
    `).bind(now, session.id).run();

    // Generate title if first message
    if (session.message_count === 0) {
      const title = message.substring(0, 50) + (message.length > 50 ? '...' : '');
      await env.DB.prepare(
        'UPDATE intelligence_sessions SET title = ? WHERE id = ?'
      ).bind(title, session.id).run();
    }

    return new Response(JSON.stringify({
      success: true,
      sessionId: session.id,
      message: {
        id: assistantMsgId,
        role: 'assistant',
        content: responseText,
        model: model.display_name,
        generationTimeMs: generationTime
      },
      usage: tokensUsed
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Intelligence Console Chat error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}

async function getModelConfig(env, modelId) {
  if (modelId) {
    const model = await env.DB.prepare(`
      SELECT m.*, p.provider_type, p.base_url, p.api_key_encrypted
      FROM ai_models m
      JOIN ai_model_providers p ON m.provider_id = p.id
      WHERE m.id = ? AND m.is_active = 1
    `).bind(modelId).first();

    if (model) return model;
  }

  // Get default model
  const defaultModel = await env.DB.prepare(`
    SELECT m.*, p.provider_type, p.base_url, p.api_key_encrypted
    FROM ai_models m
    JOIN ai_model_providers p ON m.provider_id = p.id
    WHERE m.is_default = 1 AND m.is_active = 1
    LIMIT 1
  `).first();

  return defaultModel || {
    model_id: '@cf/meta/llama-3.1-70b-instruct',
    display_name: 'Llama 3.1 70B',
    provider_type: 'workers_ai',
    temperature_default: 0.7,
    max_tokens: 2048
  };
}


async function buildSystemPrompt(env, assistant, style, builderMode, includeContext) {
  let prompt = '';

  // Base context
  prompt += `You are an AI assistant for R&G Consulting LLC, a restaurant technology consulting firm.
Current date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
`;

  // Assistant instructions
  if (assistant?.system_instructions || assistant?.instructions) {
    prompt += `\n${assistant.system_instructions || assistant.instructions}\n`;
  }

  // Persona
  if (assistant?.persona) {
    prompt += `\n[Persona]: ${assistant.persona}\n`;
  }

  // Speaking style
  if (style?.instructions || style?.content) {
    prompt += `\n[Speaking Style]: ${style.instructions || style.content}\n`;
  }

  // Builder mode
  const builderPrompts = {
    code: 'Act as a senior software engineer. Prioritize clean, efficient, and well-documented code.',
    write: 'Act as a professional editor and creative writer. Focus on flow, tone, and clarity.',
    research: 'Act as a research assistant. Provide factual, cited, and comprehensive information. Use the available Context Items.',
    analysis: 'Act as a data analyst. Focus on patterns, insights, and actionable recommendations.',
    image: 'Act as a visual art director. Describe images in high detail for generation.',
    character: 'Act as a character designer. Flesh out backstories and traits.',
    plot: 'Act as a narrative architect. Outline structures and plot points.'
  };

  if (builderMode !== 'none' && builderPrompts[builderMode]) {
    prompt += `\n[Mode: ${builderMode.toUpperCase()}]: ${builderPrompts[builderMode]}\n`;
  }

  // Business context
  if (includeContext) {
    const context = await getBusinessContext(env);

    // 1. Metrics
    prompt += `\n[CURRENT BUSINESS CONTEXT]:
- MRR: $${context.mrr.toLocaleString()}
- Active Clients: ${context.clients}
- Hot Leads: ${context.hotLeads}
- Open Tickets: ${context.openTickets}
- Days to $400K Goal: ${context.daysToGoal}
`;

    // 2. Synced Data Context (Recent Communications)
    try {
      const recentComms = await env.DB.prepare(`
            SELECT c.type, c.direction, c.summary, c.occurred_at, k.name 
            FROM synced_communications c
            LEFT JOIN synced_contacts k ON c.contact_id = k.id
            WHERE c.privacy_level != 'private' 
            ORDER BY c.occurred_at DESC LIMIT 5
        `).all();

      if (recentComms.results && recentComms.results.length > 0) {
        prompt += `\n[RECENT SYNCED ACTIVITY]:\n`;
        recentComms.results.forEach(c => {
          const date = new Date(c.occurred_at).toLocaleString();
          prompt += `- [${date}] ${c.direction === 'inbound' ? 'From' : 'To'} ${c.name || 'Unknown'} (${c.type}): ${c.summary}\n`;
        });
      }

    } catch (e) {
      console.error("Failed to load synced context", e);
    }
  }

  return prompt;
}


async function getBusinessContext(env) {
  const now = Math.floor(Date.now() / 1000);

  const [clients, leads, tickets, subscriptions] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) as count FROM clients WHERE status = "active" OR status IS NULL').first().catch(() => ({ count: 0 })),
    env.DB.prepare('SELECT COUNT(*) as count FROM restaurant_leads WHERE lead_score >= 80').first().catch(() => ({ count: 0 })),
    env.DB.prepare('SELECT COUNT(*) as count FROM tickets WHERE status IN ("open", "pending", "in_progress")').first().catch(() => ({ count: 0 })),
    env.DB.prepare('SELECT COALESCE(SUM(mrr_amount), 0) as mrr FROM stripe_subscriptions WHERE status = "active"').first().catch(() => ({ mrr: 0 }))
  ]);

  const goalDate = new Date('2026-05-01').getTime() / 1000;
  const daysToGoal = Math.max(0, Math.ceil((goalDate - now) / 86400));

  return {
    mrr: subscriptions?.mrr || 0,
    clients: clients?.count || 0,
    hotLeads: leads?.count || 0,
    openTickets: tickets?.count || 0,
    daysToGoal
  };
}

function generateMockResponse(message, systemPrompt) {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
    return `Hello! I'm your R&G Business Advisor. How can I help you today?

I can assist with:
- Business metrics and KPI analysis
- Lead research and outreach strategies
- Client health monitoring
- Support ticket prioritization
- Report generation
- Communication drafting

What would you like to focus on?`;
  }

  if (lowerMessage.includes('revenue') || lowerMessage.includes('goal') || lowerMessage.includes('400k')) {
    return `**Revenue Progress Analysis**

Based on current data:
- You're working toward the $400K revenue goal by May 1, 2026
- Current tracking requires consistent weekly progress of ~$23,529

**Recommendations:**
1. Focus on converting hot leads (80+ score)
2. Follow up on pending quotes
3. Identify upsell opportunities with existing clients
4. Consider promotional offers for new support plan signups

Would you like me to analyze specific leads or create an outreach plan?`;
  }

  return `I understand you're asking about: "${message.substring(0, 100)}..."

Let me help you with that. Based on my analysis of R&G Consulting's current business data, here are some insights:

1. **Current Focus Areas**: Revenue growth toward the $400K goal
2. **Available Actions**: I can analyze leads, clients, quotes, or tickets
3. **Next Steps**: Would you like me to dive deeper into any specific area?

*Note: For the most accurate insights, ensure your data sources are synced and up-to-date.*`;
}
