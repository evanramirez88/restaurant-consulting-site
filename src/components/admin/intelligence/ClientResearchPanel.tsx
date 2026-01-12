import React, { useState, useEffect } from 'react';
import {
  Search, Building2, Globe, Sparkles, Loader2, CheckCircle,
  AlertCircle, X, Play, Clock, FileText, ExternalLink
} from 'lucide-react';

interface Client {
  id: string;
  name: string;
  company: string;
}

interface ResearchSession {
  id: string;
  title: string;
  client_id: string;
  client_name?: string;
  research_type: string;
  status: string;
  facts_found: number;
  facts_approved: number;
  started_at: number | null;
  completed_at: number | null;
  summary: string | null;
}

const RESEARCH_TYPES = [
  { value: 'discovery', label: 'Discovery', desc: 'Find basic info about the restaurant' },
  { value: 'enrichment', label: 'Enrichment', desc: 'Add details to existing data' },
  { value: 'competitive', label: 'Competitive', desc: 'Analyze competitors' },
  { value: 'verification', label: 'Verification', desc: 'Verify existing data' },
];

const ClientResearchPanel: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [sessions, setSessions] = useState<ResearchSession[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [researchType, setResearchType] = useState<string>('discovery');
  const [customQuery, setCustomQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [clientsRes, sessionsRes] = await Promise.all([
        fetch('/api/admin/clients'),
        fetch('/api/admin/intelligence/research')
      ]);

      const clientsData = await clientsRes.json();
      const sessionsData = await sessionsRes.json();

      if (clientsData.success) {
        setClients(clientsData.data || []);
      }
      if (sessionsData.success) {
        setSessions(sessionsData.sessions || []);
      }
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartResearch = async () => {
    if (!selectedClientId) {
      setError('Please select a client');
      return;
    }

    setIsRunning(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/intelligence/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: selectedClientId,
          research_type: researchType,
          query: customQuery || undefined
        })
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(`Research session started. Found ${result.facts_found || 0} potential facts.`);
        loadData();
        setCustomQuery('');
      } else {
        setError(result.error || 'Research failed');
      }
    } catch (err) {
      setError('Network error during research');
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400 bg-green-400/10';
      case 'in_progress': return 'text-amber-400 bg-amber-400/10';
      case 'failed': return 'text-red-400 bg-red-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return '--';
    return new Date(timestamp * 1000).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2 text-green-400">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {success}
          <button onClick={() => setSuccess(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* New Research Form */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
        <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
          <Search className="w-5 h-5 text-amber-400" />
          Start New Research
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Client Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              <Building2 className="w-4 h-4 inline mr-1" />
              Target Client
            </label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Select a client...</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.company || client.name}
                </option>
              ))}
            </select>
          </div>

          {/* Research Type */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              <Globe className="w-4 h-4 inline mr-1" />
              Research Type
            </label>
            <select
              value={researchType}
              onChange={(e) => setResearchType(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-amber-500"
            >
              {RESEARCH_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label} - {type.desc}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom Query */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Custom Research Query (optional)
          </label>
          <textarea
            value={customQuery}
            onChange={(e) => setCustomQuery(e.target.value)}
            placeholder="e.g., Find their social media handles and recent reviews"
            className="w-full h-24 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-amber-500 resize-none"
          />
        </div>

        {/* Start Button */}
        <button
          onClick={handleStartResearch}
          disabled={isRunning || !selectedClientId}
          className="mt-4 w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Researching...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Start AI Research
            </>
          )}
        </button>
      </div>

      {/* Research History */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
        <div className="bg-gray-900/50 px-6 py-4 border-b border-gray-700">
          <h3 className="font-medium text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-400" />
            Research History
          </h3>
        </div>

        {sessions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No research sessions yet. Start a new research above.
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {sessions.map(session => (
              <div key={session.id} className="px-6 py-4 hover:bg-gray-900/30 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-white">{session.title}</h4>
                      <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(session.status)}`}>
                        {session.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400 mt-1">
                      {session.client_name || 'Unknown client'} &bull; {session.research_type}
                    </div>
                    {session.summary && (
                      <div className="text-sm text-gray-500 mt-2">{session.summary}</div>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <span className="text-amber-400 font-medium">{session.facts_found}</span>
                        <span className="text-gray-500 ml-1">found</span>
                      </div>
                      <div>
                        <span className="text-green-400 font-medium">{session.facts_approved}</span>
                        <span className="text-gray-500 ml-1">approved</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatDate(session.started_at)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientResearchPanel;
