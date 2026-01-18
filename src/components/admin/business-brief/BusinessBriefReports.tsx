import React, { useState, useEffect } from 'react';
import {
  FileText, TrendingUp, DollarSign, Heart, Mail, Brain, Headphones,
  Users, Target, Radio, Play, Clock, Download, Calendar, CheckCircle,
  AlertCircle, Loader2, RefreshCw, ChevronRight, BarChart3, Filter
} from 'lucide-react';

interface ReportDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  frequency: string;
  format: string;
  icon: string;
  estimatedTime: string;
  dataPoints: string[];
}

interface GeneratedReport {
  id: string;
  type: string;
  title: string;
  format: string;
  status: string;
  generatedAt: number;
  fileUrl?: string;
}

interface ReportStats {
  totalGenerated: number;
  successRate: number;
  scheduledActive: number;
  mostUsed: string | null;
}

interface ReportsData {
  library: ReportDefinition[];
  history: GeneratedReport[];
  scheduled: any[];
  stats: ReportStats;
}

const iconMap: { [key: string]: React.ReactNode } = {
  FileText: <FileText className="w-5 h-5" />,
  TrendingUp: <TrendingUp className="w-5 h-5" />,
  DollarSign: <DollarSign className="w-5 h-5" />,
  Heart: <Heart className="w-5 h-5" />,
  Mail: <Mail className="w-5 h-5" />,
  Brain: <Brain className="w-5 h-5" />,
  Headphones: <Headphones className="w-5 h-5" />,
  Users: <Users className="w-5 h-5" />,
  Target: <Target className="w-5 h-5" />,
  Radio: <Radio className="w-5 h-5" />
};

export default function BusinessBriefReports() {
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [generatedReport, setGeneratedReport] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'library' | 'history' | 'scheduled'>('library');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/business-brief/reports');
      const result = await response.json();
      if (result.success) {
        setData(result);
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async (reportType: string) => {
    setGenerating(reportType);
    setGeneratedReport(null);
    try {
      const response = await fetch('/api/admin/business-brief/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportType, format: 'dashboard' })
      });
      const result = await response.json();
      if (result.success) {
        setGeneratedReport(result.report);
        fetchReports(); // Refresh history
      }
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setGenerating(null);
    }
  };

  const categories = ['all', 'financial', 'sales', 'operations', 'marketing'];

  const filteredLibrary = data?.library.filter(r =>
    categoryFilter === 'all' || r.category === categoryFilter
  ) || [];

  if (loading) {
    return (
      <div className="admin-card p-8">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
          <span className="text-gray-400">Loading reports...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="admin-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <BarChart3 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{data?.stats.totalGenerated || 0}</p>
              <p className="text-xs text-gray-500">Generated (30d)</p>
            </div>
          </div>
        </div>

        <div className="admin-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{data?.stats.successRate || 100}%</p>
              <p className="text-xs text-gray-500">Success Rate</p>
            </div>
          </div>
        </div>

        <div className="admin-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Calendar className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{data?.stats.scheduledActive || 0}</p>
              <p className="text-xs text-gray-500">Scheduled</p>
            </div>
          </div>
        </div>

        <div className="admin-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <FileText className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{data?.library.length || 0}</p>
              <p className="text-xs text-gray-500">Available</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="admin-card p-2">
        <div className="flex gap-1">
          {[
            { id: 'library', label: 'Report Library', icon: <FileText className="w-4 h-4" /> },
            { id: 'history', label: 'History', icon: <Clock className="w-4 h-4" /> },
            { id: 'scheduled', label: 'Scheduled', icon: <Calendar className="w-4 h-4" /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
                transition-all duration-200
                ${activeTab === tab.id
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }
              `}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Library Tab */}
      {activeTab === 'library' && (
        <div className="space-y-4">
          {/* Category Filter */}
          <div className="admin-card p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-gray-500" />
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`
                    px-3 py-1 rounded-full text-xs font-medium transition-all
                    ${categoryFilter === cat
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                    }
                  `}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Report Cards */}
          <div className="grid md:grid-cols-2 gap-4">
            {filteredLibrary.map(report => (
              <div key={report.id} className="admin-card p-4 hover:border-gray-600 transition-colors">
                <div className="flex items-start gap-3">
                  <div className={`
                    p-2 rounded-lg
                    ${report.category === 'financial' ? 'bg-green-500/20 text-green-400' :
                      report.category === 'sales' ? 'bg-blue-500/20 text-blue-400' :
                      report.category === 'operations' ? 'bg-purple-500/20 text-purple-400' :
                      'bg-amber-500/20 text-amber-400'}
                  `}>
                    {iconMap[report.icon] || <FileText className="w-5 h-5" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium">{report.name}</h3>
                    <p className="text-sm text-gray-400 mt-1 line-clamp-2">{report.description}</p>

                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {report.estimatedTime}
                      </span>
                      <span className="px-2 py-0.5 bg-gray-800 rounded text-gray-400">
                        {report.frequency}
                      </span>
                      <span className="px-2 py-0.5 bg-gray-800 rounded text-gray-400">
                        {report.format}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => generateReport(report.id)}
                    disabled={generating === report.id}
                    className={`
                      p-2 rounded-lg transition-all
                      ${generating === report.id
                        ? 'bg-gray-700 text-gray-500'
                        : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                      }
                    `}
                  >
                    {generating === report.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Play className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="admin-card">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h3 className="font-medium text-white">Report History</h3>
            <button
              onClick={fetchReports}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {data?.history && data.history.length > 0 ? (
            <div className="divide-y divide-gray-700/50">
              {data.history.map(report => (
                <div key={report.id} className="p-4 flex items-center gap-4">
                  <div className={`
                    p-2 rounded-lg
                    ${report.status === 'completed' ? 'bg-green-500/20' : 'bg-red-500/20'}
                  `}>
                    {report.status === 'completed' ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium">{report.title}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(report.generatedAt * 1000).toLocaleString()}
                    </p>
                  </div>

                  <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">
                    {report.format}
                  </span>

                  {report.fileUrl && (
                    <a
                      href={report.fileUrl}
                      className="p-2 text-gray-400 hover:text-amber-400 rounded-lg hover:bg-gray-800"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No reports generated yet</p>
              <p className="text-sm mt-1">Generate a report from the library to see it here</p>
            </div>
          )}
        </div>
      )}

      {/* Scheduled Tab */}
      {activeTab === 'scheduled' && (
        <div className="admin-card">
          <div className="p-4 border-b border-gray-700">
            <h3 className="font-medium text-white">Scheduled Reports</h3>
          </div>

          {data?.scheduled && data.scheduled.length > 0 ? (
            <div className="divide-y divide-gray-700/50">
              {data.scheduled.map(report => (
                <div key={report.id} className="p-4 flex items-center gap-4">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Calendar className="w-4 h-4 text-purple-400" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium">{report.title}</p>
                    <p className="text-xs text-gray-500">
                      {report.frequency} - Next: {new Date(report.nextRunAt * 1000).toLocaleDateString()}
                    </p>
                  </div>

                  <span className={`
                    px-2 py-1 rounded text-xs
                    ${report.isActive
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-gray-700 text-gray-500'
                    }
                  `}>
                    {report.isActive ? 'Active' : 'Paused'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No scheduled reports</p>
              <p className="text-sm mt-1">Automated report scheduling coming soon</p>
            </div>
          )}
        </div>
      )}

      {/* Generated Report Preview */}
      {generatedReport && (
        <div className="admin-card">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <h3 className="font-medium text-white">{generatedReport.title}</h3>
            </div>
            <button
              onClick={() => setGeneratedReport(null)}
              className="text-gray-400 hover:text-white text-sm"
            >
              Dismiss
            </button>
          </div>

          <div className="p-4">
            {generatedReport.sections ? (
              <div className="grid md:grid-cols-2 gap-4">
                {generatedReport.sections.map((section: any, idx: number) => (
                  <div key={idx} className="bg-gray-800/50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-300 mb-3">{section.name}</h4>
                    {section.metrics ? (
                      <div className="space-y-2">
                        {section.metrics.map((metric: any, mIdx: number) => (
                          <div key={mIdx} className="flex items-center justify-between">
                            <span className="text-gray-400 text-sm">{metric.label}</span>
                            <span className={`font-medium ${metric.alert ? 'text-red-400' : 'text-white'}`}>
                              {metric.format === 'currency'
                                ? `$${metric.value.toLocaleString()}`
                                : metric.value.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : section.data ? (
                      <pre className="text-xs text-gray-400 overflow-auto">
                        {JSON.stringify(section.data, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : generatedReport.summary ? (
              <div className="grid md:grid-cols-4 gap-4">
                {Object.entries(generatedReport.summary).map(([key, value]: [string, any]) => (
                  <div key={key} className="bg-gray-800/50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-white">
                      {typeof value === 'number' ? value.toLocaleString() : value}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <pre className="text-sm text-gray-400 overflow-auto">
                {JSON.stringify(generatedReport, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
