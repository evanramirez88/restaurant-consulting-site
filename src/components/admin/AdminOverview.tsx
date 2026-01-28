import React, { useState, useEffect } from 'react';
import {
  TrendingUp, Eye, MousePointer, CheckCircle, UserPlus, Calendar,
  Settings, ExternalLink, FileText, Shield, MapPin, Users, Building2, Briefcase,
  ChevronRight, Link2, MessageSquare, FolderOpen, Clock, AlertCircle, BarChart3, Activity,
  Zap, Play, Pause, Loader2, Wifi, WifiOff, Globe, Home, RefreshCw, Ticket, Database, Brain
} from 'lucide-react';
import AvailabilityManager from './availability/AvailabilityManager';
import dataContext, { DataContextStats } from '../../services/dataContext';

interface AvailabilityData {
  status: 'available' | 'busy' | 'offline';
  locationType: 'remote' | 'onsite' | 'both';
  town: string | null;
}

interface ClientPortal {
  id: string;
  name: string;
  company: string;
  email: string;
  slug: string | null;
  phone?: string;
  portal_enabled: boolean;
  support_plan_tier: string | null;
  support_plan_status: string | null;
  google_drive_folder_id: string | null;
  timezone?: string;
  created_at?: number;
  last_activity?: number;
}

interface RepPortal {
  id: string;
  name: string;
  email: string;
  phone?: string;
  territory: string | null;
  slug: string | null;
  portal_enabled: boolean;
  status: 'active' | 'inactive' | 'pending';
  client_count?: number;
  total_commission?: number;
  created_at?: number;
}

interface AutomationStatus {
  isOnline: boolean;
  currentSessions: number;
  maxSessions: number;
  queueDepth: number;
  lastHeartbeat: string | null;
  serverVersion: string | null;
  stats: {
    activeJobs: number;
    queuedJobs: number;
    totalJobsToday: number;
  };
}

interface AdminOverviewProps {
  availability: AvailabilityData;
  clientCount: number;
  repCount: number;
  onNavigateToTab: (tab: string) => void;
  formatTimeAgo: (timestamp: number | null) => string;
  onAvailabilityChange?: (data: AvailabilityData) => void;
}

const AdminOverview: React.FC<AdminOverviewProps> = ({
  availability,
  clientCount,
  repCount,
  onNavigateToTab,
  formatTimeAgo,
  onAvailabilityChange
}) => {
  const [clients, setClients] = useState<ClientPortal[]>([]);
  const [reps, setReps] = useState<RepPortal[]>([]);
  const [isLoadingPortals, setIsLoadingPortals] = useState(true);
  const [showAllClients, setShowAllClients] = useState(false);
  const [showAllReps, setShowAllReps] = useState(false);
  const [automationStatus, setAutomationStatus] = useState<AutomationStatus | null>(null);
  const [isLoadingAutomation, setIsLoadingAutomation] = useState(true);
  const [showAvailabilityEditor, setShowAvailabilityEditor] = useState(false);
  const [dashboardStats, setDashboardStats] = useState<{ emailsSentToday: number; emailsThisWeek: number; newLeadsThisWeek: number } | null>(null);
  const [recentActivity, setRecentActivity] = useState<Array<{ id: string; type: string; title: string; detail: string; time: number }>>([]);
  
  // DATA_CONTEXT state
  const [dataContextConnected, setDataContextConnected] = useState(false);
  const [dataContextStats, setDataContextStats] = useState<DataContextStats | null>(null);
  const [isLoadingDataContext, setIsLoadingDataContext] = useState(true);

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

  // Load automation status
  useEffect(() => {
    const loadAutomationStatus = async () => {
      try {
        const response = await fetch('/api/automation/status');
        const data = await response.json();
        if (data.success) {
          setAutomationStatus(data.status);
        }
      } catch (error) {
        console.error('Failed to load automation status:', error);
      } finally {
        setIsLoadingAutomation(false);
      }
    };
    loadAutomationStatus();

    // Refresh status every 30 seconds
    const interval = setInterval(loadAutomationStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load DATA_CONTEXT status
  useEffect(() => {
    const loadDataContextStatus = async () => {
      try {
        const connected = await dataContext.checkConnection();
        setDataContextConnected(connected);
        
        if (connected) {
          const stats = await dataContext.getStats();
          setDataContextStats(stats);
        }
      } catch (error) {
        console.error('Failed to load DATA_CONTEXT status:', error);
        setDataContextConnected(false);
      } finally {
        setIsLoadingDataContext(false);
      }
    };
    loadDataContextStatus();

    // Refresh every 60 seconds
    const interval = setInterval(loadDataContextStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  // Load dashboard quick stats and recent activity
  useEffect(() => {
    const loadDashStats = async () => {
      try {
        const [emailRes, activityRes] = await Promise.all([
          fetch('/api/admin/email/subscribers?limit=1'),
          fetch('/api/admin/business-brief/pulse')
        ]);
        const emailData = await emailRes.json();
        const pulseData = await activityRes.json();

        if (pulseData.success) {
          setDashboardStats({
            emailsSentToday: pulseData.data?.emailMetrics?.sentToday || 0,
            emailsThisWeek: pulseData.data?.emailMetrics?.sentThisWeek || 0,
            newLeadsThisWeek: pulseData.data?.leadHealth?.newThisWeek || 0
          });
        }
      } catch (e) {
        // Stats are non-critical
      }

      // Fetch recent activity from aggregated activity feed (AO-4)
      try {
        const res = await fetch('/api/admin/activity/recent?limit=10');
        const data = await res.json();
        if (data.success && data.data?.length > 0) {
          setRecentActivity(data.data.slice(0, 5).map((e: any) => ({
            id: e.id,
            type: e.type || 'activity',
            title: e.description || 'Activity',
            detail: e.type === 'email' ? 'Email system' :
                    e.type === 'login' ? 'Portal access' :
                    e.type === 'ticket' ? 'Support' :
                    e.type === 'form' ? 'Contact form' : '',
            time: e.timestamp
          })));
        }
      } catch (e) {
        // Non-critical - fall back to email errors
        try {
          const res = await fetch('/api/admin/email/errors?limit=5');
          const data = await res.json();
          if (data.success && data.data?.length > 0) {
            setRecentActivity(data.data.slice(0, 3).map((err: any) => ({
              id: err.id,
              type: 'email',
              title: `Email ${err.status}: ${err.recipient || 'unknown'}`,
              detail: err.error_message || err.status,
              time: err.created_at
            })));
          }
        } catch (e2) {
          // Non-critical
        }
      }
    };
    loadDashStats();
  }, []);

  const getSupportPlanBadge = (tier: string | null, status: string | null) => {
    if (!tier || tier === 'none') return null;
    const colors: Record<string, string> = {
      core: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
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

  const getAvailabilityColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'busy': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getLocationIcon = (type: string) => {
    switch (type) {
      case 'remote': return <Globe className="w-4 h-4" />;
      case 'onsite': return <Home className="w-4 h-4" />;
      default: return <MapPin className="w-4 h-4" />;
    }
  };

  return (
    <>
      {/* ================================================== */}
      {/* TOP PRIORITY: Availability + Status + Analytics Row */}
      {/* ================================================== */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Availability Card - PROMINENT */}
        <section className="admin-card p-6 lg:col-span-1" aria-labelledby="availability-heading">
          <div className="flex items-center justify-between mb-4">
            <h2 id="availability-heading" className="text-lg font-display font-bold text-white flex items-center gap-2">
              {availability.status === 'available' ? (
                <Wifi className="w-5 h-5 text-green-400" />
              ) : availability.status === 'busy' ? (
                <Wifi className="w-5 h-5 text-yellow-400" />
              ) : (
                <WifiOff className="w-5 h-5 text-gray-400" />
              )}
              Availability
            </h2>
            <button
              onClick={() => setShowAvailabilityEditor(!showAvailabilityEditor)}
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
            >
              <Settings className="w-3 h-3" />
              {showAvailabilityEditor ? 'Close' : 'Edit'}
            </button>
          </div>

          {showAvailabilityEditor ? (
            <div className="bg-gray-800/50 rounded-lg p-4 -mx-2">
              <AvailabilityManager />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Status Indicator */}
              <div className="flex items-center gap-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                <div className={`w-4 h-4 rounded-full ${getAvailabilityColor(availability.status)} ${
                  availability.status === 'available' ? 'animate-pulse' : ''
                }`} />
                <div className="flex-1">
                  <p className="text-white font-semibold text-lg capitalize">{availability.status}</p>
                  <p className="text-gray-400 text-sm flex items-center gap-1">
                    {getLocationIcon(availability.locationType)}
                    {availability.locationType === 'remote' ? 'Remote Only' :
                     availability.locationType === 'onsite' ? (availability.town || 'On-Site') :
                     `Remote & ${availability.town || 'On-Site'}`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Current Status Card */}
        <section className="admin-card p-6" aria-labelledby="status-heading">
          <h2 id="status-heading" className="text-lg font-display font-bold text-white flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-amber-400" />
            System Status
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border border-gray-700">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-gray-400 text-sm">Website</span>
              </div>
              <span className="text-green-400 text-sm font-medium">Online</span>
            </div>
            <div className="p-3 bg-gray-900/50 rounded-lg border border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${automationStatus?.isOnline ? 'bg-green-500' : 'bg-gray-500'}`} />
                  <span className="text-gray-400 text-sm">Automation</span>
                </div>
                {automationStatus?.isOnline ? (
                  <span className="text-green-400 text-sm font-medium">Online</span>
                ) : (
                  <span className="text-gray-500 text-sm font-medium">Offline</span>
                )}
              </div>
              {/* AO-3: Show diagnostic info when automation is offline */}
              {!automationStatus?.isOnline && (
                <div className="mt-2 pt-2 border-t border-gray-700/50">
                  <p className="text-xs text-gray-500">
                    Automation server not responding
                  </p>
                  {automationStatus?.lastHeartbeat && (
                    <p className="text-xs text-gray-600 mt-0.5">
                      Last seen: {formatTimeAgo(new Date(automationStatus.lastHeartbeat).getTime() / 1000)}
                    </p>
                  )}
                  <button
                    onClick={() => onNavigateToTab('tools')}
                    className="text-xs text-amber-400 hover:text-amber-300 mt-1 flex items-center gap-1"
                  >
                    View Details →
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border border-gray-700">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-gray-400 text-sm">Email System</span>
              </div>
              <span className="text-green-400 text-sm font-medium">Active</span>
            </div>
            <div className="p-3 bg-gray-900/50 rounded-lg border border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${dataContextConnected ? 'bg-purple-500' : 'bg-gray-500'}`} />
                  <span className="text-gray-400 text-sm">DATA_CONTEXT</span>
                </div>
                {isLoadingDataContext ? (
                  <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
                ) : dataContextConnected ? (
                  <span className="text-purple-400 text-sm font-medium">Connected</span>
                ) : (
                  <span className="text-gray-500 text-sm font-medium">Offline</span>
                )}
              </div>
              {dataContextConnected && dataContextStats && (
                <div className="mt-2 pt-2 border-t border-gray-700/50 grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center">
                    <span className="text-purple-400 font-semibold">{dataContextStats.contacts}</span>
                    <span className="text-gray-500 ml-1">contacts</span>
                  </div>
                  <div className="text-center">
                    <span className="text-purple-400 font-semibold">{dataContextStats.events}</span>
                    <span className="text-gray-500 ml-1">events</span>
                  </div>
                  <div className="text-center">
                    <span className="text-purple-400 font-semibold">{dataContextStats.intelligence}</span>
                    <span className="text-gray-500 ml-1">intel</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Site Analytics Card */}
        <section className="admin-card p-6" aria-labelledby="analytics-quick-heading">
          <div className="flex items-center justify-between mb-4">
            <h2 id="analytics-quick-heading" className="text-lg font-display font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-amber-400" />
              Site Analytics
            </h2>
            <a
              href="https://dash.cloudflare.com/373a6cef1f9ccf5d26bfd9687a91c0a6/web-analytics"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
            >
              Cloudflare <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border border-gray-700">
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Eye className="w-4 h-4" />
                Emails Today
              </div>
              <span className="text-white font-semibold">{dashboardStats?.emailsSentToday ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border border-gray-700">
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <TrendingUp className="w-4 h-4" />
                Emails This Week
              </div>
              <span className="text-white font-semibold">{dashboardStats?.emailsThisWeek ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border border-gray-700">
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <UserPlus className="w-4 h-4" />
                New Leads (7d)
              </div>
              <span className="text-white font-semibold">{dashboardStats?.newLeadsThisWeek ?? '—'}</span>
            </div>
          </div>
        </section>
      </div>

      {/* Recent Activity - Full Width */}
      <section className="admin-card p-6" aria-labelledby="recent-activity-heading">
        <div className="flex items-center justify-between mb-4">
          <h2 id="recent-activity-heading" className="text-lg font-display font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            Recent Activity
          </h2>
          <button className="text-xs text-gray-500 hover:text-gray-400 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>
        <div className="space-y-2">
          {recentActivity.length > 0 ? (
            <>
              {recentActivity.map(item => {
                // AO-4: Activity type-specific icon and color
                const getIconAndColor = (type: string) => {
                  switch (type) {
                    case 'email':
                      return { icon: <MessageSquare className="w-4 h-4 text-blue-400" />, bg: 'bg-blue-500/20' };
                    case 'login':
                      return { icon: <Users className="w-4 h-4 text-green-400" />, bg: 'bg-green-500/20' };
                    case 'ticket':
                      return { icon: <Ticket className="w-4 h-4 text-purple-400" />, bg: 'bg-purple-500/20' };
                    case 'form':
                      return { icon: <FileText className="w-4 h-4 text-orange-400" />, bg: 'bg-orange-500/20' };
                    default:
                      return { icon: <Activity className="w-4 h-4 text-gray-400" />, bg: 'bg-gray-500/20' };
                  }
                };
                const { icon, bg } = getIconAndColor(item.type);

                return (
                  <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-900/30 rounded-lg border border-gray-700/50">
                    <div className={`w-8 h-8 ${bg} rounded-full flex items-center justify-center`}>
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm truncate">{item.title}</p>
                      <p className="text-gray-500 text-xs truncate">{item.detail}</p>
                    </div>
                    <span className="text-gray-500 text-xs whitespace-nowrap">
                      {item.time ? formatTimeAgo(item.time) : ''}
                    </span>
                  </div>
                );
              })}
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 p-3 bg-gray-900/30 rounded-lg border border-gray-700/50">
                <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm">All systems operational</p>
                  <p className="text-gray-500 text-xs">{clientCount} clients, {repCount} reps active</p>
                </div>
                <span className="text-gray-500 text-xs whitespace-nowrap">Now</span>
              </div>
              <p className="text-center text-gray-600 text-xs py-2">
                Activity populates as emails send, clients interact, and events occur.
              </p>
            </>
          )}
        </div>
      </section>

      {/* ================================================== */}
      {/* SECONDARY: Counts and Quick Actions */}
      {/* ================================================== */}

      {/* Portal Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="admin-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{clientCount}</p>
              <p className="text-gray-400 text-xs">Clients</p>
            </div>
          </div>
        </div>
        <div className="admin-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{repCount}</p>
              <p className="text-gray-400 text-xs">Reps</p>
            </div>
          </div>
        </div>
        <div className="admin-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Ticket className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">0</p>
              <p className="text-gray-400 text-xs">Open Tickets</p>
            </div>
          </div>
        </div>
        <div className="admin-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">0</p>
              <p className="text-gray-400 text-xs">Pending</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <section className="admin-card p-6" aria-labelledby="quick-actions-heading">
        <h2 id="quick-actions-heading" className="text-lg font-display font-bold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigateToTab('contacts')}
            className="flex flex-col items-center gap-2 p-4 bg-gray-900/50 rounded-lg border border-gray-700 hover:border-amber-500/50 hover:bg-gray-800/50 transition-all"
          >
            <Users className="w-5 h-5 text-amber-400" />
            <span className="text-xs text-gray-300">Manage Contacts</span>
          </button>
          <button
            onClick={() => onNavigateToTab('email')}
            className="flex flex-col items-center gap-2 p-4 bg-gray-900/50 rounded-lg border border-gray-700 hover:border-amber-500/50 hover:bg-gray-800/50 transition-all"
          >
            <MessageSquare className="w-5 h-5 text-amber-400" />
            <span className="text-xs text-gray-300">Email Campaigns</span>
          </button>
          <button
            onClick={() => onNavigateToTab('tools')}
            className="flex flex-col items-center gap-2 p-4 bg-gray-900/50 rounded-lg border border-gray-700 hover:border-amber-500/50 hover:bg-gray-800/50 transition-all"
          >
            <FileText className="w-5 h-5 text-amber-400" />
            <span className="text-xs text-gray-300">Platform Tools</span>
          </button>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-2 p-4 bg-gray-900/50 rounded-lg border border-gray-700 hover:border-amber-500/50 hover:bg-gray-800/50 transition-all"
          >
            <ExternalLink className="w-5 h-5 text-amber-400" />
            <span className="text-xs text-gray-300">View Live Site</span>
          </a>
        </div>
      </section>

      {/* ================================================== */}
      {/* DETAIL SECTIONS: Portal Lists, Automation */}
      {/* ================================================== */}

      {/* Portal Overview */}
      <section className="admin-card p-6" aria-labelledby="portal-overview-heading">
        <div className="flex items-center justify-between mb-6">
          <h2 id="portal-overview-heading" className="text-lg font-display font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
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
                onClick={() => onNavigateToTab('contacts')}
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
                onClick={() => onNavigateToTab('contacts')}
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

      {/* Toast ABO Status Widget */}
      <section className="admin-card p-6" aria-labelledby="automation-heading">
        <div className="flex items-center justify-between mb-6">
          <h2 id="automation-heading" className="text-lg font-display font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Toast Auto-Back-Office
          </h2>
          <a
            href="/#/toast-automate"
            className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
          >
            Open Dashboard <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {isLoadingAutomation ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
          </div>
        ) : automationStatus ? (
          <div className="space-y-4">
            {/* Status Header */}
            <div className="flex items-center gap-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
              <div className={`w-4 h-4 rounded-full ${
                automationStatus.isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
              }`} />
              <div className="flex-1">
                <p className="text-white font-medium">
                  Automation Server: {automationStatus.isOnline ? 'Online' : 'Offline'}
                </p>
                {automationStatus.lastHeartbeat && (
                  <p className="text-xs text-gray-500">
                    Last heartbeat: {new Date(automationStatus.lastHeartbeat).toLocaleString()}
                  </p>
                )}
              </div>
              {automationStatus.serverVersion && (
                <span className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded">
                  v{automationStatus.serverVersion}
                </span>
              )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-gray-900/30 rounded-lg border border-gray-700">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                  <Play className="w-3 h-3 text-green-400" />
                  Active Jobs
                </div>
                <p className="text-xl font-bold text-green-400">
                  {automationStatus.stats.activeJobs}
                </p>
              </div>
              <div className="p-3 bg-gray-900/30 rounded-lg border border-gray-700">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                  <Pause className="w-3 h-3 text-yellow-400" />
                  Queue
                </div>
                <p className="text-xl font-bold text-yellow-400">
                  {automationStatus.queueDepth}
                </p>
              </div>
              <div className="p-3 bg-gray-900/30 rounded-lg border border-gray-700">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                  <Users className="w-3 h-3 text-blue-400" />
                  Sessions
                </div>
                <p className="text-xl font-bold text-blue-400">
                  {automationStatus.currentSessions}/{automationStatus.maxSessions}
                </p>
              </div>
              <div className="p-3 bg-gray-900/30 rounded-lg border border-gray-700">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                  <CheckCircle className="w-3 h-3 text-purple-400" />
                  Today
                </div>
                <p className="text-xl font-bold text-purple-400">
                  {automationStatus.stats.totalJobsToday}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 bg-gray-900/30 rounded-lg border border-gray-700">
            <Zap className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <h3 className="text-white font-semibold mb-2">Automation Server Not Connected</h3>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              The Toast ABO automation server is not currently running.
            </p>
          </div>
        )}
      </section>
    </>
  );
};

export default AdminOverview;
