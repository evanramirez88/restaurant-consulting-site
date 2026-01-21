
import React from 'react';
import { Plus, Bot, AlertTriangle } from 'lucide-react';
import { ConsoleConfig, AIAssistant } from '../types';

interface AssistantsPanelProps {
    config: ConsoleConfig | null;
    onSelectAssistant: (id: string) => void;
    onCreateAssistant: () => void;
}

export const AssistantsPanel: React.FC<AssistantsPanelProps> = ({
    config,
    onSelectAssistant,
    onCreateAssistant
}) => {
    return (
        <div className="admin-card p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-white">AI Assistants</h3>
                <button
                    onClick={onCreateAssistant}
                    className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg text-sm hover:bg-amber-500/30"
                >
                    <Plus className="w-4 h-4" />
                    Create Assistant
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {config?.assistants?.map(assistant => (
                    <div
                        key={assistant.id}
                        className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 hover:border-amber-500/30 transition-all"
                    >
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-purple-500/20 rounded-lg">
                                <Bot className="w-5 h-5 text-purple-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-medium text-white truncate">{assistant.name}</h4>
                                    {assistant.is_default && (
                                        <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded">Default</span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-400 mt-1 line-clamp-2">{assistant.description}</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mt-3">
                            {assistant.include_business_context && (
                                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">Business</span>
                            )}
                            {assistant.include_lead_context && (
                                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">Leads</span>
                            )}
                            {assistant.include_personal_context && (
                                <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    Personal
                                </span>
                            )}
                        </div>

                        <button
                            onClick={() => onSelectAssistant(assistant.id)}
                            className="w-full mt-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600 hover:text-white"
                        >
                            Use This Assistant
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};
