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
  Briefcase
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
}

interface CommissionSummary {
  thisMonth: number;
  lastMonth: number;
  pending: number;
  total: number;
}

interface DashboardStats {
  activeClients: number;
  pendingReferrals: number;
  unreadMessages: number;
  commissionsThisMonth: number;
}

const RepDashboard: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  useSEO({
    title: 'Dashboard | Rep Portal | Cape Cod Restaurant Consulting',
    description: 'View your client overview and commission summary.',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [rep, setRep] = useState<RepInfo | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    activeClients: 0,
    pendingReferrals: 0,
    unreadMessages: 0,
    commissionsThisMonth: 0
  });
  const [recentClients, setRecentClients] = useState<ClientSummary[]>([]);
  const [commissions, setCommissions] = useState<CommissionSummary>({
    thisMonth: 0,
    lastMonth: 0,
    pending: 0,
    total: 0
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        // Verify authentication
        const authRes = await fetch(`/api/rep/${slug}/auth/verify`);
        const authData = await authRes.json();

        if (!authData.authenticated) {
          navigate(`/rep/${slug}/login`);
          return;
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

        // Load dashboard data
        const [clientsRes, referralsRes, messagesRes] = await Promise.all([
          fetch(`/api/rep/${slug}/clients`),
          fetch(`/api/rep/${slug}/referrals`),
          fetch(`/api/rep/${slug}/messages`)
        ]);

        const clientsData = await clientsRes.json();
        const referralsData = await referralsRes.json();
        const messagesData = await messagesRes.json();

        // Process stats
        const clients = clientsData.success ? clientsData.data : [];
        const referrals = referralsData.success ? referralsData.data : [];
        const messages = messagesData.success ? messagesData.data : [];

        setStats({
          activeClients: clients.length,
          pendingReferrals: referrals.filter((r: any) => r.status === 'pending').length,
          unreadMessages: messages.filter((m: any) => !m.read_at).length,
          commissionsThisMonth: referrals
            .filter((r: any) => r.status === 'paid' && isThisMonth(r.paid_at))
            .reduce((sum: number, r: any) => sum + (r.commission_amount || 0), 0)
        });

        // Recent clients
        setRecentClients(clients.slice(0, 5).map((c: any) => ({
          id: c.id,
          name: c.name,
          company: c.company,
          status: c.support_plan_status || 'active',
          lastActivity: formatTimeAgo(c.updated_at)
        })));

        // Commission summary
        const paidReferrals = referrals.filter((r: any) => r.status === 'paid');
        const pendingReferrals = referrals.filter((r: any) => r.status === 'pending' || r.status === 'approved');

        setCommissions({
          thisMonth: paidReferrals
            .filter((r: any) => isThisMonth(r.paid_at))
            .reduce((sum: number, r: any) => sum + (r.commission_amount || 0), 0),
          lastMonth: paidReferrals
            .filter((r: any) => isLastMonth(r.paid_at))
            .reduce((sum: number, r: any) => sum + (r.commission_amount || 0), 0),
          pending: pendingReferrals.reduce((sum: number, r: any) => sum + (r.commission_amount || 0), 0),
          total: paidReferrals.reduce((sum: number, r: any) => sum + (r.commission_amount || 0), 0)
        });

      } catch (err) {
        console.error('Dashboard load error:', err);
        setError('Failed to load dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, [slug, navigate]);

  const isThisMonth = (timestamp: number | null) => {
    if (!timestamp) return false;
    const date = new Date(timestamp * 1000);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  };

  const isLastMonth = (timestamp: number | null) => {
    if (!timestamp) return false;
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return date.getMonth() === lastMonth.getMonth() && date.getFullYear() === lastMonth.getFullYear();
  };

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
      currency: 'USD'
    }).format(amount);
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
                Here's your performance overview for {new Date().toLocaleString('default', { month: 'long' })}.
              </p>
            </div>
            <Link
              to={`/rep/${slug}/referrals`}
              className="inline-flex items-center gap-2 px-5 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-all"
            >
              <Gift className="w-5 h-5" />
              Submit Referral
            </Link>
          </div>
        </section>

        {/* Quick Stats */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="admin-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-sm text-gray-400">Active Clients</span>
            </div>
            <p className="text-3xl font-bold text-white">{stats.activeClients}</p>
          </div>
          <div className="admin-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                <Gift className="w-5 h-5 text-amber-400" />
              </div>
              <span className="text-sm text-gray-400">Pending Referrals</span>
            </div>
            <p className="text-3xl font-bold text-white">{stats.pendingReferrals}</p>
          </div>
          <div className="admin-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-sm text-gray-400">Unread Messages</span>
            </div>
            <p className="text-3xl font-bold text-white">{stats.unreadMessages}</p>
          </div>
          <div className="admin-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-sm text-gray-400">This Month</span>
            </div>
            <p className="text-3xl font-bold text-white">{formatCurrency(stats.commissionsThisMonth)}</p>
          </div>
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
                  <p className="text-gray-500 text-sm mt-1">Submit referrals to build your client base</p>
                </div>
              ) : (
                recentClients.map((client) => (
                  <div key={client.id} className="px-6 py-4 hover:bg-gray-800/30 transition-colors">
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
                            : 'bg-gray-500/10 text-gray-400'
                        }`}>
                          {client.status === 'active' ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                          {client.status}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">{client.lastActivity}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Commission Summary */}
          <section className="admin-card overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">Commission Summary</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  <span className="text-gray-300">This Month</span>
                </div>
                <span className="text-xl font-bold text-green-400">{formatCurrency(commissions.thisMonth)}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-300">Last Month</span>
                </div>
                <span className="text-xl font-bold text-white">{formatCurrency(commissions.lastMonth)}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <div className="flex items-center gap-3">
                  <Gift className="w-5 h-5 text-amber-400" />
                  <span className="text-gray-300">Pending</span>
                </div>
                <span className="text-xl font-bold text-amber-400">{formatCurrency(commissions.pending)}</span>
              </div>
              <div className="pt-4 border-t border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Total Earned</span>
                  <span className="text-2xl font-bold text-white">{formatCurrency(commissions.total)}</span>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6">
              <Link
                to={`/rep/${slug}/referrals`}
                className="block w-full py-3 text-center text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded-lg transition-colors font-medium"
              >
                View All Referrals
              </Link>
            </div>
          </section>
        </div>

        {/* Quick Actions */}
        <section className="admin-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              to={`/rep/${slug}/referrals`}
              className="flex flex-col items-center gap-2 p-4 bg-gray-900/50 rounded-lg border border-gray-700 hover:border-green-500/50 hover:bg-gray-800/50 transition-all min-h-[100px]"
            >
              <Gift className="w-6 h-6 text-green-400" />
              <span className="text-sm text-gray-300 text-center">New Referral</span>
            </Link>
            <Link
              to={`/rep/${slug}/clients`}
              className="flex flex-col items-center gap-2 p-4 bg-gray-900/50 rounded-lg border border-gray-700 hover:border-green-500/50 hover:bg-gray-800/50 transition-all min-h-[100px]"
            >
              <Users className="w-6 h-6 text-green-400" />
              <span className="text-sm text-gray-300 text-center">View Clients</span>
            </Link>
            <Link
              to={`/rep/${slug}/messages`}
              className="flex flex-col items-center gap-2 p-4 bg-gray-900/50 rounded-lg border border-gray-700 hover:border-green-500/50 hover:bg-gray-800/50 transition-all min-h-[100px]"
            >
              <MessageSquare className="w-6 h-6 text-green-400" />
              <span className="text-sm text-gray-300 text-center">Send Message</span>
            </Link>
            <a
              href="mailto:support@ccrestaurantconsulting.com"
              className="flex flex-col items-center gap-2 p-4 bg-gray-900/50 rounded-lg border border-gray-700 hover:border-green-500/50 hover:bg-gray-800/50 transition-all min-h-[100px]"
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
