import React, { useState, useEffect, useCallback } from 'react';
import {
  Radio, RefreshCw, Check, X, ExternalLink, Filter, ChevronDown, ChevronUp,
  Loader2, AlertCircle, Clock, TrendingUp, Inbox, Archive, Eye, MessageSquare,
  Rss, Plus, Settings, Trash2, ToggleLeft, ToggleRight
} from 'lucide-react';

interface Source {
  id: string;
  name: string;
  type: string;
  enabled: number;
  config_json: string | null;
  fetch_frequency_minutes: number;
  last_fetched_at: number | null;
  items_fetched_total: number;
  error_count: number;
  last_error: string | null;
  item_count?: number;
  pending_count?: number;
}

interface ContentItem {
  id: string;
  source_id: string | null;
  external_id: string | null;
  title: string;
  body: string | null;
  url: string | null;
  author: string | null;
  source_type: string;
  source_name?: string;
  source_metadata_json: string | null;
  ai_summary: string | null;
  ai_category: string | null;
  ai_sentiment: string | null;
  ai_action_suggestion: string | null;
  ai_priority_score: number;
  status: string;
  fetched_at: number;
  source_created_at: number | null;
  notes: string | null;
}

interface Stats {
  overview: {
    total_items: number;
    pending: number;
    approved: number;
    rejected: number;
    published: number;
    archived: number;
  };
  by_category: { category: string; count: number }[];
  sources: Source[];
  high_priority: ContentItem[];
  recent_activity: { date: string; items_fetched: number; approved: number; rejected: number }[];
}

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'menu', label: 'Menu & Items' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'integrations', label: 'Integrations' },
  { value: 'reports', label: 'Reports' },
  { value: 'labor', label: 'Labor' },
  { value: 'training', label: 'Training' },
  { value: 'general', label: 'General' }
];

const SENTIMENTS = {
  frustrated: { color: 'text-red-400', bg: 'bg-red-500/20' },
  confused: { color: 'text-amber-400', bg: 'bg-amber-500/20' },
  negative: { color: 'text-orange-400', bg: 'bg-orange-500/20' },
  neutral: { color: 'text-gray-400', bg: 'bg-gray-500/20' },
  positive: { color: 'text-green-400', bg: 'bg-green-500/20' }
};

const BeaconDashboard: React.FC = () => {
  const [activeView, setActiveView] = useState<'overview' | 'feed' | 'sources'>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('pending');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/beacon/stats');
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, []);

  // Load items
  const loadItems = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      if (sourceFilter) params.set('source_id', sourceFilter);
      params.set('limit', '50');

      const response = await fetch(`/api/admin/beacon/items?${params}`);
      const data = await response.json();
      if (data.success) {
        setItems(data.data.items || []);
      }
    } catch (error) {
      console.error('Failed to load items:', error);
    }
  }, [statusFilter, categoryFilter, sourceFilter]);

  // Load sources
  const loadSources = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/beacon/sources');
      const data = await response.json();
      if (data.success) {
        setSources(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load sources:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadStats(), loadSources()]);
      setLoading(false);
    };
    init();
  }, [loadStats, loadSources]);

  // Load items when filters change
  useEffect(() => {
    if (activeView === 'feed') {
      loadItems();
    }
  }, [activeView, loadItems]);

  // Trigger fetch
  const triggerFetch = async (sourceId?: string) => {
    setFetching(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/beacon/fetch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(sourceId ? { source_id: sourceId } : {})
      });
      const data = await response.json();
      if (data.success) {
        await Promise.all([loadStats(), loadItems(), loadSources()]);
      }
    } catch (error) {
      console.error('Fetch failed:', error);
    } finally {
      setFetching(false);
    }
  };

  // Item actions
  const handleItemAction = async (id: string, action: 'approve' | 'reject' | 'archive') => {
    setActionLoading(id);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/beacon/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id, action })
      });
      const data = await response.json();
      if (data.success) {
        await loadItems();
        await loadStats();
      }
    } catch (error) {
      console.error('Action failed:', error);
    } finally {
      setActionLoading(null);
    }
  };

  // Toggle source
  const toggleSource = async (source: Source) => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/beacon/sources', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id: source.id, enabled: !source.enabled })
      });
      const data = await response.json();
      if (data.success) {
        await loadSources();
      }
    } catch (error) {
      console.error('Toggle failed:', error);
    }
  };

  const formatTimeAgo = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const seconds = Math.floor(Date.now() / 1000 - timestamp);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getPriorityColor = (score: number) => {
    if (score >= 80) return 'text-red-400';
    if (score >= 60) return 'text-amber-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-gray-400';
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
            <Radio className="w-5 h-5 text-amber-400" />
            Beacon Content Platform
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Aggregate, curate, and publish Toast POS content
          </p>
        </div>
        <button
          onClick={() => triggerFetch()}
          disabled={fetching}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-gray-900 font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {fetching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Fetch Content
        </button>
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 border-b border-gray-700 pb-2">
        <button
          onClick={() => setActiveView('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
            activeView === 'overview'
              ? 'bg-amber-500/20 text-amber-400 border-b-2 border-amber-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Overview
        </button>
        <button
          onClick={() => setActiveView('feed')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
            activeView === 'feed'
              ? 'bg-amber-500/20 text-amber-400 border-b-2 border-amber-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Inbox className="w-4 h-4" />
          Incoming Feed
          {stats && stats.overview.pending > 0 && (
            <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 text-xs rounded">
              {stats.overview.pending}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveView('sources')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
            activeView === 'sources'
              ? 'bg-amber-500/20 text-amber-400 border-b-2 border-amber-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Rss className="w-4 h-4" />
          Sources
        </button>
      </div>

      {/* Overview View */}
      {activeView === 'overview' && stats && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="admin-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Total Items</span>
                <Inbox className="w-5 h-5 text-gray-500" />
              </div>
              <p className="text-2xl font-bold text-white mt-2">{stats.overview.total_items}</p>
            </div>
            <div className="admin-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Pending Review</span>
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <p className="text-2xl font-bold text-amber-400 mt-2">{stats.overview.pending}</p>
            </div>
            <div className="admin-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Approved</span>
                <Check className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-2xl font-bold text-green-400 mt-2">{stats.overview.approved}</p>
            </div>
            <div className="admin-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Published</span>
                <Eye className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-blue-400 mt-2">{stats.overview.published}</p>
            </div>
          </div>

          {/* High Priority Items */}
          {stats.high_priority.length > 0 && (
            <div className="admin-card p-4">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                High Priority Items
              </h3>
              <div className="space-y-3">
                {stats.high_priority.map(item => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between p-3 bg-gray-800/50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 text-xs rounded ${SENTIMENTS[item.ai_sentiment as keyof typeof SENTIMENTS]?.bg || 'bg-gray-500/20'} ${SENTIMENTS[item.ai_sentiment as keyof typeof SENTIMENTS]?.color || 'text-gray-400'}`}>
                          {item.ai_sentiment}
                        </span>
                        <span className="text-xs text-gray-500">{item.ai_category}</span>
                        <span className={`text-xs font-medium ${getPriorityColor(item.ai_priority_score)}`}>
                          P{item.ai_priority_score}
                        </span>
                      </div>
                      <p className="text-white text-sm truncate">{item.title}</p>
                      <p className="text-gray-500 text-xs mt-1">
                        {item.source_type} · {formatTimeAgo(item.fetched_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleItemAction(item.id, 'approve')}
                        disabled={actionLoading === item.id}
                        className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg transition-colors"
                        title="Approve"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleItemAction(item.id, 'reject')}
                        disabled={actionLoading === item.id}
                        className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                        title="Reject"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Categories Breakdown */}
          {stats.by_category.length > 0 && (
            <div className="admin-card p-4">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Pending by Category
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {stats.by_category.map(cat => (
                  <div
                    key={cat.category}
                    className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
                  >
                    <span className="text-gray-300 text-sm capitalize">{cat.category || 'uncategorized'}</span>
                    <span className="text-white font-medium">{cat.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Feed View */}
      {activeView === 'feed' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="admin-card p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                >
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
              >
                <option value="">All Sources</option>
                {sources.map(src => (
                  <option key={src.id} value={src.id}>{src.name}</option>
                ))}
              </select>
              <button
                onClick={() => loadItems()}
                className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>

          {/* Items List */}
          <div className="space-y-3">
            {items.length === 0 ? (
              <div className="admin-card p-8 text-center">
                <Inbox className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No items found matching filters</p>
              </div>
            ) : (
              items.map(item => (
                <div key={item.id} className="admin-card overflow-hidden">
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-800/50 transition-colors"
                    onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        {/* Meta row */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 text-xs rounded bg-gray-700 text-gray-300">
                            {item.source_type}
                          </span>
                          <span className={`px-2 py-0.5 text-xs rounded ${SENTIMENTS[item.ai_sentiment as keyof typeof SENTIMENTS]?.bg || 'bg-gray-500/20'} ${SENTIMENTS[item.ai_sentiment as keyof typeof SENTIMENTS]?.color || 'text-gray-400'}`}>
                            {item.ai_sentiment}
                          </span>
                          <span className="px-2 py-0.5 text-xs rounded bg-gray-700 text-gray-300 capitalize">
                            {item.ai_category}
                          </span>
                          <span className={`text-xs font-medium ${getPriorityColor(item.ai_priority_score)}`}>
                            Priority: {item.ai_priority_score}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatTimeAgo(item.fetched_at)}
                          </span>
                        </div>

                        {/* Title */}
                        <h4 className="text-white font-medium">{item.title}</h4>

                        {/* Author & Source */}
                        <p className="text-gray-500 text-sm mt-1">
                          by {item.author || 'Unknown'} · {item.source_name || item.source_type}
                        </p>

                        {/* AI Suggestion */}
                        {item.ai_action_suggestion && item.ai_action_suggestion !== 'ignore' && (
                          <p className="text-amber-400 text-sm mt-2">
                            AI suggests: <span className="font-medium uppercase">{item.ai_action_suggestion}</span>
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 ml-4">
                        {item.status === 'pending' && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleItemAction(item.id, 'approve');
                              }}
                              disabled={actionLoading === item.id}
                              className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg transition-colors"
                              title="Approve"
                            >
                              {actionLoading === item.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleItemAction(item.id, 'reject');
                              }}
                              disabled={actionLoading === item.id}
                              className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                              title="Reject"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                            title="View Original"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        {expandedItem === item.id ? (
                          <ChevronUp className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {expandedItem === item.id && (
                    <div className="px-4 pb-4 pt-2 border-t border-gray-800">
                      {item.body && (
                        <div className="prose prose-invert prose-sm max-w-none">
                          <p className="text-gray-300 whitespace-pre-wrap">{item.body}</p>
                        </div>
                      )}

                      {/* Source metadata */}
                      {item.source_metadata_json && (
                        <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
                          <h5 className="text-xs font-semibold text-gray-400 uppercase mb-2">Source Metadata</h5>
                          <div className="flex flex-wrap gap-3 text-sm">
                            {(() => {
                              try {
                                const meta = JSON.parse(item.source_metadata_json);
                                return (
                                  <>
                                    {meta.score !== undefined && (
                                      <span className="text-gray-400">
                                        Score: <span className="text-white">{meta.score}</span>
                                      </span>
                                    )}
                                    {meta.num_comments !== undefined && (
                                      <span className="text-gray-400">
                                        Comments: <span className="text-white">{meta.num_comments}</span>
                                      </span>
                                    )}
                                    {meta.flair && (
                                      <span className="text-gray-400">
                                        Flair: <span className="text-white">{meta.flair}</span>
                                      </span>
                                    )}
                                  </>
                                );
                              } catch {
                                return null;
                              }
                            })()}
                          </div>
                        </div>
                      )}

                      {/* Quick actions */}
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => handleItemAction(item.id, 'archive')}
                          className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-sm"
                        >
                          <Archive className="w-4 h-4" />
                          Archive
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Sources View */}
      {activeView === 'sources' && (
        <div className="space-y-4">
          <div className="grid gap-4">
            {sources.map(source => (
              <div key={source.id} className="admin-card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      source.enabled ? 'bg-green-500/20' : 'bg-gray-700'
                    }`}>
                      <Rss className={`w-6 h-6 ${source.enabled ? 'text-green-400' : 'text-gray-500'}`} />
                    </div>
                    <div>
                      <h4 className="text-white font-medium">{source.name}</h4>
                      <p className="text-gray-500 text-sm">{source.type}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="text-gray-400">
                          Items: <span className="text-white">{source.item_count || 0}</span>
                        </span>
                        <span className="text-gray-400">
                          Pending: <span className="text-amber-400">{source.pending_count || 0}</span>
                        </span>
                        <span className="text-gray-400">
                          Last fetch: <span className="text-white">{formatTimeAgo(source.last_fetched_at)}</span>
                        </span>
                      </div>
                      {source.error_count > 0 && (
                        <div className="flex items-center gap-2 mt-2 text-red-400 text-sm">
                          <AlertCircle className="w-4 h-4" />
                          {source.error_count} errors - {source.last_error}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => triggerFetch(source.id)}
                      disabled={fetching}
                      className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                      title="Fetch from this source"
                    >
                      <RefreshCw className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={() => toggleSource(source)}
                      className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                      title={source.enabled ? 'Disable source' : 'Enable source'}
                    >
                      {source.enabled ? (
                        <ToggleRight className="w-6 h-6 text-green-400" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-gray-500" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {sources.length === 0 && (
              <div className="admin-card p-8 text-center">
                <Rss className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 mb-4">No content sources configured</p>
                <p className="text-gray-500 text-sm">
                  The default Reddit source should be created automatically by the migration.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BeaconDashboard;
