import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock, Calendar, Sun, Moon, MapPin, Users, TrendingUp,
  Settings, Save, RefreshCw, Loader2, AlertCircle, ChevronDown,
  ChevronRight, Info, Pause, Play, BarChart3, Zap, Globe,
  Filter, Eye, X, CheckCircle, Coffee, Building2
} from 'lucide-react';

// TypeScript Interfaces
interface HeatmapData {
  hour: number;
  day: number;
  open_rate: number;
  total_sent: number;
}

interface OptimalTimeSlot {
  hour: number;
  day: number;
  day_name: string;
  open_rate: number;
  confidence: 'high' | 'medium' | 'low';
}

interface SegmentInsight {
  segment: string;
  segment_label: string;
  best_times: OptimalTimeSlot[];
  avg_open_rate: number;
  sample_size: number;
}

interface SendTimeConfig {
  id?: string;
  sequence_id: string | null;
  mode: 'fixed' | 'optimal' | 'subscriber_timezone' | 'custom';
  fixed_time?: string;
  fixed_days?: number[];
  timezone?: string;
  custom_schedule?: CustomScheduleSlot[];
  created_at?: number;
  updated_at?: number;
}

interface CustomScheduleSlot {
  day: number;
  times: string[];
}

interface QuietHoursConfig {
  enabled: boolean;
  start_hour: number;
  end_hour: number;
  skip_weekends: boolean;
  weekend_start_hour?: number;
  weekend_end_hour?: number;
  holidays: string[];
}

interface QueuedEmail {
  id: string;
  subscriber_email: string;
  subscriber_name: string;
  sequence_name: string;
  step_subject: string;
  scheduled_at: number;
  estimated_open_rate?: number;
}

interface QueueStats {
  next_24h: number;
  next_7d: number;
  hourly_distribution: { hour: number; count: number }[];
}

type ViewMode = 'analysis' | 'configuration' | 'queue';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' },
  { value: 'UTC', label: 'UTC' }
];

const SendTimeOptimizer: React.FC = () => {
  // View state
  const [activeView, setActiveView] = useState<ViewMode>('analysis');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Analysis data
  const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([]);
  const [optimalTimes, setOptimalTimes] = useState<OptimalTimeSlot[]>([]);
  const [segmentInsights, setSegmentInsights] = useState<SegmentInsight[]>([]);
  const [selectedSegmentFilter, setSelectedSegmentFilter] = useState<string>('all');

  // Configuration data
  const [sequences, setSequences] = useState<{ id: string; name: string }[]>([]);
  const [selectedSequence, setSelectedSequence] = useState<string>('_global');
  const [sendTimeConfig, setSendTimeConfig] = useState<SendTimeConfig>({
    sequence_id: null,
    mode: 'optimal',
    timezone: 'America/New_York',
    fixed_days: [1, 2, 3, 4, 5]
  });
  const [quietHours, setQuietHours] = useState<QuietHoursConfig>({
    enabled: true,
    start_hour: 22,
    end_hour: 8,
    skip_weekends: false,
    holidays: []
  });

  // Queue data
  const [queuedEmails, setQueuedEmails] = useState<QueuedEmail[]>([]);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [queueTimeframe, setQueueTimeframe] = useState<'24h' | '7d'>('24h');

  // UI state
  const [expandedSections, setExpandedSections] = useState<string[]>(['best-times', 'heatmap']);
  const [showScheduleGrid, setShowScheduleGrid] = useState(false);

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  // Load analysis data
  const loadAnalysisData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (selectedSegmentFilter !== 'all') {
        params.append('segment', selectedSegmentFilter);
      }

      const [analysisRes, segmentRes] = await Promise.all([
        fetch(`/api/admin/email/send-times/analysis?${params}`),
        fetch('/api/admin/email/send-times/analysis?by_segment=true')
      ]);

      const analysisData = await analysisRes.json();
      const segmentData = await segmentRes.json();

      if (analysisData.success) {
        setHeatmapData(analysisData.data.heatmap_data || []);
        setOptimalTimes(analysisData.data.overall_best_times || []);
      }

      if (segmentData.success) {
        setSegmentInsights(segmentData.data.by_segment || []);
      }
    } catch (err) {
      console.error('Failed to load analysis data:', err);
      setError('Failed to load send time analysis');
    } finally {
      setIsLoading(false);
    }
  }, [selectedSegmentFilter]);

  // Load configuration data
  const loadConfigData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const seqId = selectedSequence === '_global' ? '' : selectedSequence;
      const params = new URLSearchParams();
      if (seqId) params.append('sequence_id', seqId);

      const [configRes, quietRes, seqRes] = await Promise.all([
        fetch(`/api/admin/email/send-times/config?${params}`),
        fetch('/api/admin/email/send-times/quiet-hours'),
        fetch('/api/admin/email/sequences')
      ]);

      const configData = await configRes.json();
      const quietData = await quietRes.json();
      const seqData = await seqRes.json();

      if (configData.success && configData.data) {
        setSendTimeConfig({
          sequence_id: seqId || null,
          mode: configData.data.mode || 'optimal',
          fixed_time: configData.data.fixed_time,
          fixed_days: configData.data.fixed_days || [1, 2, 3, 4, 5],
          timezone: configData.data.timezone || 'America/New_York',
          custom_schedule: configData.data.custom_schedule
        });
      }

      if (quietData.success && quietData.data) {
        setQuietHours(quietData.data);
      }

      if (seqData.success) {
        setSequences(seqData.data || []);
      }
    } catch (err) {
      console.error('Failed to load config data:', err);
      setError('Failed to load configuration');
    } finally {
      setIsLoading(false);
    }
  }, [selectedSequence]);

  // Load queue data
  const loadQueueData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const hours = queueTimeframe === '24h' ? 24 : 168;
      const response = await fetch(`/api/admin/email/send-times/queue?hours=${hours}`);
      const data = await response.json();

      if (data.success) {
        setQueuedEmails(data.data.emails || []);
        setQueueStats(data.data.stats || null);
      }
    } catch (err) {
      console.error('Failed to load queue data:', err);
      setError('Failed to load send queue');
    } finally {
      setIsLoading(false);
    }
  }, [queueTimeframe]);

  // Save configuration
  const saveConfiguration = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/admin/email/send-times/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sendTimeConfig)
      });

      const result = await response.json();

      if (result.success) {
        setSuccessMessage('Send time configuration saved successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(result.error || 'Failed to save configuration');
      }
    } catch (err) {
      setError('Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  // Save quiet hours
  const saveQuietHours = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/admin/email/send-times/quiet-hours', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quietHours)
      });

      const result = await response.json();

      if (result.success) {
        setSuccessMessage('Quiet hours saved successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(result.error || 'Failed to save quiet hours');
      }
    } catch (err) {
      setError('Failed to save quiet hours');
    } finally {
      setIsSaving(false);
    }
  };

  // Load data on view change
  useEffect(() => {
    if (activeView === 'analysis') {
      loadAnalysisData();
    } else if (activeView === 'configuration') {
      loadConfigData();
    } else if (activeView === 'queue') {
      loadQueueData();
    }
  }, [activeView, loadAnalysisData, loadConfigData, loadQueueData]);

  // Helper to format hour
  const formatHour = (hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  };

  // Helper to get heatmap cell color
  const getHeatmapColor = (openRate: number, maxRate: number) => {
    if (openRate === 0 || maxRate === 0) return 'bg-gray-800';
    const intensity = openRate / maxRate;
    if (intensity >= 0.8) return 'bg-green-500';
    if (intensity >= 0.6) return 'bg-green-600/80';
    if (intensity >= 0.4) return 'bg-amber-500/70';
    if (intensity >= 0.2) return 'bg-amber-600/50';
    return 'bg-gray-700';
  };

  // Generate heatmap matrix (7 days x 24 hours)
  const generateHeatmapMatrix = () => {
    const matrix: (HeatmapData | null)[][] = Array(7).fill(null).map(() => Array(24).fill(null));
    const maxRate = Math.max(...heatmapData.map(d => d.open_rate), 1);

    heatmapData.forEach(data => {
      if (data.day >= 0 && data.day < 7 && data.hour >= 0 && data.hour < 24) {
        matrix[data.day][data.hour] = data;
      }
    });

    return { matrix, maxRate };
  };

  // Render heatmap
  const HeatmapVisualization: React.FC = () => {
    const { matrix, maxRate } = generateHeatmapMatrix();

    return (
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Hour labels */}
          <div className="flex mb-2 pl-16">
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className={`flex-1 text-center text-xs ${
                  h % 3 === 0 ? 'text-gray-400' : 'text-transparent'
                }`}
              >
                {formatHour(h)}
              </div>
            ))}
          </div>

          {/* Heatmap grid */}
          <div className="space-y-1">
            {matrix.map((row, dayIndex) => (
              <div key={dayIndex} className="flex items-center gap-1">
                <div className="w-14 text-xs text-gray-400 text-right pr-2">
                  {SHORT_DAYS[dayIndex]}
                </div>
                <div className="flex-1 flex gap-px">
                  {row.map((cell, hourIndex) => (
                    <div
                      key={hourIndex}
                      className={`flex-1 h-6 rounded-sm ${
                        cell ? getHeatmapColor(cell.open_rate, maxRate) : 'bg-gray-800'
                      } transition-all duration-200 hover:ring-2 hover:ring-white/50 cursor-pointer group relative`}
                      title={cell ? `${DAYS[dayIndex]} ${formatHour(hourIndex)}: ${cell.open_rate.toFixed(1)}% open rate (${cell.total_sent} sent)` : 'No data'}
                    >
                      {/* Tooltip on hover */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        {cell ? (
                          <>
                            <div className="font-medium">{DAYS[dayIndex]} {formatHour(hourIndex)}</div>
                            <div className="text-green-400">{cell.open_rate.toFixed(1)}% open rate</div>
                            <div className="text-gray-400">{cell.total_sent} emails sent</div>
                          </>
                        ) : (
                          'No data'
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-4 text-xs text-gray-400">
            <span>Low engagement</span>
            <div className="flex gap-1">
              <div className="w-4 h-4 bg-gray-700 rounded"></div>
              <div className="w-4 h-4 bg-amber-600/50 rounded"></div>
              <div className="w-4 h-4 bg-amber-500/70 rounded"></div>
              <div className="w-4 h-4 bg-green-600/80 rounded"></div>
              <div className="w-4 h-4 bg-green-500 rounded"></div>
            </div>
            <span>High engagement</span>
          </div>
        </div>
      </div>
    );
  };

  // Render analysis view
  const renderAnalysisView = () => (
    <div className="space-y-6">
      {/* Segment Filter */}
      <div className="admin-card p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-gray-400">
            <Filter className="w-4 h-4" />
            <span className="text-sm">Filter by segment:</span>
          </div>
          <select
            value={selectedSegmentFilter}
            onChange={(e) => setSelectedSegmentFilter(e.target.value)}
            className="px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">All Subscribers</option>
            <optgroup label="Geographic">
              <option value="geo_cape_cod">Cape Cod</option>
              <option value="geo_ma">Massachusetts</option>
              <option value="geo_national">National</option>
            </optgroup>
            <optgroup label="POS System">
              <option value="pos_toast">Toast</option>
              <option value="pos_clover">Clover</option>
              <option value="pos_square">Square</option>
            </optgroup>
            <optgroup label="Engagement">
              <option value="engagement_high">High Engagement</option>
              <option value="engagement_medium">Medium Engagement</option>
              <option value="engagement_low">Low Engagement</option>
            </optgroup>
          </select>
          <button
            onClick={loadAnalysisData}
            disabled={isLoading}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Best Times Section */}
      <div className="admin-card">
        <button
          onClick={() => toggleSection('best-times')}
          className="w-full p-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-green-400" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-white">Best Send Times</h3>
              <p className="text-sm text-gray-400">Top performing time slots based on open rates</p>
            </div>
          </div>
          {expandedSections.includes('best-times') ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {expandedSections.includes('best-times') && (
          <div className="p-4 border-t border-gray-700">
            {optimalTimes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Not enough data to determine optimal send times</p>
                <p className="text-sm mt-1">Send more emails to build engagement patterns</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {optimalTimes.slice(0, 5).map((slot, index) => (
                  <div
                    key={`${slot.day}-${slot.hour}`}
                    className={`p-4 rounded-lg border ${
                      index === 0
                        ? 'bg-green-500/10 border-green-500/30'
                        : 'bg-gray-800/50 border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        index === 0 ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'
                      }`}>
                        #{index + 1}
                      </span>
                      <span className={`text-xs ${
                        slot.confidence === 'high' ? 'text-green-400' :
                        slot.confidence === 'medium' ? 'text-amber-400' : 'text-gray-400'
                      }`}>
                        {slot.confidence} confidence
                      </span>
                    </div>
                    <p className="text-lg font-bold text-white">{slot.day_name}</p>
                    <p className="text-amber-400 font-medium">{formatHour(slot.hour)}</p>
                    <p className="text-sm text-gray-400 mt-2">
                      {slot.open_rate.toFixed(1)}% open rate
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Heatmap Section */}
      <div className="admin-card">
        <button
          onClick={() => toggleSection('heatmap')}
          className="w-full p-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-white">Engagement Heatmap</h3>
              <p className="text-sm text-gray-400">Open rates by day and hour</p>
            </div>
          </div>
          {expandedSections.includes('heatmap') ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {expandedSections.includes('heatmap') && (
          <div className="p-4 border-t border-gray-700">
            {heatmapData.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No heatmap data available</p>
                <p className="text-sm mt-1">Data will appear as emails are sent and tracked</p>
              </div>
            ) : (
              <HeatmapVisualization />
            )}
          </div>
        )}
      </div>

      {/* Segment Insights Section */}
      <div className="admin-card">
        <button
          onClick={() => toggleSection('segments')}
          className="w-full p-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-white">Audience Insights</h3>
              <p className="text-sm text-gray-400">Best times by geographic, POS, and engagement segments</p>
            </div>
          </div>
          {expandedSections.includes('segments') ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {expandedSections.includes('segments') && (
          <div className="p-4 border-t border-gray-700">
            {segmentInsights.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No segment insights available</p>
                <p className="text-sm mt-1">Segment data requires tagged subscribers</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Geographic Insights */}
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    By Geographic Region
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {segmentInsights
                      .filter(s => s.segment.startsWith('geo_'))
                      .map(segment => (
                        <SegmentCard key={segment.segment} segment={segment} />
                      ))}
                  </div>
                </div>

                {/* POS Insights */}
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    By POS System
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {segmentInsights
                      .filter(s => s.segment.startsWith('pos_'))
                      .map(segment => (
                        <SegmentCard key={segment.segment} segment={segment} />
                      ))}
                  </div>
                </div>

                {/* Engagement Insights */}
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    By Engagement Level
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {segmentInsights
                      .filter(s => s.segment.startsWith('engagement_'))
                      .map(segment => (
                        <SegmentCard key={segment.segment} segment={segment} />
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Segment insight card
  const SegmentCard: React.FC<{ segment: SegmentInsight }> = ({ segment }) => (
    <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-white">{segment.segment_label}</span>
        <span className="text-xs text-gray-400">{segment.sample_size} emails</span>
      </div>
      <div className="text-sm text-gray-400 mb-2">
        Avg open rate: <span className="text-green-400">{segment.avg_open_rate.toFixed(1)}%</span>
      </div>
      {segment.best_times.length > 0 && (
        <div className="text-xs text-gray-500">
          Best time: <span className="text-amber-400">
            {segment.best_times[0].day_name} {formatHour(segment.best_times[0].hour)}
          </span>
        </div>
      )}
    </div>
  );

  // Render configuration view
  const renderConfigurationView = () => (
    <div className="space-y-6">
      {/* Sequence Selector */}
      <div className="admin-card p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-gray-400">
            <Settings className="w-4 h-4" />
            <span className="text-sm">Configure for:</span>
          </div>
          <select
            value={selectedSequence}
            onChange={(e) => setSelectedSequence(e.target.value)}
            className="flex-1 max-w-md px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="_global">Global Default (All Sequences)</option>
            {sequences.map(seq => (
              <option key={seq.id} value={seq.id}>{seq.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Send Time Mode */}
      <div className="admin-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-400" />
          Send Time Mode
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Fixed Time */}
          <button
            onClick={() => setSendTimeConfig(prev => ({ ...prev, mode: 'fixed' }))}
            className={`p-4 rounded-lg border text-left transition-all ${
              sendTimeConfig.mode === 'fixed'
                ? 'bg-amber-500/10 border-amber-500/50 ring-2 ring-amber-500/30'
                : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                sendTimeConfig.mode === 'fixed' ? 'bg-amber-500/20' : 'bg-gray-700'
              }`}>
                <Clock className={`w-4 h-4 ${sendTimeConfig.mode === 'fixed' ? 'text-amber-400' : 'text-gray-400'}`} />
              </div>
              <span className="font-medium text-white">Fixed Time</span>
            </div>
            <p className="text-sm text-gray-400">
              Send at a specific time every day (timezone-aware)
            </p>
          </button>

          {/* Optimal Time */}
          <button
            onClick={() => setSendTimeConfig(prev => ({ ...prev, mode: 'optimal' }))}
            className={`p-4 rounded-lg border text-left transition-all ${
              sendTimeConfig.mode === 'optimal'
                ? 'bg-green-500/10 border-green-500/50 ring-2 ring-green-500/30'
                : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                sendTimeConfig.mode === 'optimal' ? 'bg-green-500/20' : 'bg-gray-700'
              }`}>
                <Zap className={`w-4 h-4 ${sendTimeConfig.mode === 'optimal' ? 'text-green-400' : 'text-gray-400'}`} />
              </div>
              <span className="font-medium text-white">Optimal Time</span>
              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">Recommended</span>
            </div>
            <p className="text-sm text-gray-400">
              Let the system choose based on engagement data
            </p>
          </button>

          {/* Subscriber Timezone */}
          <button
            onClick={() => setSendTimeConfig(prev => ({ ...prev, mode: 'subscriber_timezone' }))}
            className={`p-4 rounded-lg border text-left transition-all ${
              sendTimeConfig.mode === 'subscriber_timezone'
                ? 'bg-blue-500/10 border-blue-500/50 ring-2 ring-blue-500/30'
                : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                sendTimeConfig.mode === 'subscriber_timezone' ? 'bg-blue-500/20' : 'bg-gray-700'
              }`}>
                <Globe className={`w-4 h-4 ${sendTimeConfig.mode === 'subscriber_timezone' ? 'text-blue-400' : 'text-gray-400'}`} />
              </div>
              <span className="font-medium text-white">Subscriber Timezone</span>
            </div>
            <p className="text-sm text-gray-400">
              Send at the same local time in each subscriber's timezone
            </p>
          </button>

          {/* Custom Schedule */}
          <button
            onClick={() => {
              setSendTimeConfig(prev => ({ ...prev, mode: 'custom' }));
              setShowScheduleGrid(true);
            }}
            className={`p-4 rounded-lg border text-left transition-all ${
              sendTimeConfig.mode === 'custom'
                ? 'bg-purple-500/10 border-purple-500/50 ring-2 ring-purple-500/30'
                : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                sendTimeConfig.mode === 'custom' ? 'bg-purple-500/20' : 'bg-gray-700'
              }`}>
                <Calendar className={`w-4 h-4 ${sendTimeConfig.mode === 'custom' ? 'text-purple-400' : 'text-gray-400'}`} />
              </div>
              <span className="font-medium text-white">Custom Schedule</span>
            </div>
            <p className="text-sm text-gray-400">
              Define specific days and times manually
            </p>
          </button>
        </div>

        {/* Mode-specific settings */}
        {sendTimeConfig.mode === 'fixed' && (
          <div className="mt-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Send Time</label>
                <input
                  type="time"
                  value={sendTimeConfig.fixed_time || '09:00'}
                  onChange={(e) => setSendTimeConfig(prev => ({ ...prev, fixed_time: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Timezone</label>
                <select
                  value={sendTimeConfig.timezone || 'America/New_York'}
                  onChange={(e) => setSendTimeConfig(prev => ({ ...prev, timezone: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {TIMEZONES.map(tz => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Send Days</label>
                <div className="flex gap-1">
                  {SHORT_DAYS.map((day, index) => (
                    <button
                      key={day}
                      onClick={() => {
                        const days = sendTimeConfig.fixed_days || [];
                        if (days.includes(index)) {
                          setSendTimeConfig(prev => ({
                            ...prev,
                            fixed_days: days.filter(d => d !== index)
                          }));
                        } else {
                          setSendTimeConfig(prev => ({
                            ...prev,
                            fixed_days: [...days, index].sort()
                          }));
                        }
                      }}
                      className={`flex-1 py-2 text-xs font-medium rounded transition-colors ${
                        (sendTimeConfig.fixed_days || []).includes(index)
                          ? 'bg-amber-500 text-white'
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      }`}
                    >
                      {day.charAt(0)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {sendTimeConfig.mode === 'subscriber_timezone' && (
          <div className="mt-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
              <Info className="w-4 h-4" />
              Emails will be sent at the following time in each subscriber's local timezone
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Local Send Time</label>
                <input
                  type="time"
                  value={sendTimeConfig.fixed_time || '09:00'}
                  onChange={(e) => setSendTimeConfig(prev => ({ ...prev, fixed_time: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Fallback Timezone</label>
                <select
                  value={sendTimeConfig.timezone || 'America/New_York'}
                  onChange={(e) => setSendTimeConfig(prev => ({ ...prev, timezone: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {TIMEZONES.map(tz => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Used when subscriber timezone is unknown</p>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={saveConfiguration}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Configuration
          </button>
        </div>
      </div>

      {/* Quiet Hours */}
      <div className="admin-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Moon className="w-5 h-5 text-blue-400" />
          Quiet Hours
        </h3>

        <div className="space-y-4">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Enable Quiet Hours</p>
              <p className="text-sm text-gray-400">Prevent emails from being sent during specified hours</p>
            </div>
            <button
              onClick={() => setQuietHours(prev => ({ ...prev, enabled: !prev.enabled }))}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                quietHours.enabled ? 'bg-amber-500' : 'bg-gray-600'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${
                quietHours.enabled ? 'left-6' : 'left-0.5'
              }`} />
            </button>
          </div>

          {quietHours.enabled && (
            <>
              {/* Time range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
                    <Moon className="w-4 h-4" /> Quiet starts at
                  </label>
                  <select
                    value={quietHours.start_hour}
                    onChange={(e) => setQuietHours(prev => ({ ...prev, start_hour: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>{formatHour(h)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
                    <Sun className="w-4 h-4" /> Quiet ends at
                  </label>
                  <select
                    value={quietHours.end_hour}
                    onChange={(e) => setQuietHours(prev => ({ ...prev, end_hour: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>{formatHour(h)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Visual representation */}
              <div className="p-4 bg-gray-800/50 rounded-lg">
                <p className="text-sm text-gray-400 mb-2">Quiet hours visualization (24h)</p>
                <div className="flex h-8 rounded overflow-hidden">
                  {Array.from({ length: 24 }, (_, h) => {
                    const isQuiet = quietHours.start_hour > quietHours.end_hour
                      ? (h >= quietHours.start_hour || h < quietHours.end_hour)
                      : (h >= quietHours.start_hour && h < quietHours.end_hour);
                    return (
                      <div
                        key={h}
                        className={`flex-1 ${isQuiet ? 'bg-blue-600/50' : 'bg-green-600/50'}`}
                        title={`${formatHour(h)}: ${isQuiet ? 'Quiet' : 'Active'}`}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between mt-1 text-xs text-gray-500">
                  <span>12 AM</span>
                  <span>6 AM</span>
                  <span>12 PM</span>
                  <span>6 PM</span>
                  <span>12 AM</span>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-green-600/50 rounded"></div>
                    <span className="text-gray-400">Active (can send)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-blue-600/50 rounded"></div>
                    <span className="text-gray-400">Quiet (no sending)</span>
                  </div>
                </div>
              </div>

              {/* Weekend handling */}
              <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                <div>
                  <p className="text-white font-medium">Skip Weekends</p>
                  <p className="text-sm text-gray-400">Don't send any emails on Saturday or Sunday</p>
                </div>
                <button
                  onClick={() => setQuietHours(prev => ({ ...prev, skip_weekends: !prev.skip_weekends }))}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    quietHours.skip_weekends ? 'bg-amber-500' : 'bg-gray-600'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${
                    quietHours.skip_weekends ? 'left-6' : 'left-0.5'
                  }`} />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Save Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={saveQuietHours}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Quiet Hours
          </button>
        </div>
      </div>
    </div>
  );

  // Render queue view
  const renderQueueView = () => (
    <div className="space-y-6">
      {/* Queue Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="admin-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{queueStats?.next_24h || 0}</p>
              <p className="text-xs text-gray-400">Next 24 hours</p>
            </div>
          </div>
        </div>
        <div className="admin-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{queueStats?.next_7d || 0}</p>
              <p className="text-xs text-gray-400">Next 7 days</p>
            </div>
          </div>
        </div>
        <div className="admin-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Timeframe:</span>
            <div className="flex gap-1">
              <button
                onClick={() => setQueueTimeframe('24h')}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  queueTimeframe === '24h'
                    ? 'bg-amber-500 text-white'
                    : 'bg-gray-700 text-gray-400 hover:text-white'
                }`}
              >
                24h
              </button>
              <button
                onClick={() => setQueueTimeframe('7d')}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  queueTimeframe === '7d'
                    ? 'bg-amber-500 text-white'
                    : 'bg-gray-700 text-gray-400 hover:text-white'
                }`}
              >
                7 days
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hourly Distribution Chart */}
      {queueStats?.hourly_distribution && queueStats.hourly_distribution.length > 0 && (
        <div className="admin-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Send Distribution</h3>
          <div className="h-32">
            <div className="flex items-end justify-between h-full gap-1">
              {queueStats.hourly_distribution.map((item, index) => {
                const maxCount = Math.max(...queueStats.hourly_distribution.map(d => d.count), 1);
                const height = (item.count / maxCount) * 100;
                return (
                  <div
                    key={index}
                    className="flex-1 flex flex-col items-center justify-end"
                  >
                    <div
                      className="w-full bg-amber-500/60 rounded-t hover:bg-amber-500 transition-colors"
                      style={{ height: `${Math.max(height, 2)}%` }}
                      title={`${formatHour(item.hour)}: ${item.count} emails`}
                    />
                    {index % 4 === 0 && (
                      <span className="text-xs text-gray-500 mt-1">
                        {formatHour(item.hour).replace(' ', '')}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Queue List */}
      <div className="admin-card">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Eye className="w-5 h-5 text-gray-400" />
            Upcoming Sends
          </h3>
          <button
            onClick={loadQueueData}
            disabled={isLoading}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {queuedEmails.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Coffee className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No emails scheduled in this timeframe</p>
            <p className="text-sm mt-1">Queue will populate as sequences process</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700/50">
            {queuedEmails.map(email => (
              <div key={email.id} className="p-4 hover:bg-gray-800/30 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{email.step_subject}</p>
                    <p className="text-sm text-gray-400 truncate">
                      To: {email.subscriber_name || email.subscriber_email}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Sequence: {email.sequence_name}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm text-amber-400">
                      {new Date(email.scheduled_at * 1000).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </p>
                    <p className="text-sm text-white font-medium">
                      {new Date(email.scheduled_at * 1000).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </p>
                    {email.estimated_open_rate !== undefined && (
                      <p className="text-xs text-gray-500 mt-1">
                        Est. {email.estimated_open_rate.toFixed(0)}% open
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // Loading skeleton
  if (isLoading && !heatmapData.length && !queuedEmails.length) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-64 bg-gray-700 rounded animate-pulse"></div>
          <div className="flex gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 w-24 bg-gray-700 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
        <div className="admin-card p-6">
          <div className="h-64 bg-gray-700/30 rounded animate-pulse"></div>
        </div>
        <div className="admin-card p-6">
          <div className="h-48 bg-gray-700/30 rounded animate-pulse"></div>
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
            <Clock className="w-5 h-5 text-amber-400" />
            Send Time Optimizer
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Optimize email delivery times for maximum engagement
          </p>
        </div>

        {/* View Tabs */}
        <div className="flex bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setActiveView('analysis')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeView === 'analysis'
                ? 'bg-amber-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4 inline mr-2" />
            Analysis
          </button>
          <button
            onClick={() => setActiveView('configuration')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeView === 'configuration'
                ? 'bg-amber-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            Configuration
          </button>
          <button
            onClick={() => setActiveView('queue')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeView === 'queue'
                ? 'bg-amber-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Eye className="w-4 h-4 inline mr-2" />
            Queue
          </button>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
          <p className="text-green-400 text-sm">{successMessage}</p>
          <button
            onClick={() => setSuccessMessage(null)}
            className="ml-auto text-green-400 hover:text-green-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* View Content */}
      {activeView === 'analysis' && renderAnalysisView()}
      {activeView === 'configuration' && renderConfigurationView()}
      {activeView === 'queue' && renderQueueView()}
    </div>
  );
};

export default SendTimeOptimizer;
