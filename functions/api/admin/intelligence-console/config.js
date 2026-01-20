/**
 * Intelligence Console Configuration API
 *
 * GET /api/admin/intelligence-console/config - Get full config (models, assistants, styles, folders)
 * GET /api/admin/intelligence-console/config/models - List available models
 * GET /api/admin/intelligence-console/config/assistants - List assistants
 * GET /api/admin/intelligence-console/config/styles - List speaking styles
 * POST /api/admin/intelligence-console/config/providers - Add/update model provider
 * POST /api/admin/intelligence-console/config/assistants - Create/update assistant
 */

import { verifyAuth, unauthorizedResponse, handleOptions } from '../../../_shared/auth.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestGet(context) {
  const { request, env } = context;

  const auth = await verifyAuth(request, env);
  if (!auth.authenticated) {
    return unauthorizedResponse(auth.error, request);
  }

  try {
    const url = new URL(request.url);
    const section = url.searchParams.get('section'); // 'models', 'assistants', 'styles', 'folders', 'providers', 'sources'

    // Get all configuration data
    const [providers, models, assistants, styles, folders, dataSources] = await Promise.all([
      // Model providers
      env.DB.prepare(`
        SELECT id, name, provider_type, base_url, is_active, is_default,
               supports_streaming, supports_vision, supports_function_calling
        FROM ai_model_providers
        ORDER BY is_default DESC, name ASC
      `).all().catch(() => ({ results: [] })),

      // Available models
      env.DB.prepare(`
        SELECT m.*, p.name as provider_name, p.provider_type
        FROM ai_models m
        JOIN ai_model_providers p ON m.provider_id = p.id
        WHERE m.is_active = 1
        ORDER BY m.is_default DESC, m.category, m.display_name
      `).all().catch(() => ({ results: [] })),

      // Assistants
      env.DB.prepare(`
        SELECT * FROM ai_assistants
        ORDER BY is_system DESC, name ASC
      `).all().catch(() => ({ results: [] })),

      // Speaking styles
      env.DB.prepare(`
        SELECT * FROM intelligence_styles
        ORDER BY is_system DESC, name ASC
      `).all().catch(() => ({ results: [] })),

      // Folders
      env.DB.prepare(`
        SELECT * FROM intelligence_folders
        ORDER BY sort_order, name
      `).all().catch(() => ({ results: [] })),

      // Data sources
      env.DB.prepare(`
        SELECT id, name, source_type, tier, sync_enabled, last_sync_at, last_sync_status
        FROM context_data_sources
        ORDER BY tier, name
      `).all().catch(() => ({ results: [] }))
    ]);

    // Builder modes (business-focused only)
    const builderModes = [
      { id: 'none', name: 'Default', description: 'Standard conversation mode', icon: 'MessageCircle' },
      { id: 'code', name: 'Code', description: 'Software development assistance', icon: 'Code' },
      { id: 'write', name: 'Write', description: 'Professional writing and editing', icon: 'PenTool' },
      { id: 'research', name: 'Research', description: 'Factual research and analysis', icon: 'Search' },
      { id: 'analysis', name: 'Analysis', description: 'Data analysis and insights', icon: 'BarChart' }
    ];

    // Filter by section if specified
    if (section) {
      const sectionMap = {
        providers: { providers: providers.results || [] },
        models: { models: models.results || [] },
        assistants: { assistants: assistants.results || [] },
        styles: { styles: styles.results || [] },
        folders: { folders: folders.results || [] },
        sources: { dataSources: dataSources.results || [] },
        modes: { builderModes }
      };

      return new Response(JSON.stringify({
        success: true,
        ...sectionMap[section]
      }), { headers: corsHeaders });
    }

    // Return full config
    return new Response(JSON.stringify({
      success: true,
      config: {
        providers: providers.results || [],
        models: models.results || [],
        assistants: assistants.results || [],
        styles: styles.results || [],
        folders: folders.results || [],
        dataSources: dataSources.results || [],
        builderModes,
        defaultModel: (models.results || []).find(m => m.is_default) || null,
        workersAIAvailable: !!env.AI
      }
    }), { headers: corsHeaders });

  } catch (error) {
    console.error('Config GET error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: corsHeaders });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const auth = await verifyAuth(request, env);
  if (!auth.authenticated) {
    return unauthorizedResponse(auth.error, request);
  }

  try {
    const url = new URL(request.url);
    const body = await request.json();
    const { type } = body; // 'provider', 'model', 'assistant', 'style', 'folder'

    const now = Math.floor(Date.now() / 1000);

    switch (type) {
      case 'provider': {
        const { id, name, providerType, baseUrl, apiKey, isActive, isDefault } = body;
        const providerId = id || `provider_${Date.now()}`;

        if (id) {
          // Update existing
          await env.DB.prepare(`
            UPDATE ai_model_providers SET
              name = ?, provider_type = ?, base_url = ?,
              api_key_encrypted = COALESCE(?, api_key_encrypted),
              is_active = ?, is_default = ?, updated_at = ?
            WHERE id = ?
          `).bind(name, providerType, baseUrl || null, apiKey || null, isActive ? 1 : 0, isDefault ? 1 : 0, now, id).run();
        } else {
          // Create new
          await env.DB.prepare(`
            INSERT INTO ai_model_providers (id, name, provider_type, base_url, api_key_encrypted, is_active, is_default, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(providerId, name, providerType, baseUrl || null, apiKey || null, isActive ? 1 : 0, isDefault ? 1 : 0, now).run();
        }

        return new Response(JSON.stringify({ success: true, id: providerId }), { headers: corsHeaders });
      }

      case 'assistant': {
        const {
          id, name, description, systemInstructions, persona, modelId,
          temperature, includeBusinessContext, includeLeadsContext,
          includeClientsContext, includeTicketsContext, speakingStyleId
        } = body;

        const assistantId = id || `asst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        if (id) {
          // Update existing (only non-system assistants)
          await env.DB.prepare(`
            UPDATE ai_assistants SET
              name = ?, description = ?, system_instructions = ?, persona = ?,
              model_id = ?, temperature = ?, include_business_context = ?,
              include_leads_context = ?, include_clients_context = ?,
              include_tickets_context = ?, speaking_style_id = ?, updated_at = ?
            WHERE id = ? AND is_system = 0
          `).bind(
            name, description || null, systemInstructions, persona || null,
            modelId || null, temperature || 0.7, includeBusinessContext ? 1 : 0,
            includeLeadsContext ? 1 : 0, includeClientsContext ? 1 : 0,
            includeTicketsContext ? 1 : 0, speakingStyleId || null, now, id
          ).run();
        } else {
          // Create new
          await env.DB.prepare(`
            INSERT INTO ai_assistants
            (id, name, description, system_instructions, persona, model_id, temperature,
             include_business_context, include_leads_context, include_clients_context,
             include_tickets_context, speaking_style_id, is_system, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
          `).bind(
            assistantId, name, description || null, systemInstructions, persona || null,
            modelId || null, temperature || 0.7, includeBusinessContext ? 1 : 0,
            includeLeadsContext ? 1 : 0, includeClientsContext ? 1 : 0,
            includeTicketsContext ? 1 : 0, speakingStyleId || null, now, now
          ).run();
        }

        return new Response(JSON.stringify({ success: true, id: assistantId }), { headers: corsHeaders });
      }

      case 'style': {
        const { id, name, description, instructions, category } = body;
        const styleId = id || `style_${Date.now()}`;

        if (id) {
          await env.DB.prepare(`
            UPDATE intelligence_styles SET
              name = ?, description = ?, instructions = ?, category = ?
            WHERE id = ? AND is_system = 0
          `).bind(name, description || null, instructions, category || 'general', id).run();
        } else {
          await env.DB.prepare(`
            INSERT INTO intelligence_styles (id, name, description, instructions, category, is_system, created_at)
            VALUES (?, ?, ?, ?, ?, 0, ?)
          `).bind(styleId, name, description || null, instructions, category || 'general', now).run();
        }

        return new Response(JSON.stringify({ success: true, id: styleId }), { headers: corsHeaders });
      }

      case 'folder': {
        const { id, name, description, icon, color, parentId } = body;
        const folderId = id || `folder_${Date.now()}`;

        if (id) {
          await env.DB.prepare(`
            UPDATE intelligence_folders SET
              name = ?, description = ?, icon = ?, color = ?, parent_id = ?
            WHERE id = ?
          `).bind(name, description || null, icon || null, color || null, parentId || null, id).run();
        } else {
          await env.DB.prepare(`
            INSERT INTO intelligence_folders (id, name, description, icon, color, parent_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind(folderId, name, description || null, icon || null, color || null, parentId || null, now).run();
        }

        return new Response(JSON.stringify({ success: true, id: folderId }), { headers: corsHeaders });
      }

      default:
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid type. Use: provider, model, assistant, style, folder'
        }), { status: 400, headers: corsHeaders });
    }

  } catch (error) {
    console.error('Config POST error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: corsHeaders });
  }
}
