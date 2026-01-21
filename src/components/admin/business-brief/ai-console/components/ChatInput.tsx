
import React, { useRef } from 'react';
import { Paperclip, X, Loader2, Send } from 'lucide-react';
import { BuilderMode } from '../types';

interface ChatInputProps {
    input: string;
    setInput: (value: string) => void;
    onSend: () => void;
    sending: boolean;
    builderMode: BuilderMode;
    attachments: File[];
    onFileSelect: (files: File[]) => void;
    onRemoveAttachment: (index: number) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
    input,
    setInput,
    onSend,
    sending,
    builderMode,
    attachments,
    onFileSelect,
    onRemoveAttachment
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            onFileSelect(Array.from(e.target.files));
        }
    };

    return (
        <div className="flex flex-col">
            {attachments.length > 0 && (
                <div className="px-4 py-2 border-t border-gray-700 flex flex-wrap gap-2">
                    {attachments.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-2 px-2 py-1 bg-gray-800 rounded text-sm">
                            <Paperclip className="w-3 h-3 text-gray-500" />
                            <span className="text-gray-300">{file.name}</span>
                            <button
                                onClick={() => onRemoveAttachment(idx)}
                                className="text-gray-500 hover:text-red-400"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="p-4 border-t border-gray-700">
                <div className="flex gap-2">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
                        title="Attach file"
                    >
                        <Paperclip className="w-5 h-5" />
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileChange}
                    />

                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder={
                            builderMode === 'code' ? 'Describe what you want to build...' :
                                builderMode === 'write' ? 'What would you like me to write?' :
                                    builderMode === 'research' ? 'What topic should I research?' :
                                        builderMode === 'analysis' ? 'What data should I analyze?' :
                                            'Ask anything about your business...'
                        }
                        disabled={sending}
                        rows={1}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 resize-none"
                        style={{ minHeight: '40px', maxHeight: '120px' }}
                    />

                    <button
                        onClick={onSend}
                        disabled={sending || !input.trim()}
                        className={`
              p-2 rounded-lg transition-all
              ${sending || !input.trim()
                                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                : 'bg-amber-500 text-white hover:bg-amber-600'
                            }
            `}
                    >
                        {sending ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Send className="w-5 h-5" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
