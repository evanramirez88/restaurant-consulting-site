
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
                id: `sms_${Date.now()}_1`,
                entity_type: 'sms',
                type: 'sms',
                direction: 'inbound',
                contact_id: 'user_01',
                name: 'Evan Ramirez', // Simulating a known contact
                phone: '+15550199',
                summary: 'User asking about integrating Millstone UI.',
                content_snippet: 'Hey, I want to integrate the Millstone prototype into the admin portal. Can we start?',
                occurred_at: Date.now() - 1000 * 60 * 5 // 5 mins ago
            },
            {
                id: `call_${Date.now()}_2`,
                entity_type: 'call',
                type: 'call',
                direction: 'outbound',
                contact_id: 'client_05',
                name: 'Restaurant Owner (Bob)',
                summary: 'Discussed menu pricing strategy and 400k revenue goal.',
                occurred_at: Date.now() - 1000 * 60 * 60 * 2 // 2 hours ago
            },
            {
                id: `ctx_${Date.now()}_3`,
                entity_type: 'context_item',
                type: 'fact',
                source: 'limitless_ai',
                content: 'The user prefers dark mode interfaces with amber accents.',
                summary: 'User preference: Dark/Amber UI.',
                relevance: 0.9,
                tags: 'preferences, ui'
            }
        ]
    };

    console.log("Pushing Data to Business Brief...", JSON.stringify(payload, null, 2));

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sync-Key': 'admin_hash_placeholder' // In local dev, auth might be bypassed or this needs to match env
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

// Polyfill fetch for older node if needed, though usually available in recent node
// executing...
runSimulation();
