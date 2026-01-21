
import { Thread, Message, Settings, Folder, CustomGPT, LibraryItem, BuilderMode } from '../types';

// Points to our Cloudflare Worker API
const API_ENDPOINT = '/api/admin/intelligence-console/chat';

export async function streamGeminiResponse(
    thread: Thread,
    userMessage: Message,
    settings: Settings,
    project: Folder | undefined,
    customGpt: CustomGPT | undefined,
    secondaryModelId: string | undefined | null,
    allCustomGpts: CustomGPT[],
    style: LibraryItem | undefined,
    builderMode: BuilderMode,
    onChunk: (chunk: string) => void
) {
    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: userMessage.text,
                session_id: thread.id,
                // Map Millstone types to our Backend expected types
                assistant_id: customGpt?.id,
                model_id: thread.model,
                secondary_model_id: secondaryModelId,
                style_id: style?.id,
                builder_mode: builderMode,
                project_context: project ? { id: project.id, name: project.name, description: project.description } : null,
                conversation_history: thread.messages.map(m => ({
                    role: m.role,
                    content: m.text || m.content, // Handle both
                })),
                settings: {
                    temperature: settings.temperature,
                    disable_images: settings.disableImages
                }
            }),
        });

        if (!response.body) throw new Error('No response body');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let resultText = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            // Our backend currently returns JSON, but for "streaming" simulation we might need adjustment.
            // For now, let's assume non-streaming JSON response for v1 compatibility, 
            // or if we implement streaming later.
            // If the backend returns a single JSON object:
            try {
                const json = JSON.parse(resultText + chunk);
                if (json.response) {
                    onChunk(json.response);
                    return;
                }
            } catch (e) {
                // Accumulate if incomplete
            }
            resultText += chunk;
        }

        // Fallback if not streaming
        try {
            const json = JSON.parse(resultText);
            if (json.success) {
                onChunk(json.response);
            } else {
                onChunk(`Error: ${json.error || 'Unknown error'}`);
            }
        } catch (e) {
            onChunk(resultText);
        }

    } catch (error) {
        console.error('API Error:', error);
        onChunk(`**Connection Error**: ${error instanceof Error ? error.message : 'Failed to reach intelligence service'}.`);
    }
}

export async function generateTitle(text: string): Promise<string> {
    // Simple client-side title generation or call API
    return text.substring(0, 30) + (text.length > 30 ? '...' : '');
}

export async function generateLibraryItem(type: string, content: string): Promise<any> {
    // Stub
    return { id: Math.random().toString(), content };
}
