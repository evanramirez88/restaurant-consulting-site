import React, { useState } from 'react';
import {
  GitBranch,
  Plus,
  Trash2,
  Mail,
  MousePointer,
  Tag,
  Clock,
  Users,
  ChevronDown,
  AlertCircle,
  ArrowRight,
  SkipForward,
  StopCircle,
  Loader2,
  Check,
  X
} from 'lucide-react';

// ============================================
// TYPE DEFINITIONS
// ============================================

export type ConditionCategory = 'email_engagement' | 'time_based' | 'subscriber_attribute';

export type EmailEngagementConditionType =
  | 'opened_previous'
  | 'not_opened_previous'
  | 'clicked_any_link'
  | 'clicked_specific_link'
  | 'not_clicked_any_link';

export type TimeBasedConditionType =
  | 'weekdays_only'
  | 'business_hours'
  | 'not_received_recently';

export type SubscriberAttributeConditionType =
  | 'has_tag'
  | 'not_has_tag'
  | 'score_above'
  | 'score_below'
  | 'in_segment'
  | 'not_in_segment';

export type ConditionType =
  | EmailEngagementConditionType
  | TimeBasedConditionType
  | SubscriberAttributeConditionType;

export type ConditionAction = 'continue' | 'skip_next' | 'skip_to_step' | 'end_sequence';

export type LogicOperator = 'AND' | 'OR';

export interface Condition {
  id: string;
  type: ConditionType;
  // For specific link matching
  link_pattern?: string;
  // For tag conditions
  tag_id?: string;
  tag_name?: string;
  // For score conditions
  score_threshold?: number;
  // For segment conditions
  segment_id?: string;
  segment_name?: string;
  // For time-based conditions
  business_hours_start?: string; // HH:MM format
  business_hours_end?: string;
  days_threshold?: number;
}

export interface ConditionGroup {
  id: string;
  logic: LogicOperator;
  conditions: Condition[];
}

export interface BranchConfig {
  condition_groups: ConditionGroup[];
  group_logic: LogicOperator; // Logic between groups
  if_true: {
    action: ConditionAction;
    skip_to_step_index?: number;
  };
  if_false: {
    action: ConditionAction;
    skip_to_step_index?: number;
  };
}

// ============================================
// CONDITION CONFIG
// ============================================

interface ConditionTypeConfig {
  value: ConditionType;
  label: string;
  description: string;
  category: ConditionCategory;
  icon: React.ComponentType<{ className?: string }>;
  hasLinkPattern?: boolean;
  hasTag?: boolean;
  hasScore?: boolean;
  hasSegment?: boolean;
  hasBusinessHours?: boolean;
  hasDaysThreshold?: boolean;
}

const CONDITION_TYPES: ConditionTypeConfig[] = [
  // Email Engagement
  {
    value: 'opened_previous',
    label: 'Opened previous email',
    description: 'Subscriber opened the previous email in sequence',
    category: 'email_engagement',
    icon: Mail
  },
  {
    value: 'not_opened_previous',
    label: 'Did NOT open previous email',
    description: 'Subscriber did not open the previous email',
    category: 'email_engagement',
    icon: Mail
  },
  {
    value: 'clicked_any_link',
    label: 'Clicked any link',
    description: 'Subscriber clicked any link in previous email',
    category: 'email_engagement',
    icon: MousePointer
  },
  {
    value: 'clicked_specific_link',
    label: 'Clicked specific link',
    description: 'Subscriber clicked a link matching URL pattern',
    category: 'email_engagement',
    icon: MousePointer,
    hasLinkPattern: true
  },
  {
    value: 'not_clicked_any_link',
    label: 'Did NOT click any link',
    description: 'Subscriber did not click any links',
    category: 'email_engagement',
    icon: MousePointer
  },
  // Time-Based
  {
    value: 'weekdays_only',
    label: 'Weekdays only',
    description: 'Only send Monday through Friday',
    category: 'time_based',
    icon: Clock
  },
  {
    value: 'business_hours',
    label: 'Business hours only',
    description: 'Only send during specified hours',
    category: 'time_based',
    icon: Clock,
    hasBusinessHours: true
  },
  {
    value: 'not_received_recently',
    label: 'Not received email recently',
    description: 'Skip if subscriber received email in last X days',
    category: 'time_based',
    icon: Clock,
    hasDaysThreshold: true
  },
  // Subscriber Attributes
  {
    value: 'has_tag',
    label: 'Has tag',
    description: 'Subscriber has a specific tag',
    category: 'subscriber_attribute',
    icon: Tag,
    hasTag: true
  },
  {
    value: 'not_has_tag',
    label: 'Does NOT have tag',
    description: 'Subscriber does not have a specific tag',
    category: 'subscriber_attribute',
    icon: Tag,
    hasTag: true
  },
  {
    value: 'score_above',
    label: 'Score above threshold',
    description: 'Subscriber engagement score is above value',
    category: 'subscriber_attribute',
    icon: Users,
    hasScore: true
  },
  {
    value: 'score_below',
    label: 'Score below threshold',
    description: 'Subscriber engagement score is below value',
    category: 'subscriber_attribute',
    icon: Users,
    hasScore: true
  },
  {
    value: 'in_segment',
    label: 'In segment',
    description: 'Subscriber is in a specific segment',
    category: 'subscriber_attribute',
    icon: Users,
    hasSegment: true
  },
  {
    value: 'not_in_segment',
    label: 'NOT in segment',
    description: 'Subscriber is not in a specific segment',
    category: 'subscriber_attribute',
    icon: Users,
    hasSegment: true
  }
];

const CONDITION_ACTIONS: { value: ConditionAction; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'continue', label: 'Continue to next step', icon: ArrowRight },
  { value: 'skip_next', label: 'Skip next step', icon: SkipForward },
  { value: 'skip_to_step', label: 'Skip to specific step', icon: SkipForward },
  { value: 'end_sequence', label: 'End sequence', icon: StopCircle }
];

const CATEGORY_LABELS: Record<ConditionCategory, string> = {
  email_engagement: 'Email Engagement',
  time_based: 'Time-Based',
  subscriber_attribute: 'Subscriber Attributes'
};

// ============================================
// SINGLE CONDITION EDITOR
// ============================================

interface ConditionEditorProps {
  condition: Condition;
  onUpdate: (updates: Partial<Condition>) => void;
  onDelete: () => void;
  availableTags?: { id: string; name: string }[];
  availableSegments?: { id: string; name: string }[];
}

const ConditionEditor: React.FC<ConditionEditorProps> = ({
  condition,
  onUpdate,
  onDelete,
  availableTags = [],
  availableSegments = []
}) => {
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const config = CONDITION_TYPES.find(c => c.value === condition.type);
  const Icon = config?.icon || GitBranch;

  return (
    <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3">
      <div className="flex items-start gap-3">
        {/* Condition Type Selector */}
        <div className="flex-1">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsTypeOpen(!isTypeOpen)}
              className="w-full flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-left hover:border-gray-500 transition-colors"
            >
              <Icon className="w-4 h-4 text-purple-400" />
              <span className="text-white flex-1">{config?.label || 'Select condition'}</span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isTypeOpen ? 'rotate-180' : ''}`} />
            </button>

            {isTypeOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 max-h-72 overflow-y-auto">
                {(['email_engagement', 'time_based', 'subscriber_attribute'] as ConditionCategory[]).map((category) => (
                  <div key={category}>
                    <div className="px-3 py-1.5 bg-gray-900 text-xs font-medium text-gray-400 sticky top-0">
                      {CATEGORY_LABELS[category]}
                    </div>
                    {CONDITION_TYPES.filter(c => c.category === category).map((type) => {
                      const TypeIcon = type.icon;
                      return (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => {
                            onUpdate({ type: type.value });
                            setIsTypeOpen(false);
                          }}
                          className={`w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-gray-700 transition-colors ${
                            condition.type === type.value ? 'bg-purple-500/10' : ''
                          }`}
                        >
                          <TypeIcon className="w-4 h-4 text-purple-400 mt-0.5" />
                          <div>
                            <div className="text-white text-sm">{type.label}</div>
                            <div className="text-gray-500 text-xs">{type.description}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Conditional Extra Fields */}
          {config?.hasLinkPattern && (
            <div className="mt-2">
              <input
                type="text"
                value={condition.link_pattern || ''}
                onChange={(e) => onUpdate({ link_pattern: e.target.value })}
                placeholder="URL pattern (e.g., /pricing or *schedule*)"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          )}

          {config?.hasTag && (
            <div className="mt-2">
              {availableTags.length > 0 ? (
                <select
                  value={condition.tag_id || ''}
                  onChange={(e) => {
                    const tag = availableTags.find(t => t.id === e.target.value);
                    onUpdate({ tag_id: e.target.value, tag_name: tag?.name });
                  }}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select tag...</option>
                  {availableTags.map((tag) => (
                    <option key={tag.id} value={tag.id}>{tag.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={condition.tag_name || ''}
                  onChange={(e) => onUpdate({ tag_name: e.target.value })}
                  placeholder="Enter tag name"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              )}
            </div>
          )}

          {config?.hasScore && (
            <div className="mt-2">
              <input
                type="number"
                value={condition.score_threshold || ''}
                onChange={(e) => onUpdate({ score_threshold: parseInt(e.target.value) || 0 })}
                placeholder="Score threshold"
                min={0}
                max={100}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          )}

          {config?.hasSegment && (
            <div className="mt-2">
              {availableSegments.length > 0 ? (
                <select
                  value={condition.segment_id || ''}
                  onChange={(e) => {
                    const segment = availableSegments.find(s => s.id === e.target.value);
                    onUpdate({ segment_id: e.target.value, segment_name: segment?.name });
                  }}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select segment...</option>
                  {availableSegments.map((segment) => (
                    <option key={segment.id} value={segment.id}>{segment.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={condition.segment_name || ''}
                  onChange={(e) => onUpdate({ segment_name: e.target.value })}
                  placeholder="Enter segment name"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              )}
            </div>
          )}

          {config?.hasBusinessHours && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="time"
                value={condition.business_hours_start || '09:00'}
                onChange={(e) => onUpdate({ business_hours_start: e.target.value })}
                className="px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <span className="text-gray-400">to</span>
              <input
                type="time"
                value={condition.business_hours_end || '17:00'}
                onChange={(e) => onUpdate({ business_hours_end: e.target.value })}
                className="px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          )}

          {config?.hasDaysThreshold && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-gray-400 text-sm">Last</span>
              <input
                type="number"
                value={condition.days_threshold || 7}
                onChange={(e) => onUpdate({ days_threshold: parseInt(e.target.value) || 1 })}
                min={1}
                className="w-20 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <span className="text-gray-400 text-sm">days</span>
            </div>
          )}
        </div>

        {/* Delete Button */}
        <button
          type="button"
          onClick={onDelete}
          className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ============================================
// CONDITION GROUP EDITOR
// ============================================

interface ConditionGroupEditorProps {
  group: ConditionGroup;
  groupIndex: number;
  onUpdate: (updates: Partial<ConditionGroup>) => void;
  onDelete: () => void;
  onAddCondition: () => void;
  onUpdateCondition: (conditionId: string, updates: Partial<Condition>) => void;
  onDeleteCondition: (conditionId: string) => void;
  availableTags?: { id: string; name: string }[];
  availableSegments?: { id: string; name: string }[];
}

const ConditionGroupEditor: React.FC<ConditionGroupEditorProps> = ({
  group,
  groupIndex,
  onUpdate,
  onDelete,
  onAddCondition,
  onUpdateCondition,
  onDeleteCondition,
  availableTags,
  availableSegments
}) => {
  return (
    <div className="border border-purple-500/30 rounded-lg p-4 bg-purple-500/5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-purple-400 text-sm font-medium">Group {groupIndex + 1}</span>
          <select
            value={group.logic}
            onChange={(e) => onUpdate({ logic: e.target.value as LogicOperator })}
            className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="AND">ALL conditions (AND)</option>
            <option value="OR">ANY condition (OR)</option>
          </select>
        </div>
        {groupIndex > 0 && (
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        {group.conditions.map((condition, idx) => (
          <div key={condition.id}>
            {idx > 0 && (
              <div className="flex items-center justify-center my-2">
                <span className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-400 font-medium">
                  {group.logic}
                </span>
              </div>
            )}
            <ConditionEditor
              condition={condition}
              onUpdate={(updates) => onUpdateCondition(condition.id, updates)}
              onDelete={() => onDeleteCondition(condition.id)}
              availableTags={availableTags}
              availableSegments={availableSegments}
            />
          </div>
        ))}

        <button
          type="button"
          onClick={onAddCondition}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-gray-600 rounded-lg text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Condition
        </button>
      </div>
    </div>
  );
};

// ============================================
// ACTION SELECTOR
// ============================================

interface ActionSelectorProps {
  label: string;
  action: ConditionAction;
  skipToStep?: number;
  totalSteps: number;
  onActionChange: (action: ConditionAction) => void;
  onSkipToStepChange: (step: number) => void;
  color: 'green' | 'red';
}

const ActionSelector: React.FC<ActionSelectorProps> = ({
  label,
  action,
  skipToStep,
  totalSteps,
  onActionChange,
  onSkipToStepChange,
  color
}) => {
  const colorClasses = color === 'green'
    ? 'bg-green-500/10 border-green-500/30 text-green-400'
    : 'bg-red-500/10 border-red-500/30 text-red-400';

  return (
    <div className={`p-3 rounded-lg border ${colorClasses}`}>
      <div className="text-sm font-medium mb-2">{label}</div>
      <select
        value={action}
        onChange={(e) => onActionChange(e.target.value as ConditionAction)}
        className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
      >
        {CONDITION_ACTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {action === 'skip_to_step' && (
        <div className="mt-2">
          <select
            value={skipToStep || 0}
            onChange={(e) => onSkipToStepChange(parseInt(e.target.value))}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {Array.from({ length: totalSteps }, (_, i) => (
              <option key={i} value={i}>Step {i + 1}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};

// ============================================
// TEST CONDITION MODAL
// ============================================

interface TestConditionModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchConfig: BranchConfig;
  sequenceId: string;
  stepId: string;
}

const TestConditionModal: React.FC<TestConditionModalProps> = ({
  isOpen,
  onClose,
  branchConfig,
  sequenceId,
  stepId
}) => {
  const [subscriberEmail, setSubscriberEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ passes: boolean; details: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    if (!subscriberEmail.trim()) {
      setError('Please enter a subscriber email');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/admin/email/sequences/${sequenceId}/steps/${stepId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriber_email: subscriberEmail,
          conditions: branchConfig
        })
      });

      const data = await response.json();
      if (data.success) {
        setResult(data.data);
      } else {
        setError(data.error || 'Test failed');
      }
    } catch (err) {
      setError('Failed to test conditions');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-md bg-gray-900 rounded-xl shadow-2xl">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-display font-bold text-white">Test Conditions</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Subscriber Email</label>
            <input
              type="email"
              value={subscriberEmail}
              onChange={(e) => setSubscriberEmail(e.target.value)}
              placeholder="test@example.com"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {result && (
            <div className={`p-3 rounded-lg border ${result.passes ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
              <div className="flex items-center gap-2 mb-2">
                {result.passes ? (
                  <Check className="w-5 h-5 text-green-400" />
                ) : (
                  <X className="w-5 h-5 text-red-400" />
                )}
                <span className={result.passes ? 'text-green-400' : 'text-red-400'}>
                  {result.passes ? 'Conditions PASS' : 'Conditions DO NOT PASS'}
                </span>
              </div>
              {result.details.length > 0 && (
                <ul className="text-sm text-gray-400 space-y-1">
                  {result.details.map((detail, idx) => (
                    <li key={idx}>- {detail}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleTest}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Testing...
              </>
            ) : (
              'Run Test'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// MAIN CONDITION BUILDER COMPONENT
// ============================================

interface ConditionBuilderProps {
  value: BranchConfig;
  onChange: (config: BranchConfig) => void;
  totalSteps: number;
  sequenceId?: string;
  stepId?: string;
  availableTags?: { id: string; name: string }[];
  availableSegments?: { id: string; name: string }[];
}

const ConditionBuilder: React.FC<ConditionBuilderProps> = ({
  value,
  onChange,
  totalSteps,
  sequenceId,
  stepId,
  availableTags = [],
  availableSegments = []
}) => {
  const [showTestModal, setShowTestModal] = useState(false);

  // Create a new condition
  const createCondition = (): Condition => ({
    id: crypto.randomUUID(),
    type: 'opened_previous'
  });

  // Create a new condition group
  const createConditionGroup = (): ConditionGroup => ({
    id: crypto.randomUUID(),
    logic: 'AND',
    conditions: [createCondition()]
  });

  // Add a new condition group
  const addConditionGroup = () => {
    onChange({
      ...value,
      condition_groups: [...value.condition_groups, createConditionGroup()]
    });
  };

  // Update a condition group
  const updateConditionGroup = (groupId: string, updates: Partial<ConditionGroup>) => {
    onChange({
      ...value,
      condition_groups: value.condition_groups.map((g) =>
        g.id === groupId ? { ...g, ...updates } : g
      )
    });
  };

  // Delete a condition group
  const deleteConditionGroup = (groupId: string) => {
    onChange({
      ...value,
      condition_groups: value.condition_groups.filter((g) => g.id !== groupId)
    });
  };

  // Add condition to a group
  const addConditionToGroup = (groupId: string) => {
    onChange({
      ...value,
      condition_groups: value.condition_groups.map((g) =>
        g.id === groupId
          ? { ...g, conditions: [...g.conditions, createCondition()] }
          : g
      )
    });
  };

  // Update a condition within a group
  const updateCondition = (groupId: string, conditionId: string, updates: Partial<Condition>) => {
    onChange({
      ...value,
      condition_groups: value.condition_groups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              conditions: g.conditions.map((c) =>
                c.id === conditionId ? { ...c, ...updates } : c
              )
            }
          : g
      )
    });
  };

  // Delete a condition from a group
  const deleteCondition = (groupId: string, conditionId: string) => {
    onChange({
      ...value,
      condition_groups: value.condition_groups.map((g) =>
        g.id === groupId
          ? { ...g, conditions: g.conditions.filter((c) => c.id !== conditionId) }
          : g
      )
    });
  };

  return (
    <div className="space-y-4">
      {/* Condition Groups */}
      <div className="space-y-3">
        {value.condition_groups.map((group, idx) => (
          <div key={group.id}>
            {idx > 0 && (
              <div className="flex items-center justify-center my-3">
                <select
                  value={value.group_logic}
                  onChange={(e) => onChange({ ...value, group_logic: e.target.value as LogicOperator })}
                  className="px-3 py-1 bg-gray-800 border border-gray-600 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                </select>
              </div>
            )}
            <ConditionGroupEditor
              group={group}
              groupIndex={idx}
              onUpdate={(updates) => updateConditionGroup(group.id, updates)}
              onDelete={() => deleteConditionGroup(group.id)}
              onAddCondition={() => addConditionToGroup(group.id)}
              onUpdateCondition={(conditionId, updates) => updateCondition(group.id, conditionId, updates)}
              onDeleteCondition={(conditionId) => deleteCondition(group.id, conditionId)}
              availableTags={availableTags}
              availableSegments={availableSegments}
            />
          </div>
        ))}
      </div>

      {/* Add Group Button */}
      <button
        type="button"
        onClick={addConditionGroup}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg text-purple-400 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Condition Group
      </button>

      {/* Branch Actions */}
      <div className="pt-4 border-t border-gray-700">
        <h4 className="text-sm font-medium text-gray-300 mb-3">Branch Actions</h4>
        <div className="grid grid-cols-2 gap-3">
          <ActionSelector
            label="If conditions PASS:"
            action={value.if_true.action}
            skipToStep={value.if_true.skip_to_step_index}
            totalSteps={totalSteps}
            onActionChange={(action) => onChange({
              ...value,
              if_true: { ...value.if_true, action }
            })}
            onSkipToStepChange={(step) => onChange({
              ...value,
              if_true: { ...value.if_true, skip_to_step_index: step }
            })}
            color="green"
          />
          <ActionSelector
            label="If conditions FAIL:"
            action={value.if_false.action}
            skipToStep={value.if_false.skip_to_step_index}
            totalSteps={totalSteps}
            onActionChange={(action) => onChange({
              ...value,
              if_false: { ...value.if_false, action }
            })}
            onSkipToStepChange={(step) => onChange({
              ...value,
              if_false: { ...value.if_false, skip_to_step_index: step }
            })}
            color="red"
          />
        </div>
      </div>

      {/* Test Button */}
      {sequenceId && stepId && (
        <div className="pt-4 border-t border-gray-700">
          <button
            type="button"
            onClick={() => setShowTestModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-gray-300 transition-colors"
          >
            <AlertCircle className="w-4 h-4" />
            Test Conditions with Subscriber
          </button>
        </div>
      )}

      {/* Test Modal */}
      <TestConditionModal
        isOpen={showTestModal}
        onClose={() => setShowTestModal(false)}
        branchConfig={value}
        sequenceId={sequenceId || ''}
        stepId={stepId || ''}
      />
    </div>
  );
};

export default ConditionBuilder;

// Export helper to create default branch config
export const createDefaultBranchConfig = (): BranchConfig => ({
  condition_groups: [{
    id: crypto.randomUUID(),
    logic: 'AND',
    conditions: [{
      id: crypto.randomUUID(),
      type: 'opened_previous'
    }]
  }],
  group_logic: 'AND',
  if_true: { action: 'continue' },
  if_false: { action: 'continue' }
});
