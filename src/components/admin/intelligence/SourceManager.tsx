import React, { useState, useEffect, useCallback } from 'react';
import {
  Rss, Plus, RefreshCw, Trash2, Settings, ToggleLeft, ToggleRight,
  Loader2, AlertCircle, CheckCircle, Globe, Edit2, X, ExternalLink, Clock
} from 'lucide-react';

interface Source {
  id: string;
  name: string;
  source_type: string;
  url: string;
  config_json: string | null;
  category: string | null;
  territory: string | null;
  is_active: number;
  poll_interval_minutes: number;
  last_polled_at: number | null;
  last_item_at: number | null;
  error_count: number;
  last_error: string | null;
  item_count?: number;
  pending_count?: number;
  converted_count?: number;
  created_at: number;
}

interface SourceStats {
  total_sources: number;
  active_sources: number;
  total_errors: number;
  total_items: number;
  pending_items: number;
}

const SOURCE_TYPES = [
  { value: 'rss', label: 'RSS Feed' },
  { value: 'reddit', label: 'Reddit (JSON)' },
  { value: 'news_api', label: 'News API' },
  { value: 'custom_scraper', label: 'Custom Scraper' },
];

const CATEGORIES = [
  { value: 'industry_news', label: 'Industry News' },
  { value: 'competitor', label: 'Competitor' },
  { value: 'technology', label: 'Technology' },
  { value: 'community', label: 'Community' },
  { value: 'regulatory', label: 'Regulatory' },
  { value: 'market', label: 'Market Trends' },
];

const SourceManager: React.FC = () => {
  const [sources, setSources] = useState<Source[]>([]);
  const [stats, setStats] = useState<SourceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [pollingSource, setPollingSource] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSource, setEditingSource] = useState<Source | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    source_type: 'rss',
    url: '',
    category: '',
    territory: '',
    poll_interval_minutes: 60
  });

  const loadSources = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/intelligence/sources', { credentials: 'include' });
      const data = await response.json();
      if (data.success) {
        setSources(data.data || []);
        setStats(data.stats || null);
      }
    } catch (error) {
      console.error('Failed to load sources:', error);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadSources();
      setLoading(false);
    };
    init();
  }, [loadSources]);

  const handlePoll = async (sourceId: string) => {
    setPollingSource(sourceId);
    try {
      const response = await fetch(`/api/admin/intelligence/sources/${sourceId}/poll`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        await loadSources();
      } else {
        console.error('Poll failed:', data.error);
      }
    } catch (error) {
      console.error('Poll error:', error);
    } finally {
      setPollingSource(null);
    }
  };

  const handleToggle = async (source: Source) => {
    try {
      await fetch('/api/admin/intelligence/sources', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: source.id, is_active: !source.is_active })
      });
      await loadSources();
    } catch (error) {
      console.error('Toggle error:', error);
    }
  };

  const handleDelete = async (sourceId: string) => {
    if (!confirm('Delete this source and all its feed items?')) return;

    try {
      await fetch('/api/admin/intelligence/sources', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: sourceId })
      });
      await loadSources();
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingSource) {
        await fetch('/api/admin/intelligence/sources', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ id: editingSource.id, ...formData })
        });
      } else {
        await fetch('/api/admin/intelligence/sources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(formData)
        });
      }

      setShowAddForm(false);
      setEditingSource(null);
      setFormData({ name: '', source_type: 'rss', url: '', category: '', territory: '', poll_interval_minutes: 60 });
      await loadSources();
    } catch (error) {
      console.error('Submit error:', error);
    }
  };

  const openEditForm = (source: Source) => {
    setEditingSource(source);
    setFormData({
      name: source.name,
      source_type: source.source_type,
      url: source.url,
      category: source.category || '',
      territory: source.territory || '',
      poll_interval_minutes: source.poll_interval_minutes
    });
    setShowAddForm(true);
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
        <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-5 gap-3">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-white">{stats.total_sources}</p>
            <p className="text-xs text-gray-400">Total Sources</p>
          </div>
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-green-400">{stats.active_sources}</p>
            <p className="text-xs text-gray-400">Active</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-white">{stats.total_items}</p>
            <p className="text-xs text-gray-400">Feed Items</p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-amber-400">{stats.pending_items}</p>
            <p className="text-xs text-gray-400">Pending</p>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-red-400">{stats.total_errors}</p>
            <p className="text-xs text-gray-400">Errors</p>
          </div>
        </div>
      )}

      {/* Add Source Button */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            setEditingSource(null);
            setFormData({ name: '', source_type: 'rss', url: '', category: '', territory: '', poll_interval_minutes: 60 });
            setShowAddForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-gray-900 font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Source
        </button>
      </div>

      {/* Add/Edit Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 w-full max-w-lg mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                {editingSource ? 'Edit Source' : 'Add New Source'}
              </h3>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setEditingSource(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
                  placeholder="Toast Blog"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Source Type</label>
                <select
                  value={formData.source_type}
                  onChange={e => setFormData({ ...formData, source_type: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
                >
                  {SOURCE_TYPES.map(st => (
                    <option key={st.value} value={st.value}>{st.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">URL</label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={e => setFormData({ ...formData, url: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
                  placeholder="https://pos.toasttab.com/blog/rss.xml"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="">Select...</option>
                    {CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Territory</label>
                  <input
                    type="text"
                    value={formData.territory}
                    onChange={e => setFormData({ ...formData, territory: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
                    placeholder="national"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Poll Interval (minutes)</label>
                <input
                  type="number"
                  value={formData.poll_interval_minutes}
                  onChange={e => setFormData({ ...formData, poll_interval_minutes: parseInt(e.target.value) || 60 })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
                  min={5}
                  max={1440}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingSource(null);
                  }}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-gray-900 font-medium rounded-lg transition-colors"
                >
                  {editingSource ? 'Update' : 'Create'} Source
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sources List */}
      <div className="grid gap-4">
        {sources.length === 0 ? (
          <div className="text-center py-12 bg-gray-800/30 rounded-lg">
            <Rss className="w-10 h-10 mx-auto mb-3 text-gray-600" />
            <p className="text-lg font-medium text-gray-400">No sources configured</p>
            <p className="text-sm mt-1 text-gray-500">Add an RSS feed or Reddit source to start monitoring.</p>
          </div>
        ) : (
          sources.map(source => (
            <div key={source.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    source.is_active ? 'bg-green-500/20' : 'bg-gray-700'
                  }`}>
                    {source.source_type === 'reddit' ? (
                      <Globe className={`w-6 h-6 ${source.is_active ? 'text-green-400' : 'text-gray-500'}`} />
                    ) : (
                      <Rss className={`w-6 h-6 ${source.is_active ? 'text-green-400' : 'text-gray-500'}`} />
                    )}
                  </div>
                  <div>
                    <h4 className="text-white font-medium flex items-center gap-2">
                      {source.name}
                      {source.error_count > 0 && (
                        <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">
                          {source.error_count} errors
                        </span>
                      )}
                    </h4>
                    <p className="text-gray-500 text-sm">{source.source_type}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span className="text-gray-400">
                        Items: <span className="text-white">{source.item_count || 0}</span>
                      </span>
                      <span className="text-gray-400">
                        Pending: <span className="text-amber-400">{source.pending_count || 0}</span>
                      </span>
                      <span className="text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimeAgo(source.last_polled_at)}
                      </span>
                    </div>
                    {source.last_error && (
                      <div className="flex items-center gap-2 mt-2 text-red-400 text-xs">
                        <AlertCircle className="w-3 h-3" />
                        {source.last_error}
                      </div>
                    )}
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-500 hover:text-amber-400 mt-1 flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {source.url.substring(0, 50)}...
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePoll(source.id)}
                    disabled={pollingSource === source.id || !source.is_active}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                    title="Poll now"
                  >
                    <RefreshCw className={`w-4 h-4 ${pollingSource === source.id ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => openEditForm(source)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleToggle(source)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                    title={source.is_active ? 'Disable' : 'Enable'}
                  >
                    {source.is_active ? (
                      <ToggleRight className="w-6 h-6 text-green-400" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-gray-500" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(source.id)}
                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Default Sources Info */}
      <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-400 mb-2">Suggested Sources</h4>
        <ul className="text-xs text-gray-500 space-y-1">
          <li>Toast Blog RSS: https://pos.toasttab.com/blog/rss.xml</li>
          <li>Reddit r/ToastPOS: https://www.reddit.com/r/ToastPOS.json</li>
          <li>NRA SmartBrief: https://www.smartbrief.com/servlet/rss?b=NRA</li>
          <li>Restaurant Business Magazine: https://www.restaurantbusinessonline.com/rss.xml</li>
        </ul>
      </div>
    </div>
  );
};

export default SourceManager;
