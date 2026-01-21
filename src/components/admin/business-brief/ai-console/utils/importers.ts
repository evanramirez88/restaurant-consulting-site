
import { Thread, Message } from '../types';
import { generateId } from './helpers';

export function parseChatGPTExport(jsonString: string): Thread[] {
    try {
        const data = JSON.parse(jsonString);
        if (!Array.isArray(data)) return [];

        const threads: Thread[] = [];

        for (const conv of data) {
            if (!conv.mapping) continue;

            const messages: Message[] = [];
            const mapping = conv.mapping;

            // Traverse the mapping to get messages in order based on current_node? 
            // ChatGPT export structure is a tree of nodes. A simple linear export usually follows 'current_node' backwards, but that's hard.
            // Often keys are UUIDs. Let's just grab all 'message' types and sort by create_time if possible, 
            // or just trust the keys order if we can find a root.
            // For simplicity/robustness in this stub: we just look for all values that are messages.

            const nodes = Object.values(mapping) as any[];
            const msgNodes = nodes.filter(n => n.message && n.message.content && n.message.content.parts);

            // Sort by create_time
            msgNodes.sort((a, b) => (a.message.create_time || 0) - (b.message.create_time || 0));

            for (const node of msgNodes) {
                const m = node.message;
                if (m.author.role === 'system') continue; // Skip system prompts usually

                const text = m.content.parts.join('\n');
                if (!text) continue;

                messages.push({
                    id: generateId(),
                    role: m.author.role === 'assistant' ? 'model' : 'user',
                    text: text,
                    timestamp: (m.create_time || 0) * 1000
                });
            }

            if (messages.length > 0) {
                threads.push({
                    id: generateId(),
                    title: conv.title || 'Imported Chat',
                    createdAt: (conv.create_time || 0) * 1000,
                    updatedAt: (conv.update_time || 0) * 1000,
                    folderId: null,
                    model: 'gemini-1.5-flash', // Default to something valid
                    messages
                });
            }
        }

        return threads;
    } catch (e) {
        console.error("Failed to parse ChatGPT export", e);
        return [];
    }
}
