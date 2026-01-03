/**
 * Admin API Configs - List and Update
 *
 * GET /api/admin/api-configs - List all API configurations
 * POST /api/admin/api-configs - Create/update API configuration
 */

import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    // Verify authentication
    const auth = await verifyAuth(context.request, context.env);
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    const db = context.env.DB;

    // Ensure table exists
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS api_configs (
        id TEXT PRIMARY KEY,
        service TEXT NOT NULL UNIQUE,
        provider TEXT NOT NULL,
        display_name TEXT,
        config_json TEXT,
        is_active INTEGER DEFAULT 1,
        fallback_provider TEXT,
        rate_limit_per_hour INTEGER,
        notes TEXT,
        updated_at INTEGER DEFAULT (unixepoch())
      )
    `).run();

    // Seed default AI configs if they don't exist
    const defaultAIConfigs = [
      {
        id: 'ai_menu_ocr',
        service: 'menu_ocr',
        provider: 'cloudflare_ai',
        display_name: 'Menu Builder OCR',
        config_json: JSON.stringify({
          model: '@cf/llava-hf/llava-1.5-7b-hf',
          max_tokens: 2048,
          prompt: 'Extract all text from this menu image. List each menu item with its name, description, and price. Format: "Item Name - Description... $Price"'
        })
      },
      {
        id: 'ai_quote_ocr',
        service: 'quote_ocr',
        provider: 'cloudflare_ai',
        display_name: 'Quote Builder PDF OCR',
        config_json: JSON.stringify({
          model: '@cf/meta/llama-3.2-11b-vision-instruct',
          max_tokens: 2048,
          prompt: 'Extract hardware items from this Toast POS quote PDF. Focus on the HARDWARE section table. For each item, extract: Product Name, Quantity (QTY column). Return as JSON array: [{"name": "...", "qty": 1}, ...]'
        })
      }
    ];

    for (const config of defaultAIConfigs) {
      await db.prepare(`
        INSERT OR IGNORE INTO api_configs (id, service, provider, display_name, config_json, is_active, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, unixepoch())
      `).bind(
        config.id,
        config.service,
        config.provider,
        config.display_name,
        config.config_json
      ).run();
    }

    const { results } = await db.prepare(`
      SELECT * FROM api_configs
      ORDER BY service ASC
    `).all();

    return new Response(JSON.stringify({
      success: true,
      data: results || []
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('API Configs GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
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
    const now = Math.floor(Date.now() / 1000);

    // Validate required fields
    if (!body.service || !body.provider) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Service and provider are required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Upsert API config
    await db.prepare(`
      INSERT INTO api_configs (
        id, service, provider, display_name, config_json, is_active,
        fallback_provider, rate_limit_per_hour, notes, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(service) DO UPDATE SET
        provider = excluded.provider,
        display_name = excluded.display_name,
        config_json = excluded.config_json,
        is_active = excluded.is_active,
        fallback_provider = excluded.fallback_provider,
        rate_limit_per_hour = excluded.rate_limit_per_hour,
        notes = excluded.notes,
        updated_at = excluded.updated_at
    `).bind(
      body.id || `api_${body.service}`,
      body.service,
      body.provider,
      body.display_name || null,
      body.config_json || null,
      body.is_active !== false ? 1 : 0,
      body.fallback_provider || null,
      body.rate_limit_per_hour || null,
      body.notes || null,
      now
    ).run();

    const config = await db.prepare('SELECT * FROM api_configs WHERE service = ?').bind(body.service).first();

    return new Response(JSON.stringify({
      success: true,
      data: config
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('API Configs POST error:', error);
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
