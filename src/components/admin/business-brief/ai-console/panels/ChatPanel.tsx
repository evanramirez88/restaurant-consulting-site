
import React from 'react';
import {
    MessageCircle, Code, FileEdit, Search, BarChart2, RefreshCw, Database
} from 'lucide-react';
import { Message, BuilderMode, Session, ConsoleConfig } from '../types';
import { MessageList } from '../components/MessageList';
import { ChatInput } from '../components/ChatInput';
import { ContextPanel } from '../components/ContextPanel';

interface ChatPanelProps {
    messages: Message[];
    input: string;
    setInput: (val: string) => void;
    sending: boolean;
    copiedId: string | null;
    builderMode: BuilderMode;
    setBuilderMode: (mode: BuilderMode) => void;
    showContextPanel: boolean;
    setShowContextPanel: (show: boolean) => void;
    businessContext: any;
    attachments: File[];
    onSendMessage: (text: string) => void;
    onClearConversation: () => void;
    onCopyMessage: (text: string, id: string) => void;
    onFileSelect: (files: File[]) => void;
    onRemoveAttachment: (index: number) => void;
}

const builderModeConfig: { id: BuilderMode; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'none', label: 'Chat', icon: <MessageCircle className="w-4 h-4" />, color: 'gray' },
    { id: 'code', label: 'Code', icon: <Code className="w-4 h-4" />, color: 'blue' },
    { id: 'write', label: 'Write', icon: <FileEdit className="w-4 h-4" />, color: 'green' },
    { id: 'research', label: 'Research', icon: <Search className="w-4 h-4" />, color: 'purple' },
    { id: 'analysis', label: 'Analysis', icon: <BarChart2 className="w-4 h-4" />, color: 'amber' },
];

export const ChatPanel: React.FC<ChatPanelProps> = ({
    messages,
    input,
    setInput,
    sending,
    copiedId,
    builderMode,
    setBuilderMode,
    showContextPanel,
    setShowContextPanel,
    businessContext,
    attachments,
    onSendMessage,
    onClearConversation,
    onCopyMessage,
    onFileSelect,
    onRemoveAttachment
}) => {
    return (
        <div className="admin-card flex flex-col lg:col-span-3" style={{ height: '600px' }}>
            {/* Builder Mode Toolbar */}
            <div className="p-3 border-b border-gray-700 flex items-center gap-2 overflow-x-auto">
                {builderModeConfig.map(mode => (
                    <button
                        key={mode.id}
                        onClick={() => setBuilderMode(mode.id)}
                        className={`
              flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-all
              ${builderMode === mode.id
                                ? `bg-${mode.color}-500/20 text-${mode.color}-400 border border-${mode.color}-500/30`
                                : 'bg-gray-800 text-gray-400 hover:text-white'
                            }
            `}
                    >
                        {mode.icon}
                        {mode.label}
                    </button>
                ))}

                <div className="flex-1" />

                {messages.length > 0 && (
                    <button
                        onClick={onClearConversation}
                        className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
                        title="Clear conversation"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                )}

                <button
                    onClick={() => setShowContextPanel(!showContextPanel)}
                    className={`
            p-2 rounded-lg transition-all
            ${showContextPanel ? 'bg-amber-500/20 text-amber-400' : 'text-gray-400 hover:text-white hover:bg-gray-800'}
          `}
                    title="Toggle context panel"
                >
                    <Database className="w-4 h-4" />
                </button>
            </div>

            <ContextPanel businessContext={businessContext} visible={showContextPanel} />

            <MessageList
                messages={messages}
                sending={sending}
                copiedId={copiedId}
                onCopy={onCopyMessage}
                onSendMessage={onSendMessage}
            />

            <ChatInput
                input={input}
                setInput={setInput}
                onSend={() => onSendMessage(input)}
                sending={sending}
                builderMode={builderMode}
                attachments={attachments}
                onFileSelect={onFileSelect}
                onRemoveAttachment={onRemoveAttachment}
            />
        </div>
    );
};
