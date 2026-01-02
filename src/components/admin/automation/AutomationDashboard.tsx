import React, { useState, useEffect, useCallback } from 'react';
import {
  Bot,
  RefreshCw,
  Play,
  Pause,
  Square,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Settings,
  Plus,
  FileText,
  Zap,
  Server,
  Activity,
  List,
  Key,
  ChevronRight,
  Camera,
  Terminal
} from 'lucide-react';

// Sub-components (will be created)
import StatusWidget from './StatusWidget';
import ActiveJobCard from './ActiveJobCard';
import JobQueue from './JobQueue';
import ManualTrigger from './ManualTrigger';
import ClientCredentials from './ClientCredentials';
import JobDetail from './JobDetail';
import AutomationLogs from './AutomationLogs';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface AutomationJob {
  id: string;
  client_id: string;
  client_name?: string;
  client_company?: string;
  restaurant_id?: string;
  job_type: string;
  title?: string;
  status: 'queued' | 'pending_credentials' | 'running' | 'paused' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled';
  progress_percentage: number;
  current_step?: string;
  current_step_number?: number;
  total_steps?: number;
  scheduled_at?: number;
  started_at?: number;
  completed_at?: number;
  estimated_duration_seconds?: number;
  error_message?: string;
  retry_count: number;
  triggered_by?: string;
  created_at: number;
}

export interface AutomationJobStep {
  id: string;
  job_id: string;
  step_number: number;
  step_name: string;
  step_description?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  screenshot_before_key?: string;
  screenshot_after_key?: string;
  started_at?: number;
  completed_at?: number;
  error_message?: string;
}

export interface ServerStatus {
  isOnline: boolean;
  currentSessions: number;
  maxSessions: number;
  queueDepth: number;
  lastHeartbeat?: number;
  browserHealthy: boolean;
  serverVersion?: string;
}

export interface ToastCredential {
  id: string;
  client_id: string;
  client_name?: string;
  restaurant_id?: string;
  restaurant_name?: string;
  status: 'active' | 'invalid' | 'locked' | 'pending_verification' | 'expired';
  last_verified_at?: number;
  created_at: number;
}

type TabType = 'dashboard' | 'queue' | 'credentials' | 'logs' | 'settings';

// ============================================
// STATS CARD COMPONENT
// ============================================

interface StatsCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  trend?: number;
}

const StatsCard: React.FC<StatsCardProps> = ({ label, value, icon, color, trend }) => (
  <div className="admin-card p-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">{label}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        {trend !== undefined && (
          <p className={`text-xs mt-1 ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {trend >= 0 ? '+' : ''}{trend}% today
          </p>
        )}
      </div>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color.replace('text-', 'bg-').replace('400', '500/20')}`}>
        {icon}
      </div>
    </div>
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

const AutomationDashboard: React.FC = () => {
  // State
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [jobs, setJobs] = useState<AutomationJob[]>([]);
  const [activeJob, setActiveJob] = useState<AutomationJob | null>(null);
  const [selectedJob, setSelectedJob] = useState<AutomationJob | null>(null);
  const [credentials, setCredentials] = useState<ToastCredential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stats derived from jobs
  const stats = {
    queued: jobs.filter(j => j.status === 'queued').length,
    running: jobs.filter(j => j.status === 'running').length,
    completedToday: jobs.filter(j =>
      j.status === 'completed' &&
      j.completed_at &&
      j.completed_at > Date.now() - 86400000
    ).length,
    failedToday: jobs.filter(j =>
      j.status === 'failed' &&
      j.completed_at &&
      j.completed_at > Date.now() - 86400000
    ).length,
    successRate: jobs.length > 0
      ? Math.round((jobs.filter(j => j.status === 'completed').length / jobs.length) * 100)
      : 100
  };

  // Fetch server status
  const fetchServerStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/automation/status');
      const result = await response.json();
      if (result.success) {
        setServerStatus(result.status);
      }
    } catch (err) {
      console.error('Failed to fetch server status:', err);
    }
  }, []);

  // Fetch jobs
  const fetchJobs = useCallback(async () => {
    try {
      const response = await fetch('/api/automation/jobs?limit=50');
      const result = await response.json();
      if (result.success) {
        setJobs(result.jobs || []);
        // Find active job
        const running = result.jobs?.find((j: AutomationJob) => j.status === 'running');
        setActiveJob(running || null);
      }
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
    }
  }, []);

  // Fetch credentials
  const fetchCredentials = useCallback(async () => {
    try {
      const response = await fetch('/api/automation/credentials');
      const result = await response.json();
      if (result.success) {
        setCredentials(result.credentials || []);
      }
    } catch (err) {
      console.error('Failed to fetch credentials:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchServerStatus(),
        fetchJobs(),
        fetchCredentials()
      ]);
      setIsLoading(false);
    };
    init();
  }, [fetchServerStatus, fetchJobs, fetchCredentials]);

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(() => {
      fetchServerStatus();
      fetchJobs();
    }, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [fetchServerStatus, fetchJobs]);

  // Manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      fetchServerStatus(),
      fetchJobs(),
      fetchCredentials()
    ]);
    setIsRefreshing(false);
  };

  // Job actions
  const handlePauseJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/automation/jobs/${jobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paused' })
      });
      const result = await response.json();
      if (result.success) {
        fetchJobs();
      }
    } catch (err) {
      console.error('Failed to pause job:', err);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to cancel this job?')) return;
    try {
      const response = await fetch(`/api/automation/jobs/${jobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' })
      });
      const result = await response.json();
      if (result.success) {
        fetchJobs();
      }
    } catch (err) {
      console.error('Failed to cancel job:', err);
    }
  };

  const handleResumeJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/automation/jobs/${jobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'queued' })
      });
      const result = await response.json();
      if (result.success) {
        fetchJobs();
      }
    } catch (err) {
      console.error('Failed to resume job:', err);
    }
  };

  // Tab navigation
  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <Activity className="w-4 h-4" /> },
    { id: 'queue', label: 'Job Queue', icon: <List className="w-4 h-4" /> },
    { id: 'credentials', label: 'Credentials', icon: <Key className="w-4 h-4" /> },
    { id: 'logs', label: 'Logs', icon: <Terminal className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
            <Bot className="w-5 h-5 text-amber-400" />
            Toast Automation
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Browser automation for Toast POS configuration
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusWidget status={serverStatus} compact />
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowTriggerModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Job
          </button>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex gap-1 border-b border-gray-800 pb-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
              activeTab === tab.id
                ? 'bg-gray-800 text-amber-400 border-b-2 border-amber-400'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatsCard
              label="Queued"
              value={stats.queued}
              icon={<Clock className="w-6 h-6 text-blue-400" />}
              color="text-blue-400"
            />
            <StatsCard
              label="Running"
              value={stats.running}
              icon={<Zap className="w-6 h-6 text-yellow-400" />}
              color="text-yellow-400"
            />
            <StatsCard
              label="Completed Today"
              value={stats.completedToday}
              icon={<CheckCircle2 className="w-6 h-6 text-green-400" />}
              color="text-green-400"
            />
            <StatsCard
              label="Failed Today"
              value={stats.failedToday}
              icon={<AlertCircle className="w-6 h-6 text-red-400" />}
              color="text-red-400"
            />
            <StatsCard
              label="Success Rate"
              value={`${stats.successRate}%`}
              icon={<Activity className="w-6 h-6 text-amber-400" />}
              color="text-amber-400"
            />
          </div>

          {/* Active Job Section */}
          {activeJob ? (
            <ActiveJobCard
              job={activeJob}
              onPause={() => handlePauseJob(activeJob.id)}
              onCancel={() => handleCancelJob(activeJob.id)}
              onViewDetails={() => setSelectedJob(activeJob)}
            />
          ) : (
            <div className="admin-card p-8 text-center">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bot className="w-8 h-8 text-gray-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-400 mb-2">No Active Jobs</h3>
              <p className="text-gray-500 text-sm mb-4">
                {stats.queued > 0
                  ? `${stats.queued} jobs waiting in queue`
                  : 'Start a new automation job to configure Toast'}
              </p>
              <button
                onClick={() => setShowTriggerModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
              >
                <Play className="w-4 h-4" />
                Start New Job
              </button>
            </div>
          )}

          {/* Recent Jobs Quick View */}
          <div className="admin-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <List className="w-5 h-5 text-amber-400" />
                Recent Jobs
              </h3>
              <button
                onClick={() => setActiveTab('queue')}
                className="text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1"
              >
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <JobQueue
              jobs={jobs.slice(0, 5)}
              onSelectJob={setSelectedJob}
              compact
            />
          </div>

          {/* Quick Actions */}
          <div className="admin-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              Quick Actions
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button
                onClick={() => setShowTriggerModal(true)}
                className="flex flex-col items-center gap-2 p-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Plus className="w-6 h-6 text-amber-400" />
                <span className="text-sm text-gray-300">New Job</span>
              </button>
              <button
                onClick={() => setActiveTab('credentials')}
                className="flex flex-col items-center gap-2 p-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Key className="w-6 h-6 text-blue-400" />
                <span className="text-sm text-gray-300">Credentials</span>
              </button>
              <button
                onClick={handleRefresh}
                className="flex flex-col items-center gap-2 p-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <RefreshCw className="w-6 h-6 text-green-400" />
                <span className="text-sm text-gray-300">Refresh</span>
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className="flex flex-col items-center gap-2 p-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Terminal className="w-6 h-6 text-purple-400" />
                <span className="text-sm text-gray-300">View Logs</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Queue Tab */}
      {activeTab === 'queue' && (
        <JobQueue
          jobs={jobs}
          onSelectJob={setSelectedJob}
          onPauseJob={handlePauseJob}
          onCancelJob={handleCancelJob}
          onResumeJob={handleResumeJob}
        />
      )}

      {/* Credentials Tab */}
      {activeTab === 'credentials' && (
        <ClientCredentials
          credentials={credentials}
          onRefresh={fetchCredentials}
        />
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <AutomationLogs />
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="admin-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Automation Settings</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
              <div>
                <p className="text-white font-medium">Auto-approve low-risk jobs</p>
                <p className="text-gray-400 text-sm">Automatically approve menu uploads under 50 items</p>
              </div>
              <button className="px-3 py-1 bg-gray-700 text-gray-400 rounded text-sm">
                Disabled
              </button>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
              <div>
                <p className="text-white font-medium">Self-healing mode</p>
                <p className="text-gray-400 text-sm">Allow Observer AI to update selectors automatically</p>
              </div>
              <button className="px-3 py-1 bg-gray-700 text-gray-400 rounded text-sm">
                Disabled
              </button>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
              <div>
                <p className="text-white font-medium">Max concurrent sessions</p>
                <p className="text-gray-400 text-sm">Maximum browser instances running simultaneously</p>
              </div>
              <span className="text-amber-400 font-medium">5</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
              <div>
                <p className="text-white font-medium">Default retry count</p>
                <p className="text-gray-400 text-sm">Number of retries before marking job as failed</p>
              </div>
              <span className="text-amber-400 font-medium">3</span>
            </div>
          </div>
          <p className="text-gray-500 text-sm mt-4">
            Advanced settings are configured via feature flags in the Config tab.
          </p>
        </div>
      )}

      {/* Manual Trigger Modal */}
      {showTriggerModal && (
        <ManualTrigger
          onClose={() => setShowTriggerModal(false)}
          onJobCreated={() => {
            setShowTriggerModal(false);
            fetchJobs();
          }}
        />
      )}

      {/* Job Detail Modal */}
      {selectedJob && (
        <JobDetail
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onPause={() => handlePauseJob(selectedJob.id)}
          onCancel={() => handleCancelJob(selectedJob.id)}
          onResume={() => handleResumeJob(selectedJob.id)}
        />
      )}
    </div>
  );
};

export default AutomationDashboard;
