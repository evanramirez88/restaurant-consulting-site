import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Loader2,
  Search,
  FileText,
  Building2,
  Calendar,
  DollarSign,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  Filter,
  Send,
  Eye,
  Edit3,
  MapPin,
  Plus
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

interface Quote {
  id: string;
  client_id: string | null;
  quote_number: string | null;
  quote_name: string | null;
  status: string;
  total_install_cost: number | null;
  total_monthly_cost: number | null;
  location_count: number;
  created_at: number;
  updated_at: number;
  sent_at: number | null;
  viewed_at: number | null;
  expires_at: number | null;
  accepted_at: number | null;
  declined_at: number | null;
  client_name: string | null;
  client_company: string | null;
}

type StatusFilter = 'all' | 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired';

const RepQuotes: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  useSEO({
    title: 'My Quotes | Rep Portal | Cape Cod Restaurant Consulting',
    description: 'View and manage your quotes.',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [rep, setRep] = useState<RepInfo | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [filteredQuotes, setFilteredQuotes] = useState<Quote[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Check for demo mode
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
        const isDemoMode = urlParams.get('demo') === 'true' || hashParams.get('demo') === 'true' || slug?.startsWith('demo-');

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

        // Load quotes
        const quotesRes = await fetch(`/api/rep/${slug}/quotes`);
        const quotesData = await quotesRes.json();

        if (quotesData.success) {
          setQuotes(quotesData.data || []);
          setFilteredQuotes(quotesData.data || []);
        }
      } catch (err) {
        console.error('Load error:', err);
        setError('Failed to load quotes');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [slug, navigate]);

  // Filter and search quotes
  useEffect(() => {
    let result = [...quotes];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (q) =>
          (q.quote_name && q.quote_name.toLowerCase().includes(query)) ||
          (q.quote_number && q.quote_number.toLowerCase().includes(query)) ||
          (q.client_company && q.client_company.toLowerCase().includes(query)) ||
          (q.client_name && q.client_name.toLowerCase().includes(query))
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter((q) => q.status === statusFilter);
    }

    // Sort by created_at descending
    result.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

    setFilteredQuotes(result);
  }, [quotes, searchQuery, statusFilter]);

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
      draft: {
        bg: 'bg-gray-500/10 border-gray-500/30',
        text: 'text-gray-400',
        icon: <Edit3 className="w-3 h-3" />,
        label: 'Draft'
      },
      sent: {
        bg: 'bg-blue-500/10 border-blue-500/30',
        text: 'text-blue-400',
        icon: <Send className="w-3 h-3" />,
        label: 'Sent'
      },
      viewed: {
        bg: 'bg-amber-500/10 border-amber-500/30',
        text: 'text-amber-400',
        icon: <Eye className="w-3 h-3" />,
        label: 'Viewed'
      },
      accepted: {
        bg: 'bg-green-500/10 border-green-500/30',
        text: 'text-green-400',
        icon: <CheckCircle className="w-3 h-3" />,
        label: 'Accepted'
      },
      declined: {
        bg: 'bg-red-500/10 border-red-500/30',
        text: 'text-red-400',
        icon: <AlertTriangle className="w-3 h-3" />,
        label: 'Declined'
      },
      expired: {
        bg: 'bg-gray-500/10 border-gray-500/30',
        text: 'text-gray-500',
        icon: <Clock className="w-3 h-3" />,
        label: 'Expired'
      },
      superseded: {
        bg: 'bg-purple-500/10 border-purple-500/30',
        text: 'text-purple-400',
        icon: <FileText className="w-3 h-3" />,
        label: 'Superseded'
      },
    };

    const config = statusConfig[status] || statusConfig.draft;

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.bg} ${config.text}`}>
        {config.icon}
        {config.label}
      </span>
    );
  };

  const getStatusStats = () => {
    const stats = {
      draft: quotes.filter(q => q.status === 'draft').length,
      sent: quotes.filter(q => q.status === 'sent').length,
      viewed: quotes.filter(q => q.status === 'viewed').length,
      accepted: quotes.filter(q => q.status === 'accepted').length,
      declined: quotes.filter(q => q.status === 'declined').length,
    };
    return stats;
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

  const stats = getStatusStats();

  return (
    <RepLayout rep={rep}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-display font-bold text-white">My Quotes</h2>
            <p className="text-gray-400 mt-1">
              {filteredQuotes.length} of {quotes.length} quotes shown
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: 'Draft', count: stats.draft, color: 'text-gray-400' },
            { label: 'Sent', count: stats.sent, color: 'text-blue-400' },
            { label: 'Viewed', count: stats.viewed, color: 'text-amber-400' },
            { label: 'Accepted', count: stats.accepted, color: 'text-green-400' },
            { label: 'Declined', count: stats.declined, color: 'text-red-400' },
          ].map((stat) => (
            <div key={stat.label} className="admin-card p-4 text-center">
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.count}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="admin-card p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder="Search by name, number, or client..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="pl-10 pr-10 py-2.5 bg-gray-900/50 border border-gray-700 rounded-lg text-white appearance-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="viewed">Viewed</option>
                <option value="accepted">Accepted</option>
                <option value="declined">Declined</option>
                <option value="expired">Expired</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Quotes List */}
        {filteredQuotes.length === 0 ? (
          <div className="admin-card p-12 text-center">
            <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Quotes Found</h3>
            <p className="text-gray-400 mb-6">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Create your first quote by selecting a client and clicking "Create Quote".'}
            </p>
            <Link
              to={`/rep/${slug}/clients`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              Select Client to Quote
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredQuotes.map((quote) => (
              <Link
                key={quote.id}
                to={quote.client_id ? `/rep/${slug}/clients/${quote.client_id}` : '#'}
                className="admin-card p-5 hover:border-gray-600 transition-all block"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Quote Info */}
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="w-6 h-6 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <h3 className="text-lg font-semibold text-white">
                          {quote.quote_name || quote.quote_number || 'Untitled Quote'}
                        </h3>
                        {getStatusBadge(quote.status)}
                      </div>
                      {quote.client_company && (
                        <p className="text-gray-400 flex items-center gap-2 mb-2">
                          <Building2 className="w-4 h-4" />
                          {quote.client_company}
                          {quote.client_name && <span className="text-gray-500">({quote.client_name})</span>}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Created {formatDate(quote.created_at)}
                        </span>
                        {quote.sent_at && (
                          <span className="flex items-center gap-1">
                            <Send className="w-4 h-4" />
                            Sent {formatDate(quote.sent_at)}
                          </span>
                        )}
                        {quote.location_count > 1 && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {quote.location_count} locations
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quote Values */}
                  <div className="flex items-center gap-6">
                    {quote.total_install_cost !== null && (
                      <div className="text-right">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Install</p>
                        <p className="text-lg font-semibold text-green-400">
                          {formatCurrency(quote.total_install_cost)}
                        </p>
                      </div>
                    )}
                    {quote.total_monthly_cost !== null && (
                      <div className="text-right">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Monthly</p>
                        <p className="text-lg font-semibold text-blue-400">
                          {formatCurrency(quote.total_monthly_cost)}/mo
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </RepLayout>
  );
};

export default RepQuotes;
