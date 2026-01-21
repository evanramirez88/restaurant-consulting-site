
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatInterface } from './components/ChatInterface';
import { SettingsModal } from './components/SettingsModal';
import { ContextEditor } from './components/ContextEditor';
import { Folder, Thread, CustomGPT, Settings, Libraries, GeminiModel, Message } from './types';
import { generateId } from './utils/helpers';

// Default Data Stubs
const DEFAULT_SETTINGS: Settings = {
    defaultModel: GeminiModel.FLASH,
    temperature: 0.7,
    disableImages: false,
    userProfile: { name: 'Admin', about: '', customInstructions: '' },
    globalFiles: [],
    connections: []
};

const DEFAULT_LIBRARIES: Libraries = {
    styles: [{ id: '1', name: 'Professional', content: 'Be professional and concise.' }],
    characters: [],
    plots: [],
    prompts: [],
    voices: []
};

export default function BusinessBriefAIConsole() {
    // --- State ---
    const [folders, setFolders] = useState<Folder[]>([]);
    const [threads, setThreads] = useState<Thread[]>([]);
    const [customGpts, setCustomGpts] = useState<CustomGPT[]>([]);
    const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

    const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
    const [libraries, setLibraries] = useState<Libraries>(DEFAULT_LIBRARIES);

    // Modals
    const [showSettings, setShowSettings] = useState(false);
    const [editorState, setEditorState] = useState<{
        isOpen: boolean;
        type: 'gpt' | 'project';
        data?: any;
    }>({ isOpen: false, type: 'gpt' });

    // Persistence (Lazy Load) - In production, this should act sync with Backend
    useEffect(() => {
        const savedThreads = localStorage.getItem('millstone_threads');
        if (savedThreads) setThreads(JSON.parse(savedThreads));

        const savedFolders = localStorage.getItem('millstone_folders');
        if (savedFolders) setFolders(JSON.parse(savedFolders));

        const savedGpts = localStorage.getItem('millstone_gpts');
        if (savedGpts) setCustomGpts(JSON.parse(savedGpts));

        const savedSettings = localStorage.getItem('millstone_settings');
        if (savedSettings) setSettings(JSON.parse(savedSettings));
    }, []);

    // Save on Change
    useEffect(() => localStorage.setItem('millstone_threads', JSON.stringify(threads)), [threads]);
    useEffect(() => localStorage.setItem('millstone_folders', JSON.stringify(folders)), [folders]);
    useEffect(() => localStorage.setItem('millstone_gpts', JSON.stringify(customGpts)), [customGpts]);
    useEffect(() => localStorage.setItem('millstone_settings', JSON.stringify(settings)), [settings]);

    // --- Handlers ---
    const handleCreateThread = (gptId?: string, folderId?: string) => {
        const id = generateId();
        const gpt = customGpts.find(g => g.id === gptId);

        // Check if there is an empty new chat already in this context?
        // For now, just create new.

        const newThread: Thread = {
            id,
            title: 'New Chat',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            folderId: folderId || null,
            customGptId: gptId || null,
            model: gpt ? gpt.model : settings.defaultModel,
            messages: [],
            speakingStyleId: null
        };

        setThreads(prev => [newThread, ...prev]);
        setActiveThreadId(id);
    };

    const handleUpdateThread = (id: string, updates: Partial<Thread>) => {
        setThreads(prev => prev.map(t => t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t));
    };

    const handleSaveToLibrary = (type: 'style' | 'character' | 'plot', content: string) => {
        const item = { id: generateId(), name: `Saved ${type} ${Date.now()}`, content };
        // @ts-ignore
        setLibraries(prev => ({ ...prev, [type + 's']: [...prev[type + 's'], item] })); // pluralize
    };

    const activeThread = threads.find(t => t.id === activeThreadId);
    const activeProject = activeThread?.folderId ? folders.find(f => f.id === activeThread.folderId) : undefined;
    const activeGpt = activeThread?.customGptId ? customGpts.find(g => g.id === activeThread.customGptId) : undefined;

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-[#121212] text-white font-sans">
            {/* Sidebar (280px) */}
            <div className="w-[280px] flex-shrink-0">
                <Sidebar
                    folders={folders}
                    threads={threads}
                    customGpts={customGpts}
                    activeThreadId={activeThreadId}
                    onSelectThread={setActiveThreadId}
                    onCreateThread={handleCreateThread}
                    onCreateFolder={() => setEditorState({ isOpen: true, type: 'project' })}
                    onEditFolder={(f) => setEditorState({ isOpen: true, type: 'project', data: f })}
                    onCreateGpt={() => setEditorState({ isOpen: true, type: 'gpt' })}
                    onEditGpt={(g) => setEditorState({ isOpen: true, type: 'gpt', data: g })}
                    onDeleteGpt={(id) => setCustomGpts(prev => prev.filter(g => g.id !== id))}
                    onMoveGpt={(id, fId) => setCustomGpts(prev => prev.map(g => g.id === id ? { ...g, folderId: fId } : g))}
                    onDeleteThread={(id) => { setThreads(prev => prev.filter(t => t.id !== id)); if (activeThreadId === id) setActiveThreadId(null); }}
                    onMoveThread={(id, fId) => setThreads(prev => prev.map(t => t.id === id ? { ...t, folderId: fId } : t))}
                    onOpenSettings={() => setShowSettings(true)}
                />
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#0f0f0f]">
                {activeThread ? (
                    <ChatInterface
                        thread={activeThread}
                        settings={settings}
                        libraries={libraries}
                        project={activeProject}
                        customGpt={activeGpt}
                        allCustomGpts={customGpts}
                        onUpdateThread={handleUpdateThread}
                        onSaveToLibrary={handleSaveToLibrary}
                    />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                        <div className="w-16 h-16 bg-[#1e1e1e] rounded-2xl flex items-center justify-center mb-4 border border-white/5">
                            <span className="font-serif text-2xl text-amber-500 font-bold">MI</span>
                        </div>
                        <p className="text-sm">Select a chat or create new intelligence to begin.</p>
                    </div>
                )}
            </div>

            {/* Modals */}
            {showSettings && (
                <SettingsModal
                    settings={settings}
                    libraries={libraries}
                    onSave={setSettings}
                    onUpdateLibraries={setLibraries}
                    onClose={() => setShowSettings(false)}
                    onImportData={(newThreads) => setThreads(prev => [...newThreads, ...prev])}
                />
            )}

            {editorState.isOpen && (
                <ContextEditor
                    type={editorState.type}
                    initialData={editorState.data}
                    libraries={libraries}
                    onClose={() => setEditorState({ isOpen: false, type: 'gpt' })}
                    onSave={(data) => {
                        if (editorState.type === 'gpt') {
                            setCustomGpts(prev => {
                                const exists = prev.find(g => g.id === data.id);
                                return exists ? prev.map(g => g.id === data.id ? data : g) : [...prev, data];
                            });
                        } else {
                            setFolders(prev => {
                                const exists = prev.find(f => f.id === data.id);
                                return exists ? prev.map(f => f.id === data.id ? data : f) : [...prev, data];
                            });
                        }
                        setEditorState({ isOpen: false, type: 'gpt' });
                    }}
                />
            )}
        </div>
    );
}
