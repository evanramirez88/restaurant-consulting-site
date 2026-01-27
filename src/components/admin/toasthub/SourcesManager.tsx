import React, { useState, useEffect, useCallback } from 'react';
import {
  Rss, Globe, MessageCircle, Database, Plus, Edit3, Trash2,
  Loader2, RefreshCw, CheckCircle, XCircle, AlertTriangle,
  Play, Pause, Settings, ExternalLink, Clock
} from 'lucide-react';

interface Source {
  id: string;
  name: string;
  source_type: 'rss' | 'reddit' | 'api' | 'manual' | 'data_context';
  feed_url: string | null;
  category_id: string | null;
  fetch_frequency_minutes: number;
  last_fetched_at: number | null;
  last_error: string | null;
  consecutive_failures: number;
  is_active: number;
  created_at: number;
  total_imports?: number;
  pending_imports?: number;
  approved_imports?: number;
}

interface Category {
  id: string;
  name: string;
}

const SourcesManager: React.FC = () => {
  const [sources, setSources] = useState<Source[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    source_type: 'rss' as Source['source_type'],
    feed_url: '',
    category_id: '',
    fetch_frequency_minutes: 120,
    is_active: true
  });

  const loadSources = useCallback(async () => {
    setIsLoading(true);
    try {
      const [sourcesRes, categoriesRes] = await Promise.all([
        fetch('/api/admin/toast-hub/sources', { credentials: 'include' }),
        fetch('/api/admin/categories', { credentials: 'include' })
      ]);

      const sourcesResult = await sourcesRes.json();
      const categoriesResult = await categoriesRes.json();

      if (sourcesResult.success) setSources(sourcesResult.data || []);
      if (categoriesResult.success) setCategories(categoriesResult.data || []);
    } catch (error) {
      console.error('Failed to load sources:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  const resetForm = () => {
    setFormData({
      name: '',
      source_type: 'rss',
      feed_url: '',
      category_id: '',
      fetch_frequency_minutes: 120,
      is_active: true
    });
    setEditingSource(null);
    setShowAddForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingSource
        ? `/api/admin/toast-hub/sources/${editingSource.id}`
        : '/api/admin/toast-hub/sources';
      const method = editingSource ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });
      const result = await response.json();

      if (result.success) {
        resetForm();
        loadSources();
      } else {
        alert(result.error || 'Failed to save source');
      }
    } catch (error) {
      console.error('Failed to save source:', error);
    }
  };

  const toggleActive = async (source: Source) => {
    try {
      const response = await fetch(`/api/admin/toast-hub/sources/${source.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: !source.is_active })
      });
      const result = await response.json();
      if (result.success) {
        setSources(prev => prev.map(s =>
          s.id === source.id ? { ...s, is_active: source.is_active ? 0 : 1 } : s
        ));
      }
    } catch (error) {
      console.error('Failed to toggle source:', error);
    }
  };

  const deleteSource = async (source: Source) => {
    if (!confirm(`Delete source "${source.name}"? This cannot be undone.`)) return;
    try {
      const response = await fetch(`/api/admin/toast-hub/sources/${source.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const result = await response.json();
      if (result.success) {
        setSources(prev => prev.filter(s => s.id !== source.id));
      } else {
        alert(result.error || 'Failed to delete');
      }
    } catch (error) {
      console.error('Failed to delete source:', error);
    }
  };

  const testSource = async (source: Source) => {
    if (!source.feed_url) return;
    setTestingId(source.id);
    setTestResult(null);
    try {
      const response = await fetch(`/api/admin/toast-hub/sources/${source.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'test' })
      });
      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      setTestResult({ success: false, error: String(error) });
    } finally {
      setTestingId(null);
    }
  };

  const startEdit = (source: Source) => {
    setEditingSource(source);
    setFormData({
      name: source.name,
      source_type: source.source_type,
      feed_url: source.feed_url || '',
      category_id: source.category_id || '',
      fetch_frequency_minutes: source.fetch_frequency_minutes,
      is_active: !!source.is_active
    });
    setShowAddForm(true);
  };

  const getSourceIcon = (type: Source['source_type']) => {
    switch (type) {
      case 'rss': return <Rss size={18} className="text-orange-400" />;
      case 'reddit': return <MessageCircle size={18} className="text-red-400" />;
      case 'api': return <Globe size={18} className="text-blue-400" />;
      case 'data_context': return <Database size={18} className="text-purple-400" />;
      default: return <Settings size={18} className="text-zinc-400" />;
    }
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp * 1000).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Content Sources</h3>
          <p className="text-sm text-zinc-400">Manage RSS feeds, Reddit sources, and internal data feeds</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadSources}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-zinc-800 rounded hover:bg-zinc-700"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => { resetForm(); setShowAddForm(true); }}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-orange-600 rounded hover:bg-orange-500"
          >
            <Plus size={16} />
            Add Source
          </button>
        </div>
      </div>

      {/* Add/Edit Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              {editingSource ? 'Edit Source' : 'Add Content Source'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Source Type</label>
                <select
                  value={formData.source_type}
                  onChange={e => setFormData(prev => ({ ...prev, source_type: e.target.value as Source['source_type'] }))}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
                  disabled={!!editingSource}
                >
                  <option value="rss">RSS Feed</option>
                  <option value="reddit">Reddit</option>
                  <option value="api">External API</option>
                  <option value="manual">Manual Entry</option>
                  <option value="data_context">DATA_CONTEXT</option>
                </select>
              </div>

              {['rss', 'reddit', 'api'].includes(formData.source_type) && (
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Feed URL</label>
                  <input
                    type="url"
                    value={formData.feed_url}
                    onChange={e => setFormData(prev => ({ ...prev, feed_url: e.target.value }))}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
                    placeholder="https://..."
                    required={['rss', 'reddit'].includes(formData.source_type)}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Default Category</label>
                <select
                  value={formData.category_id}
                  onChange={e => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
                >
                  <option value="">None</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Fetch Frequency (minutes)</label>
                <input
                  type="number"
                  value={formData.fetch_frequency_minutes}
                  onChange={e => setFormData(prev => ({ ...prev, fetch_frequency_minutes: parseInt(e.target.value) || 120 }))}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
                  min={15}
                  max={1440}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={e => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="w-4 h-4"
                />
                <label htmlFor="is_active" className="text-sm text-zinc-300">Active</label>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-sm bg-zinc-800 rounded hover:bg-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-orange-600 rounded hover:bg-orange-500"
                >
                  {editingSource ? 'Save Changes' : 'Add Source'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Test Result Modal */}
      {testResult && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              {testResult.success ? 'Feed Test Successful' : 'Feed Test Failed'}
            </h3>
            {testResult.success ? (
              <div className="space-y-3">
                <p className="text-green-400 flex items-center gap-2">
                  <CheckCircle size={18} />
                  Feed is accessible
                </p>
                <div className="text-sm text-zinc-400">
                  <p>Content Type: {testResult.test_result?.content_type}</p>
                  <p>Content Length: {testResult.test_result?.content_length} bytes</p>
                  <p>Has Items: {testResult.test_result?.has_items ? 'Yes' : 'No'}</p>
                </div>
                {testResult.test_result?.preview && (
                  <div className="bg-zinc-800 rounded p-3 text-xs text-zinc-400 max-h-40 overflow-auto font-mono">
                    {testResult.test_result.preview}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-red-400 flex items-center gap-2">
                <XCircle size={18} />
                {testResult.error}
              </div>
            )}
            <button
              onClick={() => setTestResult(null)}
              className="mt-4 px-4 py-2 text-sm bg-zinc-800 rounded hover:bg-zinc-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Sources List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      ) : sources.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          <Rss className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No content sources configured</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {sources.map(source => (
            <div
              key={source.id}
              className={`bg-zinc-900 border rounded-lg p-4 ${
                source.is_active ? 'border-zinc-800' : 'border-red-900/50 bg-zinc-900/50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-1">{getSourceIcon(source.source_type)}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-white">{source.name}</h4>
                      {!source.is_active && (
                        <span className="px-2 py-0.5 text-xs rounded bg-red-500/20 text-red-400">
                          Inactive
                        </span>
                      )}
                      {source.consecutive_failures >= 3 && (
                        <span className="px-2 py-0.5 text-xs rounded bg-amber-500/20 text-amber-400 flex items-center gap-1">
                          <AlertTriangle size={12} />
                          {source.consecutive_failures} failures
                        </span>
                      )}
                    </div>
                    {source.feed_url && (
                      <a
                        href={source.feed_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
                      >
                        {source.feed_url.slice(0, 60)}
                        {source.feed_url.length > 60 && '...'}
                        <ExternalLink size={12} />
                      </a>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        Every {source.fetch_frequency_minutes} min
                      </span>
                      <span>Last: {formatDate(source.last_fetched_at)}</span>
                      {source.total_imports !== undefined && (
                        <span>{source.total_imports} imports ({source.pending_imports} pending)</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {source.feed_url && (
                    <button
                      onClick={() => testSource(source)}
                      disabled={testingId === source.id}
                      className="p-2 text-zinc-400 hover:bg-zinc-800 rounded"
                      title="Test Feed"
                    >
                      {testingId === source.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Play size={16} />
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => toggleActive(source)}
                    className={`p-2 rounded ${
                      source.is_active
                        ? 'text-green-400 hover:bg-green-500/20'
                        : 'text-zinc-500 hover:bg-zinc-800'
                    }`}
                    title={source.is_active ? 'Disable' : 'Enable'}
                  >
                    {source.is_active ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                  <button
                    onClick={() => startEdit(source)}
                    className="p-2 text-zinc-400 hover:bg-zinc-800 rounded"
                    title="Edit"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    onClick={() => deleteSource(source)}
                    className="p-2 text-red-400 hover:bg-red-500/20 rounded"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SourcesManager;
