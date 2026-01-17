import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Loader2,
  Search,
  Building2,
  Mail,
  Phone,
  MapPin,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ExternalLink,
  Filter
} from 'lucide-react';
import { useSEO } from '../../src/components/SEO';
import RepLayout from './RepLayout';

interface RepInfo {
  id: string;
  name: string;
  email: string;
  territory: string | null;
  avatar_url: string | null;
  slug: string;
}

interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string | null;
  slug: string | null;
  portal_enabled: boolean;
  support_plan_tier: string | null;
  support_plan_status: string | null;
  city: string | null;
  state: string | null;
  assignment_role: string;
  commission_rate: number;
  assigned_at: number;
  updated_at: number;
}

type FilterStatus = 'all' | 'active' | 'inactive' | 'paused';
type SortBy = 'name' | 'company' | 'assigned_at' | 'updated_at';

const RepClients: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  useSEO({
    title: 'My Clients | Rep Portal | Cape Cod Restaurant Consulting',
    description: 'View and manage your assigned clients.',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [rep, setRep] = useState<RepInfo | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [sortBy, setSortBy] = useState<SortBy>('company');
  const [sortAsc, setSortAsc] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Check for demo mode (supports hash routing: /#/path?demo=true)
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
        const isDemoMode = urlParams.get('demo') === 'true' || hashParams.get('demo') === 'true';

        // Check if user is authenticated as admin
        let isAdmin = false;
        try {
          const adminResponse = await fetch('/api/auth/verify', { credentials: 'include' });
          const adminData = await adminResponse.json();
          isAdmin = adminData.authenticated === true;
        } catch {
          // Not an admin
        }

        // Only verify rep auth if not in demo mode and not admin
        if (!isDemoMode && !isAdmin) {
          const authRes = await fetch(`/api/rep/${slug}/auth/verify`);
          const authData = await authRes.json();

          if (!authData.authenticated) {
            navigate(`/rep/${slug}/login`);
            return;
          }
        }

        // Load rep info
        const repRes = await fetch(`/api/rep/${slug}/info`);
        const repData = await repRes.json();

        if (!repData.success) {
          setError('Failed to load rep information');
          setIsLoading(false);
          return;
        }

        setRep(repData.data);

        // Load clients
        const clientsRes = await fetch(`/api/rep/${slug}/clients`);
        const clientsData = await clientsRes.json();

        if (clientsData.success) {
          setClients(clientsData.data || []);
          setFilteredClients(clientsData.data || []);
        }
      } catch (err) {
        console.error('Load error:', err);
        setError('Failed to load clients');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [slug, navigate]);

  // Filter and sort clients
  useEffect(() => {
    let result = [...clients];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.company.toLowerCase().includes(query) ||
          c.email.toLowerCase().includes(query) ||
          (c.city && c.city.toLowerCase().includes(query))
      );
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      result = result.filter((c) => c.support_plan_status === filterStatus);
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'company':
          comparison = a.company.localeCompare(b.company);
          break;
        case 'assigned_at':
          comparison = (a.assigned_at || 0) - (b.assigned_at || 0);
          break;
        case 'updated_at':
          comparison = (a.updated_at || 0) - (b.updated_at || 0);
          break;
      }
      return sortAsc ? comparison : -comparison;
    });

    setFilteredClients(result);
  }, [clients, searchQuery, filterStatus, sortBy, sortAsc]);

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
            <CheckCircle className="w-3 h-3" />
            Active
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400">
            <Clock className="w-3 h-3" />
            Paused
          </span>
        );
      case 'inactive':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400">
            <AlertTriangle className="w-3 h-3" />
            Inactive
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400">
            <Clock className="w-3 h-3" />
            Prospect
          </span>
        );
    }
  };

  const getTierBadge = (tier: string | null) => {
    const tierColors: Record<string, string> = {
      premium: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      professional: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      core: 'bg-green-500/10 text-green-400 border-green-500/30',
      none: 'bg-gray-500/10 text-gray-400 border-gray-500/30'
    };

    const color = tierColors[tier || 'none'] || tierColors.none;

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium border ${color}`}>
        {tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : 'No Plan'}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-dark to-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-400 animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-dark to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Error</h2>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <RepLayout rep={rep}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-display font-bold text-white">My Clients</h2>
            <p className="text-gray-400 mt-1">
              {filteredClients.length} of {clients.length} clients shown
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="admin-card p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder="Search by name, company, email, or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                className="pl-10 pr-10 py-2.5 bg-gray-900/50 border border-gray-700 rounded-lg text-white appearance-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="paused">Paused</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>

            {/* Sort By */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="pl-4 pr-10 py-2.5 bg-gray-900/50 border border-gray-700 rounded-lg text-white appearance-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent cursor-pointer"
              >
                <option value="company">Sort by Company</option>
                <option value="name">Sort by Name</option>
                <option value="assigned_at">Sort by Assigned Date</option>
                <option value="updated_at">Sort by Last Activity</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>

            {/* Sort Direction */}
            <button
              onClick={() => setSortAsc(!sortAsc)}
              className="px-4 py-2.5 bg-gray-900/50 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
              aria-label={sortAsc ? 'Sort descending' : 'Sort ascending'}
            >
              {sortAsc ? 'A-Z' : 'Z-A'}
            </button>
          </div>
        </div>

        {/* Clients List */}
        {filteredClients.length === 0 ? (
          <div className="admin-card p-12 text-center">
            <Building2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Clients Found</h3>
            <p className="text-gray-400">
              {searchQuery || filterStatus !== 'all'
                ? 'Try adjusting your search or filters'
                : 'You have no assigned clients yet. Submit referrals to build your client base!'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredClients.map((client) => (
              <div
                key={client.id}
                className="admin-card p-6 hover:border-gray-600 transition-all"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Client Info */}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-6 h-6 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-semibold text-white truncate">
                          {client.company}
                        </h3>
                        {getStatusBadge(client.support_plan_status)}
                        {getTierBadge(client.support_plan_tier)}
                      </div>
                      <p className="text-gray-400 mb-2">{client.name}</p>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                        <a
                          href={`mailto:${client.email}`}
                          className="flex items-center gap-1 hover:text-green-400 transition-colors"
                        >
                          <Mail className="w-4 h-4" />
                          {client.email}
                        </a>
                        {client.phone && (
                          <a
                            href={`tel:${client.phone}`}
                            className="flex items-center gap-1 hover:text-green-400 transition-colors"
                          >
                            <Phone className="w-4 h-4" />
                            {client.phone}
                          </a>
                        )}
                        {(client.city || client.state) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {[client.city, client.state].filter(Boolean).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Assignment Info & Actions */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 lg:gap-6">
                    <div className="text-sm">
                      <p className="text-gray-500">Role</p>
                      <p className="text-white capitalize">{client.assignment_role}</p>
                    </div>
                    <div className="text-sm">
                      <p className="text-gray-500">Commission</p>
                      <p className="text-green-400 font-medium">{(client.commission_rate * 100).toFixed(0)}%</p>
                    </div>
                    <div className="text-sm">
                      <p className="text-gray-500">Assigned</p>
                      <p className="text-white">{formatDate(client.assigned_at)}</p>
                    </div>
                    {client.portal_enabled && client.slug && (
                      <a
                        href={`/portal/${client.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View Portal
                      </a>
                    )}
                    <Link
                      to={`/rep/${slug}/clients/${client.id}`}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </RepLayout>
  );
};

export default RepClients;
