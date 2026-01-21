
import React, { useEffect, useRef } from 'react';
import { User, Bot, Copy, Check, Wand2, Loader2, Paperclip, X } from 'lucide-react';
import { Message } from '../types';

interface MessageListProps {
    messages: Message[];
    sending: boolean;
    copiedId: string | null;
    onCopy: (text: string, id: string) => void;
    onSendMessage: (text: string) => void;
    onRemoveAttachment?: (index: number) => void; // Optional if handled in input or here
}

export const MessageList: React.FC<MessageListProps> = ({
    messages,
    sending,
    copiedId,
    onCopy,
    onSendMessage
}) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, sending]);

    if (messages.length === 0) {
        return (
            <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-amber-500/20 to-purple-500/20 rounded-xl flex items-center justify-center mb-4">
                    <Wand2 className="w-8 h-8 text-amber-400" />
                </div>
                <p className="text-gray-400 font-medium">Intelligence Console</p>
                <p className="text-sm text-gray-500 mt-1 max-w-md">
                    Multi-model AI assistant with full business context.
                    Ask about leads, clients, revenue, or use builder modes.
                </p>

                <div className="flex flex-wrap justify-center gap-2 mt-6">
                    {[
                        'Summarize today\'s priorities',
                        'Which leads should I follow up with?',
                        'Analyze this month\'s revenue',
                        'Draft an email to a new lead',
                    ].map((prompt, idx) => (
                        <button
                            key={idx}
                            onClick={() => onSendMessage(prompt)}
                            className="px-3 py-1.5 bg-gray-800 text-gray-400 text-sm rounded-lg hover:bg-gray-700 hover:text-white"
                        >
                            {prompt}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map(message => (
                <div
                    key={message.id}
                    className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                    <div className={`
            flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
            ${message.role === 'user'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-purple-500/20 text-purple-400'
                        }
          `}>
                        {message.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    <div className={`
            flex-1 max-w-[80%] rounded-lg p-3 relative group
            ${message.role === 'user'
                            ? 'bg-amber-500/10 text-white ml-auto'
                            : 'bg-gray-800 text-gray-200'
                        }
          `}>
                        {message.builder_mode && (
                            <span className="absolute -top-2 left-2 px-2 py-0.5 bg-gray-700 text-xs text-gray-400 rounded">
                                {message.builder_mode}
                            </span>
                        )}

                        <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap">
                            {message.content}
                        </div>

                        {message.attachments && message.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {message.attachments.map((att, idx) => (
                                    <span key={idx} className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-400">
                                        {att.name}
                                    </span>
                                ))}
                            </div>
                        )}

                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-700/50">
                            <p className="text-xs text-gray-500">
                                {new Date(message.timestamp).toLocaleTimeString()}
                                {message.model_used && ` • ${message.model_used}`}
                            </p>

                            {message.role === 'assistant' && (
                                <button
                                    onClick={() => onCopy(message.content, message.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-white rounded"
                                    title="Copy"
                                >
                                    {copiedId === message.id ? (
                                        <Check className="w-3 h-3 text-green-400" />
                                    ) : (
                                        <Copy className="w-3 h-3" />
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            ))}

            {sending && (
                <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-gray-400">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm">Processing...</span>
                        </div>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>
    );
};
