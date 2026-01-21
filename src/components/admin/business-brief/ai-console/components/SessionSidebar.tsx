
import React from 'react';
import { Plus, Settings } from 'lucide-react';
import { Session, ConsoleConfig } from '../types';

interface SessionSidebarProps {
    sessions: Session[];
    activeSessionId: string | null;
    config: ConsoleConfig | null;
    selectedAssistant: string | null;
    selectedModel: string | null;
    selectedStyle: string | null;
    onSessionSelect: (id: string) => void;
    onCreateSession: () => void;
    onAssistantChange: (id: string | null) => void;
    onModelChange: (id: string | null) => void;
    onStyleChange: (id: string | null) => void;
}

export const SessionSidebar: React.FC<SessionSidebarProps> = ({
    sessions,
    activeSessionId,
    config,
    selectedAssistant,
    selectedModel,
    selectedStyle,
    onSessionSelect,
    onCreateSession,
    onAssistantChange,
    onModelChange,
    onStyleChange
}) => {
    return (
        <div className="admin-card p-4 lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-400">Sessions</h3>
                <button
                    onClick={onCreateSession}
                    className="p-1.5 bg-amber-500/20 text-amber-400 rounded hover:bg-amber-500/30"
                    title="New Session"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {sessions.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">No sessions yet</p>
                ) : (
                    sessions.slice(0, 10).map(session => (
                        <button
                            key={session.id}
                            onClick={() => onSessionSelect(session.id)}
                            className={`
                w-full text-left p-2 rounded-lg text-sm transition-all
                ${activeSessionId === session.id
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
                                }
              `}
                        >
                            <p className="font-medium truncate">{session.title}</p>
                            <p className="text-xs text-gray-500">
                                {new Date(session.created_at).toLocaleDateString()}
                            </p>
                        </button>
                    ))
                )}
            </div>

            {/* Quick Settings */}
            <div className="mt-4 pt-4 border-t border-gray-700 space-y-3">
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Assistant</label>
                    <select
                        value={selectedAssistant || ''}
                        onChange={(e) => onAssistantChange(e.target.value || null)}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white"
                    >
                        <option value="">Default</option>
                        {config?.assistants?.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-xs text-gray-500 mb-1">Model</label>
                    <select
                        value={selectedModel || ''}
                        onChange={(e) => onModelChange(e.target.value || null)}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white"
                    >
                        <option value="">Default</option>
                        {config?.models?.map(m => (
                            <option key={m.id} value={m.id}>{m.display_name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-xs text-gray-500 mb-1">Style</label>
                    <select
                        value={selectedStyle || ''}
                        onChange={(e) => onStyleChange(e.target.value || null)}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white"
                    >
                        <option value="">Default</option>
                        {config?.styles?.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
};
