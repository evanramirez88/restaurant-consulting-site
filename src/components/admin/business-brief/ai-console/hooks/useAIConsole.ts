
import { useState, useCallback, useRef, useEffect } from 'react';
import { ConsoleConfig, Message, Session, Tab, BuilderMode } from '../types';

export function useAIConsole() {
    // Config state
    const [config, setConfig] = useState<ConsoleConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [configTab, setConfigTab] = useState<Tab>('chat');

    // Chat state
    const [messages, setMessages] = useState<Message[]>([]);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Settings state
    const [selectedAssistant, setSelectedAssistant] = useState<string | null>(null);
    const [selectedModel, setSelectedModel] = useState<string | null>(null);
    const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
    const [builderMode, setBuilderMode] = useState<BuilderMode>('none');
    const [attachments, setAttachments] = useState<File[]>([]);

    // Context state
    const [showContextPanel, setShowContextPanel] = useState(false);
    const [businessContext, setBusinessContext] = useState<any>(null);
    const [syncing, setSyncing] = useState(false);

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadConfig = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/admin/intelligence-console/config');
            const result = await response.json();
            if (result.success) {
                setConfig(result.data);
                const defaultAssistant = result.data.assistants?.find((a: any) => a.is_default);
                const defaultModel = result.data.models?.find((m: any) => m.is_default);
                if (defaultAssistant) setSelectedAssistant(defaultAssistant.id);
                if (defaultModel) setSelectedModel(defaultModel.id);
            }
        } catch (error) {
            console.error('Failed to load config:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadSessions = useCallback(async () => {
        try {
            const response = await fetch('/api/admin/intelligence-console/sessions');
            const result = await response.json();
            if (result.success) {
                setSessions(result.data.sessions || []);
            }
        } catch (error) {
            console.error('Failed to load sessions:', error);
        }
    }, []);

    const loadBusinessContext = useCallback(async () => {
        try {
            const response = await fetch('/api/admin/intelligence-console/context?type=summary');
            const result = await response.json();
            if (result.success) {
                setBusinessContext(result.data);
            }
        } catch (error) {
            console.error('Failed to load context:', error);
        }
    }, []);

    const createSession = useCallback(async () => {
        try {
            const response = await fetch('/api/admin/intelligence-console/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: 'New Session',
                    assistant_id: selectedAssistant,
                    model_id: selectedModel,
                }),
            });
            const result = await response.json();
            if (result.success) {
                const newSession = result.data;
                setSessions(prev => [newSession, ...prev]);
                setActiveSessionId(newSession.id);
                setMessages([]);
            }
        } catch (error) {
            console.error('Failed to create session:', error);
        }
    }, [selectedAssistant, selectedModel]);

    const sendMessage = useCallback(async (content: string) => {
        if (!content.trim() || sending) return;

        const userMessage: Message = {
            id: `msg_${Date.now()}`,
            role: 'user',
            content: content.trim(),
            timestamp: Date.now(),
            builder_mode: builderMode !== 'none' ? builderMode : undefined,
            attachments: attachments.map(f => ({ name: f.name, type: f.type, size: f.size })),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setAttachments([]);
        setSending(true);

        try {
            const response = await fetch('/api/admin/intelligence-console/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: content,
                    session_id: activeSessionId,
                    assistant_id: selectedAssistant,
                    model_id: selectedModel,
                    style_id: selectedStyle,
                    builder_mode: builderMode,
                    conversation_history: messages.slice(-10).map(m => ({
                        role: m.role,
                        content: m.content,
                    })),
                }),
            });

            const result = await response.json();

            const assistantMessage: Message = {
                id: `msg_${Date.now()}_resp`,
                role: 'assistant',
                content: result.success ? (result.message?.content || result.response || 'No response received.') : `Sorry, I encountered an error: ${result.error || 'Unknown error'}`,
                timestamp: Date.now(),
                model_used: result.message?.model || result.model_used,
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Failed to send message:', error);
            const errorMessage: Message = {
                id: `msg_${Date.now()}_err`,
                role: 'assistant',
                content: 'Sorry, I encountered a connection error. Please try again.',
                timestamp: Date.now(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setSending(false);
        }
    }, [activeSessionId, selectedAssistant, selectedModel, selectedStyle, builderMode, attachments, messages, sending]);

    const syncDataSources = useCallback(async () => {
        setSyncing(true);
        try {
            const response = await fetch('/api/admin/intelligence-console/context', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'sync_internal' }),
            });
            const result = await response.json();
            if (result.success) {
                loadBusinessContext();
            }
        } catch (error) {
            console.error('Failed to sync:', error);
        } finally {
            setSyncing(false);
        }
    }, [loadBusinessContext]);

    return {
        state: {
            config, loading, configTab, messages, sessions, activeSessionId,
            input, sending, copiedId, selectedAssistant, selectedModel,
            selectedStyle, builderMode, attachments, showContextPanel,
            businessContext, syncing
        },
        actions: {
            setConfig, setConfigTab, setMessages, setSessions, setActiveSessionId,
            setInput, setSending, setCopiedId, setSelectedAssistant,
            setSelectedModel, setSelectedStyle, setBuilderMode, setAttachments,
            setShowContextPanel, setBusinessContext, setSyncing,
            loadConfig, loadSessions, loadBusinessContext, createSession,
            sendMessage, syncDataSources
        },
        refs: {
            messagesEndRef, fileInputRef
        }
    };
}
