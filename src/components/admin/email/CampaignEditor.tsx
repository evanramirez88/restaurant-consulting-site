import React, { useState, useEffect } from 'react';
import {
  X, ChevronLeft, ChevronRight, Check, Mail, Info, Zap, Calendar,
  Eye, Loader2, AlertCircle, Clock, Play, UserPlus, Tag, Users,
  Plus, Trash2, GripVertical, Save
} from 'lucide-react';
import type { EmailSequence } from './EmailCampaigns';

interface CampaignEditorProps {
  sequence: EmailSequence | null;
  onClose: () => void;
  onSave: () => void;
}

interface SequenceStep {
  id: string;
  step_number: number;
  subject: string;
  delay_minutes: number;
  delay_unit: 'minutes' | 'hours' | 'days';
}

interface TriggerConfig {
  trigger: 'manual' | 'on_signup' | 'on_tag' | 'on_segment';
  tagId?: string;
  segmentId?: string;
}

interface SequenceSettings {
  daily_limit?: number;
  timezone?: string;
  start_date?: string;
  end_date?: string;
}

type WizardStep = 1 | 2 | 3 | 4 | 5;

const SEQUENCE_TYPES = [
  { value: 'drip', label: 'Drip Campaign', description: 'Automated sequence sent over time' },
  { value: 'behavior', label: 'Behavior Triggered', description: 'Triggered by user actions' },
  { value: 'onboarding', label: 'Onboarding', description: 'Welcome and onboard new subscribers' },
  { value: 'reengagement', label: 'Re-engagement', description: 'Win back inactive subscribers' },
  { value: 'transactional', label: 'Transactional', description: 'Order confirmations, receipts, etc.' },
  { value: 'newsletter', label: 'Newsletter', description: 'Regular content updates' },
];

const TRIGGER_TYPES = [
  { value: 'manual', label: 'Manual Enrollment', description: 'Manually add subscribers to this sequence', icon: Users },
  { value: 'on_signup', label: 'On Signup', description: 'Automatically enroll new subscribers', icon: UserPlus },
  { value: 'on_tag', label: 'When Tagged', description: 'Enroll when a specific tag is applied', icon: Tag },
  { value: 'on_segment', label: 'Segment Match', description: 'Enroll when subscriber matches a segment', icon: Users },
];

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'UTC', label: 'UTC' },
];

const CampaignEditor: React.FC<CampaignEditorProps> = ({
  sequence,
  onClose,
  onSave
}) => {
  const isEditing = !!sequence;
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Form State - Step 1: Basic Info
  const [name, setName] = useState(sequence?.name || '');
  const [description, setDescription] = useState(sequence?.description || '');
  const [type, setType] = useState<string>(sequence?.type || 'drip');

  // Form State - Step 2: Trigger Settings
  const [triggerConfig, setTriggerConfig] = useState<TriggerConfig>(() => {
    if (sequence?.trigger_config) {
      try {
        return JSON.parse(sequence.trigger_config);
      } catch {
        return { trigger: 'manual' };
      }
    }
    return { trigger: 'manual' };
  });

  // Form State - Step 3: Email Steps (placeholder)
  const [emailSteps, setEmailSteps] = useState<SequenceStep[]>([
    { id: 'step-1', step_number: 1, subject: 'Welcome Email', delay_minutes: 0, delay_unit: 'minutes' },
  ]);

  // Form State - Step 4: Schedule
  const [settings, setSettings] = useState<SequenceSettings>(() => {
    if (sequence?.settings) {
      try {
        return JSON.parse(sequence.settings);
      } catch {
        return { daily_limit: 100, timezone: 'America/New_York' };
      }
    }
    return { daily_limit: 100, timezone: 'America/New_York' };
  });

  const validateStep = (step: WizardStep): boolean => {
    const errors: Record<string, string> = {};

    switch (step) {
      case 1:
        if (!name.trim()) {
          errors.name = 'Campaign name is required';
        }
        if (!type) {
          errors.type = 'Campaign type is required';
        }
        break;
      case 2:
        if (!triggerConfig.trigger) {
          errors.trigger = 'Please select a trigger type';
        }
        if (triggerConfig.trigger === 'on_tag' && !triggerConfig.tagId) {
          errors.tagId = 'Please specify a tag';
        }
        if (triggerConfig.trigger === 'on_segment' && !triggerConfig.segmentId) {
          errors.segmentId = 'Please specify a segment';
        }
        break;
      case 3:
        if (emailSteps.length === 0) {
          errors.steps = 'At least one email step is required';
        }
        emailSteps.forEach((step, index) => {
          if (!step.subject.trim()) {
            errors[`step_${index}_subject`] = `Step ${index + 1} needs a subject`;
          }
        });
        break;
      case 4:
        if (settings.daily_limit !== undefined && settings.daily_limit < 1) {
          errors.daily_limit = 'Daily limit must be at least 1';
        }
        break;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 5) as WizardStep);
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1) as WizardStep);
  };

  const handleSave = async (activate: boolean = false) => {
    if (!validateStep(currentStep)) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        type,
        trigger_type: triggerConfig.trigger,
        trigger_config: JSON.stringify(triggerConfig),
        settings: JSON.stringify(settings),
        status: activate ? 'active' : (sequence?.status || 'draft'),
      };

      const url = isEditing
        ? `/api/admin/email/sequences/${sequence.id}`
        : '/api/admin/email/sequences';

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        onSave();
      } else {
        setError(result.error || 'Failed to save campaign');
      }
    } catch (err) {
      setError('Failed to save campaign. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const addEmailStep = () => {
    const newStep: SequenceStep = {
      id: `step-${Date.now()}`,
      step_number: emailSteps.length + 1,
      subject: '',
      delay_minutes: emailSteps.length === 0 ? 0 : 1440, // Default 1 day for subsequent steps
      delay_unit: 'days',
    };
    setEmailSteps([...emailSteps, newStep]);
  };

  const removeEmailStep = (id: string) => {
    setEmailSteps(emailSteps.filter(s => s.id !== id).map((s, i) => ({ ...s, step_number: i + 1 })));
  };

  const updateEmailStep = (id: string, updates: Partial<SequenceStep>) => {
    setEmailSteps(emailSteps.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const formatDelayDisplay = (minutes: number, unit: string) => {
    if (unit === 'minutes') return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    if (unit === 'hours') return `${Math.round(minutes / 60)} hour${Math.round(minutes / 60) !== 1 ? 's' : ''}`;
    if (unit === 'days') return `${Math.round(minutes / 1440)} day${Math.round(minutes / 1440) !== 1 ? 's' : ''}`;
    return `${minutes} minutes`;
  };

  const stepIndicators = [
    { step: 1, label: 'Basic Info', icon: Info },
    { step: 2, label: 'Trigger', icon: Zap },
    { step: 3, label: 'Email Steps', icon: Mail },
    { step: 4, label: 'Schedule', icon: Calendar },
    { step: 5, label: 'Review', icon: Eye },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70" onClick={onClose} />

      {/* Modal */}
      <div className="relative min-h-full flex items-center justify-center p-4">
        <div className="relative bg-gray-900 rounded-xl border border-gray-700 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
            <div>
              <h2 className="text-xl font-display font-bold text-white">
                {isEditing ? 'Edit Campaign' : 'Create New Campaign'}
              </h2>
              <p className="text-gray-400 text-sm mt-1">
                Step {currentStep} of 5: {stepIndicators[currentStep - 1].label}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step Indicators */}
          <div className="px-6 py-4 border-b border-gray-800 bg-gray-900/50">
            <div className="flex items-center justify-between">
              {stepIndicators.map(({ step, label, icon: Icon }) => (
                <div
                  key={step}
                  className={`flex items-center gap-2 ${
                    step < currentStep ? 'text-green-400' :
                    step === currentStep ? 'text-amber-400' :
                    'text-gray-500'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                    step < currentStep ? 'bg-green-500/20 border-green-500' :
                    step === currentStep ? 'bg-amber-500/20 border-amber-500' :
                    'bg-gray-800 border-gray-600'
                  }`}>
                    {step < currentStep ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  <span className="hidden sm:inline text-sm font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mx-6 mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span className="text-red-400 text-sm">{error}</span>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Step 1: Basic Info */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Campaign Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Welcome Series, Monthly Newsletter"
                    className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      validationErrors.name ? 'border-red-500' : 'border-gray-600'
                    }`}
                  />
                  {validationErrors.name && (
                    <p className="text-red-400 text-sm mt-1">{validationErrors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of this campaign's purpose..."
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Campaign Type <span className="text-red-400">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {SEQUENCE_TYPES.map(({ value, label, description }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setType(value)}
                        className={`p-4 rounded-lg border text-left transition-all ${
                          type === value
                            ? 'bg-amber-500/20 border-amber-500 text-white'
                            : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-500'
                        }`}
                      >
                        <span className="font-medium block">{label}</span>
                        <span className="text-sm text-gray-400 mt-1 block">{description}</span>
                      </button>
                    ))}
                  </div>
                  {validationErrors.type && (
                    <p className="text-red-400 text-sm mt-1">{validationErrors.type}</p>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Trigger Settings */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    How should subscribers be enrolled? <span className="text-red-400">*</span>
                  </label>
                  <div className="space-y-3">
                    {TRIGGER_TYPES.map(({ value, label, description, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setTriggerConfig({ ...triggerConfig, trigger: value as TriggerConfig['trigger'] })}
                        className={`w-full p-4 rounded-lg border text-left transition-all flex items-start gap-4 ${
                          triggerConfig.trigger === value
                            ? 'bg-amber-500/20 border-amber-500 text-white'
                            : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-500'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          triggerConfig.trigger === value ? 'bg-amber-500/30' : 'bg-gray-700'
                        }`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="font-medium block">{label}</span>
                          <span className="text-sm text-gray-400 mt-1 block">{description}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Conditional Fields based on trigger type */}
                {triggerConfig.trigger === 'on_tag' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Tag Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={triggerConfig.tagId || ''}
                      onChange={(e) => setTriggerConfig({ ...triggerConfig, tagId: e.target.value })}
                      placeholder="Enter tag name..."
                      className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                        validationErrors.tagId ? 'border-red-500' : 'border-gray-600'
                      }`}
                    />
                    {validationErrors.tagId && (
                      <p className="text-red-400 text-sm mt-1">{validationErrors.tagId}</p>
                    )}
                  </div>
                )}

                {triggerConfig.trigger === 'on_segment' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Segment Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={triggerConfig.segmentId || ''}
                      onChange={(e) => setTriggerConfig({ ...triggerConfig, segmentId: e.target.value })}
                      placeholder="Enter segment name..."
                      className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                        validationErrors.segmentId ? 'border-red-500' : 'border-gray-600'
                      }`}
                    />
                    {validationErrors.segmentId && (
                      <p className="text-red-400 text-sm mt-1">{validationErrors.segmentId}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Email Steps */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-white">Email Steps</h3>
                    <p className="text-gray-400 text-sm">Define the emails in this sequence</p>
                  </div>
                  <button
                    onClick={addEmailStep}
                    className="flex items-center gap-2 px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Step
                  </button>
                </div>

                {validationErrors.steps && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    <p className="text-red-400 text-sm">{validationErrors.steps}</p>
                  </div>
                )}

                <div className="space-y-4">
                  {emailSteps.map((step, index) => (
                    <div
                      key={step.id}
                      className="bg-gray-800 border border-gray-700 rounded-lg p-4"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex items-center gap-2 pt-2">
                          <GripVertical className="w-4 h-4 text-gray-500" />
                          <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-medium text-sm">
                            {step.step_number}
                          </div>
                        </div>

                        <div className="flex-1 space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">
                              Subject Line
                            </label>
                            <input
                              type="text"
                              value={step.subject}
                              onChange={(e) => updateEmailStep(step.id, { subject: e.target.value })}
                              placeholder="Enter email subject..."
                              className={`w-full px-3 py-2 bg-gray-900 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                                validationErrors[`step_${index}_subject`] ? 'border-red-500' : 'border-gray-600'
                              }`}
                            />
                            {validationErrors[`step_${index}_subject`] && (
                              <p className="text-red-400 text-xs mt-1">{validationErrors[`step_${index}_subject`]}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <label className="block text-sm font-medium text-gray-400 mb-1">
                                {index === 0 ? 'Send immediately after enrollment' : 'Wait time after previous email'}
                              </label>
                              {index === 0 ? (
                                <div className="px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-gray-400 text-sm">
                                  <Clock className="w-4 h-4 inline-block mr-2" />
                                  Sends immediately when subscriber is enrolled
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min={1}
                                    value={
                                      step.delay_unit === 'minutes' ? step.delay_minutes :
                                      step.delay_unit === 'hours' ? Math.round(step.delay_minutes / 60) :
                                      Math.round(step.delay_minutes / 1440)
                                    }
                                    onChange={(e) => {
                                      const value = parseInt(e.target.value) || 1;
                                      const minutes = step.delay_unit === 'minutes' ? value :
                                                     step.delay_unit === 'hours' ? value * 60 :
                                                     value * 1440;
                                      updateEmailStep(step.id, { delay_minutes: minutes });
                                    }}
                                    className="w-20 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                  />
                                  <select
                                    value={step.delay_unit}
                                    onChange={(e) => {
                                      const newUnit = e.target.value as 'minutes' | 'hours' | 'days';
                                      let newMinutes = step.delay_minutes;
                                      // Convert current delay to new unit
                                      if (newUnit === 'minutes') newMinutes = step.delay_minutes;
                                      if (newUnit === 'hours') newMinutes = Math.max(60, Math.round(step.delay_minutes / 60) * 60);
                                      if (newUnit === 'days') newMinutes = Math.max(1440, Math.round(step.delay_minutes / 1440) * 1440);
                                      updateEmailStep(step.id, { delay_unit: newUnit, delay_minutes: newMinutes });
                                    }}
                                    className="px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                  >
                                    <option value="minutes">Minutes</option>
                                    <option value="hours">Hours</option>
                                    <option value="days">Days</option>
                                  </select>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {emailSteps.length > 1 && (
                          <button
                            onClick={() => removeEmailStep(step.id)}
                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
                            title="Remove step"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-gray-500 text-sm">
                  Note: Email content will be edited after the campaign is created.
                </p>
              </div>
            )}

            {/* Step 4: Schedule */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Daily Send Limit
                  </label>
                  <p className="text-gray-500 text-sm mb-2">
                    Maximum number of emails to send per day (helps avoid rate limits)
                  </p>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={settings.daily_limit || 100}
                    onChange={(e) => setSettings({ ...settings, daily_limit: parseInt(e.target.value) || 100 })}
                    className={`w-full max-w-[200px] px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      validationErrors.daily_limit ? 'border-red-500' : 'border-gray-600'
                    }`}
                  />
                  {validationErrors.daily_limit && (
                    <p className="text-red-400 text-sm mt-1">{validationErrors.daily_limit}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Timezone
                  </label>
                  <p className="text-gray-500 text-sm mb-2">
                    Emails will be scheduled based on this timezone
                  </p>
                  <select
                    value={settings.timezone || 'America/New_York'}
                    onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                    className="w-full max-w-[300px] px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {TIMEZONES.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Start Date (Optional)
                  </label>
                  <p className="text-gray-500 text-sm mb-2">
                    Campaign will not send emails before this date
                  </p>
                  <input
                    type="date"
                    value={settings.start_date || ''}
                    onChange={(e) => setSettings({ ...settings, start_date: e.target.value })}
                    className="w-full max-w-[200px] px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    End Date (Optional)
                  </label>
                  <p className="text-gray-500 text-sm mb-2">
                    Campaign will stop sending emails after this date
                  </p>
                  <input
                    type="date"
                    value={settings.end_date || ''}
                    onChange={(e) => setSettings({ ...settings, end_date: e.target.value })}
                    className="w-full max-w-[200px] px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            )}

            {/* Step 5: Review */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-white mb-4">Campaign Summary</h3>

                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-24 text-sm text-gray-400">Name:</div>
                      <div className="flex-1 text-white font-medium">{name}</div>
                    </div>

                    {description && (
                      <div className="flex items-start gap-4">
                        <div className="w-24 text-sm text-gray-400">Description:</div>
                        <div className="flex-1 text-gray-300">{description}</div>
                      </div>
                    )}

                    <div className="flex items-start gap-4">
                      <div className="w-24 text-sm text-gray-400">Type:</div>
                      <div className="flex-1">
                        {SEQUENCE_TYPES.find(t => t.value === type)?.label || type}
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="w-24 text-sm text-gray-400">Trigger:</div>
                      <div className="flex-1">
                        {TRIGGER_TYPES.find(t => t.value === triggerConfig.trigger)?.label || triggerConfig.trigger}
                        {triggerConfig.tagId && ` (Tag: ${triggerConfig.tagId})`}
                        {triggerConfig.segmentId && ` (Segment: ${triggerConfig.segmentId})`}
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="w-24 text-sm text-gray-400">Email Steps:</div>
                      <div className="flex-1">
                        {emailSteps.length} email{emailSteps.length !== 1 ? 's' : ''}
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="w-24 text-sm text-gray-400">Daily Limit:</div>
                      <div className="flex-1">{settings.daily_limit} emails/day</div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="w-24 text-sm text-gray-400">Timezone:</div>
                      <div className="flex-1">
                        {TIMEZONES.find(t => t.value === settings.timezone)?.label || settings.timezone}
                      </div>
                    </div>

                    {settings.start_date && (
                      <div className="flex items-start gap-4">
                        <div className="w-24 text-sm text-gray-400">Starts:</div>
                        <div className="flex-1">{settings.start_date}</div>
                      </div>
                    )}

                    {settings.end_date && (
                      <div className="flex items-start gap-4">
                        <div className="w-24 text-sm text-gray-400">Ends:</div>
                        <div className="flex-1">{settings.end_date}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Email Steps Preview */}
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-white mb-4">Email Steps</h3>
                  <div className="space-y-3">
                    {emailSteps.map((step, index) => (
                      <div key={step.id} className="flex items-center gap-4 p-3 bg-gray-900/50 rounded-lg">
                        <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-medium text-sm flex-shrink-0">
                          {step.step_number}
                        </div>
                        <div className="flex-1">
                          <div className="text-white font-medium">{step.subject || '(No subject)'}</div>
                          <div className="text-gray-400 text-sm">
                            {index === 0 ? 'Immediately' : formatDelayDisplay(step.delay_minutes, step.delay_unit)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700 bg-gray-900/50">
            <button
              onClick={handleBack}
              disabled={currentStep === 1}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                currentStep === 1
                  ? 'text-gray-500 cursor-not-allowed'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            <div className="flex items-center gap-3">
              {currentStep === 5 ? (
                <>
                  <button
                    onClick={() => handleSave(false)}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save as Draft
                  </button>
                  <button
                    onClick={() => handleSave(true)}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    Save & Activate
                  </button>
                </>
              ) : (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignEditor;
