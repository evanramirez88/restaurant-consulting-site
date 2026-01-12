import React, { useState, useEffect } from 'react';
import {
  Brain, CheckSquare, Upload, Settings, Search,
  Loader2, RefreshCw, TrendingUp, AlertCircle
} from 'lucide-react';
import FactTriageQueue from './FactTriageQueue';
import UniversalDataImport from './UniversalDataImport';
import AIProviderConfig from './AIProviderConfig';
import ClientResearchPanel from './ClientResearchPanel';

type IntelSubTab = 'triage' | 'import' | 'providers' | 'research';

interface IntelStats {
  total_clients: number;
  active_portals: number;
  pending_facts: number;
  ai_calls_today: number;
  facts_approved_today: number;
  facts_rejected_today: number;
}

interface AIProvider {
  id: string;
  name: string;
  provider_type: string;
  model_id: string;
  is_active: boolean;
  is_default: boolean;
  total_requests: number;
  total_cost: number;
}

const ClientIntelligenceTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<IntelSubTab>('triage');
  const [stats, setStats] = useState<IntelStats | null>(null);
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/intelligence');
      const result = await response.json();

      if (result.success) {
        setStats(result.stats);
        setProviders(result.providers || []);
      } else {
        setError(result.error || 'Failed to load intelligence data');
      }
    } catch (err) {
      setError('Network error loading intelligence data');
      console.error('Intelligence load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const subTabs: { id: IntelSubTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'triage',
      label: 'Fact Triage',
      icon: <CheckSquare className="w-4 h-4" />,
      badge: stats?.pending_facts || 0
    },
    { id: 'import', label: 'Import Data', icon: <Upload className="w-4 h-4" /> },
    { id: 'providers', label: 'AI Providers', icon: <Settings className="w-4 h-4" /> },
    { id: 'research', label: 'Research', icon: <Search className="w-4 h-4" /> },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Brain className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-white">Client Intelligence</h2>
              <p className="text-sm text-gray-400">AI-powered research and data enrichment</p>
            </div>
          </div>
          <button
            onClick={loadDashboardData}
            className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-900/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-white">{stats?.total_clients || 0}</div>
            <div className="text-sm text-gray-400">Total Clients</div>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-amber-400">{stats?.pending_facts || 0}</div>
            <div className="text-sm text-gray-400">Pending Facts</div>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-400">{stats?.facts_approved_today || 0}</div>
            <div className="text-sm text-gray-400">Approved Today</div>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-400">{stats?.ai_calls_today || 0}</div>
            <div className="text-sm text-gray-400">AI Calls Today</div>
          </div>
        </div>
      </div>

      {/* Sub-Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-700 pb-2 overflow-x-auto">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors whitespace-nowrap ${
              activeSubTab === tab.id
                ? 'bg-gray-800 text-amber-400 border-b-2 border-amber-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Sub-Tab Content */}
      {activeSubTab === 'triage' && (
        <FactTriageQueue onRefresh={loadDashboardData} />
      )}
      {activeSubTab === 'import' && (
        <UniversalDataImport onImportComplete={loadDashboardData} />
      )}
      {activeSubTab === 'providers' && (
        <AIProviderConfig providers={providers} onUpdate={loadDashboardData} />
      )}
      {activeSubTab === 'research' && (
        <ClientResearchPanel />
      )}
    </div>
  );
};

export default ClientIntelligenceTab;
