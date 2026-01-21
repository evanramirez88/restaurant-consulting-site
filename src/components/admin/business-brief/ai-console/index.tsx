
import React, { useEffect } from 'react';
import {
    MessageSquare, Bot, Network, Database, Settings, Sparkles, Loader2
} from 'lucide-react';
import { useAIConsole } from './hooks/useAIConsole';
import { Tab } from './types';
import { SessionSidebar } from './components/SessionSidebar';
import { ChatPanel } from './panels/ChatPanel';
import { AssistantsPanel } from './panels/AssistantsPanel';

export default function BusinessBriefAIConsole() {
    const { state, actions } = useAIConsole();

    // Load initial data
    useEffect(() => {
        actions.loadConfig();
        actions.loadSessions();
        actions.loadBusinessContext();
    }, [actions.loadConfig, actions.loadSessions, actions.loadBusinessContext]);

    if (state.loading) {
        return (
            <div className="admin-card p-8">
                <div className="flex items-center justify-center gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                    <span className="text-gray-400">Initializing Intelligence Console...</span>
                </div>
            </div>
        );
    }

    const TabButton = ({ id, label, icon: Icon }: { id: Tab; label: string; icon: React.ElementType }) => (
        <button
            onClick={() => actions.setConfigTab(id)}
            className={`
        flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all
        ${state.configTab === id
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }
      `}
        >
            <Icon className="w-4 h-4" />
            <span className="hidden md:inline">{label}</span>
        </button>
    );

    return (
        <div className="space-y-4">
            {/* Header with Tabs */}
            <div className="admin-card p-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-amber-500/20 to-purple-500/20 rounded-lg">
                            <Sparkles className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                            <h2 className="text-white font-medium">Intelligence Console</h2>
                            <p className="text-xs text-gray-500">
                                Multi-model AI with business context
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 bg-gray-800/50 rounded-lg p-1">
                        <TabButton id="chat" label="Chat" icon={MessageSquare} />
                        <TabButton id="assistants" label="Assistants" icon={Bot} />
                        <TabButton id="context" label="Context" icon={Database} />
                        <TabButton id="connections" label="Providers" icon={Network} />
                        <TabButton id="settings" label="Settings" icon={Settings} />
                    </div>
                </div>
            </div>

            {/* Main Content based on Tab */}
            {state.configTab === 'chat' && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    <SessionSidebar
                        sessions={state.sessions}
                        activeSessionId={state.activeSessionId}
                        config={state.config}
                        selectedAssistant={state.selectedAssistant}
                        selectedModel={state.selectedModel}
                        selectedStyle={state.selectedStyle}
                        onSessionSelect={actions.setActiveSessionId}
                        onCreateSession={actions.createSession}
                        onAssistantChange={actions.setSelectedAssistant}
                        onModelChange={actions.setSelectedModel}
                        onStyleChange={actions.setSelectedStyle}
                    />

                    <ChatPanel
                        messages={state.messages}
                        input={state.input}
                        setInput={actions.setInput}
                        sending={state.sending}
                        copiedId={state.copiedId}
                        builderMode={state.builderMode}
                        setBuilderMode={actions.setBuilderMode}
                        showContextPanel={state.showContextPanel}
                        setShowContextPanel={actions.setShowContextPanel}
                        businessContext={state.businessContext}
                        attachments={state.attachments}
                        onSendMessage={actions.sendMessage}
                        onClearConversation={() => actions.setMessages([])}
                        onCopyMessage={(text, id) => {
                            navigator.clipboard.writeText(text);
                            actions.setCopiedId(id);
                            setTimeout(() => actions.setCopiedId(null), 2000);
                        }}
                        onFileSelect={actions.setAttachments}
                        onRemoveAttachment={(index) => {
                            actions.setAttachments(prev => prev.filter((_, i) => i !== index));
                        }}
                    />
                </div>
            )}

            {state.configTab === 'assistants' && (
                <AssistantsPanel
                    config={state.config}
                    onSelectAssistant={(id) => {
                        actions.setSelectedAssistant(id);
                        actions.setConfigTab('chat');
                    }}
                    onCreateAssistant={() => console.log('Create assistant')}
                />
            )}

            {(state.configTab === 'connections' || state.configTab === 'context' || state.configTab === 'settings') && (
                <div className="admin-card p-8 flex flex-col items-center justify-center text-center">
                    <div className="p-4 bg-gray-800 rounded-full mb-4">
                        <Settings className="w-8 h-8 text-gray-500" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">Coming Soon</h3>
                    <p className="text-gray-400 max-w-md">
                        The {state.configTab} panel is currently under development.
                        Check back soon for updates.
                    </p>
                </div>
            )}
        </div>
    );
}
