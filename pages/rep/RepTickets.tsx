import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Loader2,
  Search,
  Ticket,
  Plus,
  Clock,
  CheckCircle,
  Circle,
  AlertCircle,
  Eye,
  EyeOff,
  Filter,
  ChevronDown,
  ChevronUp,
  Building2,
  MessageSquare,
  X,
  AlertTriangle
} from 'lucide-react';
import { useSEO } from '../../src/components/SEO';
import TicketComments from '../../src/components/shared/TicketComments';

// ============================================
// TYPE DEFINITIONS
// ============================================
interface TicketData {
  id: string;
  client_id: string;
  client_name: string;
  client_slug: string;
  subject: string;
  description: string | null;
  status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  category: string | null;
  visibility: 'client' | 'internal' | 'rep_only';
  ticket_type: string;
  assigned_to: string | null;
  rep_id: string | null;
  due_date: number | null;
  is_upsell_opportunity: number;
  upsell_type: string | null;
  resolved_at: number | null;
  created_at: number;
  updated_at: number;
}

interface Client {
  id: string;
  company: string;
  slug: string;
}

// ============================================
// REP TICKETS PAGE
// ============================================
const RepTickets: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [counts, setCounts] = useState({ total: 0, internal: 0, client_visible: 0 });
  const [error, setError] = useState<string | null>(null);
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'client' | 'internal'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');

  // Modal state
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);

  // New ticket form
  const [newTicket, setNewTicket] = useState({
    client_id: '',
    subject: '',
    description: '',
    priority: 'normal' as const,
    category: 'other',
    visibility: 'client' as 'client' | 'internal',
    is_upsell_opportunity: false,
    upsell_type: ''
  });

  useSEO({
    title: 'Tickets | Rep Portal',
    description: 'Manage support tickets for your assigned clients.',
  });

  // Load tickets and clients
  useEffect(() => {
    loadData();
  }, [slug]);

  const loadData = async () => {
    if (!slug) return;

    try {
      // Load tickets
      const ticketsRes = await fetch(`/api/rep/${slug}/tickets`);
      const ticketsData = await ticketsRes.json();

      if (ticketsData.success) {
        setTickets(ticketsData.data || []);
        setCounts(ticketsData.counts || { total: 0, internal: 0, client_visible: 0 });
      } else {
        setError(ticketsData.error || 'Failed to load tickets');
      }

      // Load clients for dropdown
      const clientsRes = await fetch(`/api/rep/${slug}/clients`);
      const clientsData = await clientsRes.json();

      if (clientsData.success) {
        setClients(clientsData.data || []);
      }
    } catch (err) {
      console.error('Load error:', err);
      setError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit new ticket
  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug || !newTicket.client_id || !newTicket.subject.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/rep/${slug}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTicket)
      });

      const data = await response.json();

      if (data.success) {
        setShowNewTicketModal(false);
        setNewTicket({
          client_id: '',
          subject: '',
          description: '',
          priority: 'normal',
          category: 'other',
          visibility: 'client',
          is_upsell_opportunity: false,
          upsell_type: ''
        });
        loadData();
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

  // Update ticket status
  const handleUpdateStatus = async (ticketId: string, newStatus: string) => {
    if (!slug) return;

    try {
      const response = await fetch(`/api/rep/${slug}/tickets`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: ticketId, status: newStatus })
      });

      const data = await response.json();
      if (data.success) {
        loadData();
      }
    } catch (err) {
      console.error('Update ticket error:', err);
    }
  };

  // Utility functions
  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'resolved':
      case 'closed':
        return { color: 'text-green-400 bg-green-400/10', icon: <CheckCircle className="w-4 h-4" />, label: status };
      case 'in_progress':
        return { color: 'text-amber-400 bg-amber-400/10', icon: <Clock className="w-4 h-4" />, label: 'In Progress' };
      case 'waiting':
        return { color: 'text-purple-400 bg-purple-400/10', icon: <AlertCircle className="w-4 h-4" />, label: 'Waiting' };
      default:
        return { color: 'text-blue-400 bg-blue-400/10', icon: <Circle className="w-4 h-4" />, label: 'Open' };
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-400';
      case 'high': return 'text-orange-400';
      case 'low': return 'text-gray-400';
      default: return 'text-gray-300';
    }
  };

  // Filter tickets
  const filteredTickets = tickets.filter(ticket => {
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!ticket.subject.toLowerCase().includes(q) &&
          !ticket.client_name.toLowerCase().includes(q) &&
          !(ticket.description || '').toLowerCase().includes(q)) {
        return false;
      }
    }

    // Visibility filter
    if (visibilityFilter === 'internal' && ticket.visibility === 'client') return false;
    if (visibilityFilter === 'client' && ticket.visibility !== 'client') return false;

    // Status filter
    if (statusFilter !== 'all' && ticket.status !== statusFilter) return false;

    // Client filter
    if (clientFilter !== 'all' && ticket.client_id !== clientFilter) return false;

    return true;
  });

  // Get unique clients from tickets
  const ticketClients = [...new Set(tickets.map(t => t.client_id))]
    .map(id => {
      const ticket = tickets.find(t => t.client_id === id);
      return ticket ? { id, name: ticket.client_name } : null;
    })
    .filter(Boolean);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Client Tickets</h1>
          <p className="text-gray-400">
            {counts.total} total ({counts.internal} internal, {counts.client_visible} client-visible)
          </p>
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
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tickets..."
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Visibility Filter */}
        <div className="flex bg-gray-800/50 rounded-lg p-1">
          <button
            onClick={() => setVisibilityFilter('all')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              visibilityFilter === 'all' ? 'bg-amber-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setVisibilityFilter('client')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
              visibilityFilter === 'client' ? 'bg-amber-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Eye className="w-3 h-3" />
            Client
          </button>
          <button
            onClick={() => setVisibilityFilter('internal')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
              visibilityFilter === 'internal' ? 'bg-amber-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <EyeOff className="w-3 h-3" />
            Internal
          </button>
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="waiting">Waiting</option>
          <option value="resolved">Resolved</option>
        </select>

        {/* Client Filter */}
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="all">All Clients</option>
          {ticketClients.map(c => c && (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Tickets List */}
      {filteredTickets.length === 0 ? (
        <div className="admin-card p-12 text-center">
          <Ticket className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Tickets Found</h3>
          <p className="text-gray-400 mb-6">
            {searchQuery || visibilityFilter !== 'all' || statusFilter !== 'all' || clientFilter !== 'all'
              ? 'Try adjusting your filters.'
              : 'Create a ticket to track client requests or internal notes.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((ticket) => {
            const isExpanded = expandedTicket === ticket.id;
            const statusConfig = getStatusConfig(ticket.status);
            const isInternal = ticket.visibility !== 'client';

            return (
              <div
                key={ticket.id}
                className={`admin-card overflow-hidden ${
                  isInternal ? 'border-l-4 border-l-purple-500' : ''
                }`}
              >
                {/* Ticket Header */}
                <button
                  onClick={() => setExpandedTicket(isExpanded ? null : ticket.id)}
                  className="w-full px-5 py-4 text-left hover:bg-gray-800/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                          {statusConfig.icon}
                          {statusConfig.label}
                        </span>
                        {isInternal && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-purple-400 bg-purple-400/10">
                            <EyeOff className="w-3 h-3" />
                            Internal
                          </span>
                        )}
                        {ticket.is_upsell_opportunity === 1 && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium text-green-400 bg-green-400/10">
                            Upsell
                          </span>
                        )}
                        {ticket.priority !== 'normal' && (
                          <span className={`text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
                            {ticket.priority}
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-medium text-white truncate">
                        {ticket.subject}
                      </h3>

                      <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
                        <Building2 className="w-3 h-3" />
                        {ticket.client_name}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="hidden sm:block text-right text-xs text-gray-500">
                        {formatDate(ticket.created_at)}
                      </div>
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </div>
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-gray-700 px-5 py-4 bg-gray-900/30">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 uppercase mb-3">Details</h4>
                        {ticket.description ? (
                          <p className="text-gray-300 text-sm whitespace-pre-wrap mb-4">{ticket.description}</p>
                        ) : (
                          <p className="text-gray-500 text-sm italic mb-4">No description</p>
                        )}

                        <dl className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <dt className="text-gray-400">Visibility</dt>
                            <dd className={ticket.visibility === 'client' ? 'text-white' : 'text-purple-400'}>
                              {ticket.visibility === 'client' ? 'Client Visible' : 'Internal Only'}
                            </dd>
                          </div>
                          {ticket.upsell_type && (
                            <div className="flex justify-between">
                              <dt className="text-gray-400">Upsell Type</dt>
                              <dd className="text-green-400">{ticket.upsell_type.replace(/_/g, ' ')}</dd>
                            </div>
                          )}
                        </dl>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-gray-400 uppercase mb-3">Actions</h4>
                        <div className="space-y-2">
                          <label className="block text-sm text-gray-400 mb-1">Update Status</label>
                          <select
                            value={ticket.status}
                            onChange={(e) => handleUpdateStatus(ticket.id, e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                          >
                            <option value="open">Open</option>
                            <option value="in_progress">In Progress</option>
                            <option value="waiting">Waiting</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Ticket Conversation */}
                    <div className="mt-4 pt-4 border-t border-gray-700">
                      <TicketComments
                        ticketId={ticket.id}
                        apiBase={`/api/rep/${slug}/tickets`}
                        userRole="rep"
                        showVisibilityToggle={true}
                      />
                    </div>

                    <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-700">
                      <button
                        onClick={() => navigate(`/portal/${ticket.client_slug}`)}
                        className="inline-flex items-center gap-2 px-4 py-2 text-amber-400 hover:text-amber-300 text-sm transition-colors"
                      >
                        <Building2 className="w-4 h-4" />
                        View Client Portal
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
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 sticky top-0 bg-gray-900">
              <h2 className="text-lg font-semibold text-white">New Ticket</h2>
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
                  Client <span className="text-red-400">*</span>
                </label>
                <select
                  value={newTicket.client_id}
                  onChange={(e) => setNewTicket({ ...newTicket, client_id: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                >
                  <option value="">Select client...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.company}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Subject <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                  placeholder="Brief description"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                <textarea
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                  placeholder="Provide more details..."
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Visibility</label>
                  <select
                    value={newTicket.visibility}
                    onChange={(e) => setNewTicket({ ...newTicket, visibility: e.target.value as 'client' | 'internal' })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="client">Client Visible</option>
                    <option value="internal">Internal Only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Priority</label>
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

              {/* Upsell option */}
              <div className="border border-gray-700 rounded-lg p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newTicket.is_upsell_opportunity}
                    onChange={(e) => setNewTicket({ ...newTicket, is_upsell_opportunity: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-amber-500 focus:ring-amber-500"
                  />
                  <span className="text-sm text-gray-300">Mark as upsell opportunity</span>
                </label>

                {newTicket.is_upsell_opportunity && (
                  <select
                    value={newTicket.upsell_type}
                    onChange={(e) => setNewTicket({ ...newTicket, upsell_type: e.target.value })}
                    className="mt-3 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">Select upsell type...</option>
                    <option value="go_live_support">Go-Live Support</option>
                    <option value="training">Staff Training</option>
                    <option value="optimization">System Optimization</option>
                    <option value="support_plan">Support Plan Upgrade</option>
                    <option value="network_support">Network Support</option>
                    <option value="add_locations">Additional Locations</option>
                  </select>
                )}
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
                  disabled={isSubmitting || !newTicket.client_id || !newTicket.subject.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
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

export default RepTickets;
