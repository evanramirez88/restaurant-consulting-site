
import React, { useState, useRef } from 'react';
import { X, Trash2, Plus, Eye, EyeOff, User, Network, Sliders, Library, Upload } from 'lucide-react';
import { Settings, Libraries, GeminiModel, Connection, Thread } from '../types';
import { generateId } from '../utils/helpers';
import { parseChatGPTExport } from '../utils/importers';

interface Props {
    settings: Settings;
    libraries: Libraries;
    onSave: (s: Settings) => void;
    onUpdateLibraries: (l: Libraries) => void;
    onClose: () => void;
    onImportData?: (threads: Thread[]) => void;
}

type Tab = 'general' | 'user' | 'connections' | 'libraries' | 'import';

export const SettingsModal: React.FC<Props> = ({ settings, libraries, onSave, onUpdateLibraries, onClose, onImportData }) => {
    const [tab, setTab] = useState<Tab>('user');
    const [localSettings, setLocalSettings] = useState(settings);
    const [newConnection, setNewConnection] = useState<Partial<Connection>>({ type: 'model_provider' });
    const [showKey, setShowKey] = useState<Record<string, boolean>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDeleteLibraryItem = (key: keyof Libraries, id: string) => {
        // @ts-ignore
        const updatedList = libraries[key].filter(i => i.id !== id);
        onUpdateLibraries({ ...libraries, [key]: updatedList });
    };

    const addConnection = () => {
        if (!newConnection.name || !newConnection.apiKey) return;
        const conn: Connection = {
            id: generateId(),
            name: newConnection.name || 'Connection',
            type: newConnection.type || 'model_provider',
            apiKey: newConnection.apiKey || '',
            baseUrl: newConnection.baseUrl,
            description: newConnection.description
        };
        setLocalSettings(p => ({ ...p, connections: [...p.connections, conn] }));
        setNewConnection({ type: 'model_provider', name: '', apiKey: '', baseUrl: '', description: '' });
    };

    const removeConnection = (id: string) => {
        setLocalSettings(p => ({ ...p, connections: p.connections.filter(c => c.id !== id) }));
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !onImportData) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const content = ev.target?.result as string;
            if (content) {
                const importedThreads = parseChatGPTExport(content);
                if (importedThreads.length > 0) {
                    if (confirm(`Found ${importedThreads.length} chats. Import them?`)) {
                        onImportData(importedThreads);
                        onClose();
                    }
                } else {
                    alert("Could not parse chats from this file. Ensure it is a valid conversations.json");
                }
            }
        };
        reader.readAsText(file);
    };

    const TabButton = ({ id, label, icon: Icon }: { id: Tab, label: string, icon: any }) => (
        <button
            onClick={() => setTab(id)}
            className={`flex items-center gap-3 w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors ${tab === id ? 'bg-amber-600 text-white shadow-lg' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
        >
            <Icon size={16} /> {label}
        </button>
    );

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
            <div className="bg-[#1e1e1e] w-full max-w-4xl h-[80vh] rounded-2xl border border-white/10 shadow-2xl flex overflow-hidden">

                {/* Sidebar Tabs */}
                <div className="w-64 bg-[#252525] border-r border-[#333] p-4 flex flex-col gap-2">
                    <h2 className="text-lg font-serif font-bold text-gray-200 px-4 mb-4">Settings</h2>
                    <TabButton id="user" label="User Profile" icon={User} />
                    <TabButton id="connections" label="Connections & APIs" icon={Network} />
                    <TabButton id="general" label="General" icon={Sliders} />
                    <TabButton id="libraries" label="Libraries" icon={Library} />
                    <TabButton id="import" label="Import Data" icon={Upload} />
                </div>

                {/* Content Area */}
                <div className="flex-1 flex flex-col h-full bg-[#1e1e1e] text-gray-300">
                    <div className="flex items-center justify-between p-6 border-b border-[#333]">
                        <h3 className="text-xl font-semibold text-white capitalize">{tab.replace('_', ' ')}</h3>
                        <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8">

                        {/* USER TAB */}
                        {tab === 'user' && (
                            <div className="space-y-8 max-w-2xl">
                                <div className="space-y-4">
                                    <h4 className="text-sm font-bold text-amber-500 uppercase tracking-wider">Profile</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Display Name</label>
                                            <input
                                                value={localSettings.userProfile.name}
                                                onChange={e => setLocalSettings({ ...localSettings, userProfile: { ...localSettings.userProfile, name: e.target.value } })}
                                                className="w-full bg-[#2d2d2d] border border-white/10 rounded-lg p-2.5 text-white focus:border-amber-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">About You (Context for AI)</label>
                                        <textarea
                                            value={localSettings.userProfile.about}
                                            onChange={e => setLocalSettings({ ...localSettings, userProfile: { ...localSettings.userProfile, about: e.target.value } })}
                                            className="w-full h-20 bg-[#2d2d2d] border border-white/10 rounded-lg p-2.5 text-white text-sm focus:border-amber-500 outline-none resize-none"
                                            placeholder="E.g., I am a software engineer living in Tokyo..."
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4 border-t border-white/5 pt-6">
                                    <h4 className="text-sm font-bold text-amber-500 uppercase tracking-wider">System Instructions</h4>
                                    <p className="text-xs text-gray-500">These instructions are applied to every chat by default.</p>
                                    <textarea
                                        value={localSettings.userProfile.customInstructions}
                                        onChange={e => setLocalSettings({ ...localSettings, userProfile: { ...localSettings.userProfile, customInstructions: e.target.value } })}
                                        className="w-full h-40 bg-[#2d2d2d] border border-white/10 rounded-lg p-4 text-sm font-mono focus:border-amber-500 outline-none"
                                    />
                                </div>
                            </div>
                        )}

                        {/* CONNECTIONS TAB */}
                        {tab === 'connections' && (
                            <div className="space-y-8">
                                <div className="bg-[#2d2d2d] rounded-xl border border-white/5 p-6">
                                    <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Plus size={16} /> Add New Connection</h4>
                                    <div className="grid grid-cols-12 gap-4 mb-4">
                                        <div className="col-span-3">
                                            <input placeholder="Name (e.g. OpenAI)" value={newConnection.name || ''} onChange={e => setNewConnection({ ...newConnection, name: e.target.value })} className="w-full bg-[#1e1e1e] border border-white/10 rounded p-2 text-sm outline-none" />
                                        </div>
                                        <div className="col-span-3">
                                            <select value={newConnection.type} onChange={e => setNewConnection({ ...newConnection, type: e.target.value as any })} className="w-full bg-[#1e1e1e] border border-white/10 rounded p-2 text-sm outline-none text-gray-300">
                                                <option value="model_provider">Model Provider</option>
                                                <option value="tool">Tool / API</option>
                                                <option value="data_source">Data Source</option>
                                                <option value="other">Other</option>
                                            </select>
                                        </div>
                                        <div className="col-span-4">
                                            <input type="password" placeholder="API Key" value={newConnection.apiKey || ''} onChange={e => setNewConnection({ ...newConnection, apiKey: e.target.value })} className="w-full bg-[#1e1e1e] border border-white/10 rounded p-2 text-sm outline-none" />
                                        </div>
                                        <div className="col-span-2">
                                            <button onClick={addConnection} disabled={!newConnection.name || !newConnection.apiKey} className="w-full bg-amber-600 text-white rounded py-2 text-sm font-medium disabled:opacity-50">Add</button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4">
                                        <input placeholder="Base URL (Optional)" value={newConnection.baseUrl || ''} onChange={e => setNewConnection({ ...newConnection, baseUrl: e.target.value })} className="w-full bg-[#1e1e1e] border border-white/10 rounded p-2 text-sm outline-none" />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Active Connections</h4>
                                    {localSettings.connections.length === 0 && <div className="text-gray-500 text-sm italic">No connections configured.</div>}
                                    {localSettings.connections.map(conn => (
                                        <div key={conn.id} className="flex items-center justify-between bg-[#2d2d2d] border border-white/10 rounded-lg p-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-amber-500">
                                                    {conn.type === 'model_provider' ? <Network size={20} /> : <Library size={20} />}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-white">{conn.name}</div>
                                                    <div className="text-xs text-gray-500 uppercase">{conn.type.replace('_', ' ')}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center bg-[#1e1e1e] rounded px-3 py-1 border border-white/5">
                                                    <span className="text-xs font-mono text-gray-400 mr-2">{showKey[conn.id] ? conn.apiKey : '••••••••••••••••'}</span>
                                                    <button onClick={() => setShowKey(p => ({ ...p, [conn.id]: !p[conn.id] }))} className="text-gray-500 hover:text-white">
                                                        {showKey[conn.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                                                    </button>
                                                </div>
                                                <button onClick={() => removeConnection(conn.id)} className="p-2 text-gray-500 hover:text-red-400 bg-white/5 rounded-lg hover:bg-white/10"><Trash2 size={16} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* GENERAL TAB */}
                        {tab === 'general' && (
                            <div className="space-y-6 max-w-2xl">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Default Model</label>
                                    <select value={localSettings.defaultModel} onChange={e => setLocalSettings({ ...localSettings, defaultModel: e.target.value as GeminiModel })} className="w-full bg-[#2d2d2d] border border-white/10 rounded p-2 text-white">
                                        <option value={GeminiModel.FLASH}>Gemini Flash</option>
                                        <option value={GeminiModel.PRO}>Gemini Pro</option>
                                    </select>
                                    <p className="text-xs text-gray-500 mt-2">This model will be selected by default for new chats unless a CustomGPT is used.</p>
                                </div>
                                <div>
                                    <label className="flex items-center gap-3 p-4 border border-white/10 rounded-lg cursor-pointer hover:bg-white/5">
                                        <input type="checkbox" checked={localSettings.disableImages} onChange={e => setLocalSettings({ ...localSettings, disableImages: e.target.checked })} className="rounded bg-[#2d2d2d] border-white/20" />
                                        <div>
                                            <div className="text-sm font-medium text-white">Disable Image Generation</div>
                                            <div className="text-xs text-gray-500">Hides image builder tools and prevents model from generating visuals.</div>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        )}

                        {/* LIBRARIES TAB */}
                        {tab === 'libraries' && (
                            <div className="space-y-6">
                                {Object.entries(libraries).map(([key, rawItems]) => {
                                    const items = rawItems as any[];
                                    return (
                                        <div key={key} className="border-b border-white/5 pb-6 last:border-0">
                                            <h3 className="text-sm font-bold text-amber-500 uppercase mb-4 flex items-center gap-2">
                                                {key} <span className="text-xs bg-white/10 text-gray-400 px-2 py-0.5 rounded-full">{items.length}</span>
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {items.length === 0 && <div className="text-xs text-gray-600 italic">No items in library.</div>}
                                                {items.map((item: any) => (
                                                    <div key={item.id} className="flex justify-between items-start bg-[#2d2d2d] p-3 rounded-lg border border-white/5 group hover:border-white/10">
                                                        <div className="overflow-hidden">
                                                            <div className="text-sm text-gray-200 font-medium truncate">{item.name}</div>
                                                            <div className="text-[10px] text-gray-500 line-clamp-2 mt-1">{item.content}</div>
                                                        </div>
                                                        <button onClick={() => handleDeleteLibraryItem(key as keyof Libraries, item.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-500 hover:text-red-400 hover:bg-white/5 rounded transition-all"><Trash2 size={14} /></button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {/* IMPORT TAB */}
                        {tab === 'import' && (
                            <div className="space-y-6 max-w-2xl">
                                <div className="border-2 border-dashed border-white/10 rounded-xl p-10 flex flex-col items-center justify-center text-center hover:bg-white/5 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                    <Upload size={48} className="text-amber-500 mb-4" />
                                    <h3 className="text-lg font-medium text-white mb-2">Import Data</h3>
                                    <p className="text-sm text-gray-500 mb-4">Upload a <code>conversations.json</code> file from ChatGPT export.</p>
                                    <button className="bg-[#2d2d2d] text-white px-4 py-2 rounded border border-white/10 hover:bg-surface-hover">Select File</button>
                                    <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
                                </div>
                                <div className="bg-blue-500/10 text-blue-200 text-xs p-4 rounded-lg border border-blue-500/20">
                                    <strong>Note:</strong> Importing large files may take a few seconds. This will attempt to map ChatGPT conversations into CloneGPT Threads.
                                </div>
                            </div>
                        )}

                    </div>

                    <div className="p-6 border-t border-[#333] flex justify-end bg-[#2d2d2d]">
                        <button onClick={() => { onSave(localSettings); onClose(); }} className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium shadow-lg transition-colors">Save Changes</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
