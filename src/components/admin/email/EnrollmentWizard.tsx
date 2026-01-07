import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X, Mail, Users, Calendar, Clock, Play, Pause, Search, AlertCircle,
  Check, ChevronRight, ChevronLeft, Loader2, AlertTriangle, CheckCircle,
  FileText, Filter, UserPlus, Zap, Timer, ListChecks, Settings, Eye
} from 'lucide-react';

// TypeScript Interfaces
interface EmailSequence {
  id: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  step_count?: number;
  subscriber_count?: number;
  steps?: SequenceStep[];
}

interface SequenceStep {
  id: string;
  step_number: number;
  subject: string;
  delay_days: number;
}

interface Segment {
  id: string;
  name: string;
  cached_count: number;
  segment_type: string;
}

interface Subscriber {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  status: string;
}

interface EnrollmentConfig {
  source: 'manual' | 'segment' | 'all';
  emails: string[];
  segmentId: string | null;
  filters: {
    status?: string[];
    pos_system?: string[];
    geographic_tier?: string[];
  };
  scheduleType: 'immediate' | 'scheduled' | 'drip';
  scheduledAt: Date | null;
  timezone: string;
  dripConfig: {
    perHour?: number;
    perDay?: number;
    startAt: Date | null;
  };
  excludeEnrolled: boolean;
}

interface EnrollmentProgress {
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'failed';
  totalCount: number;
  processedCount: number;
  successCount: number;
  errorCount: number;
  errors: Array<{ email: string; error: string }>;
  estimatedCompletion?: Date;
}

interface EnrollmentWizardProps {
  // Pre-selected values (optional)
  sequenceId?: string;
  subscriberId?: string;
  subscriberEmail?: string;
  // Callbacks
  onClose: () => void;
  onComplete?: () => void;
  // Mode
  mode?: 'full' | 'quick'; // 'quick' for single subscriber enrollment
}

const STEPS = [
  { id: 1, label: 'Select Sequence', icon: Mail },
  { id: 2, label: 'Choose Subscribers', icon: Users },
  { id: 3, label: 'Schedule', icon: Calendar },
  { id: 4, label: 'Review & Confirm', icon: CheckCircle }
];

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern (ET)' },
  { value: 'America/Chicago', label: 'Central (CT)' },
  { value: 'America/Denver', label: 'Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST)' },
  { value: 'America/Anchorage', label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (HST)' },
  { value: 'UTC', label: 'UTC' }
];

const EnrollmentWizard: React.FC<EnrollmentWizardProps> = ({
  sequenceId: initialSequenceId,
  subscriberId,
  subscriberEmail,
  onClose,
  onComplete,
  mode = 'full'
}) => {
  // Current step
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Sequence Selection
  const [sequences, setSequences] = useState<EmailSequence[]>([]);
  const [isLoadingSequences, setIsLoadingSequences] = useState(true);
  const [selectedSequence, setSelectedSequence] = useState<EmailSequence | null>(null);
  const [sequenceSearch, setSequenceSearch] = useState('');
  const [onlyActiveSequences, setOnlyActiveSequences] = useState(true);

  // Step 2: Subscriber Selection
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isLoadingSegments, setIsLoadingSegments] = useState(false);
  const [config, setConfig] = useState<EnrollmentConfig>({
    source: subscriberId ? 'manual' : 'manual',
    emails: subscriberEmail ? [subscriberEmail] : [],
    segmentId: null,
    filters: {},
    scheduleType: 'immediate',
    scheduledAt: null,
    timezone: 'America/New_York',
    dripConfig: {
      perHour: undefined,
      perDay: 100,
      startAt: null
    },
    excludeEnrolled: true
  });
  const [emailInput, setEmailInput] = useState(subscriberEmail || '');
  const [validEmails, setValidEmails] = useState<string[]>(subscriberEmail ? [subscriberEmail] : []);
  const [invalidEmails, setInvalidEmails] = useState<string[]>([]);
  const [duplicateEmails, setDuplicateEmails] = useState<string[]>([]);
  const [subscriberPreview, setSubscriberPreview] = useState<Subscriber[]>([]);
  const [totalSubscriberCount, setTotalSubscriberCount] = useState(0);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Step 4: Enrollment Progress
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [progress, setProgress] = useState<EnrollmentProgress | null>(null);

  // General state
  const [error, setError] = useState<string | null>(null);

  // Load sequences on mount
  useEffect(() => {
    loadSequences();
    if (mode === 'full') {
      loadSegments();
    }
  }, [mode]);

  // Auto-select sequence if provided
  useEffect(() => {
    if (initialSequenceId && sequences.length > 0) {
      const seq = sequences.find(s => s.id === initialSequenceId);
      if (seq) {
        setSelectedSequence(seq);
        loadSequenceDetails(seq.id);
        if (subscriberId || subscriberEmail) {
          setCurrentStep(2);
        }
      }
    }
  }, [initialSequenceId, sequences, subscriberId, subscriberEmail]);

  const loadSequences = async () => {
    setIsLoadingSequences(true);
    try {
      const params = new URLSearchParams();
      if (onlyActiveSequences) {
        params.append('status', 'active');
      }

      const response = await fetch(`/api/admin/email/sequences?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setSequences(result.data || []);
      } else {
        setError(result.error || 'Failed to load sequences');
      }
    } catch (err) {
      setError('Failed to load sequences');
    } finally {
      setIsLoadingSequences(false);
    }
  };

  const loadSequenceDetails = async (seqId: string) => {
    try {
      const response = await fetch(`/api/admin/email/sequences/${seqId}/steps`);
      const result = await response.json();

      if (result.success && selectedSequence) {
        setSelectedSequence({
          ...selectedSequence,
          steps: result.data || []
        });
      }
    } catch (err) {
      console.error('Failed to load sequence steps:', err);
    }
  };

  const loadSegments = async () => {
    setIsLoadingSegments(true);
    try {
      const response = await fetch('/api/admin/email/segments');
      const result = await response.json();

      if (result.success) {
        setSegments(result.data || []);
      }
    } catch (err) {
      console.error('Failed to load segments:', err);
    } finally {
      setIsLoadingSegments(false);
    }
  };

  const loadSubscriberPreview = useCallback(async () => {
    if (config.source === 'manual' && validEmails.length === 0) {
      setSubscriberPreview([]);
      setTotalSubscriberCount(0);
      return;
    }

    setIsLoadingPreview(true);
    try {
      let endpoint = '/api/admin/email/subscribers?limit=10';

      if (config.source === 'segment' && config.segmentId) {
        endpoint = `/api/admin/email/segments/${config.segmentId}/members?limit=10`;
      } else if (config.source === 'all') {
        const params = new URLSearchParams({ limit: '10' });
        if (config.filters.status?.length) {
          params.append('statuses', config.filters.status.join(','));
        }
        if (config.filters.pos_system?.length) {
          params.append('pos_systems', config.filters.pos_system.join(','));
        }
        if (config.filters.geographic_tier?.length) {
          params.append('geographic_tiers', config.filters.geographic_tier.join(','));
        }
        endpoint = `/api/admin/email/subscribers?${params.toString()}`;
      }

      const response = await fetch(endpoint);
      const result = await response.json();

      if (result.success) {
        if (config.source === 'manual') {
          setSubscriberPreview([]);
          setTotalSubscriberCount(validEmails.length);
        } else if (config.source === 'segment') {
          setSubscriberPreview(result.data || []);
          // Get segment member count
          const segment = segments.find(s => s.id === config.segmentId);
          setTotalSubscriberCount(segment?.cached_count || result.data?.length || 0);
        } else {
          setSubscriberPreview(result.data || []);
          setTotalSubscriberCount(result.pagination?.total || result.data?.length || 0);
        }
      }
    } catch (err) {
      console.error('Failed to load subscriber preview:', err);
    } finally {
      setIsLoadingPreview(false);
    }
  }, [config.source, config.segmentId, config.filters, validEmails, segments]);

  // Load preview when source changes
  useEffect(() => {
    if (currentStep === 2) {
      loadSubscriberPreview();
    }
  }, [currentStep, config.source, config.segmentId, validEmails.length, loadSubscriberPreview]);

  // Parse and validate emails
  const parseEmails = useCallback((input: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const lines = input.split(/[\n,]+/).map(e => e.trim().toLowerCase()).filter(Boolean);

    const valid: string[] = [];
    const invalid: string[] = [];
    const duplicates: string[] = [];
    const seen = new Set<string>();

    for (const email of lines) {
      if (!emailRegex.test(email)) {
        invalid.push(email);
      } else if (seen.has(email)) {
        duplicates.push(email);
      } else {
        valid.push(email);
        seen.add(email);
      }
    }

    setValidEmails(valid);
    setInvalidEmails(invalid);
    setDuplicateEmails(duplicates);
    setConfig(prev => ({ ...prev, emails: valid }));
  }, []);

  // Handle email input changes
  useEffect(() => {
    const timer = setTimeout(() => {
      parseEmails(emailInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [emailInput, parseEmails]);

  // Filter sequences
  const filteredSequences = useMemo(() => {
    let filtered = sequences;

    if (onlyActiveSequences) {
      filtered = filtered.filter(s => s.status === 'active');
    }

    if (sequenceSearch) {
      const search = sequenceSearch.toLowerCase();
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(search) ||
        s.description?.toLowerCase().includes(search)
      );
    }

    return filtered;
  }, [sequences, onlyActiveSequences, sequenceSearch]);

  // Handle enrollment
  const handleStartEnrollment = async () => {
    if (!selectedSequence) return;

    setIsEnrolling(true);
    setError(null);

    try {
      const payload: any = {
        source: config.source,
        schedule: config.scheduleType,
        exclude_enrolled: config.excludeEnrolled
      };

      if (config.source === 'manual') {
        payload.emails = config.emails;
      } else if (config.source === 'segment') {
        payload.segment_id = config.segmentId;
      } else {
        payload.filters = config.filters;
      }

      if (config.scheduleType === 'scheduled' && config.scheduledAt) {
        payload.scheduled_at = Math.floor(config.scheduledAt.getTime() / 1000);
        payload.timezone = config.timezone;
      }

      if (config.scheduleType === 'drip') {
        payload.drip_config = {
          per_hour: config.dripConfig.perHour,
          per_day: config.dripConfig.perDay,
          start_at: config.dripConfig.startAt ? Math.floor(config.dripConfig.startAt.getTime() / 1000) : Math.floor(Date.now() / 1000)
        };
      }

      const response = await fetch(`/api/admin/email/sequences/${selectedSequence.id}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.success) {
        setEnrollmentId(result.data.id);
        setProgress({
          status: result.data.status,
          totalCount: result.data.total_count,
          processedCount: result.data.processed_count || 0,
          successCount: result.data.success_count || 0,
          errorCount: result.data.error_count || 0,
          errors: []
        });

        // If immediate, poll for progress
        if (config.scheduleType === 'immediate') {
          pollEnrollmentProgress(result.data.id);
        }
      } else {
        setError(result.error || 'Failed to start enrollment');
        setIsEnrolling(false);
      }
    } catch (err) {
      setError('Failed to start enrollment');
      setIsEnrolling(false);
    }
  };

  // Poll enrollment progress
  const pollEnrollmentProgress = useCallback(async (enrollId: string) => {
    try {
      const response = await fetch(`/api/admin/email/sequences/enrollments/${enrollId}`);
      const result = await response.json();

      if (result.success) {
        setProgress({
          status: result.data.status,
          totalCount: result.data.total_count,
          processedCount: result.data.processed_count,
          successCount: result.data.success_count,
          errorCount: result.data.error_count,
          errors: result.data.errors || []
        });

        // Continue polling if still processing
        if (result.data.status === 'processing') {
          setTimeout(() => pollEnrollmentProgress(enrollId), 2000);
        } else {
          setIsEnrolling(false);
        }
      }
    } catch (err) {
      console.error('Failed to poll progress:', err);
    }
  }, []);

  // Cancel enrollment
  const handleCancelEnrollment = async () => {
    if (!enrollmentId) return;

    try {
      const response = await fetch(`/api/admin/email/sequences/enrollments/${enrollmentId}/cancel`, {
        method: 'POST'
      });

      const result = await response.json();

      if (result.success) {
        setProgress(prev => prev ? { ...prev, status: 'cancelled' } : null);
        setIsEnrolling(false);
      }
    } catch (err) {
      console.error('Failed to cancel enrollment:', err);
    }
  };

  // Check if step is valid
  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!selectedSequence;
      case 2:
        if (config.source === 'manual') {
          return validEmails.length > 0;
        } else if (config.source === 'segment') {
          return !!config.segmentId;
        }
        return true; // 'all' is always valid
      case 3:
        if (config.scheduleType === 'scheduled') {
          return !!config.scheduledAt && config.scheduledAt > new Date();
        }
        if (config.scheduleType === 'drip') {
          return (!!config.dripConfig.perHour || !!config.dripConfig.perDay) && !!config.dripConfig.startAt;
        }
        return true;
      case 4:
        return true;
      default:
        return false;
    }
  };

  // Navigate steps
  const goToStep = (step: number) => {
    if (step < currentStep || isStepValid(currentStep)) {
      setCurrentStep(step);
    }
  };

  const goNext = () => {
    if (currentStep < 4 && isStepValid(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Format date for display
  const formatDate = (date: Date | null) => {
    if (!date) return '-';
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  // Get type badge
  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      drip: 'bg-purple-500/20 text-purple-400',
      behavior: 'bg-orange-500/20 text-orange-400',
      onboarding: 'bg-green-500/20 text-green-400',
      reengagement: 'bg-amber-500/20 text-amber-400',
      transactional: 'bg-blue-500/20 text-blue-400',
      newsletter: 'bg-pink-500/20 text-pink-400'
    };
    return (
      <span className={`px-2 py-0.5 text-xs rounded ${colors[type] || 'bg-gray-500/20 text-gray-400'}`}>
        {type}
      </span>
    );
  };

  // Quick mode - simplified flow
  if (mode === 'quick' && subscriberId) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="admin-card w-full max-w-md">
          <div className="p-6 border-b border-gray-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-amber-400" />
              Quick Enroll Subscriber
            </h3>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            {subscriberEmail && (
              <div className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Subscriber</p>
                <p className="text-white">{subscriberEmail}</p>
              </div>
            )}

            <div>
              <label className="block text-sm text-gray-400 mb-2">Select Sequence</label>
              {isLoadingSequences ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {filteredSequences.map(seq => (
                    <button
                      key={seq.id}
                      onClick={() => setSelectedSequence(seq)}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                        selectedSequence?.id === seq.id
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                          : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      <p className="font-medium">{seq.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {getTypeBadge(seq.type)}
                        <span className="text-xs text-gray-500">
                          {seq.step_count || 0} steps
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.scheduleType === 'immediate'}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    scheduleType: e.target.checked ? 'immediate' : 'scheduled'
                  }))}
                  className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500"
                />
                <span className="text-sm text-gray-300">Start immediately</span>
              </label>
            </div>

            {config.scheduleType === 'scheduled' && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">Schedule for</label>
                <input
                  type="datetime-local"
                  value={config.scheduledAt ? config.scheduledAt.toISOString().slice(0, 16) : ''}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    scheduledAt: e.target.value ? new Date(e.target.value) : null
                  }))}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span className="text-red-400 text-sm">{error}</span>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleStartEnrollment}
              disabled={!selectedSequence || isEnrolling}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 disabled:text-gray-400 text-white font-medium rounded-lg transition-colors"
            >
              {isEnrolling ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Enroll
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto py-8">
      <div className="admin-card w-full max-w-4xl mx-4">
        {/* Header */}
        <div className="p-6 border-b border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-amber-400" />
            Enrollment Wizard
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-gray-700 bg-gray-800/30">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => goToStep(step.id)}
                  disabled={step.id > currentStep && !isStepValid(currentStep)}
                  className={`flex items-center gap-3 ${
                    currentStep === step.id
                      ? 'text-amber-400'
                      : step.id < currentStep
                        ? 'text-green-400'
                        : 'text-gray-500'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                    currentStep === step.id
                      ? 'border-amber-400 bg-amber-500/20'
                      : step.id < currentStep
                        ? 'border-green-400 bg-green-500/20'
                        : 'border-gray-600 bg-gray-800'
                  }`}>
                    {step.id < currentStep ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <step.icon className="w-5 h-5" />
                    )}
                  </div>
                  <span className="hidden sm:inline text-sm font-medium">{step.label}</span>
                </button>
                {index < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-4 ${
                    step.id < currentStep ? 'bg-green-400' : 'bg-gray-700'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 min-h-[400px]">
          {/* Error Display */}
          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <span className="text-red-400">{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-400 hover:text-red-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 1: Select Sequence */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search sequences..."
                    value={sequenceSearch}
                    onChange={(e) => setSequenceSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onlyActiveSequences}
                    onChange={(e) => setOnlyActiveSequences(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500"
                  />
                  <span className="text-sm text-gray-300">Only active sequences</span>
                </label>
              </div>

              {isLoadingSequences ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                </div>
              ) : filteredSequences.length === 0 ? (
                <div className="text-center py-12">
                  <Mail className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-white font-semibold mb-2">No Sequences Found</h3>
                  <p className="text-gray-400 text-sm">
                    {sequenceSearch ? 'Try adjusting your search' : 'Create a sequence first to enroll subscribers'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto">
                  {filteredSequences.map(seq => (
                    <button
                      key={seq.id}
                      onClick={() => {
                        setSelectedSequence(seq);
                        loadSequenceDetails(seq.id);
                      }}
                      className={`text-left p-4 rounded-lg border transition-all ${
                        selectedSequence?.id === seq.id
                          ? 'bg-amber-500/20 border-amber-500/50'
                          : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className={`font-semibold ${
                          selectedSequence?.id === seq.id ? 'text-amber-400' : 'text-white'
                        }`}>
                          {seq.name}
                        </h4>
                        {selectedSequence?.id === seq.id && (
                          <Check className="w-5 h-5 text-amber-400 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        {getTypeBadge(seq.type)}
                        <span className={`px-2 py-0.5 text-xs rounded ${
                          seq.status === 'active'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {seq.status}
                        </span>
                      </div>
                      {seq.description && (
                        <p className="text-gray-400 text-sm line-clamp-2 mb-2">{seq.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <ListChecks className="w-3 h-3" />
                          {seq.step_count || 0} steps
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {seq.subscriber_count || 0} enrolled
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Sequence Preview */}
              {selectedSequence?.steps && selectedSequence.steps.length > 0 && (
                <div className="bg-gray-800/30 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    Email Preview (first 3 steps)
                  </h4>
                  <div className="space-y-2">
                    {selectedSequence.steps.slice(0, 3).map((step, index) => (
                      <div key={step.id} className="flex items-center gap-3 text-sm">
                        <span className="w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-xs text-gray-400">
                          {index + 1}
                        </span>
                        <span className="text-white flex-1 truncate">{step.subject}</span>
                        <span className="text-gray-500 text-xs">
                          {step.delay_days > 0 ? `+${step.delay_days}d` : 'Immediate'}
                        </span>
                      </div>
                    ))}
                    {selectedSequence.steps.length > 3 && (
                      <p className="text-xs text-gray-500 pl-9">
                        +{selectedSequence.steps.length - 3} more steps...
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Choose Subscribers */}
          {currentStep === 2 && (
            <div className="space-y-6">
              {/* Source Tabs */}
              <div className="flex border-b border-gray-700">
                {[
                  { id: 'manual', label: 'Manual Entry', icon: FileText },
                  { id: 'segment', label: 'Select Segment', icon: Layers },
                  { id: 'all', label: 'All Subscribers', icon: Users }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setConfig(prev => ({
                      ...prev,
                      source: tab.id as 'manual' | 'segment' | 'all'
                    }))}
                    className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                      config.source === tab.id
                        ? 'text-amber-400 border-amber-400'
                        : 'text-gray-400 border-transparent hover:text-white'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Manual Entry */}
              {config.source === 'manual' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Paste email addresses (one per line or comma-separated)
                    </label>
                    <textarea
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="john@example.com&#10;jane@example.com&#10;bob@example.com"
                      rows={8}
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono text-sm resize-none"
                    />
                  </div>

                  {/* Email validation results */}
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span className="flex items-center gap-1 text-green-400">
                      <Check className="w-4 h-4" />
                      {validEmails.length} valid
                    </span>
                    {invalidEmails.length > 0 && (
                      <span className="flex items-center gap-1 text-red-400">
                        <AlertTriangle className="w-4 h-4" />
                        {invalidEmails.length} invalid
                      </span>
                    )}
                    {duplicateEmails.length > 0 && (
                      <span className="flex items-center gap-1 text-yellow-400">
                        <AlertCircle className="w-4 h-4" />
                        {duplicateEmails.length} duplicates
                      </span>
                    )}
                  </div>

                  {/* Show invalid emails */}
                  {invalidEmails.length > 0 && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                      <p className="text-red-400 text-sm font-medium mb-2">Invalid emails:</p>
                      <div className="flex flex-wrap gap-1">
                        {invalidEmails.slice(0, 10).map((email, i) => (
                          <span key={i} className="px-2 py-0.5 bg-red-500/20 text-red-300 text-xs rounded">
                            {email}
                          </span>
                        ))}
                        {invalidEmails.length > 10 && (
                          <span className="text-xs text-red-400">+{invalidEmails.length - 10} more</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Segment Selection */}
              {config.source === 'segment' && (
                <div className="space-y-4">
                  {isLoadingSegments ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                    </div>
                  ) : segments.length === 0 ? (
                    <div className="text-center py-8">
                      <Layers className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400">No segments available</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {segments.map(segment => (
                        <button
                          key={segment.id}
                          onClick={() => setConfig(prev => ({
                            ...prev,
                            segmentId: segment.id
                          }))}
                          className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                            config.segmentId === segment.id
                              ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                              : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{segment.name}</span>
                            <span className={`px-2 py-0.5 text-xs rounded ${
                              segment.segment_type === 'dynamic'
                                ? 'bg-purple-500/20 text-purple-400'
                                : 'bg-blue-500/20 text-blue-400'
                            }`}>
                              {segment.segment_type}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {segment.cached_count.toLocaleString()} members
                          </p>
                        </button>
                      ))}
                    </div>
                  )}

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.excludeEnrolled}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        excludeEnrolled: e.target.checked
                      }))}
                      className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500"
                    />
                    <span className="text-sm text-gray-300">Exclude already enrolled subscribers</span>
                  </label>
                </div>
              )}

              {/* All Subscribers */}
              {config.source === 'all' && (
                <div className="space-y-4">
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-yellow-400 font-medium">
                        Warning: This will enroll all matching subscribers
                      </p>
                      <p className="text-yellow-300/70 text-sm mt-1">
                        {totalSubscriberCount > 0
                          ? `Approximately ${totalSubscriberCount.toLocaleString()} subscribers will be enrolled`
                          : 'Use filters below to narrow down the selection'
                        }
                      </p>
                    </div>
                  </div>

                  {/* Filters */}
                  <div className="bg-gray-800/30 rounded-lg p-4 space-y-4">
                    <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                      <Filter className="w-4 h-4" />
                      Optional Filters
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Status</label>
                        <select
                          value={config.filters.status?.join(',') || ''}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            filters: {
                              ...prev.filters,
                              status: e.target.value ? e.target.value.split(',') : undefined
                            }
                          }))}
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                          <option value="">All statuses</option>
                          <option value="active">Active only</option>
                          <option value="unsubscribed">Unsubscribed</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-gray-400 mb-1">POS System</label>
                        <select
                          value={config.filters.pos_system?.join(',') || ''}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            filters: {
                              ...prev.filters,
                              pos_system: e.target.value ? e.target.value.split(',') : undefined
                            }
                          }))}
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                          <option value="">All POS systems</option>
                          <option value="toast">Toast</option>
                          <option value="square">Square</option>
                          <option value="clover">Clover</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.excludeEnrolled}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        excludeEnrolled: e.target.checked
                      }))}
                      className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500"
                    />
                    <span className="text-sm text-gray-300">Exclude already enrolled subscribers</span>
                  </label>
                </div>
              )}

              {/* Preview */}
              {(config.source !== 'manual' || validEmails.length > 0) && (
                <div className="bg-gray-800/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      Preview
                    </h4>
                    {isLoadingPreview ? (
                      <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                    ) : (
                      <span className="text-sm text-amber-400">
                        {totalSubscriberCount.toLocaleString()} subscribers
                      </span>
                    )}
                  </div>

                  {config.source === 'manual' ? (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {validEmails.slice(0, 5).map((email, i) => (
                        <div key={i} className="text-sm text-gray-400">{email}</div>
                      ))}
                      {validEmails.length > 5 && (
                        <p className="text-xs text-gray-500">+{validEmails.length - 5} more</p>
                      )}
                    </div>
                  ) : subscriberPreview.length > 0 ? (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {subscriberPreview.map(sub => (
                        <div key={sub.id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-300">{sub.email}</span>
                          <span className={`px-1.5 py-0.5 text-xs rounded ${
                            sub.status === 'active'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {sub.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Schedule */}
          {currentStep === 3 && (
            <div className="space-y-6">
              {/* Schedule Type Selection */}
              <div className="space-y-4">
                {/* Immediate */}
                <button
                  onClick={() => setConfig(prev => ({ ...prev, scheduleType: 'immediate' }))}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${
                    config.scheduleType === 'immediate'
                      ? 'bg-amber-500/20 border-amber-500/50'
                      : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      config.scheduleType === 'immediate' ? 'bg-amber-500/30' : 'bg-gray-700'
                    }`}>
                      <Zap className={`w-5 h-5 ${
                        config.scheduleType === 'immediate' ? 'text-amber-400' : 'text-gray-400'
                      }`} />
                    </div>
                    <div>
                      <h4 className={`font-semibold ${
                        config.scheduleType === 'immediate' ? 'text-amber-400' : 'text-white'
                      }`}>
                        Start Immediately
                      </h4>
                      <p className="text-gray-400 text-sm">Begin sending emails right now</p>
                    </div>
                    {config.scheduleType === 'immediate' && (
                      <Check className="w-5 h-5 text-amber-400 ml-auto" />
                    )}
                  </div>
                </button>

                {/* Scheduled */}
                <button
                  onClick={() => setConfig(prev => ({ ...prev, scheduleType: 'scheduled' }))}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${
                    config.scheduleType === 'scheduled'
                      ? 'bg-amber-500/20 border-amber-500/50'
                      : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      config.scheduleType === 'scheduled' ? 'bg-amber-500/30' : 'bg-gray-700'
                    }`}>
                      <Calendar className={`w-5 h-5 ${
                        config.scheduleType === 'scheduled' ? 'text-amber-400' : 'text-gray-400'
                      }`} />
                    </div>
                    <div>
                      <h4 className={`font-semibold ${
                        config.scheduleType === 'scheduled' ? 'text-amber-400' : 'text-white'
                      }`}>
                        Schedule for Later
                      </h4>
                      <p className="text-gray-400 text-sm">Choose a specific date and time</p>
                    </div>
                    {config.scheduleType === 'scheduled' && (
                      <Check className="w-5 h-5 text-amber-400 ml-auto" />
                    )}
                  </div>
                </button>

                {/* Drip Start */}
                <button
                  onClick={() => setConfig(prev => ({ ...prev, scheduleType: 'drip' }))}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${
                    config.scheduleType === 'drip'
                      ? 'bg-amber-500/20 border-amber-500/50'
                      : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      config.scheduleType === 'drip' ? 'bg-amber-500/30' : 'bg-gray-700'
                    }`}>
                      <Timer className={`w-5 h-5 ${
                        config.scheduleType === 'drip' ? 'text-amber-400' : 'text-gray-400'
                      }`} />
                    </div>
                    <div>
                      <h4 className={`font-semibold ${
                        config.scheduleType === 'drip' ? 'text-amber-400' : 'text-white'
                      }`}>
                        Stagger Enrollment
                      </h4>
                      <p className="text-gray-400 text-sm">Gradually enroll subscribers over time</p>
                    </div>
                    {config.scheduleType === 'drip' && (
                      <Check className="w-5 h-5 text-amber-400 ml-auto" />
                    )}
                  </div>
                </button>
              </div>

              {/* Schedule Options */}
              {config.scheduleType === 'scheduled' && (
                <div className="bg-gray-800/30 rounded-lg p-4 space-y-4">
                  <h4 className="text-sm font-medium text-gray-300">Schedule Details</h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Date & Time</label>
                      <input
                        type="datetime-local"
                        value={config.scheduledAt ? config.scheduledAt.toISOString().slice(0, 16) : ''}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          scheduledAt: e.target.value ? new Date(e.target.value) : null
                        }))}
                        min={new Date().toISOString().slice(0, 16)}
                        className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Timezone</label>
                      <select
                        value={config.timezone}
                        onChange={(e) => setConfig(prev => ({ ...prev, timezone: e.target.value }))}
                        className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        {TIMEZONES.map(tz => (
                          <option key={tz.value} value={tz.value}>{tz.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {config.scheduledAt && (
                    <p className="text-sm text-gray-400">
                      Scheduled for: <span className="text-white">{formatDate(config.scheduledAt)}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Drip Options */}
              {config.scheduleType === 'drip' && (
                <div className="bg-gray-800/30 rounded-lg p-4 space-y-4">
                  <h4 className="text-sm font-medium text-gray-300">Drip Configuration</h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Enrollees per day</label>
                      <input
                        type="number"
                        value={config.dripConfig.perDay || ''}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          dripConfig: {
                            ...prev.dripConfig,
                            perDay: e.target.value ? parseInt(e.target.value) : undefined,
                            perHour: undefined
                          }
                        }))}
                        placeholder="e.g., 100"
                        min="1"
                        className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Or enrollees per hour</label>
                      <input
                        type="number"
                        value={config.dripConfig.perHour || ''}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          dripConfig: {
                            ...prev.dripConfig,
                            perHour: e.target.value ? parseInt(e.target.value) : undefined,
                            perDay: undefined
                          }
                        }))}
                        placeholder="e.g., 10"
                        min="1"
                        className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Start Date & Time</label>
                    <input
                      type="datetime-local"
                      value={config.dripConfig.startAt ? config.dripConfig.startAt.toISOString().slice(0, 16) : ''}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        dripConfig: {
                          ...prev.dripConfig,
                          startAt: e.target.value ? new Date(e.target.value) : null
                        }
                      }))}
                      min={new Date().toISOString().slice(0, 16)}
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  {/* Estimated completion */}
                  {totalSubscriberCount > 0 && (config.dripConfig.perDay || config.dripConfig.perHour) && config.dripConfig.startAt && (
                    <div className="bg-gray-900/50 rounded-lg p-3">
                      <p className="text-sm text-gray-400">
                        Estimated completion:{' '}
                        <span className="text-white">
                          {(() => {
                            const rate = config.dripConfig.perDay
                              ? config.dripConfig.perDay
                              : (config.dripConfig.perHour || 1) * 24;
                            const days = Math.ceil(totalSubscriberCount / rate);
                            const endDate = new Date(config.dripConfig.startAt!);
                            endDate.setDate(endDate.getDate() + days);
                            return formatDate(endDate);
                          })()}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Review & Confirm */}
          {currentStep === 4 && (
            <div className="space-y-6">
              {!isEnrolling && !progress ? (
                <>
                  {/* Summary */}
                  <div className="bg-gray-800/30 rounded-lg p-6 space-y-6">
                    <h4 className="text-lg font-semibold text-white">Enrollment Summary</h4>

                    {/* Sequence */}
                    <div className="flex items-center justify-between py-3 border-b border-gray-700">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                          <Mail className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                          <p className="text-gray-400 text-sm">Sequence</p>
                          <p className="text-white font-medium">{selectedSequence?.name}</p>
                        </div>
                      </div>
                      {getTypeBadge(selectedSequence?.type || '')}
                    </div>

                    {/* Subscribers */}
                    <div className="flex items-center justify-between py-3 border-b border-gray-700">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                          <Users className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <p className="text-gray-400 text-sm">
                            {config.source === 'manual' ? 'Manual Entry'
                              : config.source === 'segment' ? 'From Segment'
                              : 'All Subscribers'}
                          </p>
                          <p className="text-white font-medium">
                            {config.source === 'manual'
                              ? `${validEmails.length} email(s)`
                              : config.source === 'segment'
                                ? segments.find(s => s.id === config.segmentId)?.name || '-'
                                : `${totalSubscriberCount.toLocaleString()} subscribers`
                            }
                          </p>
                        </div>
                      </div>
                      <span className="text-2xl font-bold text-white">
                        {config.source === 'manual'
                          ? validEmails.length
                          : totalSubscriberCount.toLocaleString()
                        }
                      </span>
                    </div>

                    {/* Schedule */}
                    <div className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                          {config.scheduleType === 'immediate' ? (
                            <Zap className="w-5 h-5 text-green-400" />
                          ) : config.scheduleType === 'scheduled' ? (
                            <Calendar className="w-5 h-5 text-green-400" />
                          ) : (
                            <Timer className="w-5 h-5 text-green-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-gray-400 text-sm">Schedule</p>
                          <p className="text-white font-medium">
                            {config.scheduleType === 'immediate'
                              ? 'Start immediately'
                              : config.scheduleType === 'scheduled'
                                ? formatDate(config.scheduledAt)
                                : `Drip: ${config.dripConfig.perDay || config.dripConfig.perHour}/
                                   ${config.dripConfig.perDay ? 'day' : 'hour'}`
                            }
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Exclude enrolled notice */}
                    {config.excludeEnrolled && (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Check className="w-4 h-4 text-green-400" />
                        Already enrolled subscribers will be skipped
                      </div>
                    )}
                  </div>

                  {/* Confirmation warning for large enrollments */}
                  {totalSubscriberCount > 1000 && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-yellow-400 font-medium">Large Enrollment</p>
                        <p className="text-yellow-300/70 text-sm mt-1">
                          You're about to enroll {totalSubscriberCount.toLocaleString()} subscribers.
                          This operation may take several minutes to complete.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Progress Display */
                <div className="space-y-6">
                  <div className="text-center">
                    {progress?.status === 'processing' && (
                      <>
                        <Loader2 className="w-16 h-16 text-amber-400 animate-spin mx-auto mb-4" />
                        <h4 className="text-xl font-semibold text-white mb-2">Enrolling Subscribers...</h4>
                      </>
                    )}
                    {progress?.status === 'completed' && (
                      <>
                        <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                        <h4 className="text-xl font-semibold text-white mb-2">Enrollment Complete!</h4>
                      </>
                    )}
                    {progress?.status === 'cancelled' && (
                      <>
                        <AlertCircle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                        <h4 className="text-xl font-semibold text-white mb-2">Enrollment Cancelled</h4>
                      </>
                    )}
                    {progress?.status === 'failed' && (
                      <>
                        <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                        <h4 className="text-xl font-semibold text-white mb-2">Enrollment Failed</h4>
                      </>
                    )}
                  </div>

                  {/* Progress Bar */}
                  {progress && (
                    <div className="space-y-2">
                      <div className="w-full bg-gray-700 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full transition-all duration-300 ${
                            progress.status === 'completed' ? 'bg-green-500'
                              : progress.status === 'failed' ? 'bg-red-500'
                              : 'bg-amber-500'
                          }`}
                          style={{
                            width: `${progress.totalCount > 0
                              ? (progress.processedCount / progress.totalCount) * 100
                              : 0}%`
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">
                          {progress.processedCount.toLocaleString()} / {progress.totalCount.toLocaleString()}
                        </span>
                        <span className="text-gray-400">
                          {progress.totalCount > 0
                            ? Math.round((progress.processedCount / progress.totalCount) * 100)
                            : 0}%
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  {progress && (
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-green-400">{progress.successCount.toLocaleString()}</p>
                        <p className="text-sm text-gray-400">Successful</p>
                      </div>
                      <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-red-400">{progress.errorCount.toLocaleString()}</p>
                        <p className="text-sm text-gray-400">Errors</p>
                      </div>
                      <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-gray-400">
                          {(progress.totalCount - progress.processedCount).toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-400">Remaining</p>
                      </div>
                    </div>
                  )}

                  {/* Error Details */}
                  {progress?.errors && progress.errors.length > 0 && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                      <h5 className="text-red-400 font-medium mb-2">Errors ({progress.errors.length})</h5>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {progress.errors.slice(0, 10).map((err, i) => (
                          <div key={i} className="text-sm">
                            <span className="text-red-300">{err.email}</span>
                            <span className="text-gray-500">: {err.error}</span>
                          </div>
                        ))}
                        {progress.errors.length > 10 && (
                          <p className="text-xs text-red-400">+{progress.errors.length - 10} more errors</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Cancel Button */}
                  {progress?.status === 'processing' && (
                    <div className="text-center">
                      <button
                        onClick={handleCancelEnrollment}
                        className="px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        Cancel Enrollment
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 flex items-center justify-between">
          <button
            onClick={currentStep === 1 ? onClose : goBack}
            disabled={isEnrolling}
            className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
            {currentStep === 1 ? 'Cancel' : 'Back'}
          </button>

          {currentStep < 4 ? (
            <button
              onClick={goNext}
              disabled={!isStepValid(currentStep)}
              className="flex items-center gap-2 px-6 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 disabled:text-gray-400 text-white font-medium rounded-lg transition-colors"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : progress?.status === 'completed' || progress?.status === 'cancelled' || progress?.status === 'failed' ? (
            <button
              onClick={() => {
                if (onComplete) onComplete();
                onClose();
              }}
              className="flex items-center gap-2 px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
            >
              <Check className="w-4 h-4" />
              Done
            </button>
          ) : (
            <button
              onClick={handleStartEnrollment}
              disabled={isEnrolling}
              className="flex items-center gap-2 px-6 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 disabled:text-gray-400 text-white font-medium rounded-lg transition-colors"
            >
              {isEnrolling ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Start Enrollment
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Need to import Layers for the component
const Layers = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

export default EnrollmentWizard;
