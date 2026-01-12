/**
 * AI Text Extraction API
 *
 * POST /api/admin/intelligence/extract - Extract facts from text
 *
 * This endpoint uses AI to analyze text and extract structured facts
 * about a client. It supports multiple AI providers.
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { text, client_id, provider_id } = body;

    if (!text || !client_id) {
      return Response.json({
        success: false,
        error: 'text and client_id are required',
      }, { status: 400 });
    }

    // Get client info
    const client = await env.DB.prepare(
      'SELECT id, name, company FROM clients WHERE id = ?'
    ).bind(client_id).first();

    if (!client) {
      return Response.json({
        success: false,
        error: 'Client not found',
      }, { status: 404 });
    }

    // Get AI provider
    let provider;
    if (provider_id) {
      provider = await env.DB.prepare(
        'SELECT * FROM ai_providers WHERE id = ? AND is_active = 1'
      ).bind(provider_id).first();
    } else {
      provider = await env.DB.prepare(
        'SELECT * FROM ai_providers WHERE is_default = 1 AND is_active = 1'
      ).first();
    }

    // Extract facts using AI (or simulated extraction)
    let extractedFacts;
    const startTime = Date.now();

    if (provider && env.AI) {
      // Try using Cloudflare AI for extraction
      try {
        extractedFacts = await extractWithCloudflareAI(env.AI, text, client);
      } catch (aiError) {
        console.error('AI extraction failed, falling back to simulation:', aiError);
        extractedFacts = simulateExtraction(text, client);
      }
    } else {
      // Fallback to simulated extraction
      extractedFacts = simulateExtraction(text, client);
    }

    const duration = Date.now() - startTime;

    // Log AI usage
    if (provider) {
      const logId = 'ailog_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
      await env.DB.prepare(`
        INSERT INTO ai_usage_logs (
          id, provider_id, task_type, input_tokens, duration_ms,
          client_id, success, input_preview
        ) VALUES (?, ?, 'extraction', ?, ?, ?, 1, ?)
      `).bind(
        logId, provider.id, Math.ceil(text.length / 4), duration,
        client_id, text.substring(0, 500)
      ).run();
    }

    return Response.json({
      success: true,
      facts: extractedFacts,
      provider_used: provider?.name || 'Simulated',
      duration_ms: duration,
    });
  } catch (error) {
    console.error('Extract error:', error);
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

// Cloudflare AI extraction (uses Workers AI)
async function extractWithCloudflareAI(ai, text, client) {
  const prompt = `You are analyzing text about a restaurant called "${client.company || client.name}".
Extract any factual information you can find about this restaurant.

For each fact, provide:
- field: the type of information (e.g., "cuisine_type", "seating_capacity", "pos_system", "website", "phone", "address")
- value: the extracted value
- confidence: your confidence (0.0 to 1.0)
- originalText: the relevant quote from the text

TEXT TO ANALYZE:
${text}

Return a JSON array of facts. Example format:
[{"field": "cuisine_type", "value": "Italian", "confidence": 0.9, "originalText": "specializing in Italian cuisine"}]

Only return the JSON array, no other text.`;

  const response = await ai.run('@cf/meta/llama-2-7b-chat-int8', {
    prompt,
    max_tokens: 1000,
  });

  try {
    // Try to parse the response as JSON
    const jsonMatch = response.response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (parseError) {
    console.error('Failed to parse AI response:', parseError);
  }

  // Return simulated if parsing fails
  return simulateExtraction(text, client);
}

// Simulated extraction using pattern matching
function simulateExtraction(text, client) {
  const facts = [];
  const lowerText = text.toLowerCase();

  // Cuisine type detection
  const cuisines = ['italian', 'mexican', 'chinese', 'japanese', 'american', 'french', 'thai', 'indian', 'seafood', 'steakhouse'];
  for (const cuisine of cuisines) {
    if (lowerText.includes(cuisine)) {
      const idx = lowerText.indexOf(cuisine);
      facts.push({
        field: 'cuisine_type',
        value: cuisine.charAt(0).toUpperCase() + cuisine.slice(1),
        confidence: 0.75,
        originalText: text.substring(Math.max(0, idx - 20), Math.min(text.length, idx + cuisine.length + 20)).trim(),
      });
      break;
    }
  }

  // POS system detection
  const posSystems = ['toast', 'square', 'clover', 'lightspeed', 'aloha', 'micros', 'upserve'];
  for (const pos of posSystems) {
    if (lowerText.includes(pos)) {
      const idx = lowerText.indexOf(pos);
      facts.push({
        field: 'pos_system',
        value: pos.charAt(0).toUpperCase() + pos.slice(1),
        confidence: 0.85,
        originalText: text.substring(Math.max(0, idx - 20), Math.min(text.length, idx + pos.length + 20)).trim(),
      });
      break;
    }
  }

  // Phone number detection
  const phoneMatch = text.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (phoneMatch) {
    facts.push({
      field: 'phone',
      value: phoneMatch[0],
      confidence: 0.9,
      originalText: phoneMatch[0],
    });
  }

  // Email detection
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    facts.push({
      field: 'email',
      value: emailMatch[0],
      confidence: 0.95,
      originalText: emailMatch[0],
    });
  }

  // Website detection
  const websiteMatch = text.match(/https?:\/\/[^\s]+|www\.[^\s]+/i);
  if (websiteMatch) {
    facts.push({
      field: 'website',
      value: websiteMatch[0],
      confidence: 0.9,
      originalText: websiteMatch[0],
    });
  }

  // Seating capacity detection
  const seatingMatch = text.match(/(\d+)\s*(seats?|covers|capacity|seating)/i);
  if (seatingMatch) {
    facts.push({
      field: 'seating_capacity',
      value: seatingMatch[1],
      confidence: 0.7,
      originalText: seatingMatch[0],
    });
  }

  // Employee count detection
  const employeeMatch = text.match(/(\d+)\s*(employees?|staff|team members?)/i);
  if (employeeMatch) {
    facts.push({
      field: 'employee_count',
      value: employeeMatch[1],
      confidence: 0.7,
      originalText: employeeMatch[0],
    });
  }

  return facts;
}
