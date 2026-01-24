import React, { useState, useEffect } from 'react';
import {
  Search, Plus, Briefcase, MapPin, ExternalLink, ChevronRight,
  Loader2, RefreshCw, Users, Mail, Phone, DollarSign, Grid3X3, List, Eye, X
} from 'lucide-react';

interface Rep {
  id: string;
  email: string;
  name: string;
  territory: string | null;
  slug: string | null;
  phone?: string;
  portal_enabled: boolean;
  status: 'active' | 'inactive' | 'pending';
  avatar_url: string | null;
  notes: string | null;
  created_at: number;
  client_count?: number;
  total_commission?: number;
}

type ViewMode = 'cards' | 'table';

interface RepListProps {
  onSelectRep: (rep: Rep) => void;
  onCreateRep: () => void;
}

const RepList: React.FC<RepListProps> = ({ onSelectRep, onCreateRep }) => {
  const [reps, setReps] = useState<Rep[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  useEffect(() => {
    loadReps();
  }, []);

  const loadReps = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/reps');
      const result = await response.json();
      if (result.success) {
        setReps(result.data || []);
      }
    } catch (error) {
      console.error('Failed to load reps:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredReps = reps.filter(rep => {
    const matchesSearch =
      rep.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rep.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rep.territory?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rep.slug?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = filterStatus === 'all' || rep.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-500/20 text-green-400 border-green-500/50',
      inactive: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
      pending: 'bg-amber-500/20 text-amber-400 border-amber-500/50'
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs border ${colors[status] || colors.inactive}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
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
            <Briefcase className="w-5 h-5 text-amber-400" />
            Rep Portals
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {reps.length} total reps{filteredReps.length !== reps.length ? ` (${filteredReps.length} shown)` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadReps}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={onCreateRep}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Rep
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
              placeholder="Search reps by name, email, territory, or slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-white rounded transition-colors"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending</option>
          </select>
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded transition-colors ${viewMode === 'table' ? 'bg-amber-500/20 text-amber-400' : 'text-gray-400 hover:text-white'}`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 rounded transition-colors ${viewMode === 'cards' ? 'bg-amber-500/20 text-amber-400' : 'text-gray-400 hover:text-white'}`}
              title="Card View"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Table View */}
      {viewMode === 'table' && filteredReps.length > 0 && (
        <div className="admin-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700 bg-gray-800/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Territory</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Portal</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Clients</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Commission</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {filteredReps.map((rep) => (
                  <tr
                    key={rep.id}
                    className="hover:bg-gray-800/30 transition-colors cursor-pointer"
                    onClick={() => onSelectRep(rep)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center border border-gray-700 flex-shrink-0">
                          {rep.avatar_url ? (
                            <img src={rep.avatar_url} alt="" className="w-full h-full rounded-lg object-cover" />
                          ) : (
                            <Briefcase className="w-4 h-4 text-gray-500" />
                          )}
                        </div>
                        <span className="text-white font-medium">{rep.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`mailto:${rep.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-blue-400 hover:text-blue-300 text-sm"
                      >
                        {rep.email}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{rep.phone || '-'}</td>
                    <td className="px-4 py-3">
                      {rep.territory ? (
                        <span className="flex items-center gap-1 text-gray-300 text-sm">
                          <MapPin className="w-3 h-3 text-gray-500" />
                          {rep.territory}
                        </span>
                      ) : (
                        <span className="text-gray-500 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${rep.portal_enabled ? 'bg-green-500' : 'bg-gray-500'}`} />
                        {rep.portal_enabled && rep.slug ? (
                          <a
                            href={`/#/rep/${rep.slug}/dashboard`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-amber-400 hover:text-amber-300 font-mono"
                          >
                            /{rep.slug}
                          </a>
                        ) : (
                          <span className="text-xs text-gray-500">Disabled</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(rep.status)}
                    </td>
                    <td className="px-4 py-3">
                      {rep.client_count !== undefined ? (
                        <span className="flex items-center gap-1 text-gray-300 text-sm">
                          <Users className="w-3 h-3 text-gray-500" />
                          {rep.client_count}
                        </span>
                      ) : (
                        <span className="text-gray-500 text-sm">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {rep.total_commission !== undefined && rep.total_commission > 0 ? (
                        <span className="flex items-center gap-1 text-green-400 text-sm font-medium">
                          <DollarSign className="w-3 h-3" />
                          {rep.total_commission.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-gray-500 text-sm">$0</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {rep.portal_enabled && rep.slug && (
                          <a
                            href={`/#/rep/${rep.slug}/dashboard?demo=true`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 text-gray-400 hover:text-amber-400 hover:bg-gray-700 rounded transition-colors"
                            title="Preview Portal"
                          >
                            <Eye className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectRep(rep);
                          }}
                          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                          title="Edit Rep"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Card View */}
      {viewMode === 'cards' && filteredReps.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReps.map((rep) => (
            <div
              key={rep.id}
              className="admin-card p-4 hover:border-amber-500/50 transition-all cursor-pointer group"
              onClick={() => onSelectRep(rep)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center border border-gray-700">
                    {rep.avatar_url ? (
                      <img src={rep.avatar_url} alt="" className="w-full h-full rounded-lg object-cover" />
                    ) : (
                      <Briefcase className="w-6 h-6 text-gray-500" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-white font-semibold group-hover:text-amber-400 transition-colors">
                      {rep.name}
                    </h3>
                    {rep.territory && (
                      <p className="text-gray-400 text-sm flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {rep.territory}
                      </p>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-amber-400 transition-colors" />
              </div>

              <div className="space-y-2 text-sm">
                {rep.slug && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <ExternalLink className="w-3 h-3" />
                    <span className="font-mono text-xs">/rep/{rep.slug}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-gray-400">
                  <Mail className="w-3 h-3" />
                  <span className="truncate">{rep.email}</span>
                </div>
                {rep.phone && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <Phone className="w-3 h-3" />
                    <span>{rep.phone}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-700">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${rep.portal_enabled ? 'bg-green-500' : 'bg-gray-500'}`} />
                  <span className="text-xs text-gray-400">
                    {rep.portal_enabled ? 'Portal Active' : 'Portal Inactive'}
                  </span>
                </div>
                {getStatusBadge(rep.status)}
              </div>

              {(rep.client_count !== undefined || rep.total_commission !== undefined) && (
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  {rep.client_count !== undefined && (
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {rep.client_count} client{rep.client_count !== 1 ? 's' : ''}
                    </span>
                  )}
                  {rep.total_commission !== undefined && rep.total_commission > 0 && (
                    <span className="flex items-center gap-1 text-green-400">
                      <DollarSign className="w-3 h-3" />
                      ${rep.total_commission.toLocaleString()}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {filteredReps.length === 0 && (
        <div className="admin-card p-12 text-center">
          <Briefcase className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-white font-semibold mb-2">No Reps Found</h3>
          <p className="text-gray-400 text-sm mb-4">
            {searchQuery || filterStatus !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Get started by adding your first sales rep'}
          </p>
          {!searchQuery && filterStatus === 'all' && (
            <button
              onClick={onCreateRep}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add First Rep
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default RepList;
