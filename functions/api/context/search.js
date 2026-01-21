
import { verifyAuth, unauthorizedResponse, corsHeaders, handleOptions } from '../../_shared/auth.js';

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
            // Default View: Recent Activity
            const recentComms = await env.DB.prepare(`
            SELECT c.*, k.name as contact_name, k.company 
            FROM synced_communications c
            LEFT JOIN synced_contacts k ON c.contact_id = k.id
            ORDER BY c.occurred_at DESC LIMIT ?
        `).bind(limit).all();
            results.communications = recentComms.results;

            return new Response(JSON.stringify({ success: true, data: results }), { headers: corsHeaders });
        }

        // Basic SQL Search (In future: use Vector Search if Vectorize is bound)
        // 1. Search Contacts
        if (type === 'all' || type === 'contacts') {
            const contacts = await env.DB.prepare(`
            SELECT * FROM synced_contacts 
            WHERE name LIKE ? OR company LIKE ? OR email LIKE ?
            LIMIT 5
        `).bind(`%${query}%`, `%${query}%`, `%${query}%`).all();
            results.contacts = contacts.results;
        }

        // 2. Search Comms
        if (type === 'all' || type === 'comms') {
            const comms = await env.DB.prepare(`
            SELECT c.*, k.name as contact_name 
            FROM synced_communications c
            LEFT JOIN synced_contacts k ON c.contact_id = k.id
            WHERE c.summary LIKE ? OR c.content_snippet LIKE ?
            ORDER BY c.occurred_at DESC LIMIT ?
        `).bind(`%${query}%`, `%${query}%`, limit).all();
            results.communications = comms.results;
        }

        // 3. Search Items
        if (type === 'all' || type === 'docs') {
            const items = await env.DB.prepare(`
            SELECT * FROM context_items 
            WHERE content LIKE ? OR summary LIKE ? OR tags LIKE ?
            LIMIT ?
        `).bind(`%${query}%`, `%${query}%`, `%${query}%`, limit).all();
            results.items = items.results;
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
