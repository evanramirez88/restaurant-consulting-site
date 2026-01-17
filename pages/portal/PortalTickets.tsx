import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Loader2,
  AlertTriangle,
  Ticket,
  Plus,
  Clock,
  CheckCircle,
  Circle,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Filter,
  MessageSquare,
  Calendar,
  X
} from 'lucide-react';
import { useSEO } from '../../src/components/SEO';

// ============================================
// TYPE DEFINITIONS
// ============================================
interface TicketData {
  id: string;
  subject: string;
  description: string | null;
  status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  category: 'technical' | 'billing' | 'feature' | 'training' | 'other' | null;
  assigned_to: string | null;
  due_date: number | null;
  target_date: number | null;
  target_date_label: string | null;
  resolved_at: number | null;
  created_at: number;
  updated_at: number;
}

// ============================================
// PORTAL TICKETS PAGE
// ============================================
const PortalTickets: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const [isLoading, setIsLoading] = useState(true);
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New ticket form state
  const [newTicket, setNewTicket] = useState({
    subject: '',
    description: '',
    priority: 'normal' as const,
    category: 'other' as const
  });

  useSEO({
    title: 'Support Tickets | Client Portal',
    description: 'View and manage your support tickets.',
  });

  // Load tickets
  useEffect(() => {
    loadTickets();
  }, [slug]);

  const loadTickets = async () => {
    if (!slug) return;

    try {
      const response = await fetch(`/api/portal/${slug}/tickets`);
      const data = await response.json();

      if (data.success) {
        setTickets(data.data || []);
      } else {
        setError(data.error || 'Failed to load tickets');
      }
    } catch (err) {
      console.error('Tickets load error:', err);
      setError('Failed to load tickets');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit new ticket
  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug || !newTicket.subject.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/portal/${slug}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTicket)
      });

      const data = await response.json();

      if (data.success) {
        setShowNewTicketModal(false);
        setNewTicket({ subject: '', description: '', priority: 'normal', category: 'other' });
        loadTickets(); // Refresh list
      } else {
        alert(data.error || 'Failed to create ticket');
      }
    } catch (err) {
      console.error('Create ticket error:', err);
      alert('Failed to create ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Utility functions
  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  const formatDateTime = (timestamp: number | null) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'resolved':
      case 'closed':
        return {
          color: 'text-green-400 bg-green-400/10 border-green-400/30',
          icon: <CheckCircle className="w-4 h-4" />,
          label: status === 'resolved' ? 'Resolved' : 'Closed'
        };
      case 'in_progress':
        return {
          color: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
          icon: <Clock className="w-4 h-4" />,
          label: 'In Progress'
        };
      case 'waiting':
        return {
          color: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
          icon: <HelpCircle className="w-4 h-4" />,
          label: 'Waiting'
        };
      default:
        return {
          color: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
          icon: <Circle className="w-4 h-4" />,
          label: 'Open'
        };
    }
  };

  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return { color: 'text-red-400', label: 'Urgent' };
      case 'high':
        return { color: 'text-orange-400', label: 'High' };
      case 'low':
        return { color: 'text-gray-400', label: 'Low' };
      default:
        return { color: 'text-gray-300', label: 'Normal' };
    }
  };

  const getCategoryLabel = (category: string | null) => {
    switch (category) {
      case 'technical': return 'Technical';
      case 'billing': return 'Billing';
      case 'feature': return 'Feature Request';
      case 'training': return 'Training';
      default: return 'General';
    }
  };

  // Filter tickets
  const filteredTickets = tickets.filter(ticket => {
    // Status filter
    if (filter === 'open' && (ticket.status === 'resolved' || ticket.status === 'closed')) return false;
    if (filter === 'resolved' && ticket.status !== 'resolved' && ticket.status !== 'closed') return false;

    // Category filter
    if (categoryFilter !== 'all' && ticket.category !== categoryFilter) return false;

    return true;
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Error Loading Tickets</h2>
        <p className="text-gray-400">{error}</p>
      </div>
    );
  }

  const openCount = tickets.filter(t => t.status !== 'resolved' && t.status !== 'closed').length;
  const resolvedCount = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Support Tickets</h1>
          <p className="text-gray-400">View and manage your support requests</p>
        </div>

        <button
          onClick={() => setShowNewTicketModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Ticket
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Status Filter */}
        <div className="flex bg-gray-800/50 rounded-lg p-1">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-amber-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            All ({tickets.length})
          </button>
          <button
            onClick={() => setFilter('open')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === 'open'
                ? 'bg-amber-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Open ({openCount})
          </button>
          <button
            onClick={() => setFilter('resolved')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === 'resolved'
                ? 'bg-amber-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Resolved ({resolvedCount})
          </button>
        </div>

        {/* Category Filter */}
        <div className="relative">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="appearance-none bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 pr-10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">All Categories</option>
            <option value="technical">Technical</option>
            <option value="billing">Billing</option>
            <option value="feature">Feature Request</option>
            <option value="training">Training</option>
            <option value="other">General</option>
          </select>
          <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Tickets List */}
      {filteredTickets.length === 0 ? (
        <div className="admin-card p-12 text-center">
          <Ticket className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Tickets Found</h3>
          <p className="text-gray-400 mb-6">
            {filter === 'all'
              ? "You don't have any support tickets yet."
              : `No ${filter} tickets at this time.`}
          </p>
          <button
            onClick={() => setShowNewTicketModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Your First Ticket
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((ticket) => {
            const isExpanded = expandedTicket === ticket.id;
            const statusConfig = getStatusConfig(ticket.status);
            const priorityConfig = getPriorityConfig(ticket.priority);

            return (
              <div
                key={ticket.id}
                className="admin-card overflow-hidden"
              >
                {/* Ticket Header */}
                <button
                  onClick={() => setExpandedTicket(isExpanded ? null : ticket.id)}
                  className="w-full px-5 py-4 text-left hover:bg-gray-800/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${statusConfig.color}`}>
                          {statusConfig.icon}
                          {statusConfig.label}
                        </span>
                        {ticket.priority !== 'normal' && (
                          <span className={`text-xs font-medium ${priorityConfig.color}`}>
                            {priorityConfig.label}
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {getCategoryLabel(ticket.category)}
                        </span>
                      </div>
                      <h3 className="text-base font-medium text-white truncate">
                        {ticket.subject}
                      </h3>
                      {ticket.description && (
                        <p className="text-gray-400 text-sm line-clamp-1 mt-1">
                          {ticket.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="hidden sm:block text-right text-xs text-gray-500">
                        <div>{formatDateTime(ticket.created_at)}</div>
                        {ticket.updated_at !== ticket.created_at && (
                          <div className="text-gray-600">Updated {formatDate(ticket.updated_at)}</div>
                        )}
                      </div>
                      <div className="text-gray-400">
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </div>
                    </div>
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-gray-700 px-5 py-4 bg-gray-900/30">
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Ticket Details */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                          Details
                        </h4>
                        {ticket.description ? (
                          <p className="text-gray-300 text-sm whitespace-pre-wrap mb-4">
                            {ticket.description}
                          </p>
                        ) : (
                          <p className="text-gray-500 text-sm italic mb-4">No description provided</p>
                        )}

                        <dl className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <dt className="text-gray-400">Status</dt>
                            <dd className="text-white capitalize">{ticket.status.replace('_', ' ')}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-400">Priority</dt>
                            <dd className={priorityConfig.color}>{priorityConfig.label}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-400">Category</dt>
                            <dd className="text-white">{getCategoryLabel(ticket.category)}</dd>
                          </div>
                          {ticket.assigned_to && (
                            <div className="flex justify-between">
                              <dt className="text-gray-400">Assigned To</dt>
                              <dd className="text-white">{ticket.assigned_to}</dd>
                            </div>
                          )}
                        </dl>
                      </div>

                      {/* Timeline */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                          Timeline
                        </h4>
                        <dl className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <dt className="text-gray-400">Created</dt>
                            <dd className="text-white">{formatDateTime(ticket.created_at)}</dd>
                          </div>
                          {ticket.due_date && (
                            <div className="flex justify-between">
                              <dt className="text-gray-400">Due Date</dt>
                              <dd className="text-white flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(ticket.due_date)}
                              </dd>
                            </div>
                          )}
                          {ticket.target_date && (
                            <div className="flex justify-between">
                              <dt className="text-gray-400">{ticket.target_date_label || 'Target Date'}</dt>
                              <dd className="text-white">{formatDate(ticket.target_date)}</dd>
                            </div>
                          )}
                          {ticket.resolved_at && (
                            <div className="flex justify-between">
                              <dt className="text-gray-400">Resolved</dt>
                              <dd className="text-green-400">{formatDateTime(ticket.resolved_at)}</dd>
                            </div>
                          )}
                        </dl>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-3 mt-6 pt-4 border-t border-gray-700">
                      <button className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors">
                        <MessageSquare className="w-4 h-4" />
                        Add Comment
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Ticket Modal */}
      {showNewTicketModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">New Support Ticket</h2>
              <button
                onClick={() => setShowNewTicketModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitTicket} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Subject <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                  placeholder="Brief description of your issue"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                  placeholder="Provide more details about your request..."
                  rows={4}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Category
                  </label>
                  <select
                    value={newTicket.category}
                    onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value as any })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="technical">Technical Issue</option>
                    <option value="billing">Billing</option>
                    <option value="feature">Feature Request</option>
                    <option value="training">Training</option>
                    <option value="other">General</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={newTicket.priority}
                    onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value as any })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewTicketModal(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newTicket.subject.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Create Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortalTickets;
