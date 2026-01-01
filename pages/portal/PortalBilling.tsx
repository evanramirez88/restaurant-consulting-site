import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Loader2,
  AlertTriangle,
  Shield,
  CreditCard,
  Clock,
  CheckCircle,
  ChevronRight,
  FileText,
  Download,
  ExternalLink,
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  Zap
} from 'lucide-react';
import { useSEO } from '../../src/components/SEO';

// ============================================
// TYPE DEFINITIONS
// ============================================
interface BillingInfo {
  client: {
    id: string;
    name: string;
    company: string;
    email: string;
    support_plan_tier: string | null;
    support_plan_status: string | null;
    support_plan_started: number | null;
    support_plan_renews: number | null;
  };
  supportHours: {
    total: number;
    used: number;
    remaining: number;
  };
  invoices: Invoice[];
  planFeatures: PlanFeature[];
}

interface Invoice {
  id: string;
  number: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  due_date: string;
  paid_date: string | null;
  pdf_url: string | null;
}

interface PlanFeature {
  name: string;
  included: boolean;
  limit?: string;
}

// Plan definitions
const SUPPORT_PLANS = {
  essential: {
    name: 'Essential',
    price: 99,
    hours: 2,
    description: 'Basic support for small restaurants',
    features: [
      { name: 'Email Support', included: true },
      { name: 'Phone Support', included: true, limit: 'Business hours' },
      { name: 'Remote Troubleshooting', included: true },
      { name: 'Monthly Support Hours', included: true, limit: '2 hours' },
      { name: 'Priority Response', included: false },
      { name: 'On-Site Support', included: false },
      { name: 'Training Sessions', included: false },
    ]
  },
  professional: {
    name: 'Professional',
    price: 199,
    hours: 5,
    description: 'Enhanced support for growing businesses',
    features: [
      { name: 'Email Support', included: true },
      { name: 'Phone Support', included: true, limit: 'Extended hours' },
      { name: 'Remote Troubleshooting', included: true },
      { name: 'Monthly Support Hours', included: true, limit: '5 hours' },
      { name: 'Priority Response', included: true, limit: '4 hour SLA' },
      { name: 'On-Site Support', included: true, limit: '1 visit/quarter' },
      { name: 'Training Sessions', included: true, limit: '1 session/month' },
    ]
  },
  premium: {
    name: 'Premium',
    price: 399,
    hours: 12,
    description: 'Comprehensive support for multi-location restaurants',
    features: [
      { name: 'Email Support', included: true },
      { name: 'Phone Support', included: true, limit: '24/7 access' },
      { name: 'Remote Troubleshooting', included: true },
      { name: 'Monthly Support Hours', included: true, limit: '12 hours' },
      { name: 'Priority Response', included: true, limit: '1 hour SLA' },
      { name: 'On-Site Support', included: true, limit: 'Unlimited' },
      { name: 'Training Sessions', included: true, limit: 'Unlimited' },
    ]
  }
};

// ============================================
// PORTAL BILLING PAGE
// ============================================
const PortalBilling: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const [isLoading, setIsLoading] = useState(true);
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useSEO({
    title: 'Billing & Support | Client Portal',
    description: 'View your support plan, billing history, and invoices.',
  });

  // Load billing info
  useEffect(() => {
    const loadBillingInfo = async () => {
      if (!slug) return;

      try {
        // Load client info
        const clientResponse = await fetch(`/api/portal/${slug}/info`);
        const clientData = await clientResponse.json();

        if (!clientData.success) {
          setError(clientData.error || 'Failed to load billing info');
          setIsLoading(false);
          return;
        }

        const client = clientData.data;
        const planTier = client.support_plan_tier as keyof typeof SUPPORT_PLANS | null;
        const plan = planTier ? SUPPORT_PLANS[planTier] : null;

        // Mock billing data - in production this would come from Square/Stripe
        const billingData: BillingInfo = {
          client: client,
          supportHours: {
            total: plan?.hours || 0,
            used: 1.5, // Would come from tracking
            remaining: (plan?.hours || 0) - 1.5
          },
          invoices: [
            {
              id: 'inv_001',
              number: 'INV-2025-001',
              amount: plan?.price || 0,
              status: 'paid',
              due_date: '2025-01-01',
              paid_date: '2024-12-28',
              pdf_url: null
            },
            {
              id: 'inv_002',
              number: 'INV-2024-012',
              amount: plan?.price || 0,
              status: 'paid',
              due_date: '2024-12-01',
              paid_date: '2024-11-28',
              pdf_url: null
            }
          ],
          planFeatures: plan?.features || []
        };

        setBillingInfo(billingData);
      } catch (err) {
        console.error('Billing load error:', err);
        setError('Failed to load billing information');
      } finally {
        setIsLoading(false);
      }
    };

    loadBillingInfo();
  }, [slug]);

  // Utility functions
  const formatDate = (dateStr: string | null | number) => {
    if (!dateStr) return 'N/A';
    const date = typeof dateStr === 'number' ? new Date(dateStr * 1000) : new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'text-green-400 bg-green-400/10';
      case 'pending':
        return 'text-amber-400 bg-amber-400/10';
      case 'overdue':
        return 'text-red-400 bg-red-400/10';
      default:
        return 'text-gray-400 bg-gray-400/10';
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  // Error state
  if (error || !billingInfo) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Error Loading Billing</h2>
        <p className="text-gray-400">{error || 'Something went wrong'}</p>
      </div>
    );
  }

  const planTier = billingInfo.client.support_plan_tier as keyof typeof SUPPORT_PLANS | null;
  const currentPlan = planTier ? SUPPORT_PLANS[planTier] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-white">Billing & Support</h1>
        <p className="text-gray-400">Manage your support plan and view billing history</p>
      </div>

      {/* Current Plan */}
      {currentPlan ? (
        <div className="admin-card overflow-hidden">
          <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 px-6 py-5 border-b border-gray-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-amber-500/20 rounded-xl flex items-center justify-center">
                  <Shield className="w-7 h-7 text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white">{currentPlan.name} Plan</h2>
                    {billingInfo.client.support_plan_status === 'active' && (
                      <span className="px-2 py-0.5 bg-green-400/10 text-green-400 text-xs font-medium rounded">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400">{currentPlan.description}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-white">{formatCurrency(currentPlan.price)}</div>
                <div className="text-sm text-gray-400">per month</div>
              </div>
            </div>
          </div>

          {/* Support Hours */}
          <div className="px-6 py-5 border-b border-gray-700">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
              Monthly Support Hours
            </h3>
            <div className="flex items-center gap-6">
              <div className="flex-1 max-w-md">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Used: {billingInfo.supportHours.used}h</span>
                  <span className="text-white font-medium">Remaining: {billingInfo.supportHours.remaining}h</span>
                </div>
                <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                    style={{ width: `${(billingInfo.supportHours.used / billingInfo.supportHours.total) * 100}%` }}
                  />
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-400">{billingInfo.supportHours.total}h</div>
                <div className="text-xs text-gray-500">Total/month</div>
              </div>
            </div>

            {billingInfo.client.support_plan_renews && (
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-400">
                <Calendar className="w-4 h-4" />
                <span>Hours reset on {formatDate(billingInfo.client.support_plan_renews)}</span>
              </div>
            )}
          </div>

          {/* Plan Features */}
          <div className="px-6 py-5">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
              Plan Features
            </h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {billingInfo.planFeatures.map((feature, index) => (
                <div key={index} className="flex items-center gap-3">
                  {feature.included ? (
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-gray-600 flex-shrink-0" />
                  )}
                  <span className={feature.included ? 'text-white' : 'text-gray-500'}>
                    {feature.name}
                    {feature.limit && (
                      <span className="text-gray-400 ml-1">({feature.limit})</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* No Plan */
        <div className="admin-card p-8 text-center">
          <Shield className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Active Support Plan</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Get priority support, dedicated hours, and exclusive benefits with a Toast Guardian support plan.
          </p>
          <Link
            to="/support-plans"
            className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600 transition-colors"
          >
            <Zap className="w-5 h-5" />
            View Support Plans
          </Link>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Link
          to={`/portal/${slug}/messages`}
          className="admin-card p-5 hover:border-amber-500/30 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
              <MessageSquare className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h4 className="font-medium text-white">Contact Support</h4>
              <p className="text-sm text-gray-400">Send a message</p>
            </div>
          </div>
        </Link>

        <a
          href="tel:+17744080083"
          className="admin-card p-5 hover:border-amber-500/30 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
              <Phone className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h4 className="font-medium text-white">Call Support</h4>
              <p className="text-sm text-gray-400">(774) 408-0083</p>
            </div>
          </div>
        </a>

        <a
          href="mailto:support@ccrestaurantconsulting.com"
          className="admin-card p-5 hover:border-amber-500/30 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
              <Mail className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h4 className="font-medium text-white">Email Support</h4>
              <p className="text-sm text-gray-400">Quick response</p>
            </div>
          </div>
        </a>
      </div>

      {/* Invoice History */}
      <div className="admin-card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Invoice History</h3>
          <Link
            to="#"
            className="text-sm text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1"
          >
            View All <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {billingInfo.invoices.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No invoices yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700 text-left">
                  <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Invoice</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {billingInfo.invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-amber-400">{invoice.number}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-white">{formatCurrency(invoice.amount)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(invoice.status)}`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-400">
                        {invoice.paid_date ? formatDate(invoice.paid_date) : formatDate(invoice.due_date)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {invoice.pdf_url ? (
                          <a
                            href={invoice.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-gray-400 hover:text-amber-400 transition-colors"
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        ) : (
                          <button
                            className="p-2 text-gray-600 cursor-not-allowed"
                            title="PDF not available"
                            disabled
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Plan Upgrade CTA */}
      {currentPlan && planTier !== 'premium' && (
        <div className="admin-card p-6 border-l-4 border-l-amber-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h4 className="font-semibold text-white">Need More Support?</h4>
                <p className="text-sm text-gray-400">
                  Upgrade your plan for more hours and priority support.
                </p>
              </div>
            </div>
            <Link
              to="/support-plans"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors"
            >
              View Upgrade Options
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortalBilling;
