import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2, RefreshCw, Brain, Users, Database, Newspaper,
  AlertTriangle, CheckCircle2, XCircle, Clock, MapPin,
  TrendingUp, Zap, ChevronRight, ExternalLink, Star,
  Activity, Target, BarChart3, Globe, Bot, Phone, MessageSquare
} from 'lucide-react';

interface Segment {
  id: string;
  name: string;
  key: string;
  description?: string;
  leadCount: number;
  avgScore: number;
  hotCount: number;
  emailSequence?: string;
}

interface POSDistribution {
  pos: string;
  count: number;
  avgScore: number;
  hotCount: number;
  switcherPotential: 'high' | 'medium' | 'low';
}

interface GeoDistribution {
  state: string;
  leadCount: number;
  avgScore: number;
  emailCoverage: number;
}

interface Lead {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  location?: string;
  pos?: string;
  score: number;
  status?: string;
}

interface ClientHealth {
  id: string;
  name: string;
  company?: string;
  plan: string;
  planStatus?: string;
  ticketCount: number;
  openTickets: number;
  healthScore: number;
  riskLevel: 'low' | 'medium' | 'high';
}

interface UpsellOpportunity {
  id: string;
  name: string;
  company?: string;
  currentPlan: string;
  recentTickets: number;
  recommendedPlan: string;
  reason: string;
}

interface Agent {
  name: string;
  lastRun?: number;
  status: 'healthy' | 'error' | 'idle';
  completedRuns?: number;
  failedRuns?: number;
}

interface AgentFinding {
  id: string;
  priority: string;
  category: string;
  title: string;
  description?: string;
  source: string;
  value?: number;
  timestamp: number;
}

interface BeaconContent {
  id: string;
  title: string;
  source: string;
  category?: string;
  status?: string;
  relevanceScore?: number;
  summary?: string;
  createdAt?: number;
}

interface IntelligenceData {
  timestamp: number;
  lastUpdated: string;
  leadIntelligence: {
    segments: Segment[];
    posDistribution: POSDistribution[];
    geoDistribution: GeoDistribution[];
    topLeads: Lead[];
    recentlyEnriched: number;
  };
  clientIntelligence: {
    healthScores: ClientHealth[];
    engagement: { id: string; name: string; activityCount: number; lastActivity?: number }[];
    upsellOpportunities: UpsellOpportunity[];
  };
  agentIntelligence: {
    agents: Record<string, Agent>;
    recentFindings: AgentFinding[];
  };
  beaconIntelligence: {
    stats: {
      total: number;
      pending: number;
      approved: number;
      published: number;
      rejected: number;
      newLast7Days: number;
    };
    topContent: BeaconContent[];
    pendingReview: BeaconContent[];
  };
  dataContext: {
    stats: {
      total_contacts: number;
      business_contacts: number;
      recent_interactions_24h: number;
      total_facts: number;
    };
    recentActivity: {
      type: string;
      summary: string;
      occurred_at: number;
      source_id: string;
    }[];
  };
}

export default function BusinessBriefIntelligence() {
  const [data, setData] = useState<IntelligenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState<'leads' | 'clients' | 'agents' | 'beacon' | 'context'>('leads');

  const fetchIntelligence = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const response = await fetch('/api/admin/business-brief/intelligence', {
        credentials: 'include'
      });
      const result = await response.json();

      if (result.success) {
        setData(result);
        setError(null);
      } else {
        setError(result.error || 'Failed to load intelligence data');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchIntelligence();
    const interval = setInterval(() => fetchIntelligence(false), 300000);
    return () => clearInterval(interval);
  }, [fetchIntelligence]);

  const formatNumber = (value: number) => new Intl.NumberFormat('en-US').format(value);

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0
  }).format(value);

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor(Date.now() / 1000) - timestamp;
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400 bg-green-500/20';
    if (score >= 60) return 'text-lime-400 bg-lime-500/20';
    if (score >= 40) return 'text-yellow-400 bg-yellow-500/20';
    return 'text-red-400 bg-red-500/20';
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-400 bg-green-500/20';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20';
      case 'high': return 'text-red-400 bg-red-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getPotentialColor = (potential: string) => {
    switch (potential) {
      case 'high': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      default: return 'text-gray-400';
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
        <h3 className="text-lg font-semibold text-white mb-2">Failed to Load Intelligence</h3>
        <p className="text-gray-400 mb-4">{error}</p>
        <button
          onClick={() => fetchIntelligence()}
          className="px-4 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { leadIntelligence, clientIntelligence, agentIntelligence, beaconIntelligence, dataContext } = data;

  const sections = [
    { id: 'leads', label: 'Leads', icon: <Target className="w-4 h-4" /> },
    { id: 'clients', label: 'Clients', icon: <Users className="w-4 h-4" /> },
    { id: 'agents', label: 'Agents', icon: <Bot className="w-4 h-4" /> },
    { id: 'beacon', label: 'Beacon', icon: <Newspaper className="w-4 h-4" /> },
    { id: 'context', label: 'Data Context', icon: <Database className="w-4 h-4" /> }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-white flex items-center gap-2">
            <Brain className="w-6 h-6 text-amber-400" />
            Intelligence Center
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Deep analysis and insights • Updated {new Date(data.lastUpdated).toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={() => fetchIntelligence(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Section Tabs */}
      <div className="admin-card p-2">
        <div className="flex gap-1">
          {sections.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id as any)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm flex-1
                transition-all duration-200
                ${activeSection === section.id
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }
              `}
            >
              {section.icon}
              <span className="hidden sm:inline">{section.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ========== LEAD INTELLIGENCE ========== */}
      {activeSection === 'leads' && (
        <div className="space-y-6">
          {/* Segments */}
          <div className="admin-card overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-blue-500/10 to-transparent border-b border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-400" />
                  <h3 className="font-semibold text-white">Lead Segments</h3>
                </div>
                <span className="text-sm text-gray-400">
                  {leadIntelligence.recentlyEnriched} enriched (7d)
                </span>
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {leadIntelligence.segments.slice(0, 9).map(segment => (
                  <div key={segment.id} className="bg-gray-800/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-white truncate">{segment.name}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getScoreColor(segment.avgScore)}`}>
                        {segment.avgScore}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">{formatNumber(segment.leadCount)} leads</span>
                      <span className="text-amber-400">{segment.hotCount} hot</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* POS Distribution */}
          <div className="admin-card overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-purple-500/10 to-transparent border-b border-gray-700">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                <h3 className="font-semibold text-white">POS Distribution</h3>
              </div>
            </div>
            <div className="p-4">
              <div className="space-y-2">
                {leadIntelligence.posDistribution.slice(0, 8).map(pos => (
                  <div key={pos.pos} className="flex items-center gap-3">
                    <div className="w-24 text-sm text-white font-medium truncate">{pos.pos}</div>
                    <div className="flex-1 h-6 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500/50 rounded-full flex items-center justify-end pr-2"
                        style={{ width: `${Math.min((pos.count / (leadIntelligence.posDistribution[0]?.count || 1)) * 100, 100)}%` }}
                      >
                        <span className="text-xs text-white">{formatNumber(pos.count)}</span>
                      </div>
                    </div>
                    <span className={`text-xs font-medium ${getPotentialColor(pos.switcherPotential)}`}>
                      {pos.switcherPotential}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Leads */}
          <div className="admin-card overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-amber-500/10 to-transparent border-b border-gray-700">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-400" />
                <h3 className="font-semibold text-white">Top Scored Leads</h3>
              </div>
            </div>
            <div className="divide-y divide-gray-700/50 max-h-[400px] overflow-y-auto">
              {leadIntelligence.topLeads.slice(0, 10).map(lead => (
                <div key={lead.id} className="p-3 hover:bg-gray-800/30">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white truncate">{lead.name || lead.company}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${getScoreColor(lead.score)}`}>
                          {lead.score}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-400 mt-1">
                        {lead.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {lead.location}
                          </span>
                        )}
                        {lead.pos && <span>{lead.pos}</span>}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Geo Distribution */}
          <div className="admin-card overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-green-500/10 to-transparent border-b border-gray-700">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-green-400" />
                <h3 className="font-semibold text-white">Geographic Distribution</h3>
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {leadIntelligence.geoDistribution.slice(0, 10).map(geo => (
                  <div key={geo.state} className="bg-gray-800/50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-white">{geo.state}</div>
                    <div className="text-sm text-gray-400">{formatNumber(geo.leadCount)}</div>
                    <div className="text-xs text-green-400">{geo.emailCoverage}% email</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== CLIENT INTELLIGENCE ========== */}
      {activeSection === 'clients' && (
        <div className="space-y-6">
          {/* Client Health */}
          <div className="admin-card overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-blue-500/10 to-transparent border-b border-gray-700">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-400" />
                <h3 className="font-semibold text-white">Client Health Scores</h3>
              </div>
            </div>
            {clientIntelligence.healthScores.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                <Users className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                <p>No client health data yet.</p>
                <p className="text-xs text-gray-500 mt-1">Data populates as clients are onboarded.</p>
              </div>
            ) : (
            <div className="divide-y divide-gray-700/50 max-h-[400px] overflow-y-auto">
              {clientIntelligence.healthScores.map(client => (
                <div key={client.id} className="p-4 hover:bg-gray-800/30">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-white">{client.name}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${getRiskColor(client.riskLevel)}`}>
                          {client.riskLevel} risk
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                        <span>{client.plan} plan</span>
                        <span>{client.ticketCount} tickets (30d)</span>
                        {client.openTickets > 0 && (
                          <span className="text-orange-400">{client.openTickets} open</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${client.healthScore >= 70 ? 'text-green-400' :
                          client.healthScore >= 40 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                        {client.healthScore}
                      </div>
                      <div className="text-xs text-gray-500">health</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>

          {/* Upsell Opportunities */}
          <div className="admin-card overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-green-500/10 to-transparent border-b border-gray-700">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                <h3 className="font-semibold text-white">Upsell Opportunities</h3>
              </div>
            </div>
            {clientIntelligence.upsellOpportunities.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
                <p>No upsell opportunities identified</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-700/50">
                {clientIntelligence.upsellOpportunities.map(opp => (
                  <div key={opp.id} className="p-4 hover:bg-gray-800/30">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{opp.name}</span>
                          <span className="text-xs text-gray-500">({opp.currentPlan})</span>
                        </div>
                        <p className="text-sm text-gray-400 mt-1">{opp.reason}</p>
                      </div>
                      <div className="text-right">
                        <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
                          → {opp.recommendedPlan}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Engagement */}
          <div className="admin-card overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-purple-500/10 to-transparent border-b border-gray-700">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-400" />
                <h3 className="font-semibold text-white">Portal Engagement</h3>
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {clientIntelligence.engagement.slice(0, 10).map(client => (
                  <div key={client.id} className="bg-gray-800/50 rounded-lg p-3 text-center">
                    <div className="text-sm font-medium text-white truncate">{client.name}</div>
                    <div className="text-lg font-bold text-purple-400">{client.activityCount}</div>
                    <div className="text-xs text-gray-500">actions</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== AGENT INTELLIGENCE ========== */}
      {activeSection === 'agents' && (
        <div className="space-y-6">
          {/* Agent Status */}
          <div className="admin-card overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-amber-500/10 to-transparent border-b border-gray-700">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-amber-400" />
                <h3 className="font-semibold text-white">Core 4 Intelligence Agents</h3>
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(agentIntelligence.agents).map(([key, agent]) => {
                  const statusColor = agent.status === 'healthy' ? 'text-green-400' :
                    agent.status === 'error' ? 'text-red-400' : 'text-gray-400';
                  const statusBg = agent.status === 'healthy' ? 'bg-green-500/20' :
                    agent.status === 'error' ? 'bg-red-500/20' : 'bg-gray-500/20';

                  return (
                    <div key={key} className="bg-gray-800/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-white">{agent.name}</span>
                        <span className={`w-2 h-2 rounded-full ${statusBg}`}>
                          <span className={`w-2 h-2 rounded-full ${statusColor} block`} />
                        </span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Status</span>
                          <span className={statusColor}>{agent.status}</span>
                        </div>
                        {agent.lastRun && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Last run</span>
                            <span className="text-white">{formatTimeAgo(agent.lastRun)}</span>
                          </div>
                        )}
                        {agent.completedRuns !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Runs (7d)</span>
                            <span className="text-white">{agent.completedRuns}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Agent Findings */}
          <div className="admin-card overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-purple-500/10 to-transparent border-b border-gray-700">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-400" />
                <h3 className="font-semibold text-white">Recent Agent Findings</h3>
              </div>
            </div>
            {agentIntelligence.recentFindings.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                <Clock className="w-8 h-8 mx-auto mb-2" />
                <p>No recent agent findings</p>
                <p className="text-sm text-gray-500 mt-1">Agents will surface insights here when they run</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-700/50 max-h-[400px] overflow-y-auto">
                {agentIntelligence.recentFindings.map(finding => (
                  <div key={finding.id} className="p-4 hover:bg-gray-800/30">
                    <div className="flex items-start gap-3">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${finding.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                          finding.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                            'bg-gray-500/20 text-gray-400'
                        }`}>
                        {finding.priority}
                      </span>
                      <div className="flex-1">
                        <div className="font-medium text-white">{finding.title}</div>
                        {finding.description && (
                          <p className="text-sm text-gray-400 mt-1">{finding.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          <span>{finding.source.replace('agent_', '')}</span>
                          {finding.value && (
                            <span className="text-green-400">{formatCurrency(finding.value)}</span>
                          )}
                          <span>{formatTimeAgo(finding.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== BEACON INTELLIGENCE ========== */}
      {activeSection === 'beacon' && (
        <div className="space-y-6">
          {/* Beacon Stats */}
          <div className="admin-card overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-blue-500/10 to-transparent border-b border-gray-700">
              <div className="flex items-center gap-2">
                <Newspaper className="w-5 h-5 text-blue-400" />
                <h3 className="font-semibold text-white">Content Pipeline</h3>
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-white">{beaconIntelligence.stats.total}</div>
                  <div className="text-xs text-gray-400">Total Items</div>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-400">{beaconIntelligence.stats.pending}</div>
                  <div className="text-xs text-gray-400">Pending</div>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-400">{beaconIntelligence.stats.approved}</div>
                  <div className="text-xs text-gray-400">Approved</div>
                </div>
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-400">{beaconIntelligence.stats.published}</div>
                  <div className="text-xs text-gray-400">Published</div>
                </div>
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-red-400">{beaconIntelligence.stats.rejected}</div>
                  <div className="text-xs text-gray-400">Rejected</div>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-purple-400">{beaconIntelligence.stats.newLast7Days}</div>
                  <div className="text-xs text-gray-400">New (7d)</div>
                </div>
              </div>
            </div>
          </div>

          {/* Pending Review */}
          {beaconIntelligence.pendingReview.length > 0 && (
            <div className="admin-card overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-yellow-500/10 to-transparent border-b border-gray-700">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-400" />
                  <h3 className="font-semibold text-white">Pending Review</h3>
                </div>
              </div>
              <div className="divide-y divide-gray-700/50">
                {beaconIntelligence.pendingReview.map(item => (
                  <div key={item.id} className="p-4 hover:bg-gray-800/30">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="font-medium text-white">{item.title}</div>
                        {item.summary && (
                          <p className="text-sm text-gray-400 mt-1 line-clamp-2">{item.summary}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          <span>{item.source}</span>
                          {item.category && <span>{item.category}</span>}
                        </div>
                      </div>
                      {item.relevanceScore && (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getScoreColor(item.relevanceScore)}`}>
                          {item.relevanceScore}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Content */}
          <div className="admin-card overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-green-500/10 to-transparent border-b border-gray-700">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-green-400" />
                <h3 className="font-semibold text-white">Top Content</h3>
              </div>
            </div>
            {beaconIntelligence.topContent.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                <Newspaper className="w-8 h-8 mx-auto mb-2" />
                <p>No published content yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-700/50">
                {beaconIntelligence.topContent.map(item => (
                  <div key={item.id} className="p-4 hover:bg-gray-800/30">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-white">{item.title}</div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span>{item.source}</span>
                          {item.category && <span>{item.category}</span>}
                          <span className={`px-2 py-0.5 rounded ${item.status === 'published' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                            }`}>
                            {item.status}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== DATA CONTEXT ========== */}
      {activeSection === 'context' && dataContext && (
        <div className="space-y-6">
          {/* Data Context Stats */}
          <div className="admin-card overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-teal-500/10 to-transparent border-b border-gray-700">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-teal-400" />
                <h3 className="font-semibold text-white">Synced Business Context</h3>
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-white">{dataContext.stats.total_contacts}</div>
                  <div className="text-sm text-gray-400">Synced Contacts</div>
                </div>
                <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-teal-400">{dataContext.stats.business_contacts}</div>
                  <div className="text-sm text-gray-400">Verified Business</div>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-blue-400">{dataContext.stats.recent_interactions_24h}</div>
                  <div className="text-sm text-gray-400">Interactions (24h)</div>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-purple-400">{dataContext.stats.total_facts}</div>
                  <div className="text-sm text-gray-400">Knowledge Facts</div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity Feed */}
          <div className="admin-card overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-indigo-500/10 to-transparent border-b border-gray-700">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-400" />
                <h3 className="font-semibold text-white">Recent Data Streams</h3>
              </div>
            </div>
            {dataContext.recentActivity.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                <Database className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                <p>No recent data activity synced.</p>
                <p className="text-xs text-gray-500 mt-1">Run the Data Context Engine to sync data.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-700/50">
                {dataContext.recentActivity.map((activity, idx) => (
                  <div key={idx} className="p-4 hover:bg-gray-800/30">
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg bg-gray-800 text-gray-400`}>
                        {activity.type === 'sms' ? <MessageSquare className="w-4 h-4" /> :
                          activity.type === 'call' ? <Phone className="w-4 h-4" /> :
                            <Activity className="w-4 h-4" />}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">{activity.summary || 'Synced Activity'}</div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span className="capitalize">{activity.type}</span>
                          <span>•</span>
                          <span>{formatTimeAgo(activity.occurred_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
