import React, { useState, useEffect } from 'react';
import {
  Building2, Briefcase, Users, Eye, ExternalLink, RefreshCw, Loader2,
  Search, Filter, ChevronRight, CheckCircle, Clock, AlertTriangle,
  Mail, Phone, Link2, Shield, Ticket, MessageSquare, MoreVertical,
  Play, UserCheck, XCircle
} from 'lucide-react';

// ============================================
// TYPE DEFINITIONS
// ============================================
interface ClientPortal {
  id: string;
  name: string;
  company: string;
  email: string;
  slug: string | null;
  portal_enabled: boolean;
  support_plan_tier: string | null;
  support_plan_status: string | null;
  last_login: number | null;
  active_projects: number;
  open_tickets: number;
  unread_messages: number;
  assigned_reps: RepSummary[];
}

interface RepPortal {
  id: string;
  name: string;
  email: string;
  territory: string | null;
  slug: string | null;
  portal_enabled: boolean;
  status: 'active' | 'inactive' | 'pending';
  last_login: number | null;
  total_clients: number;
  pending_referrals: number;
  commissions_mtd: number;
  assigned_clients: ClientSummary[];
}

interface RepSummary {
  id: string;
  name: string;
  role: string;
}

interface ClientSummary {
  id: string;
  company: string;
  status: string;
}

interface PortalStats {
  totalClients: number;
  enabledClientPortals: number;
  activeClientSessions: number;
  totalReps: number;
  enabledRepPortals: number;
  activeRepSessions: number;
}

type ViewMode = 'clients' | 'reps' | 'combined';
type FilterStatus = 'all' | 'enabled' | 'disabled' | 'active';

// ============================================
// PORTAL MANAGEMENT COMPONENT
// ============================================
const PortalManagement: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('combined');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [clients, setClients] = useState<ClientPortal[]>([]);
  const [reps, setReps] = useState<RepPortal[]>([]);
  const [stats, setStats] = useState<PortalStats>({
    totalClients: 0,
    enabledClientPortals: 0,
    activeClientSessions: 0,
    totalReps: 0,
    enabledRepPortals: 0,
    activeRepSessions: 0
  });

  const [selectedClient, setSelectedClient] = useState<ClientPortal | null>(null);
  const [selectedRep, setSelectedRep] = useState<RepPortal | null>(null);

  // Load data
  useEffect(() => {
    loadPortalData();
  }, []);

  const loadPortalData = async () => {
    setIsLoading(true);
    try {
      const [clientsRes, repsRes] = await Promise.all([
        fetch('/api/admin/clients'),
        fetch('/api/admin/reps')
      ]);

      const clientsData = await clientsRes.json();
      const repsData = await repsRes.json();

      if (clientsData.success) {
        const clientPortals: ClientPortal[] = (clientsData.data || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          company: c.company,
          email: c.email,
          slug: c.slug,
          portal_enabled: c.portal_enabled || false,
          support_plan_tier: c.support_plan_tier,
          support_plan_status: c.support_plan_status,
          last_login: c.last_login || null,
          active_projects: c.active_projects || 0,
          open_tickets: c.open_tickets || 0,
          unread_messages: c.unread_messages || 0,
          assigned_reps: c.assigned_reps || []
        }));
        setClients(clientPortals);
      }

      if (repsData.success) {
        const repPortals: RepPortal[] = (repsData.data || []).map((r: any) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          territory: r.territory,
          slug: r.slug,
          portal_enabled: r.portal_enabled || false,
          status: r.status || 'pending',
          last_login: r.last_login || null,
          total_clients: r.total_clients || 0,
          pending_referrals: r.pending_referrals || 0,
          commissions_mtd: r.commissions_mtd || 0,
          assigned_clients: r.assigned_clients || []
        }));
        setReps(repPortals);
      }

      // Calculate stats
      const clientsArr = clientsData.success ? clientsData.data || [] : [];
      const repsArr = repsData.success ? repsData.data || [] : [];

      setStats({
        totalClients: clientsArr.length,
        enabledClientPortals: clientsArr.filter((c: any) => c.portal_enabled).length,
        activeClientSessions: 0, // Would come from sessions API
        totalReps: repsArr.length,
        enabledRepPortals: repsArr.filter((r: any) => r.portal_enabled).length,
        activeRepSessions: 0 // Would come from sessions API
      });

    } catch (error) {
      console.error('Failed to load portal data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePortalEnabled = async (type: 'client' | 'rep', id: string, enabled: boolean) => {
    try {
      const endpoint = type === 'client' ? `/api/admin/clients/${id}` : `/api/admin/reps/${id}`;
      await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portal_enabled: enabled })
      });
      loadPortalData();
    } catch (error) {
      console.error('Failed to toggle portal:', error);
    }
  };

  const openPortalInNewTab = (type: 'client' | 'rep', slug: string) => {
    const path = type === 'client' ? `/portal/${slug}/dashboard` : `/rep/${slug}/dashboard`;
    window.open(`/#${path}?demo=true`, '_blank');
  };

  const formatTimeAgo = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const seconds = Math.floor(Date.now() / 1000 - timestamp);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  // Filter functions
  const filteredClients = clients.filter(client => {
    if (filterStatus === 'enabled' && !client.portal_enabled) return false;
    if (filterStatus === 'disabled' && client.portal_enabled) return false;
    if (filterStatus === 'active' && !client.last_login) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        client.name.toLowerCase().includes(query) ||
        client.company.toLowerCase().includes(query) ||
        client.email.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const filteredReps = reps.filter(rep => {
    if (filterStatus === 'enabled' && !rep.portal_enabled) return false;
    if (filterStatus === 'disabled' && rep.portal_enabled) return false;
    if (filterStatus === 'active' && !rep.last_login) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        rep.name.toLowerCase().includes(query) ||
        (rep.territory?.toLowerCase().includes(query)) ||
        rep.email.toLowerCase().includes(query)
      );
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            Portal Management
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            View and manage all client and rep portals
          </p>
        </div>
        <button
          onClick={loadPortalData}
          className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="admin-card p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <Building2 className="w-4 h-4" />
            <span>Total Clients</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.totalClients}</p>
        </div>
        <div className="admin-card p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span>Enabled Portals</span>
          </div>
          <p className="text-2xl font-bold text-green-400">{stats.enabledClientPortals}</p>
        </div>
        <div className="admin-card p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <Eye className="w-4 h-4 text-blue-400" />
            <span>Active Sessions</span>
          </div>
          <p className="text-2xl font-bold text-blue-400">{stats.activeClientSessions}</p>
        </div>
        <div className="admin-card p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <Briefcase className="w-4 h-4" />
            <span>Total Reps</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.totalReps}</p>
        </div>
        <div className="admin-card p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span>Rep Portals</span>
          </div>
          <p className="text-2xl font-bold text-green-400">{stats.enabledRepPortals}</p>
        </div>
        <div className="admin-card p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <Eye className="w-4 h-4 text-blue-400" />
            <span>Rep Sessions</span>
          </div>
          <p className="text-2xl font-bold text-blue-400">{stats.activeRepSessions}</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* View Mode Tabs */}
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          {[
            { id: 'combined' as ViewMode, label: 'All Portals', icon: Users },
            { id: 'clients' as ViewMode, label: 'Clients', icon: Building2 },
            { id: 'reps' as ViewMode, label: 'Reps', icon: Briefcase }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                viewMode === tab.id
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
        >
          <option value="all">All Status</option>
          <option value="enabled">Enabled Only</option>
          <option value="disabled">Disabled Only</option>
          <option value="active">Recently Active</option>
        </select>

        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, company, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500"
          />
        </div>
      </div>

      {/* Client Portals Section */}
      {(viewMode === 'combined' || viewMode === 'clients') && (
        <section className="admin-card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-purple-400" />
              Client Portals
              <span className="text-sm text-gray-400 font-normal">({filteredClients.length})</span>
            </h3>
          </div>
          <div className="divide-y divide-gray-700/50">
            {filteredClients.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No client portals found</p>
              </div>
            ) : (
              filteredClients.map(client => (
                <div key={client.id} className="px-6 py-4 hover:bg-gray-800/30 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    {/* Client Info */}
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-6 h-6 text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-white truncate">{client.company}</h4>
                          {client.portal_enabled ? (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded-full">
                              <CheckCircle className="w-3 h-3" />
                              Enabled
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-500/10 text-gray-400 text-xs rounded-full">
                              <XCircle className="w-3 h-3" />
                              Disabled
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400">{client.name}</p>
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {client.email}
                          </span>
                          {client.slug && (
                            <span className="flex items-center gap-1">
                              <Link2 className="w-3 h-3" />
                              /portal/{client.slug}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Last login: {formatTimeAgo(client.last_login)}
                          </span>
                        </div>

                        {/* Stats Row */}
                        <div className="flex flex-wrap items-center gap-4 mt-3">
                          {client.support_plan_tier && (
                            <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                              client.support_plan_status === 'active'
                                ? 'bg-amber-500/10 text-amber-400'
                                : 'bg-gray-500/10 text-gray-400'
                            }`}>
                              <Shield className="w-3 h-3" />
                              {client.support_plan_tier}
                            </span>
                          )}
                          {client.active_projects > 0 && (
                            <span className="text-xs text-blue-400">
                              {client.active_projects} active project{client.active_projects !== 1 ? 's' : ''}
                            </span>
                          )}
                          {client.open_tickets > 0 && (
                            <span className="text-xs text-amber-400">
                              {client.open_tickets} open ticket{client.open_tickets !== 1 ? 's' : ''}
                            </span>
                          )}
                          {client.unread_messages > 0 && (
                            <span className="text-xs text-purple-400">
                              {client.unread_messages} unread message{client.unread_messages !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>

                        {/* Assigned Reps */}
                        {client.assigned_reps.length > 0 && (
                          <div className="flex items-center gap-2 mt-3">
                            <span className="text-xs text-gray-500">Assigned Reps:</span>
                            <div className="flex flex-wrap gap-1">
                              {client.assigned_reps.map(rep => (
                                <span key={rep.id} className="px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded">
                                  {rep.name} ({rep.role})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {client.slug && (
                        <button
                          onClick={() => openPortalInNewTab('client', client.slug!)}
                          className="flex items-center gap-1 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                          title="Preview as client"
                        >
                          <Eye className="w-4 h-4" />
                          <span className="hidden md:inline">Preview</span>
                        </button>
                      )}
                      <button
                        onClick={() => togglePortalEnabled('client', client.id, !client.portal_enabled)}
                        className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                          client.portal_enabled
                            ? 'text-red-400 hover:bg-red-500/10'
                            : 'text-green-400 hover:bg-green-500/10'
                        }`}
                      >
                        {client.portal_enabled ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* Rep Portals Section */}
      {(viewMode === 'combined' || viewMode === 'reps') && (
        <section className="admin-card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-green-400" />
              Rep Portals
              <span className="text-sm text-gray-400 font-normal">({filteredReps.length})</span>
            </h3>
          </div>
          <div className="divide-y divide-gray-700/50">
            {filteredReps.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No rep portals found</p>
              </div>
            ) : (
              filteredReps.map(rep => (
                <div key={rep.id} className="px-6 py-4 hover:bg-gray-800/30 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    {/* Rep Info */}
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Briefcase className="w-6 h-6 text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-white truncate">{rep.name}</h4>
                          {rep.portal_enabled ? (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded-full">
                              <CheckCircle className="w-3 h-3" />
                              Enabled
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-500/10 text-gray-400 text-xs rounded-full">
                              <XCircle className="w-3 h-3" />
                              Disabled
                            </span>
                          )}
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            rep.status === 'active' ? 'bg-green-500/10 text-green-400' :
                            rep.status === 'pending' ? 'bg-amber-500/10 text-amber-400' :
                            'bg-gray-500/10 text-gray-400'
                          }`}>
                            {rep.status}
                          </span>
                        </div>
                        {rep.territory && (
                          <p className="text-sm text-gray-400">Territory: {rep.territory}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {rep.email}
                          </span>
                          {rep.slug && (
                            <span className="flex items-center gap-1">
                              <Link2 className="w-3 h-3" />
                              /rep/{rep.slug}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Last login: {formatTimeAgo(rep.last_login)}
                          </span>
                        </div>

                        {/* Stats Row */}
                        <div className="flex flex-wrap items-center gap-4 mt-3">
                          <span className="text-xs text-blue-400">
                            {rep.total_clients} client{rep.total_clients !== 1 ? 's' : ''}
                          </span>
                          {rep.pending_referrals > 0 && (
                            <span className="text-xs text-amber-400">
                              {rep.pending_referrals} pending referral{rep.pending_referrals !== 1 ? 's' : ''}
                            </span>
                          )}
                          {rep.commissions_mtd > 0 && (
                            <span className="text-xs text-green-400">
                              ${rep.commissions_mtd.toFixed(2)} MTD
                            </span>
                          )}
                        </div>

                        {/* Assigned Clients */}
                        {rep.assigned_clients.length > 0 && (
                          <div className="flex items-center gap-2 mt-3">
                            <span className="text-xs text-gray-500">Clients:</span>
                            <div className="flex flex-wrap gap-1">
                              {rep.assigned_clients.slice(0, 3).map(client => (
                                <span key={client.id} className="px-2 py-0.5 bg-purple-500/10 text-purple-400 text-xs rounded">
                                  {client.company}
                                </span>
                              ))}
                              {rep.assigned_clients.length > 3 && (
                                <span className="px-2 py-0.5 bg-gray-500/10 text-gray-400 text-xs rounded">
                                  +{rep.assigned_clients.length - 3} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {rep.slug && (
                        <button
                          onClick={() => openPortalInNewTab('rep', rep.slug!)}
                          className="flex items-center gap-1 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                          title="Preview as rep"
                        >
                          <Eye className="w-4 h-4" />
                          <span className="hidden md:inline">Preview</span>
                        </button>
                      )}
                      <button
                        onClick={() => togglePortalEnabled('rep', rep.id, !rep.portal_enabled)}
                        className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                          rep.portal_enabled
                            ? 'text-red-400 hover:bg-red-500/10'
                            : 'text-green-400 hover:bg-green-500/10'
                        }`}
                      >
                        {rep.portal_enabled ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* Quick Actions */}
      <section className="admin-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Portal Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => window.open('/#/portal/demo-seafood-shack/dashboard?demo=true', '_blank')}
            className="flex flex-col items-center gap-2 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg hover:bg-purple-500/20 transition-colors"
          >
            <Building2 className="w-6 h-6 text-purple-400" />
            <span className="text-sm text-purple-400 text-center">Demo Client Portal</span>
          </button>
          <button
            onClick={() => window.open('/#/rep/demo-rep/dashboard?demo=true', '_blank')}
            className="flex flex-col items-center gap-2 p-4 bg-green-500/10 border border-green-500/30 rounded-lg hover:bg-green-500/20 transition-colors"
          >
            <Briefcase className="w-6 h-6 text-green-400" />
            <span className="text-sm text-green-400 text-center">Demo Rep Portal</span>
          </button>
          <button
            onClick={() => {/* Navigate to client management */}}
            className="flex flex-col items-center gap-2 p-4 bg-gray-800/50 border border-gray-700 rounded-lg hover:bg-gray-700/50 transition-colors"
          >
            <UserCheck className="w-6 h-6 text-gray-400" />
            <span className="text-sm text-gray-400 text-center">Manage Assignments</span>
          </button>
          <button
            onClick={() => {/* Navigate to messages */}}
            className="flex flex-col items-center gap-2 p-4 bg-gray-800/50 border border-gray-700 rounded-lg hover:bg-gray-700/50 transition-colors"
          >
            <MessageSquare className="w-6 h-6 text-gray-400" />
            <span className="text-sm text-gray-400 text-center">View All Messages</span>
          </button>
        </div>
      </section>
    </div>
  );
};

export default PortalManagement;
