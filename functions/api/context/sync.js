
import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../_shared/auth.js';
import { filterBatch, classifyPrivacy, getFilterStats } from '../../_shared/data-gatekeeper.js';

/**
 * Handle POST request to sync data from Data Context Engine
 * Endpoint: /api/context/sync
 *
 * GATEKEEPER: All inbound items are filtered through data-gatekeeper.js.
 * Personal data is DISCARDED before it ever touches the database.
 */
export async function onRequestPost(context) {
    const { request, env } = context;

    // 1. CORS Pre-flight
    if (request.method === 'OPTIONS') {
        return handleOptions(request);
    }

    // 2. Auth Check (API Key or Admin Token)
    const apiKey = request.headers.get('X-Sync-Key');
    let authorized = false;

    // Method A: Standard Admin Auth
    try {
        const user = await verifyAuth(request, env);
        if (user) authorized = true;
    } catch (e) { }

    // Method B: Dedicated Sync Key (for headless python script)
    if (!authorized && apiKey && apiKey === (env.CONTEXT_SYNC_KEY || env.ADMIN_PASSWORD_HASH)) {
        authorized = true;
    }

    if (!authorized) {
        return unauthorizedResponse();
    }

    try {
        const data = await request.json();
        const { batch_id, source, items } = data;

        if (!items || !Array.isArray(items)) {
            return new Response(JSON.stringify({ error: 'Invalid payload: items array required' }), {
                status: 400, headers: corsHeaders
            });
        }

        // =====================================================================
        // GATEKEEPER: Filter personal data BEFORE processing
        // =====================================================================
        const originalCount = items.length;

        // Auto-classify items that don't have explicit privacy_level
        const classifiedItems = items.map(item => {
            if (!item.privacy_level || item.privacy_level === 'private') {
                const classified = classifyPrivacy(item);
                return { ...item, privacy_level: classified };
            }
            return item;
        });

        // Apply the gatekeeper filter
        const { allowed, discarded } = filterBatch(classifiedItems);

        console.log(`[GATEKEEPER] Batch: ${originalCount} items → ${allowed.length} allowed, ${discarded} discarded (personal data blocked)`);

        // =====================================================================
        // Process ONLY allowed items
        // =====================================================================
        const results = {
            processed: 0,
            errors: 0,
            gatekeeper: { total: originalCount, allowed: allowed.length, discarded },
            details: []
        };

        for (const item of allowed) {
            try {
                if (item.entity_type === 'contact') {
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
                        item.id, item.external_id, item.name, item.phone, item.email,
                        item.company, source || 'api', item.last_interaction_at,
                        item.privacy_level || 'business'
                    ).run();

                } else if (['sms', 'call', 'email', 'meeting'].includes(item.entity_type)) {
                    await env.DB.prepare(`
                        INSERT INTO synced_communications (id, contact_id, type, direction, summary, content_snippet, occurred_at, source_id, meta_json, privacy_level)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(id) DO UPDATE SET summary=excluded.summary, privacy_level=excluded.privacy_level
                    `).bind(
                        item.id, item.contact_id, item.entity_type, item.direction,
                        item.summary, item.content_snippet, item.occurred_at,
                        item.source_id, item.meta_json ? JSON.stringify(item.meta_json) : null,
                        item.privacy_level || 'business'
                    ).run();

                } else {
                    await env.DB.prepare(`
                        INSERT INTO context_items (id, type, content, summary, source, embedding_json, relevance_score, tags, privacy_level)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(id) DO UPDATE SET content=excluded.content, relevance_score=excluded.relevance_score, privacy_level=excluded.privacy_level
                    `).bind(
                        item.id, item.type || 'fact', item.content, item.summary,
                        item.source || source, item.embedding ? JSON.stringify(item.embedding) : null,
                        item.relevance || 1.0, item.tags, item.privacy_level || 'business'
                    ).run();
                }
                results.processed++;
            } catch (e) {
                console.error('Sync Error Item:', e);
                results.errors++;
                results.details.push({ id: item.id, error: e.message });
            }
        }

        // Log Batch with gatekeeper stats
        await env.DB.prepare(`
            INSERT INTO context_ingestion_log (batch_id, source, items_processed, status, error_message)
            VALUES (?, ?, ?, ?, ?)
        `).bind(
            batch_id || `batch_${Date.now()}`,
            source || 'unknown',
            results.processed,
            results.errors > 0 ? 'partial' : 'success',
            discarded > 0 ? `${discarded} items filtered (personal data), ${results.errors} errors` : (results.errors > 0 ? `${results.errors} errors` : null)
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
