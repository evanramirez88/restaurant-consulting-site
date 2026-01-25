import React, { useState, useEffect } from 'react';
import {
  Clock, Mail, Phone, Calendar, MessageSquare, Ticket,
  FolderOpen, DollarSign, UserPlus, FileText, Activity,
  Loader2, ChevronDown
} from 'lucide-react';

interface ActivityItem {
  id: string;
  activity_type: string;
  title: string;
  description: string | null;
  performed_by_name: string;
  performed_by_type: string;
  created_at: number;
}

interface Props {
  clientId: string;
}

const ACTIVITY_ICONS: Record<string, any> = {
  email_sent: Mail,
  email_received: Mail,
  call_logged: Phone,
  meeting_scheduled: Calendar,
  meeting_completed: Calendar,
  ticket_created: Ticket,
  ticket_resolved: Ticket,
  ticket_commented: MessageSquare,
  project_started: FolderOpen,
  project_completed: FolderOpen,
  payment_received: DollarSign,
  note_added: FileText,
  rep_assigned: UserPlus,
  status_changed: Activity,
};

const ACTIVITY_COLORS: Record<string, string> = {
  email_sent: 'text-blue-400 bg-blue-500/10',
  email_received: 'text-cyan-400 bg-cyan-500/10',
  call_logged: 'text-green-400 bg-green-500/10',
  meeting_scheduled: 'text-purple-400 bg-purple-500/10',
  meeting_completed: 'text-purple-400 bg-purple-500/10',
  ticket_created: 'text-amber-400 bg-amber-500/10',
  ticket_resolved: 'text-green-400 bg-green-500/10',
  ticket_commented: 'text-blue-400 bg-blue-500/10',
  project_started: 'text-indigo-400 bg-indigo-500/10',
  project_completed: 'text-green-400 bg-green-500/10',
  payment_received: 'text-green-400 bg-green-500/10',
  note_added: 'text-gray-400 bg-gray-500/10',
  rep_assigned: 'text-amber-400 bg-amber-500/10',
  status_changed: 'text-amber-400 bg-amber-500/10',
};

const FILTER_TYPES = [
  { value: '', label: 'All' },
  { value: 'email_sent', label: 'Emails' },
  { value: 'call_logged', label: 'Calls' },
  { value: 'meeting_scheduled', label: 'Meetings' },
  { value: 'ticket_created', label: 'Tickets' },
  { value: 'note_added', label: 'Notes' },
  { value: 'payment_received', label: 'Payments' },
];

const ClientActivityTimeline: React.FC<Props> = ({ clientId }) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState('');
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const loadActivities = async (reset = false) => {
    const currentOffset = reset ? 0 : offset;
    if (reset) setLoading(true);
    else setLoadingMore(true);

    try {
      const params = new URLSearchParams({ limit: String(limit), offset: String(currentOffset) });
      if (filter) params.set('type', filter);

      const response = await fetch(`/api/admin/clients/${clientId}/activity?${params}`, { credentials: 'include' });
      const data = await response.json();
      if (data.success) {
        if (reset) {
          setActivities(data.data);
        } else {
          setActivities(prev => [...prev, ...data.data]);
        }
        setTotal(data.total);
        setOffset(currentOffset + data.data.length);
      }
    } catch (err) {
      console.error('Failed to load activities:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadActivities(true);
  }, [clientId, filter]);

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts * 1000);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHrs = diffMs / 3600000;
    if (diffHrs < 1) return `${Math.max(1, Math.floor(diffMs / 60000))}m ago`;
    if (diffHrs < 24) return `${Math.floor(diffHrs)}h ago`;
    if (diffHrs < 168) return `${Math.floor(diffHrs / 24)}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  };

  const groupByDate = (items: ActivityItem[]) => {
    const groups: Record<string, ActivityItem[]> = {};
    items.forEach(item => {
      const d = new Date(item.created_at * 1000);
      const key = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  };

  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 text-amber-400 animate-spin" /></div>;
  }

  const grouped = groupByDate(activities);

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTER_TYPES.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f.value
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {activities.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No activity recorded yet</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <h4 className="text-xs font-medium text-gray-500 uppercase mb-3">{date}</h4>
              <div className="space-y-1 border-l-2 border-gray-800 ml-4">
                {items.map(item => {
                  const Icon = ACTIVITY_ICONS[item.activity_type] || Activity;
                  const colorClass = ACTIVITY_COLORS[item.activity_type] || 'text-gray-400 bg-gray-500/10';
                  return (
                    <div key={item.id} className="relative pl-6 py-2">
                      <div className={`absolute -left-3 top-3 w-6 h-6 rounded-full flex items-center justify-center ${colorClass}`}>
                        <Icon className="w-3 h-3" />
                      </div>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm text-white">{item.title}</p>
                          {item.description && <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>}
                          <p className="text-xs text-gray-500 mt-0.5">{item.performed_by_name}</p>
                        </div>
                        <span className="text-xs text-gray-600 whitespace-nowrap ml-4">{formatTimestamp(item.created_at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Load More */}
          {activities.length < total && (
            <div className="text-center">
              <button
                onClick={() => loadActivities(false)}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 text-sm transition-colors"
              >
                {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
                Load more ({total - activities.length} remaining)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ClientActivityTimeline;
