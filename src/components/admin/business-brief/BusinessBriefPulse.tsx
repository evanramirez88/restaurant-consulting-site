import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2, RefreshCw, DollarSign, TrendingUp, TrendingDown,
  Users, FileText, Ticket, Mail, Activity, Database,
  AlertTriangle, CheckCircle2, Clock, Zap, ChevronRight,
  BarChart3, PieChart, ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react';

interface RevenuePulse {
  mrr: number;
  arr: number;
  mrrFormatted: string;
  arrFormatted: string;
  churnRate: number;
  activeSubscriptions: number;
  stripeRevenue30d: number;
  squareRevenue30d: number;
  totalRevenue30d: number;
  byServiceLine: {
    toastGuardian: { active: number; mrr: number };
    networkSupport: { active: number; mrr: number };
    projectWork: { revenue: number; pending: number };
  };
  projected30Day: number;
  projected90Day: number;
}

interface PipelinePulse {
  funnel: {
    prospects: number;
    leads: number;
    qualified: number;
    opportunities: number;
    clients: number;
  };
  quotes: {
    draft: { count: number; value: number };
    sent: { count: number; value: number };
    viewed: { count: number; value: number };
    accepted: { count: number; value: number };
    declined: { count: number; value: number };
    expired: { count: number; value: number };
  };
  quoteToCloseRate: number;
  avgDealSize: number;
  recentConversions: {
    count: number;
    value: number;
  };
}

interface OperationsPulse {
  tickets: {
    total: number;
    open: number;
    inProgress: number;
    resolvedToday: number;
    urgent: number;
    avgAgeHours: number;
  };
  automation: {
    jobsToday: number;
    completed: number;
    failed: number;
    queued: number;
    successRate: number;
  };
  email: {
    queueDepth: number;
    sentToday: number;
    bounceRate: number;
    openRate: number;
    deliverabilityScore: number;
  };
  portals: {
    clientLoginsToday: number;
    repLoginsToday: number;
  };
}

interface MarketPulse {
  leads: {
    total: number;
    withValidEmail: number;
    withValidPhone: number;
    hotLeads: number;
    enrichedLast30Days: number;
    emailCoverage: string;
    phoneCoverage: string;
  };
  segments: {
    name: string;
    key: string;
    count: number;
    avgScore: number;
  }[];
  beacon: {
    pendingReview: number;
    approved: number;
    published: number;
    newToday: number;
  };
}

interface PulseData {
  timestamp: number;
  lastUpdated: string;
  revenue: RevenuePulse;
  pipeline: PipelinePulse;
  operations: OperationsPulse;
  market: MarketPulse;
}

export default function BusinessBriefPulse() {
  const [data, setData] = useState<PulseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPulse = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const response = await fetch('/api/admin/business-brief/pulse', {
        credentials: 'include'
      });
      const result = await response.json();

      if (result.success) {
        setData(result);
        setError(null);
      } else {
        setError(result.error || 'Failed to load pulse data');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPulse();
    // Refresh every minute for real-time feel
    const interval = setInterval(() => fetchPulse(false), 60000);
    return () => clearInterval(interval);
  }, [fetchPulse]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  const getHealthColor = (value: number, inverse = false) => {
    const adjusted = inverse ? 100 - value : value;
    if (adjusted >= 80) return 'text-green-400';
    if (adjusted >= 60) return 'text-lime-400';
    if (adjusted >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'warning': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/50';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-card p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Failed to Load Pulse</h3>
        <p className="text-gray-400 mb-4">{error}</p>
        <button
          onClick={() => fetchPulse()}
          className="px-4 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { revenue, pipeline, operations, market } = data;

  // Calculate overall system health
  const operationsHealth = Math.round(
    (operations.automation.successRate * 0.3) +
    (operations.email.deliverabilityScore * 0.3) +
    ((100 - Math.min(operations.tickets.urgent * 10, 100)) * 0.4)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-amber-400" />
            Business Pulse
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Real-time health monitoring • Updated {new Date(data.lastUpdated).toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={() => fetchPulse(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* ========== REVENUE PULSE ========== */}
      <div className="admin-card overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-green-500/10 to-transparent border-b border-gray-700">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-400" />
            <h3 className="font-semibold text-white">Revenue Pulse</h3>
          </div>
        </div>

        <div className="p-4">
          {/* MRR/ARR Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-1">MRR</div>
              <div className="text-2xl font-bold text-green-400">{revenue.mrrFormatted}</div>
              <div className="text-xs text-gray-500 mt-1">{revenue.activeSubscriptions} subscriptions</div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-1">ARR</div>
              <div className="text-2xl font-bold text-white">{revenue.arrFormatted}</div>
              <div className="text-xs text-gray-500 mt-1">Annual recurring</div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-1">Churn Rate</div>
              <div className={`text-2xl font-bold ${revenue.churnRate > 5 ? 'text-red-400' : revenue.churnRate > 2 ? 'text-yellow-400' : 'text-green-400'}`}>
                {revenue.churnRate}%
              </div>
              <div className="text-xs text-gray-500 mt-1">Last 30 days</div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-1">30-Day Revenue</div>
              <div className="text-2xl font-bold text-white">{formatCurrency(revenue.totalRevenue30d)}</div>
              <div className="text-xs text-gray-500 mt-1">Stripe + Square</div>
            </div>
          </div>

          {/* Revenue Sources */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-800/30 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Stripe (Subscriptions)</span>
                <span className="text-green-400 font-medium">{formatCurrency(revenue.stripeRevenue30d)}</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: `${revenue.totalRevenue30d > 0 ? (revenue.stripeRevenue30d / revenue.totalRevenue30d) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="bg-gray-800/30 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Square (Projects)</span>
                <span className="text-blue-400 font-medium">{formatCurrency(revenue.squareRevenue30d)}</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${revenue.totalRevenue30d > 0 ? (revenue.squareRevenue30d / revenue.totalRevenue30d) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="bg-gray-800/30 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">90-Day Projection</span>
                <span className="text-amber-400 font-medium">{formatCurrency(revenue.projected90Day)}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <TrendingUp className="w-3 h-3 text-green-400" />
                Based on current trajectory
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========== PIPELINE PULSE ========== */}
      <div className="admin-card overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-blue-500/10 to-transparent border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-white">Pipeline Pulse</h3>
          </div>
        </div>

        <div className="p-4">
          {/* Lead Funnel */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-400 mb-3">Lead Funnel</h4>
            <div className="flex items-center gap-2">
              {Object.entries(pipeline.funnel).map(([stage, count], idx) => {
                const widths = [100, 80, 60, 40, 30];
                const colors = ['bg-gray-600', 'bg-blue-600', 'bg-purple-600', 'bg-amber-600', 'bg-green-600'];
                return (
                  <React.Fragment key={stage}>
                    <div
                      className={`${colors[idx]} rounded-lg p-3 text-center transition-all hover:scale-105`}
                      style={{ flex: widths[idx] / 100 }}
                    >
                      <div className="text-lg font-bold text-white">{formatNumber(count)}</div>
                      <div className="text-xs text-gray-300 capitalize">{stage}</div>
                    </div>
                    {idx < 4 && <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Quote Pipeline */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-400 mb-3">Quote Pipeline</h4>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {Object.entries(pipeline.quotes).map(([status, data]) => {
                const statusColors: Record<string, string> = {
                  draft: 'border-gray-500',
                  sent: 'border-blue-500',
                  viewed: 'border-purple-500',
                  accepted: 'border-green-500',
                  declined: 'border-red-500',
                  expired: 'border-orange-500'
                };
                return (
                  <div key={status} className={`bg-gray-800/50 rounded-lg p-3 border-l-2 ${statusColors[status]}`}>
                    <div className="text-lg font-bold text-white">{data.count}</div>
                    <div className="text-xs text-gray-400 capitalize">{status}</div>
                    <div className="text-xs text-gray-500 mt-1">{formatCurrency(data.value)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Conversion Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-white">{pipeline.quoteToCloseRate}%</div>
              <div className="text-xs text-gray-400">Quote-to-Close</div>
            </div>

            <div className="bg-gray-800/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-white">{formatCurrency(pipeline.avgDealSize)}</div>
              <div className="text-xs text-gray-400">Avg Deal Size</div>
            </div>

            <div className="bg-gray-800/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-400">{pipeline.recentConversions.count}</div>
              <div className="text-xs text-gray-400">Conversions (30d)</div>
            </div>

            <div className="bg-gray-800/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-400">{formatCurrency(pipeline.recentConversions.value)}</div>
              <div className="text-xs text-gray-400">Conversion Value</div>
            </div>
          </div>
        </div>
      </div>

      {/* ========== OPERATIONS PULSE ========== */}
      <div className="admin-card overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-purple-500/10 to-transparent border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-400" />
              <h3 className="font-semibold text-white">Operations Pulse</h3>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
              operationsHealth >= 80 ? getStatusColor('healthy') :
              operationsHealth >= 60 ? getStatusColor('warning') :
              getStatusColor('critical')
            }`}>
              {operationsHealth >= 80 ? 'Healthy' : operationsHealth >= 60 ? 'Needs Attention' : 'Critical'}
            </span>
          </div>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Tickets */}
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Ticket className="w-4 h-4 text-orange-400" />
                <span className="text-sm font-medium text-gray-300">Support</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Open</span>
                  <span className="font-medium text-white">{operations.tickets.open}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">In Progress</span>
                  <span className="font-medium text-white">{operations.tickets.inProgress}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Urgent</span>
                  <span className={`font-medium ${operations.tickets.urgent > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {operations.tickets.urgent}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Avg Age</span>
                  <span className="font-medium text-white">{operations.tickets.avgAgeHours}h</span>
                </div>
              </div>
            </div>

            {/* Automation */}
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-green-400" />
                <span className="text-sm font-medium text-gray-300">Automation</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Jobs Today</span>
                  <span className="font-medium text-white">{operations.automation.jobsToday}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Success Rate</span>
                  <span className={`font-medium ${getHealthColor(operations.automation.successRate)}`}>
                    {operations.automation.successRate}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Failed</span>
                  <span className={`font-medium ${operations.automation.failed > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {operations.automation.failed}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Queued</span>
                  <span className="font-medium text-white">{operations.automation.queued}</span>
                </div>
              </div>
            </div>

            {/* Email */}
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Mail className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-gray-300">Email</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Sent Today</span>
                  <span className="font-medium text-white">{operations.email.sentToday}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Queue</span>
                  <span className="font-medium text-white">{operations.email.queueDepth}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Open Rate</span>
                  <span className={`font-medium ${getHealthColor(operations.email.openRate)}`}>
                    {operations.email.openRate}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Deliverability</span>
                  <span className={`font-medium ${getHealthColor(operations.email.deliverabilityScore)}`}>
                    {operations.email.deliverabilityScore}%
                  </span>
                </div>
              </div>
            </div>

            {/* Portals */}
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium text-gray-300">Portals</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Client Logins</span>
                  <span className="font-medium text-white">{operations.portals.clientLoginsToday}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Rep Logins</span>
                  <span className="font-medium text-white">{operations.portals.repLoginsToday}</span>
                </div>
                <div className="pt-2 mt-2 border-t border-gray-700">
                  <span className="text-xs text-gray-500">Today's activity</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========== MARKET PULSE ========== */}
      <div className="admin-card overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-amber-500/10 to-transparent border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-amber-400" />
            <h3 className="font-semibold text-white">Market Pulse</h3>
          </div>
        </div>

        <div className="p-4">
          {/* Lead Database Health */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-400 mb-3">Lead Database Health</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-white">{formatNumber(market.leads.total)}</div>
                <div className="text-xs text-gray-400">Total Leads</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-green-400">{market.leads.emailCoverage}%</div>
                <div className="text-xs text-gray-400">Email Coverage</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-blue-400">{market.leads.phoneCoverage}%</div>
                <div className="text-xs text-gray-400">Phone Coverage</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-amber-400">{formatNumber(market.leads.hotLeads)}</div>
                <div className="text-xs text-gray-400">Hot Leads (80+)</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-purple-400">{formatNumber(market.leads.enrichedLast30Days)}</div>
                <div className="text-xs text-gray-400">Enriched (30d)</div>
              </div>
            </div>
          </div>

          {/* Segments */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-400 mb-3">Top Segments</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {market.segments.slice(0, 6).map(segment => (
                <div key={segment.key} className="flex items-center justify-between bg-gray-800/30 rounded-lg p-3">
                  <div>
                    <span className="text-white font-medium">{segment.name}</span>
                    <span className="text-gray-500 text-sm ml-2">({segment.key})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400">{formatNumber(segment.count)} leads</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      segment.avgScore >= 70 ? 'bg-green-500/20 text-green-400' :
                      segment.avgScore >= 50 ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {segment.avgScore} avg
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Beacon Content */}
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-3">Beacon Content Pipeline</h4>
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-yellow-400">{market.beacon.pendingReview}</div>
                <div className="text-xs text-gray-400">Pending</div>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-blue-400">{market.beacon.approved}</div>
                <div className="text-xs text-gray-400">Approved</div>
              </div>
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-green-400">{market.beacon.published}</div>
                <div className="text-xs text-gray-400">Published</div>
              </div>
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-purple-400">{market.beacon.newToday}</div>
                <div className="text-xs text-gray-400">New Today</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
