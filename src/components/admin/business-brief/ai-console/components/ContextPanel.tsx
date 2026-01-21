
import React from 'react';

interface ContextPanelProps {
    businessContext: any;
    visible: boolean;
}

export const ContextPanel: React.FC<ContextPanelProps> = ({ businessContext, visible }) => {
    if (!visible || !businessContext) return null;

    return (
        <div className="p-3 border-b border-gray-700 bg-gray-800/30">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="bg-gray-900/50 rounded p-2">
                    <p className="text-xs text-gray-500">MRR</p>
                    <p className="text-lg font-bold text-green-400">
                        ${businessContext.mrr?.toLocaleString() || 0}
                    </p>
                </div>
                <div className="bg-gray-900/50 rounded p-2">
                    <p className="text-xs text-gray-500">Clients</p>
                    <p className="text-lg font-bold text-blue-400">
                        {businessContext.clients_count || 0}
                    </p>
                </div>
                <div className="bg-gray-900/50 rounded p-2">
                    <p className="text-xs text-gray-500">Hot Leads</p>
                    <p className="text-lg font-bold text-amber-400">
                        {businessContext.hot_leads || 0}
                    </p>
                </div>
                <div className="bg-gray-900/50 rounded p-2">
                    <p className="text-xs text-gray-500">Context Items</p>
                    <p className="text-lg font-bold text-purple-400">
                        {businessContext.context_items || 0}
                    </p>
                </div>
            </div>
        </div>
    );
};
