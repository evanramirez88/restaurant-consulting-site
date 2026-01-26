
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
    // Ensure onChunk is always called even on errors - BB-9 fix
    let responseSent = false;
    const safeOnChunk = (text: string) => {
        responseSent = true;
        onChunk(text);
    };

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

        if (!response.ok) {
            const errorText = await response.text();
            try {
                const errorJson = JSON.parse(errorText);
                safeOnChunk(`**Error**: ${errorJson.error || 'Request failed'}`);
            } catch {
                safeOnChunk(`**Error**: Request failed (${response.status})`);
            }
            return;
        }

        const result = await response.json();

        if (result.success) {
            // Backend returns { success: true, message: { content: "..." } }
            const responseText = result.message?.content || result.response || '';
            if (responseText) {
                safeOnChunk(responseText);
            } else {
                safeOnChunk('No response received from the AI model.');
            }
        } else {
            safeOnChunk(`**Error**: ${result.error || 'Unknown error'}`);
        }

    } catch (error) {
        console.error('API Error:', error);
        safeOnChunk(`**Connection Error**: ${error instanceof Error ? error.message : 'Failed to reach intelligence service'}.`);
    } finally {
        // BB-9 fix: Ensure we always send a response to prevent stuck "Thinking..."
        if (!responseSent) {
            onChunk('An unexpected error occurred. Please try again.');
        }
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
