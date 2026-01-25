import React, { useState, useEffect } from 'react';
import {
  BarChart3, Eye, Users, TrendingUp, Clock, Loader2, RefreshCw,
  ExternalLink, Globe, Mail, Share2
} from 'lucide-react';

interface AnalyticsData {
  period: string;
  summary: {
    total_views: number;
    unique_visitors: number;
    total_posts: number;
    published_posts: number;
    draft_posts: number;
    all_time_views: number;
  };
  top_articles: Array<{
    id: string;
    title: string;
    slug: string;
    category: string;
    view_count: number;
    published_at: number;
    period_views: number;
    unique_views: number;
    avg_time: number | null;
    avg_scroll: number | null;
  }>;
  referrer_breakdown: Array<{
    source: string;
    count: number;
  }>;
  daily_views: Array<{
    day: string;
    views: number;
    unique_views: number;
  }>;
}

const SOURCE_ICONS: Record<string, any> = {
  organic: Globe,
  social: Share2,
  campaign: Mail,
  referral: ExternalLink,
  direct: Users
};

const SOURCE_COLORS: Record<string, string> = {
  organic: '#34d399',
  social: '#60a5fa',
  campaign: '#a78bfa',
  referral: '#f59e0b',
  direct: '#6b7280'
};

export default function ContentAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/toast-hub/analytics?period=${period}`, { credentials: 'include' });
      const result = await res.json();
      if (result.success) setData(result.data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAnalytics(); }, [period]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 bg-gray-800/50 border border-gray-700 rounded-lg">
        <BarChart3 className="w-10 h-10 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400">No analytics data available</p>
      </div>
    );
  }

  const maxDailyViews = Math.max(...data.daily_views.map(d => d.views), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-amber-400" />
          Content Analytics
        </h3>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="text-sm bg-gray-800 border border-gray-700 text-white rounded px-3 py-1.5"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <button onClick={loadAnalytics} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard icon={Eye} label="Total Views" value={data.summary.total_views} color="#f59e0b" />
        <SummaryCard icon={Users} label="Unique Visitors" value={data.summary.unique_visitors} color="#60a5fa" />
        <SummaryCard icon={TrendingUp} label="Published Posts" value={data.summary.published_posts} color="#34d399" />
        <SummaryCard icon={Eye} label="All-Time Views" value={data.summary.all_time_views} color="#a78bfa" />
      </div>

      {/* Daily Views Chart */}
      {data.daily_views.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-300 mb-4">Daily Views</h4>
          <div className="flex items-end gap-1 h-32">
            {data.daily_views.map((day, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${day.day}: ${day.views} views`}>
                <div
                  className="w-full bg-amber-500/60 rounded-t hover:bg-amber-500 transition-colors"
                  style={{ height: `${(day.views / maxDailyViews) * 100}%`, minHeight: day.views > 0 ? '4px' : '0' }}
                />
                {i % Math.max(1, Math.floor(data.daily_views.length / 7)) === 0 && (
                  <span className="text-[9px] text-gray-500 whitespace-nowrap">
                    {new Date(day.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Articles */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-300 mb-3">Top Articles</h4>
          <div className="space-y-2">
            {data.top_articles.slice(0, 5).map((article, i) => (
              <div key={article.id} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-4">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{article.title}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{article.period_views} views</span>
                    {article.avg_time && (
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-3 h-3" />
                        {Math.round(article.avg_time)}s avg
                      </span>
                    )}
                    {article.avg_scroll && (
                      <span>{Math.round(article.avg_scroll)}% scroll</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {data.top_articles.length === 0 && (
              <p className="text-sm text-gray-500">No article data yet</p>
            )}
          </div>
        </div>

        {/* Traffic Sources */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-300 mb-3">Traffic Sources</h4>
          <div className="space-y-3">
            {data.referrer_breakdown.map(source => {
              const totalViews = data.referrer_breakdown.reduce((s, r) => s + r.count, 0) || 1;
              const pct = Math.round((source.count / totalViews) * 100);
              const Icon = SOURCE_ICONS[source.source] || Globe;
              const color = SOURCE_COLORS[source.source] || '#6b7280';
              return (
                <div key={source.source} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-gray-300 capitalize">
                      <Icon className="w-3 h-3" style={{ color }} />
                      {source.source}
                    </span>
                    <span className="text-gray-400">{source.count} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
            {data.referrer_breakdown.length === 0 && (
              <p className="text-sm text-gray-500">No traffic data yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" style={{ color }} />
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
    </div>
  );
}
