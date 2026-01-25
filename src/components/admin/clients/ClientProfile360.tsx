import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, User, Building, Mail, Phone, Globe, MapPin,
  TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle,
  Clock, DollarSign, Ticket, FolderOpen, MessageSquare,
  FileText, Star, Activity, StickyNote, Handshake,
  Loader2, RefreshCw, ExternalLink
} from 'lucide-react';
import ClientNotes from './ClientNotes';
import ClientActivityTimeline from './ClientActivityTimeline';
import ClientDealPipeline from './ClientDealPipeline';

// ============================================
// TYPES
// ============================================
interface Client360Data {
  client: any;
  tickets: { items: any[]; stats: any };
  projects: any[];
  deals: any[];
  recentActivity: any[];
  notes: any[];
  healthHistory: any[];
  reps: any[];
  satisfaction: any;
  revenue: any;
  summary: {
    health_score: number;
    health_trend: string;
    churn_risk: string;
    open_tickets: number;
    active_projects: number;
    open_deals: number;
    total_revenue: number;
    avg_csat: number | null;
  };
}

interface Props {
  clientId: string;
  onBack: () => void;
  onEditClient: (client: any) => void;
}

type TabId = 'overview' | 'activity' | 'deals' | 'notes' | 'tickets' | 'projects';

// ============================================
// HEALTH SCORE GAUGE
// ============================================
function HealthScoreGauge({ score, trend, size = 'lg' }: { score: number; trend: string; size?: 'sm' | 'lg' }) {
  const getColor = (s: number) => {
    if (s >= 80) return 'text-green-400';
    if (s >= 60) return 'text-amber-400';
    if (s >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const getBgColor = (s: number) => {
    if (s >= 80) return 'bg-green-500/20';
    if (s >= 60) return 'bg-amber-500/20';
    if (s >= 40) return 'bg-orange-500/20';
    return 'bg-red-500/20';
  };

  const TrendIcon = trend === 'improving' ? TrendingUp : trend === 'declining' ? TrendingDown : Minus;
  const trendColor = trend === 'improving' ? 'text-green-400' : trend === 'declining' ? 'text-red-400' : 'text-gray-400';

  if (size === 'sm') {
    return (
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${getBgColor(score)}`}>
        <span className={`text-sm font-bold ${getColor(score)}`}>{score}</span>
        <TrendIcon className={`w-3 h-3 ${trendColor}`} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className={`w-20 h-20 rounded-full ${getBgColor(score)} flex items-center justify-center`}>
        <span className={`text-2xl font-bold ${getColor(score)}`}>{score}</span>
      </div>
      <div className={`flex items-center gap-1 mt-1 ${trendColor}`}>
        <TrendIcon className="w-3 h-3" />
        <span className="text-xs capitalize">{trend}</span>
      </div>
    </div>
  );
}

// ============================================
// METRIC CARD
// ============================================
function MetricCard({ icon: Icon, label, value, sublabel, color = 'amber' }: { icon: any; label: string; value: string | number; sublabel?: string; color?: string }) {
  const colorMap: Record<string, string> = {
    amber: 'text-amber-400 bg-amber-500/10',
    green: 'text-green-400 bg-green-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
    red: 'text-red-400 bg-red-500/10',
    purple: 'text-purple-400 bg-purple-500/10'
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-gray-400">{label}</p>
          <p className="text-lg font-bold text-white">{value}</p>
          {sublabel && <p className="text-xs text-gray-500">{sublabel}</p>}
        </div>
      </div>
    </div>
  );
}

// ============================================
// CHURN RISK BADGE
// ============================================
function ChurnRiskBadge({ risk }: { risk: string }) {
  const config: Record<string, { color: string; label: string }> = {
    low: { color: 'bg-green-500/20 text-green-400', label: 'Low Risk' },
    medium: { color: 'bg-amber-500/20 text-amber-400', label: 'Medium Risk' },
    high: { color: 'bg-orange-500/20 text-orange-400', label: 'High Risk' },
    critical: { color: 'bg-red-500/20 text-red-400', label: 'Critical Risk' }
  };
  const c = config[risk] || config.low;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.color}`}>
      {c.label}
    </span>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================
const ClientProfile360: React.FC<Props> = ({ clientId, onBack, onEditClient }) => {
  const [data, setData] = useState<Client360Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/clients/${clientId}/overview`, { credentials: 'include' });
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to load client data');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [clientId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-red-400">{error || 'No data available'}</p>
        <button onClick={onBack} className="mt-4 text-amber-400 hover:underline">Go back</button>
      </div>
    );
  }

  const { client, summary } = data;

  const tabs: { id: TabId; label: string; icon: any; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'activity', label: 'Activity', icon: Clock },
    { id: 'deals', label: 'Deals', icon: Handshake, count: summary.open_deals },
    { id: 'notes', label: 'Notes', icon: StickyNote, count: data.notes.length },
    { id: 'tickets', label: 'Tickets', icon: Ticket, count: summary.open_tickets },
    { id: 'projects', label: 'Projects', icon: FolderOpen, count: summary.active_projects },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <button onClick={onBack} className="mt-1 p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{client.name}</h2>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Building className="w-3.5 h-3.5" />
                  <span>{client.company || 'No company'}</span>
                  {client.email && (
                    <>
                      <span className="text-gray-600">|</span>
                      <Mail className="w-3.5 h-3.5" />
                      <span>{client.email}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-2 ml-16">
              <HealthScoreGauge score={summary.health_score} trend={summary.health_trend} size="sm" />
              <ChurnRiskBadge risk={summary.churn_risk} />
              {client.support_plan_tier && (
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium capitalize">
                  {client.support_plan_tier} Plan
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={loadData} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEditClient(client)}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 text-sm transition-colors"
          >
            Edit Client
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-gray-700 rounded text-xs">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard icon={DollarSign} label="Total Revenue" value={`$${(summary.total_revenue || 0).toLocaleString()}`} color="green" />
            <MetricCard icon={Ticket} label="Open Tickets" value={summary.open_tickets} color={summary.open_tickets > 3 ? 'red' : 'amber'} />
            <MetricCard icon={Handshake} label="Open Deals" value={summary.open_deals} color="purple" />
            <MetricCard icon={Star} label="Avg CSAT" value={summary.avg_csat ? `${summary.avg_csat.toFixed(1)}/5` : 'N/A'} color="blue" />
          </div>

          {/* Two Column Layout */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left: Health Score + Reps */}
            <div className="space-y-4">
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Health Score</h3>
                <div className="flex items-center justify-center">
                  <HealthScoreGauge score={summary.health_score} trend={summary.health_trend} />
                </div>
                {data.healthHistory.length > 0 && (
                  <div className="mt-3 flex items-center justify-center gap-4 text-xs text-gray-500">
                    <span>30-day history: {data.healthHistory.length} snapshots</span>
                  </div>
                )}
              </div>

              {/* Assigned Reps */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Assigned Reps</h3>
                {data.reps.length === 0 ? (
                  <p className="text-sm text-gray-500">No reps assigned</p>
                ) : (
                  <div className="space-y-2">
                    {data.reps.map((rep: any) => (
                      <div key={rep.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-blue-500/20 rounded-full flex items-center justify-center">
                            <User className="w-3.5 h-3.5 text-blue-400" />
                          </div>
                          <div>
                            <p className="text-sm text-white">{rep.name}</p>
                            <p className="text-xs text-gray-500">{rep.role || rep.territory || 'Rep'}</p>
                          </div>
                        </div>
                        {rep.is_primary && (
                          <span className="text-xs text-amber-400">Primary</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Client Info */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Details</h3>
                <div className="space-y-2 text-sm">
                  {client.pos_system && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">POS System</span>
                      <span className="text-white">{client.pos_system}</span>
                    </div>
                  )}
                  {client.cuisine_type && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Cuisine</span>
                      <span className="text-white">{client.cuisine_type}</span>
                    </div>
                  )}
                  {client.seating_capacity && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Seating</span>
                      <span className="text-white">{client.seating_capacity}</span>
                    </div>
                  )}
                  {client.estimated_revenue_tier && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Revenue Tier</span>
                      <span className="text-white capitalize">{client.estimated_revenue_tier}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Recent Activity + Quick Notes */}
            <div className="space-y-4">
              {/* Recent Activity */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-300">Recent Activity</h3>
                  <button onClick={() => setActiveTab('activity')} className="text-xs text-amber-400 hover:underline">
                    View all
                  </button>
                </div>
                {data.recentActivity.length === 0 ? (
                  <p className="text-sm text-gray-500">No activity recorded yet</p>
                ) : (
                  <div className="space-y-2">
                    {data.recentActivity.slice(0, 5).map((act: any) => (
                      <div key={act.id} className="flex items-start gap-2">
                        <Activity className="w-3.5 h-3.5 text-gray-500 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">{act.title}</p>
                          <p className="text-xs text-gray-500">
                            {act.performed_by_name} &middot; {new Date(act.created_at * 1000).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Notes */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-300">Pinned Notes</h3>
                  <button onClick={() => setActiveTab('notes')} className="text-xs text-amber-400 hover:underline">
                    All notes
                  </button>
                </div>
                {data.notes.filter((n: any) => n.is_pinned).length === 0 ? (
                  <p className="text-sm text-gray-500">No pinned notes</p>
                ) : (
                  <div className="space-y-2">
                    {data.notes.filter((n: any) => n.is_pinned).slice(0, 3).map((note: any) => (
                      <div key={note.id} className="p-2 bg-gray-900/50 rounded border border-gray-700/50">
                        <p className="text-sm text-gray-300 line-clamp-2">{note.content}</p>
                        <p className="text-xs text-gray-500 mt-1">{note.author_name}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Open Tickets Preview */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-300">Open Tickets</h3>
                  <button onClick={() => setActiveTab('tickets')} className="text-xs text-amber-400 hover:underline">
                    View all
                  </button>
                </div>
                {data.tickets.items.length === 0 ? (
                  <p className="text-sm text-gray-500">No open tickets</p>
                ) : (
                  <div className="space-y-2">
                    {data.tickets.items.slice(0, 3).map((t: any) => (
                      <div key={t.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${
                            t.priority === 'urgent' ? 'bg-red-500' :
                            t.priority === 'high' ? 'bg-orange-500' : 'bg-amber-500'
                          }`} />
                          <span className="text-sm text-white truncate">{t.subject}</span>
                        </div>
                        <span className="text-xs text-gray-500 shrink-0 ml-2">{t.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <ClientActivityTimeline clientId={clientId} />
      )}

      {activeTab === 'deals' && (
        <ClientDealPipeline clientId={clientId} deals={data.deals} onRefresh={loadData} />
      )}

      {activeTab === 'notes' && (
        <ClientNotes clientId={clientId} initialNotes={data.notes} />
      )}

      {activeTab === 'tickets' && (
        <div className="space-y-3">
          <h3 className="text-lg font-medium text-white">All Tickets</h3>
          {data.tickets.items.length === 0 ? (
            <p className="text-gray-500">No tickets for this client</p>
          ) : (
            <div className="space-y-2">
              {data.tickets.items.map((t: any) => (
                <div key={t.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      t.priority === 'urgent' ? 'bg-red-500/20 text-red-400' :
                      t.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                      'bg-gray-700 text-gray-300'
                    }`}>{t.priority}</span>
                    <span className="text-white">{t.subject}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {t.sla_response_breached && <span className="text-xs text-red-400">SLA Breach</span>}
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      t.status === 'open' ? 'bg-blue-500/20 text-blue-400' :
                      t.status === 'in_progress' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-green-500/20 text-green-400'
                    }`}>{t.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'projects' && (
        <div className="space-y-3">
          <h3 className="text-lg font-medium text-white">Projects</h3>
          {data.projects.length === 0 ? (
            <p className="text-gray-500">No active projects</p>
          ) : (
            <div className="grid gap-4">
              {data.projects.map((p: any) => (
                <div key={p.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-white font-medium">{p.name}</h4>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      p.status === 'active' ? 'bg-green-500/20 text-green-400' :
                      p.status === 'planning' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-gray-700 text-gray-300'
                    }`}>{p.status}</span>
                  </div>
                  {p.progress !== undefined && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Progress</span>
                        <span>{p.progress}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: `${p.progress}%` }} />
                      </div>
                    </div>
                  )}
                  {p.budget && (
                    <div className="flex justify-between text-xs text-gray-500 mt-2">
                      <span>Budget: ${p.budget?.toLocaleString()}</span>
                      <span>Spent: ${(p.actual_spend || 0).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ClientProfile360;
