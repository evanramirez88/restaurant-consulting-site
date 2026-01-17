import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Loader2,
  Users,
  DollarSign,
  Gift,
  TrendingUp,
  ChevronRight,
  Building2,
  Clock,
  CheckCircle,
  AlertTriangle,
  MessageSquare,
  Briefcase,
  Target,
  FileText,
  Ticket,
  Activity,
  ArrowRight,
  Eye,
  Send,
  UserPlus,
  Zap,
  Trophy,
  Lightbulb
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
  portal_enabled: boolean;
}

interface ClientSummary {
  id: string;
  name: string;
  company: string;
  status: string;
  lastActivity: string;
  support_plan_tier?: string;
}

interface PortfolioStats {
  totalClients: number;
  activeClients: number;
  activeSupportClients: number;
  activeProjects: number;
  openTickets: number;
  pendingQuotes: number;
  draftQuotes: number;
  leadsInPipeline: number;
  leadsWonThisMonth: number;
  referralCredits: {
    pending: number;
    approved: number;
    paid: number;
    total: number;
  };
}

interface ActivityItem {
  id: string;
  activity_type: string;
  title: string;
  description?: string;
  client_name?: string;
  lead_name?: string;
  timestamp: number;
  icon?: string;
  color?: string;
}

const RepDashboard: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  useSEO({
    title: 'Dashboard | Rep Portal | Cape Cod Restaurant Consulting',
    description: 'View your portfolio overview and activity feed.',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [rep, setRep] = useState<RepInfo | null>(null);
  const [stats, setStats] = useState<PortfolioStats | null>(null);
  const [recentClients, setRecentClients] = useState<ClientSummary[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
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

        // Load all dashboard data in parallel
        const [clientsRes, statsRes, activityRes] = await Promise.all([
          fetch(`/api/rep/${slug}/clients`),
          fetch(`/api/rep/${slug}/portfolio/stats`),
          fetch(`/api/rep/${slug}/portfolio/activity?limit=10`)
        ]);

        const clientsData = await clientsRes.json();
        const statsData = await statsRes.json();
        const activityData = await activityRes.json();

        // Process clients
        if (clientsData.success) {
          setRecentClients(clientsData.data.slice(0, 5).map((c: any) => ({
            id: c.id,
            name: c.name,
            company: c.company,
            status: c.support_plan_status || 'prospect',
            support_plan_tier: c.support_plan_tier,
            lastActivity: formatTimeAgo(c.updated_at)
          })));
        }

        // Process portfolio stats
        if (statsData.success) {
          setStats(statsData.data);
        }

        // Process activity
        if (activityData.success) {
          setActivity(activityData.data || []);
        }

      } catch (err) {
        console.error('Dashboard load error:', err);
        setError('Failed to load dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, [slug, navigate]);

  const formatTimeAgo = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const seconds = Math.floor(Date.now() / 1000 - timestamp);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getActivityIcon = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      'quote_created': <FileText className="w-4 h-4" />,
      'quote_sent': <Send className="w-4 h-4" />,
      'quote_viewed': <Eye className="w-4 h-4" />,
      'quote_accepted': <CheckCircle className="w-4 h-4" />,
      'quote_declined': <AlertTriangle className="w-4 h-4" />,
      'ticket_opened': <Ticket className="w-4 h-4" />,
      'ticket_resolved': <CheckCircle className="w-4 h-4" />,
      'lead_created': <Target className="w-4 h-4" />,
      'lead_stage_changed': <ArrowRight className="w-4 h-4" />,
      'lead_won': <Trophy className="w-4 h-4" />,
      'client_assigned': <UserPlus className="w-4 h-4" />,
      'intel_converted': <Zap className="w-4 h-4" />,
      'intel_submitted': <Lightbulb className="w-4 h-4" />,
      'message_received': <MessageSquare className="w-4 h-4" />
    };
    return icons[type] || <Activity className="w-4 h-4" />;
  };

  const getActivityColor = (type: string) => {
    const colors: Record<string, string> = {
      'quote_sent': 'text-blue-400 bg-blue-400/10',
      'quote_accepted': 'text-green-400 bg-green-400/10',
      'quote_declined': 'text-red-400 bg-red-400/10',
      'ticket_opened': 'text-amber-400 bg-amber-400/10',
      'ticket_resolved': 'text-green-400 bg-green-400/10',
      'lead_created': 'text-blue-400 bg-blue-400/10',
      'lead_won': 'text-green-400 bg-green-400/10',
      'client_assigned': 'text-green-400 bg-green-400/10',
      'intel_converted': 'text-cyan-400 bg-cyan-400/10'
    };
    return colors[type] || 'text-gray-400 bg-gray-400/10';
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
          <h2 className="text-xl font-semibold text-white mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <RepLayout rep={rep}>
      <div className="space-y-6">
        {/* Welcome Section */}
        <section className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-display font-bold text-white mb-2">
                Welcome back, {rep?.name?.split(' ')[0] || 'Rep'}!
              </h2>
              <p className="text-gray-400">
                Here's your portfolio overview for {new Date().toLocaleString('default', { month: 'long' })}.
              </p>
            </div>
            <Link
              to={`/rep/${slug}/intel`}
              className="inline-flex items-center gap-2 px-5 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-all"
            >
              <Lightbulb className="w-5 h-5" />
              Submit Intel
            </Link>
          </div>
        </section>

        {/* Portfolio Stats */}
        <section className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          <Link to={`/rep/${slug}/clients`} className="admin-card p-4 hover:border-green-500/50 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Users className="w-4 h-4 text-blue-400" />
              </div>
              <span className="text-xs text-gray-400">Clients</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats?.totalClients || 0}</p>
            {stats?.activeSupportClients ? (
              <p className="text-xs text-gray-500">{stats.activeSupportClients} on support plan</p>
            ) : null}
          </Link>

          <Link to={`/rep/${slug}/leads`} className="admin-card p-4 hover:border-green-500/50 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Target className="w-4 h-4 text-purple-400" />
              </div>
              <span className="text-xs text-gray-400">Leads</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats?.leadsInPipeline || 0}</p>
            {stats?.leadsWonThisMonth ? (
              <p className="text-xs text-green-400">{stats.leadsWonThisMonth} won this month</p>
            ) : null}
          </Link>

          <Link to={`/rep/${slug}/quotes`} className="admin-card p-4 hover:border-green-500/50 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 bg-amber-500/20 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-amber-400" />
              </div>
              <span className="text-xs text-gray-400">Quotes</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats?.pendingQuotes || 0}</p>
            <p className="text-xs text-gray-500">pending response</p>
          </Link>

          <Link to={`/rep/${slug}/tickets`} className="admin-card p-4 hover:border-green-500/50 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 bg-red-500/20 rounded-lg flex items-center justify-center">
                <Ticket className="w-4 h-4 text-red-400" />
              </div>
              <span className="text-xs text-gray-400">Open Tickets</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats?.openTickets || 0}</p>
            <p className="text-xs text-gray-500">for your clients</p>
          </Link>

          <Link to={`/rep/${slug}/messages`} className="admin-card p-4 hover:border-green-500/50 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-cyan-400" />
              </div>
              <span className="text-xs text-gray-400">Messages</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats?.activeProjects || 0}</p>
            <p className="text-xs text-gray-500">active threads</p>
          </Link>

          <Link to={`/rep/${slug}/referrals`} className="admin-card p-4 hover:border-green-500/50 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 bg-green-500/20 rounded-lg flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-green-400" />
              </div>
              <span className="text-xs text-gray-400">Credits</span>
            </div>
            <p className="text-2xl font-bold text-green-400">
              {formatCurrency(stats?.referralCredits?.total || 0)}
            </p>
            <p className="text-xs text-gray-500">
              {formatCurrency(stats?.referralCredits?.pending || 0)} pending
            </p>
          </Link>
        </section>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent Clients */}
          <section className="lg:col-span-2 admin-card overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Your Clients</h3>
              <Link
                to={`/rep/${slug}/clients`}
                className="text-sm text-green-400 hover:text-green-300 transition-colors flex items-center gap-1"
              >
                View All <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="divide-y divide-gray-700">
              {recentClients.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <Building2 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No clients assigned yet</p>
                  <p className="text-gray-500 text-sm mt-1">Convert leads to build your client base</p>
                </div>
              ) : (
                recentClients.map((client) => (
                  <Link
                    key={client.id}
                    to={`/rep/${slug}/clients/${client.id}`}
                    className="block px-6 py-4 hover:bg-gray-800/30 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-gray-400" />
                        </div>
                        <div>
                          <h4 className="font-medium text-white">{client.company}</h4>
                          <p className="text-sm text-gray-400">{client.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          client.status === 'active'
                            ? 'bg-green-500/10 text-green-400'
                            : client.status === 'prospect'
                              ? 'bg-blue-500/10 text-blue-400'
                              : 'bg-gray-500/10 text-gray-400'
                        }`}>
                          {client.status === 'active' ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                          {client.status}
                        </span>
                        {client.support_plan_tier && (
                          <p className="text-xs text-gray-500 mt-1 capitalize">{client.support_plan_tier}</p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>

          {/* Recent Activity */}
          <section className="admin-card overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
            </div>
            <div className="divide-y divide-gray-700/50 max-h-[400px] overflow-y-auto">
              {activity.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <Activity className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No recent activity</p>
                  <p className="text-gray-500 text-sm mt-1">Activity will appear here as you work</p>
                </div>
              ) : (
                activity.map((item) => (
                  <div key={item.id} className="px-4 py-3 hover:bg-gray-800/30 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${getActivityColor(item.activity_type)}`}>
                        {getActivityIcon(item.activity_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{item.title}</p>
                        {(item.client_name || item.lead_name) && (
                          <p className="text-xs text-gray-500">{item.client_name || item.lead_name}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-0.5">{formatTimeAgo(item.timestamp)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Commission Summary */}
        <section className="admin-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Referral Credits</h3>
            <Link
              to={`/rep/${slug}/referrals`}
              className="text-sm text-green-400 hover:text-green-300 transition-colors flex items-center gap-1"
            >
              View Details <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-gray-400">Pending</span>
              </div>
              <p className="text-xl font-bold text-amber-400">
                {formatCurrency(stats?.referralCredits?.pending || 0)}
              </p>
            </div>
            <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-gray-400">Approved</span>
              </div>
              <p className="text-xl font-bold text-blue-400">
                {formatCurrency(stats?.referralCredits?.approved || 0)}
              </p>
            </div>
            <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-green-400" />
                <span className="text-sm text-gray-400">Paid</span>
              </div>
              <p className="text-xl font-bold text-green-400">
                {formatCurrency(stats?.referralCredits?.paid || 0)}
              </p>
            </div>
            <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-white" />
                <span className="text-sm text-gray-400">Total Earned</span>
              </div>
              <p className="text-xl font-bold text-white">
                {formatCurrency(stats?.referralCredits?.total || 0)}
              </p>
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="admin-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Link
              to={`/rep/${slug}/intel`}
              className="flex flex-col items-center gap-2 p-4 bg-gray-900/50 rounded-lg border border-gray-700 hover:border-green-500/50 hover:bg-gray-800/50 transition-all"
            >
              <Lightbulb className="w-6 h-6 text-green-400" />
              <span className="text-sm text-gray-300 text-center">Submit Intel</span>
            </Link>
            <Link
              to={`/rep/${slug}/leads`}
              className="flex flex-col items-center gap-2 p-4 bg-gray-900/50 rounded-lg border border-gray-700 hover:border-green-500/50 hover:bg-gray-800/50 transition-all"
            >
              <Target className="w-6 h-6 text-green-400" />
              <span className="text-sm text-gray-300 text-center">Lead Pipeline</span>
            </Link>
            <Link
              to={`/rep/${slug}/clients`}
              className="flex flex-col items-center gap-2 p-4 bg-gray-900/50 rounded-lg border border-gray-700 hover:border-green-500/50 hover:bg-gray-800/50 transition-all"
            >
              <Users className="w-6 h-6 text-green-400" />
              <span className="text-sm text-gray-300 text-center">View Clients</span>
            </Link>
            <Link
              to={`/rep/${slug}/messages`}
              className="flex flex-col items-center gap-2 p-4 bg-gray-900/50 rounded-lg border border-gray-700 hover:border-green-500/50 hover:bg-gray-800/50 transition-all"
            >
              <MessageSquare className="w-6 h-6 text-green-400" />
              <span className="text-sm text-gray-300 text-center">Send Message</span>
            </Link>
            <a
              href="mailto:support@ccrestaurantconsulting.com"
              className="flex flex-col items-center gap-2 p-4 bg-gray-900/50 rounded-lg border border-gray-700 hover:border-green-500/50 hover:bg-gray-800/50 transition-all"
            >
              <Briefcase className="w-6 h-6 text-green-400" />
              <span className="text-sm text-gray-300 text-center">Contact Support</span>
            </a>
          </div>
        </section>
      </div>
    </RepLayout>
  );
};

export default RepDashboard;
