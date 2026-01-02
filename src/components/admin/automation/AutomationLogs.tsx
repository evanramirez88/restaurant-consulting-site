import React, { useState, useEffect, useCallback } from 'react';
import {
  Terminal,
  RefreshCw,
  Filter,
  Search,
  ChevronDown,
  Clock,
  AlertCircle,
  CheckCircle2,
  Image,
  Loader2,
  Download,
  Camera,
  Zap,
  Bug
} from 'lucide-react';

interface AutomationEvent {
  id: string;
  job_id: string | null;
  event_type: string;
  event_data_json: string;
  screenshot_key: string | null;
  created_at: number;
}

const AutomationLogs: React.FC = () => {
  const [events, setEvents] = useState<AutomationEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const response = await fetch('/api/automation/jobs?include_events=true&limit=100');
      const result = await response.json();
      if (result.success && result.events) {
        setEvents(result.events);
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await fetchLogs();
      setIsLoading(false);
    };
    init();
  }, [fetchLogs]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchLogs();
    setIsRefreshing(false);
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'browser_action':
        return <Zap className="w-4 h-4 text-amber-400" />;
      case 'screenshot':
        return <Camera className="w-4 h-4 text-blue-400" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'recovery':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'login':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'navigation':
        return <ChevronDown className="w-4 h-4 text-blue-400" />;
      default:
        return <Terminal className="w-4 h-4 text-gray-400" />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'border-l-red-500';
      case 'recovery':
        return 'border-l-green-500';
      case 'screenshot':
        return 'border-l-blue-500';
      case 'browser_action':
        return 'border-l-amber-500';
      default:
        return 'border-l-gray-600';
    }
  };

  const formatEventData = (jsonStr: string) => {
    try {
      const data = JSON.parse(jsonStr);
      return JSON.stringify(data, null, 2);
    } catch {
      return jsonStr;
    }
  };

  const filteredEvents = events.filter(event => {
    if (filter !== 'all' && event.event_type !== filter) return false;
    if (search) {
      const searchLower = search.toLowerCase();
      if (!event.event_type.toLowerCase().includes(searchLower) &&
          !event.event_data_json?.toLowerCase().includes(searchLower) &&
          !event.job_id?.toLowerCase().includes(searchLower)) {
        return false;
      }
    }
    return true;
  });

  const eventTypes = ['all', 'browser_action', 'screenshot', 'error', 'recovery', 'login', 'navigation'];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Terminal className="w-5 h-5 text-amber-400" />
            Automation Logs
          </h3>
          <p className="text-gray-400 text-sm mt-1">
            Real-time event log from the automation server
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs..."
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
          />
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <div className="flex gap-1">
            {eventTypes.map(type => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === type
                    ? 'bg-amber-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {type === 'all' ? 'All' : type.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Logs List */}
      {filteredEvents.length === 0 ? (
        <div className="admin-card p-8 text-center">
          <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Terminal className="w-8 h-8 text-gray-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-400 mb-2">No Logs Found</h3>
          <p className="text-gray-500 text-sm">
            {search || filter !== 'all'
              ? 'No logs match your current filters'
              : 'Automation events will appear here when jobs run'}
          </p>
        </div>
      ) : (
        <div className="admin-card overflow-hidden">
          <div className="max-h-[600px] overflow-y-auto">
            {filteredEvents.map((event) => (
              <div
                key={event.id}
                className={`border-l-4 ${getEventColor(event.event_type)} bg-gray-800/30 hover:bg-gray-800/50 transition-colors`}
              >
                <div
                  onClick={() => setExpandedEvent(expandedEvent === event.id ? null : event.id)}
                  className="flex items-center gap-4 p-4 cursor-pointer"
                >
                  {/* Icon */}
                  <div className="flex-shrink-0">
                    {getEventIcon(event.event_type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium capitalize">
                        {event.event_type.replace('_', ' ')}
                      </span>
                      {event.job_id && (
                        <span className="text-gray-500 text-xs font-mono">
                          Job: {event.job_id.slice(0, 8)}...
                        </span>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm truncate mt-1">
                      {event.event_data_json?.slice(0, 100) || 'No data'}
                    </p>
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center gap-4 flex-shrink-0">
                    {event.screenshot_key && (
                      <Image className="w-4 h-4 text-gray-500" title="Has screenshot" />
                    )}
                    <span className="text-gray-500 text-xs flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(event.created_at).toLocaleTimeString()}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-gray-500 transition-transform ${
                        expandedEvent === event.id ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedEvent === event.id && (
                  <div className="px-4 pb-4 border-t border-gray-700 mt-0">
                    <div className="pt-4">
                      <p className="text-xs text-gray-500 uppercase mb-2">Event Data</p>
                      <pre className="bg-gray-900 rounded-lg p-4 text-sm text-gray-300 overflow-x-auto font-mono">
                        {formatEventData(event.event_data_json || '{}')}
                      </pre>
                      {event.screenshot_key && (
                        <div className="mt-4">
                          <p className="text-xs text-gray-500 uppercase mb-2">Screenshot</p>
                          <div className="bg-gray-900 rounded-lg p-4 text-center">
                            <p className="text-gray-500 text-sm">
                              {event.screenshot_key}
                            </p>
                            {/* TODO: Load actual screenshot from R2 */}
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-gray-600 mt-4">
                        Event ID: {event.id} | {new Date(event.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Status */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>Showing {filteredEvents.length} of {events.length} events</span>
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          Live updates enabled
        </span>
      </div>
    </div>
  );
};

export default AutomationLogs;
