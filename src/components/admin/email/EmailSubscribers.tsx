import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Search, RefreshCw, Upload, Download, Tag, Play, Trash2, Filter,
  ChevronLeft, ChevronRight, Users, Mail, Building2, MapPin, Star,
  CheckSquare, Square, Loader2, X, MoreVertical, AlertCircle, Check
} from 'lucide-react';
import SubscriberDetail from './SubscriberDetail';
import SubscriberImport from './SubscriberImport';

interface Subscriber {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  phone: string | null;
  pos_system: string | null;
  geographic_tier: string | null;
  lead_source: string | null;
  status: 'active' | 'unsubscribed' | 'bounced' | 'complained';
  engagement_score: number;
  tags: string[];
  total_emails_sent: number;
  total_emails_opened: number;
  total_emails_clicked: number;
  last_email_sent_at: number | null;
  last_email_opened_at: number | null;
  created_at: number;
  updated_at: number;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface FilterState {
  status: string;
  pos_system: string;
  geographic_tier: string;
  score_min: string;
  score_max: string;
  tags: string[];
}

const ITEMS_PER_PAGE = 100;
const ROW_HEIGHT = 52;
const VISIBLE_ROWS = 15;

const EmailSubscribers: React.FC = () => {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: ITEMS_PER_PAGE,
    total: 0,
    totalPages: 0
  });
  const [filters, setFilters] = useState<FilterState>({
    status: '',
    pos_system: '',
    geographic_tier: '',
    score_min: '',
    score_max: '',
    tags: []
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [selectedSubscriber, setSelectedSubscriber] = useState<Subscriber | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [bulkAction, setBulkAction] = useState<'tag' | 'enroll' | 'delete' | null>(null);
  const [bulkTagInput, setBulkTagInput] = useState('');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availablePOSSystems, setAvailablePOSSystems] = useState<string[]>([]);
  const [availableTiers, setAvailableTiers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load subscribers
  const loadSubscribers = useCallback(async (page = 1) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: ITEMS_PER_PAGE.toString()
      });

      if (debouncedSearch) params.append('search', debouncedSearch);
      if (filters.status) params.append('status', filters.status);
      if (filters.pos_system) params.append('pos_system', filters.pos_system);
      if (filters.geographic_tier) params.append('geographic_tier', filters.geographic_tier);
      if (filters.score_min) params.append('score_min', filters.score_min);
      if (filters.score_max) params.append('score_max', filters.score_max);
      if (filters.tags.length > 0) params.append('tags', filters.tags.join(','));

      const response = await fetch(`/api/admin/email/subscribers?${params}`);
      const result = await response.json();

      if (result.success) {
        setSubscribers(result.data.map((s: any) => ({
          ...s,
          tags: s.tags ? (typeof s.tags === 'string' ? JSON.parse(s.tags) : s.tags) : []
        })));
        setPagination(result.pagination);

        // Extract unique values for filter dropdowns
        if (result.meta) {
          if (result.meta.pos_systems) setAvailablePOSSystems(result.meta.pos_systems);
          if (result.meta.geographic_tiers) setAvailableTiers(result.meta.geographic_tiers);
          if (result.meta.tags) setAvailableTags(result.meta.tags);
        }
      } else {
        setError(result.error || 'Failed to load subscribers');
      }
    } catch (err) {
      console.error('Failed to load subscribers:', err);
      setError('Failed to load subscribers');
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, filters]);

  useEffect(() => {
    loadSubscribers(1);
  }, [debouncedSearch, filters]);

  // Virtual scrolling calculations
  const visibleStartIndex = Math.floor(scrollTop / ROW_HEIGHT);
  const visibleEndIndex = Math.min(
    visibleStartIndex + VISIBLE_ROWS + 2,
    subscribers.length
  );
  const visibleSubscribers = subscribers.slice(visibleStartIndex, visibleEndIndex);
  const totalHeight = subscribers.length * ROW_HEIGHT;
  const offsetY = visibleStartIndex * ROW_HEIGHT;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === subscribers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(subscribers.map(s => s.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Bulk actions
  const handleBulkTag = async () => {
    if (!bulkTagInput.trim() || selectedIds.size === 0) return;

    try {
      const response = await fetch('/api/admin/email/subscribers/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'tag',
          ids: Array.from(selectedIds),
          tag: bulkTagInput.trim()
        })
      });

      const result = await response.json();
      if (result.success) {
        setBulkAction(null);
        setBulkTagInput('');
        setSelectedIds(new Set());
        loadSubscribers(pagination.page);
      } else {
        setError(result.error || 'Failed to tag subscribers');
      }
    } catch (err) {
      setError('Failed to tag subscribers');
    }
  };

  const handleBulkEnroll = async (sequenceId: string) => {
    if (selectedIds.size === 0) return;

    try {
      const response = await fetch('/api/admin/email/subscribers/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enroll',
          ids: Array.from(selectedIds),
          sequence_id: sequenceId
        })
      });

      const result = await response.json();
      if (result.success) {
        setBulkAction(null);
        setSelectedIds(new Set());
        loadSubscribers(pagination.page);
      } else {
        setError(result.error || 'Failed to enroll subscribers');
      }
    } catch (err) {
      setError('Failed to enroll subscribers');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedIds.size} subscriber(s)? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch('/api/admin/email/subscribers/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          ids: Array.from(selectedIds)
        })
      });

      const result = await response.json();
      if (result.success) {
        setBulkAction(null);
        setSelectedIds(new Set());
        loadSubscribers(pagination.page);
      } else {
        setError(result.error || 'Failed to delete subscribers');
      }
    } catch (err) {
      setError('Failed to delete subscribers');
    }
  };

  // Export handler
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (filters.status) params.append('status', filters.status);
      if (filters.pos_system) params.append('pos_system', filters.pos_system);
      if (filters.geographic_tier) params.append('geographic_tier', filters.geographic_tier);
      if (filters.score_min) params.append('score_min', filters.score_min);
      if (filters.score_max) params.append('score_max', filters.score_max);
      if (filters.tags.length > 0) params.append('tags', filters.tags.join(','));

      const response = await fetch(`/api/admin/email/subscribers/export?${params}`);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `subscribers_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const result = await response.json();
        setError(result.error || 'Export failed');
      }
    } catch (err) {
      setError('Failed to export subscribers');
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-500/20 text-green-400 border-green-500/50',
      unsubscribed: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
      bounced: 'bg-red-500/20 text-red-400 border-red-500/50',
      complained: 'bg-orange-500/20 text-orange-400 border-orange-500/50'
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs border ${colors[status] || 'bg-gray-500/20 text-gray-400'}`}>
        {status}
      </span>
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return '-';
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      pos_system: '',
      geographic_tier: '',
      score_min: '',
      score_max: '',
      tags: []
    });
  };

  const hasActiveFilters = filters.status || filters.pos_system || filters.geographic_tier ||
    filters.score_min || filters.score_max || filters.tags.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            Email Subscribers
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {pagination.total.toLocaleString()} total subscribers
            {selectedIds.size > 0 && ` (${selectedIds.size} selected)`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadSubscribers(pagination.page)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto p-1 text-red-400 hover:text-red-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="admin-card p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by email, name, or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              showFilters || hasActiveFilters
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                : 'bg-gray-900 border-gray-600 text-gray-400 hover:text-white'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="w-2 h-2 bg-amber-400 rounded-full" />
            )}
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-gray-700">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="unsubscribed">Unsubscribed</option>
                <option value="bounced">Bounced</option>
                <option value="complained">Complained</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">POS System</label>
              <select
                value={filters.pos_system}
                onChange={(e) => setFilters({ ...filters, pos_system: e.target.value })}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">All POS Systems</option>
                {availablePOSSystems.map(pos => (
                  <option key={pos} value={pos}>{pos}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Geographic Tier</label>
              <select
                value={filters.geographic_tier}
                onChange={(e) => setFilters({ ...filters, geographic_tier: e.target.value })}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">All Tiers</option>
                {availableTiers.map(tier => (
                  <option key={tier} value={tier}>{tier}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Engagement Score</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  min="0"
                  max="100"
                  value={filters.score_min}
                  onChange={(e) => setFilters({ ...filters, score_min: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-gray-500">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  min="0"
                  max="100"
                  value={filters.score_max}
                  onChange={(e) => setFilters({ ...filters, score_max: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
            {hasActiveFilters && (
              <div className="sm:col-span-2 lg:col-span-4">
                <button
                  onClick={clearFilters}
                  className="text-sm text-amber-400 hover:text-amber-300"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="admin-card p-3 flex items-center gap-4 bg-amber-500/10 border-amber-500/30">
          <span className="text-amber-400 text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBulkAction('tag')}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
            >
              <Tag className="w-3 h-3" />
              Add Tag
            </button>
            <button
              onClick={() => setBulkAction('enroll')}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
            >
              <Play className="w-3 h-3" />
              Enroll in Sequence
            </button>
            <button
              onClick={() => setBulkAction('delete')}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm rounded transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
          </div>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bulk Tag Modal */}
      {bulkAction === 'tag' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="admin-card p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">Add Tag to {selectedIds.size} Subscriber(s)</h3>
            <input
              type="text"
              placeholder="Enter tag name..."
              value={bulkTagInput}
              onChange={(e) => setBulkTagInput(e.target.value)}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 mb-4"
              autoFocus
            />
            {availableTags.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-400 mb-2">Existing tags:</p>
                <div className="flex flex-wrap gap-2">
                  {availableTags.slice(0, 10).map(tag => (
                    <button
                      key={tag}
                      onClick={() => setBulkTagInput(tag)}
                      className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setBulkAction(null); setBulkTagInput(''); }}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkTag}
                disabled={!bulkTagInput.trim()}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 disabled:text-gray-400 text-white font-medium rounded-lg transition-colors"
              >
                Add Tag
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation */}
      {bulkAction === 'delete' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="admin-card p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-2">Delete {selectedIds.size} Subscriber(s)?</h3>
            <p className="text-gray-400 text-sm mb-4">
              This action cannot be undone. All subscriber data will be permanently removed.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setBulkAction(null)}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="admin-card overflow-hidden">
        {isLoading && subscribers.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          </div>
        ) : subscribers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-white font-semibold mb-2">No Subscribers Found</h3>
            <p className="text-gray-400 text-sm mb-4">
              {searchQuery || hasActiveFilters
                ? 'Try adjusting your search or filters'
                : 'Import subscribers to get started'}
            </p>
            {!searchQuery && !hasActiveFilters && (
              <button
                onClick={() => setShowImport(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
              >
                <Upload className="w-4 h-4" />
                Import CSV
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px]">
                <thead>
                  <tr className="border-b border-gray-700 bg-gray-800/50">
                    <th className="px-4 py-3 text-left w-12">
                      <button
                        onClick={toggleSelectAll}
                        className="text-gray-400 hover:text-white"
                      >
                        {selectedIds.size === subscribers.length ? (
                          <CheckSquare className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Company</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">POS System</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Score</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Tags</th>
                  </tr>
                </thead>
              </table>
            </div>

            {/* Virtual Scrolling Body */}
            <div
              ref={tableContainerRef}
              onScroll={handleScroll}
              className="overflow-x-auto overflow-y-auto"
              style={{ height: `${VISIBLE_ROWS * ROW_HEIGHT}px` }}
            >
              <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
                <table className="w-full min-w-[1000px]" style={{ transform: `translateY(${offsetY}px)` }}>
                  <tbody className="divide-y divide-gray-700/50">
                    {visibleSubscribers.map((subscriber) => (
                      <tr
                        key={subscriber.id}
                        className={`hover:bg-gray-800/30 transition-colors cursor-pointer ${
                          selectedIds.has(subscriber.id) ? 'bg-amber-500/10' : ''
                        }`}
                        style={{ height: `${ROW_HEIGHT}px` }}
                        onClick={() => setSelectedSubscriber(subscriber)}
                      >
                        <td className="px-4 py-3 w-12">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelect(subscriber.id);
                            }}
                            className="text-gray-400 hover:text-white"
                          >
                            {selectedIds.has(subscriber.id) ? (
                              <CheckSquare className="w-4 h-4 text-amber-400" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Mail className="w-3 h-3 text-gray-500" />
                            <span className="text-white text-sm truncate max-w-[200px]">
                              {subscriber.email}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-300 text-sm">
                          {subscriber.first_name || subscriber.last_name
                            ? `${subscriber.first_name || ''} ${subscriber.last_name || ''}`.trim()
                            : '-'}
                        </td>
                        <td className="px-4 py-3">
                          {subscriber.company ? (
                            <div className="flex items-center gap-2">
                              <Building2 className="w-3 h-3 text-gray-500" />
                              <span className="text-gray-300 text-sm truncate max-w-[150px]">
                                {subscriber.company}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-500 text-sm">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-300 text-sm">
                          {subscriber.pos_system || '-'}
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(subscriber.status)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Star className={`w-3 h-3 ${getScoreColor(subscriber.engagement_score)}`} />
                            <span className={`text-sm font-medium ${getScoreColor(subscriber.engagement_score)}`}>
                              {subscriber.engagement_score}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {subscriber.tags.slice(0, 2).map(tag => (
                              <span
                                key={tag}
                                className="px-1.5 py-0.5 text-xs bg-gray-700 text-gray-300 rounded"
                              >
                                {tag}
                              </span>
                            ))}
                            {subscriber.tags.length > 2 && (
                              <span className="px-1.5 py-0.5 text-xs bg-gray-700 text-gray-400 rounded">
                                +{subscriber.tags.length - 2}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700 bg-gray-800/30">
            <div className="text-sm text-gray-400">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total.toLocaleString()} subscribers
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadSubscribers(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="p-2 text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-300">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => loadSubscribers(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="p-2 text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Subscriber Detail Modal */}
      {selectedSubscriber && (
        <SubscriberDetail
          subscriber={selectedSubscriber}
          onClose={() => setSelectedSubscriber(null)}
          onUpdate={() => {
            setSelectedSubscriber(null);
            loadSubscribers(pagination.page);
          }}
        />
      )}

      {/* Import Modal */}
      {showImport && (
        <SubscriberImport
          onClose={() => setShowImport(false)}
          onImportComplete={() => {
            setShowImport(false);
            loadSubscribers(1);
          }}
          availableTags={availableTags}
        />
      )}
    </div>
  );
};

export default EmailSubscribers;
