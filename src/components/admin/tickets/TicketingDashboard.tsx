import React, { useState, useEffect } from 'react';
import {
  Ticket, Plus, Search, Filter, RefreshCw, Loader2, ChevronRight,
  AlertCircle, Clock, CheckCircle, X, Building2, Flag, Tag,
  MessageSquare, Save, Trash2
} from 'lucide-react';

interface Ticket {
  id: string;
  client_id: string;
  client_name: string;
  client_company: string;
  project_id: string | null;
  subject: string;
  description: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
  category: string | null;
  assigned_to: string | null;
  resolved_at: number | null;
  created_at: number;
  updated_at: number;
}

interface Client {
  id: string;
  name: string;
  company: string;
}

interface TicketingDashboardProps {
  clients?: Client[];
}

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', color: 'bg-red-500', textColor: 'text-red-400', borderColor: 'border-red-500' },
  high: { label: 'High', color: 'bg-orange-500', textColor: 'text-orange-400', borderColor: 'border-orange-500' },
  normal: { label: 'Normal', color: 'bg-blue-500', textColor: 'text-blue-400', borderColor: 'border-blue-500' },
  low: { label: 'Low', color: 'bg-gray-500', textColor: 'text-gray-400', borderColor: 'border-gray-500' }
};

const STATUS_CONFIG = {
  open: { label: 'Open', color: 'bg-blue-500/20 text-blue-400 border-blue-500/50', icon: AlertCircle },
  in_progress: { label: 'In Progress', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50', icon: Clock },
  waiting: { label: 'Waiting', color: 'bg-purple-500/20 text-purple-400 border-purple-500/50', icon: Clock },
  resolved: { label: 'Resolved', color: 'bg-green-500/20 text-green-400 border-green-500/50', icon: CheckCircle },
  closed: { label: 'Closed', color: 'bg-gray-500/20 text-gray-400 border-gray-500/50', icon: X }
};

const CATEGORIES = ['technical', 'billing', 'feature', 'training', 'other'];

const TicketingDashboard: React.FC<TicketingDashboardProps> = ({ clients: propClients }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [clients, setClients] = useState<Client[]>(propClients || []);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [newTicket, setNewTicket] = useState({
    client_id: '',
    subject: '',
    description: '',
    priority: 'normal' as const,
    category: ''
  });

  useEffect(() => {
    loadTickets();
    if (!propClients) loadClients();
  }, [filterStatus, filterPriority]);

  const loadTickets = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (filterPriority !== 'all') params.append('priority', filterPriority);

      const response = await fetch(`/api/admin/tickets?${params}`);
      const result = await response.json();
      if (result.success) {
        setTickets(result.data || []);
        setStatusCounts(result.statusCounts || {});
      }
    } catch (error) {
      console.error('Failed to load tickets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadClients = async () => {
    try {
      const response = await fetch('/api/admin/clients');
      const result = await response.json();
      if (result.success) {
        setClients(result.data || []);
      }
    } catch (error) {
      console.error('Failed to load clients:', error);
    }
  };

  const createTicket = async () => {
    if (!newTicket.client_id || !newTicket.subject) return;
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTicket)
      });
      const result = await response.json();
      if (result.success) {
        setShowCreateModal(false);
        setNewTicket({ client_id: '', subject: '', description: '', priority: 'normal', category: '' });
        loadTickets();
      }
    } catch (error) {
      console.error('Failed to create ticket:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const updateTicketStatus = async (ticketId: string, status: string) => {
    try {
      await fetch(`/api/admin/tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      loadTickets();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(prev => prev ? { ...prev, status: status as Ticket['status'] } : null);
      }
    } catch (error) {
      console.error('Failed to update ticket:', error);
    }
  };

  const deleteTicket = async (ticketId: string) => {
    if (!confirm('Delete this ticket?')) return;
    try {
      await fetch(`/api/admin/tickets/${ticketId}`, { method: 'DELETE' });
      loadTickets();
      if (selectedTicket?.id === ticketId) setSelectedTicket(null);
    } catch (error) {
      console.error('Failed to delete ticket:', error);
    }
  };

  const filteredTickets = tickets.filter(ticket =>
    ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.client_company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  };

  const totalOpen = (statusCounts.open || 0) + (statusCounts.in_progress || 0) + (statusCounts.waiting || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
            <Ticket className="w-5 h-5 text-amber-400" />
            Support Tickets
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {totalOpen} open ticket{totalOpen !== 1 ? 's' : ''} • {tickets.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadTickets}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Ticket
          </button>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {['all', 'open', 'in_progress', 'waiting', 'resolved', 'closed'].map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
              filterStatus === status
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                : 'text-gray-400 hover:text-white hover:bg-gray-800 border border-transparent'
            }`}
          >
            {status === 'all' ? 'All' : STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.label || status}
            {status !== 'all' && statusCounts[status] !== undefined && (
              <span className="px-1.5 py-0.5 bg-gray-700 rounded text-xs">{statusCounts[status]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="admin-card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search tickets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">All Priorities</option>
            {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tickets List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="admin-card p-12 text-center">
          <Ticket className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-white font-semibold mb-2">No Tickets Found</h3>
          <p className="text-gray-400 text-sm mb-4">
            {searchQuery || filterStatus !== 'all' ? 'Try adjusting your filters' : 'Create your first support ticket'}
          </p>
          {!searchQuery && filterStatus === 'all' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Ticket
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map(ticket => {
            const priorityConfig = PRIORITY_CONFIG[ticket.priority];
            const statusConfig = STATUS_CONFIG[ticket.status];
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={ticket.id}
                className={`admin-card p-4 cursor-pointer hover:border-amber-500/50 transition-all border-l-4 ${priorityConfig.borderColor}`}
                onClick={() => setSelectedTicket(ticket)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs border ${statusConfig.color}`}>
                        {statusConfig.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs ${priorityConfig.textColor} bg-${ticket.priority === 'urgent' ? 'red' : ticket.priority === 'high' ? 'orange' : 'gray'}-500/10`}>
                        {priorityConfig.label}
                      </span>
                      {ticket.category && (
                        <span className="px-2 py-0.5 bg-gray-700 text-gray-300 rounded text-xs capitalize">
                          {ticket.category}
                        </span>
                      )}
                    </div>
                    <h3 className="text-white font-semibold truncate">{ticket.subject}</h3>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {ticket.client_company || ticket.client_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(ticket.created_at)}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Ticket Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-lg w-full border border-gray-700">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h3 className="text-lg font-bold text-white">New Support Ticket</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Client *</label>
                <select
                  value={newTicket.client_id}
                  onChange={(e) => setNewTicket(prev => ({ ...prev, client_id: e.target.value }))}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white"
                >
                  <option value="">Select client...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.company || c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Subject *</label>
                <input
                  type="text"
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Brief description of the issue..."
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Description</label>
                <textarea
                  value={newTicket.description}
                  onChange={(e) => setNewTicket(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  placeholder="Detailed description..."
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Priority</label>
                  <select
                    value={newTicket.priority}
                    onChange={(e) => setNewTicket(prev => ({ ...prev, priority: e.target.value as Ticket['priority'] }))}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white"
                  >
                    {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Category</label>
                  <select
                    value={newTicket.category}
                    onChange={(e) => setNewTicket(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white"
                  >
                    <option value="">Select...</option>
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat} className="capitalize">{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={createTicket}
                disabled={isSaving || !newTicket.client_id || !newTicket.subject}
                className="px-6 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 text-white font-medium rounded-lg flex items-center gap-2"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-2xl w-full border border-gray-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-700 sticky top-0 bg-gray-800">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded text-xs border ${STATUS_CONFIG[selectedTicket.status].color}`}>
                    {STATUS_CONFIG[selectedTicket.status].label}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs ${PRIORITY_CONFIG[selectedTicket.priority].textColor}`}>
                    {PRIORITY_CONFIG[selectedTicket.priority].label} Priority
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white">{selectedTicket.subject}</h3>
              </div>
              <button onClick={() => setSelectedTicket(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Client</p>
                  <p className="text-white">{selectedTicket.client_company || selectedTicket.client_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Category</p>
                  <p className="text-white capitalize">{selectedTicket.category || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Created</p>
                  <p className="text-white">{formatDate(selectedTicket.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Last Updated</p>
                  <p className="text-white">{formatDate(selectedTicket.updated_at)}</p>
                </div>
              </div>

              {selectedTicket.description && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">Description</p>
                  <p className="text-gray-300 bg-gray-900/50 p-4 rounded-lg border border-gray-700 whitespace-pre-wrap">
                    {selectedTicket.description}
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs text-gray-500 mb-2">Update Status</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                    <button
                      key={status}
                      onClick={() => updateTicketStatus(selectedTicket.id, status)}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                        selectedTicket.status === status
                          ? config.color
                          : 'border-gray-600 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {config.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-700 flex justify-between">
              <button
                onClick={() => deleteTicket(selectedTicket.id)}
                className="px-4 py-2 text-red-400 hover:bg-red-500/10 rounded-lg flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              <button
                onClick={() => setSelectedTicket(null)}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketingDashboard;
