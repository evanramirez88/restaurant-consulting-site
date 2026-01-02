import React, { useState, useEffect } from 'react';
import {
  Play, Pause, X, FileText, Clock, Timer, Building2,
  CheckCircle, AlertCircle, Loader2, Image, ChevronDown, ChevronUp
} from 'lucide-react';

/**
 * Individual step within an automation job
 */
export interface AutomationJobStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: number;
  completedAt?: number;
  error?: string;
  details?: string;
}

/**
 * Automation job data structure
 */
export interface AutomationJob {
  id: string;
  clientId: string;
  clientName: string;
  clientCompany?: string;
  jobType: 'menu_upload' | 'menu_sync' | 'pricing_update' | 'bulk_edit' | 'report_generation' | 'custom';
  jobTypeLabel?: string;
  status: 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  currentStep?: string;
  currentStepIndex?: number;
  totalSteps?: number;
  steps?: AutomationJobStep[];
  progress: number; // 0-100
  startedAt?: number;
  estimatedCompletionAt?: number;
  completedAt?: number;
  screenshotUrl?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

interface ActiveJobCardProps {
  job: AutomationJob | null;
  onPause?: (jobId: string) => void;
  onResume?: (jobId: string) => void;
  onCancel?: (jobId: string) => void;
  onViewLogs?: (jobId: string) => void;
}

const JOB_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  menu_upload: { label: 'Menu Upload', color: 'bg-blue-500/20 text-blue-400' },
  menu_sync: { label: 'Menu Sync', color: 'bg-green-500/20 text-green-400' },
  pricing_update: { label: 'Pricing Update', color: 'bg-amber-500/20 text-amber-400' },
  bulk_edit: { label: 'Bulk Edit', color: 'bg-purple-500/20 text-purple-400' },
  report_generation: { label: 'Report Generation', color: 'bg-cyan-500/20 text-cyan-400' },
  custom: { label: 'Custom Task', color: 'bg-gray-500/20 text-gray-400' }
};

const ActiveJobCard: React.FC<ActiveJobCardProps> = ({
  job,
  onPause,
  onResume,
  onCancel,
  onViewLogs
}) => {
  const [elapsedTime, setElapsedTime] = useState<string>('00:00');
  const [showSteps, setShowSteps] = useState(false);

  // Update elapsed time every second
  useEffect(() => {
    if (!job?.startedAt || job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return;
    }

    const updateElapsed = () => {
      const elapsed = Math.floor((Date.now() - job.startedAt! * 1000) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      setElapsedTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [job?.startedAt, job?.status]);

  const formatETA = (timestamp: number): string => {
    const eta = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = eta.getTime() - now.getTime();

    if (diffMs <= 0) return 'Any moment';

    const diffMinutes = Math.ceil(diffMs / 60000);
    if (diffMinutes < 60) return `~${diffMinutes}m remaining`;

    const diffHours = Math.floor(diffMinutes / 60);
    return `~${diffHours}h ${diffMinutes % 60}m remaining`;
  };

  const getStepIcon = (status: AutomationJobStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'skipped':
        return <X className="w-4 h-4 text-gray-500" />;
      default:
        return <div className="w-4 h-4 rounded-full border-2 border-gray-600" />;
    }
  };

  // Empty state
  if (!job) {
    return (
      <div className="admin-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Play className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-semibold text-white">Active Job</h3>
        </div>
        <div className="text-center py-8 bg-gray-900/30 rounded-lg border border-gray-700">
          <Loader2 className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500">No active jobs running</p>
          <p className="text-gray-600 text-sm mt-1">Jobs will appear here when started</p>
        </div>
      </div>
    );
  }

  const jobTypeConfig = JOB_TYPE_CONFIG[job.jobType] || JOB_TYPE_CONFIG.custom;
  const isPaused = job.status === 'paused';
  const isRunning = job.status === 'running';

  return (
    <div className="admin-card p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <Play className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-semibold text-white">Active Job</h3>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium ${jobTypeConfig.color}`}>
          {job.jobTypeLabel || jobTypeConfig.label}
        </span>
      </div>

      {/* Client Info */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center">
          <Building2 className="w-5 h-5 text-gray-400" />
        </div>
        <div>
          <p className="text-white font-medium">{job.clientCompany || job.clientName}</p>
          {job.clientCompany && (
            <p className="text-gray-500 text-sm">{job.clientName}</p>
          )}
        </div>
      </div>

      {/* Current Step */}
      {job.currentStep && (
        <div className="mb-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
          <p className="text-xs text-gray-500 mb-1">Current Step</p>
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
            <p className="text-white font-medium">{job.currentStep}</p>
            {job.currentStepIndex !== undefined && job.totalSteps && (
              <span className="text-gray-500 text-sm">
                ({job.currentStepIndex + 1}/{job.totalSteps})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Progress</span>
          <span className="text-sm font-medium text-white">{Math.round(job.progress)}%</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              isPaused ? 'bg-yellow-500' : 'bg-amber-500'
            }`}
            style={{ width: `${job.progress}%` }}
          />
        </div>
      </div>

      {/* Time Info */}
      <div className="flex items-center gap-4 mb-4 text-sm">
        <div className="flex items-center gap-1.5 text-gray-400">
          <Clock className="w-4 h-4" />
          <span>Elapsed: <span className="text-white font-mono">{elapsedTime}</span></span>
        </div>
        {job.estimatedCompletionAt && isRunning && (
          <div className="flex items-center gap-1.5 text-gray-400">
            <Timer className="w-4 h-4" />
            <span>{formatETA(job.estimatedCompletionAt)}</span>
          </div>
        )}
      </div>

      {/* Screenshot Placeholder */}
      <div className="mb-4">
        <div className="aspect-video bg-gray-900/50 rounded-lg border border-gray-700 flex items-center justify-center overflow-hidden">
          {job.screenshotUrl ? (
            <img
              src={job.screenshotUrl}
              alt="Automation screenshot"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center p-4">
              <Image className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-600 text-sm">Screenshot will appear here</p>
            </div>
          )}
        </div>
      </div>

      {/* Steps Accordion */}
      {job.steps && job.steps.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowSteps(!showSteps)}
            className="flex items-center justify-between w-full p-3 bg-gray-900/50 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
          >
            <span className="text-sm text-gray-400">
              Steps ({job.steps.filter(s => s.status === 'completed').length}/{job.steps.length} completed)
            </span>
            {showSteps ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {showSteps && (
            <div className="mt-2 space-y-2">
              {job.steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`flex items-center gap-3 p-2 rounded-lg ${
                    step.status === 'running'
                      ? 'bg-amber-500/10 border border-amber-500/30'
                      : 'bg-gray-900/30'
                  }`}
                >
                  {getStepIcon(step.status)}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${
                      step.status === 'completed' ? 'text-gray-400' :
                      step.status === 'running' ? 'text-white' :
                      step.status === 'failed' ? 'text-red-400' :
                      'text-gray-500'
                    }`}>
                      {step.name}
                    </p>
                    {step.error && (
                      <p className="text-xs text-red-400 truncate">{step.error}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-600">#{index + 1}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {job.errorMessage && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-400">{job.errorMessage}</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {isRunning && onPause && (
          <button
            onClick={() => onPause(job.id)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 font-medium rounded-lg transition-colors"
          >
            <Pause className="w-4 h-4" />
            Pause
          </button>
        )}

        {isPaused && onResume && (
          <button
            onClick={() => onResume(job.id)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 font-medium rounded-lg transition-colors"
          >
            <Play className="w-4 h-4" />
            Resume
          </button>
        )}

        {(isRunning || isPaused) && onCancel && (
          <button
            onClick={() => onCancel(job.id)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
        )}

        {onViewLogs && (
          <button
            onClick={() => onViewLogs(job.id)}
            className="flex items-center justify-center gap-2 px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="View Logs"
          >
            <FileText className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default ActiveJobCard;
