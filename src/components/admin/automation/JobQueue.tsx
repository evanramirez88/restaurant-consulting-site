import React, { useState } from 'react';
import {
  ListOrdered, Search, Filter, Clock, Building2, Play, Pause,
  CheckCircle, XCircle, AlertCircle, ChevronRight, Calendar,
  MoreVertical, Trash2, RefreshCw, Eye
} from 'lucide-react';
import type { AutomationJob } from './ActiveJobCard';

interface JobQueueProps {
  jobs: AutomationJob[];
  onSelectJob: (job: AutomationJob) => void;
  onStartJob?: (jobId: string) => void;
  onCancelJob?: (jobId: string) => void;
  onDeleteJob?: (jobId: string) => void;
  onRetryJob?: (jobId: string) => void;
  isLoading?: boolean;
}

type JobStatusFilter = 'all' | 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

const STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ElementType
}> = {
  queued: {
    label: 'Queued',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20 border-blue-500/50',
    icon: Clock
  },
  running: {
    label: 'Running',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20 border-yellow-500/50',
    icon: Play
  },
  paused: {
    label: 'Paused',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20 border-orange-500/50',
    icon: Pause
  },
  completed: {
    label: 'Completed',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20 border-green-500/50',
    icon: CheckCircle
  },
  failed: {
    label: 'Failed',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20 border-red-500/50',
    icon: XCircle
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20 border-gray-500/50',
    icon: XCircle
  }
};

const JOB_TYPE_LABELS: Record<string, string> = {
  menu_upload: 'Menu Upload',
  menu_sync: 'Menu Sync',
  pricing_update: 'Pricing Update',
  bulk_edit: 'Bulk Edit',
  report_generation: 'Report',
  custom: 'Custom'
};

const JobQueue: React.FC<JobQueueProps> = ({
  jobs,
  onSelectJob,
  onStartJob,
  onCancelJob,
  onDeleteJob,
  onRetryJob,
  isLoading = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobStatusFilter>('all');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const filteredJobs = jobs.filter(job => {
    // Status filter
    if (statusFilter !== 'all' && job.status !== statusFilter) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const clientName = (job.clientCompany || job.clientName || '').toLowerCase();
      const jobType = (JOB_TYPE_LABELS[job.jobType] || job.jobType).toLowerCase();
      return clientName.includes(query) || jobType.includes(query);
    }

    return true;
  });

  const statusCounts = jobs.reduce((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const formatScheduledTime = (timestamp: number | undefined): string => {
    if (!timestamp) return '-';
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();

    // If in the past, show actual date
    if (diffMs < 0) {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    }

    // If within 24 hours, show relative time
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 24) {
      if (diffHours < 1) {
        const diffMinutes = Math.floor(diffMs / 60000);
        return `in ${diffMinutes}m`;
      }
      return `in ${diffHours}h`;
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const handleActionClick = (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === jobId ? null : jobId);
  };

  const handleAction = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
    setOpenMenuId(null);
  };

  return (
    <div className="admin-card">
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ListOrdered className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-semibold text-white">Job Queue</h3>
          </div>
          <span className="text-sm text-gray-400">
            {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by client or task..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as JobStatusFilter)}
              className="pl-10 pr-8 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm appearance-none cursor-pointer"
            >
              <option value="all">All Status ({jobs.length})</option>
              {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                <option key={status} value={status}>
                  {config.label} ({statusCounts[status] || 0})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Jobs List */}
      <div className="divide-y divide-gray-700/50">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Loading jobs...</p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="p-12 text-center">
            <ListOrdered className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h4 className="text-white font-semibold mb-2">No Jobs Found</h4>
            <p className="text-gray-400 text-sm">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Queue up automation tasks to see them here'}
            </p>
          </div>
        ) : (
          filteredJobs.map(job => {
            const statusConfig = STATUS_CONFIG[job.status] || STATUS_CONFIG.queued;
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={job.id}
                className="p-4 hover:bg-gray-800/50 cursor-pointer transition-colors relative group"
                onClick={() => onSelectJob(job)}
              >
                <div className="flex items-center gap-4">
                  {/* Status Icon */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${statusConfig.bgColor}`}>
                    <StatusIcon className={`w-5 h-5 ${statusConfig.color}`} />
                  </div>

                  {/* Job Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-medium truncate">
                        {job.clientCompany || job.clientName}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs border ${statusConfig.bgColor}`}>
                        {statusConfig.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {job.jobTypeLabel || JOB_TYPE_LABELS[job.jobType] || job.jobType}
                      </span>
                      {job.startedAt && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatScheduledTime(job.startedAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress (for running jobs) */}
                  {job.status === 'running' && (
                    <div className="hidden sm:block w-24">
                      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 transition-all duration-300"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 text-center mt-1">{Math.round(job.progress)}%</p>
                    </div>
                  )}

                  {/* Actions Menu */}
                  <div className="relative">
                    <button
                      onClick={(e) => handleActionClick(e, job.id)}
                      className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {openMenuId === job.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(null);
                          }}
                        />
                        <div className="absolute right-0 top-full mt-1 w-40 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 py-1">
                          <button
                            onClick={(e) => handleAction(e, () => onSelectJob(job))}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                          >
                            <Eye className="w-4 h-4" />
                            View Details
                          </button>

                          {job.status === 'queued' && onStartJob && (
                            <button
                              onClick={(e) => handleAction(e, () => onStartJob(job.id))}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-green-400 hover:bg-gray-700"
                            >
                              <Play className="w-4 h-4" />
                              Start Now
                            </button>
                          )}

                          {job.status === 'failed' && onRetryJob && (
                            <button
                              onClick={(e) => handleAction(e, () => onRetryJob(job.id))}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-amber-400 hover:bg-gray-700"
                            >
                              <RefreshCw className="w-4 h-4" />
                              Retry
                            </button>
                          )}

                          {(job.status === 'queued' || job.status === 'running' || job.status === 'paused') && onCancelJob && (
                            <button
                              onClick={(e) => handleAction(e, () => onCancelJob(job.id))}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-gray-700"
                            >
                              <XCircle className="w-4 h-4" />
                              Cancel
                            </button>
                          )}

                          {(job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') && onDeleteJob && (
                            <button
                              onClick={(e) => handleAction(e, () => onDeleteJob(job.id))}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-gray-700"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Chevron */}
                  <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors" />
                </div>

                {/* Error message for failed jobs */}
                {job.status === 'failed' && job.errorMessage && (
                  <div className="mt-3 flex items-start gap-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-400 line-clamp-2">{job.errorMessage}</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Quick Stats Footer */}
      {jobs.length > 0 && (
        <div className="p-4 border-t border-gray-700 bg-gray-900/30">
          <div className="flex items-center justify-center gap-6 text-xs">
            {statusCounts.queued > 0 && (
              <span className="flex items-center gap-1.5 text-blue-400">
                <Clock className="w-3 h-3" />
                {statusCounts.queued} queued
              </span>
            )}
            {statusCounts.running > 0 && (
              <span className="flex items-center gap-1.5 text-yellow-400">
                <Play className="w-3 h-3" />
                {statusCounts.running} running
              </span>
            )}
            {statusCounts.completed > 0 && (
              <span className="flex items-center gap-1.5 text-green-400">
                <CheckCircle className="w-3 h-3" />
                {statusCounts.completed} completed
              </span>
            )}
            {statusCounts.failed > 0 && (
              <span className="flex items-center gap-1.5 text-red-400">
                <XCircle className="w-3 h-3" />
                {statusCounts.failed} failed
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default JobQueue;
