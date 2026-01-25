import React, { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle,
  RefreshCw, Loader2, DollarSign, Clock, CreditCard, Calendar,
  Activity, Heart, Info
} from 'lucide-react';

interface HealthData {
  current: {
    overall_score: number;
    trend: 'improving' | 'stable' | 'declining';
    churn_risk: 'low' | 'medium' | 'high' | 'critical';
  };
  breakdown: {
    engagement_score: number;
    payment_score: number;
    satisfaction_score: number;
    activity_score: number;
    relationship_score: number;
  } | null;
  factors: {
    payment: { score: number; invoices_total: number; invoices_paid: number; invoices_overdue: number };
    engagement: { score: number; days_since_activity: number; recent_activity_count: number };
    revenue: { score: number; mrr: number; expected_mrr: number; plan: string | null };
    tenure: { score: number; days: number };
  } | null;
  history: Array<{
    overall_score: number;
    trend: string;
    calculated_at: number;
  }>;
  client: {
    mrr: number | null;
    plan: string | null;
    tenure_days: number;
    last_activity: number | null;
  };
}

interface Props {
  clientId: string;
}

const WEIGHTS = {
  payment: { weight: 30, label: 'Payment History', icon: CreditCard, description: 'On-time payment ratio' },
  engagement: { weight: 25, label: 'Engagement', icon: Activity, description: 'Contact recency & frequency' },
  revenue: { weight: 25, label: 'Revenue', icon: DollarSign, description: 'MRR vs plan benchmark' },
  tenure: { weight: 20, label: 'Tenure', icon: Calendar, description: 'Account age bonus' }
};

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const strokeWidth = size / 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getColor = (s: number) => {
    if (s >= 80) return '#22c55e'; // green-500
    if (s >= 60) return '#f59e0b'; // amber-500
    if (s >= 40) return '#f97316'; // orange-500
    return '#ef4444'; // red-500
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#374151"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor(score)}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-white">{score}</span>
        <span className="text-xs text-gray-400">/ 100</span>
      </div>
    </div>
  );
}

function FactorBar({ label, score, weight, icon: Icon, description }: {
  label: string;
  score: number;
  weight: number;
  icon: any;
  description: string;
}) {
  const getBarColor = (s: number) => {
    if (s >= 80) return 'bg-green-500';
    if (s >= 60) return 'bg-amber-500';
    if (s >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-300">{label}</span>
          <span className="text-xs text-gray-500">({weight}%)</span>
        </div>
        <span className="text-sm font-medium text-white">{score}</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${getBarColor(score)} rounded-full transition-all duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
}

function TrendBadge({ trend }: { trend: string }) {
  const config = {
    improving: { icon: TrendingUp, color: 'text-green-400 bg-green-500/10', label: 'Improving' },
    declining: { icon: TrendingDown, color: 'text-red-400 bg-red-500/10', label: 'Declining' },
    stable: { icon: Minus, color: 'text-gray-400 bg-gray-500/10', label: 'Stable' }
  };
  const c = config[trend as keyof typeof config] || config.stable;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${c.color}`}>
      <c.icon className="w-3 h-3" />
      {c.label}
    </span>
  );
}

function ChurnRiskBadge({ risk }: { risk: string }) {
  const config: Record<string, { color: string; icon: any; label: string }> = {
    low: { color: 'bg-green-500/20 text-green-400', icon: CheckCircle, label: 'Low Risk' },
    medium: { color: 'bg-amber-500/20 text-amber-400', icon: AlertTriangle, label: 'Medium Risk' },
    high: { color: 'bg-orange-500/20 text-orange-400', icon: AlertTriangle, label: 'High Risk' },
    critical: { color: 'bg-red-500/20 text-red-400', icon: AlertTriangle, label: 'Critical Risk' }
  };
  const c = config[risk] || config.low;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${c.color}`}>
      <c.icon className="w-3 h-3" />
      {c.label}
    </span>
  );
}

const ClientHealthScore: React.FC<Props> = ({ clientId }) => {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/clients/${clientId}/health`, { credentials: 'include' });
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to load health data');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const recalculateHealth = async () => {
    setRecalculating(true);
    try {
      const response = await fetch(`/api/admin/clients/${clientId}/health`, {
        method: 'POST',
        credentials: 'include'
      });
      const result = await response.json();
      if (result.success) {
        await loadHealth(); // Reload to get updated data
      }
    } catch (err) {
      console.error('Failed to recalculate:', err);
    } finally {
      setRecalculating(false);
    }
  };

  useEffect(() => {
    loadHealth();
  }, [clientId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-red-400 text-sm">{error || 'No data available'}</p>
        <button
          onClick={loadHealth}
          className="mt-4 text-amber-400 hover:underline text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  const { current, breakdown, factors, history, client } = data;

  return (
    <div className="space-y-6">
      {/* Header with recalculate button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Heart className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-medium text-white">Health Score</h3>
        </div>
        <button
          onClick={recalculateHealth}
          disabled={recalculating}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 text-sm transition-colors disabled:opacity-50"
        >
          {recalculating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Recalculate
        </button>
      </div>

      {/* Main Score Display */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
        <div className="flex flex-col md:flex-row items-center gap-8">
          {/* Score Ring */}
          <div className="flex flex-col items-center">
            <ScoreRing score={current.overall_score} />
            <div className="flex items-center gap-3 mt-4">
              <TrendBadge trend={current.trend} />
              <ChurnRiskBadge risk={current.churn_risk} />
            </div>
          </div>

          {/* Factor Breakdown */}
          <div className="flex-1 w-full space-y-4">
            <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Score Breakdown</h4>
            {factors ? (
              <>
                <FactorBar
                  label={WEIGHTS.payment.label}
                  score={factors.payment.score}
                  weight={WEIGHTS.payment.weight}
                  icon={WEIGHTS.payment.icon}
                  description={`${factors.payment.invoices_paid}/${factors.payment.invoices_total} invoices paid on time`}
                />
                <FactorBar
                  label={WEIGHTS.engagement.label}
                  score={factors.engagement.score}
                  weight={WEIGHTS.engagement.weight}
                  icon={WEIGHTS.engagement.icon}
                  description={`${factors.engagement.days_since_activity} days since last activity`}
                />
                <FactorBar
                  label={WEIGHTS.revenue.label}
                  score={factors.revenue.score}
                  weight={WEIGHTS.revenue.weight}
                  icon={WEIGHTS.revenue.icon}
                  description={`$${factors.revenue.mrr}/mo vs $${factors.revenue.expected_mrr}/mo expected`}
                />
                <FactorBar
                  label={WEIGHTS.tenure.label}
                  score={factors.tenure.score}
                  weight={WEIGHTS.tenure.weight}
                  icon={WEIGHTS.tenure.icon}
                  description={`Client for ${factors.tenure.days} days`}
                />
              </>
            ) : (
              <div className="text-center py-4">
                <Info className="w-6 h-6 text-gray-500 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No breakdown available. Click Recalculate to generate.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-center">
          <DollarSign className="w-4 h-4 text-green-400 mx-auto mb-1" />
          <p className="text-xs text-gray-400">MRR</p>
          <p className="text-lg font-bold text-white">${client.mrr || 0}</p>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-center">
          <Calendar className="w-4 h-4 text-blue-400 mx-auto mb-1" />
          <p className="text-xs text-gray-400">Tenure</p>
          <p className="text-lg font-bold text-white">{client.tenure_days} days</p>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-center">
          <Clock className="w-4 h-4 text-amber-400 mx-auto mb-1" />
          <p className="text-xs text-gray-400">Last Activity</p>
          <p className="text-lg font-bold text-white">
            {client.last_activity
              ? `${Math.floor((Date.now() / 1000 - client.last_activity) / 86400)}d ago`
              : 'Never'}
          </p>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-center">
          <Activity className="w-4 h-4 text-purple-400 mx-auto mb-1" />
          <p className="text-xs text-gray-400">Plan</p>
          <p className="text-lg font-bold text-white capitalize">{client.plan || 'None'}</p>
        </div>
      </div>

      {/* History Chart (Simple) */}
      {history.length > 1 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-400 mb-3">Score History (Last 30 Days)</h4>
          <div className="flex items-end gap-1 h-24">
            {history.slice().reverse().map((h, i) => {
              const height = `${h.overall_score}%`;
              const getColor = (s: number) => {
                if (s >= 80) return 'bg-green-500';
                if (s >= 60) return 'bg-amber-500';
                if (s >= 40) return 'bg-orange-500';
                return 'bg-red-500';
              };
              return (
                <div
                  key={i}
                  className="flex-1 min-w-[4px] max-w-[12px]"
                  title={`${h.overall_score} - ${new Date(h.calculated_at * 1000).toLocaleDateString()}`}
                >
                  <div
                    className={`${getColor(h.overall_score)} rounded-t transition-all hover:opacity-80`}
                    style={{ height }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>{history.length > 0 ? new Date(history[history.length - 1].calculated_at * 1000).toLocaleDateString() : ''}</span>
            <span>Today</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientHealthScore;
