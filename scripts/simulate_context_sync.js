
/**
 * SIMULATION SCRIPT
 * Simulates the "Data Context Engine" by pushing mock data to the Business Brief API.
 * Usage: node scripts/simulate_context_sync.js
 */

async function runSimulation() {
    const API_URL = 'http://localhost:8788/api/context/sync'; // Update port if needed
    // Assuming local dev uses 8788 for functions

    // Mock Data simulating "Limitless AI" and "SMS" ingestion
    const payload = {
        batch_id: `sim_${Date.now()}`,
        source: 'simulation_script',
        items: [
            {
                id: `sms_${Date.now()}_private`,
                entity_type: 'sms',
                type: 'sms',
                direction: 'inbound',
                contact_id: 'user_private_01',
                name: 'Mom',
                phone: '+15550000',
                summary: 'Asking about dinner plans.',
                content_snippet: 'Are you coming over for dinner tonight?',
                occurred_at: Date.now() - 1000 * 60 * 10, // 10 mins ago
                privacy_level: 'private'
            },
            {
                id: `call_${Date.now()}_business`,
                entity_type: 'call',
                type: 'call',
                direction: 'outbound',
                contact_id: 'client_bob_05',
                name: 'Restaurant Owner (Bob)',
                summary: 'Discussed menu pricing strategy and 400k revenue goal.',
                occurred_at: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
                privacy_level: 'business'
            },
            {
                id: `meeting_${Date.now()}_business`,
                entity_type: 'meeting',
                type: 'meeting',
                contact_id: 'lead_alice_99',
                name: 'Alice (New Lead)',
                summary: 'Introductory meeting for consulting services.',
                occurred_at: Date.now() - 1000 * 60 * 60 * 24, // 1 day ago
                privacy_level: 'business',
                meta_json: { platform: 'Zoom' }
            },
            {
                id: `ctx_${Date.now()}_fact`,
                entity_type: 'context_item',
                type: 'fact',
                source: 'limitless_ai',
                content: 'The user prefers dark mode interfaces with amber accents.',
                summary: 'User preference: Dark/Amber UI.',
                relevance: 0.9,
                tags: 'preferences, ui' // context items don't strictly have privacy_level column yet in my migration? 
                // Wait, I only added it to synced_contacts and synced_communications. 
                // context_items table might need it too? 
                // Summary said: "Implementing Privacy Levels: Adding a privacy_level field to synced_contacts, synced_communications, and context_items"
                // But migration 0061 ONLY added it to synced_contacts and synced_communications.
                // I should verify schema for context_items.
            }
        ]
    };

    console.log("Pushing Data to Business Brief...", JSON.stringify(payload, null, 2));

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sync-Key': 'admin_hash_placeholder'
            },
            body: JSON.stringify(payload)
        });

        const text = await response.text();
        console.log("Response Status:", response.status);
        console.log("Response Body:", text);
    } catch (e) {
        console.error("Connection Failed. Ensure local dev server is running (npm run dev).", e.message);
    }
}

runSimulation();
