import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2, RefreshCw, Target, TrendingUp, DollarSign,
  MapPin, Globe, Users, CheckCircle2, AlertTriangle,
  Calendar, BarChart3, ArrowRight, Calculator, Zap,
  ChevronRight, Clock, PieChart
} from 'lucide-react';

interface Goal {
  id: string;
  title: string;
  description?: string;
  category: string;
  target_value: number;
  current_value: number;
  unit: string;
  deadline?: number;
  status: string;
  milestones: {
    id: string;
    title?: string;
    targetDate: number;
    targetValue: number;
    actualValue?: number;
    achieved: boolean;
  }[];
  percentComplete: number;
  daysRemaining?: number;
  remainingValue: number;
  requiredDailyRate?: number;
  formattedDeadline?: string;
}

interface SupportPlanMix {
  current: {
    core: number;
    professional: number;
    premium: number;
    none: number;
  };
  target: {
    core: number;
    professional: number;
    premium: number;
    totalMRR: number;
  };
  mrr: {
    current: number;
    target: number;
    byTier: {
      core: number;
      professional: number;
      premium: number;
    };
  };
  progress: {
    core: string;
    professional: string;
    premium: string;
  };
}

interface Lane {
  name: string;
  description: string;
  clients: number;
  revenue30d: number;
  pendingRevenue: number;
  leads: {
    total: number;
    hot: number;
  };
  services: string[];
  squareLocation: string;
}

interface Scenario {
  label: string;
  assumedCloseRate: number;
  projectedValue: number;
  description: string;
}

interface StrategyData {
  timestamp: number;
  lastUpdated: string;
  goals: Goal[];
  supportPlanMix: SupportPlanMix;
  lanes: {
    a: Lane;
    b: Lane;
  };
  pipeline: {
    activeQuotes: number;
    pipelineValue: number;
    closeRate: number;
    recentWins: number;
    recentValue: number;
  };
  scenarios: {
    conservative: Scenario;
    moderate: Scenario;
    optimistic: Scenario;
  };
}

export default function BusinessBriefStrategy() {
  const [data, setData] = useState<StrategyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeScenario, setActiveScenario] = useState<'conservative' | 'moderate' | 'optimistic'>('moderate');

  // Scenario planner state
  const [scenarioInputs, setScenarioInputs] = useState({
    additionalCore: 0,
    additionalPro: 0,
    additionalPremium: 0,
    improvedCloseRate: 25
  });
  const [scenarioResult, setScenarioResult] = useState<any>(null);

  const fetchStrategy = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const response = await fetch('/api/admin/business-brief/strategy', {
        credentials: 'include'
      });
      const result = await response.json();

      if (result.success) {
        setData(result);
        setError(null);
      } else {
        setError(result.error || 'Failed to load strategy data');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStrategy();
    const interval = setInterval(() => fetchStrategy(false), 300000); // 5 min
    return () => clearInterval(interval);
  }, [fetchStrategy]);

  const calculateScenario = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/business-brief/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          operation: 'calculate_scenario',
          additionalClients: {
            core: scenarioInputs.additionalCore,
            professional: scenarioInputs.additionalPro,
            premium: scenarioInputs.additionalPremium
          },
          improvedCloseRate: scenarioInputs.improvedCloseRate,
          pipelineValue: data?.pipeline.pipelineValue || 0
        })
      });
      const result = await response.json();
      if (result.success) {
        setScenarioResult(result.scenario);
      }
    } catch (err) {
      console.error('Scenario calculation failed:', err);
    }
  }, [scenarioInputs, data?.pipeline.pipelineValue]);

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'on_track': return 'text-green-400 bg-green-500/20';
      case 'at_risk': return 'text-yellow-400 bg-yellow-500/20';
      case 'behind': return 'text-red-400 bg-red-500/20';
      case 'completed': return 'text-blue-400 bg-blue-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 75) return 'bg-green-500';
    if (percent >= 50) return 'bg-lime-500';
    if (percent >= 25) return 'bg-yellow-500';
    return 'bg-red-500';
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
        <h3 className="text-lg font-semibold text-white mb-2">Failed to Load Strategy</h3>
        <p className="text-gray-400 mb-4">{error}</p>
        <button
          onClick={() => fetchStrategy()}
          className="px-4 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { goals, supportPlanMix, lanes, pipeline, scenarios } = data;
  const primaryGoal = goals[0]; // $400K goal

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-white flex items-center gap-2">
            <Target className="w-6 h-6 text-amber-400" />
            Strategy & Planning
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Goals, targets, and business direction
          </p>
        </div>
        <button
          onClick={() => fetchStrategy(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* ========== PRIMARY GOAL ========== */}
      {primaryGoal && (
        <div className="admin-card overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-amber-500/10 to-transparent border-b border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-amber-400" />
                <h3 className="font-semibold text-white">Primary Goal</h3>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(primaryGoal.status)}`}>
                {primaryGoal.status.replace('_', ' ')}
              </span>
            </div>
          </div>

          <div className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center gap-6">
              {/* Progress Circle */}
              <div className="flex-shrink-0">
                <div className="relative w-32 h-32">
                  <svg className="w-32 h-32 transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="none"
                      className="text-gray-700"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="none"
                      strokeDasharray={`${primaryGoal.percentComplete * 3.52} 352`}
                      className="text-amber-500 transition-all duration-500"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-white">
                      {primaryGoal.percentComplete.toFixed(1)}%
                    </span>
                    <span className="text-xs text-gray-400">complete</span>
                  </div>
                </div>
              </div>

              {/* Goal Details */}
              <div className="flex-1">
                <h4 className="text-xl font-bold text-white mb-2">{primaryGoal.title}</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="text-sm text-gray-400">Current</div>
                    <div className="text-lg font-bold text-white">
                      {formatCurrency(primaryGoal.current_value)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Target</div>
                    <div className="text-lg font-bold text-amber-400">
                      {formatCurrency(primaryGoal.target_value)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Remaining</div>
                    <div className="text-lg font-bold text-white">
                      {formatCurrency(primaryGoal.remainingValue)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Days Left</div>
                    <div className="text-lg font-bold text-white flex items-center gap-1">
                      <Clock className="w-4 h-4 text-gray-500" />
                      {primaryGoal.daysRemaining || '—'}
                    </div>
                  </div>
                </div>

                {primaryGoal.requiredDailyRate && (
                  <div className="text-sm text-gray-400">
                    Required rate: <span className="text-amber-400 font-medium">
                      {formatCurrency(primaryGoal.requiredDailyRate)}/day
                    </span> to hit target
                  </div>
                )}
              </div>
            </div>

            {/* Milestones */}
            {primaryGoal.milestones.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-700">
                <h5 className="text-sm font-medium text-gray-400 mb-4">Milestones</h5>
                <div className="relative">
                  <div className="absolute left-0 top-3 w-full h-0.5 bg-gray-700" />
                  <div className="relative flex justify-between">
                    {primaryGoal.milestones.map((milestone, idx) => {
                      const isPast = milestone.targetDate * 1000 < Date.now();
                      const isAchieved = milestone.achieved;

                      return (
                        <div key={milestone.id} className="flex flex-col items-center">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 ${
                            isAchieved
                              ? 'bg-green-500 text-white'
                              : isPast
                              ? 'bg-red-500 text-white'
                              : 'bg-gray-700 text-gray-400'
                          }`}>
                            {isAchieved ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : (
                              <span className="text-xs">{idx + 1}</span>
                            )}
                          </div>
                          <div className="mt-2 text-center">
                            <div className="text-sm font-medium text-white">
                              {formatCurrency(milestone.targetValue)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(milestone.targetDate * 1000).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric'
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== SUPPORT PLAN MIX ========== */}
      <div className="admin-card overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-purple-500/10 to-transparent border-b border-gray-700">
          <div className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-purple-400" />
            <h3 className="font-semibold text-white">Support Plan Mix</h3>
          </div>
        </div>

        <div className="p-6">
          {/* MRR Summary */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-800/50 rounded-lg p-4 text-center">
              <div className="text-sm text-gray-400 mb-1">Current MRR</div>
              <div className="text-2xl font-bold text-white">{formatCurrency(supportPlanMix.mrr.current)}</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4 text-center">
              <div className="text-sm text-gray-400 mb-1">Target MRR</div>
              <div className="text-2xl font-bold text-amber-400">{formatCurrency(supportPlanMix.mrr.target)}</div>
            </div>
          </div>

          {/* Plan Breakdown */}
          <div className="space-y-4">
            {/* Core */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-white font-medium">Core</span>
                  <span className="text-gray-500 text-sm">($350/mo)</span>
                </div>
                <span className="text-white">
                  {supportPlanMix.current.core} / {supportPlanMix.target.core}
                </span>
              </div>
              <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${Math.min(parseInt(supportPlanMix.progress.core), 100)}%` }}
                />
              </div>
              <div className="text-right text-xs text-gray-500 mt-1">
                {formatCurrency(supportPlanMix.mrr.byTier.core)} MRR
              </div>
            </div>

            {/* Professional */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-purple-500" />
                  <span className="text-white font-medium">Professional</span>
                  <span className="text-gray-500 text-sm">($500/mo)</span>
                </div>
                <span className="text-white">
                  {supportPlanMix.current.professional} / {supportPlanMix.target.professional}
                </span>
              </div>
              <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all"
                  style={{ width: `${Math.min(parseInt(supportPlanMix.progress.professional), 100)}%` }}
                />
              </div>
              <div className="text-right text-xs text-gray-500 mt-1">
                {formatCurrency(supportPlanMix.mrr.byTier.professional)} MRR
              </div>
            </div>

            {/* Premium */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-white font-medium">Premium</span>
                  <span className="text-gray-500 text-sm">($800/mo)</span>
                </div>
                <span className="text-white">
                  {supportPlanMix.current.premium} / {supportPlanMix.target.premium}
                </span>
              </div>
              <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all"
                  style={{ width: `${Math.min(parseInt(supportPlanMix.progress.premium), 100)}%` }}
                />
              </div>
              <div className="text-right text-xs text-gray-500 mt-1">
                {formatCurrency(supportPlanMix.mrr.byTier.premium)} MRR
              </div>
            </div>
          </div>

          {/* Not on plan */}
          {supportPlanMix.current.none > 0 && (
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-400 text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>{supportPlanMix.current.none} clients not on a support plan</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========== LANE STRATEGY ========== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lane A */}
        <div className="admin-card overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-green-500/10 to-transparent border-b border-gray-700">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green-400" />
              <h3 className="font-semibold text-white">{lanes.a.name}</h3>
            </div>
          </div>

          <div className="p-4">
            <p className="text-gray-400 text-sm mb-4">{lanes.a.description}</p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-white">{lanes.a.clients}</div>
                <div className="text-xs text-gray-400">Clients</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-green-400">{formatCurrency(lanes.a.revenue30d)}</div>
                <div className="text-xs text-gray-400">30-Day Revenue</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-white">{formatNumber(lanes.a.leads.total)}</div>
                <div className="text-xs text-gray-400">Total Leads</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-amber-400">{lanes.a.leads.hot}</div>
                <div className="text-xs text-gray-400">Hot Leads</div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-gray-500 mb-2">Services</div>
              {lanes.a.services.map(service => (
                <div key={service} className="flex items-center gap-2 text-sm text-gray-300">
                  <ChevronRight className="w-3 h-3 text-green-400" />
                  {service}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Lane B */}
        <div className="admin-card overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-blue-500/10 to-transparent border-b border-gray-700">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold text-white">{lanes.b.name}</h3>
            </div>
          </div>

          <div className="p-4">
            <p className="text-gray-400 text-sm mb-4">{lanes.b.description}</p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-white">{lanes.b.clients}</div>
                <div className="text-xs text-gray-400">Clients</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-blue-400">{formatCurrency(lanes.b.revenue30d)}</div>
                <div className="text-xs text-gray-400">30-Day Revenue</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-white">{formatNumber(lanes.b.leads.total)}</div>
                <div className="text-xs text-gray-400">Total Leads</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-amber-400">{lanes.b.leads.hot}</div>
                <div className="text-xs text-gray-400">Hot Leads</div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-gray-500 mb-2">Services</div>
              {lanes.b.services.map(service => (
                <div key={service} className="flex items-center gap-2 text-sm text-gray-300">
                  <ChevronRight className="w-3 h-3 text-blue-400" />
                  {service}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ========== SCENARIO PLANNER ========== */}
      <div className="admin-card overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-amber-500/10 to-transparent border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-amber-400" />
            <h3 className="font-semibold text-white">Scenario Planner</h3>
          </div>
        </div>

        <div className="p-6">
          {/* Pipeline Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-white">{pipeline.activeQuotes}</div>
              <div className="text-xs text-gray-400">Active Quotes</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-amber-400">{formatCurrency(pipeline.pipelineValue)}</div>
              <div className="text-xs text-gray-400">Pipeline Value</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-green-400">{pipeline.closeRate}%</div>
              <div className="text-xs text-gray-400">Close Rate (30d)</div>
            </div>
          </div>

          {/* Preset Scenarios */}
          <div className="mb-6">
            <div className="text-sm text-gray-400 mb-3">Pipeline Projections</div>
            <div className="grid grid-cols-3 gap-3">
              {(['conservative', 'moderate', 'optimistic'] as const).map(key => {
                const scenario = scenarios[key];
                return (
                  <button
                    key={key}
                    onClick={() => setActiveScenario(key)}
                    className={`p-4 rounded-lg border transition-all ${
                      activeScenario === key
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="text-sm font-medium text-white mb-1">{scenario.label}</div>
                    <div className="text-lg font-bold text-amber-400">
                      {formatCurrency(scenario.projectedValue)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {scenario.assumedCloseRate}% close rate
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Scenario */}
          <div className="border-t border-gray-700 pt-6">
            <div className="text-sm text-gray-400 mb-4">What If Analysis</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">+ Core Clients</label>
                <input
                  type="number"
                  min="0"
                  value={scenarioInputs.additionalCore}
                  onChange={e => setScenarioInputs(prev => ({ ...prev, additionalCore: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">+ Pro Clients</label>
                <input
                  type="number"
                  min="0"
                  value={scenarioInputs.additionalPro}
                  onChange={e => setScenarioInputs(prev => ({ ...prev, additionalPro: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">+ Premium Clients</label>
                <input
                  type="number"
                  min="0"
                  value={scenarioInputs.additionalPremium}
                  onChange={e => setScenarioInputs(prev => ({ ...prev, additionalPremium: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Close Rate %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={scenarioInputs.improvedCloseRate}
                  onChange={e => setScenarioInputs(prev => ({ ...prev, improvedCloseRate: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                />
              </div>
            </div>

            <button
              onClick={calculateScenario}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400"
            >
              <Zap className="w-4 h-4" />
              Calculate Impact
            </button>

            {scenarioResult && (
              <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="text-sm text-green-400 font-medium mb-2">Projected 90-Day Impact</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs text-gray-400">Additional MRR</div>
                    <div className="text-lg font-bold text-white">{formatCurrency(scenarioResult.additionalMRR)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Additional ARR</div>
                    <div className="text-lg font-bold text-white">{formatCurrency(scenarioResult.additionalARR)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">From Pipeline</div>
                    <div className="text-lg font-bold text-white">{formatCurrency(scenarioResult.projectedPipelineConversion)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Total Impact</div>
                    <div className="text-lg font-bold text-green-400">{formatCurrency(scenarioResult.totalProjectedImpact)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
