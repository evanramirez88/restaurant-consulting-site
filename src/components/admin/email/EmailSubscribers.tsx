import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Search, RefreshCw, Upload, Download, Tag, Play, Trash2, Filter,
  ChevronLeft, ChevronRight, Users, Mail, Building2, MapPin, Star,
  CheckSquare, Square, Loader2, X, MoreVertical, AlertCircle, Check,
  Calendar, Sliders, Save, Bookmark, ChevronDown, ChevronUp, History,
  Zap, MinusSquare, Clock, ChevronsLeft, ChevronsRight
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

interface Sequence {
  id: string;
  name: string;
  status: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface FilterState {
  statuses: string[];
  pos_systems: string[];
  geographic_tiers: string[];
  lead_sources: string[];
  score_min: number;
  score_max: number;
  tags: string[];
  created_after: string;
  created_before: string;
}

interface FilterPreset {
  id: string;
  name: string;
  filters: FilterState;
}

interface EmailLogEntry {
  id: string;
  subject: string;
  sent_at: number;
  opened_at: number | null;
  clicked_at: number | null;
  bounced: boolean;
}

const DEFAULT_FILTERS: FilterState = {
  statuses: [],
  pos_systems: [],
  geographic_tiers: [],
  lead_sources: [],
  score_min: 0,
  score_max: 100,
  tags: [],
  created_after: '',
  created_before: ''
};

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250];
const ROW_HEIGHT = 52;
const VISIBLE_ROWS = 15;

const EmailSubscribers: React.FC = () => {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pageSize, setPageSize] = useState(() => {
    const saved = localStorage.getItem('emailSubscribers_pageSize');
    return saved ? parseInt(saved) : 100;
  });
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: pageSize,
    total: 0,
    totalPages: 0
  });
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [selectedSubscriber, setSelectedSubscriber] = useState<Subscriber | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [bulkAction, setBulkAction] = useState<'tag' | 'remove_tag' | 'enroll' | 'status' | 'delete' | null>(null);
  const [bulkTagInput, setBulkTagInput] = useState('');
  const [bulkStatusInput, setBulkStatusInput] = useState('');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availablePOSSystems, setAvailablePOSSystems] = useState<string[]>([]);
  const [availableTiers, setAvailableTiers] = useState<string[]>([]);
  const [availableLeadSources, setAvailableLeadSources] = useState<string[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>(() => {
    const saved = localStorage.getItem('emailSubscribers_filterPresets');
    return saved ? JSON.parse(saved) : [];
  });
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [jumpToPage, setJumpToPage] = useState('');

  // Quick action states
  const [quickActionSubscriberId, setQuickActionSubscriberId] = useState<string | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<EmailLogEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showQuickTagDropdown, setShowQuickTagDropdown] = useState<string | null>(null);
  const [showQuickStatusDropdown, setShowQuickStatusDropdown] = useState<string | null>(null);
  const [showQuickEnrollDropdown, setShowQuickEnrollDropdown] = useState<string | null>(null);

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Save page size preference
  useEffect(() => {
    localStorage.setItem('emailSubscribers_pageSize', pageSize.toString());
  }, [pageSize]);

  // Save filter presets
  useEffect(() => {
    localStorage.setItem('emailSubscribers_filterPresets', JSON.stringify(filterPresets));
  }, [filterPresets]);

  // Load sequences for enrollment dropdown
  useEffect(() => {
    loadSequences();
  }, []);

  const loadSequences = async () => {
    try {
      const response = await fetch('/api/admin/email/sequences');
      const result = await response.json();
      if (result.success) {
        setSequences(result.data.filter((s: Sequence) => s.status === 'active'));
      }
    } catch (err) {
      console.error('Failed to load sequences:', err);
    }
  };

  // Load subscribers
  const loadSubscribers = useCallback(async (page = 1, limit = pageSize) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });

      if (debouncedSearch) params.append('search', debouncedSearch);
      if (filters.statuses.length > 0) params.append('statuses', filters.statuses.join(','));
      if (filters.pos_systems.length > 0) params.append('pos_systems', filters.pos_systems.join(','));
      if (filters.geographic_tiers.length > 0) params.append('geographic_tiers', filters.geographic_tiers.join(','));
      if (filters.lead_sources.length > 0) params.append('lead_sources', filters.lead_sources.join(','));
      if (filters.score_min > 0) params.append('score_min', filters.score_min.toString());
      if (filters.score_max < 100) params.append('score_max', filters.score_max.toString());
      if (filters.tags.length > 0) params.append('tags', filters.tags.join(','));
      if (filters.created_after) params.append('created_after', filters.created_after);
      if (filters.created_before) params.append('created_before', filters.created_before);

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
          if (result.meta.lead_sources) setAvailableLeadSources(result.meta.lead_sources);
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
  }, [debouncedSearch, filters, pageSize]);

  useEffect(() => {
    loadSubscribers(1, pageSize);
    setSelectedIds(new Set());
    setSelectAllMatching(false);
  }, [debouncedSearch, filters, pageSize]);

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
    if (selectedIds.size === subscribers.length && !selectAllMatching) {
      setSelectedIds(new Set());
      setSelectAllMatching(false);
    } else {
      setSelectedIds(new Set(subscribers.map(s => s.id)));
      setSelectAllMatching(false);
    }
  };

  const toggleSelectAllMatching = () => {
    if (selectAllMatching) {
      setSelectAllMatching(false);
      setSelectedIds(new Set());
    } else {
      setSelectAllMatching(true);
      setSelectedIds(new Set(subscribers.map(s => s.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
      setSelectAllMatching(false);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Get effective selection count for bulk operations
  const getEffectiveSelectionCount = () => {
    if (selectAllMatching) {
      return pagination.total;
    }
    return selectedIds.size;
  };

  // Bulk operations helper
  const executeBulkOperation = async (action: string, data: any) => {
    const payload: any = {
      action,
      ...data
    };

    if (selectAllMatching) {
      // Include filters so API can apply to all matching
      payload.selectAllMatching = true;
      payload.filters = {
        search: debouncedSearch,
        ...filters
      };
    } else {
      payload.ids = Array.from(selectedIds);
    }

    return fetch('/api/admin/email/subscribers/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  };

  // Bulk actions
  const handleBulkTag = async (tagToAdd?: string) => {
    const tag = tagToAdd || bulkTagInput.trim();
    if (!tag || getEffectiveSelectionCount() === 0) return;

    setBulkProgress({ current: 0, total: getEffectiveSelectionCount() });

    try {
      const response = await executeBulkOperation('tag', { tag });
      const result = await response.json();

      if (result.success) {
        setSuccessMessage(result.message || `Added tag "${tag}" to ${result.affected} subscriber(s)`);
        setBulkAction(null);
        setBulkTagInput('');
        setSelectedIds(new Set());
        setSelectAllMatching(false);
        loadSubscribers(pagination.page);
      } else {
        setError(result.error || 'Failed to tag subscribers');
      }
    } catch (err) {
      setError('Failed to tag subscribers');
    } finally {
      setBulkProgress(null);
    }
  };

  const handleBulkRemoveTag = async (tagToRemove?: string) => {
    const tag = tagToRemove || bulkTagInput.trim();
    if (!tag || getEffectiveSelectionCount() === 0) return;

    setBulkProgress({ current: 0, total: getEffectiveSelectionCount() });

    try {
      const response = await executeBulkOperation('remove_tag', { tag });
      const result = await response.json();

      if (result.success) {
        setSuccessMessage(result.message || `Removed tag "${tag}" from ${result.affected} subscriber(s)`);
        setBulkAction(null);
        setBulkTagInput('');
        setSelectedIds(new Set());
        setSelectAllMatching(false);
        loadSubscribers(pagination.page);
      } else {
        setError(result.error || 'Failed to remove tag');
      }
    } catch (err) {
      setError('Failed to remove tag');
    } finally {
      setBulkProgress(null);
    }
  };

  const handleBulkStatus = async (statusToSet?: string) => {
    const status = statusToSet || bulkStatusInput;
    if (!status || getEffectiveSelectionCount() === 0) return;

    setBulkProgress({ current: 0, total: getEffectiveSelectionCount() });

    try {
      const response = await executeBulkOperation('update_status', { status });
      const result = await response.json();

      if (result.success) {
        setSuccessMessage(result.message || `Updated ${result.affected} subscriber(s) to "${status}"`);
        setBulkAction(null);
        setBulkStatusInput('');
        setSelectedIds(new Set());
        setSelectAllMatching(false);
        loadSubscribers(pagination.page);
      } else {
        setError(result.error || 'Failed to update status');
      }
    } catch (err) {
      setError('Failed to update status');
    } finally {
      setBulkProgress(null);
    }
  };

  const handleBulkEnroll = async (sequenceId: string) => {
    if (!sequenceId || getEffectiveSelectionCount() === 0) return;

    setBulkProgress({ current: 0, total: getEffectiveSelectionCount() });

    try {
      const response = await executeBulkOperation('enroll', { sequence_id: sequenceId });
      const result = await response.json();

      if (result.success) {
        setSuccessMessage(result.message || `Enrolled ${result.affected} subscriber(s) in sequence`);
        setBulkAction(null);
        setSelectedIds(new Set());
        setSelectAllMatching(false);
        loadSubscribers(pagination.page);
      } else {
        setError(result.error || 'Failed to enroll subscribers');
      }
    } catch (err) {
      setError('Failed to enroll subscribers');
    } finally {
      setBulkProgress(null);
    }
  };

  const handleBulkDelete = async () => {
    if (getEffectiveSelectionCount() === 0) return;

    const confirmMsg = selectAllMatching
      ? `Are you sure you want to delete ALL ${pagination.total.toLocaleString()} matching subscribers? This cannot be undone.`
      : `Are you sure you want to delete ${selectedIds.size} subscriber(s)? This cannot be undone.`;

    if (!confirm(confirmMsg)) {
      return;
    }

    setBulkProgress({ current: 0, total: getEffectiveSelectionCount() });

    try {
      const response = await executeBulkOperation('delete', {});
      const result = await response.json();

      if (result.success) {
        setSuccessMessage(result.message || `Deleted ${result.affected} subscriber(s)`);
        setBulkAction(null);
        setSelectedIds(new Set());
        setSelectAllMatching(false);
        loadSubscribers(1);
      } else {
        setError(result.error || 'Failed to delete subscribers');
      }
    } catch (err) {
      setError('Failed to delete subscribers');
    } finally {
      setBulkProgress(null);
    }
  };

  // Quick actions handlers
  const handleQuickTag = async (subscriberId: string, tag: string) => {
    try {
      const response = await fetch('/api/admin/email/subscribers/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'tag',
          ids: [subscriberId],
          tag
        })
      });
      const result = await response.json();
      if (result.success) {
        setShowQuickTagDropdown(null);
        loadSubscribers(pagination.page);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to add tag');
    }
  };

  const handleQuickStatus = async (subscriberId: string, status: string) => {
    try {
      const response = await fetch('/api/admin/email/subscribers/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_status',
          ids: [subscriberId],
          status
        })
      });
      const result = await response.json();
      if (result.success) {
        setShowQuickStatusDropdown(null);
        loadSubscribers(pagination.page);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to update status');
    }
  };

  const handleQuickEnroll = async (subscriberId: string, sequenceId: string) => {
    try {
      const response = await fetch('/api/admin/email/subscribers/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enroll',
          ids: [subscriberId],
          sequence_id: sequenceId
        })
      });
      const result = await response.json();
      if (result.success) {
        setShowQuickEnrollDropdown(null);
        setSuccessMessage('Subscriber enrolled in sequence');
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to enroll subscriber');
    }
  };

  const loadSubscriberHistory = async (subscriberId: string) => {
    setShowHistoryModal(subscriberId);
    setIsLoadingHistory(true);
    try {
      const response = await fetch(`/api/admin/email/subscribers/${subscriberId}/history`);
      const result = await response.json();
      if (result.success) {
        setHistoryData(result.data || []);
      } else {
        setError(result.error || 'Failed to load history');
      }
    } catch (err) {
      setError('Failed to load history');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Export handler
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (filters.statuses.length > 0) params.append('statuses', filters.statuses.join(','));
      if (filters.pos_systems.length > 0) params.append('pos_systems', filters.pos_systems.join(','));
      if (filters.geographic_tiers.length > 0) params.append('geographic_tiers', filters.geographic_tiers.join(','));
      if (filters.lead_sources.length > 0) params.append('lead_sources', filters.lead_sources.join(','));
      if (filters.score_min > 0) params.append('score_min', filters.score_min.toString());
      if (filters.score_max < 100) params.append('score_max', filters.score_max.toString());
      if (filters.tags.length > 0) params.append('tags', filters.tags.join(','));
      if (filters.created_after) params.append('created_after', filters.created_after);
      if (filters.created_before) params.append('created_before', filters.created_before);

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

  // Filter preset handlers
  const saveFilterPreset = () => {
    if (!presetName.trim()) return;

    const newPreset: FilterPreset = {
      id: crypto.randomUUID(),
      name: presetName.trim(),
      filters: { ...filters }
    };

    setFilterPresets([...filterPresets, newPreset]);
    setPresetName('');
    setShowSavePreset(false);
    setSuccessMessage(`Filter preset "${newPreset.name}" saved`);
  };

  const loadFilterPreset = (preset: FilterPreset) => {
    setFilters(preset.filters);
  };

  const deleteFilterPreset = (presetId: string) => {
    setFilterPresets(filterPresets.filter(p => p.id !== presetId));
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
    setFilters(DEFAULT_FILTERS);
  };

  const hasActiveFilters = filters.statuses.length > 0 || filters.pos_systems.length > 0 ||
    filters.geographic_tiers.length > 0 || filters.lead_sources.length > 0 ||
    filters.score_min > 0 || filters.score_max < 100 || filters.tags.length > 0 ||
    filters.created_after || filters.created_before;

  // Multi-select toggle helper
  const toggleMultiSelect = (arr: string[], value: string): string[] => {
    if (arr.includes(value)) {
      return arr.filter(v => v !== value);
    }
    return [...arr, value];
  };

  // Page navigation
  const handleJumpToPage = () => {
    const page = parseInt(jumpToPage);
    if (page >= 1 && page <= pagination.totalPages) {
      loadSubscribers(page, pageSize);
      setJumpToPage('');
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    loadSubscribers(1, newSize);
  };

  // Clear success message after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

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
            {selectedIds.size > 0 && !selectAllMatching && ` (${selectedIds.size} selected)`}
            {selectAllMatching && ` (all ${pagination.total.toLocaleString()} matching selected)`}
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

      {/* Success Alert */}
      {successMessage && (
        <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4 flex items-center gap-3">
          <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
          <p className="text-green-400 text-sm">{successMessage}</p>
          <button
            onClick={() => setSuccessMessage(null)}
            className="ml-auto p-1 text-green-400 hover:text-green-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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

      {/* Bulk Progress */}
      {bulkProgress && (
        <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            <p className="text-blue-400 text-sm">Processing bulk operation...</p>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
            />
          </div>
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
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Advanced Filter Panel */}
        {showFilters && (
          <div className="pt-4 border-t border-gray-700 space-y-4 animate-in slide-in-from-top-2 duration-200">
            {/* Filter Presets */}
            {filterPresets.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Bookmark className="w-4 h-4 text-gray-500" />
                <span className="text-xs text-gray-400">Presets:</span>
                {filterPresets.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => loadFilterPreset(preset)}
                    className="group flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded"
                  >
                    {preset.name}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteFilterPreset(preset.id); }}
                      className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Status Multi-Select */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Status</label>
                <div className="space-y-1">
                  {['active', 'unsubscribed', 'bounced', 'complained'].map(status => (
                    <label key={status} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.statuses.includes(status)}
                        onChange={() => setFilters({ ...filters, statuses: toggleMultiSelect(filters.statuses, status) })}
                        className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500 focus:ring-offset-0 bg-gray-900"
                      />
                      <span className="text-sm text-gray-300 capitalize">{status}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* POS System Multi-Select */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">POS System</label>
                <div className="max-h-32 overflow-y-auto space-y-1 pr-2">
                  {availablePOSSystems.map(pos => (
                    <label key={pos} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.pos_systems.includes(pos)}
                        onChange={() => setFilters({ ...filters, pos_systems: toggleMultiSelect(filters.pos_systems, pos) })}
                        className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500 focus:ring-offset-0 bg-gray-900"
                      />
                      <span className="text-sm text-gray-300 truncate">{pos}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Geographic Tier Multi-Select */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Geographic Tier</label>
                <div className="max-h-32 overflow-y-auto space-y-1 pr-2">
                  {availableTiers.map(tier => (
                    <label key={tier} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.geographic_tiers.includes(tier)}
                        onChange={() => setFilters({ ...filters, geographic_tiers: toggleMultiSelect(filters.geographic_tiers, tier) })}
                        className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500 focus:ring-offset-0 bg-gray-900"
                      />
                      <span className="text-sm text-gray-300 truncate">{tier}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Lead Source Multi-Select */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Lead Source</label>
                <div className="max-h-32 overflow-y-auto space-y-1 pr-2">
                  {availableLeadSources.map(source => (
                    <label key={source} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.lead_sources.includes(source)}
                        onChange={() => setFilters({ ...filters, lead_sources: toggleMultiSelect(filters.lead_sources, source) })}
                        className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500 focus:ring-offset-0 bg-gray-900"
                      />
                      <span className="text-sm text-gray-300 truncate">{source}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Engagement Score Slider */}
              <div className="lg:col-span-2">
                <label className="block text-xs text-gray-400 mb-1">
                  Engagement Score: {filters.score_min} - {filters.score_max}
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={filters.score_min}
                    onChange={(e) => setFilters({
                      ...filters,
                      score_min: Math.min(parseInt(e.target.value), filters.score_max)
                    })}
                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={filters.score_max}
                    onChange={(e) => setFilters({
                      ...filters,
                      score_max: Math.max(parseInt(e.target.value), filters.score_min)
                    })}
                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Created After</label>
                <input
                  type="date"
                  value={filters.created_after}
                  onChange={(e) => setFilters({ ...filters, created_after: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Created Before</label>
                <input
                  type="date"
                  value={filters.created_before}
                  onChange={(e) => setFilters({ ...filters, created_before: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Tags Multi-Select */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Tags</label>
              <div className="flex flex-wrap gap-2">
                {availableTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setFilters({ ...filters, tags: toggleMultiSelect(filters.tags, tag) })}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                      filters.tags.includes(tag)
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                        : 'bg-gray-800 border-gray-600 text-gray-400 hover:text-white'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter Actions */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-amber-400 hover:text-amber-300"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {hasActiveFilters && (
                  <>
                    {showSavePreset ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Preset name..."
                          value={presetName}
                          onChange={(e) => setPresetName(e.target.value)}
                          className="px-2 py-1 bg-gray-900 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          autoFocus
                        />
                        <button
                          onClick={saveFilterPreset}
                          disabled={!presetName.trim()}
                          className="px-2 py-1 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 text-white text-sm rounded"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setShowSavePreset(false); setPresetName(''); }}
                          className="px-2 py-1 text-gray-400 hover:text-white text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowSavePreset(true)}
                        className="flex items-center gap-1 text-sm text-gray-400 hover:text-white"
                      >
                        <Save className="w-3 h-3" />
                        Save as preset
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {(selectedIds.size > 0 || selectAllMatching) && (
        <div className="admin-card p-3 flex flex-wrap items-center gap-4 bg-amber-500/10 border-amber-500/30">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 text-sm font-medium">
              {selectAllMatching
                ? `All ${pagination.total.toLocaleString()} matching`
                : `${selectedIds.size} selected`}
            </span>
            {!selectAllMatching && pagination.total > subscribers.length && (
              <button
                onClick={toggleSelectAllMatching}
                className="text-xs text-amber-400 hover:text-amber-300 underline"
              >
                Select all {pagination.total.toLocaleString()} matching
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setBulkAction('tag')}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
            >
              <Tag className="w-3 h-3" />
              Add Tag
            </button>
            <button
              onClick={() => setBulkAction('remove_tag')}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
            >
              <MinusSquare className="w-3 h-3" />
              Remove Tag
            </button>
            <button
              onClick={() => setBulkAction('status')}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
            >
              <Sliders className="w-3 h-3" />
              Change Status
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
            onClick={() => { setSelectedIds(new Set()); setSelectAllMatching(false); }}
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
            <h3 className="text-lg font-semibold text-white mb-4">
              Add Tag to {getEffectiveSelectionCount().toLocaleString()} Subscriber(s)
            </h3>
            <input
              type="text"
              placeholder="Enter tag name..."
              value={bulkTagInput}
              onChange={(e) => setBulkTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleBulkTag()}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 mb-4"
              autoFocus
            />
            {availableTags.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-400 mb-2">Existing tags:</p>
                <div className="flex flex-wrap gap-2">
                  {availableTags.slice(0, 15).map(tag => (
                    <button
                      key={tag}
                      onClick={() => handleBulkTag(tag)}
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
                onClick={() => handleBulkTag()}
                disabled={!bulkTagInput.trim()}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 disabled:text-gray-400 text-white font-medium rounded-lg transition-colors"
              >
                Add Tag
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Remove Tag Modal */}
      {bulkAction === 'remove_tag' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="admin-card p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">
              Remove Tag from {getEffectiveSelectionCount().toLocaleString()} Subscriber(s)
            </h3>
            <input
              type="text"
              placeholder="Enter tag name to remove..."
              value={bulkTagInput}
              onChange={(e) => setBulkTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleBulkRemoveTag()}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 mb-4"
              autoFocus
            />
            {availableTags.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-400 mb-2">Existing tags:</p>
                <div className="flex flex-wrap gap-2">
                  {availableTags.slice(0, 15).map(tag => (
                    <button
                      key={tag}
                      onClick={() => handleBulkRemoveTag(tag)}
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
                onClick={() => handleBulkRemoveTag()}
                disabled={!bulkTagInput.trim()}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 disabled:text-gray-400 text-white font-medium rounded-lg transition-colors"
              >
                Remove Tag
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Status Modal */}
      {bulkAction === 'status' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="admin-card p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">
              Change Status for {getEffectiveSelectionCount().toLocaleString()} Subscriber(s)
            </h3>
            <div className="space-y-2 mb-4">
              {['active', 'unsubscribed', 'bounced', 'complained'].map(status => (
                <button
                  key={status}
                  onClick={() => handleBulkStatus(status)}
                  className={`w-full px-4 py-3 text-left rounded-lg border transition-colors ${
                    bulkStatusInput === status
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                      : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <span className="capitalize">{status}</span>
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setBulkAction(null); setBulkStatusInput(''); }}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Enroll Modal */}
      {bulkAction === 'enroll' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="admin-card p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">
              Enroll {getEffectiveSelectionCount().toLocaleString()} Subscriber(s) in Sequence
            </h3>
            {sequences.length === 0 ? (
              <p className="text-gray-400 text-sm mb-4">No active sequences available.</p>
            ) : (
              <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                {sequences.map(seq => (
                  <button
                    key={seq.id}
                    onClick={() => handleBulkEnroll(seq.id)}
                    className="w-full px-4 py-3 text-left rounded-lg border bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    <span className="font-medium">{seq.name}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setBulkAction(null)}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation */}
      {bulkAction === 'delete' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="admin-card p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-2">
              Delete {getEffectiveSelectionCount().toLocaleString()} Subscriber(s)?
            </h3>
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

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="admin-card p-6 w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-amber-400" />
                Email History
              </h3>
              <button
                onClick={() => { setShowHistoryModal(null); setHistoryData([]); }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                </div>
              ) : historyData.length === 0 ? (
                <div className="text-center py-8">
                  <Mail className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No email history found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyData.map(email => (
                    <div key={email.id} className="bg-gray-800/50 rounded-lg p-3">
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-white text-sm font-medium">{email.subject}</p>
                        {email.bounced && (
                          <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded">Bounced</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span>Sent: {formatDate(email.sent_at)}</span>
                        {email.opened_at && <span className="text-blue-400">Opened: {formatDate(email.opened_at)}</span>}
                        {email.clicked_at && <span className="text-green-400">Clicked: {formatDate(email.clicked_at)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
              <table className="w-full min-w-[1200px]">
                <thead>
                  <tr className="border-b border-gray-700 bg-gray-800/50">
                    <th className="px-4 py-3 text-left w-12">
                      <button
                        onClick={toggleSelectAll}
                        className="text-gray-400 hover:text-white"
                      >
                        {selectedIds.size === subscribers.length && !selectAllMatching ? (
                          <CheckSquare className="w-4 h-4 text-amber-400" />
                        ) : selectAllMatching ? (
                          <CheckSquare className="w-4 h-4 text-amber-400" />
                        ) : selectedIds.size > 0 ? (
                          <MinusSquare className="w-4 h-4 text-amber-400" />
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider w-32">Actions</th>
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
                <table className="w-full min-w-[1200px]" style={{ transform: `translateY(${offsetY}px)` }}>
                  <tbody className="divide-y divide-gray-700/50">
                    {visibleSubscribers.map((subscriber) => (
                      <tr
                        key={subscriber.id}
                        className={`hover:bg-gray-800/30 transition-colors ${
                          selectedIds.has(subscriber.id) || selectAllMatching ? 'bg-amber-500/10' : ''
                        }`}
                        style={{ height: `${ROW_HEIGHT}px` }}
                      >
                        <td className="px-4 py-3 w-12">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelect(subscriber.id);
                            }}
                            className="text-gray-400 hover:text-white"
                          >
                            {selectedIds.has(subscriber.id) || selectAllMatching ? (
                              <CheckSquare className="w-4 h-4 text-amber-400" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td
                          className="px-4 py-3 cursor-pointer"
                          onClick={() => setSelectedSubscriber(subscriber)}
                        >
                          <div className="flex items-center gap-2">
                            <Mail className="w-3 h-3 text-gray-500" />
                            <span className="text-white text-sm truncate max-w-[200px]">
                              {subscriber.email}
                            </span>
                          </div>
                        </td>
                        <td
                          className="px-4 py-3 text-gray-300 text-sm cursor-pointer"
                          onClick={() => setSelectedSubscriber(subscriber)}
                        >
                          {subscriber.first_name || subscriber.last_name
                            ? `${subscriber.first_name || ''} ${subscriber.last_name || ''}`.trim()
                            : '-'}
                        </td>
                        <td
                          className="px-4 py-3 cursor-pointer"
                          onClick={() => setSelectedSubscriber(subscriber)}
                        >
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
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {/* Quick Tag */}
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowQuickTagDropdown(showQuickTagDropdown === subscriber.id ? null : subscriber.id);
                                  setShowQuickStatusDropdown(null);
                                  setShowQuickEnrollDropdown(null);
                                }}
                                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                                title="Add tag"
                              >
                                <Tag className="w-3.5 h-3.5" />
                              </button>
                              {showQuickTagDropdown === subscriber.id && (
                                <div className="absolute right-0 top-full mt-1 w-48 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50">
                                  <div className="p-2 max-h-48 overflow-y-auto">
                                    {availableTags.length === 0 ? (
                                      <p className="text-gray-400 text-xs p-2">No tags available</p>
                                    ) : (
                                      availableTags.slice(0, 10).map(tag => (
                                        <button
                                          key={tag}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleQuickTag(subscriber.id, tag);
                                          }}
                                          className="w-full text-left px-2 py-1.5 text-sm text-gray-300 hover:bg-gray-700 rounded"
                                        >
                                          {tag}
                                        </button>
                                      ))
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Quick Status */}
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowQuickStatusDropdown(showQuickStatusDropdown === subscriber.id ? null : subscriber.id);
                                  setShowQuickTagDropdown(null);
                                  setShowQuickEnrollDropdown(null);
                                }}
                                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                                title="Change status"
                              >
                                <Sliders className="w-3.5 h-3.5" />
                              </button>
                              {showQuickStatusDropdown === subscriber.id && (
                                <div className="absolute right-0 top-full mt-1 w-36 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50">
                                  <div className="p-1">
                                    {['active', 'unsubscribed', 'bounced', 'complained'].map(status => (
                                      <button
                                        key={status}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleQuickStatus(subscriber.id, status);
                                        }}
                                        className={`w-full text-left px-2 py-1.5 text-sm rounded capitalize ${
                                          subscriber.status === status
                                            ? 'bg-amber-500/20 text-amber-400'
                                            : 'text-gray-300 hover:bg-gray-700'
                                        }`}
                                      >
                                        {status}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Quick Enroll */}
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowQuickEnrollDropdown(showQuickEnrollDropdown === subscriber.id ? null : subscriber.id);
                                  setShowQuickTagDropdown(null);
                                  setShowQuickStatusDropdown(null);
                                }}
                                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                                title="Enroll in sequence"
                              >
                                <Play className="w-3.5 h-3.5" />
                              </button>
                              {showQuickEnrollDropdown === subscriber.id && (
                                <div className="absolute right-0 top-full mt-1 w-48 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50">
                                  <div className="p-2 max-h-48 overflow-y-auto">
                                    {sequences.length === 0 ? (
                                      <p className="text-gray-400 text-xs p-2">No sequences available</p>
                                    ) : (
                                      sequences.map(seq => (
                                        <button
                                          key={seq.id}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleQuickEnroll(subscriber.id, seq.id);
                                          }}
                                          className="w-full text-left px-2 py-1.5 text-sm text-gray-300 hover:bg-gray-700 rounded"
                                        >
                                          {seq.name}
                                        </button>
                                      ))
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* View History */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                loadSubscriberHistory(subscriber.id);
                              }}
                              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                              title="View email history"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
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

        {/* Enhanced Pagination */}
        {pagination.totalPages > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t border-gray-700 bg-gray-800/30">
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span>
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total.toLocaleString()} subscribers
              </span>
              <div className="flex items-center gap-2">
                <span>Show:</span>
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
                  className="px-2 py-1 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  {PAGE_SIZE_OPTIONS.map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* First page */}
              <button
                onClick={() => loadSubscribers(1)}
                disabled={pagination.page === 1}
                className="p-2 text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed"
                title="First page"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              {/* Previous page */}
              <button
                onClick={() => loadSubscribers(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="p-2 text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Page info and jump */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-300">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    placeholder="Go"
                    value={jumpToPage}
                    onChange={(e) => setJumpToPage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleJumpToPage()}
                    min="1"
                    max={pagination.totalPages}
                    className="w-16 px-2 py-1 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    onClick={handleJumpToPage}
                    disabled={!jumpToPage || parseInt(jumpToPage) < 1 || parseInt(jumpToPage) > pagination.totalPages}
                    className="px-2 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-white text-sm rounded"
                  >
                    Go
                  </button>
                </div>
              </div>

              {/* Next page */}
              <button
                onClick={() => loadSubscribers(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="p-2 text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              {/* Last page */}
              <button
                onClick={() => loadSubscribers(pagination.totalPages)}
                disabled={pagination.page === pagination.totalPages}
                className="p-2 text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed"
                title="Last page"
              >
                <ChevronsRight className="w-4 h-4" />
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

      {/* Click outside handler for dropdowns */}
      {(showQuickTagDropdown || showQuickStatusDropdown || showQuickEnrollDropdown) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowQuickTagDropdown(null);
            setShowQuickStatusDropdown(null);
            setShowQuickEnrollDropdown(null);
          }}
        />
      )}
    </div>
  );
};

export default EmailSubscribers;
