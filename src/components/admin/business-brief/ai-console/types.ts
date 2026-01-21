
// Existing AI Console types + Millstone specific types
import { ReactNode } from 'react';

// --- Millstone Core Enums ---
export enum GeminiModel {
    FLASH = 'gemini-2.5-flash',
    PRO = 'gemini-3-pro-preview',
    FLASH_LITE = 'gemini-flash-lite-latest',
    IMAGEN = 'imagen-4.0-generate-001'
}

export type BuilderMode = 'none' | 'code' | 'write' | 'image' | 'character' | 'plot' | 'research';

// --- File System ---
export interface FileAttachment {
    id?: string;
    name: string;
    mimeType: string;
    data: string; // base64
    size?: number;
    isContext?: boolean;
}

// --- Libraries / Catalogs ---
export interface LibraryItem {
    id: string;
    name: string;
    content: string;
    description?: string;
    tags?: string[];
}

export interface VoiceItem extends LibraryItem {
    voiceId: string;
}

export interface Libraries {
    styles: LibraryItem[];
    characters: LibraryItem[];
    plots: LibraryItem[];
    prompts: LibraryItem[];
    voices: VoiceItem[];
}

// --- Settings ---
export interface UserProfile {
    name: string;
    about: string;
    customInstructions: string;
}

export interface Connection {
    id: string;
    name: string;
    type: 'model_provider' | 'tool' | 'data_source' | 'other';
    apiKey: string;
    baseUrl?: string;
    description?: string;
}

export interface Settings {
    defaultModel: GeminiModel | string;
    temperature: number;
    disableImages: boolean;
    userProfile: UserProfile;
    globalFiles: FileAttachment[];
    connections: Connection[];
}

// --- Entities ---
export interface CustomGPT {
    id: string;
    folderId?: string | null;
    name: string;
    description: string;
    instructions: string;
    model: GeminiModel | string;
    files: FileAttachment[];
    createdAt: number;
    persona?: string;
    voiceId?: string;
    tools?: string[];
}

export interface Folder {
    id: string;
    name: string;
    createdAt: number;
    description?: string;
    instructions?: string;
    files?: FileAttachment[];
    plot?: string;
}

export interface Attachment {
    mimeType: string;
    data: string; // base64
}

export interface Message {
    id: string;
    role: 'user' | 'model' | 'assistant'; // Support both formats
    text: string;
    content?: string; // Fallback for existing components
    attachments?: Attachment[];
    timestamp: number;
    metadata?: {
        builderMode?: BuilderMode;
        speakingStyleId?: string;
        voiceId?: string;
        modelUsed?: string;
        [key: string]: any;
    };
}

export interface Thread {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;

    folderId: string | null;
    customGptId?: string | null;
    secondaryModelId?: string | null;

    model: GeminiModel | string;
    speakingStyleId?: string | null;
    voiceId?: string | null;

    messages: Message[];
}
