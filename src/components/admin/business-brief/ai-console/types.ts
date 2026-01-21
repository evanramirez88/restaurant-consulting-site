
import { ReactNode } from 'react';

export interface AIProvider {
    id: string;
    name: string;
    provider_type: string;
    is_default: boolean;
}

export interface AIModel {
    id: string;
    provider_id: string;
    model_id: string;
    display_name: string;
    category: string;
    is_default: boolean;
}

export interface AIAssistant {
    id: string;
    name: string;
    description: string;
    system_instructions: string;
    persona: string;
    model_id: string;
    include_business_context: boolean;
    include_lead_context: boolean;
    include_personal_context: boolean;
    is_default: boolean;
}

export interface SpeakingStyle {
    id: string;
    name: string;
    instructions: string;
    category: string;
}

export interface IntelligenceFolder {
    id: string;
    name: string;
    parent_id: string | null;
}

export interface ContextDataSource {
    id: string;
    name: string;
    source_type: string;
    tier: number;
    is_business: boolean;
    sync_enabled: boolean;
    last_sync_at: string | null;
}

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    model_used?: string;
    builder_mode?: string;
    attachments?: { name: string; type: string; size: number }[];
}

export interface Session {
    id: string;
    title: string;
    assistant_id: string | null;
    model_id: string;
    created_at: string;
    updated_at: string;
    message_count: number;
}

export interface ConsoleConfig {
    providers: AIProvider[];
    models: AIModel[];
    assistants: AIAssistant[];
    styles: SpeakingStyle[];
    folders: IntelligenceFolder[];
    dataSources: ContextDataSource[];
    builderModes: { id: string; label: string; icon: string }[];
}

export type Tab = 'chat' | 'assistants' | 'connections' | 'context' | 'settings';
export type BuilderMode = 'none' | 'code' | 'write' | 'research' | 'analysis';

export interface BuilderModeConfig {
    id: BuilderMode;
    label: string;
    icon: ReactNode;
    color: string;
}
