import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, RefreshCw, Download, Calendar, Loader2, AlertCircle,
  ChevronDown, Mail, X, Check, XCircle, Clock, RotateCcw, Ban,
  Eye, ChevronRight, Filter, Search, CheckSquare, Square, Trash2,
  FileText, User, Zap, TrendingUp, TrendingDown, ExternalLink
} from 'lucide-react';

// TypeScript Interfaces
interface FailedEmail {
  id: string;
  subscriber_id: string;
  subscriber_email: string;
  subscriber_name?: string;
  sequence_id: string;
  sequence_name: string;
  step_id: string;
  step_number: number;
  step_subject: string;
  error_type: 'bounced' | 'rejected' | 'timed_out' | 'invalid_email' | 'rate_limited' | 'unknown';
  error_message: string;
  error_details?: string;
  failed_at: number;
  retry_count: number;
  last_retry_at?: number;
  status: 'pending' | 'retrying' | 'resolved' | 'suppressed';
  resolved_at?: number;
  resolved_by?: string;
  resolution_note?: string;
  email_content?: string;
}

interface ErrorStats {
  total_24h: number;
  total_7d: number;
  total_30d: number;
  by_type: {
    bounced: number;
    rejected: number;
    timed_out: number;
    invalid_email: number;
    rate_limited: number;
    unknown: number;
  };
  failed_rate: number;
  trend: number;
}

interface RetryHistory {
  attempt: number;
  timestamp: number;
  result: 'failed' | 'success';
  error_message?: string;
}

type DateRangeOption = '24h' | '7d' | '30d' | 'custom';

const ErrorRecovery: React.FC = () => {
  // State
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [failedEmails, setFailedEmails] = useState<FailedEmail[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterErrorType, setFilterErrorType] = useState<string>('all');
  const [filterSequence, setFilterSequence] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [filterRetryable, setFilterRetryable] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeOption>('7d');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Modal state
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedError, setSelectedError] = useState<FailedEmail | null>(null);
  const [retryHistory, setRetryHistory] = useState<RetryHistory[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Action state
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveNote, setResolveNote] = useState('');
  const [resolvingIds, setResolvingIds] = useState<string[]>([]);

  // Suppression modal
  const [showSuppressModal, setShowSuppressModal] = useState(false);
  const [suppressReason, setSuppressReason] = useState<'bounced' | 'complained' | 'manual'>('bounced');
  const [suppressingIds, setSuppressingIds] = useState<string[]>([]);

  // Sequences for filter
  const [sequences, setSequences] = useState<{ id: string; name: string }[]>([]);

  // Trend data for chart
  const [trendData, setTrendData] = useState<{ date: string; count: number }[]>([]);

  // Date range calculation
  const getDateRange = useCallback(() => {
    const end = new Date();
    let start = new Date();

    switch (dateRange) {
      case '24h':
        start.setHours(end.getHours() - 24);
        break;
      case '7d':
        start.setDate(end.getDate() - 7);
        break;
      case '30d':
        start.setDate(end.getDate() - 30);
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          return {
            start_date: Math.floor(new Date(customStartDate).getTime() / 1000),
            end_date: Math.floor(new Date(customEndDate + 'T23:59:59').getTime() / 1000)
          };
        }
        start.setDate(end.getDate() - 7);
        break;
    }

    return {
      start_date: Math.floor(start.getTime() / 1000),
      end_date: Math.floor(end.getTime() / 1000)
    };
  }, [dateRange, customStartDate, customEndDate]);

  // Load sequences
  const loadSequences = async () => {
    try {
      const response = await fetch('/api/admin/email/sequences');
      const result = await response.json();
      if (result.success) {
        setSequences(result.data || []);
      }
    } catch (err) {
      console.error('Failed to load sequences:', err);
    }
  };

  // Load error statistics
  const loadStats = async () => {
    try {
      const response = await fetch('/api/admin/email/errors/stats');
      const result = await response.json();
      if (result.success) {
        setStats(result.data);
        setTrendData(result.data.trend_data || []);
      }
    } catch (err) {
      console.error('Failed to load error stats:', err);
    }
  };

  // Load failed emails
  const loadFailedEmails = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { start_date, end_date } = getDateRange();
      const params = new URLSearchParams({
        start_date: start_date.toString(),
        end_date: end_date.toString(),
        page: page.toString(),
        limit: limit.toString()
      });

      if (filterErrorType !== 'all') params.append('error_type', filterErrorType);
      if (filterSequence !== 'all') params.append('sequence_id', filterSequence);
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (filterRetryable) params.append('retryable', 'true');
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`/api/admin/email/errors?${params}`);
      const result = await response.json();

      if (result.success) {
        setFailedEmails(result.data || []);
        setTotalCount(result.pagination?.total || 0);
      } else {
        setError(result.error || 'Failed to load failed emails');
      }
    } catch (err) {
      console.error('Failed to load failed emails:', err);
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  }, [getDateRange, page, limit, filterErrorType, filterSequence, filterStatus, filterRetryable, searchQuery]);

  // Load error detail
  const loadErrorDetail = async (errorId: string) => {
    setIsLoadingDetail(true);
    try {
      const response = await fetch(`/api/admin/email/errors/${errorId}`);
      const result = await response.json();
      if (result.success) {
        setSelectedError(result.data.error);
        setRetryHistory(result.data.retry_history || []);
      }
    } catch (err) {
      console.error('Failed to load error detail:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadSequences();
    loadStats();
  }, []);

  useEffect(() => {
    loadFailedEmails();
  }, [loadFailedEmails]);

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(failedEmails.map(e => e.id)));
    }
    setSelectAll(!selectAll);
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
    setSelectAll(newSelected.size === failedEmails.length);
  };

  // Retry single email
  const handleRetry = async (errorId: string) => {
    setActionLoading(errorId);
    try {
      const response = await fetch(`/api/admin/email/errors/${errorId}/retry`, {
        method: 'POST'
      });
      const result = await response.json();
      if (result.success) {
        await loadFailedEmails();
        await loadStats();
      } else {
        setError(result.error || 'Failed to retry email');
      }
    } catch (err) {
      setError('Failed to retry email');
    } finally {
      setActionLoading(null);
    }
  };

  // Bulk retry
  const handleBulkRetry = async () => {
    if (selectedIds.size === 0) return;

    setBulkActionLoading(true);
    try {
      const response = await fetch('/api/admin/email/errors/bulk-retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error_ids: Array.from(selectedIds) })
      });
      const result = await response.json();
      if (result.success) {
        setSelectedIds(new Set());
        setSelectAll(false);
        await loadFailedEmails();
        await loadStats();
      } else {
        setError(result.error || 'Failed to retry emails');
      }
    } catch (err) {
      setError('Failed to retry emails');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Retry all retryable
  const handleRetryAllRetryable = async () => {
    setBulkActionLoading(true);
    try {
      const { start_date, end_date } = getDateRange();
      const response = await fetch('/api/admin/email/errors/bulk-retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: {
            retryable: true,
            status: 'pending',
            start_date,
            end_date,
            error_type: filterErrorType !== 'all' ? filterErrorType : undefined,
            sequence_id: filterSequence !== 'all' ? filterSequence : undefined
          }
        })
      });
      const result = await response.json();
      if (result.success) {
        await loadFailedEmails();
        await loadStats();
      } else {
        setError(result.error || 'Failed to retry emails');
      }
    } catch (err) {
      setError('Failed to retry emails');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Open resolve modal
  const openResolveModal = (ids: string[]) => {
    setResolvingIds(ids);
    setResolveNote('');
    setShowResolveModal(true);
  };

  // Handle resolve
  const handleResolve = async () => {
    if (resolvingIds.length === 0) return;

    setBulkActionLoading(true);
    try {
      const endpoint = resolvingIds.length === 1
        ? `/api/admin/email/errors/${resolvingIds[0]}`
        : '/api/admin/email/errors/bulk-resolve';

      const body = resolvingIds.length === 1
        ? { status: 'resolved', resolution_note: resolveNote }
        : { error_ids: resolvingIds, resolution_note: resolveNote };

      const response = await fetch(endpoint, {
        method: resolvingIds.length === 1 ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const result = await response.json();
      if (result.success) {
        setShowResolveModal(false);
        setSelectedIds(new Set());
        setSelectAll(false);
        await loadFailedEmails();
        await loadStats();
      } else {
        setError(result.error || 'Failed to resolve error(s)');
      }
    } catch (err) {
      setError('Failed to resolve error(s)');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Open suppress modal
  const openSuppressModal = (ids: string[]) => {
    setSuppressingIds(ids);
    setSuppressReason('bounced');
    setShowSuppressModal(true);
  };

  // Handle suppress
  const handleSuppress = async () => {
    if (suppressingIds.length === 0) return;

    setBulkActionLoading(true);
    try {
      const response = await fetch('/api/admin/email/errors/bulk-suppress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error_ids: suppressingIds,
          reason: suppressReason
        })
      });

      const result = await response.json();
      if (result.success) {
        setShowSuppressModal(false);
        setSelectedIds(new Set());
        setSelectAll(false);
        await loadFailedEmails();
        await loadStats();
      } else {
        setError(result.error || 'Failed to suppress email(s)');
      }
    } catch (err) {
      setError('Failed to suppress email(s)');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Export to CSV
  const handleExport = async () => {
    try {
      const { start_date, end_date } = getDateRange();
      const params = new URLSearchParams({
        start_date: start_date.toString(),
        end_date: end_date.toString(),
        format: 'csv'
      });

      if (filterErrorType !== 'all') params.append('error_type', filterErrorType);
      if (filterSequence !== 'all') params.append('sequence_id', filterSequence);
      if (filterStatus !== 'all') params.append('status', filterStatus);

      const response = await fetch(`/api/admin/email/errors?${params}`);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `failed_emails_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) {
      setError('Failed to export data');
    }
  };

  // Helper functions
  const formatDate = (timestamp: number) => {
    if (!timestamp) return '-';
    return new Date(timestamp * 1000).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const formatDateFull = (timestamp: number) => {
    if (!timestamp) return '-';
    return new Date(timestamp * 1000).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getErrorTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      bounced: 'bg-red-500/20 text-red-400 border-red-500/30',
      rejected: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      timed_out: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      invalid_email: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      rate_limited: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      unknown: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    };
    return colors[type] || colors.unknown;
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
      pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: <Clock className="w-3 h-3" /> },
      retrying: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: <RefreshCw className="w-3 h-3 animate-spin" /> },
      resolved: { bg: 'bg-green-500/20', text: 'text-green-400', icon: <Check className="w-3 h-3" /> },
      suppressed: { bg: 'bg-gray-500/20', text: 'text-gray-400', icon: <Ban className="w-3 h-3" /> }
    };
    const c = config[status] || config.pending;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${c.bg} ${c.text} border border-current/30`}>
        {c.icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const isRetryable = (email: FailedEmail) => {
    // Can retry if not suppressed, not resolved, and not too many retries
    return email.status !== 'suppressed' &&
           email.status !== 'resolved' &&
           email.retry_count < 5 &&
           !['invalid_email', 'bounced'].includes(email.error_type);
  };

  const getDateRangeLabel = () => {
    switch (dateRange) {
      case '24h': return 'Last 24 hours';
      case '7d': return 'Last 7 days';
      case '30d': return 'Last 30 days';
      case 'custom': return customStartDate && customEndDate
        ? `${customStartDate} - ${customEndDate}`
        : 'Custom range';
      default: return 'Last 7 days';
    }
  };

  // Stat card component
  const StatCard: React.FC<{
    label: string;
    value: number;
    icon: React.ReactNode;
    color: string;
    trend?: number;
  }> = ({ label, value, icon, color, trend }) => (
    <div className="admin-card p-4">
      <div className="flex items-start justify-between mb-2">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
        {trend !== undefined && trend !== 0 && (
          <div className={`flex items-center gap-1 text-xs ${trend > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
      <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">{label}</p>
    </div>
  );

  // Trend mini chart
  const TrendMiniChart: React.FC = () => {
    if (trendData.length < 2) return null;

    const maxCount = Math.max(...trendData.map(d => d.count), 1);
    const width = 200;
    const height = 60;
    const padding = 10;

    const points = trendData.map((d, i) => {
      const x = padding + (i / (trendData.length - 1)) * (width - 2 * padding);
      const y = height - padding - (d.count / maxCount) * (height - 2 * padding);
      return `${x},${y}`;
    }).join(' ');

    return (
      <div className="admin-card p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Failed Emails Trend</h3>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16">
          <polyline
            points={points}
            fill="none"
            stroke="#EF4444"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {trendData.map((d, i) => {
            const x = padding + (i / (trendData.length - 1)) * (width - 2 * padding);
            const y = height - padding - (d.count / maxCount) * (height - 2 * padding);
            return (
              <circle key={i} cx={x} cy={y} r="3" fill="#EF4444" />
            );
          })}
        </svg>
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>{trendData[0]?.date}</span>
          <span>{trendData[trendData.length - 1]?.date}</span>
        </div>
      </div>
    );
  };

  // Loading skeleton
  if (isLoading && !stats) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-gray-700 rounded animate-pulse"></div>
          <div className="flex gap-2">
            <div className="h-10 w-32 bg-gray-700 rounded animate-pulse"></div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="admin-card p-4">
              <div className="h-10 w-10 bg-gray-700 rounded-lg animate-pulse mb-3"></div>
              <div className="h-8 w-20 bg-gray-700 rounded animate-pulse mb-2"></div>
              <div className="h-4 w-16 bg-gray-700 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            Error Recovery
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {totalCount} failed emails - {getDateRangeLabel()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { loadStats(); loadFailedEmails(); }}
            disabled={isLoading}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={handleRetryAllRetryable}
            disabled={bulkActionLoading}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors"
          >
            {bulkActionLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            Retry All Retryable
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-400 text-sm flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <StatCard
          label="Failed (24h)"
          value={stats?.total_24h || 0}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="bg-red-500/20 text-red-400"
        />
        <StatCard
          label="Failed (7d)"
          value={stats?.total_7d || 0}
          icon={<XCircle className="w-5 h-5" />}
          color="bg-orange-500/20 text-orange-400"
        />
        <StatCard
          label="Failed (30d)"
          value={stats?.total_30d || 0}
          icon={<AlertCircle className="w-5 h-5" />}
          color="bg-yellow-500/20 text-yellow-400"
        />
        <StatCard
          label="Failed Rate"
          value={stats?.failed_rate ? parseFloat(stats.failed_rate.toFixed(2)) : 0}
          icon={<TrendingUp className="w-5 h-5" />}
          color="bg-purple-500/20 text-purple-400"
          trend={stats?.trend}
        />
        <TrendMiniChart />
      </div>

      {/* Error Type Breakdown */}
      {stats && (
        <div className="admin-card p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">By Error Type</h3>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {Object.entries(stats.by_type).map(([type, count]) => (
              <button
                key={type}
                onClick={() => setFilterErrorType(filterErrorType === type ? 'all' : type)}
                className={`p-3 rounded-lg border transition-all ${
                  filterErrorType === type
                    ? getErrorTypeColor(type) + ' ring-2 ring-current/50'
                    : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                }`}
              >
                <p className="text-lg font-bold text-white">{count}</p>
                <p className="text-xs text-gray-400 capitalize">{type.replace('_', ' ')}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="admin-card p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by email or error message..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Sequence Filter */}
          <select
            value={filterSequence}
            onChange={(e) => { setFilterSequence(e.target.value); setPage(1); }}
            className="px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">All Sequences</option>
            {sequences.map(seq => (
              <option key={seq.id} value={seq.id}>{seq.name}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            className="px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="retrying">Retrying</option>
            <option value="resolved">Resolved</option>
            <option value="suppressed">Suppressed</option>
          </select>

          {/* Retryable Only Toggle */}
          <button
            onClick={() => { setFilterRetryable(!filterRetryable); setPage(1); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              filterRetryable
                ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                : 'bg-gray-900 border-gray-600 text-gray-300 hover:border-gray-500'
            }`}
          >
            <Filter className="w-4 h-4" />
            Retryable Only
          </button>

          {/* Date Range */}
          <div className="relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white hover:border-gray-500 transition-colors"
            >
              <Calendar className="w-4 h-4 text-gray-400" />
              {getDateRangeLabel()}
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            {showDatePicker && (
              <div className="absolute top-full mt-2 right-0 bg-gray-800 border border-gray-700 rounded-lg p-4 shadow-xl z-20 min-w-[250px]">
                <div className="space-y-2 mb-4">
                  {(['24h', '7d', '30d'] as DateRangeOption[]).map(option => (
                    <button
                      key={option}
                      onClick={() => {
                        setDateRange(option);
                        setShowDatePicker(false);
                        setPage(1);
                      }}
                      className={`w-full px-3 py-2 text-left rounded transition-colors ${
                        dateRange === option
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {option === '24h' ? 'Last 24 hours' : option === '7d' ? 'Last 7 days' : 'Last 30 days'}
                    </button>
                  ))}
                </div>

                <div className="border-t border-gray-700 pt-4">
                  <p className="text-xs text-gray-400 mb-2">Custom Range</p>
                  <div className="space-y-2">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      onClick={() => {
                        if (customStartDate && customEndDate) {
                          setDateRange('custom');
                          setShowDatePicker(false);
                          setPage(1);
                        }
                      }}
                      disabled={!customStartDate || !customEndDate}
                      className="w-full px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 disabled:text-gray-400 text-white font-medium rounded transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="admin-card p-4 bg-amber-500/10 border-amber-500/30">
          <div className="flex items-center justify-between">
            <span className="text-amber-400 font-medium">
              {selectedIds.size} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkRetry}
                disabled={bulkActionLoading}
                className="flex items-center gap-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Retry Selected
              </button>
              <button
                onClick={() => openResolveModal(Array.from(selectedIds))}
                disabled={bulkActionLoading}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-sm font-medium rounded transition-colors"
              >
                <Check className="w-4 h-4" />
                Mark Resolved
              </button>
              <button
                onClick={() => openSuppressModal(Array.from(selectedIds))}
                disabled={bulkActionLoading}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium rounded transition-colors"
              >
                <Ban className="w-4 h-4" />
                Suppress
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Failed Emails Table */}
      <div className="admin-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          </div>
        ) : failedEmails.length === 0 ? (
          <div className="py-12 text-center">
            <Check className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <h3 className="text-white font-semibold mb-2">No Failed Emails</h3>
            <p className="text-gray-400 text-sm">
              {filterStatus !== 'all' || filterErrorType !== 'all' || filterSequence !== 'all'
                ? 'Try adjusting your filters'
                : 'Great job! No failed emails in this period.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700 bg-gray-800/50">
                  <th className="px-4 py-3 text-left">
                    <button onClick={toggleSelectAll} className="text-gray-400 hover:text-white">
                      {selectAll ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Subscriber</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Sequence/Step</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Error Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Error Message</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Failed At</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Retries</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {failedEmails.map((email) => (
                  <tr key={email.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleSelect(email.id)}
                        className="text-gray-400 hover:text-white"
                      >
                        {selectedIds.has(email.id) ? (
                          <CheckSquare className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-gray-400" />
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium truncate max-w-[180px]">
                            {email.subscriber_email}
                          </p>
                          {email.subscriber_name && (
                            <p className="text-gray-500 text-xs">{email.subscriber_name}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-white text-sm">{email.sequence_name}</p>
                        <p className="text-gray-500 text-xs">
                          Step {email.step_number}: {email.step_subject}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs capitalize border ${getErrorTypeColor(email.error_type)}`}>
                        {email.error_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-300 text-sm truncate max-w-[200px]" title={email.error_message}>
                        {email.error_message}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-400 text-sm">{formatDate(email.failed_at)}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                        email.retry_count >= 3 ? 'bg-red-500/20 text-red-400' :
                        email.retry_count >= 1 ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-700 text-gray-400'
                      }`}>
                        {email.retry_count}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(email.status)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {actionLoading === email.id ? (
                          <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                        ) : (
                          <>
                            {isRetryable(email) && (
                              <button
                                onClick={() => handleRetry(email.id)}
                                className="p-1.5 text-gray-400 hover:text-amber-400 hover:bg-gray-700 rounded transition-colors"
                                title="Retry"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                            {email.status === 'pending' && (
                              <button
                                onClick={() => openResolveModal([email.id])}
                                className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-gray-700 rounded transition-colors"
                                title="Mark Resolved"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                            {email.status !== 'suppressed' && (
                              <button
                                onClick={() => openSuppressModal([email.id])}
                                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
                                title="Suppress"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                loadErrorDetail(email.id);
                                setShowDetailModal(true);
                              }}
                              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalCount > limit && (
          <div className="px-4 py-3 border-t border-gray-700 flex items-center justify-between">
            <p className="text-sm text-gray-400">
              Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, totalCount)} of {totalCount}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-700 disabled:text-gray-500 disabled:hover:bg-transparent rounded transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-gray-400">
                Page {page} of {Math.ceil(totalCount / limit)}
              </span>
              <button
                onClick={() => setPage(p => Math.min(Math.ceil(totalCount / limit), p + 1))}
                disabled={page >= Math.ceil(totalCount / limit)}
                className="px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-700 disabled:text-gray-500 disabled:hover:bg-transparent rounded transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error Detail Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/70" onClick={() => setShowDetailModal(false)} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-gray-900 rounded-xl border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                <h3 className="text-lg font-semibold text-white">Error Details</h3>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {isLoadingDetail ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                  </div>
                ) : selectedError ? (
                  <div className="space-y-6">
                    {/* Subscriber Info */}
                    <div className="bg-gray-800/50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-400 mb-3">Subscriber</h4>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center">
                          <User className="w-6 h-6 text-gray-400" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{selectedError.subscriber_email}</p>
                          {selectedError.subscriber_name && (
                            <p className="text-gray-400 text-sm">{selectedError.subscriber_name}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Sequence & Step Info */}
                    <div className="bg-gray-800/50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-400 mb-3">Sequence & Step</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">Sequence</p>
                          <p className="text-white">{selectedError.sequence_name}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Step</p>
                          <p className="text-white">#{selectedError.step_number}: {selectedError.step_subject}</p>
                        </div>
                      </div>
                    </div>

                    {/* Error Info */}
                    <div className="bg-gray-800/50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-400 mb-3">Error Information</h4>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs capitalize border ${getErrorTypeColor(selectedError.error_type)}`}>
                            {selectedError.error_type.replace('_', ' ')}
                          </span>
                          {getStatusBadge(selectedError.status)}
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Error Message</p>
                          <p className="text-white bg-gray-900 rounded p-3 font-mono text-sm">
                            {selectedError.error_message}
                          </p>
                        </div>
                        {selectedError.error_details && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Stack Trace / Details</p>
                            <pre className="text-gray-300 bg-gray-900 rounded p-3 font-mono text-xs overflow-x-auto max-h-40">
                              {selectedError.error_details}
                            </pre>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-4 pt-2">
                          <div>
                            <p className="text-xs text-gray-500">Failed At</p>
                            <p className="text-white text-sm">{formatDateFull(selectedError.failed_at)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Retry Count</p>
                            <p className="text-white text-sm">{selectedError.retry_count} attempts</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Email Content Preview */}
                    {selectedError.email_content && (
                      <div className="bg-gray-800/50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-400 mb-3">Email Content (Attempted)</h4>
                        <div className="bg-gray-900 rounded-lg p-4 max-h-60 overflow-y-auto">
                          <div
                            className="prose prose-sm prose-invert max-w-none"
                            dangerouslySetInnerHTML={{ __html: selectedError.email_content }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Retry History */}
                    {retryHistory.length > 0 && (
                      <div className="bg-gray-800/50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-400 mb-3">Retry History</h4>
                        <div className="space-y-2">
                          {retryHistory.map((attempt, i) => (
                            <div key={i} className="flex items-start gap-3 p-2 bg-gray-900 rounded">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                                attempt.result === 'success' ? 'bg-green-500/20' : 'bg-red-500/20'
                              }`}>
                                {attempt.result === 'success' ? (
                                  <Check className="w-3 h-3 text-green-400" />
                                ) : (
                                  <X className="w-3 h-3 text-red-400" />
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-white text-sm">Attempt #{attempt.attempt}</span>
                                  <span className="text-gray-500 text-xs">{formatDateFull(attempt.timestamp)}</span>
                                </div>
                                {attempt.error_message && (
                                  <p className="text-gray-400 text-xs mt-1">{attempt.error_message}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Resolution Info */}
                    {selectedError.resolved_at && (
                      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-green-400 mb-2">Resolution</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-500">Resolved At</p>
                            <p className="text-white text-sm">{formatDateFull(selectedError.resolved_at)}</p>
                          </div>
                          {selectedError.resolved_by && (
                            <div>
                              <p className="text-xs text-gray-500">Resolved By</p>
                              <p className="text-white text-sm">{selectedError.resolved_by}</p>
                            </div>
                          )}
                        </div>
                        {selectedError.resolution_note && (
                          <div className="mt-3">
                            <p className="text-xs text-gray-500">Note</p>
                            <p className="text-white text-sm">{selectedError.resolution_note}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-400">
                    No error details available
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              {selectedError && selectedError.status !== 'resolved' && selectedError.status !== 'suppressed' && (
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700">
                  {isRetryable(selectedError) && (
                    <button
                      onClick={() => {
                        handleRetry(selectedError.id);
                        setShowDetailModal(false);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Retry
                    </button>
                  )}
                  <button
                    onClick={() => {
                      openResolveModal([selectedError.id]);
                      setShowDetailModal(false);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 font-medium rounded-lg transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    Mark Resolved
                  </button>
                  <button
                    onClick={() => {
                      openSuppressModal([selectedError.id]);
                      setShowDetailModal(false);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium rounded-lg transition-colors"
                  >
                    <Ban className="w-4 h-4" />
                    Suppress
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/70" onClick={() => setShowResolveModal(false)} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-gray-900 rounded-xl border border-gray-700 w-full max-w-md shadow-2xl">
              <div className="px-6 py-4 border-b border-gray-700">
                <h3 className="text-lg font-semibold text-white">Mark as Resolved</h3>
              </div>
              <div className="p-6">
                <p className="text-gray-300 text-sm mb-4">
                  Mark {resolvingIds.length} error{resolvingIds.length > 1 ? 's' : ''} as resolved.
                  They will not be retried.
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Resolution Note (optional)
                  </label>
                  <textarea
                    value={resolveNote}
                    onChange={(e) => setResolveNote(e.target.value)}
                    placeholder="Add a note about how this was resolved..."
                    rows={3}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700">
                <button
                  onClick={() => setShowResolveModal(false)}
                  className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResolve}
                  disabled={bulkActionLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                >
                  {bulkActionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Mark Resolved
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suppress Modal */}
      {showSuppressModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/70" onClick={() => setShowSuppressModal(false)} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-gray-900 rounded-xl border border-gray-700 w-full max-w-md shadow-2xl">
              <div className="px-6 py-4 border-b border-gray-700">
                <h3 className="text-lg font-semibold text-white">Suppress Email{suppressingIds.length > 1 ? 's' : ''}</h3>
              </div>
              <div className="p-6">
                <p className="text-gray-300 text-sm mb-4">
                  Suppressing will add {suppressingIds.length} email address{suppressingIds.length > 1 ? 'es' : ''} to
                  the suppression list. No future emails will be sent to these addresses.
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Suppression Reason
                  </label>
                  <div className="space-y-2">
                    {(['bounced', 'complained', 'manual'] as const).map(reason => (
                      <button
                        key={reason}
                        onClick={() => setSuppressReason(reason)}
                        className={`w-full px-4 py-3 rounded-lg border text-left transition-colors ${
                          suppressReason === reason
                            ? 'bg-red-500/20 border-red-500 text-red-400'
                            : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-500'
                        }`}
                      >
                        <span className="font-medium capitalize">{reason}</span>
                        <p className="text-xs text-gray-500 mt-1">
                          {reason === 'bounced' && 'Email address does not exist or cannot receive mail'}
                          {reason === 'complained' && 'Recipient marked email as spam'}
                          {reason === 'manual' && 'Manually suppressed by admin'}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700">
                <button
                  onClick={() => setShowSuppressModal(false)}
                  className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSuppress}
                  disabled={bulkActionLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                >
                  {bulkActionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Ban className="w-4 h-4" />
                  )}
                  Suppress
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ErrorRecovery;
