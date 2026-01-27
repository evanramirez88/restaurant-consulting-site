/**
 * Command Center / Daily Briefing Component
 *
 * Shows a comprehensive daily overview of business activities:
 * - Priority action items
 * - Key metrics
 * - Recent activity feeds
 * - AI-generated insights (future)
 *
 * Mobile-first design for quick morning review
 */

import { useState, useEffect } from 'react';
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  RefreshCw,
  ChevronRight,
  Users,
  Mail,
  Ticket,
  Calendar,
  FileText,
  TrendingUp,
  Zap,
  Brain,
  ExternalLink,
  Clock
} from 'lucide-react';

interface ActionItem {
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  action?: string;
}

interface BriefingData {
  generatedAt: number;
  date: string;
  summary: {
    newLeads: number;
    leadsNeedingAction: number;
    pendingTickets: number;
    emailsSent: number;
    emailsFailed: number;
    emailsOpened: number;
    activeClients: number;
    staleLeads: number;
  };
  actionItems: ActionItem[];
  details: {
    openTickets: any[];
    failedEmails: any[];
    upcomingBookings: any[];
    pendingQuotes: any[];
    recentConversions: any[];
    toastHubUpdates: any[];
    intelligenceFindings: any[];
  };
}

export default function CommandCenter() {
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('actions');

  const fetchBriefing = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/briefing', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch briefing');
      }

      const result = await response.json();
      if (result.success) {
        setData(result);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBriefing();
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchBriefing, 300000);
    return () => clearInterval(interval);
  }, []);

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-400" />;
      case 'high':
        return <AlertCircle className="w-5 h-5 text-orange-400" />;
      case 'medium':
        return <Info className="w-5 h-5 text-yellow-400" />;
      default:
        return <CheckCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getPriorityBg = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-500/10 border-red-500/30';
      case 'high':
        return 'bg-orange-500/10 border-orange-500/30';
      case 'medium':
        return 'bg-yellow-500/10 border-yellow-500/30';
      default:
        return 'bg-gray-500/10 border-gray-500/30';
    }
  };

  const formatTime = (timestamp: number | string) => {
    const date = typeof timestamp === 'number'
      ? new Date(timestamp * 1000)
      : new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (loading && !data) {
    return (
      <div className="admin-card p-8 text-center">
        <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-amber-400" />
        <p className="text-gray-400">Loading daily briefing...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-card p-6 text-center">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-400" />
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={fetchBriefing}
          className="px-4 py-2 bg-amber-500 text-black rounded-lg hover:bg-amber-400"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="admin-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Zap className="w-6 h-6 text-amber-400" />
              Command Center
            </h2>
            <p className="text-gray-400 text-sm">{data.date}</p>
          </div>
          <button
            onClick={fetchBriefing}
            disabled={loading}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Quick Stats - Horizontal scroll on mobile */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex-shrink-0 admin-card p-3 min-w-[100px]">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-gray-400">New Leads</span>
          </div>
          <div className="text-2xl font-bold text-white">{data.summary.newLeads}</div>
        </div>

        <div className="flex-shrink-0 admin-card p-3 min-w-[100px]">
          <div className="flex items-center gap-2 mb-1">
            <Ticket className="w-4 h-4 text-orange-400" />
            <span className="text-xs text-gray-400">Open Tickets</span>
          </div>
          <div className="text-2xl font-bold text-white">{data.summary.pendingTickets}</div>
        </div>

        <div className="flex-shrink-0 admin-card p-3 min-w-[100px]">
          <div className="flex items-center gap-2 mb-1">
            <Mail className="w-4 h-4 text-green-400" />
            <span className="text-xs text-gray-400">Emails Sent</span>
          </div>
          <div className="text-2xl font-bold text-white">{data.summary.emailsSent}</div>
        </div>

        {data.summary.emailsFailed > 0 && (
          <div className="flex-shrink-0 admin-card p-3 min-w-[100px] border border-red-500/30">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-xs text-red-400">Failed</span>
            </div>
            <div className="text-2xl font-bold text-red-400">{data.summary.emailsFailed}</div>
          </div>
        )}

        <div className="flex-shrink-0 admin-card p-3 min-w-[100px]">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-gray-400">Active Clients</span>
          </div>
          <div className="text-2xl font-bold text-white">{data.summary.activeClients}</div>
        </div>
      </div>

      {/* Priority Actions */}
      {data.actionItems.length > 0 && (
        <div className="admin-card">
          <button
            onClick={() => setExpandedSection(expandedSection === 'actions' ? null : 'actions')}
            className="w-full p-4 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-amber-400" />
              <span className="font-semibold text-white">Priority Actions</span>
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-sm">
                {data.actionItems.length}
              </span>
            </div>
            <ChevronRight className={`w-5 h-5 text-gray-500 transition-transform ${expandedSection === 'actions' ? 'rotate-90' : ''}`} />
          </button>

          {expandedSection === 'actions' && (
            <div className="px-4 pb-4 space-y-2">
              {data.actionItems.map((item, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${getPriorityBg(item.priority)} flex items-start gap-3`}
                >
                  {getPriorityIcon(item.priority)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white">{item.title}</p>
                    <p className="text-sm text-gray-400">{item.description}</p>
                  </div>
                  {item.action && (
                    <a
                      href={item.action}
                      className="flex-shrink-0 p-2 text-amber-400 hover:bg-amber-500/20 rounded"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upcoming Bookings */}
      {data.details.upcomingBookings.length > 0 && (
        <div className="admin-card">
          <button
            onClick={() => setExpandedSection(expandedSection === 'bookings' ? null : 'bookings')}
            className="w-full p-4 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-green-400" />
              <span className="font-semibold text-white">Upcoming Meetings</span>
              <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-sm">
                {data.details.upcomingBookings.length}
              </span>
            </div>
            <ChevronRight className={`w-5 h-5 text-gray-500 transition-transform ${expandedSection === 'bookings' ? 'rotate-90' : ''}`} />
          </button>

          {expandedSection === 'bookings' && (
            <div className="px-4 pb-4 space-y-2">
              {data.details.upcomingBookings.map((booking: any, index: number) => (
                <div key={index} className="p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-white">{booking.name || 'Meeting'}</p>
                    <span className="text-sm text-green-400">{booking.start_time}</span>
                  </div>
                  <p className="text-sm text-gray-400">{booking.title}</p>
                  <p className="text-xs text-gray-500">{booking.email}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pending Quotes */}
      {data.details.pendingQuotes.length > 0 && (
        <div className="admin-card">
          <button
            onClick={() => setExpandedSection(expandedSection === 'quotes' ? null : 'quotes')}
            className="w-full p-4 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-blue-400" />
              <span className="font-semibold text-white">Pending Quotes</span>
              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-sm">
                {data.details.pendingQuotes.length}
              </span>
            </div>
            <ChevronRight className={`w-5 h-5 text-gray-500 transition-transform ${expandedSection === 'quotes' ? 'rotate-90' : ''}`} />
          </button>

          {expandedSection === 'quotes' && (
            <div className="px-4 pb-4 space-y-2">
              {data.details.pendingQuotes.map((quote: any, index: number) => (
                <div key={index} className="p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-white">{quote.restaurant_name || quote.name}</p>
                    <span className="text-xs text-gray-500">{formatTime(quote.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-400">{quote.email}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Open Tickets */}
      {data.details.openTickets.length > 0 && (
        <div className="admin-card">
          <button
            onClick={() => setExpandedSection(expandedSection === 'tickets' ? null : 'tickets')}
            className="w-full p-4 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <Ticket className="w-5 h-5 text-orange-400" />
              <span className="font-semibold text-white">Support Tickets</span>
              <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-sm">
                {data.details.openTickets.length}
              </span>
            </div>
            <ChevronRight className={`w-5 h-5 text-gray-500 transition-transform ${expandedSection === 'tickets' ? 'rotate-90' : ''}`} />
          </button>

          {expandedSection === 'tickets' && (
            <div className="px-4 pb-4 space-y-2">
              {data.details.openTickets.map((ticket: any, index: number) => (
                <div key={index} className="p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-white truncate">{ticket.subject}</p>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      ticket.priority === 'urgent' ? 'bg-red-500/20 text-red-400' :
                      ticket.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {ticket.priority}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{formatTime(ticket.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Intelligence Updates */}
      {data.details.intelligenceFindings.length > 0 && (
        <div className="admin-card">
          <button
            onClick={() => setExpandedSection(expandedSection === 'intel' ? null : 'intel')}
            className="w-full p-4 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <Brain className="w-5 h-5 text-purple-400" />
              <span className="font-semibold text-white">Intelligence Updates</span>
              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-sm">
                {data.details.intelligenceFindings.length}
              </span>
            </div>
            <ChevronRight className={`w-5 h-5 text-gray-500 transition-transform ${expandedSection === 'intel' ? 'rotate-90' : ''}`} />
          </button>

          {expandedSection === 'intel' && (
            <div className="px-4 pb-4 space-y-2">
              {data.details.intelligenceFindings.map((finding: any, index: number) => (
                <div key={index} className="p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-white">{finding.agent_name}</p>
                    <span className="text-xs text-gray-500">{finding.task_type}</span>
                  </div>
                  {finding.result_summary && (
                    <p className="text-sm text-gray-400 mt-1">{finding.result_summary}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Restaurant Wrap Updates */}
      {data.details.toastHubUpdates.length > 0 && (
        <div className="admin-card">
          <button
            onClick={() => setExpandedSection(expandedSection === 'toast' ? null : 'toast')}
            className="w-full p-4 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-amber-400" />
              <span className="font-semibold text-white">Restaurant Wrap Updates</span>
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-sm">
                {data.details.toastHubUpdates.length}
              </span>
            </div>
            <ChevronRight className={`w-5 h-5 text-gray-500 transition-transform ${expandedSection === 'toast' ? 'rotate-90' : ''}`} />
          </button>

          {expandedSection === 'toast' && (
            <div className="px-4 pb-4 space-y-2">
              {data.details.toastHubUpdates.map((update: any, index: number) => (
                <div key={index} className="p-3 bg-gray-800/50 rounded-lg">
                  <p className="font-medium text-white">{update.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <span>{update.source_name}</span>
                    {update.category && <span>• {update.category}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Last updated timestamp */}
      <div className="text-center text-xs text-gray-500 flex items-center justify-center gap-1">
        <Clock className="w-3 h-3" />
        Last updated: {formatTime(data.generatedAt)}
      </div>
    </div>
  );
}
