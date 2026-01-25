import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2, RefreshCw, Target, TrendingUp, TrendingDown, Minus,
  AlertCircle, AlertTriangle, CheckCircle2, Clock, DollarSign,
  Users, Mail, Ticket, Zap, ChevronRight, ChevronDown,
  ExternalLink, Bell, Calendar, Briefcase, BarChart3, Activity, Info
} from 'lucide-react';
import { SparkLine, LineChart, FunnelChart, HealthGauge } from '../charts';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface DailyBrief {
  date: string;
  aiSummary: string;
  urgentCount: number;
  opportunitiesCount: number;
  healthScore: number;
  trend: 'up' | 'down' | 'stable';
}

interface ActionItem {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description?: string;
  sourceType: string;
  sourceId?: string;
  sourceLink?: string;
  estimatedValue?: number;
  deadline?: number;
  suggestedAction?: string;
  status: string;
  createdAt: number;
}

interface QuickWin {
  id: string;
  type: string;
  title: string;
  description: string;
  value?: number;
  action: string;
  priority: string;
}

interface GoalProgress {
  id: string;
  title: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  deadline?: number;
  status: string;
  percentComplete: number;
  currentMRR?: number;
  daysRemaining?: number;
  weeklyTarget?: number;
  milestones: {
    id: string;
    title?: string;
    targetDate: number;
    targetValue: number;
    actualValue?: number;
    achieved: boolean;
  }[];
}

interface Metrics {
  revenue: {
    mrr: number;
    arr: number;
    mtd: number;
    target: number;
    percentToGoal: number;
  };
  pipeline: {
    activeQuotes: number;
    quoteValue: number;
    avgCloseRate: number;
    projectedValue: number;
  };
  support: {
    openTickets: number;
    inProgress: number;
    highPriority: number;
    avgResponseTime: number;
  };
  email: {
    sentToday: number;
    deliverabilityScore: number;
    openRate: number;
    clickRate: number;
    failedCount: number;
  };
  clients: {
    total: number;
    activePortals: number;
    activePlans: number;
    planBreakdown: {
      core: number;
      professional: number;
      premium: number;
    };
  };
  leads: {
    total: number;
    funnel: Record<string, number>;
    newToday: number;
    hotLeadsCount: number;
  };
}

interface TrendData {
  revenue: {
    current: number;
    wow: { previous: number; change: number; direction: string };
    mom: { previous: number; change: number; direction: string };
    sparkline: { date: string; value: number }[];
  };
  clients: {
    current: number;
    wow: { previous: number; change: number; direction: string };
    sparkline: { date: string; value: number }[];
  };
  pipeline: {
    current: number;
    activeQuotes: number;
    sparkline: { date: string; value: number }[];
  };
  email: {
    currentOpenRate: number;
    wow: { previous: number; change: number; direction: string };
  };
}

interface HealthScoreData {
  overall: number;
  status: string;
  trend: string;
  components: {
    revenue: { score: number; weight: number; contribution: number; metric: number; metricLabel: string };
    clients: { score: number; weight: number; contribution: number; metric: number; metricLabel: string };
    pipeline: { score: number; weight: number; contribution: number; metric: number; metricLabel: string };
    email: { score: number; weight: number; contribution: number; metric: number; metricLabel: string };
    retention: { score: number; weight: number; contribution: number; metric: number; metricLabel: string };
  };
}

interface DashboardData {
  dailyBrief: DailyBrief;
  actionItems: ActionItem[];
  metrics: Metrics;
  quickWins: QuickWin[];
  goalProgress: GoalProgress | null;
  alerts: {
    urgentTickets: any[];
    failedEmails: any[];
    recentConversions: any[];
  };
}

// ============================================
// COMPONENT
// ============================================

export default function BusinessBriefDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [trends, setTrends] = useState<TrendData | null>(null);
  const [healthScore, setHealthScore] = useState<HealthScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    actions: true,
    quickWins: true,
    goals: true,
    healthBreakdown: false
  });

  const fetchDashboard = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      // Fetch dashboard data and trends in parallel
      const [dashboardRes, trendsRes, healthRes] = await Promise.all([
        fetch('/api/admin/business-brief/dashboard', { credentials: 'include' }),
        fetch('/api/admin/business-brief/trends', { credentials: 'include' }).catch(() => null),
        fetch('/api/admin/business-brief/health-score', { credentials: 'include' }).catch(() => null)
      ]);

      const dashboardResult = await dashboardRes.json();

      if (dashboardResult.success) {
        setData(dashboardResult);
        setError(null);
      } else {
        setError(dashboardResult.error || 'Failed to load dashboard');
      }

      // Trends data (optional)
      if (trendsRes && trendsRes.ok) {
        const trendsResult = await trendsRes.json();
        if (trendsResult.success) {
          setTrends(trendsResult.trends);
        }
      }

      // Health score data (optional)
      if (healthRes && healthRes.ok) {
        const healthResult = await healthRes.json();
        if (healthResult.success) {
          setHealthScore(healthResult.healthScore);
        }
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    // Refresh every 5 minutes
    const interval = setInterval(() => fetchDashboard(false), 300000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const handleAcknowledge = async (actionId: string) => {
    try {
      await fetch('/api/admin/business-brief/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ operation: 'acknowledge', id: actionId })
      });
      fetchDashboard();
    } catch (err) {
      console.error('Failed to acknowledge action:', err);
    }
  };

  const handleComplete = async (actionId: string) => {
    try {
      await fetch('/api/admin/business-brief/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ operation: 'complete', id: actionId })
      });
      fetchDashboard();
    } catch (err) {
      console.error('Failed to complete action:', err);
    }
  };

  const handleDismiss = async (actionId: string) => {
    try {
      await fetch('/api/admin/business-brief/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ operation: 'dismiss', id: actionId })
      });
      fetchDashboard();
    } catch (err) {
      console.error('Failed to dismiss action:', err);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-400 bg-red-500/20 border-red-500/50';
      case 'high': return 'text-orange-400 bg-orange-500/20 border-orange-500/50';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/50';
      case 'low': return 'text-green-400 bg-green-500/20 border-green-500/50';
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500/50';
    }
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'up': return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'down': return <TrendingDown className="w-4 h-4 text-red-400" />;
      default: return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const getTrendBadge = (change: number, inverse = false) => {
    const isPositive = inverse ? change < 0 : change > 0;
    const color = isPositive ? 'text-green-400 bg-green-500/20' : change === 0 ? 'text-gray-400 bg-gray-500/20' : 'text-red-400 bg-red-500/20';
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${color}`}>
        {change > 0 ? '+' : ''}{change.toFixed(1)}%
      </span>
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
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
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Failed to Load Dashboard</h3>
        <p className="text-gray-400 mb-4">{error}</p>
        <button
          onClick={() => fetchDashboard()}
          className="px-4 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { dailyBrief, actionItems, metrics, quickWins, goalProgress, alerts } = data;

  // Prepare funnel data for visualization
  const funnelStages = metrics.leads.funnel ? [
    { label: 'Prospects', value: metrics.leads.funnel.prospect || 0, color: '#6366f1' },
    { label: 'Leads', value: metrics.leads.funnel.lead || 0, color: '#8b5cf6' },
    { label: 'Qualified', value: metrics.leads.funnel.qualified || 0, color: '#a855f7' },
    { label: 'Opportunity', value: metrics.leads.funnel.opportunity || 0, color: '#d946ef' },
    { label: 'Clients', value: metrics.leads.funnel.client || 0, color: '#22c55e' }
  ].filter(s => s.value > 0) : [];

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">{dailyBrief.date}</h2>
          <p className="text-gray-400 text-sm mt-1">Executive Dashboard</p>
        </div>
        <button
          onClick={() => fetchDashboard(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Daily Brief Card with Health Gauge */}
      <div className="admin-card p-6 border-l-4 border-amber-500">
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          {/* AI Summary */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-amber-400" />
              <h3 className="font-semibold text-white">Daily Brief</h3>
            </div>
            <p className="text-gray-300 leading-relaxed">{dailyBrief.aiSummary}</p>
          </div>

          {/* Health Score Gauge & Quick Stats */}
          <div className="flex flex-row lg:flex-col items-center gap-4 lg:gap-3 lg:min-w-[180px]">
            {/* Health Gauge */}
            <div className="flex-shrink-0">
              <HealthGauge
                score={healthScore?.overall || dailyBrief.healthScore}
                size={100}
                showTrend={healthScore?.trend as 'up' | 'down' | 'stable' || dailyBrief.trend as any}
                label="Business Health"
              />
            </div>

            {/* Urgent/Opportunities */}
            <div className="flex-1 lg:flex-none flex gap-3 w-full">
              <div className="flex-1 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-400">{dailyBrief.urgentCount}</div>
                <div className="text-xs text-gray-400">Urgent</div>
              </div>
              <div className="flex-1 bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-400">{dailyBrief.opportunitiesCount}</div>
                <div className="text-xs text-gray-400">Wins</div>
              </div>
            </div>
          </div>
        </div>

        {/* Health Score Breakdown (Collapsible) */}
        {healthScore && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <button
              onClick={() => toggleSection('healthBreakdown')}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"
            >
              <Info className="w-4 h-4" />
              Health Score Breakdown
              {expandedSections.healthBreakdown ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>

            {expandedSections.healthBreakdown && (
              <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-3">
                {Object.entries(healthScore.components).map(([key, comp]) => (
                  <div key={key} className="bg-gray-800/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400 capitalize">{key}</span>
                      <span className="text-xs text-gray-500">{(comp.weight * 100).toFixed(0)}%</span>
                    </div>
                    <div className="text-lg font-bold text-white">{comp.score.toFixed(0)}</div>
                    <div className="h-1.5 bg-gray-700 rounded-full mt-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          comp.score >= 70 ? 'bg-green-500' :
                          comp.score >= 40 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${comp.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* KPI Row with Trends */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* MRR with Sparkline */}
        <div className="admin-card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <DollarSign className="w-4 h-4" />
              MRR
            </div>
            {trends?.revenue.sparkline && trends.revenue.sparkline.length > 1 && (
              <SparkLine
                data={trends.revenue.sparkline.map(d => d.value)}
                width={60}
                height={20}
                showArea={false}
                showDots
              />
            )}
          </div>
          <div className="text-2xl font-bold text-white">{formatCurrency(metrics.revenue.mrr)}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500">{formatCurrency(metrics.revenue.arr)} ARR</span>
            {trends?.revenue.wow && (
              <span className="text-xs">
                {getTrendBadge(trends.revenue.wow.change)}
              </span>
            )}
          </div>
        </div>

        {/* Pipeline with Sparkline */}
        <div className="admin-card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Briefcase className="w-4 h-4" />
              Pipeline
            </div>
            {trends?.pipeline.sparkline && trends.pipeline.sparkline.length > 1 && (
              <SparkLine
                data={trends.pipeline.sparkline.map(d => d.value)}
                width={60}
                height={20}
                showArea={false}
                showDots
              />
            )}
          </div>
          <div className="text-2xl font-bold text-white">{formatCurrency(metrics.pipeline.quoteValue)}</div>
          <div className="text-xs text-gray-500 mt-1">
            {metrics.pipeline.activeQuotes} active quotes
          </div>
        </div>

        {/* Support */}
        <div className="admin-card p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
            <Ticket className="w-4 h-4" />
            Open Tickets
          </div>
          <div className="text-2xl font-bold text-white">{metrics.support.openTickets}</div>
          <div className="text-xs text-gray-500 mt-1">
            {metrics.support.highPriority} high priority
          </div>
        </div>

        {/* Email with Trend */}
        <div className="admin-card p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
            <Mail className="w-4 h-4" />
            Email Today
          </div>
          <div className="text-2xl font-bold text-white">{metrics.email.sentToday}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500">{metrics.email.openRate}% open</span>
            {trends?.email.wow && (
              <span className="text-xs">
                {getTrendBadge(trends.email.wow.change)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Revenue Chart + Pipeline Funnel Row */}
      {(trends?.revenue.sparkline?.length ?? 0) > 5 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Trajectory */}
          <div className="admin-card p-4">
            <h4 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Revenue Trajectory (30 Days)
            </h4>
            <LineChart
              data={trends?.revenue.sparkline?.map(d => ({ date: d.date, value: d.value })) || []}
              width={500}
              height={180}
              yAxisFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              showGrid
              showLabels
            />
          </div>

          {/* Pipeline Funnel */}
          {funnelStages.length > 0 && (
            <div className="admin-card p-4">
              <h4 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Pipeline Funnel
              </h4>
              <FunnelChart
                stages={funnelStages}
                width={400}
                height={180}
                showPercentages
                showValues
              />
            </div>
          )}
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Actions */}
        <div className="admin-card">
          <button
            onClick={() => toggleSection('actions')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50"
          >
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-amber-400" />
              <h3 className="font-semibold text-white">Priority Actions</h3>
              <span className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded-full">
                {actionItems.length}
              </span>
            </div>
            {expandedSections.actions ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {expandedSections.actions && (
            <div className="border-t border-gray-700">
              {actionItems.length === 0 ? (
                <div className="p-6 text-center text-gray-400">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
                  <p>All caught up! No pending actions.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-700/50 max-h-[400px] overflow-y-auto">
                  {actionItems.slice(0, 10).map(action => (
                    <div key={action.id} className="p-4 hover:bg-gray-800/30">
                      <div className="flex items-start gap-3">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getPriorityColor(action.priority)}`}>
                          {action.priority}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{action.title}</p>
                          {action.description && (
                            <p className="text-gray-400 text-sm mt-1 line-clamp-2">{action.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            {action.estimatedValue && (
                              <span className="text-xs text-green-400">
                                {formatCurrency(action.estimatedValue)}
                              </span>
                            )}
                            {action.deadline && (
                              <span className="text-xs text-gray-500">
                                Due {formatDate(action.deadline)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3 ml-14">
                        {action.sourceLink && (
                          <a
                            href={`/#${action.sourceLink}`}
                            className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View
                          </a>
                        )}
                        <button
                          onClick={() => handleAcknowledge(action.id)}
                          className="text-xs text-gray-400 hover:text-white"
                        >
                          Acknowledge
                        </button>
                        <button
                          onClick={() => handleComplete(action.id)}
                          className="text-xs text-green-400 hover:text-green-300"
                        >
                          Complete
                        </button>
                        <button
                          onClick={() => handleDismiss(action.id)}
                          className="text-xs text-gray-500 hover:text-gray-300"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Wins */}
        <div className="admin-card">
          <button
            onClick={() => toggleSection('quickWins')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50"
          >
            <div className="flex items-center gap-3">
              <Target className="w-5 h-5 text-green-400" />
              <h3 className="font-semibold text-white">Quick Wins</h3>
              <span className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded-full">
                {quickWins.length}
              </span>
            </div>
            {expandedSections.quickWins ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {expandedSections.quickWins && (
            <div className="border-t border-gray-700">
              {quickWins.length === 0 ? (
                <div className="p-6 text-center text-gray-400">
                  <BarChart3 className="w-8 h-8 mx-auto mb-2 text-gray-500" />
                  <p>No quick wins identified today.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-700/50 max-h-[400px] overflow-y-auto">
                  {quickWins.map(win => (
                    <div key={win.id} className="p-4 hover:bg-gray-800/30">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium">{win.title}</p>
                          <p className="text-gray-400 text-sm mt-1">{win.description}</p>
                        </div>
                        {win.value && (
                          <span
                            className="text-green-400 font-medium whitespace-nowrap"
                            title="Estimated opportunity value based on average project size"
                          >
                            {formatCurrency(win.value)}
                          </span>
                        )}
                      </div>
                      <a
                        href={`/#${win.action}`}
                        className="inline-flex items-center gap-1 mt-2 text-xs text-amber-400 hover:text-amber-300"
                      >
                        Take Action <ChevronRight className="w-3 h-3" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Goal Progress */}
      {goalProgress && (
        <div className="admin-card">
          <button
            onClick={() => toggleSection('goals')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50"
          >
            <div className="flex items-center gap-3">
              <Target className="w-5 h-5 text-amber-400" />
              <h3 className="font-semibold text-white">{goalProgress.title}</h3>
            </div>
            {expandedSections.goals ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {expandedSections.goals && (
            <div className="border-t border-gray-700 p-4">
              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl font-bold text-white">
                    {formatCurrency(goalProgress.currentValue)}
                  </span>
                  <span className="text-gray-400">
                    of {formatCurrency(goalProgress.targetValue)}
                  </span>
                </div>
                <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(goalProgress.percentComplete, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2 text-sm">
                  <span className="text-gray-400">
                    {goalProgress.percentComplete.toFixed(1)}% complete
                  </span>
                  <div className="flex items-center gap-4">
                    {goalProgress.daysRemaining !== undefined && (
                      <span className="text-gray-500">
                        {goalProgress.daysRemaining} days remaining
                      </span>
                    )}
                    {goalProgress.currentMRR !== undefined && (
                      <span className="text-amber-400">
                        {formatCurrency(goalProgress.currentMRR)} MRR
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Weekly Target */}
              {goalProgress.weeklyTarget && (
                <div className="bg-gray-800/50 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Weekly Target</span>
                    <span className="text-lg font-bold text-white">{formatCurrency(goalProgress.weeklyTarget)}</span>
                  </div>
                </div>
              )}

              {/* Milestones */}
              {goalProgress.milestones.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <h4 className="text-sm font-medium text-gray-400 mb-3">Milestones</h4>
                  <div className="space-y-2">
                    {goalProgress.milestones.map((milestone, idx) => {
                      const isPast = milestone.targetDate * 1000 < Date.now();
                      const progress = milestone.achieved || (isPast && milestone.actualValue && milestone.actualValue >= milestone.targetValue);

                      return (
                        <div key={milestone.id} className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                            progress
                              ? 'bg-green-500/20 text-green-400'
                              : isPast
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-gray-700 text-gray-400'
                          }`}>
                            {progress ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : (
                              <span className="text-xs">{idx + 1}</span>
                            )}
                          </div>
                          <div className="flex-1">
                            <span className={`text-sm ${progress ? 'text-gray-400 line-through' : 'text-white'}`}>
                              {milestone.title || formatDate(milestone.targetDate)}
                            </span>
                          </div>
                          <span className="text-sm text-gray-400">
                            {formatCurrency(milestone.targetValue)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Week-over-Week Comparison Cards */}
      {trends && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="admin-card p-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
              <DollarSign className="w-4 h-4" />
              Revenue WoW
            </div>
            <div className="flex items-center gap-2">
              {getTrendIcon(trends.revenue.wow.direction)}
              <span className="text-xl font-bold text-white">
                {trends.revenue.wow.change > 0 ? '+' : ''}{trends.revenue.wow.change.toFixed(1)}%
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              vs {formatCurrency(trends.revenue.wow.previous)}
            </div>
          </div>

          <div className="admin-card p-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
              <Users className="w-4 h-4" />
              Clients WoW
            </div>
            <div className="flex items-center gap-2">
              {getTrendIcon(trends.clients.wow.direction)}
              <span className="text-xl font-bold text-white">
                {trends.clients.wow.change > 0 ? '+' : ''}{trends.clients.wow.change.toFixed(1)}%
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {trends.clients.current} active
            </div>
          </div>

          <div className="admin-card p-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
              <DollarSign className="w-4 h-4" />
              Revenue MoM
            </div>
            <div className="flex items-center gap-2">
              {getTrendIcon(trends.revenue.mom.direction)}
              <span className="text-xl font-bold text-white">
                {trends.revenue.mom.change > 0 ? '+' : ''}{trends.revenue.mom.change.toFixed(1)}%
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              30-day trend
            </div>
          </div>

          <div className="admin-card p-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
              <Mail className="w-4 h-4" />
              Email Engagement
            </div>
            <div className="flex items-center gap-2">
              {getTrendIcon(trends.email.wow.direction)}
              <span className="text-xl font-bold text-white">
                {trends.email.currentOpenRate.toFixed(0)}%
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              open rate
            </div>
          </div>
        </div>
      )}

      {/* Client/Lead Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="admin-card p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
            <Users className="w-4 h-4" />
            Clients
          </div>
          <div className="text-2xl font-bold text-white">{metrics.clients.total}</div>
          <div className="text-xs text-gray-500 mt-1">
            {metrics.clients.activePlans} on plans
          </div>
        </div>

        <div className="admin-card p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
            <BarChart3 className="w-4 h-4" />
            Plan Mix
          </div>
          <div className="flex gap-2 mt-1">
            <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">
              {metrics.clients.planBreakdown.core} Core
            </span>
            <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded">
              {metrics.clients.planBreakdown.professional} Pro
            </span>
            <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded">
              {metrics.clients.planBreakdown.premium} Prem
            </span>
          </div>
        </div>

        <div className="admin-card p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
            <Target className="w-4 h-4" />
            Total Leads
          </div>
          <div className="text-2xl font-bold text-white">{metrics.leads.total.toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-1">
            +{metrics.leads.newToday} today
          </div>
        </div>

        <div className="admin-card p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
            <Zap className="w-4 h-4" />
            Hot Leads
          </div>
          <div className="text-2xl font-bold text-amber-400">{metrics.leads.hotLeadsCount}</div>
          <div className="text-xs text-gray-500 mt-1">
            Score 80+, ready to contact
          </div>
        </div>
      </div>

      {/* Alerts Footer */}
      {(alerts.urgentTickets.length > 0 || alerts.failedEmails.length > 0) && (
        <div className="admin-card p-4 border-l-4 border-red-500">
          <h4 className="text-sm font-medium text-red-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Alerts Requiring Attention
          </h4>
          <div className="space-y-2 text-sm">
            {alerts.urgentTickets.slice(0, 3).map(ticket => (
              <div key={ticket.id} className="flex items-center gap-2 text-gray-300">
                <Ticket className="w-4 h-4 text-orange-400" />
                <span className="truncate">{ticket.subject}</span>
                <span className="text-gray-500">({ticket.clientName})</span>
              </div>
            ))}
            {alerts.failedEmails.slice(0, 3).map((email, idx) => (
              <div key={idx} className="flex items-center gap-2 text-gray-300">
                <Mail className="w-4 h-4 text-red-400" />
                <span className="truncate">Failed: {email.subject}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
