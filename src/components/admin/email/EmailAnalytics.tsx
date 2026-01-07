import React, { useState, useEffect, useCallback } from 'react';
import {
  Mail, Check, Eye, MousePointer, XCircle, UserMinus,
  TrendingUp, TrendingDown, RefreshCw, Download, Calendar,
  Loader2, AlertCircle, ChevronDown, BarChart3, Filter
} from 'lucide-react';

// TypeScript Interfaces
interface AnalyticsTotals {
  total_sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  open_rate: number;
  click_rate: number;
  bounce_rate: number;
  unsub_rate: number;
}

interface TrendData {
  total_sent: number;
  open_rate: number;
  click_rate: number;
  bounce_rate: number;
}

interface TimeSeriesPoint {
  date: string;
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
}

interface FunnelData {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  converted: number;
  delivery_rate: number;
  open_rate: number;
  click_rate: number;
  conversion_rate: number;
}

interface TopContent {
  step_id: string;
  subject: string;
  sent: number;
  opened: number;
  clicked: number;
  open_rate: number;
  click_rate: number;
}

interface EmailSequence {
  id: string;
  name: string;
}

type DateRangeOption = '7d' | '30d' | '90d' | 'custom';
type Granularity = 'day' | 'week' | 'month';

const EmailAnalytics: React.FC = () => {
  // State
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sequences, setSequences] = useState<EmailSequence[]>([]);
  const [selectedSequence, setSelectedSequence] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRangeOption>('30d');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Data state
  const [totals, setTotals] = useState<AnalyticsTotals | null>(null);
  const [previousTotals, setPreviousTotals] = useState<TrendData | null>(null);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([]);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [topContent, setTopContent] = useState<TopContent[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  // Chart hover state
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  // Calculate date range
  const getDateRange = useCallback(() => {
    const end = new Date();
    let start = new Date();

    switch (dateRange) {
      case '7d':
        start.setDate(end.getDate() - 7);
        break;
      case '30d':
        start.setDate(end.getDate() - 30);
        break;
      case '90d':
        start.setDate(end.getDate() - 90);
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          return {
            start_date: customStartDate,
            end_date: customEndDate
          };
        }
        start.setDate(end.getDate() - 30);
        break;
    }

    return {
      start_date: start.toISOString().split('T')[0],
      end_date: end.toISOString().split('T')[0]
    };
  }, [dateRange, customStartDate, customEndDate]);

  // Load sequences for dropdown
  const loadSequences = async () => {
    try {
      const response = await fetch('/api/admin/email/sequences');
      const result = await response.json();
      if (result.success) {
        setSequences(result.data || []);
      }
    } catch (err) {
      console.error('Failed to load sequences:', err);
    }
  };

  // Load analytics data
  const loadAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { start_date, end_date } = getDateRange();
      const params = new URLSearchParams({
        start_date,
        end_date
      });

      if (selectedSequence !== 'all') {
        params.append('sequence_id', selectedSequence);
      }

      // Fetch all data in parallel
      const [analyticsRes, timeseriesRes, funnelRes, topContentRes] = await Promise.all([
        fetch(`/api/admin/email/analytics?${params}`),
        fetch(`/api/admin/email/analytics/timeseries?${params}&granularity=day`),
        fetch(`/api/admin/email/analytics/funnel?${params}`),
        fetch(`/api/admin/email/analytics/top-content?${params}&limit=5`)
      ]);

      const [analyticsData, timeseriesData, funnelData, topContentData] = await Promise.all([
        analyticsRes.json(),
        timeseriesRes.json(),
        funnelRes.json(),
        topContentRes.json()
      ]);

      if (analyticsData.success) {
        setTotals(analyticsData.data.current);
        setPreviousTotals(analyticsData.data.previous);
      }

      if (timeseriesData.success) {
        setTimeSeries(timeseriesData.data || []);
      }

      if (funnelData.success) {
        setFunnel(funnelData.data);
      }

      if (topContentData.success) {
        setTopContent(topContentData.data || []);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setError('Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  }, [getDateRange, selectedSequence]);

  // Export to CSV
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { start_date, end_date } = getDateRange();
      const params = new URLSearchParams({
        start_date,
        end_date
      });

      if (selectedSequence !== 'all') {
        params.append('sequence_id', selectedSequence);
      }

      const response = await fetch(`/api/admin/email/analytics/export?${params}`);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `email_analytics_${start_date}_${end_date}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const result = await response.json();
        setError(result.error || 'Export failed');
      }
    } catch (err) {
      setError('Failed to export analytics');
    } finally {
      setIsExporting(false);
    }
  };

  // Load data on mount and when filters change
  useEffect(() => {
    loadSequences();
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Helper functions
  const formatNumber = (num: number | undefined | null) => {
    if (num === undefined || num === null) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  const formatPercent = (num: number | undefined | null) => {
    if (num === undefined || num === null) return '0%';
    return `${num.toFixed(1)}%`;
  };

  const calculateTrend = (current: number, previous: number) => {
    if (!previous || previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  const getTrendColor = (trend: number, isNegativeBad: boolean = true) => {
    if (trend === 0) return 'text-gray-400';
    if (isNegativeBad) {
      return trend > 0 ? 'text-green-400' : 'text-red-400';
    }
    return trend < 0 ? 'text-green-400' : 'text-red-400';
  };

  const getDateRangeLabel = () => {
    switch (dateRange) {
      case '7d': return 'Last 7 days';
      case '30d': return 'Last 30 days';
      case '90d': return 'Last 90 days';
      case 'custom': return customStartDate && customEndDate
        ? `${customStartDate} - ${customEndDate}`
        : 'Custom range';
      default: return 'Last 30 days';
    }
  };

  // Metric card component
  const MetricCard: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: number | undefined | null;
    rate?: number | undefined | null;
    previousValue?: number | undefined | null;
    isPercentage?: boolean;
    isNegativeBad?: boolean;
    accentColor?: string;
  }> = ({ icon, label, value, rate, previousValue, isPercentage = false, isNegativeBad = true, accentColor = 'amber' }) => {
    const trend = previousValue !== undefined && previousValue !== null
      ? calculateTrend(value || 0, previousValue)
      : 0;

    const colorClasses: Record<string, string> = {
      amber: 'bg-amber-500/20 text-amber-400',
      green: 'bg-green-500/20 text-green-400',
      blue: 'bg-blue-500/20 text-blue-400',
      red: 'bg-red-500/20 text-red-400',
      purple: 'bg-purple-500/20 text-purple-400'
    };

    return (
      <div className="admin-card p-4">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[accentColor]}`}>
            {icon}
          </div>
          {trend !== 0 && (
            <div className={`flex items-center gap-1 text-xs ${getTrendColor(trend, isNegativeBad)}`}>
              {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(trend).toFixed(1)}%
            </div>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-2xl font-bold text-white">
            {isPercentage ? formatPercent(value) : formatNumber(value)}
          </p>
          {rate !== undefined && rate !== null && (
            <p className="text-sm text-gray-400">
              {formatPercent(rate)} rate
            </p>
          )}
          <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
        </div>
      </div>
    );
  };

  // SVG Chart component
  const TimeSeriesChart: React.FC = () => {
    if (timeSeries.length === 0) {
      return (
        <div className="h-64 flex items-center justify-center text-gray-500">
          No data available for selected period
        </div>
      );
    }

    const width = 800;
    const height = 256;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Calculate scales
    const maxSent = Math.max(...timeSeries.map(d => d.sent), 1);
    const maxEngagement = Math.max(...timeSeries.map(d => Math.max(d.opened, d.clicked)), 1);
    const maxY = Math.max(maxSent, maxEngagement);

    const xScale = (i: number) => padding.left + (i / (timeSeries.length - 1 || 1)) * chartWidth;
    const yScale = (v: number) => padding.top + chartHeight - (v / maxY) * chartHeight;

    // Generate paths
    const generateLinePath = (data: number[]) => {
      return data
        .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(v)}`)
        .join(' ');
    };

    const sentPath = generateLinePath(timeSeries.map(d => d.sent));
    const openedPath = generateLinePath(timeSeries.map(d => d.opened));
    const clickedPath = generateLinePath(timeSeries.map(d => d.clicked));

    // Generate bars for sent
    const barWidth = Math.max(4, chartWidth / timeSeries.length - 4);

    return (
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-64"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
            <g key={i}>
              <line
                x1={padding.left}
                y1={padding.top + chartHeight * (1 - ratio)}
                x2={padding.left + chartWidth}
                y2={padding.top + chartHeight * (1 - ratio)}
                stroke="#374151"
                strokeDasharray="4"
              />
              <text
                x={padding.left - 10}
                y={padding.top + chartHeight * (1 - ratio) + 4}
                fill="#6B7280"
                fontSize="10"
                textAnchor="end"
              >
                {formatNumber(maxY * ratio)}
              </text>
            </g>
          ))}

          {/* Bars for sent */}
          {timeSeries.map((d, i) => (
            <rect
              key={`bar-${i}`}
              x={xScale(i) - barWidth / 2}
              y={yScale(d.sent)}
              width={barWidth}
              height={chartHeight - (yScale(d.sent) - padding.top)}
              fill={hoveredPoint === i ? '#F59E0B' : '#78350F'}
              opacity={hoveredPoint === i ? 0.8 : 0.4}
              rx="2"
              className="transition-all duration-150"
            />
          ))}

          {/* Lines for opens and clicks */}
          <path
            d={openedPath}
            fill="none"
            stroke="#10B981"
            strokeWidth="2"
          />
          <path
            d={clickedPath}
            fill="none"
            stroke="#3B82F6"
            strokeWidth="2"
          />

          {/* Data points */}
          {timeSeries.map((d, i) => (
            <g key={`points-${i}`}>
              <circle
                cx={xScale(i)}
                cy={yScale(d.opened)}
                r={hoveredPoint === i ? 5 : 3}
                fill="#10B981"
                className="transition-all duration-150"
              />
              <circle
                cx={xScale(i)}
                cy={yScale(d.clicked)}
                r={hoveredPoint === i ? 5 : 3}
                fill="#3B82F6"
                className="transition-all duration-150"
              />
            </g>
          ))}

          {/* X-axis labels */}
          {timeSeries.map((d, i) => {
            // Only show every nth label to avoid crowding
            const showLabel = timeSeries.length <= 7 || i % Math.ceil(timeSeries.length / 7) === 0;
            if (!showLabel) return null;

            const date = new Date(d.date);
            const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            return (
              <text
                key={`label-${i}`}
                x={xScale(i)}
                y={height - 10}
                fill="#6B7280"
                fontSize="10"
                textAnchor="middle"
              >
                {label}
              </text>
            );
          })}

          {/* Invisible hover areas */}
          {timeSeries.map((d, i) => (
            <rect
              key={`hover-${i}`}
              x={xScale(i) - chartWidth / timeSeries.length / 2}
              y={padding.top}
              width={chartWidth / timeSeries.length}
              height={chartHeight}
              fill="transparent"
              onMouseEnter={() => setHoveredPoint(i)}
              onMouseLeave={() => setHoveredPoint(null)}
              className="cursor-pointer"
            />
          ))}
        </svg>

        {/* Tooltip */}
        {hoveredPoint !== null && timeSeries[hoveredPoint] && (
          <div
            className="absolute bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg z-10 pointer-events-none"
            style={{
              left: `${(hoveredPoint / (timeSeries.length - 1 || 1)) * 100}%`,
              top: '10px',
              transform: 'translateX(-50%)'
            }}
          >
            <p className="text-white text-sm font-medium mb-2">
              {new Date(timeSeries[hoveredPoint].date).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
              })}
            </p>
            <div className="space-y-1 text-xs">
              <p className="flex items-center gap-2">
                <span className="w-2 h-2 bg-amber-600 rounded-full"></span>
                <span className="text-gray-400">Sent:</span>
                <span className="text-white font-medium">{timeSeries[hoveredPoint].sent}</span>
              </p>
              <p className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span className="text-gray-400">Opened:</span>
                <span className="text-white font-medium">{timeSeries[hoveredPoint].opened}</span>
              </p>
              <p className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                <span className="text-gray-400">Clicked:</span>
                <span className="text-white font-medium">{timeSeries[hoveredPoint].clicked}</span>
              </p>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-amber-600/40 rounded"></span>
            <span className="text-xs text-gray-400">Sent</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-green-500 rounded-full"></span>
            <span className="text-xs text-gray-400">Opened</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
            <span className="text-xs text-gray-400">Clicked</span>
          </div>
        </div>
      </div>
    );
  };

  // Funnel visualization component
  const FunnelVisualization: React.FC = () => {
    if (!funnel) {
      return (
        <div className="h-48 flex items-center justify-center text-gray-500">
          No funnel data available
        </div>
      );
    }

    const stages = [
      { label: 'Sent', value: funnel.sent, color: 'bg-amber-500' },
      { label: 'Delivered', value: funnel.delivered, rate: funnel.delivery_rate, color: 'bg-green-500' },
      { label: 'Opened', value: funnel.opened, rate: funnel.open_rate, color: 'bg-blue-500' },
      { label: 'Clicked', value: funnel.clicked, rate: funnel.click_rate, color: 'bg-purple-500' },
      { label: 'Converted', value: funnel.converted, rate: funnel.conversion_rate, color: 'bg-pink-500' }
    ];

    const maxValue = Math.max(...stages.map(s => s.value), 1);

    return (
      <div className="space-y-3">
        {stages.map((stage, i) => {
          const widthPercent = (stage.value / maxValue) * 100;
          const previousStage = i > 0 ? stages[i - 1] : null;
          const dropoff = previousStage && previousStage.value > 0
            ? ((previousStage.value - stage.value) / previousStage.value * 100).toFixed(1)
            : null;

          return (
            <div key={stage.label} className="relative">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-300">{stage.label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-white font-medium">
                    {formatNumber(stage.value)}
                  </span>
                  {stage.rate !== undefined && (
                    <span className="text-xs text-gray-400">
                      ({formatPercent(stage.rate)})
                    </span>
                  )}
                  {dropoff && parseFloat(dropoff) > 0 && (
                    <span className="text-xs text-red-400">
                      -{dropoff}%
                    </span>
                  )}
                </div>
              </div>
              <div className="h-8 bg-gray-800 rounded-lg overflow-hidden">
                <div
                  className={`h-full ${stage.color} transition-all duration-500 rounded-lg flex items-center justify-end pr-2`}
                  style={{ width: `${widthPercent}%` }}
                >
                  {widthPercent > 15 && (
                    <span className="text-xs text-white/80 font-medium">
                      {widthPercent.toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Loading skeleton
  if (isLoading && !totals) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-gray-700 rounded animate-pulse"></div>
          <div className="flex gap-2">
            <div className="h-10 w-32 bg-gray-700 rounded animate-pulse"></div>
            <div className="h-10 w-32 bg-gray-700 rounded animate-pulse"></div>
          </div>
        </div>

        {/* Metrics skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="admin-card p-4">
              <div className="h-10 w-10 bg-gray-700 rounded-lg animate-pulse mb-3"></div>
              <div className="h-8 w-20 bg-gray-700 rounded animate-pulse mb-2"></div>
              <div className="h-4 w-16 bg-gray-700 rounded animate-pulse"></div>
            </div>
          ))}
        </div>

        {/* Chart skeleton */}
        <div className="admin-card p-6">
          <div className="h-64 bg-gray-700/30 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-400" />
            Email Analytics
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {getDateRangeLabel()}
            {selectedSequence !== 'all' && sequences.find(s => s.id === selectedSequence) && (
              <span className="text-amber-400 ml-2">
                - {sequences.find(s => s.id === selectedSequence)?.name}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadAnalytics()}
            disabled={isLoading}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export CSV
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="admin-card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Campaign Selector */}
          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-1">Campaign</label>
            <select
              value={selectedSequence}
              onChange={(e) => setSelectedSequence(e.target.value)}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">All Campaigns</option>
              {sequences.map(seq => (
                <option key={seq.id} value={seq.id}>{seq.name}</option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="relative">
            <label className="block text-xs text-gray-400 mb-1">Date Range</label>
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white hover:border-gray-500 transition-colors"
            >
              <Calendar className="w-4 h-4 text-gray-400" />
              {getDateRangeLabel()}
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            {showDatePicker && (
              <div className="absolute top-full mt-2 right-0 bg-gray-800 border border-gray-700 rounded-lg p-4 shadow-xl z-20 min-w-[250px]">
                <div className="space-y-2 mb-4">
                  {(['7d', '30d', '90d'] as DateRangeOption[]).map(option => (
                    <button
                      key={option}
                      onClick={() => {
                        setDateRange(option);
                        setShowDatePicker(false);
                      }}
                      className={`w-full px-3 py-2 text-left rounded transition-colors ${
                        dateRange === option
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {option === '7d' ? 'Last 7 days' : option === '30d' ? 'Last 30 days' : 'Last 90 days'}
                    </button>
                  ))}
                </div>

                <div className="border-t border-gray-700 pt-4">
                  <p className="text-xs text-gray-400 mb-2">Custom Range</p>
                  <div className="space-y-2">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      onClick={() => {
                        if (customStartDate && customEndDate) {
                          setDateRange('custom');
                          setShowDatePicker(false);
                        }
                      }}
                      disabled={!customStartDate || !customEndDate}
                      className="w-full px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 disabled:text-gray-400 text-white font-medium rounded transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard
          icon={<Mail className="w-5 h-5" />}
          label="Total Sent"
          value={totals?.total_sent}
          previousValue={previousTotals?.total_sent}
          accentColor="amber"
        />
        <MetricCard
          icon={<Check className="w-5 h-5" />}
          label="Delivered"
          value={totals?.delivered}
          accentColor="green"
        />
        <MetricCard
          icon={<Eye className="w-5 h-5" />}
          label="Opened"
          value={totals?.opened}
          rate={totals?.open_rate}
          previousValue={previousTotals?.open_rate}
          accentColor="blue"
        />
        <MetricCard
          icon={<MousePointer className="w-5 h-5" />}
          label="Clicked"
          value={totals?.clicked}
          rate={totals?.click_rate}
          previousValue={previousTotals?.click_rate}
          accentColor="purple"
        />
        <MetricCard
          icon={<XCircle className="w-5 h-5" />}
          label="Bounced"
          value={totals?.bounced}
          rate={totals?.bounce_rate}
          previousValue={previousTotals?.bounce_rate}
          isNegativeBad={false}
          accentColor="red"
        />
        <MetricCard
          icon={<UserMinus className="w-5 h-5" />}
          label="Unsubscribed"
          value={totals?.unsubscribed}
          rate={totals?.unsub_rate}
          isNegativeBad={false}
          accentColor="red"
        />
      </div>

      {/* Time Series Chart */}
      <div className="admin-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Email Performance Over Time</h3>
        </div>
        <TimeSeriesChart />
      </div>

      {/* Bottom Section - Funnel and Top Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel Visualization */}
        <div className="admin-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Email Funnel</h3>
          <FunnelVisualization />
        </div>

        {/* Top Performing Content */}
        <div className="admin-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Top Performing Content</h3>
          {topContent.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-500">
              No content data available
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Subject</th>
                    <th className="pb-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Sent</th>
                    <th className="pb-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Open Rate</th>
                    <th className="pb-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Click Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {topContent.map((content, i) => (
                    <tr key={content.step_id} className="hover:bg-gray-800/30">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 flex items-center justify-center bg-amber-500/20 text-amber-400 text-xs font-medium rounded">
                            {i + 1}
                          </span>
                          <span className="text-white text-sm truncate max-w-[200px]" title={content.subject}>
                            {content.subject}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 text-right text-gray-300 text-sm">
                        {formatNumber(content.sent)}
                      </td>
                      <td className="py-3 text-right">
                        <span className={`text-sm font-medium ${
                          content.open_rate >= 30 ? 'text-green-400' :
                          content.open_rate >= 20 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {formatPercent(content.open_rate)}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <span className={`text-sm font-medium ${
                          content.click_rate >= 5 ? 'text-green-400' :
                          content.click_rate >= 2 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {formatPercent(content.click_rate)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailAnalytics;
