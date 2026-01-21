
import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../_shared/auth.js';

/**
 * Handle POST request to sync data from Data Context Engine
 * Endpoint: /api/context/sync
 */
export async function onRequestPost(context) {
    const { request, env } = context;

    // 1. CORS Pre-flight
    if (request.method === 'OPTIONS') {
        return handleOptions(request);
    }

    // 2. Auth Check (API Key or Admin Token)
    // We accept a specific SYNC_API_KEY for the python engine, or standard admin auth
    const authHeader = request.headers.get('Authorization');
    const url = new URL(request.url);
    const apiKey = request.headers.get('X-Sync-Key');

    // Verify: Either standard admin auth OR specific sync key
    let authorized = false;

    // Method A: Standard Admin Auth
    try {
        const user = await verifyAuth(request, env);
        if (user) authorized = true;
    } catch (e) { }

    // Method B: Dedicated Sync Key (for headless python script)
    // In production, this should be in env vars. For now we use the Admin Hash or a dedicated var.
    if (!authorized && apiKey && apiKey === env.ADMIN_PASSWORD_HASH) { // Reusing hash for simplicity initially
        authorized = true;
    }

    if (!authorized) {
        return unauthorizedResponse();
    }

    try {
        const data = await request.json();
        const { batch_id, source, items } = data; // items = [{ type: 'sms', ... }, { type: 'contact', ... }]

        if (!items || !Array.isArray(items)) {
            return new Response(JSON.stringify({ error: 'Invalid payload: items array required' }), {
                status: 400, headers: corsHeaders
            });
        }

        const results = {
            processed: 0,
            errors: 0,
            details: []
        };

        // 3. Process Batch
        // We use a transaction for the batch
        // D1 doesn't support massive transactions well, so we iterate

        for (const item of items) {
            try {
                if (item.entity_type === 'contact') {
                    // Upsert Contact
                    await env.DB.prepare(`
                    INSERT INTO synced_contacts (id, external_id, name, phone, email, company, source, last_interaction_at, privacy_level)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        name=excluded.name,
                        phone=excluded.phone,
                        email=excluded.email,
                        last_interaction_at=excluded.last_interaction_at,
                        privacy_level=excluded.privacy_level,
                        updated_at=unixepoch()
                `).bind(
                        item.id, item.external_id, item.name, item.phone, item.email, item.company, source || 'api', item.last_interaction_at, item.privacy_level || 'private'
                    ).run();

                } else if (['sms', 'call', 'email', 'meeting'].includes(item.entity_type)) {
                    // Insert Communication
                    await env.DB.prepare(`
                    INSERT INTO synced_communications (id, contact_id, type, direction, summary, content_snippet, occurred_at, source_id, meta_json, privacy_level)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET summary=excluded.summary
                `).bind(
                        item.id, item.contact_id, item.entity_type, item.direction, item.summary, item.content_snippet, item.occurred_at, item.source_id, item.meta_json ? JSON.stringify(item.meta_json) : null, item.privacy_level || 'private'
                    ).run();
                } else {
                    // Generic Context Item
                    await env.DB.prepare(`
                    INSERT INTO context_items (id, type, content, summary, source, embedding_json, relevance_score, tags, privacy_level)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET content=excluded.content, relevance_score=excluded.relevance_score
                 `).bind(
                        item.id, item.type || 'fact', item.content, item.summary, item.source || source, item.embedding ? JSON.stringify(item.embedding) : null, item.relevance || 1.0, item.tags, item.privacy_level || 'private'
                    ).run();
                }
                results.processed++;
            } catch (e) {
                console.error('Sync Error Item:', e);
                results.errors++;
                results.details.push({ id: item.id, error: e.message });
            }
        }

        // 4. Log Batch
        await env.DB.prepare(`
        INSERT INTO context_ingestion_log (batch_id, source, items_processed, status, error_message)
        VALUES (?, ?, ?, ?, ?)
    `).bind(
            batch_id || `batch_${Date.now()}`, source || 'unknown', results.processed, results.errors > 0 ? 'partial' : 'success', results.errors > 0 ? `${results.errors} errors` : null
        ).run();

        return new Response(JSON.stringify({ success: true, results }), {
            headers: corsHeaders
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: corsHeaders
        });
    }
}
