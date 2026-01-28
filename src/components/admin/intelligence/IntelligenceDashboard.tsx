import React, { useState, useEffect, useCallback } from 'react';
import {
  Brain, Rss, Search, RefreshCw, Settings, Filter,
  TrendingUp, AlertTriangle, Users, Globe, Zap, Star,
  Clock, CheckCircle, XCircle, Eye, ExternalLink,
  Loader2, ChevronDown, ChevronUp, Plus, ToggleLeft, ToggleRight,
  Inbox, Archive, MapPin, Bell, Database
} from 'lucide-react';
import FindingCard from './FindingCard';
import SourceManager from './SourceManager';
import IntelligenceFeed from './IntelligenceFeed';
import DataContextStatus from '../DataContextStatus';
import dataContext, { IntelligenceItem as DataContextIntelligence } from '../../../services/dataContext';

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
  created_at: number;
}

interface Stats {
  total: number;
  new_count: number;
  actionable_count: number;
  high_priority_count: number;
}

interface FeedStats {
  total_items: number;
  pending_count: number;
  relevant_count: number;
  converted_count: number;
}

interface Source {
  id: string;
  name: string;
  source_type: string;
  url: string;
  is_active: number;
  item_count?: number;
  pending_count?: number;
  last_polled_at: number | null;
  error_count: number;
}

type TabView = 'overview' | 'findings' | 'feed' | 'sources';

const IntelligenceDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabView>('overview');
  const [findings, setFindings] = useState<Finding[]>([]);
  const [findingsStats, setFindingsStats] = useState<Stats>({ total: 0, new_count: 0, actionable_count: 0, high_priority_count: 0 });
  const [feedStats, setFeedStats] = useState<FeedStats>({ total_items: 0, pending_count: 0, relevant_count: 0, converted_count: 0 });
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // DATA_CONTEXT integration
  const [dataContextConnected, setDataContextConnected] = useState(false);
  const [dataContextIntelligence, setDataContextIntelligence] = useState<DataContextIntelligence[]>([]);
  const [dataContextLoading, setDataContextLoading] = useState(false);

  // Filters for findings
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  const loadOverviewData = useCallback(async () => {
    try {
      // Load findings stats
      const findingsRes = await fetch('/api/admin/intelligence/findings?limit=10', { credentials: 'include' });
      const findingsData = await findingsRes.json();
      if (findingsData.success) {
        setFindings(findingsData.data.slice(0, 5));
        setFindingsStats(findingsData.stats);
      }

      // Load feed stats
      const feedRes = await fetch('/api/admin/intelligence/feed?limit=1', { credentials: 'include' });
      const feedData = await feedRes.json();
      if (feedData.success) {
        setFeedStats(feedData.stats);
      }

      // Load sources
      const sourcesRes = await fetch('/api/admin/intelligence/sources', { credentials: 'include' });
      const sourcesData = await sourcesRes.json();
      if (sourcesData.success) {
        setSources(sourcesData.data);
      }
    } catch (error) {
      console.error('Failed to load overview:', error);
    }

    // Load DATA_CONTEXT intelligence (separate try/catch for graceful fallback)
    try {
      setDataContextLoading(true);
      const connected = await dataContext.checkConnection();
      setDataContextConnected(connected);
      
      if (connected) {
        const intelligence = await dataContext.getIntelligence(10);
        setDataContextIntelligence(intelligence);
      }
    } catch (error) {
      console.error('Failed to load DATA_CONTEXT intelligence:', error);
      setDataContextConnected(false);
    } finally {
      setDataContextLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadOverviewData();
      setLoading(false);
    };
    init();
  }, [loadOverviewData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadOverviewData();
    setRefreshing(false);
  };

  const formatTimeAgo = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const seconds = Math.floor(Date.now() / 1000 - timestamp);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
            <Brain className="w-5 h-5 text-amber-400" />
            Intelligence Researcher
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Monitor market intelligence, competitor activity, and opportunities
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-gray-900 font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-700 pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
            activeTab === 'overview'
              ? 'bg-amber-500/20 text-amber-400 border-b-2 border-amber-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Overview
        </button>
        <button
          onClick={() => setActiveTab('findings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
            activeTab === 'findings'
              ? 'bg-amber-500/20 text-amber-400 border-b-2 border-amber-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Brain className="w-4 h-4" />
          Findings
          {findingsStats.new_count > 0 && (
            <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded">
              {findingsStats.new_count}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('feed')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
            activeTab === 'feed'
              ? 'bg-amber-500/20 text-amber-400 border-b-2 border-amber-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Inbox className="w-4 h-4" />
          Feed
          {feedStats.pending_count > 0 && (
            <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 text-xs rounded">
              {feedStats.pending_count}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('sources')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
            activeTab === 'sources'
              ? 'bg-amber-500/20 text-amber-400 border-b-2 border-amber-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Rss className="w-4 h-4" />
          Sources
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Total Findings</span>
                <Brain className="w-5 h-5 text-gray-500" />
              </div>
              <p className="text-2xl font-bold text-white mt-2">{findingsStats.total}</p>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">New Findings</span>
                <Bell className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-blue-400 mt-2">{findingsStats.new_count}</p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Actionable</span>
                <Zap className="w-5 h-5 text-amber-500" />
              </div>
              <p className="text-2xl font-bold text-amber-400 mt-2">{findingsStats.actionable_count}</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">High Priority</span>
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <p className="text-2xl font-bold text-red-400 mt-2">{findingsStats.high_priority_count}</p>
            </div>
          </div>

          {/* Feed Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <Rss className="w-4 h-4" />
                Feed Items
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-white">{feedStats.total_items}</span>
                <span className="text-sm text-gray-500">total</span>
              </div>
              <div className="text-xs text-amber-400 mt-1">
                {feedStats.pending_count} pending review
              </div>
            </div>
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <Globe className="w-4 h-4" />
                Active Sources
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-white">
                  {sources.filter(s => s.is_active).length}
                </span>
                <span className="text-sm text-gray-500">of {sources.length}</span>
              </div>
              <div className="text-xs text-green-400 mt-1">
                {sources.filter(s => s.is_active && !s.error_count).length} healthy
              </div>
            </div>
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <CheckCircle className="w-4 h-4" />
                Converted
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-white">{feedStats.converted_count}</span>
                <span className="text-sm text-gray-500">to findings</span>
              </div>
              <div className="text-xs text-green-400 mt-1">
                {feedStats.total_items > 0 ? ((feedStats.converted_count / feedStats.total_items) * 100).toFixed(1) : 0}% conversion
              </div>
            </div>
          </div>

          {/* Recent High Priority Findings */}
          {findings.filter(f => ['urgent', 'high'].includes(f.priority)).length > 0 && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                High Priority Findings
              </h3>
              <div className="space-y-2">
                {findings.filter(f => ['urgent', 'high'].includes(f.priority)).slice(0, 3).map(finding => (
                  <FindingCard key={finding.id} finding={finding} compact onUpdate={loadOverviewData} />
                ))}
              </div>
              <button
                onClick={() => setActiveTab('findings')}
                className="mt-3 text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1"
              >
                View all findings
                <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
              </button>
            </div>
          )}

          {/* Source Status */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Rss className="w-4 h-4" />
                Source Status
              </h3>
              <button
                onClick={() => setActiveTab('sources')}
                className="text-xs text-amber-400 hover:text-amber-300"
              >
                Manage sources
              </button>
            </div>
            <div className="grid gap-3">
              {sources.slice(0, 5).map(source => (
                <div key={source.id} className="flex items-center justify-between p-2 bg-gray-900/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      source.is_active && !source.error_count ? 'bg-green-400' :
                      source.is_active && source.error_count ? 'bg-amber-400' :
                      'bg-gray-600'
                    }`} />
                    <div>
                      <p className="text-sm text-white">{source.name}</p>
                      <p className="text-xs text-gray-500">{source.source_type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">{source.item_count || 0} items</p>
                    <p className="text-xs text-gray-500">Last: {formatTimeAgo(source.last_polled_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* DATA_CONTEXT Intelligence */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Database className="w-4 h-4 text-purple-400" />
                DATA_CONTEXT Intelligence
              </h3>
              <DataContextStatus compact onStatusChange={setDataContextConnected} />
            </div>
            
            {dataContextLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
              </div>
            ) : !dataContextConnected ? (
              <div className="text-center py-4 bg-gray-900/30 rounded-lg border border-gray-700/50">
                <Database className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">DATA_CONTEXT offline</p>
                <p className="text-gray-600 text-xs mt-1">Connect to central data lake for additional intelligence</p>
              </div>
            ) : dataContextIntelligence.length === 0 ? (
              <div className="text-center py-4 bg-gray-900/30 rounded-lg border border-gray-700/50">
                <Brain className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No intelligence items yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {dataContextIntelligence.slice(0, 5).map(item => (
                  <div key={item.id} className="p-3 bg-gray-900/50 rounded-lg border border-gray-700/50 hover:border-purple-500/30 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{item.title}</p>
                        {item.summary && (
                          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{item.summary}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`px-1.5 py-0.5 text-xs rounded ${
                          item.sentiment === 'positive' ? 'bg-green-500/20 text-green-400' :
                          item.sentiment === 'negative' ? 'bg-red-500/20 text-red-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {item.sentiment}
                        </span>
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-gray-400 hover:text-purple-400 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span>{item.source}</span>
                      <span>•</span>
                      <span>{item.item_type}</span>
                      {item.timestamp && (
                        <>
                          <span>•</span>
                          <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Findings Tab */}
      {activeTab === 'findings' && (
        <FindingsView
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          priorityFilter={priorityFilter}
          setPriorityFilter={setPriorityFilter}
        />
      )}

      {/* Feed Tab */}
      {activeTab === 'feed' && (
        <IntelligenceFeed />
      )}

      {/* Sources Tab */}
      {activeTab === 'sources' && (
        <SourceManager />
      )}
    </div>
  );
};

// Findings View Component (inline for simplicity)
const FindingsView: React.FC<{
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  priorityFilter: string;
  setPriorityFilter: (s: string) => void;
}> = ({ statusFilter, setStatusFilter, priorityFilter, setPriorityFilter }) => {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, new_count: 0, actionable_count: 0, high_priority_count: 0 });
  const [loading, setLoading] = useState(true);

  const loadFindings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      params.set('limit', '50');

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
  }, [statusFilter, priorityFilter]);

  useEffect(() => {
    loadFindings();
  }, [loadFindings]);

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-white">{stats.total}</p>
          <p className="text-xs text-gray-400">Total</p>
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
      <div className="flex items-center gap-3 flex-wrap bg-gray-800/30 rounded-lg p-3">
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
        <div className="text-center py-12 bg-gray-800/30 rounded-lg">
          <Brain className="w-10 h-10 mx-auto mb-3 text-gray-600" />
          <p className="text-lg font-medium text-gray-400">No findings yet</p>
          <p className="text-sm mt-1 text-gray-500">Intelligence agents will populate findings as they discover insights.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {findings.map(finding => (
            <FindingCard key={finding.id} finding={finding} onUpdate={loadFindings} />
          ))}
        </div>
      )}
    </div>
  );
};

export default IntelligenceDashboard;
