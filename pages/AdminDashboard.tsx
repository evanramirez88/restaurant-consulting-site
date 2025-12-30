import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, LogOut, Save, CheckCircle, AlertCircle, ChevronDown, ChevronUp,
  MapPin, Clock, Phone, Mail, DollarSign, UtensilsCrossed, RefreshCw,
  LayoutDashboard, Calendar, Settings, FileText, Users, TrendingUp,
  Eye, MousePointer, UserPlus, ExternalLink, Shield, Trash2, Monitor
} from 'lucide-react';
import { useSEO } from '../src/components/SEO';

// Cape Cod towns for dropdown
const CAPE_COD_TOWNS = [
  'Provincetown', 'Wellfleet', 'Eastham', 'Orleans', 'Brewster',
  'Dennis', 'Yarmouth', 'Hyannis', 'Barnstable', 'Mashpee',
  'Falmouth', 'Sandwich', 'Bourne', 'Wareham'
];

type AvailabilityStatus = 'available' | 'busy' | 'offline';
type LocationType = 'remote' | 'onsite' | 'both';
type TabType = 'overview' | 'availability' | 'configuration' | 'audit' | 'sessions';

interface AvailabilityData {
  status: AvailabilityStatus;
  locationType: LocationType;
  town: string | null;
  address: string | null;
  walkInsAccepted: boolean;
  schedulingAvailable: boolean;
  customMessage: string | null;
  updatedAt: number | null;
}

interface ConfigData {
  phone: string;
  email: string;
  hourly_rate_remote: string;
  hourly_rate_onsite: string;
  business_hours: string;
}

interface SaveStatus {
  type: 'idle' | 'saving' | 'success' | 'error';
  message: string;
}

interface AuditLogEntry {
  id: string;
  action: string;
  details: string;
  timestamp: number;
  ipAddress: string;
}

interface SessionEntry {
  id: string;
  device: string;
  browser: string;
  ipAddress: string;
  lastActive: number;
  isCurrent: boolean;
}

interface AnalyticsData {
  visits: number;
  pageViews: number;
  conversions: number;
  leads: number;
  visitsTrend: number;
  conversionsTrend: number;
}

// Mock data for audit log
const MOCK_AUDIT_LOG: AuditLogEntry[] = [
  { id: '1', action: 'Login', details: 'Admin logged in successfully', timestamp: Date.now() - 1000 * 60 * 5, ipAddress: '192.168.1.100' },
  { id: '2', action: 'Availability Update', details: 'Changed status to Available', timestamp: Date.now() - 1000 * 60 * 30, ipAddress: '192.168.1.100' },
  { id: '3', action: 'Config Update', details: 'Updated business hours', timestamp: Date.now() - 1000 * 60 * 60 * 2, ipAddress: '192.168.1.100' },
  { id: '4', action: 'Login', details: 'Admin logged in successfully', timestamp: Date.now() - 1000 * 60 * 60 * 24, ipAddress: '192.168.1.105' },
  { id: '5', action: 'Availability Update', details: 'Changed location to Hyannis', timestamp: Date.now() - 1000 * 60 * 60 * 24 * 2, ipAddress: '192.168.1.100' },
];

// Mock data for sessions
const MOCK_SESSIONS: SessionEntry[] = [
  { id: '1', device: 'Desktop', browser: 'Chrome 120', ipAddress: '192.168.1.100', lastActive: Date.now(), isCurrent: true },
  { id: '2', device: 'Mobile', browser: 'Safari 17', ipAddress: '192.168.1.105', lastActive: Date.now() - 1000 * 60 * 60 * 2, isCurrent: false },
];

// Mock analytics data
const MOCK_ANALYTICS: AnalyticsData = {
  visits: 1247,
  pageViews: 3892,
  conversions: 34,
  leads: 18,
  visitsTrend: 12.5,
  conversionsTrend: 8.3,
};

const AdminDashboard: React.FC = () => {
  useSEO({
    title: 'Admin Dashboard | Cape Cod Restaurant Consulting',
    description: 'Manage availability and site settings.',
  });

  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Availability state
  const [availability, setAvailability] = useState<AvailabilityData>({
    status: 'offline',
    locationType: 'remote',
    town: null,
    address: null,
    walkInsAccepted: false,
    schedulingAvailable: true,
    customMessage: null,
    updatedAt: null
  });
  const [customTown, setCustomTown] = useState('');
  const [availabilitySaveStatus, setAvailabilitySaveStatus] = useState<SaveStatus>({
    type: 'idle',
    message: ''
  });

  // Config state
  const [config, setConfig] = useState<ConfigData>({
    phone: '',
    email: '',
    hourly_rate_remote: '',
    hourly_rate_onsite: '',
    business_hours: ''
  });
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [configSaveStatus, setConfigSaveStatus] = useState<{ [key: string]: SaveStatus }>({});

  // Audit and session state
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>(MOCK_AUDIT_LOG);
  const [sessions, setSessions] = useState<SessionEntry[]>(MOCK_SESSIONS);
  const [analytics, setAnalytics] = useState<AnalyticsData>(MOCK_ANALYTICS);

  // Check authentication and load data
  useEffect(() => {
    const init = async () => {
      try {
        const authResponse = await fetch('/api/auth/verify');
        const authData = await authResponse.json();

        if (!authData.authenticated) {
          navigate('/admin/login');
          return;
        }

        setIsAuthenticated(true);
        await Promise.all([loadAvailability(), loadConfig()]);
      } catch (error) {
        console.error('Init error:', error);
        navigate('/admin/login');
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [navigate]);

  const loadAvailability = async () => {
    try {
      const response = await fetch('/api/availability');
      const result = await response.json();
      if (result.success && result.data) {
        setAvailability(result.data);
        // Check if town is custom
        if (result.data.town && !CAPE_COD_TOWNS.includes(result.data.town)) {
          setCustomTown(result.data.town);
        }
      }
    } catch (error) {
      console.error('Load availability error:', error);
    }
  };

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/config');
      const result = await response.json();
      if (result.success && result.data) {
        setConfig(result.data);
      }
    } catch (error) {
      console.error('Load config error:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      navigate('/admin/login');
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/admin/login');
    }
  };

  const saveAvailability = async () => {
    setAvailabilitySaveStatus({ type: 'saving', message: '' });

    try {
      // Determine final town value
      let finalTown = availability.town;
      if (availability.town === 'custom') {
        finalTown = customTown || null;
      }

      const response = await fetch('/api/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...availability,
          town: finalTown
        })
      });

      const result = await response.json();

      if (result.success) {
        setAvailability(result.data);
        setAvailabilitySaveStatus({
          type: 'success',
          message: 'Availability updated!'
        });
        setTimeout(() => {
          setAvailabilitySaveStatus({ type: 'idle', message: '' });
        }, 3000);
      } else {
        throw new Error(result.error || 'Failed to save');
      }
    } catch (error) {
      console.error('Save availability error:', error);
      setAvailabilitySaveStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to save'
      });
    }
  };

  const saveConfigField = async (key: string, value: string) => {
    setConfigSaveStatus(prev => ({
      ...prev,
      [key]: { type: 'saving', message: '' }
    }));

    try {
      const response = await fetch(`/api/config/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
      });

      const result = await response.json();

      if (result.success) {
        setConfig(prev => ({ ...prev, [key]: value }));
        setEditingField(null);
        setConfigSaveStatus(prev => ({
          ...prev,
          [key]: { type: 'success', message: 'Saved!' }
        }));
        setTimeout(() => {
          setConfigSaveStatus(prev => ({
            ...prev,
            [key]: { type: 'idle', message: '' }
          }));
        }, 2000);
      } else {
        throw new Error(result.error || 'Failed to save');
      }
    } catch (error) {
      console.error('Save config error:', error);
      setConfigSaveStatus(prev => ({
        ...prev,
        [key]: {
          type: 'error',
          message: error instanceof Error ? error.message : 'Failed to save'
        }
      }));
    }
  };

  const startEditing = (key: string, value: string) => {
    setEditingField(key);
    setEditValue(value);
  };

  const cancelEditing = () => {
    setEditingField(null);
    setEditValue('');
  };

  const revokeSession = (sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
  };

  const formatTimeAgo = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-dark to-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const showLocationFields = availability.locationType === 'onsite' || availability.locationType === 'both';

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'availability', label: 'Availability', icon: <Calendar className="w-4 h-4" /> },
    { id: 'configuration', label: 'Configuration', icon: <Settings className="w-4 h-4" /> },
    { id: 'audit', label: 'Audit Log', icon: <FileText className="w-4 h-4" /> },
    { id: 'sessions', label: 'Sessions', icon: <Users className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-dark to-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center border border-gray-700">
              <UtensilsCrossed className="w-5 h-5 text-amber-400" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-display font-bold text-white text-lg">Admin Dashboard</h1>
              <p className="text-xs text-gray-400">R&G Consulting</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors min-h-[44px]"
            aria-label="Logout"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="bg-gray-900/80 border-b border-gray-800 overflow-x-auto admin-scrollbar" aria-label="Admin navigation">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1 py-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all whitespace-nowrap min-h-[44px] ${
                  activeTab === tab.id
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
                aria-current={activeTab === tab.id ? 'page' : undefined}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
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

            {/* Quick Actions */}
            <section className="admin-card p-6" aria-labelledby="quick-actions-heading">
              <h2 id="quick-actions-heading" className="text-xl font-display font-bold text-white mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button
                  onClick={() => setActiveTab('availability')}
                  className="flex flex-col items-center gap-2 p-4 bg-gray-900/50 rounded-lg border border-gray-700 hover:border-amber-500/50 hover:bg-gray-800/50 transition-all min-h-[100px]"
                  aria-label="Update availability status"
                >
                  <Calendar className="w-6 h-6 text-amber-400" aria-hidden="true" />
                  <span className="text-sm text-gray-300 text-center">Update Availability</span>
                </button>
                <button
                  onClick={() => setActiveTab('configuration')}
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
                  onClick={() => setActiveTab('audit')}
                  className="flex flex-col items-center gap-2 p-4 bg-gray-900/50 rounded-lg border border-gray-700 hover:border-amber-500/50 hover:bg-gray-800/50 transition-all min-h-[100px]"
                  aria-label="View audit log"
                >
                  <FileText className="w-6 h-6 text-amber-400" aria-hidden="true" />
                  <span className="text-sm text-gray-300 text-center">View Audit Log</span>
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
                  onClick={() => setActiveTab('audit')}
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
        )}

        {/* Availability Tab */}
        {activeTab === 'availability' && (
          <section className="admin-card p-6" aria-labelledby="availability-heading">
            <div className="flex items-center justify-between mb-6">
              <h2 id="availability-heading" className="text-xl font-display font-bold text-white">Availability Status</h2>
              <button
                onClick={loadAvailability}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                title="Refresh"
                aria-label="Refresh availability data"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* Status Segmented Control */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-3">Current Status</label>
              <div className="grid grid-cols-3 gap-2 p-1 bg-gray-900/50 rounded-xl segmented-control" role="radiogroup" aria-label="Availability status">
                {(['available', 'busy', 'offline'] as AvailabilityStatus[]).map((status) => {
                  const isActive = availability.status === status;
                  const colors = {
                    available: 'bg-green-500 text-white shadow-green-500/30',
                    busy: 'bg-yellow-500 text-gray-900 shadow-yellow-500/30',
                    offline: 'bg-gray-600 text-white shadow-gray-600/30'
                  };
                  return (
                    <button
                      key={status}
                      onClick={() => setAvailability(prev => ({ ...prev, status }))}
                      className={`segmented-control-item ${
                        isActive
                          ? `${colors[status]} active`
                          : ''
                      }`}
                      role="radio"
                      aria-checked={isActive}
                    >
                      {status}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Location Type */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-3">Location Type</label>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Location type">
                {(['remote', 'onsite', 'both'] as LocationType[]).map((type) => {
                  const isActive = availability.locationType === type;
                  const labels = { remote: 'Remote Only', onsite: 'On-Site', both: 'Both' };
                  return (
                    <button
                      key={type}
                      onClick={() => setAvailability(prev => ({ ...prev, locationType: type }))}
                      className={`py-3 px-4 rounded-lg font-medium text-sm transition-all min-h-[48px] border ${
                        isActive
                          ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                          : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white'
                      }`}
                      role="radio"
                      aria-checked={isActive}
                    >
                      {labels[type]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Town & Address (conditional) */}
            {showLocationFields && (
              <div className="space-y-4 mb-6 p-4 bg-gray-900/30 rounded-lg border border-gray-700">
                <div className="flex items-center gap-2 text-amber-400 mb-2">
                  <MapPin className="w-4 h-4" aria-hidden="true" />
                  <span className="text-sm font-medium">Location Details</span>
                </div>

                {/* Town Dropdown */}
                <div>
                  <label htmlFor="town-select" className="block text-sm font-medium text-gray-300 mb-2">Town</label>
                  <select
                    id="town-select"
                    value={CAPE_COD_TOWNS.includes(availability.town || '') ? availability.town || '' : (availability.town ? 'custom' : '')}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === 'custom') {
                        setAvailability(prev => ({ ...prev, town: 'custom' }));
                      } else {
                        setAvailability(prev => ({ ...prev, town: value || null }));
                        setCustomTown('');
                      }
                    }}
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent min-h-[48px] admin-input"
                  >
                    <option value="">Select a town...</option>
                    {CAPE_COD_TOWNS.map((town) => (
                      <option key={town} value={town}>{town}</option>
                    ))}
                    <option value="custom">Custom...</option>
                  </select>
                </div>

                {/* Custom Town Input */}
                {(availability.town === 'custom' || (availability.town && !CAPE_COD_TOWNS.includes(availability.town))) && (
                  <div>
                    <label htmlFor="custom-town" className="block text-sm font-medium text-gray-300 mb-2">Custom Town</label>
                    <input
                      type="text"
                      id="custom-town"
                      value={customTown}
                      onChange={(e) => setCustomTown(e.target.value)}
                      placeholder="Enter town name"
                      className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent min-h-[48px] admin-input"
                    />
                  </div>
                )}

                {/* Address */}
                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-gray-300 mb-2">
                    Address <span className="text-gray-500">(for walk-in directions)</span>
                  </label>
                  <input
                    type="text"
                    id="address"
                    value={availability.address || ''}
                    onChange={(e) => setAvailability(prev => ({ ...prev, address: e.target.value || null }))}
                    placeholder="123 Main St"
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent min-h-[48px] admin-input"
                  />
                </div>
              </div>
            )}

            {/* Toggle Switches */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {/* Walk-ins Accepted */}
              <label className="flex items-center justify-between p-4 bg-gray-900/30 rounded-lg border border-gray-700 cursor-pointer hover:border-gray-600 transition-colors min-h-[60px]">
                <span className="text-gray-300 font-medium">Walk-ins Accepted</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={availability.walkInsAccepted}
                    onChange={(e) => setAvailability(prev => ({ ...prev, walkInsAccepted: e.target.checked }))}
                    className="sr-only"
                    aria-describedby="walkins-desc"
                  />
                  <div className={`w-12 h-7 rounded-full transition-colors toggle-switch ${availability.walkInsAccepted ? 'bg-green-500' : 'bg-gray-600'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform toggle-switch-handle ${availability.walkInsAccepted ? 'translate-x-5' : ''}`} />
                  </div>
                </div>
              </label>

              {/* Scheduling Available */}
              <label className="flex items-center justify-between p-4 bg-gray-900/30 rounded-lg border border-gray-700 cursor-pointer hover:border-gray-600 transition-colors min-h-[60px]">
                <span className="text-gray-300 font-medium">Scheduling Available</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={availability.schedulingAvailable}
                    onChange={(e) => setAvailability(prev => ({ ...prev, schedulingAvailable: e.target.checked }))}
                    className="sr-only"
                  />
                  <div className={`w-12 h-7 rounded-full transition-colors toggle-switch ${availability.schedulingAvailable ? 'bg-green-500' : 'bg-gray-600'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform toggle-switch-handle ${availability.schedulingAvailable ? 'translate-x-5' : ''}`} />
                  </div>
                </div>
              </label>
            </div>

            {/* Custom Message */}
            <div className="mb-6">
              <label htmlFor="custom-message" className="block text-sm font-medium text-gray-300 mb-2">
                Quick Message <span className="text-gray-500">({(availability.customMessage || '').length}/200)</span>
              </label>
              <textarea
                id="custom-message"
                value={availability.customMessage || ''}
                onChange={(e) => {
                  if (e.target.value.length <= 200) {
                    setAvailability(prev => ({ ...prev, customMessage: e.target.value || null }));
                  }
                }}
                placeholder="e.g., 'Available for emergency support tonight!'"
                rows={3}
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none admin-input"
              />
            </div>

            {/* Save Button & Status */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <button
                onClick={saveAvailability}
                disabled={availabilitySaveStatus.type === 'saving'}
                className="flex-1 sm:flex-none px-6 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 min-h-[48px]"
              >
                {availabilitySaveStatus.type === 'saving' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" aria-hidden="true" />
                    <span>Update Status</span>
                  </>
                )}
              </button>

              {availabilitySaveStatus.type === 'success' && (
                <div className="flex items-center gap-2 text-green-400" role="status">
                  <CheckCircle className="w-5 h-5" aria-hidden="true" />
                  <span className="text-sm">{availabilitySaveStatus.message}</span>
                </div>
              )}

              {availabilitySaveStatus.type === 'error' && (
                <div className="flex items-center gap-2 text-red-400" role="alert">
                  <AlertCircle className="w-5 h-5" aria-hidden="true" />
                  <span className="text-sm">{availabilitySaveStatus.message}</span>
                </div>
              )}
            </div>

            {/* Last Updated */}
            <p className="text-xs text-gray-500 mt-4">
              Last updated: {formatTimeAgo(availability.updatedAt)}
            </p>
          </section>
        )}

        {/* Configuration Tab */}
        {activeTab === 'configuration' && (
          <section className="admin-card p-6" aria-labelledby="config-heading">
            <h2 id="config-heading" className="text-xl font-display font-bold text-white mb-6">Site Settings</h2>
            <div className="space-y-4">
              {/* Config Fields */}
              {[
                { key: 'phone', label: 'Phone', icon: Phone, type: 'tel' },
                { key: 'email', label: 'Email', icon: Mail, type: 'email' },
                { key: 'hourly_rate_remote', label: 'Remote Rate', icon: DollarSign, type: 'number', prefix: '$', suffix: '/hr' },
                { key: 'hourly_rate_onsite', label: 'On-Site Rate', icon: DollarSign, type: 'number', prefix: '$', suffix: '/hr' },
                { key: 'business_hours', label: 'Business Hours', icon: Clock, type: 'text' }
              ].map(({ key, label, icon: Icon, type, prefix, suffix }) => {
                const isEditing = editingField === key;
                const status = configSaveStatus[key];
                const value = config[key as keyof ConfigData];

                return (
                  <div
                    key={key}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-gray-900/30 rounded-lg border border-gray-700"
                  >
                    <div className="flex items-center gap-3 sm:w-40">
                      <Icon className="w-4 h-4 text-amber-400" aria-hidden="true" />
                      <span className="text-gray-300 font-medium">{label}</span>
                    </div>

                    <div className="flex-1 flex items-center gap-2">
                      {isEditing ? (
                        <>
                          {prefix && <span className="text-gray-400">{prefix}</span>}
                          <input
                            type={type}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            autoFocus
                            className="flex-1 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent min-h-[44px] admin-input"
                            aria-label={`Edit ${label}`}
                          />
                          {suffix && <span className="text-gray-400">{suffix}</span>}
                        </>
                      ) : (
                        <span className="flex-1 text-white">
                          {prefix}{value}{suffix}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveConfigField(key, editValue)}
                            disabled={status?.type === 'saving'}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors min-h-[44px]"
                          >
                            {status?.type === 'saving' ? (
                              <Loader2 className="w-4 h-4 animate-spin" aria-label="Saving" />
                            ) : (
                              'Save'
                            )}
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 text-sm font-medium rounded-lg transition-colors min-h-[44px]"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startEditing(key, value)}
                          className="px-4 py-2 text-amber-400 hover:text-amber-300 hover:bg-gray-700 text-sm font-medium rounded-lg transition-colors min-h-[44px]"
                        >
                          Edit
                        </button>
                      )}

                      {status?.type === 'success' && (
                        <CheckCircle className="w-4 h-4 text-green-400" aria-label="Saved successfully" />
                      )}
                      {status?.type === 'error' && (
                        <span className="text-xs text-red-400" role="alert">{status.message}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Audit Log Tab */}
        {activeTab === 'audit' && (
          <section className="admin-card p-6" aria-labelledby="audit-heading">
            <div className="flex items-center justify-between mb-6">
              <h2 id="audit-heading" className="text-xl font-display font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" aria-hidden="true" />
                Audit Log
              </h2>
              <span className="text-xs text-gray-500">Recent admin actions</span>
            </div>
            <div className="overflow-x-auto admin-scrollbar">
              <table className="w-full audit-table" aria-label="Audit log entries">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Action</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Details</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm hidden md:table-cell">IP Address</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-medium text-sm">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map((entry) => (
                    <tr key={entry.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-2 px-2 py-1 bg-gray-800 rounded text-sm text-white">
                          <Shield className="w-3 h-3 text-amber-400" aria-hidden="true" />
                          {entry.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-300 text-sm">{entry.details}</td>
                      <td className="py-3 px-4 text-gray-500 text-sm hidden md:table-cell font-mono">{entry.ipAddress}</td>
                      <td className="py-3 px-4 text-gray-500 text-sm text-right whitespace-nowrap">{formatDate(entry.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {auditLog.length === 0 && (
              <p className="text-center text-gray-500 py-8">No audit log entries found.</p>
            )}
          </section>
        )}

        {/* Sessions Tab */}
        {activeTab === 'sessions' && (
          <section className="admin-card p-6" aria-labelledby="sessions-heading">
            <div className="flex items-center justify-between mb-6">
              <h2 id="sessions-heading" className="text-xl font-display font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" aria-hidden="true" />
                Active Sessions
              </h2>
              <span className="text-xs text-gray-500">{sessions.length} active</span>
            </div>
            <div className="space-y-4">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border ${
                    session.isCurrent
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-gray-900/30 border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      session.device === 'Desktop' ? 'bg-blue-500/20' : 'bg-purple-500/20'
                    }`}>
                      <Monitor className={`w-5 h-5 ${session.device === 'Desktop' ? 'text-blue-400' : 'text-purple-400'}`} aria-hidden="true" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-white font-medium">{session.device}</p>
                        {session.isCurrent && (
                          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">Current</span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm">{session.browser}</p>
                      <p className="text-gray-500 text-xs font-mono">{session.ipAddress}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-gray-500 text-sm">
                      {session.isCurrent ? 'Active now' : `Last active ${formatTimeAgo(session.lastActive)}`}
                    </span>
                    {!session.isCurrent && (
                      <button
                        onClick={() => revokeSession(session.id)}
                        className="flex items-center gap-2 px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors min-h-[44px]"
                        aria-label={`Revoke session on ${session.device}`}
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                        <span className="text-sm">Revoke</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {sessions.length === 0 && (
              <p className="text-center text-gray-500 py-8">No active sessions.</p>
            )}
          </section>
        )}

        {/* Footer */}
        <footer className="text-center text-gray-500 text-sm py-4">
          <p>Cape Cod Restaurant Consulting Admin</p>
        </footer>
      </main>
    </div>
  );
};

export default AdminDashboard;
