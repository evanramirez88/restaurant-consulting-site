import React, { useState, useEffect } from 'react';
import {
  Search, Plus, Building2, MapPin, Shield, ExternalLink, ChevronRight,
  Loader2, RefreshCw, Users, Mail, Phone, FolderOpen, MoreVertical
} from 'lucide-react';

interface Client {
  id: string;
  email: string;
  name: string;
  company: string;
  slug: string | null;
  portal_enabled: boolean;
  support_plan_tier: string | null;
  support_plan_status: string | null;
  google_drive_folder_id: string | null;
  avatar_url: string | null;
  notes: string | null;
  created_at: number;
  restaurant_count?: number;
  rep_count?: number;
}

interface ClientListProps {
  onSelectClient: (client: Client) => void;
  onCreateClient: () => void;
}

const ClientList: React.FC<ClientListProps> = ({ onSelectClient, onCreateClient }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/clients');
      const result = await response.json();
      if (result.success) {
        setClients(result.data || []);
      }
    } catch (error) {
      console.error('Failed to load clients:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredClients = clients.filter(client => {
    const matchesSearch =
      client.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.slug?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'active' && client.portal_enabled) ||
      (filterStatus === 'inactive' && !client.portal_enabled) ||
      (filterStatus === 'support' && client.support_plan_status === 'active');

    return matchesSearch && matchesStatus;
  });

  const getSupportBadge = (tier: string | null, status: string | null) => {
    if (!tier || status !== 'active') return null;
    const colors: Record<string, string> = {
      essential: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
      professional: 'bg-amber-500/20 text-amber-400 border-amber-500/50',
      premium: 'bg-green-500/20 text-green-400 border-green-500/50'
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs border ${colors[tier] || 'bg-gray-500/20 text-gray-400'}`}>
        {tier.charAt(0).toUpperCase() + tier.slice(1)}
      </span>
    );
  };

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
            <Building2 className="w-5 h-5 text-amber-400" />
            Client Portals
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {clients.length} total clients{filteredClients.length !== clients.length ? ` (${filteredClients.length} shown)` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadClients}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={onCreateClient}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Client
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="admin-card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search clients by name, company, email, or slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">All Clients</option>
            <option value="active">Portal Active</option>
            <option value="inactive">Portal Inactive</option>
            <option value="support">With Support Plan</option>
          </select>
        </div>
      </div>

      {/* Client Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.map((client) => (
          <div
            key={client.id}
            className="admin-card p-4 hover:border-amber-500/50 transition-all cursor-pointer group"
            onClick={() => onSelectClient(client)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center border border-gray-700">
                  {client.avatar_url ? (
                    <img src={client.avatar_url} alt="" className="w-full h-full rounded-lg object-cover" />
                  ) : (
                    <Building2 className="w-6 h-6 text-gray-500" />
                  )}
                </div>
                <div>
                  <h3 className="text-white font-semibold group-hover:text-amber-400 transition-colors">
                    {client.company || client.name}
                  </h3>
                  <p className="text-gray-400 text-sm">{client.name}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-amber-400 transition-colors" />
            </div>

            <div className="space-y-2 text-sm">
              {client.slug && (
                <div className="flex items-center gap-2 text-gray-400">
                  <ExternalLink className="w-3 h-3" />
                  <span className="font-mono text-xs">/portal/{client.slug}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-400">
                <Mail className="w-3 h-3" />
                <span className="truncate">{client.email}</span>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-700">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${client.portal_enabled ? 'bg-green-500' : 'bg-gray-500'}`} />
                <span className="text-xs text-gray-400">
                  {client.portal_enabled ? 'Portal Active' : 'Portal Inactive'}
                </span>
              </div>
              {getSupportBadge(client.support_plan_tier, client.support_plan_status)}
            </div>

            {(client.restaurant_count || client.rep_count) && (
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                {client.restaurant_count && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {client.restaurant_count} location{client.restaurant_count !== 1 ? 's' : ''}
                  </span>
                )}
                {client.rep_count && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {client.rep_count} rep{client.rep_count !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredClients.length === 0 && (
        <div className="admin-card p-12 text-center">
          <Building2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-white font-semibold mb-2">No Clients Found</h3>
          <p className="text-gray-400 text-sm mb-4">
            {searchQuery || filterStatus !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Get started by adding your first client'}
          </p>
          {!searchQuery && filterStatus === 'all' && (
            <button
              onClick={onCreateClient}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add First Client
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ClientList;
