
import React, { useRef, useEffect, useState } from 'react';
import {
    Send, Paperclip, Bot, Mic, Code, PenTool, Image as ImageIcon,
    BookOpen, Sparkles, Download, X, ChevronDown, Save, Plus
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Thread, Settings, Folder, CustomGPT, Libraries, GeminiModel, BuilderMode, Attachment, Message } from '../types';
import { streamGeminiResponse, generateTitle } from '../services/geminiService';
import { fileToBase64, generateId, downloadThreadAsMarkdown } from '../utils/helpers';

interface ChatProps {
    thread: Thread;
    settings: Settings;
    libraries: Libraries;
    project?: Folder;
    customGpt?: CustomGPT;
    allCustomGpts: CustomGPT[];
    onUpdateThread: (id: string, updates: Partial<Thread>) => void;
    onSaveToLibrary: (type: 'style' | 'character' | 'plot', content: string) => void;
}

export const ChatInterface: React.FC<ChatProps> = ({
    thread, settings, libraries, project, customGpt, allCustomGpts, onUpdateThread, onSaveToLibrary
}) => {
    const [input, setInput] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [activeBuilderMode, setActiveBuilderMode] = useState<BuilderMode>('none');
    const [showStyleMenu, setShowStyleMenu] = useState(false);
    const [showModelSelector, setShowModelSelector] = useState<'primary' | 'secondary' | null>(null);
    const [focused, setFocused] = useState(false);

    const bottomRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll & Focus
    useEffect(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), [thread.messages.length, isGenerating]);

    // Textarea Resize
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
        }
    }, [input]);

    const handleSend = async () => {
        if ((!input.trim() && attachments.length === 0) || isGenerating) return;

        const userMsg: Message = {
            id: generateId(),
            role: 'user',
            text: input,
            attachments: [...attachments],
            timestamp: Date.now(),
            metadata: { builderMode: activeBuilderMode }
        };

        const newMessages = [...thread.messages, userMsg];
        onUpdateThread(thread.id, { messages: newMessages });
        setInput('');
        setAttachments([]);
        setIsGenerating(true);

        // Generate Title if new
        if (thread.messages.length === 0) {
            generateTitle(userMsg.text).then(title => onUpdateThread(thread.id, { title }));
        }

        const modelMsg: Message = { id: generateId(), role: 'model', text: '', timestamp: Date.now() };
        onUpdateThread(thread.id, { messages: [...newMessages, modelMsg] });

        try {
            const style = libraries.styles.find(s => s.id === thread.speakingStyleId);

            await streamGeminiResponse(
                { ...thread, messages: newMessages },
                userMsg,
                settings,
                project,
                customGpt,
                thread.secondaryModelId, // Pass ID directly
                allCustomGpts, // Pass full list so service can look it up
                style,
                activeBuilderMode,
                (chunk) => {
                    // For React state updates, we need to be careful with closure if we used the prev state method.
                    // Here we just replicate the logic to append text.
                    // But since chunking might replace whole text or append, let's assume replace for now.
                    onUpdateThread(thread.id, {
                        messages: [...newMessages, { ...modelMsg, text: chunk }]
                    });
                }
            );
        } catch (e) {
            onUpdateThread(thread.id, { messages: [...newMessages, { ...modelMsg, text: "**Error:** Failed to generate response." }] });
        } finally {
            setIsGenerating(false);
            setTimeout(() => textareaRef.current?.focus(), 100);
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newAtts: Attachment[] = [];
            const files = Array.from(e.target.files) as File[];
            for (const file of files) {
                try { newAtts.push({ mimeType: file.type, data: await fileToBase64(file) }); } catch (e) { }
            }
            setAttachments(prev => [...prev, ...newAtts]);
        }
    };

    const activeStyle = libraries.styles.find(s => s.id === thread.speakingStyleId);
    const secondaryName = thread.secondaryModelId
        ? (allCustomGpts.find(g => g.id === thread.secondaryModelId)?.name || thread.secondaryModelId)
        : null;

    // Selector Component
    const ModelSelector = ({ type }: { type: 'primary' | 'secondary' }) => (
        <div className="absolute top-full left-0 mt-2 w-64 bg-[#252525] border border-gray-700 rounded-xl shadow-2xl p-1 z-50 animate-fade-in">
            <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">System Models</div>
            {[GeminiModel.FLASH, GeminiModel.PRO, GeminiModel.FLASH_LITE].map(m => (
                <button key={m}
                    onClick={() => {
                        if (type === 'primary') onUpdateThread(thread.id, { model: m });
                        else onUpdateThread(thread.id, { secondaryModelId: m });
                        setShowModelSelector(null);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/10 rounded flex items-center gap-2"
                >
                    <Bot size={12} /> {m}
                </button>
            ))}

            <div className="border-t border-gray-700 my-1"></div>
            <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">My Assistants</div>
            {allCustomGpts.length === 0 && <div className="px-3 py-1 text-xs text-gray-600 italic">No custom assistants.</div>}
            {allCustomGpts.map(g => (
                <button key={g.id}
                    onClick={() => {
                        if (type === 'primary') onUpdateThread(thread.id, { customGptId: g.id, model: g.model });
                        else onUpdateThread(thread.id, { secondaryModelId: g.id });
                        setShowModelSelector(null);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/10 rounded flex items-center gap-2"
                >
                    <Sparkles size={12} className="text-amber-500" /> {g.name}
                </button>
            ))}
        </div>
    );

    return (
        <div className="flex flex-col h-full relative bg-[#1a1a1a] font-sans text-gray-200">
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-6 bg-[#1a1a1a]/95 backdrop-blur sticky top-0 z-10 border-b border-gray-800">
                <div className="flex items-center gap-2">
                    {/* Primary Model Pill */}
                    <div className="relative group">
                        <button onClick={() => setShowModelSelector(showModelSelector === 'primary' ? null : 'primary')} className="flex items-center gap-2 text-xs font-medium text-gray-200 hover:text-white px-3 py-1.5 rounded-full bg-gray-800 border border-gray-700 hover:border-amber-500/50 transition-all shadow-sm">
                            {customGpt ? <Sparkles size={14} className="text-amber-500" /> : <Bot size={14} className="text-gray-400" />}
                            {customGpt?.name || thread.model || settings.defaultModel}
                            <ChevronDown size={12} className="opacity-50" />
                        </button>
                        {showModelSelector === 'primary' && <ModelSelector type="primary" />}
                    </div>

                    <span className="text-gray-600 text-xs">+</span>

                    {/* Secondary Model Pill or Add Button */}
                    {thread.secondaryModelId ? (
                        <div className="relative group">
                            <button onClick={() => setShowModelSelector(showModelSelector === 'secondary' ? null : 'secondary')} className="flex items-center gap-2 text-xs font-medium text-gray-200 hover:text-white pl-3 pr-2 py-1.5 rounded-full bg-gray-800 border border-dashed border-amber-500/40 hover:border-amber-500 transition-all shadow-sm">
                                <Bot size={14} className="text-amber-500" />
                                {secondaryName}
                                <div onClick={(e) => { e.stopPropagation(); onUpdateThread(thread.id, { secondaryModelId: null }); }} className="p-0.5 hover:bg-white/10 rounded-full"><X size={12} /></div>
                            </button>
                            {showModelSelector === 'secondary' && <ModelSelector type="secondary" />}
                        </div>
                    ) : (
                        <div className="relative">
                            <button onClick={() => setShowModelSelector(showModelSelector === 'secondary' ? null : 'secondary')} className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-amber-500 px-3 py-1.5 rounded-full border border-dashed border-gray-700 hover:border-amber-500/30 transition-all">
                                Add Model
                            </button>
                            {showModelSelector === 'secondary' && <ModelSelector type="secondary" />}
                        </div>
                    )}
                </div>

                <button onClick={() => downloadThreadAsMarkdown(thread)} className="text-gray-500 hover:text-amber-500 p-2 rounded-full hover:bg-gray-800 transition-colors" title="Download Chat">
                    <Download size={18} />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
                <div className="max-w-3xl mx-auto space-y-6 pb-32 pt-4">
                    {thread.messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 opacity-50 select-none">
                            <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mb-4"><Bot size={32} className="text-amber-500" /></div>
                            <h2 className="text-2xl font-serif text-gray-200 mb-2">How can I help, {settings.userProfile.name}?</h2>
                            <p className="text-sm text-gray-500">Select a model or start typing to begin.</p>
                        </div>
                    )}

                    {thread.messages.map(msg => (
                        <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <div className={`max-w-[85%] ${msg.role === 'user' ? 'bg-amber-500/10 rounded-2xl rounded-tr-sm px-5 py-3 border border-amber-500/20' : ''}`}>
                                {msg.attachments && msg.attachments.length > 0 && (
                                    <div className="flex gap-2 mb-2 flex-wrap">
                                        {msg.attachments.map((att, i) => (
                                            <img key={i} src={`data:${att.mimeType};base64,${att.data}`} className="h-32 rounded-lg border border-white/10" alt="" />
                                        ))}
                                    </div>
                                )}
                                <div className={`prose prose-invert prose-sm max-w-none leading-relaxed ${msg.role === 'model' || msg.role === 'assistant' ? 'font-serif text-[16px] text-gray-300' : 'text-gray-200'}`}>
                                    {msg.text ? <ReactMarkdown>{msg.text}</ReactMarkdown> : <span className="flex items-center gap-2 text-gray-500"><Sparkles size={14} className="animate-spin" /> Thinking...</span>}
                                </div>
                            </div>
                        </div>
                    ))}
                    <div ref={bottomRef} />
                </div>
            </div>

            {/* Input Island */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#1a1a1a] via-[#1a1a1a] to-transparent z-20">
                <div className={`max-w-3xl mx-auto bg-gray-800/80 backdrop-blur rounded-2xl shadow-2xl border transition-all duration-200 flex flex-col ${focused ? 'border-amber-500/50 ring-1 ring-amber-500/10' : 'border-gray-700'}`}>

                    {/* Toolbar */}
                    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/50 bg-black/20">
                        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                            {[
                                { id: 'code', icon: Code, label: 'Code' },
                                { id: 'write', icon: PenTool, label: 'Write' },
                                { id: 'image', icon: ImageIcon, label: 'Image' },
                                { id: 'character', icon: Bot, label: 'Character' },
                                { id: 'plot', icon: BookOpen, label: 'Plot' },
                                { id: 'research', icon: BookOpen, label: 'Research' }
                            ].map(b => (
                                <button
                                    key={b.id}
                                    onClick={() => setActiveBuilderMode(activeBuilderMode === b.id ? 'none' : b.id as BuilderMode)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${activeBuilderMode === b.id ? 'bg-amber-600 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                                >
                                    <b.icon size={12} /> {b.label}
                                </button>
                            ))}
                        </div>

                        <div className="relative">
                            <button onClick={() => setShowStyleMenu(!showStyleMenu)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-amber-500 transition-colors">
                                <Mic size={12} /> {activeStyle?.name || 'Style'}
                            </button>
                            {showStyleMenu && (
                                <div className="absolute bottom-full right-0 mb-2 w-48 bg-[#252525] border border-gray-700 rounded-xl shadow-xl p-1 z-50">
                                    <div className="px-3 py-2 text-[10px] text-gray-500 font-bold uppercase">Speaking Style</div>
                                    <div className="max-h-40 overflow-y-auto">
                                        <div onClick={() => { onUpdateThread(thread.id, { speakingStyleId: null }); setShowStyleMenu(false); }} className="px-3 py-2 text-xs text-gray-300 hover:bg-white/5 rounded cursor-pointer">Default</div>
                                        {libraries.styles.map(s => (
                                            <div key={s.id} onClick={() => { onUpdateThread(thread.id, { speakingStyleId: s.id }); setShowStyleMenu(false); }} className={`px-3 py-2 text-xs hover:bg-white/5 rounded cursor-pointer ${thread.speakingStyleId === s.id ? 'text-amber-500' : 'text-gray-300'}`}>
                                                {s.name}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Text Area */}
                    <div className="relative p-3">
                        {attachments.length > 0 && (
                            <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
                                {attachments.map((att, i) => (
                                    <div key={i} className="relative group shrink-0">
                                        <img src={`data:${att.mimeType};base64,${att.data}`} className="h-12 w-12 rounded object-cover border border-white/10 opacity-80" alt="" />
                                        <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="absolute -top-1 -right-1 bg-gray-700 rounded-full text-red-400 p-0.5"><X size={10} /></button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onFocus={() => setFocused(true)}
                            onBlur={() => setFocused(false)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                            placeholder={activeBuilderMode !== 'none' ? `Enter prompt for ${activeBuilderMode} builder...` : "Message..."}
                            className="w-full bg-transparent text-gray-200 placeholder-gray-600 resize-none outline-none text-[15px]"
                            rows={1}
                        />

                        <div className="flex justify-between items-center mt-2">
                            <button onClick={() => fileInputRef.current?.click()} className="text-gray-500 hover:text-white transition-colors"><Paperclip size={18} /></button>
                            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} multiple />

                            <button
                                onClick={handleSend}
                                disabled={!input.trim() && attachments.length === 0}
                                className={`p-2 rounded-lg transition-all ${input.trim() || attachments.length ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'bg-white/5 text-gray-600'}`}
                            >
                                {isGenerating ? <Sparkles size={16} className="animate-spin" /> : <Send size={16} />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
