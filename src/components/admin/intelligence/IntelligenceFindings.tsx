import React, { useState, useEffect } from 'react';
import {
  Brain, Search, Filter, AlertTriangle, TrendingUp, Users,
  MapPin, Globe, Star, CheckCircle, Clock, XCircle, Eye,
  Loader2, ChevronDown, ExternalLink, Zap
} from 'lucide-react';

interface Finding {
  id: string;
  agent_type: string;
  finding_type: string;
  title: string;
  summary: string | null;
  confidence_score: number;
  priority: string;
  status: string;
  territory: string | null;
  source_url: string | null;
  action_taken: string | null;
  created_at: number;
}

interface Stats {
  total: number;
  new_count: number;
  actionable_count: number;
  high_priority_count: number;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  normal: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  low: 'bg-gray-700 text-gray-400 border-gray-600',
};

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-400',
  reviewed: 'bg-purple-500/20 text-purple-400',
  actionable: 'bg-amber-500/20 text-amber-400',
  acted_on: 'bg-green-500/20 text-green-400',
  dismissed: 'bg-gray-700 text-gray-400',
};

const FINDING_TYPE_ICONS: Record<string, any> = {
  lead_opportunity: Users,
  competitor_move: AlertTriangle,
  market_trend: TrendingUp,
  client_risk: AlertTriangle,
  upsell_signal: Star,
  news_mention: Globe,
  technology_change: Zap,
  expansion_opportunity: MapPin,
};

const IntelligenceFindings: React.FC = () => {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, new_count: 0, actionable_count: 0, high_priority_count: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadFindings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);

      const response = await fetch(`/api/admin/intelligence/findings?${params}`, { credentials: 'include' });
      const data = await response.json();
      if (data.success) {
        setFindings(data.data);
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to load findings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFindings();
  }, [statusFilter, priorityFilter]);

  const handleStatusUpdate = async (findingId: string, newStatus: string, actionTaken?: string) => {
    try {
      await fetch('/api/admin/intelligence/findings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: findingId, status: newStatus, action_taken: actionTaken })
      });
      loadFindings();
    } catch (err) {
      console.error('Failed to update finding:', err);
    }
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts * 1000);
    const now = new Date();
    const diffHrs = (now.getTime() - d.getTime()) / 3600000;
    if (diffHrs < 1) return `${Math.floor((now.getTime() - d.getTime()) / 60000)}m ago`;
    if (diffHrs < 24) return `${Math.floor(diffHrs)}h ago`;
    if (diffHrs < 168) return `${Math.floor(diffHrs / 24)}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-white">{stats.total}</p>
          <p className="text-xs text-gray-400">Total Findings</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-blue-400">{stats.new_count}</p>
          <p className="text-xs text-gray-400">New</p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-amber-400">{stats.actionable_count}</p>
          <p className="text-xs text-gray-400">Actionable</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-red-400">{stats.high_priority_count}</p>
          <p className="text-xs text-gray-400">High Priority</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-400">Status:</span>
        </div>
        {['', 'new', 'reviewed', 'actionable', 'acted_on', 'dismissed'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
            }`}
          >
            {s ? s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'All'}
          </button>
        ))}

        <span className="text-gray-700">|</span>
        <span className="text-sm text-gray-400">Priority:</span>
        {['', 'urgent', 'high', 'normal', 'low'].map(p => (
          <button
            key={p}
            onClick={() => setPriorityFilter(p)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              priorityFilter === p
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
            }`}
          >
            {p ? p.charAt(0).toUpperCase() + p.slice(1) : 'All'}
          </button>
        ))}
      </div>

      {/* Findings List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
        </div>
      ) : findings.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Brain className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">No findings yet</p>
          <p className="text-sm mt-1">Intelligence agents will populate findings as they discover insights.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {findings.map(finding => {
            const Icon = FINDING_TYPE_ICONS[finding.finding_type] || Brain;
            const isExpanded = expandedId === finding.id;

            return (
              <div
                key={finding.id}
                className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden hover:border-gray-600 transition-colors"
              >
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : finding.id)}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    finding.priority === 'urgent' ? 'bg-red-500/20' :
                    finding.priority === 'high' ? 'bg-orange-500/20' : 'bg-gray-700'
                  }`}>
                    <Icon className={`w-4 h-4 ${
                      finding.priority === 'urgent' ? 'text-red-400' :
                      finding.priority === 'high' ? 'text-orange-400' : 'text-gray-400'
                    }`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">{finding.title}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`px-1.5 py-0.5 rounded text-xs border ${PRIORITY_COLORS[finding.priority]}`}>
                        {finding.priority}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-xs ${STATUS_COLORS[finding.status]}`}>
                        {finding.status.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-gray-500 capitalize">{finding.finding_type.replace(/_/g, ' ')}</span>
                      {finding.territory && (
                        <span className="text-xs text-gray-600 flex items-center gap-0.5">
                          <MapPin className="w-3 h-3" />{finding.territory}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-gray-500">{formatDate(finding.created_at)}</p>
                      <p className="text-xs text-gray-600">{finding.confidence_score}% conf.</p>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-gray-700 p-4 bg-gray-900/30">
                    {finding.summary && (
                      <p className="text-sm text-gray-300 mb-3">{finding.summary}</p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                      <span>Agent: {finding.agent_type.replace(/_/g, ' ')}</span>
                      {finding.source_url && (
                        <a href={finding.source_url} target="_blank" rel="noopener" className="flex items-center gap-1 text-amber-400 hover:underline">
                          <ExternalLink className="w-3 h-3" />Source
                        </a>
                      )}
                    </div>
                    {finding.action_taken && (
                      <div className="bg-green-500/10 border border-green-500/20 rounded p-2 mb-3">
                        <p className="text-xs text-green-400">Action taken: {finding.action_taken}</p>
                      </div>
                    )}
                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      {finding.status === 'new' && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStatusUpdate(finding.id, 'actionable'); }}
                            className="px-3 py-1.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-xs hover:bg-amber-500/30"
                          >
                            Mark Actionable
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStatusUpdate(finding.id, 'reviewed'); }}
                            className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-xs hover:bg-gray-600"
                          >
                            Mark Reviewed
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStatusUpdate(finding.id, 'dismissed'); }}
                            className="px-3 py-1.5 text-gray-500 rounded text-xs hover:text-gray-300"
                          >
                            Dismiss
                          </button>
                        </>
                      )}
                      {finding.status === 'actionable' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStatusUpdate(finding.id, 'acted_on', 'Reviewed and addressed'); }}
                          className="px-3 py-1.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded text-xs hover:bg-green-500/30"
                        >
                          Mark Completed
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default IntelligenceFindings;
