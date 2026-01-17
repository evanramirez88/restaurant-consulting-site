import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Loader2,
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileText,
  Ticket,
  MessageSquare,
  DollarSign,
  Calendar,
  ExternalLink,
  Plus,
  ChevronRight,
  Eye,
  Send,
  Edit3,
  Utensils
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

interface ClientDetail {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string | null;
  slug: string | null;
  portal_enabled: boolean;
  support_plan_tier: string | null;
  support_plan_status: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  assignment_role: string;
  commission_rate: number;
  assigned_at: number;
  updated_at: number;
  // Permissions from assignment
  can_quote: boolean;
  can_menu_build: boolean;
  can_create_tickets: boolean;
  can_view_billing: boolean;
}

interface ClientQuote {
  id: string;
  quote_number: string | null;
  quote_name: string | null;
  status: string;
  total_install_cost: number | null;
  total_monthly_cost: number | null;
  location_count: number;
  created_at: number;
  sent_at: number | null;
  expires_at: number | null;
}

interface ClientTicket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: number;
}

type Tab = 'overview' | 'quotes' | 'tickets';

const RepClientDetail: React.FC = () => {
  const { slug, clientId } = useParams<{ slug: string; clientId: string }>();
  const navigate = useNavigate();

  useSEO({
    title: 'Client Details | Rep Portal | Cape Cod Restaurant Consulting',
    description: 'View client details and manage quotes, tickets, and more.',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [rep, setRep] = useState<RepInfo | null>(null);
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [quotes, setQuotes] = useState<ClientQuote[]>([]);
  const [tickets, setTickets] = useState<ClientTicket[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
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

        // Load client details
        const clientRes = await fetch(`/api/rep/${slug}/clients/${clientId}`);
        const clientData = await clientRes.json();

        if (!clientData.success) {
          setError(clientData.error || 'Failed to load client');
          setIsLoading(false);
          return;
        }

        setClient(clientData.data);

        // Load client quotes
        const quotesRes = await fetch(`/api/rep/${slug}/quotes?client_id=${clientId}`);
        const quotesData = await quotesRes.json();
        if (quotesData.success) {
          setQuotes(quotesData.data || []);
        }

        // Load client tickets
        const ticketsRes = await fetch(`/api/rep/${slug}/tickets?client_id=${clientId}`);
        const ticketsData = await ticketsRes.json();
        if (ticketsData.success) {
          setTickets(ticketsData.data || []);
        }
      } catch (err) {
        console.error('Load error:', err);
        setError('Failed to load client details');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [slug, clientId, navigate]);

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

  const getQuoteStatusBadge = (status: string) => {
    const statusColors: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
      draft: { bg: 'bg-gray-500/10', text: 'text-gray-400', icon: <Edit3 className="w-3 h-3" /> },
      sent: { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: <Send className="w-3 h-3" /> },
      viewed: { bg: 'bg-amber-500/10', text: 'text-amber-400', icon: <Eye className="w-3 h-3" /> },
      accepted: { bg: 'bg-green-500/10', text: 'text-green-400', icon: <CheckCircle className="w-3 h-3" /> },
      declined: { bg: 'bg-red-500/10', text: 'text-red-400', icon: <AlertTriangle className="w-3 h-3" /> },
      expired: { bg: 'bg-gray-500/10', text: 'text-gray-500', icon: <Clock className="w-3 h-3" /> },
    };

    const config = statusColors[status] || statusColors.draft;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getTicketPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-500/10 text-red-400',
      high: 'bg-orange-500/10 text-orange-400',
      medium: 'bg-amber-500/10 text-amber-400',
      low: 'bg-green-500/10 text-green-400',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[priority] || colors.medium}`}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
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

  if (error || !client) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-dark to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Error</h2>
          <p className="text-gray-400 mb-4">{error || 'Client not found'}</p>
          <Link
            to={`/rep/${slug}/clients`}
            className="text-green-400 hover:text-green-300 flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Clients
          </Link>
        </div>
      </div>
    );
  }

  return (
    <RepLayout rep={rep}>
      <div className="space-y-6">
        {/* Back Link */}
        <Link
          to={`/rep/${slug}/clients`}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-green-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Clients
        </Link>

        {/* Client Header */}
        <div className="admin-card p-6">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0">
                <Building2 className="w-8 h-8 text-gray-400" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-display font-bold text-white">{client.company}</h1>
                  {getStatusBadge(client.support_plan_status)}
                  {getTierBadge(client.support_plan_tier)}
                </div>
                <p className="text-gray-400 mb-3">{client.name}</p>
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
                      {[client.address_line1, client.city, client.state, client.zip].filter(Boolean).join(', ')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              {client.can_quote && (
                <button
                  onClick={() => navigate(`/rep/${slug}/clients/${clientId}/quote`)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Create Quote
                </button>
              )}
              {client.can_menu_build ? (
                <button
                  onClick={() => navigate(`/rep/${slug}/clients/${clientId}/menu`)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors font-medium"
                >
                  <Utensils className="w-4 h-4" />
                  Menu Builder
                </button>
              ) : (
                <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-700 text-gray-400 rounded-lg cursor-not-allowed" title="Contact admin to enable Menu Builder access">
                  <Utensils className="w-4 h-4" />
                  Menu Builder
                </div>
              )}
              {client.portal_enabled && client.slug && (
                <a
                  href={`/portal/${client.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Portal
                </a>
              )}
            </div>
          </div>

          {/* Assignment Info */}
          <div className="mt-6 pt-6 border-t border-gray-700 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Your Role</p>
              <p className="text-white capitalize">{client.assignment_role}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Commission Rate</p>
              <p className="text-green-400 font-semibold">{(client.commission_rate * 100).toFixed(0)}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Assigned Since</p>
              <p className="text-white">{formatDate(client.assigned_at)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Last Activity</p>
              <p className="text-white">{formatDate(client.updated_at)}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-700">
          {[
            { id: 'overview' as Tab, label: 'Overview', icon: Building2 },
            { id: 'quotes' as Tab, label: 'Quotes', icon: FileText, count: quotes.length },
            { id: 'tickets' as Tab, label: 'Tickets', icon: Ticket, count: tickets.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-green-500 text-green-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="px-2 py-0.5 text-xs bg-gray-700 rounded-full">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Quick Stats */}
            <div className="admin-card p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Quick Stats</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Total Quotes
                  </span>
                  <span className="text-white font-semibold">{quotes.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Accepted Quotes
                  </span>
                  <span className="text-green-400 font-semibold">
                    {quotes.filter(q => q.status === 'accepted').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 flex items-center gap-2">
                    <Ticket className="w-4 h-4" />
                    Open Tickets
                  </span>
                  <span className="text-white font-semibold">
                    {tickets.filter(t => !['resolved', 'closed'].includes(t.status)).length}
                  </span>
                </div>
              </div>
            </div>

            {/* Your Permissions */}
            <div className="admin-card p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Your Permissions</h3>
              <div className="space-y-3">
                {[
                  { label: 'Create Quotes', enabled: client.can_quote },
                  { label: 'Menu Builder', enabled: client.can_menu_build },
                  { label: 'Create Tickets', enabled: client.can_create_tickets },
                  { label: 'View Billing', enabled: client.can_view_billing },
                ].map(perm => (
                  <div key={perm.label} className="flex items-center justify-between">
                    <span className="text-gray-400">{perm.label}</span>
                    {perm.enabled ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <span className="text-gray-600">-</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Quotes */}
            {quotes.length > 0 && (
              <div className="admin-card p-6 md:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Recent Quotes</h3>
                  <button
                    onClick={() => setActiveTab('quotes')}
                    className="text-sm text-green-400 hover:text-green-300 flex items-center gap-1"
                  >
                    View All
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3">
                  {quotes.slice(0, 3).map(quote => (
                    <div
                      key={quote.id}
                      className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
                    >
                      <div>
                        <p className="text-white font-medium">
                          {quote.quote_name || quote.quote_number || 'Untitled Quote'}
                        </p>
                        <p className="text-sm text-gray-400">{formatDate(quote.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {quote.total_install_cost && (
                          <span className="text-green-400 font-semibold">
                            {formatCurrency(quote.total_install_cost)}
                          </span>
                        )}
                        {getQuoteStatusBadge(quote.status)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'quotes' && (
          <div className="space-y-4">
            {/* Create Quote Button */}
            {client.can_quote && (
              <div className="flex justify-end">
                <button
                  onClick={() => navigate(`/rep/${slug}/clients/${clientId}/quote`)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Create New Quote
                </button>
              </div>
            )}

            {quotes.length === 0 ? (
              <div className="admin-card p-12 text-center">
                <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No Quotes Yet</h3>
                <p className="text-gray-400 mb-6">
                  Create your first quote for this client to get started.
                </p>
                {client.can_quote && (
                  <button
                    onClick={() => navigate(`/rep/${slug}/clients/${clientId}/quote`)}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors font-medium"
                  >
                    <Plus className="w-5 h-5" />
                    Create Quote
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {quotes.map(quote => (
                  <div key={quote.id} className="admin-card p-4 hover:border-gray-600 transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h4 className="text-lg font-semibold text-white">
                            {quote.quote_name || quote.quote_number || 'Untitled Quote'}
                          </h4>
                          {getQuoteStatusBadge(quote.status)}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
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
                      <div className="flex items-center gap-4">
                        {quote.total_install_cost !== null && (
                          <div className="text-right">
                            <p className="text-xs text-gray-500 uppercase">Install</p>
                            <p className="text-green-400 font-semibold">{formatCurrency(quote.total_install_cost)}</p>
                          </div>
                        )}
                        {quote.total_monthly_cost !== null && (
                          <div className="text-right">
                            <p className="text-xs text-gray-500 uppercase">Monthly</p>
                            <p className="text-blue-400 font-semibold">{formatCurrency(quote.total_monthly_cost)}/mo</p>
                          </div>
                        )}
                        <Link
                          to={`/rep/${slug}/quotes/${quote.id}`}
                          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'tickets' && (
          <div className="space-y-4">
            {/* Create Ticket Button */}
            {client.can_create_tickets && (
              <div className="flex justify-end">
                <button
                  onClick={() => navigate(`/rep/${slug}/tickets/new?client=${clientId}`)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Create Ticket
                </button>
              </div>
            )}

            {tickets.length === 0 ? (
              <div className="admin-card p-12 text-center">
                <Ticket className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No Tickets</h3>
                <p className="text-gray-400">
                  No support tickets have been created for this client.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map(ticket => (
                  <Link
                    key={ticket.id}
                    to={`/rep/${slug}/tickets/${ticket.id}`}
                    className="admin-card p-4 hover:border-gray-600 transition-all block"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-white font-medium">{ticket.subject}</h4>
                        <p className="text-sm text-gray-400">{formatDate(ticket.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {getTicketPriorityBadge(ticket.priority)}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          ['resolved', 'closed'].includes(ticket.status)
                            ? 'bg-gray-500/10 text-gray-400'
                            : 'bg-blue-500/10 text-blue-400'
                        }`}>
                          {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </RepLayout>
  );
};

export default RepClientDetail;
