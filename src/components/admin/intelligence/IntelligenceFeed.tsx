import React, { useState, useEffect, useCallback } from 'react';
import {
  Inbox, Filter, RefreshCw, Check, X, ExternalLink, ChevronDown, ChevronUp,
  Loader2, Archive, Eye, Star, AlertTriangle, Brain, Zap, Clock, Globe
} from 'lucide-react';

interface FeedItem {
  id: string;
  source_id: string;
  source_name?: string;
  source_type: string;
  source_category?: string;
  external_id: string | null;
  title: string;
  content: string | null;
  url: string | null;
  author: string | null;
  published_at: number | null;
  fetched_at: number;
  relevance_score: number;
  triage_status: string;
  triage_reason: string | null;
  converted_to_finding: number;
  finding_id: string | null;
}

interface FeedStats {
  total_items: number;
  pending_count: number;
  relevant_count: number;
  irrelevant_count: number;
  needs_review_count: number;
  converted_count: number;
  avg_relevance: number;
}

const IntelligenceFeed: React.FC = () => {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [stats, setStats] = useState<FeedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('pending');
  const [minRelevance, setMinRelevance] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Convert to finding modal
  const [convertingItem, setConvertingItem] = useState<FeedItem | null>(null);
  const [findingType, setFindingType] = useState('news_mention');
  const [findingPriority, setFindingPriority] = useState('normal');

  const loadFeed = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (minRelevance > 0) params.set('min_relevance', minRelevance.toString());
      params.set('limit', '50');

      const response = await fetch(`/api/admin/intelligence/feed?${params}`, { credentials: 'include' });
      const data = await response.json();
      if (data.success) {
        setItems(data.data || []);
        setStats(data.stats || null);
      }
    } catch (error) {
      console.error('Failed to load feed:', error);
    }
  }, [statusFilter, minRelevance]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadFeed();
      setLoading(false);
    };
    init();
  }, [loadFeed]);

  const handleAction = async (itemId: string, action: string, extra?: Record<string, unknown>) => {
    setActionLoading(itemId);
    try {
      await fetch('/api/admin/intelligence/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: itemId, action, ...extra })
      });
      await loadFeed();
    } catch (error) {
      console.error('Action failed:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleConvertToFinding = async () => {
    if (!convertingItem) return;

    setActionLoading(convertingItem.id);
    try {
      await fetch('/api/admin/intelligence/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: convertingItem.id,
          action: 'convert_to_finding',
          finding: {
            finding_type: findingType,
            priority: findingPriority,
            agent_type: 'news_monitor'
          }
        })
      });
      setConvertingItem(null);
      await loadFeed();
    } catch (error) {
      console.error('Convert failed:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const formatTimeAgo = (timestamp: number | null) => {
    if (!timestamp) return 'Unknown';
    const seconds = Math.floor(Date.now() / 1000 - timestamp);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getRelevanceColor = (score: number) => {
    if (score >= 70) return 'text-green-400';
    if (score >= 40) return 'text-amber-400';
    return 'text-gray-400';
  };

  const FINDING_TYPES = [
    { value: 'news_mention', label: 'News Mention' },
    { value: 'market_trend', label: 'Market Trend' },
    { value: 'competitor_move', label: 'Competitor Move' },
    { value: 'technology_change', label: 'Technology Change' },
    { value: 'lead_opportunity', label: 'Lead Opportunity' },
    { value: 'client_risk', label: 'Client Risk' },
  ];

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-6 gap-3">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-white">{stats.total_items}</p>
            <p className="text-xs text-gray-400">Total</p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-amber-400">{stats.pending_count}</p>
            <p className="text-xs text-gray-400">Pending</p>
          </div>
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-green-400">{stats.relevant_count}</p>
            <p className="text-xs text-gray-400">Relevant</p>
          </div>
          <div className="bg-gray-700 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-gray-400">{stats.irrelevant_count}</p>
            <p className="text-xs text-gray-400">Irrelevant</p>
          </div>
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-purple-400">{stats.needs_review_count}</p>
            <p className="text-xs text-gray-400">Needs Review</p>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-blue-400">{stats.converted_count}</p>
            <p className="text-xs text-gray-400">Converted</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap bg-gray-800/30 rounded-lg p-3">
        <div className="flex items-center gap-1">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-400">Status:</span>
        </div>
        {['', 'pending', 'relevant', 'irrelevant', 'needs_review'].map(s => (
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
        <span className="text-sm text-gray-400">Min Relevance:</span>
        <input
          type="range"
          min="0"
          max="100"
          value={minRelevance}
          onChange={e => setMinRelevance(parseInt(e.target.value))}
          className="w-24 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
        />
        <span className="text-xs text-gray-400">{minRelevance}</span>

        <button
          onClick={() => loadFeed()}
          className="ml-auto flex items-center gap-2 px-3 py-1.5 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Feed Items */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-gray-800/30 rounded-lg">
          <Inbox className="w-10 h-10 mx-auto mb-3 text-gray-600" />
          <p className="text-lg font-medium text-gray-400">No feed items</p>
          <p className="text-sm mt-1 text-gray-500">Poll your sources to fetch new items.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden hover:border-gray-600 transition-colors">
              <div
                className="p-4 cursor-pointer"
                onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Meta row */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="px-2 py-0.5 text-xs rounded bg-gray-700 text-gray-300">
                        {item.source_type}
                      </span>
                      {item.source_name && (
                        <span className="text-xs text-gray-500">{item.source_name}</span>
                      )}
                      <span className={`text-xs font-medium ${getRelevanceColor(item.relevance_score)}`}>
                        Relevance: {item.relevance_score}%
                      </span>
                      <span className={`px-2 py-0.5 text-xs rounded ${
                        item.triage_status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                        item.triage_status === 'relevant' ? 'bg-green-500/20 text-green-400' :
                        item.triage_status === 'needs_review' ? 'bg-purple-500/20 text-purple-400' :
                        'bg-gray-700 text-gray-400'
                      }`}>
                        {item.triage_status}
                      </span>
                      {item.converted_to_finding === 1 && (
                        <span className="px-2 py-0.5 text-xs rounded bg-blue-500/20 text-blue-400 flex items-center gap-1">
                          <Brain className="w-3 h-3" />
                          Converted
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h4 className="text-white font-medium text-sm">{item.title}</h4>

                    {/* Author & Time */}
                    <p className="text-gray-500 text-xs mt-1 flex items-center gap-2">
                      {item.author && <span>by {item.author}</span>}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimeAgo(item.published_at || item.fetched_at)}
                      </span>
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 ml-4 shrink-0">
                    {item.triage_status === 'pending' && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction(item.id, 'mark_relevant');
                          }}
                          disabled={actionLoading === item.id}
                          className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg transition-colors"
                          title="Mark Relevant"
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
                            handleAction(item.id, 'mark_irrelevant');
                          }}
                          disabled={actionLoading === item.id}
                          className="p-2 text-gray-400 hover:bg-gray-700 rounded-lg transition-colors"
                          title="Mark Irrelevant"
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
                    {expandedId === item.id ? (
                      <ChevronUp className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded content */}
              {expandedId === item.id && (
                <div className="px-4 pb-4 pt-2 border-t border-gray-800">
                  {item.content && (
                    <div className="prose prose-invert prose-sm max-w-none mb-4">
                      <p className="text-gray-300 whitespace-pre-wrap text-sm">{item.content.substring(0, 1000)}</p>
                    </div>
                  )}

                  {item.triage_reason && (
                    <div className="mb-4 p-2 bg-gray-900/50 rounded text-xs text-gray-400">
                      <span className="font-medium">Triage reason:</span> {item.triage_reason}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {!item.converted_to_finding && item.triage_status !== 'irrelevant' && (
                      <button
                        onClick={() => setConvertingItem(item)}
                        className="px-3 py-1.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-xs hover:bg-amber-500/30 flex items-center gap-1"
                      >
                        <Brain className="w-3 h-3" />
                        Convert to Finding
                      </button>
                    )}
                    {item.triage_status === 'pending' && (
                      <button
                        onClick={() => handleAction(item.id, 'needs_review')}
                        className="px-3 py-1.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded text-xs hover:bg-purple-500/30 flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        Needs Review
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Convert to Finding Modal */}
      {convertingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 w-full max-w-lg mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">Convert to Finding</h3>
            <p className="text-sm text-gray-400 mb-4 truncate">{convertingItem.title}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Finding Type</label>
                <select
                  value={findingType}
                  onChange={e => setFindingType(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
                >
                  {FINDING_TYPES.map(ft => (
                    <option key={ft.value} value={ft.value}>{ft.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Priority</label>
                <select
                  value={findingPriority}
                  onChange={e => setFindingPriority(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setConvertingItem(null)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConvertToFinding}
                disabled={actionLoading === convertingItem.id}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-gray-900 font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoading === convertingItem.id && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Finding
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntelligenceFeed;
