import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Pause,
  Play,
  Square,
  Image,
  ChevronRight,
  RefreshCw,
  Terminal,
  User,
  Calendar
} from 'lucide-react';
import { AutomationJob, AutomationJobStep } from './AutomationDashboard';

interface JobDetailProps {
  job: AutomationJob;
  onClose: () => void;
  onPause: () => void;
  onCancel: () => void;
  onResume: () => void;
}

const JobDetail: React.FC<JobDetailProps> = ({ job, onClose, onPause, onCancel, onResume }) => {
  const [steps, setSteps] = useState<AutomationJobStep[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStep, setSelectedStep] = useState<AutomationJobStep | null>(null);

  useEffect(() => {
    const fetchSteps = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/automation/jobs/${job.id}`);
        const result = await response.json();
        if (result.success && result.job?.steps) {
          setSteps(result.job.steps);
        }
      } catch (err) {
        console.error('Failed to fetch job steps:', err);
      }
      setIsLoading(false);
    };
    fetchSteps();
  }, [job.id]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'skipped':
        return <ChevronRight className="w-4 h-4 text-gray-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getJobTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      menu_upload: 'Menu Upload',
      menu_update: 'Menu Update',
      kds_config: 'KDS Configuration',
      printer_setup: 'Printer Setup',
      employee_setup: 'Employee Setup',
      tax_config: 'Tax Configuration',
      modifier_sync: 'Modifier Sync',
      revenue_center: 'Revenue Center',
      dining_options: 'Dining Options',
      full_setup: 'Full Setup',
      health_check: 'Health Check',
      backup: 'Backup',
      restore: 'Restore'
    };
    return labels[type] || type;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div>
            <h2 className="text-xl font-semibold text-white">
              {job.title || getJobTypeLabel(job.job_type)}
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              {job.client_company || job.client_name || 'Unknown Client'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Status and Actions Row */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              {/* Status Badge */}
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                job.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                job.status === 'running' ? 'bg-yellow-500/20 text-yellow-400' :
                job.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                job.status === 'paused' ? 'bg-blue-500/20 text-blue-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
              </span>

              {/* Progress */}
              {job.status === 'running' && (
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all"
                      style={{ width: `${job.progress_percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-400">{job.progress_percentage}%</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {job.status === 'running' && (
                <button
                  onClick={onPause}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg transition-colors"
                >
                  <Pause className="w-4 h-4" /> Pause
                </button>
              )}
              {job.status === 'paused' && (
                <button
                  onClick={onResume}
                  className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg transition-colors"
                >
                  <Play className="w-4 h-4" /> Resume
                </button>
              )}
              {['running', 'paused', 'queued'].includes(job.status) && (
                <button
                  onClick={onCancel}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors"
                >
                  <Square className="w-4 h-4" /> Cancel
                </button>
              )}
            </div>
          </div>

          {/* Job Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-xs uppercase mb-1">Job Type</p>
              <p className="text-white font-medium">{getJobTypeLabel(job.job_type)}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-xs uppercase mb-1">Created</p>
              <p className="text-white font-medium">
                {new Date(job.created_at).toLocaleString()}
              </p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-xs uppercase mb-1">Triggered By</p>
              <p className="text-white font-medium flex items-center gap-1">
                <User className="w-4 h-4 text-gray-500" />
                {job.triggered_by || 'Admin'}
              </p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-xs uppercase mb-1">Retries</p>
              <p className="text-white font-medium">{job.retry_count} / 3</p>
            </div>
          </div>

          {/* Current Step */}
          {job.current_step && job.status === 'running' && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                <span className="text-amber-400 font-medium">Currently Running</span>
              </div>
              <p className="text-white">
                Step {job.current_step_number || '?'} of {job.total_steps || '?'}: {job.current_step}
              </p>
            </div>
          )}

          {/* Error Message */}
          {job.error_message && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-red-400 font-medium">Error</span>
              </div>
              <p className="text-white font-mono text-sm">{job.error_message}</p>
            </div>
          )}

          {/* Steps Timeline */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Terminal className="w-5 h-5 text-amber-400" />
              Execution Steps
            </h3>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
              </div>
            ) : steps.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No steps recorded yet</p>
            ) : (
              <div className="space-y-2">
                {steps.map((step, index) => (
                  <div
                    key={step.id}
                    onClick={() => setSelectedStep(step)}
                    className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedStep?.id === step.id
                        ? 'bg-amber-500/20 border border-amber-500/30'
                        : 'bg-gray-800 hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      {getStatusIcon(step.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">
                        {step.step_number}. {step.step_name}
                      </p>
                      {step.step_description && (
                        <p className="text-gray-400 text-sm truncate">{step.step_description}</p>
                      )}
                    </div>
                    {step.screenshot_after_key && (
                      <Image className="w-4 h-4 text-gray-500" />
                    )}
                    {step.completed_at && step.started_at && (
                      <span className="text-gray-500 text-xs">
                        {formatDuration(Math.round((step.completed_at - step.started_at) / 1000))}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Step Detail / Screenshot */}
          {selectedStep && (
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="text-white font-medium mb-2">{selectedStep.step_name}</h4>
              {selectedStep.step_description && (
                <p className="text-gray-400 text-sm mb-4">{selectedStep.step_description}</p>
              )}
              {selectedStep.error_message && (
                <div className="bg-red-500/10 text-red-400 text-sm p-2 rounded mb-4">
                  {selectedStep.error_message}
                </div>
              )}
              {selectedStep.screenshot_after_key ? (
                <div className="bg-gray-900 rounded-lg p-2 text-center">
                  <p className="text-gray-500 text-sm">
                    Screenshot: {selectedStep.screenshot_after_key}
                  </p>
                  {/* TODO: Load actual screenshot from R2 */}
                </div>
              ) : (
                <p className="text-gray-500 text-sm text-center">No screenshot available</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-800 bg-gray-800/50">
          <p className="text-gray-500 text-sm">
            Job ID: <code className="text-gray-400">{job.id}</code>
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default JobDetail;
