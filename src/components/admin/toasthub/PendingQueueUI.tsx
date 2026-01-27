import React, { useState, useEffect, useCallback } from 'react';
import {
  Inbox, CheckCircle, XCircle, Eye, EyeOff, Globe, Users, Briefcase,
  Loader2, RefreshCw, ChevronRight, ExternalLink, Edit3, Sparkles,
  FileText, Clock, Filter, CheckSquare, Square, ArrowUpRight
} from 'lucide-react';

interface Import {
  id: string;
  source_id: string | null;
  source_name: string | null;
  source_type: string | null;
  external_id: string | null;
  external_url: string | null;
  title: string;
  excerpt: string | null;
  content_body: string | null;
  author: string | null;
  published_at: number | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: number | null;
  visible_public: number;
  visible_client_portal: number;
  visible_rep_portal: number;
  post_id: string | null;
  tldr_summary: string | null;
  expert_commentary: string | null;
  ai_score: number | null;
  created_at: number;
}

interface Counts {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

interface PendingQueueUIProps {
  onEditImport?: (importItem: Import) => void;
}

const PendingQueueUI: React.FC<PendingQueueUIProps> = ({ onEditImport }) => {
  const [imports, setImports] = useState<Import[]>([]);
  const [counts, setCounts] = useState<Counts>({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const loadImports = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus && filterStatus !== 'all') {
        params.set('status', filterStatus);
      }
      params.set('limit', '50');

      const response = await fetch(`/api/admin/toast-hub/imports?${params}`, {
        credentials: 'include'
      });
      const result = await response.json();

      if (result.success) {
        setImports(result.data || []);
        setCounts(result.counts || { total: 0, pending: 0, approved: 0, rejected: 0 });
      }
    } catch (error) {
      console.error('Failed to load imports:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    loadImports();
  }, [loadImports]);

  const updateImportStatus = async (id: string, status: 'approved' | 'rejected') => {
    setProcessingIds(prev => new Set(prev).add(id));
    try {
      const response = await fetch(`/api/admin/toast-hub/imports/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status })
      });
      const result = await response.json();
      if (result.success) {
        setImports(prev => prev.map(i => i.id === id ? { ...i, status } : i));
        setCounts(prev => ({
          ...prev,
          pending: prev.pending - 1,
          [status]: prev[status] + 1
        }));
      }
    } catch (error) {
      console.error('Failed to update import:', error);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const updateVisibility = async (id: string, field: string, value: boolean) => {
    setProcessingIds(prev => new Set(prev).add(id));
    try {
      const response = await fetch(`/api/admin/toast-hub/imports/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [field]: value ? 1 : 0 })
      });
      const result = await response.json();
      if (result.success) {
        setImports(prev => prev.map(i => i.id === id ? { ...i, [field]: value ? 1 : 0 } : i));
      }
    } catch (error) {
      console.error('Failed to update visibility:', error);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const promoteToPost = async (id: string) => {
    if (!confirm('Promote this import to a published post?')) return;
    setProcessingIds(prev => new Set(prev).add(id));
    try {
      const response = await fetch(`/api/admin/toast-hub/imports/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'promote' })
      });
      const result = await response.json();
      if (result.success) {
        loadImports();
      } else {
        alert(result.error || 'Failed to promote');
      }
    } catch (error) {
      console.error('Failed to promote:', error);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const bulkUpdateStatus = async (status: 'approved' | 'rejected') => {
    if (selectedIds.size === 0) return;
    if (!confirm(`${status === 'approved' ? 'Approve' : 'Reject'} ${selectedIds.size} selected items?`)) return;

    try {
      const response = await fetch('/api/admin/toast-hub/imports', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'bulk_status',
          ids: Array.from(selectedIds),
          status
        })
      });
      const result = await response.json();
      if (result.success) {
        setSelectedIds(new Set());
        loadImports();
      }
    } catch (error) {
      console.error('Failed to bulk update:', error);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === imports.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(imports.map(i => i.id)));
    }
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getSourceBadge = (item: Import) => {
    if (!item.source_type) return null;
    const colors: Record<string, string> = {
      rss: 'bg-orange-500/20 text-orange-400',
      reddit: 'bg-red-500/20 text-red-400',
      manual: 'bg-blue-500/20 text-blue-400',
      data_context: 'bg-purple-500/20 text-purple-400'
    };
    return (
      <span className={`px-2 py-0.5 text-xs rounded ${colors[item.source_type] || 'bg-zinc-700 text-zinc-400'}`}>
        {item.source_name || item.source_type}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-4 gap-4">
        <button
          onClick={() => setFilterStatus('all')}
          className={`p-4 rounded-lg border transition-colors ${
            filterStatus === 'all'
              ? 'bg-zinc-800 border-orange-500'
              : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
          }`}
        >
          <div className="text-2xl font-bold text-white">{counts.total}</div>
          <div className="text-sm text-zinc-400">Total</div>
        </button>
        <button
          onClick={() => setFilterStatus('pending')}
          className={`p-4 rounded-lg border transition-colors ${
            filterStatus === 'pending'
              ? 'bg-zinc-800 border-orange-500'
              : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
          }`}
        >
          <div className="text-2xl font-bold text-amber-400">{counts.pending}</div>
          <div className="text-sm text-zinc-400">Pending</div>
        </button>
        <button
          onClick={() => setFilterStatus('approved')}
          className={`p-4 rounded-lg border transition-colors ${
            filterStatus === 'approved'
              ? 'bg-zinc-800 border-orange-500'
              : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
          }`}
        >
          <div className="text-2xl font-bold text-green-400">{counts.approved}</div>
          <div className="text-sm text-zinc-400">Approved</div>
        </button>
        <button
          onClick={() => setFilterStatus('rejected')}
          className={`p-4 rounded-lg border transition-colors ${
            filterStatus === 'rejected'
              ? 'bg-zinc-800 border-orange-500'
              : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
          }`}
        >
          <div className="text-2xl font-bold text-red-400">{counts.rejected}</div>
          <div className="text-sm text-zinc-400">Rejected</div>
        </button>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={selectAll}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-zinc-800 rounded hover:bg-zinc-700"
          >
            {selectedIds.size === imports.length && imports.length > 0 ? (
              <CheckSquare size={16} className="text-orange-400" />
            ) : (
              <Square size={16} />
            )}
            Select All
          </button>
          {selectedIds.size > 0 && (
            <>
              <button
                onClick={() => bulkUpdateStatus('approved')}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-green-600 rounded hover:bg-green-500"
              >
                <CheckCircle size={16} />
                Approve ({selectedIds.size})
              </button>
              <button
                onClick={() => bulkUpdateStatus('rejected')}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-red-600 rounded hover:bg-red-500"
              >
                <XCircle size={16} />
                Reject ({selectedIds.size})
              </button>
            </>
          )}
        </div>
        <button
          onClick={loadImports}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-zinc-800 rounded hover:bg-zinc-700"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Import List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      ) : imports.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          <Inbox className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No imports found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {imports.map(item => (
            <div
              key={item.id}
              className={`bg-zinc-900 border rounded-lg overflow-hidden transition-colors ${
                selectedIds.has(item.id) ? 'border-orange-500' : 'border-zinc-800'
              }`}
            >
              {/* Main Row */}
              <div className="flex items-center gap-4 p-4">
                <button
                  onClick={() => toggleSelect(item.id)}
                  className="flex-shrink-0"
                >
                  {selectedIds.has(item.id) ? (
                    <CheckSquare size={20} className="text-orange-400" />
                  ) : (
                    <Square size={20} className="text-zinc-600" />
                  )}
                </button>

                <button
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  className="flex-shrink-0 text-zinc-500 hover:text-white"
                >
                  <ChevronRight
                    size={20}
                    className={`transition-transform ${expandedId === item.id ? 'rotate-90' : ''}`}
                  />
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getSourceBadge(item)}
                    {item.ai_score && (
                      <span className="px-2 py-0.5 text-xs rounded bg-zinc-700 text-zinc-300">
                        Score: {item.ai_score.toFixed(0)}
                      </span>
                    )}
                    {item.post_id && (
                      <span className="px-2 py-0.5 text-xs rounded bg-green-500/20 text-green-400">
                        Published
                      </span>
                    )}
                  </div>
                  <h4 className="font-medium text-white truncate">{item.title}</h4>
                  {item.excerpt && (
                    <p className="text-sm text-zinc-400 truncate mt-1">{item.excerpt}</p>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <Clock size={14} className="text-zinc-500" />
                  <span className="text-xs text-zinc-500">{formatDate(item.created_at)}</span>
                </div>

                {/* Quick Actions */}
                {item.status === 'pending' && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => updateImportStatus(item.id, 'approved')}
                      disabled={processingIds.has(item.id)}
                      className="p-2 text-green-400 hover:bg-green-500/20 rounded"
                      title="Approve"
                    >
                      {processingIds.has(item.id) ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <CheckCircle size={18} />
                      )}
                    </button>
                    <button
                      onClick={() => updateImportStatus(item.id, 'rejected')}
                      disabled={processingIds.has(item.id)}
                      className="p-2 text-red-400 hover:bg-red-500/20 rounded"
                      title="Reject"
                    >
                      <XCircle size={18} />
                    </button>
                  </div>
                )}

                {item.status === 'approved' && !item.post_id && (
                  <button
                    onClick={() => promoteToPost(item.id)}
                    disabled={processingIds.has(item.id)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-orange-600 rounded hover:bg-orange-500"
                  >
                    {processingIds.has(item.id) ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <ArrowUpRight size={14} />
                    )}
                    Promote
                  </button>
                )}
              </div>

              {/* Expanded Details */}
              {expandedId === item.id && (
                <div className="border-t border-zinc-800 p-4 bg-zinc-950">
                  {/* Content Preview */}
                  {item.content_body && (
                    <div className="mb-4">
                      <h5 className="text-sm font-medium text-zinc-400 mb-2">Content Preview</h5>
                      <div className="text-sm text-zinc-300 bg-zinc-900 rounded p-3 max-h-48 overflow-y-auto">
                        {item.content_body.slice(0, 1000)}
                        {item.content_body.length > 1000 && '...'}
                      </div>
                    </div>
                  )}

                  {/* GEO Fields */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <h5 className="text-sm font-medium text-zinc-400 mb-2">TL;DR Summary</h5>
                      <div className="text-sm text-zinc-300 bg-zinc-900 rounded p-3">
                        {item.tldr_summary || <span className="text-zinc-600 italic">Not set</span>}
                      </div>
                    </div>
                    <div>
                      <h5 className="text-sm font-medium text-zinc-400 mb-2">Expert Commentary</h5>
                      <div className="text-sm text-zinc-300 bg-zinc-900 rounded p-3">
                        {item.expert_commentary || <span className="text-zinc-600 italic">Not set</span>}
                      </div>
                    </div>
                  </div>

                  {/* Visibility Toggles (Gate 2) */}
                  {item.status === 'approved' && (
                    <div className="mb-4">
                      <h5 className="text-sm font-medium text-zinc-400 mb-2">Visibility (Gate 2)</h5>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => updateVisibility(item.id, 'visible_public', !item.visible_public)}
                          disabled={processingIds.has(item.id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded border ${
                            item.visible_public
                              ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                              : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                          }`}
                        >
                          <Globe size={16} />
                          Public
                          {item.visible_public ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button
                          onClick={() => updateVisibility(item.id, 'visible_client_portal', !item.visible_client_portal)}
                          disabled={processingIds.has(item.id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded border ${
                            item.visible_client_portal
                              ? 'bg-green-500/20 border-green-500 text-green-400'
                              : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                          }`}
                        >
                          <Users size={16} />
                          Client Portal
                          {item.visible_client_portal ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button
                          onClick={() => updateVisibility(item.id, 'visible_rep_portal', !item.visible_rep_portal)}
                          disabled={processingIds.has(item.id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded border ${
                            item.visible_rep_portal
                              ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                              : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                          }`}
                        >
                          <Briefcase size={16} />
                          Rep Portal
                          {item.visible_rep_portal ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    {item.external_url && (
                      <a
                        href={item.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 text-sm bg-zinc-800 rounded hover:bg-zinc-700"
                      >
                        <ExternalLink size={14} />
                        View Source
                      </a>
                    )}
                    <button
                      onClick={() => onEditImport?.(item)}
                      className="flex items-center gap-2 px-3 py-2 text-sm bg-zinc-800 rounded hover:bg-zinc-700"
                    >
                      <Edit3 size={14} />
                      Edit Details
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PendingQueueUI;
