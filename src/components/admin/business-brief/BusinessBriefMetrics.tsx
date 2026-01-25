import React, { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, Minus, DollarSign, Users, Mail,
  Ticket, BarChart3, RefreshCw, Loader2, Camera, Calendar
} from 'lucide-react';

interface MetricSnapshot {
  id: string;
  snapshot_date: string;
  total_revenue: number;
  monthly_revenue: number;
  mrr: number;
  active_clients: number;
  active_subscriptions: number;
  total_pipeline_value: number;
  open_tickets: number;
  avg_csat: number | null;
  leads_contacted: number;
  leads_converted: number;
  emails_sent: number;
  emails_opened: number;
  portal_logins: number;
}

interface MetricCardData {
  label: string;
  currentValue: string | number;
  previousValue?: string | number;
  change?: number;
  icon: any;
  color: string;
}

function TrendBadge({ change }: { change?: number }) {
  if (change === undefined || change === 0) return <Minus className="w-3 h-3 text-gray-500" />;
  if (change > 0) return (
    <span className="flex items-center gap-0.5 text-green-400 text-xs">
      <TrendingUp className="w-3 h-3" />+{change.toFixed(1)}%
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 text-red-400 text-xs">
      <TrendingDown className="w-3 h-3" />{change.toFixed(1)}%
    </span>
  );
}

function MiniChart({ data, color = '#f59e0b' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 120;
  const height = 40;
  const padding = 2;

  const points = data.map((val, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((val - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="opacity-60">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        points={points}
      />
    </svg>
  );
}

export default function BusinessBriefMetrics() {
  const [snapshots, setSnapshots] = useState<MetricSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [days, setDays] = useState(30);

  const loadSnapshots = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/metrics/snapshots?days=${days}`, { credentials: 'include' });
      const data = await response.json();
      if (data.success) {
        setSnapshots(data.data);
      }
    } catch (err) {
      console.error('Failed to load metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  const captureSnapshot = async () => {
    setCapturing(true);
    try {
      const response = await fetch('/api/admin/metrics/snapshots', {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        loadSnapshots();
      }
    } catch (err) {
      console.error('Failed to capture snapshot:', err);
    } finally {
      setCapturing(false);
    }
  };

  useEffect(() => {
    loadSnapshots();
  }, [days]);

  const getChange = (field: keyof MetricSnapshot) => {
    if (snapshots.length < 2) return undefined;
    const current = snapshots[0][field] as number;
    const previous = snapshots[snapshots.length - 1][field] as number;
    if (!previous) return undefined;
    return ((current - previous) / previous) * 100;
  };

  const getSparkline = (field: keyof MetricSnapshot): number[] => {
    return [...snapshots].reverse().map(s => (s[field] as number) || 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
      </div>
    );
  }

  const latest = snapshots[0] || {} as MetricSnapshot;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Business Metrics</h3>
          <p className="text-sm text-gray-400">
            {snapshots.length} snapshots over {days} days
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={e => setDays(parseInt(e.target.value))}
            className="bg-gray-800 border border-gray-700 text-white text-sm rounded px-2 py-1.5"
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
          <button
            onClick={captureSnapshot}
            disabled={capturing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm disabled:opacity-50 transition-colors"
          >
            {capturing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            Capture Now
          </button>
        </div>
      </div>

      {snapshots.length === 0 ? (
        <div className="text-center py-12 bg-gray-800/50 border border-gray-700 rounded-lg">
          <BarChart3 className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 mb-2">No metrics snapshots yet</p>
          <p className="text-sm text-gray-500 mb-4">Capture your first snapshot to start tracking trends.</p>
          <button
            onClick={captureSnapshot}
            disabled={capturing}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm"
          >
            Capture First Snapshot
          </button>
        </div>
      ) : (
        <>
          {/* Metric Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Active Clients"
              value={latest.active_clients || 0}
              change={getChange('active_clients')}
              sparkline={getSparkline('active_clients')}
              icon={Users}
              color="#60a5fa"
            />
            <MetricCard
              label="Monthly Revenue"
              value={`$${(latest.monthly_revenue || 0).toLocaleString()}`}
              change={getChange('monthly_revenue')}
              sparkline={getSparkline('monthly_revenue')}
              icon={DollarSign}
              color="#34d399"
            />
            <MetricCard
              label="Pipeline Value"
              value={`$${(latest.total_pipeline_value || 0).toLocaleString()}`}
              change={getChange('total_pipeline_value')}
              sparkline={getSparkline('total_pipeline_value')}
              icon={TrendingUp}
              color="#a78bfa"
            />
            <MetricCard
              label="Open Tickets"
              value={latest.open_tickets || 0}
              change={getChange('open_tickets')}
              sparkline={getSparkline('open_tickets')}
              icon={Ticket}
              color="#f59e0b"
              invertTrend
            />
            <MetricCard
              label="Emails Sent"
              value={latest.emails_sent || 0}
              change={getChange('emails_sent')}
              sparkline={getSparkline('emails_sent')}
              icon={Mail}
              color="#ec4899"
            />
            <MetricCard
              label="Leads Contacted"
              value={latest.leads_contacted || 0}
              change={getChange('leads_contacted')}
              sparkline={getSparkline('leads_contacted')}
              icon={Users}
              color="#14b8a6"
            />
            <MetricCard
              label="Conversions"
              value={latest.leads_converted || 0}
              change={getChange('leads_converted')}
              sparkline={getSparkline('leads_converted')}
              icon={TrendingUp}
              color="#22c55e"
            />
            <MetricCard
              label="Avg CSAT"
              value={latest.avg_csat ? `${latest.avg_csat.toFixed(1)}/5` : 'N/A'}
              change={getChange('avg_csat')}
              sparkline={getSparkline('avg_csat')}
              icon={BarChart3}
              color="#f97316"
            />
          </div>

          {/* Snapshot History Table */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700">
              <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Snapshot History
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left text-xs text-gray-400 font-medium px-4 py-2">Date</th>
                    <th className="text-right text-xs text-gray-400 font-medium px-4 py-2">Clients</th>
                    <th className="text-right text-xs text-gray-400 font-medium px-4 py-2">Revenue</th>
                    <th className="text-right text-xs text-gray-400 font-medium px-4 py-2">Pipeline</th>
                    <th className="text-right text-xs text-gray-400 font-medium px-4 py-2">Tickets</th>
                    <th className="text-right text-xs text-gray-400 font-medium px-4 py-2">Emails</th>
                    <th className="text-right text-xs text-gray-400 font-medium px-4 py-2">Leads</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.slice(0, 14).map(snap => (
                    <tr key={snap.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="px-4 py-2 text-gray-300">{snap.snapshot_date}</td>
                      <td className="px-4 py-2 text-right text-white">{snap.active_clients}</td>
                      <td className="px-4 py-2 text-right text-green-400">${(snap.monthly_revenue || 0).toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-purple-400">${(snap.total_pipeline_value || 0).toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-amber-400">{snap.open_tickets}</td>
                      <td className="px-4 py-2 text-right text-gray-400">{snap.emails_sent}</td>
                      <td className="px-4 py-2 text-right text-gray-400">{snap.leads_contacted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Reusable Metric Card with sparkline
function MetricCard({ label, value, change, sparkline, icon: Icon, color, invertTrend = false }: {
  label: string;
  value: string | number;
  change?: number;
  sparkline: number[];
  icon: any;
  color: string;
  invertTrend?: boolean;
}) {
  const effectiveChange = invertTrend && change ? -change : change;

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-4 h-4" style={{ color }} />
        <TrendBadge change={effectiveChange} />
      </div>
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-xs text-gray-400 mb-2">{label}</p>
      <MiniChart data={sparkline} color={color} />
    </div>
  );
}
