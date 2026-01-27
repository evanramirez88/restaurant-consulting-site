import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity, Play, RefreshCw, Loader2, CheckCircle, XCircle,
  AlertTriangle, Clock, FileText, Database, ArrowUpRight
} from 'lucide-react';

interface AggregatorLog {
  id: string;
  run_started_at: number;
  run_completed_at: number | null;
  sources_processed: number;
  items_fetched: number;
  items_imported: number;
  items_duplicated: number;
  items_failed: number;
  errors_json: string | null;
  status: 'running' | 'completed' | 'failed';
  created_at: number;
}

interface AggregatorStats {
  logs: AggregatorLog[];
  sources: {
    total_sources: number;
    active_sources: number;
    failed_sources: number;
  };
  imports: {
    total_imports: number;
    pending: number;
    approved: number;
    rejected: number;
    visible_public: number;
    visible_client: number;
    visible_rep: number;
  };
  today: {
    imports_today: number;
    items_imported_today: number;
  };
  worker_url: string;
}

const AggregatorStatus: React.FC = () => {
  const [stats, setStats] = useState<AggregatorStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<any>(null);

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/toast-hub/aggregator', {
        credentials: 'include'
      });
      const result = await response.json();
      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Failed to load aggregator stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [loadStats]);

  const triggerRun = async () => {
    setIsTriggering(true);
    setTriggerResult(null);
    try {
      const response = await fetch('/api/admin/toast-hub/aggregator', {
        method: 'POST',
        credentials: 'include'
      });
      const result = await response.json();
      setTriggerResult(result);
      if (result.success) {
        // Reload stats after a delay
        setTimeout(loadStats, 2000);
      }
    } catch (error) {
      setTriggerResult({ success: false, error: String(error) });
    } finally {
      setIsTriggering(false);
    }
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (start: number, end: number | null) => {
    if (!end) return 'Running...';
    const seconds = end - start;
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  const getStatusIcon = (status: AggregatorLog['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} className="text-green-400" />;
      case 'failed':
        return <XCircle size={16} className="text-red-400" />;
      case 'running':
        return <Loader2 size={16} className="text-amber-400 animate-spin" />;
      default:
        return <Activity size={16} className="text-zinc-400" />;
    }
  };

  if (isLoading && !stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Activity className="text-orange-400" />
            Aggregator Status
          </h3>
          <p className="text-sm text-zinc-400">Content aggregation engine monitoring</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadStats}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-zinc-800 rounded hover:bg-zinc-700"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={triggerRun}
            disabled={isTriggering}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-orange-600 rounded hover:bg-orange-500"
          >
            {isTriggering ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Play size={16} />
            )}
            Run Now
          </button>
        </div>
      </div>

      {/* Trigger Result */}
      {triggerResult && (
        <div className={`p-4 rounded-lg border ${
          triggerResult.success
            ? 'bg-green-500/10 border-green-500/30'
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          {triggerResult.success ? (
            <div>
              <p className="text-green-400 font-medium flex items-center gap-2">
                <CheckCircle size={16} />
                Aggregator run triggered successfully
              </p>
              {triggerResult.worker_response?.stats && (
                <p className="text-sm text-zinc-400 mt-1">
                  Processed {triggerResult.worker_response.stats.sourcesProcessed} sources,
                  imported {triggerResult.worker_response.stats.itemsImported} items
                </p>
              )}
            </div>
          ) : (
            <p className="text-red-400 font-medium flex items-center gap-2">
              <XCircle size={16} />
              {triggerResult.error}
              {triggerResult.hint && (
                <span className="text-zinc-400 text-sm ml-2">({triggerResult.hint})</span>
              )}
            </p>
          )}
          <button
            onClick={() => setTriggerResult(null)}
            className="mt-2 text-sm text-zinc-400 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Stats Grid */}
      {stats && (
        <>
          <div className="grid grid-cols-4 gap-4">
            {/* Sources */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <div className="flex items-center gap-2 text-zinc-400 text-sm mb-2">
                <Database size={16} />
                Sources
              </div>
              <div className="text-2xl font-bold text-white">
                {stats.sources.active_sources}
                <span className="text-sm text-zinc-500 font-normal"> / {stats.sources.total_sources}</span>
              </div>
              {stats.sources.failed_sources > 0 && (
                <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                  <AlertTriangle size={12} />
                  {stats.sources.failed_sources} failing
                </p>
              )}
            </div>

            {/* Pending */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <div className="flex items-center gap-2 text-zinc-400 text-sm mb-2">
                <Clock size={16} />
                Pending Review
              </div>
              <div className="text-2xl font-bold text-amber-400">
                {stats.imports.pending}
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Awaiting curation
              </p>
            </div>

            {/* Today's Imports */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <div className="flex items-center gap-2 text-zinc-400 text-sm mb-2">
                <ArrowUpRight size={16} />
                Today
              </div>
              <div className="text-2xl font-bold text-green-400">
                {stats.today.items_imported_today || 0}
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Items imported today
              </p>
            </div>

            {/* Published */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <div className="flex items-center gap-2 text-zinc-400 text-sm mb-2">
                <FileText size={16} />
                Visibility
              </div>
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-400">{stats.imports.visible_public}</div>
                  <div className="text-xs text-zinc-500">Public</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-400">{stats.imports.visible_client}</div>
                  <div className="text-xs text-zinc-500">Client</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-400">{stats.imports.visible_rep}</div>
                  <div className="text-xs text-zinc-500">Rep</div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Runs */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800">
              <h4 className="font-medium text-white">Recent Aggregator Runs</h4>
            </div>
            {stats.logs.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No aggregator runs yet</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {stats.logs.map(log => (
                  <div key={log.id} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(log.status)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white">
                            {formatDate(log.run_started_at)}
                          </span>
                          <span className="text-xs text-zinc-500">
                            ({formatDuration(log.run_started_at, log.run_completed_at)})
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-zinc-400 mt-0.5">
                          <span>{log.sources_processed} sources</span>
                          <span className="text-green-400">{log.items_imported} imported</span>
                          <span className="text-zinc-500">{log.items_duplicated} dupes</span>
                          {log.items_failed > 0 && (
                            <span className="text-red-400">{log.items_failed} failed</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {log.errors_json && JSON.parse(log.errors_json).length > 0 && (
                      <div className="text-right">
                        <span className="px-2 py-1 text-xs rounded bg-red-500/20 text-red-400">
                          {JSON.parse(log.errors_json).length} error(s)
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Worker Info */}
          <div className="text-sm text-zinc-500 flex items-center gap-2">
            <span>Worker:</span>
            <a
              href={`${stats.worker_url}/health`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 hover:underline"
            >
              {stats.worker_url}
            </a>
          </div>
        </>
      )}
    </div>
  );
};

export default AggregatorStatus;
