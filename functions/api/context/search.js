
import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../_shared/auth.js';
import { filterQueryResults } from '../../_shared/data-gatekeeper.js';

/**
 * Context Search API
 * Endpoint: GET /api/context/search?q=...&type=...&limit=...
 *
 * GATEKEEPER: All queries enforce privacy_level = 'business' or 'public'.
 * Personal data is NEVER returned regardless of what's in the database.
 */
export async function onRequest(context) {
    const { request, env } = context;

    if (request.method === 'OPTIONS') return handleOptions(request);

    const user = await verifyAuth(request, env);
    if (!user) return unauthorizedResponse();

    const url = new URL(request.url);
    const query = url.searchParams.get('q');
    const type = url.searchParams.get('type'); // 'contacts', 'comms', 'docs', 'all'
    const limit = parseInt(url.searchParams.get('limit') || '10');

    try {
        let results = {
            contacts: [],
            communications: [],
            items: []
        };

        if (!query) {
            // Default View: Recent Business Activity (privacy filtered)
            const recentComms = await env.DB.prepare(`
                SELECT c.*, k.name as contact_name, k.company
                FROM synced_communications c
                LEFT JOIN synced_contacts k ON c.contact_id = k.id
                WHERE c.privacy_level IN ('business', 'public')
                ORDER BY c.occurred_at DESC LIMIT ?
            `).bind(limit).all();
            results.communications = filterQueryResults(recentComms.results);

            return new Response(JSON.stringify({ success: true, data: results }), { headers: corsHeaders });
        }

        const searchTerm = `%${query}%`;

        // 1. Search Contacts (business only)
        if (type === 'all' || type === 'contacts') {
            const contacts = await env.DB.prepare(`
                SELECT * FROM synced_contacts
                WHERE privacy_level IN ('business', 'public')
                AND (name LIKE ? OR company LIKE ? OR email LIKE ?)
                LIMIT ?
            `).bind(searchTerm, searchTerm, searchTerm, Math.min(limit, 50)).all();
            results.contacts = filterQueryResults(contacts.results);
        }

        // 2. Search Communications (business only)
        if (type === 'all' || type === 'comms') {
            const comms = await env.DB.prepare(`
                SELECT c.*, k.name as contact_name
                FROM synced_communications c
                LEFT JOIN synced_contacts k ON c.contact_id = k.id
                WHERE c.privacy_level IN ('business', 'public')
                AND (c.summary LIKE ? OR c.content_snippet LIKE ?)
                ORDER BY c.occurred_at DESC LIMIT ?
            `).bind(searchTerm, searchTerm, limit).all();
            results.communications = filterQueryResults(comms.results);
        }

        // 3. Search Context Items (business only)
        if (type === 'all' || type === 'docs') {
            const items = await env.DB.prepare(`
                SELECT * FROM context_items
                WHERE privacy_level IN ('business', 'public')
                AND (content LIKE ? OR summary LIKE ? OR tags LIKE ?)
                ORDER BY relevance_score DESC
                LIMIT ?
            `).bind(searchTerm, searchTerm, searchTerm, limit).all();
            results.items = filterQueryResults(items.results);
        }

        return new Response(JSON.stringify({ success: true, data: results }), {
            headers: corsHeaders
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: corsHeaders
        });
    }
}
