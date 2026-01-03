import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Loader2,
  Gift,
  Plus,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  Building2,
  User,
  Mail,
  Phone,
  Calendar,
  X
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

interface Referral {
  id: string;
  referral_name: string;
  referral_company: string;
  referral_email: string;
  referral_phone: string | null;
  notes: string | null;
  status: 'pending' | 'approved' | 'converted' | 'paid' | 'rejected';
  commission_amount: number | null;
  created_at: number;
  approved_at: number | null;
  converted_at: number | null;
  paid_at: number | null;
}

type FilterStatus = 'all' | 'pending' | 'approved' | 'converted' | 'paid' | 'rejected';

const RepReferrals: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  useSEO({
    title: 'Referrals | Rep Portal | Cape Cod Restaurant Consulting',
    description: 'Track your referrals and commissions.',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [rep, setRep] = useState<RepInfo | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [filteredReferrals, setFilteredReferrals] = useState<Referral[]>([]);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [error, setError] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // New referral form state
  const [newReferral, setNewReferral] = useState({
    referral_name: '',
    referral_company: '',
    referral_email: '',
    referral_phone: '',
    notes: ''
  });

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

        // Load referrals
        const referralsRes = await fetch(`/api/rep/${slug}/referrals`);
        const referralsData = await referralsRes.json();

        if (referralsData.success) {
          setReferrals(referralsData.data || []);
          setFilteredReferrals(referralsData.data || []);
        }
      } catch (err) {
        console.error('Load error:', err);
        setError('Failed to load referrals');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [slug, navigate]);

  // Filter referrals
  useEffect(() => {
    let result = [...referrals];

    if (filterStatus !== 'all') {
      result = result.filter((r) => r.status === filterStatus);
    }

    // Sort by created_at descending (newest first)
    result.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

    setFilteredReferrals(result);
  }, [referrals, filterStatus]);

  const handleSubmitReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch(`/api/rep/${slug}/referrals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReferral)
      });

      const result = await response.json();

      if (result.success) {
        setReferrals((prev) => [result.data, ...prev]);
        setNewReferral({
          referral_name: '',
          referral_company: '',
          referral_email: '',
          referral_phone: '',
          notes: ''
        });
        setShowNewForm(false);
      } else {
        setSubmitError(result.error || 'Failed to submit referral');
      }
    } catch (err) {
      console.error('Submit error:', err);
      setSubmitError('Failed to submit referral');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusBadge = (status: Referral['status']) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400">
            <Clock className="w-3 h-3" />
            Pending Review
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400">
            <CheckCircle className="w-3 h-3" />
            Approved
          </span>
        );
      case 'converted':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400">
            <Gift className="w-3 h-3" />
            Converted
          </span>
        );
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
            <DollarSign className="w-3 h-3" />
            Paid
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        );
    }
  };

  // Calculate stats
  const stats = {
    total: referrals.length,
    pending: referrals.filter((r) => r.status === 'pending').length,
    converted: referrals.filter((r) => r.status === 'converted' || r.status === 'paid').length,
    totalEarned: referrals
      .filter((r) => r.status === 'paid')
      .reduce((sum, r) => sum + (r.commission_amount || 0), 0),
    pendingEarnings: referrals
      .filter((r) => r.status === 'approved' || r.status === 'converted')
      .reduce((sum, r) => sum + (r.commission_amount || 0), 0)
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
            <h2 className="text-2xl font-display font-bold text-white">Referrals</h2>
            <p className="text-gray-400 mt-1">
              Track and manage your referrals and commissions
            </p>
          </div>
          <button
            onClick={() => setShowNewForm(true)}
            className="inline-flex items-center gap-2 px-5 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-all"
          >
            <Plus className="w-5 h-5" />
            New Referral
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="admin-card p-4">
            <p className="text-gray-400 text-sm mb-1">Total Referrals</p>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="admin-card p-4">
            <p className="text-gray-400 text-sm mb-1">Pending</p>
            <p className="text-2xl font-bold text-amber-400">{stats.pending}</p>
          </div>
          <div className="admin-card p-4">
            <p className="text-gray-400 text-sm mb-1">Converted</p>
            <p className="text-2xl font-bold text-green-400">{stats.converted}</p>
          </div>
          <div className="admin-card p-4">
            <p className="text-gray-400 text-sm mb-1">Total Earned</p>
            <p className="text-2xl font-bold text-green-400">{formatCurrency(stats.totalEarned)}</p>
          </div>
          <div className="admin-card p-4">
            <p className="text-gray-400 text-sm mb-1">Pending Earnings</p>
            <p className="text-2xl font-bold text-amber-400">{formatCurrency(stats.pendingEarnings)}</p>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              className="pl-4 pr-10 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-white appearance-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="converted">Converted</option>
              <option value="paid">Paid</option>
              <option value="rejected">Rejected</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
          <p className="text-gray-500 text-sm">
            Showing {filteredReferrals.length} of {referrals.length} referrals
          </p>
        </div>

        {/* Referrals List */}
        {filteredReferrals.length === 0 ? (
          <div className="admin-card p-12 text-center">
            <Gift className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Referrals Found</h3>
            <p className="text-gray-400 mb-6">
              {filterStatus !== 'all'
                ? 'Try selecting a different status filter'
                : 'Start earning commissions by submitting your first referral!'}
            </p>
            {filterStatus === 'all' && (
              <button
                onClick={() => setShowNewForm(true)}
                className="inline-flex items-center gap-2 px-5 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-all"
              >
                <Plus className="w-5 h-5" />
                Submit Referral
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredReferrals.map((referral) => (
              <div
                key={referral.id}
                className="admin-card p-6 hover:border-gray-600 transition-all"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Referral Info */}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Gift className="w-6 h-6 text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-semibold text-white">
                          {referral.referral_company}
                        </h3>
                        {getStatusBadge(referral.status)}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {referral.referral_name}
                        </span>
                        <a
                          href={`mailto:${referral.referral_email}`}
                          className="flex items-center gap-1 hover:text-green-400 transition-colors"
                        >
                          <Mail className="w-4 h-4" />
                          {referral.referral_email}
                        </a>
                        {referral.referral_phone && (
                          <a
                            href={`tel:${referral.referral_phone}`}
                            className="flex items-center gap-1 hover:text-green-400 transition-colors"
                          >
                            <Phone className="w-4 h-4" />
                            {referral.referral_phone}
                          </a>
                        )}
                      </div>
                      {referral.notes && (
                        <p className="text-gray-500 text-sm mt-2 line-clamp-2">{referral.notes}</p>
                      )}
                    </div>
                  </div>

                  {/* Commission & Dates */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 lg:gap-6">
                    <div className="text-sm">
                      <p className="text-gray-500">Submitted</p>
                      <p className="text-white">{formatDate(referral.created_at)}</p>
                    </div>
                    {referral.status === 'paid' && (
                      <div className="text-sm">
                        <p className="text-gray-500">Paid</p>
                        <p className="text-white">{formatDate(referral.paid_at)}</p>
                      </div>
                    )}
                    <div className="text-sm">
                      <p className="text-gray-500">Commission</p>
                      <p className={`text-lg font-bold ${
                        referral.status === 'paid' ? 'text-green-400' : 'text-gray-400'
                      }`}>
                        {formatCurrency(referral.commission_amount)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* New Referral Modal */}
        {showNewForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-gray-800 border border-gray-700 rounded-xl shadow-2xl">
              <div className="flex items-center justify-between p-6 border-b border-gray-700">
                <h3 className="text-xl font-semibold text-white">Submit New Referral</h3>
                <button
                  onClick={() => {
                    setShowNewForm(false);
                    setSubmitError(null);
                  }}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitReferral} className="p-6 space-y-4">
                <div>
                  <label htmlFor="referral_company" className="block text-sm font-medium text-gray-300 mb-2">
                    Restaurant/Company Name *
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="text"
                      id="referral_company"
                      value={newReferral.referral_company}
                      onChange={(e) => setNewReferral({ ...newReferral, referral_company: e.target.value })}
                      required
                      className="w-full pl-10 pr-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="The Lobster Pot"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="referral_name" className="block text-sm font-medium text-gray-300 mb-2">
                    Contact Name *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="text"
                      id="referral_name"
                      value={newReferral.referral_name}
                      onChange={(e) => setNewReferral({ ...newReferral, referral_name: e.target.value })}
                      required
                      className="w-full pl-10 pr-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="John Smith"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="referral_email" className="block text-sm font-medium text-gray-300 mb-2">
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="email"
                      id="referral_email"
                      value={newReferral.referral_email}
                      onChange={(e) => setNewReferral({ ...newReferral, referral_email: e.target.value })}
                      required
                      className="w-full pl-10 pr-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="john@lobsterpot.com"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="referral_phone" className="block text-sm font-medium text-gray-300 mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="tel"
                      id="referral_phone"
                      value={newReferral.referral_phone}
                      onChange={(e) => setNewReferral({ ...newReferral, referral_phone: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="(508) 555-0123"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-300 mb-2">
                    Notes (optional)
                  </label>
                  <textarea
                    id="notes"
                    value={newReferral.notes}
                    onChange={(e) => setNewReferral({ ...newReferral, notes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                    placeholder="Any additional details about the referral..."
                  />
                </div>

                {submitError && (
                  <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-red-400 text-sm">{submitError}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewForm(false);
                      setSubmitError(null);
                    }}
                    className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Gift className="w-5 h-5" />
                        Submit Referral
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </RepLayout>
  );
};

export default RepReferrals;
