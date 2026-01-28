import React, { useState, useEffect, useCallback } from 'react';
import {
  Database, RefreshCw, CheckCircle, XCircle, AlertTriangle,
  Users, Calendar, Brain, Loader2, Clock, Activity
} from 'lucide-react';
import dataContext, { DataContextStats } from '../../services/dataContext';

interface DataContextStatusProps {
  /** Compact mode for embedding in other components */
  compact?: boolean;
  /** Auto-refresh interval in seconds (0 to disable) */
  refreshInterval?: number;
  /** Callback when status changes */
  onStatusChange?: (connected: boolean) => void;
}

interface ConnectionStatus {
  connected: boolean;
  status: 'healthy' | 'degraded' | 'offline';
  version?: string;
  lastCheck: Date;
}

const DataContextStatus: React.FC<DataContextStatusProps> = ({
  compact = false,
  refreshInterval = 60,
  onStatusChange
}) => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [stats, setStats] = useState<DataContextStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      // Check connection
      const [connected, health, statsData] = await Promise.all([
        dataContext.checkConnection(),
        dataContext.getHealthStatus(),
        dataContext.getStats().catch(() => null)
      ]);

      const newStatus: ConnectionStatus = {
        connected,
        status: health.status,
        version: health.version,
        lastCheck: new Date()
      };

      setConnectionStatus(newStatus);
      if (statsData) setStats(statsData);
      
      onStatusChange?.(connected);
    } catch (error) {
      console.error('Failed to check DATA_CONTEXT status:', error);
      setConnectionStatus({
        connected: false,
        status: 'offline',
        lastCheck: new Date()
      });
      onStatusChange?.(false);
    }
  }, [onStatusChange]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await checkStatus();
      setLoading(false);
    };
    init();

    // Set up auto-refresh
    if (refreshInterval > 0) {
      const interval = setInterval(checkStatus, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [checkStatus, refreshInterval]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await checkStatus();
    setRefreshing(false);
  };

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getStatusColor = (status: 'healthy' | 'degraded' | 'offline') => {
    switch (status) {
      case 'healthy': return 'text-green-400 bg-green-500/20 border-green-500/30';
      case 'degraded': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      case 'offline': return 'text-red-400 bg-red-500/20 border-red-500/30';
    }
  };

  const getStatusIcon = (status: 'healthy' | 'degraded' | 'offline') => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4" />;
      case 'degraded': return <AlertTriangle className="w-4 h-4" />;
      case 'offline': return <XCircle className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${compact ? 'py-2' : 'py-8'}`}>
        <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
      </div>
    );
  }

  // Compact mode - just a status indicator
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium border ${
          connectionStatus ? getStatusColor(connectionStatus.status) : 'text-gray-400 bg-gray-500/20 border-gray-500/30'
        }`}>
          {connectionStatus ? getStatusIcon(connectionStatus.status) : <Database className="w-3 h-3" />}
          <span>DATA_CONTEXT</span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-1 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          title="Refresh status"
        >
          <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
    );
  }

  // Full mode - detailed status card
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-purple-400" />
          <h3 className="text-white font-semibold">DATA_CONTEXT</h3>
        </div>
        <div className="flex items-center gap-2">
          {connectionStatus && (
            <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${
              getStatusColor(connectionStatus.status)
            }`}>
              {getStatusIcon(connectionStatus.status)}
              {connectionStatus.status.charAt(0).toUpperCase() + connectionStatus.status.slice(1)}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Connection Info */}
      {connectionStatus && (
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Last check: {formatTimeAgo(connectionStatus.lastCheck)}
          </span>
          {connectionStatus.version && (
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3" />
              v{connectionStatus.version}
            </span>
          )}
        </div>
      )}

      {/* Stats Grid */}
      {connectionStatus?.connected && stats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <Users className="w-3 h-3 text-blue-400" />
              Contacts
            </div>
            <p className="text-xl font-bold text-white">{stats.contacts || 0}</p>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <Calendar className="w-3 h-3 text-green-400" />
              Events
            </div>
            <p className="text-xl font-bold text-white">{stats.events || 0}</p>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <Brain className="w-3 h-3 text-purple-400" />
              Intelligence
            </div>
            <p className="text-xl font-bold text-white">{stats.intelligence || 0}</p>
          </div>
        </div>
      )}

      {/* Offline Message */}
      {connectionStatus && !connectionStatus.connected && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <p className="text-red-400 text-sm">
            DATA_CONTEXT is not available. Some features may be limited.
          </p>
          <p className="text-gray-500 text-xs mt-1">
            Ensure the DATA_CONTEXT server is running at {import.meta.env.VITE_DATA_CONTEXT_URL || 'http://localhost:8100'}
          </p>
        </div>
      )}

      {/* Last Sync */}
      {stats?.last_sync && (
        <p className="text-xs text-gray-500">
          Last sync: {new Date(stats.last_sync).toLocaleString()}
        </p>
      )}
    </div>
  );
};

export default DataContextStatus;
