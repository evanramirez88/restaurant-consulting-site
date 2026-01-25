import React, { useState, useEffect } from 'react';
import {
  Loader2, RefreshCw, Calendar, FileText, Mail, Phone,
  Database, CheckCircle2, AlertCircle, ArrowUpRight,
  ArrowDownLeft, Clock, Building2, User, MessageSquare, Globe, Activity
} from 'lucide-react';

interface CalendarEvent {
  id: string;
  title: string;
  content: string;
  date: number;
  source: string;
  tags: string | null;
}

interface DriveDocument {
  id: string;
  title: string;
  content: string;
  date: number;
  source: string;
  tags: string | null;
}

interface Communication {
  id: string;
  type: string;
  direction: string;
  summary: string;
  snippet: string;
  date: number;
  contact: {
    name: string;
    company: string;
    email: string;
  } | null;
}

interface SyncSource {
  name: string;
  count: number;
  lastSync: number | null;
}

interface DataContextResponse {
  calendar: CalendarEvent[];
  drive: DriveDocument[];
  communications: Communication[];
  replyStats: {
    total: number;
    human: number;
    unprocessed: number;
  };
  syncHealth: {
    sources: SyncSource[];
    communications: { count: number; lastSync: number | null };
    contacts: number;
    totalItems: number;
  };
}

export default function BusinessBriefDataContext() {
  const [data, setData] = useState<DataContextResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'overview' | 'calendar' | 'drive' | 'comms'>('overview');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/business-brief/data-context?limit=15');
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to load data context');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (ts: number | null) => {
    if (!ts) return 'Unknown';
    const d = new Date(ts * 1000);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours < 1) return `${Math.floor(diffMs / 60000)} min ago`;
    if (diffHours < 24) return `${Math.floor(diffHours)} hr ago`;
    if (diffHours < 168) return `${Math.floor(diffHours / 24)} days ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getTypeIcon = (type: string, summary?: string) => {
    // Infer type from summary if type is generic 'meeting'
    const effectiveType = type === 'meeting' && summary
      ? (summary.includes('Google Docs') || summary.includes('Document') ? 'document'
        : summary.includes('Dashboard') || summary.includes('http') ? 'browsing'
        : type)
      : type;

    switch (effectiveType) {
      case 'email': return <Mail className="w-3.5 h-3.5 text-blue-400" />;
      case 'call': return <Phone className="w-3.5 h-3.5 text-green-400" />;
      case 'meeting': return <Calendar className="w-3.5 h-3.5 text-amber-400" />;
      case 'sms': return <MessageSquare className="w-3.5 h-3.5 text-purple-400" />;
      case 'document': return <FileText className="w-3.5 h-3.5 text-cyan-400" />;
      case 'browsing': return <Globe className="w-3.5 h-3.5 text-gray-400" />;
      default: return <Activity className="w-3.5 h-3.5 text-gray-400" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Sync Health Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-gray-400">Total Items</span>
          </div>
          <div className="text-xl font-bold text-white">{data.syncHealth.totalItems}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-green-400" />
            <span className="text-xs text-gray-400">Calendar</span>
          </div>
          <div className="text-xl font-bold text-white">{data.calendar.length}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-gray-400">Documents</span>
          </div>
          <div className="text-xl font-bold text-white">{data.drive.length}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
          <div className="flex items-center gap-2 mb-1">
            <Mail className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-gray-400">Communications</span>
          </div>
          <div className="text-xl font-bold text-white">{data.syncHealth.communications.count}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
          <div className="flex items-center gap-2 mb-1">
            <User className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-gray-400">Contacts</span>
          </div>
          <div className="text-xl font-bold text-white">{data.syncHealth.contacts}</div>
        </div>
      </div>

      {/* Reply Pipeline Stats */}
      {data.replyStats.total > 0 && (
        <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 flex items-center gap-4">
          <Mail className="w-5 h-5 text-amber-400" />
          <span className="text-sm text-gray-300">
            Email Responses: <span className="text-white font-medium">{data.replyStats.total}</span> total,{' '}
            <span className="text-green-400 font-medium">{data.replyStats.human}</span> human,{' '}
            <span className="text-amber-400 font-medium">{data.replyStats.unprocessed}</span> unprocessed
          </span>
        </div>
      )}

      {/* Section Tabs */}
      <div className="flex gap-2">
        {(['overview', 'calendar', 'drive', 'comms'] as const).map(section => (
          <button
            key={section}
            onClick={() => setActiveSection(section)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeSection === section
                ? 'bg-amber-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {section === 'overview' ? 'Overview' :
             section === 'calendar' ? 'Calendar' :
             section === 'drive' ? 'Documents' : 'Communications'}
          </button>
        ))}
        <button
          onClick={loadData}
          className="ml-auto flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs text-white"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>

      {/* Overview Section */}
      {activeSection === 'overview' && (
        <div className="space-y-4">
          {/* Sync Sources */}
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h3 className="text-sm font-medium text-white mb-3">Data Sources</h3>
            {data.syncHealth.sources.length === 0 ? (
              <p className="text-sm text-gray-400">No synced data yet. Run the sync scripts to populate.</p>
            ) : (
              <div className="space-y-2">
                {data.syncHealth.sources.map(source => (
                  <div key={source.name} className="flex items-center justify-between p-2 bg-gray-900/50 rounded">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                      <span className="text-sm text-gray-300">{source.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">{source.count} items</span>
                      <span className="text-xs text-gray-500">{formatDate(source.lastSync)}</span>
                    </div>
                  </div>
                ))}
                {data.syncHealth.communications.count > 0 && (
                  <div className="flex items-center justify-between p-2 bg-gray-900/50 rounded">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                      <span className="text-sm text-gray-300">communications</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">{data.syncHealth.communications.count} items</span>
                      <span className="text-xs text-gray-500">{formatDate(data.syncHealth.communications.lastSync)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Recent Activity Feed */}
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h3 className="text-sm font-medium text-white mb-3">Recent Activity</h3>
            {data.communications.length === 0 && data.calendar.length === 0 ? (
              <p className="text-sm text-gray-400">No recent activity. Run google_calendar_sync.cjs or google_drive_sync.cjs to populate.</p>
            ) : (
              <div className="space-y-2">
                {/* Merge and sort by date */}
                {[
                  ...data.communications.slice(0, 5).map(c => ({ ...c, _type: 'comm' as const, _date: c.date })),
                  ...data.calendar.slice(0, 5).map(e => ({ ...e, _type: 'event' as const, _date: e.date })),
                ].sort((a, b) => (b._date || 0) - (a._date || 0)).slice(0, 8).map(item => (
                  <div key={item.id} className="flex items-start gap-2 p-2 bg-gray-900/50 rounded">
                    {item._type === 'comm' ? (
                      <>
                        {getTypeIcon((item as Communication).type, (item as Communication).summary || (item as Communication).snippet)}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-300 truncate">
                            {(item as Communication).summary || (item as Communication).snippet}
                          </div>
                          {(item as Communication).contact && (
                            <div className="text-xs text-gray-500">
                              {(item as Communication).contact!.name} - {(item as Communication).contact!.company}
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap">{formatDate(item._date)}</span>
                      </>
                    ) : (
                      <>
                        <Calendar className="w-3.5 h-3.5 text-green-400" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-300 truncate">{(item as CalendarEvent).title}</div>
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap">{formatDate(item._date)}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Calendar Section */}
      {activeSection === 'calendar' && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-green-400" />
            Calendar Events
          </h3>
          {data.calendar.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No calendar events synced yet.</p>
              <p className="text-xs mt-1 text-gray-500">Run: node scripts/google_calendar_sync.cjs</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.calendar.map(event => (
                <div key={event.id} className="p-3 bg-gray-900/50 rounded border border-gray-700">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white font-medium">{event.title}</span>
                    <span className="text-xs text-gray-500">{formatDate(event.date)}</span>
                  </div>
                  {event.content && event.content !== event.title && (
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">{event.content}</p>
                  )}
                  {event.tags && (
                    <div className="flex gap-1 mt-1">
                      {event.tags.split(',').map(tag => (
                        <span key={tag} className="text-xs bg-gray-700 px-1.5 py-0.5 rounded text-gray-400">
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Drive Section */}
      {activeSection === 'drive' && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-yellow-400" />
            Google Drive Documents
          </h3>
          {data.drive.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No documents synced yet.</p>
              <p className="text-xs mt-1 text-gray-500">Run: node scripts/google_drive_sync.cjs</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.drive.map(doc => (
                <div key={doc.id} className="p-3 bg-gray-900/50 rounded border border-gray-700">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white font-medium">{doc.title}</span>
                    <span className="text-xs text-gray-500">{formatDate(doc.date)}</span>
                  </div>
                  {doc.content && doc.content !== doc.title && (
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">{doc.content}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Communications Section */}
      {activeSection === 'comms' && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
            <Mail className="w-4 h-4 text-purple-400" />
            Business Communications
          </h3>
          {data.communications.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Mail className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No communications synced yet.</p>
              <p className="text-xs mt-1 text-gray-500">Run: node scripts/gmail_pipeline.cjs</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.communications.map(comm => (
                <div key={comm.id} className="p-3 bg-gray-900/50 rounded border border-gray-700">
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5">
                      {comm.direction === 'inbound' ? (
                        <ArrowDownLeft className="w-3.5 h-3.5 text-blue-400" />
                      ) : (
                        <ArrowUpRight className="w-3.5 h-3.5 text-green-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(comm.type)}
                        <span className="text-sm text-white">{comm.summary || comm.snippet}</span>
                      </div>
                      {comm.contact && (
                        <div className="flex items-center gap-2 mt-1">
                          <Building2 className="w-3 h-3 text-gray-500" />
                          <span className="text-xs text-gray-400">
                            {comm.contact.name}{comm.contact.company ? ` (${comm.contact.company})` : ''}
                          </span>
                        </div>
                      )}
                      {comm.snippet && comm.snippet !== comm.summary && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">{comm.snippet}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap">{formatDate(comm.date)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
