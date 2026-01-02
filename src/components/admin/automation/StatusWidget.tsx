import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  Wifi,
  WifiOff,
  Activity,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface ServerStatus {
  isOnline: boolean;
  currentSessions: number;
  maxSessions: number;
  queueDepth: number;
  lastHeartbeat?: number;
  browserHealthy: boolean;
  serverVersion?: string;
  cpuUsage?: number;
  memoryUsage?: number;
}

interface StatusWidgetProps {
  status: ServerStatus | null;
  compact?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

// ============================================
// FULL STATUS WIDGET
// ============================================

const StatusWidget: React.FC<StatusWidgetProps> = ({
  status: initialStatus,
  compact = false,
  autoRefresh = false,
  refreshInterval = 30000
}) => {
  const [status, setStatus] = useState<ServerStatus | null>(initialStatus);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Fetch status from API
  const fetchStatus = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const response = await fetch('/api/automation/status');
      const result = await response.json();
      if (result.success) {
        setStatus(result.status);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Failed to fetch server status:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Update from prop changes
  useEffect(() => {
    if (initialStatus) {
      setStatus(initialStatus);
      setLastUpdated(new Date());
    }
  }, [initialStatus]);

  // Auto-refresh if enabled
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchStatus, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchStatus]);

  // Format time ago
  const formatTimeAgo = (timestamp: number | undefined) => {
    if (!timestamp) return 'Never';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  // Compact version for header
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
            status?.isOnline
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
          title={status?.isOnline ? 'Automation server online' : 'Automation server offline'}
        >
          {status?.isOnline ? (
            <Wifi className="w-4 h-4" />
          ) : (
            <WifiOff className="w-4 h-4" />
          )}
          <span className="text-sm font-medium">
            {status?.isOnline ? 'Online' : 'Offline'}
          </span>
          {status?.isOnline && status.currentSessions > 0 && (
            <span className="text-xs opacity-80">
              ({status.currentSessions}/{status.maxSessions})
            </span>
          )}
        </div>
      </div>
    );
  }

  // Full version
  return (
    <div className="admin-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Server className="w-4 h-4 text-amber-400" />
          Server Status
        </h3>
        <button
          onClick={fetchStatus}
          disabled={isRefreshing}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {!status ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {/* Connection Status */}
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">Connection</span>
            <div className={`flex items-center gap-2 ${
              status.isOnline ? 'text-green-400' : 'text-red-400'
            }`}>
              {status.isOnline ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-sm font-medium">Connected</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">Disconnected</span>
                </>
              )}
            </div>
          </div>

          {/* Sessions */}
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">Sessions</span>
            <span className="text-white text-sm">
              {status.currentSessions} / {status.maxSessions}
            </span>
          </div>

          {/* Sessions Progress Bar */}
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                status.currentSessions / status.maxSessions > 0.8
                  ? 'bg-red-500'
                  : status.currentSessions / status.maxSessions > 0.5
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
              }`}
              style={{ width: `${(status.currentSessions / status.maxSessions) * 100}%` }}
            />
          </div>

          {/* Queue Depth */}
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">Queue Depth</span>
            <span className={`text-sm font-medium ${
              status.queueDepth > 10 ? 'text-yellow-400' : 'text-white'
            }`}>
              {status.queueDepth} jobs
            </span>
          </div>

          {/* Browser Status */}
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">Browser</span>
            <div className={`flex items-center gap-2 ${
              status.browserHealthy ? 'text-green-400' : 'text-red-400'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                status.browserHealthy ? 'bg-green-400' : 'bg-red-400'
              }`} />
              <span className="text-sm">
                {status.browserHealthy ? 'Healthy' : 'Unhealthy'}
              </span>
            </div>
          </div>

          {/* Resource Usage (if available) */}
          {status.cpuUsage !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">CPU</span>
              <span className={`text-sm ${
                status.cpuUsage > 80 ? 'text-red-400' : 'text-white'
              }`}>
                {status.cpuUsage}%
              </span>
            </div>
          )}

          {status.memoryUsage !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Memory</span>
              <span className={`text-sm ${
                status.memoryUsage > 80 ? 'text-red-400' : 'text-white'
              }`}>
                {status.memoryUsage}%
              </span>
            </div>
          )}

          {/* Last Heartbeat */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-700">
            <span className="text-gray-500 text-xs">Last heartbeat</span>
            <span className="text-gray-500 text-xs">
              {formatTimeAgo(status.lastHeartbeat)}
            </span>
          </div>

          {/* Server Version */}
          {status.serverVersion && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs">Version</span>
              <span className="text-gray-500 text-xs">{status.serverVersion}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StatusWidget;
