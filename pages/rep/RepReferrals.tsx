import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Loader2,
  Gift,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  Building2,
  Calendar,
  TrendingUp,
  Award,
  Wallet
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

interface ReferralCredit {
  id: string;
  rep_id: string;
  client_id: string | null;
  lead_id: string | null;
  quote_id: string | null;
  project_id: string | null;
  credit_type: 'referral_bonus' | 'project_commission' | 'support_plan_bonus' | 'upsell_commission' | 'lead_conversion' | 'recurring_bonus';
  amount: number;
  description: string | null;
  status: 'pending' | 'approved' | 'paid' | 'voided';
  approved_by: string | null;
  approved_at: number | null;
  approval_notes: string | null;
  paid_at: number | null;
  payment_method: string | null;
  payment_reference: string | null;
  created_at: number;
  updated_at: number;
  // Joined fields
  client_name: string | null;
  client_company: string | null;
}

interface CreditsSummary {
  pending: number;
  approved: number;
  paid: number;
  total: number;
  pendingCount: number;
  approvedCount: number;
  paidCount: number;
  thisYear: {
    paid: number;
    projected: number;
  };
}

type FilterStatus = 'all' | 'pending' | 'approved' | 'paid' | 'voided';
type FilterType = 'all' | 'referral_bonus' | 'project_commission' | 'support_plan_bonus' | 'upsell_commission' | 'lead_conversion' | 'recurring_bonus';

const CREDIT_TYPE_LABELS: Record<string, string> = {
  referral_bonus: 'Referral Bonus',
  project_commission: 'Project Commission',
  support_plan_bonus: 'Support Plan Bonus',
  upsell_commission: 'Upsell Commission',
  lead_conversion: 'Lead Conversion',
  recurring_bonus: 'Recurring Bonus'
};

const CREDIT_TYPE_ICONS: Record<string, React.FC<{ className?: string }>> = {
  referral_bonus: Gift,
  project_commission: Award,
  support_plan_bonus: CheckCircle,
  upsell_commission: TrendingUp,
  lead_conversion: Building2,
  recurring_bonus: Calendar
};

const RepReferrals: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  useSEO({
    title: 'Referral Credits | Rep Portal | Cape Cod Restaurant Consulting',
    description: 'Track your referral credits, commissions, and bonuses.',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [rep, setRep] = useState<RepInfo | null>(null);
  const [credits, setCredits] = useState<ReferralCredit[]>([]);
  const [filteredCredits, setFilteredCredits] = useState<ReferralCredit[]>([]);
  const [summary, setSummary] = useState<CreditsSummary | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Check for demo mode
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

        // Load referral credits
        const creditsRes = await fetch(`/api/rep/${slug}/referrals`);
        const creditsData = await creditsRes.json();

        if (creditsData.success) {
          setCredits(creditsData.data || []);
          setFilteredCredits(creditsData.data || []);
          setSummary(creditsData.summary || null);
        }
      } catch (err) {
        console.error('Load error:', err);
        setError('Failed to load referral credits');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [slug, navigate]);

  // Filter credits
  useEffect(() => {
    let result = [...credits];

    if (filterStatus !== 'all') {
      result = result.filter((c) => c.status === filterStatus);
    }

    if (filterType !== 'all') {
      result = result.filter((c) => c.credit_type === filterType);
    }

    // Sort by created_at descending (newest first)
    result.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

    setFilteredCredits(result);
  }, [credits, filterStatus, filterType]);

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusBadge = (status: ReferralCredit['status']) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400">
            <Clock className="w-3 h-3" />
            Pending Approval
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400">
            <CheckCircle className="w-3 h-3" />
            Approved
          </span>
        );
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
            <DollarSign className="w-3 h-3" />
            Paid
          </span>
        );
      case 'voided':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400">
            <XCircle className="w-3 h-3" />
            Voided
          </span>
        );
    }
  };

  const getCreditTypeBadge = (type: ReferralCredit['credit_type']) => {
    const Icon = CREDIT_TYPE_ICONS[type] || Gift;
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-gray-700 text-gray-300">
        <Icon className="w-3 h-3" />
        {CREDIT_TYPE_LABELS[type] || type}
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
        <div>
          <h2 className="text-2xl font-display font-bold text-white">Referral Credits</h2>
          <p className="text-gray-400 mt-1">
            Track your commissions, bonuses, and referral credits
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="admin-card p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <Wallet className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide">Total Earned</p>
                <p className="text-2xl font-bold text-green-400">{formatCurrency(summary?.paid || 0)}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">All time paid credits</p>
          </div>

          <div className="admin-card p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide">Pending Approval</p>
                <p className="text-2xl font-bold text-amber-400">{formatCurrency(summary?.pending || 0)}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">{summary?.pendingCount || 0} credits awaiting review</p>
          </div>

          <div className="admin-card p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide">Awaiting Payment</p>
                <p className="text-2xl font-bold text-blue-400">{formatCurrency(summary?.approved || 0)}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">{summary?.approvedCount || 0} credits approved</p>
          </div>

          <div className="admin-card p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide">Paid This Year</p>
                <p className="text-2xl font-bold text-purple-400">{formatCurrency(summary?.thisYear?.paid || 0)}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Projected: {formatCurrency(summary?.thisYear?.projected || 0)}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              className="pl-4 pr-10 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-white appearance-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
              <option value="voided">Voided</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as FilterType)}
              className="pl-4 pr-10 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-white appearance-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="referral_bonus">Referral Bonus</option>
              <option value="project_commission">Project Commission</option>
              <option value="support_plan_bonus">Support Plan Bonus</option>
              <option value="upsell_commission">Upsell Commission</option>
              <option value="lead_conversion">Lead Conversion</option>
              <option value="recurring_bonus">Recurring Bonus</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>

          <p className="text-gray-500 text-sm">
            Showing {filteredCredits.length} of {credits.length} credits
          </p>
        </div>

        {/* Credits List */}
        {filteredCredits.length === 0 ? (
          <div className="admin-card p-12 text-center">
            <Gift className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Credits Found</h3>
            <p className="text-gray-400">
              {filterStatus !== 'all' || filterType !== 'all'
                ? 'Try adjusting your filters'
                : 'Credits from referrals, commissions, and bonuses will appear here.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredCredits.map((credit) => {
              const Icon = CREDIT_TYPE_ICONS[credit.credit_type] || Gift;
              return (
                <div
                  key={credit.id}
                  className="admin-card p-6 hover:border-gray-600 transition-all"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Credit Info */}
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        credit.status === 'paid' ? 'bg-green-500/20' :
                        credit.status === 'approved' ? 'bg-blue-500/20' :
                        credit.status === 'pending' ? 'bg-amber-500/20' :
                        'bg-gray-700'
                      }`}>
                        <Icon className={`w-6 h-6 ${
                          credit.status === 'paid' ? 'text-green-400' :
                          credit.status === 'approved' ? 'text-blue-400' :
                          credit.status === 'pending' ? 'text-amber-400' :
                          'text-gray-500'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-3 mb-1">
                          {getCreditTypeBadge(credit.credit_type)}
                          {getStatusBadge(credit.status)}
                        </div>
                        {credit.description && (
                          <p className="text-white font-medium mt-2">{credit.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400 mt-2">
                          {credit.client_company && (
                            <span className="flex items-center gap-1">
                              <Building2 className="w-4 h-4" />
                              {credit.client_company}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            Created {formatDate(credit.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Amount & Dates */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 lg:gap-6">
                      {credit.approved_at && (
                        <div className="text-sm">
                          <p className="text-gray-500">Approved</p>
                          <p className="text-white">{formatDate(credit.approved_at)}</p>
                        </div>
                      )}
                      {credit.paid_at && (
                        <div className="text-sm">
                          <p className="text-gray-500">Paid</p>
                          <p className="text-white">{formatDate(credit.paid_at)}</p>
                          {credit.payment_reference && (
                            <p className="text-xs text-gray-500">Ref: {credit.payment_reference}</p>
                          )}
                        </div>
                      )}
                      <div className="text-right">
                        <p className="text-gray-500 text-xs uppercase">Amount</p>
                        <p className={`text-2xl font-bold ${
                          credit.status === 'paid' ? 'text-green-400' :
                          credit.status === 'voided' ? 'text-gray-500 line-through' :
                          'text-white'
                        }`}>
                          {formatCurrency(credit.amount)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Info Note */}
        <div className="admin-card p-4 border-l-4 border-l-blue-500">
          <p className="text-gray-400 text-sm">
            <strong className="text-white">Note:</strong> Credits are created and approved by the admin team.
            Pending credits will be reviewed and approved based on verified referrals and completed projects.
            Payments are typically processed monthly.
          </p>
        </div>
      </div>
    </RepLayout>
  );
};

export default RepReferrals;
