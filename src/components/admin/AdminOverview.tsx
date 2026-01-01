import React, { useState, useEffect } from 'react';
import {
  TrendingUp, Eye, MousePointer, CheckCircle, UserPlus, Calendar,
  Settings, ExternalLink, FileText, Shield, MapPin, Users, Building2, Briefcase,
  ChevronRight, Link2, MessageSquare, FolderOpen, Clock, AlertCircle
} from 'lucide-react';

interface AnalyticsData {
  visits: number;
  pageViews: number;
  conversions: number;
  leads: number;
  visitsTrend: number;
  conversionsTrend: number;
}

interface AvailabilityData {
  status: 'available' | 'busy' | 'offline';
  locationType: 'remote' | 'onsite' | 'both';
  town: string | null;
}

interface AuditLogEntry {
  id: string;
  action: string;
  details: string;
  timestamp: number;
}

interface ClientPortal {
  id: string;
  name: string;
  company: string;
  slug: string | null;
  portal_enabled: boolean;
  support_plan_tier: string | null;
  support_plan_status: string | null;
  created_at?: number;
  last_activity?: number;
}

interface RepPortal {
  id: string;
  name: string;
  territory: string | null;
  slug: string | null;
  portal_enabled: boolean;
  status: 'active' | 'inactive' | 'pending';
  client_count?: number;
}

interface AdminOverviewProps {
  analytics: AnalyticsData;
  availability: AvailabilityData;
  auditLog: AuditLogEntry[];
  clientCount: number;
  repCount: number;
  onNavigateToTab: (tab: string) => void;
  formatTimeAgo: (timestamp: number | null) => string;
}

const AdminOverview: React.FC<AdminOverviewProps> = ({
  analytics,
  availability,
  auditLog,
  clientCount,
  repCount,
  onNavigateToTab,
  formatTimeAgo
}) => {
  const [clients, setClients] = useState<ClientPortal[]>([]);
  const [reps, setReps] = useState<RepPortal[]>([]);
  const [isLoadingPortals, setIsLoadingPortals] = useState(true);
  const [showAllClients, setShowAllClients] = useState(false);
  const [showAllReps, setShowAllReps] = useState(false);

  useEffect(() => {
    const loadPortals = async () => {
      try {
        const [clientsRes, repsRes] = await Promise.all([
          fetch('/api/admin/clients'),
          fetch('/api/admin/reps')
        ]);
        const clientsData = await clientsRes.json();
        const repsData = await repsRes.json();
        if (clientsData.success) setClients(clientsData.data || []);
        if (repsData.success) setReps(repsData.data || []);
      } catch (error) {
        console.error('Failed to load portals:', error);
      } finally {
        setIsLoadingPortals(false);
      }
    };
    loadPortals();
  }, []);

  const getSupportPlanBadge = (tier: string | null, status: string | null) => {
    if (!tier || tier === 'none') return null;
    const colors: Record<string, string> = {
      essential: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      professional: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      premium: 'bg-green-500/20 text-green-400 border-green-500/30'
    };
    return (
      <span className={`px-2 py-0.5 text-xs rounded border ${colors[tier] || 'bg-gray-500/20 text-gray-400'}`}>
        {tier.charAt(0).toUpperCase() + tier.slice(1)}
        {status === 'paused' && <span className="ml-1 text-yellow-400">(Paused)</span>}
      </span>
    );
  };

  const displayedClients = showAllClients ? clients : clients.slice(0, 5);
  const displayedReps = showAllReps ? reps : reps.slice(0, 5);

  return (
    <>
      {/* Cumulative Portal Overview */}
      <section className="admin-card p-6" aria-labelledby="portal-overview-heading">
        <div className="flex items-center justify-between mb-6">
          <h2 id="portal-overview-heading" className="text-xl font-display font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" aria-hidden="true" />
            Portal Overview
          </h2>
          <div className="flex gap-2">
            <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded">
              {clients.filter(c => c.portal_enabled).length} Active Clients
            </span>
            <span className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded">
              {reps.filter(r => r.portal_enabled).length} Active Reps
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Client Portals List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Client Portals
              </h3>
              <button
                onClick={() => onNavigateToTab('clients')}
                className="text-xs text-amber-400 hover:text-amber-300"
              >
                Manage All
              </button>
            </div>

            {isLoadingPortals ? (
              <div className="animate-pulse space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 bg-gray-800 rounded-lg" />
                ))}
              </div>
            ) : clients.length === 0 ? (
              <div className="text-center py-6 bg-gray-900/30 rounded-lg border border-gray-700">
                <Building2 className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No clients yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {displayedClients.map(client => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between p-3 bg-gray-900/30 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        client.portal_enabled ? 'bg-green-500' : 'bg-gray-500'
                      }`} />
                      <div className="min-w-0">
                        <p className="text-white font-medium truncate">{client.company || client.name}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          {client.slug && (
                            <span className="flex items-center gap-1">
                              <Link2 className="w-3 h-3" />
                              /portal/{client.slug}
                            </span>
                          )}
                          {getSupportPlanBadge(client.support_plan_tier, client.support_plan_status)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {client.slug && client.portal_enabled && (
                        <a
                          href={`/#/portal/${client.slug}/dashboard`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-gray-400 hover:text-amber-400 hover:bg-gray-700 rounded transition-colors"
                          title="Open Portal"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <ChevronRight className="w-4 h-4 text-gray-600" />
                    </div>
                  </div>
                ))}

                {clients.length > 5 && (
                  <button
                    onClick={() => setShowAllClients(!showAllClients)}
                    className="w-full py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    {showAllClients ? 'Show Less' : `Show ${clients.length - 5} More`}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Rep Portals List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Rep Portals
              </h3>
              <button
                onClick={() => onNavigateToTab('reps')}
                className="text-xs text-amber-400 hover:text-amber-300"
              >
                Manage All
              </button>
            </div>

            {isLoadingPortals ? (
              <div className="animate-pulse space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 bg-gray-800 rounded-lg" />
                ))}
              </div>
            ) : reps.length === 0 ? (
              <div className="text-center py-6 bg-gray-900/30 rounded-lg border border-gray-700">
                <Briefcase className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No reps yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {displayedReps.map(rep => (
                  <div
                    key={rep.id}
                    className="flex items-center justify-between p-3 bg-gray-900/30 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        rep.status === 'active' && rep.portal_enabled ? 'bg-green-500' :
                        rep.status === 'pending' ? 'bg-yellow-500' : 'bg-gray-500'
                      }`} />
                      <div className="min-w-0">
                        <p className="text-white font-medium truncate">{rep.name}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          {rep.territory && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {rep.territory}
                            </span>
                          )}
                          {rep.slug && (
                            <span className="flex items-center gap-1">
                              <Link2 className="w-3 h-3" />
                              /rep/{rep.slug}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs rounded ${
                        rep.status === 'active' ? 'bg-green-500/20 text-green-400' :
                        rep.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {rep.status}
                      </span>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {rep.slug && rep.portal_enabled && (
                          <a
                            href={`/#/rep/${rep.slug}/dashboard`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-gray-400 hover:text-amber-400 hover:bg-gray-700 rounded transition-colors"
                            title="Open Portal"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                      </div>
                    </div>
                  </div>
                ))}

                {reps.length > 5 && (
                  <button
                    onClick={() => setShowAllReps(!showAllReps)}
                    className="w-full py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    {showAllReps ? 'Show Less' : `Show ${reps.length - 5} More`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Analytics Overview */}
      <section className="admin-card p-6" aria-labelledby="analytics-heading">
        <div className="flex items-center justify-between mb-6">
          <h2 id="analytics-heading" className="text-xl font-display font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-400" aria-hidden="true" />
            Site Analytics
          </h2>
          <span className="text-xs text-gray-500">Last 30 days</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="admin-card p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Eye className="w-5 h-5 text-blue-400" aria-hidden="true" />
              </div>
              <span className="text-gray-400 text-sm">Visits</span>
            </div>
            <p className="text-2xl font-bold text-white">{analytics.visits.toLocaleString()}</p>
            <p className="text-xs text-green-400 mt-1">+{analytics.visitsTrend}% from last month</p>
          </div>
          <div className="admin-card p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <MousePointer className="w-5 h-5 text-purple-400" aria-hidden="true" />
              </div>
              <span className="text-gray-400 text-sm">Page Views</span>
            </div>
            <p className="text-2xl font-bold text-white">{analytics.pageViews.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">~3.1 pages/visit</p>
          </div>
          <div className="admin-card p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-400" aria-hidden="true" />
              </div>
              <span className="text-gray-400 text-sm">Conversions</span>
            </div>
            <p className="text-2xl font-bold text-white">{analytics.conversions}</p>
            <p className="text-xs text-green-400 mt-1">+{analytics.conversionsTrend}% from last month</p>
          </div>
          <div className="admin-card p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-amber-400" aria-hidden="true" />
              </div>
              <span className="text-gray-400 text-sm">Leads</span>
            </div>
            <p className="text-2xl font-bold text-white">{analytics.leads}</p>
            <p className="text-xs text-gray-500 mt-1">2.7% conversion rate</p>
          </div>
        </div>
      </section>

      {/* Portal Stats */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="admin-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Building2 className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Client Portals</h3>
                <p className="text-gray-400 text-sm">Active client accounts</p>
              </div>
            </div>
            <span className="text-3xl font-bold text-white">{clientCount}</span>
          </div>
          <button
            onClick={() => onNavigateToTab('clients')}
            className="w-full py-2 text-sm text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg transition-colors"
          >
            Manage Clients
          </button>
        </div>
        <div className="admin-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <Briefcase className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Rep Portals</h3>
                <p className="text-gray-400 text-sm">Active sales reps</p>
              </div>
            </div>
            <span className="text-3xl font-bold text-white">{repCount}</span>
          </div>
          <button
            onClick={() => onNavigateToTab('reps')}
            className="w-full py-2 text-sm text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg transition-colors"
          >
            Manage Reps
          </button>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="admin-card p-6" aria-labelledby="quick-actions-heading">
        <h2 id="quick-actions-heading" className="text-xl font-display font-bold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => onNavigateToTab('availability')}
            className="flex flex-col items-center gap-2 p-4 bg-gray-900/50 rounded-lg border border-gray-700 hover:border-amber-500/50 hover:bg-gray-800/50 transition-all min-h-[100px]"
            aria-label="Update availability status"
          >
            <Calendar className="w-6 h-6 text-amber-400" aria-hidden="true" />
            <span className="text-sm text-gray-300 text-center">Update Availability</span>
          </button>
          <button
            onClick={() => onNavigateToTab('config')}
            className="flex flex-col items-center gap-2 p-4 bg-gray-900/50 rounded-lg border border-gray-700 hover:border-amber-500/50 hover:bg-gray-800/50 transition-all min-h-[100px]"
            aria-label="Manage site settings"
          >
            <Settings className="w-6 h-6 text-amber-400" aria-hidden="true" />
            <span className="text-sm text-gray-300 text-center">Site Settings</span>
          </button>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-2 p-4 bg-gray-900/50 rounded-lg border border-gray-700 hover:border-amber-500/50 hover:bg-gray-800/50 transition-all min-h-[100px]"
            aria-label="View live site in new tab"
          >
            <ExternalLink className="w-6 h-6 text-amber-400" aria-hidden="true" />
            <span className="text-sm text-gray-300 text-center">View Live Site</span>
          </a>
          <button
            onClick={() => onNavigateToTab('tools')}
            className="flex flex-col items-center gap-2 p-4 bg-gray-900/50 rounded-lg border border-gray-700 hover:border-amber-500/50 hover:bg-gray-800/50 transition-all min-h-[100px]"
            aria-label="Access tools in demo mode"
          >
            <FileText className="w-6 h-6 text-amber-400" aria-hidden="true" />
            <span className="text-sm text-gray-300 text-center">Demo Tools</span>
          </button>
        </div>
      </section>

      {/* Current Status Summary */}
      <section className="admin-card p-6" aria-labelledby="status-summary-heading">
        <h2 id="status-summary-heading" className="text-xl font-display font-bold text-white mb-4">Current Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
            <div className={`w-4 h-4 rounded-full ${
              availability.status === 'available' ? 'bg-green-500' :
              availability.status === 'busy' ? 'bg-yellow-500' : 'bg-gray-500'
            }`} aria-hidden="true" />
            <div>
              <p className="text-gray-400 text-sm">Availability</p>
              <p className="text-white font-medium capitalize">{availability.status}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
            <MapPin className="w-5 h-5 text-amber-400" aria-hidden="true" />
            <div>
              <p className="text-gray-400 text-sm">Location</p>
              <p className="text-white font-medium">
                {availability.locationType === 'remote' ? 'Remote Only' :
                 availability.locationType === 'onsite' ? availability.town || 'On-Site' :
                 `${availability.town || 'Both'}`}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Activity Preview */}
      <section className="admin-card p-6" aria-labelledby="recent-activity-heading">
        <div className="flex items-center justify-between mb-4">
          <h2 id="recent-activity-heading" className="text-xl font-display font-bold text-white">Recent Activity</h2>
          <button
            onClick={() => onNavigateToTab('config')}
            className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
          >
            View All
          </button>
        </div>
        <div className="space-y-3">
          {auditLog.slice(0, 3).map((entry) => (
            <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-900/30 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center">
                  <Shield className="w-4 h-4 text-gray-400" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{entry.action}</p>
                  <p className="text-gray-500 text-xs">{entry.details}</p>
                </div>
              </div>
              <span className="text-gray-500 text-xs">{formatTimeAgo(entry.timestamp)}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
};

export default AdminOverview;
