import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Mail,
  Clock,
  GitBranch,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Copy,
  AlertCircle,
  Loader2,
  Save,
  ArrowDown,
  Eye,
  EyeOff,
  Beaker,
  Settings2
} from 'lucide-react';
import TokenInserter from './TokenInserter';
import ConditionBuilder, { BranchConfig, createDefaultBranchConfig } from './ConditionBuilder';
import TemplatePreview from './TemplatePreview';

// ============================================
// TYPE DEFINITIONS
// ============================================

export type StepType = 'email' | 'delay' | 'condition';
export type DelayUnit = 'minutes' | 'hours' | 'days';
export type ConditionType = 'opened_previous' | 'clicked_link' | 'has_tag';
export type ConditionAction = 'skip_next' | 'continue' | 'end_sequence';

export interface SequenceStep {
  id: string;
  sequence_id: string;
  step_order: number;
  step_type: StepType;
  // Email fields
  subject?: string;
  body?: string;
  from_name?: string;
  is_html?: boolean;
  // A/B variant fields
  ab_variant_id?: string;
  ab_variant_subject?: string;
  ab_variant_body?: string;
  // Delay fields
  delay_amount?: number;
  delay_unit?: DelayUnit;
  // Condition fields (legacy - simple)
  condition_type?: ConditionType;
  condition_action?: ConditionAction;
  // Condition fields (enhanced - rich branching)
  branch_config?: BranchConfig;
  use_advanced_conditions?: boolean;
  // Metadata
  created_at?: number;
  updated_at?: number;
}

interface SequenceStepEditorProps {
  sequenceId: string;
  onStepsChange?: (steps: SequenceStep[]) => void;
  initialSteps?: SequenceStep[];
}

// ============================================
// STEP TYPE CONFIGS
// ============================================

const STEP_TYPE_CONFIG = {
  email: {
    label: 'Email',
    icon: Mail,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/50'
  },
  delay: {
    label: 'Delay',
    icon: Clock,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500/50'
  },
  condition: {
    label: 'Condition',
    icon: GitBranch,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500/50'
  }
};

const DELAY_UNITS: { value: DelayUnit; label: string }[] = [
  { value: 'minutes', label: 'Minutes' },
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' }
];

const CONDITION_TYPES: { value: ConditionType; label: string }[] = [
  { value: 'opened_previous', label: 'If opened previous email' },
  { value: 'clicked_link', label: 'If clicked a link' },
  { value: 'has_tag', label: 'If contact has tag' }
];

const CONDITION_ACTIONS: { value: ConditionAction; label: string }[] = [
  { value: 'skip_next', label: 'Skip next step' },
  { value: 'continue', label: 'Continue to next step' },
  { value: 'end_sequence', label: 'End sequence' }
];

// ============================================
// EMAIL STEP EDITOR
// ============================================

interface EmailStepEditorProps {
  step: SequenceStep;
  onUpdate: (updates: Partial<SequenceStep>) => void;
}

const EmailStepEditor: React.FC<EmailStepEditorProps> = ({ step, onUpdate }) => {
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [showABVariant, setShowABVariant] = useState(!!step.ab_variant_subject || !!step.ab_variant_body);
  const [showPreview, setShowPreview] = useState(false);
  const variantSubjectRef = useRef<HTMLInputElement>(null);
  const variantBodyRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="space-y-4">
      {/* From Name */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">From Name</label>
        <input
          type="text"
          value={step.from_name || ''}
          onChange={(e) => onUpdate({ from_name: e.target.value })}
          placeholder="R&G Consulting"
          className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      {/* Subject Line */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-gray-400">Subject Line</label>
          <TokenInserter
            targetRef={subjectRef}
            onInsert={() => {}}
            size="sm"
          />
        </div>
        <input
          ref={subjectRef}
          type="text"
          value={step.subject || ''}
          onChange={(e) => onUpdate({ subject: e.target.value })}
          placeholder="Hi {{first_name}}, about your Toast setup..."
          className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      {/* Body */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-gray-400">Email Body</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onUpdate({ is_html: !step.is_html })}
              className={`px-2 py-1 text-xs rounded ${
                step.is_html
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {step.is_html ? 'HTML' : 'Plain Text'}
            </button>
            <TokenInserter
              targetRef={bodyRef}
              onInsert={() => {}}
              size="sm"
            />
          </div>
        </div>
        <textarea
          ref={bodyRef}
          value={step.body || ''}
          onChange={(e) => onUpdate({ body: e.target.value })}
          placeholder="Hello {{first_name}},&#10;&#10;I noticed you're using Toast POS at {{company}}..."
          rows={6}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-y font-mono"
        />
      </div>

      {/* Preview Toggle */}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-700">
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            showPreview
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
              : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
          }`}
        >
          <Eye className="w-4 h-4" />
          {showPreview ? 'Hide Preview' : 'Show Preview'}
        </button>

        <button
          type="button"
          onClick={() => {
            setShowABVariant(!showABVariant);
            if (!showABVariant) {
              onUpdate({ ab_variant_id: crypto.randomUUID() });
            } else {
              onUpdate({ ab_variant_id: undefined, ab_variant_subject: undefined, ab_variant_body: undefined });
            }
          }}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            showABVariant
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
              : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
          }`}
        >
          <Beaker className="w-4 h-4" />
          {showABVariant ? 'A/B Test Enabled' : 'Add A/B Variant'}
        </button>
      </div>

      {/* Inline Preview */}
      {showPreview && (
        <div className="h-96 border border-gray-700 rounded-lg overflow-hidden">
          <TemplatePreview
            subject={step.subject || ''}
            body={step.body || ''}
            isHtml={step.is_html}
            showTestEmail={true}
          />
        </div>
      )}

      {/* A/B Variant */}
      {showABVariant && (
        <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-lg space-y-4">
          <div className="flex items-center gap-2 text-purple-400 text-sm font-medium">
            <Beaker className="w-4 h-4" />
            Variant B
          </div>

          {/* Variant Subject */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-400">Subject Line (B)</label>
              <TokenInserter
                targetRef={variantSubjectRef}
                onInsert={() => {}}
                size="sm"
              />
            </div>
            <input
              ref={variantSubjectRef}
              type="text"
              value={step.ab_variant_subject || ''}
              onChange={(e) => onUpdate({ ab_variant_subject: e.target.value })}
              placeholder="Alternative subject line..."
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Variant Body */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-400">Email Body (B)</label>
              <TokenInserter
                targetRef={variantBodyRef}
                onInsert={() => {}}
                size="sm"
              />
            </div>
            <textarea
              ref={variantBodyRef}
              value={step.ab_variant_body || ''}
              onChange={(e) => onUpdate({ ab_variant_body: e.target.value })}
              placeholder="Alternative email body..."
              rows={4}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y"
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// DELAY STEP EDITOR
// ============================================

interface DelayStepEditorProps {
  step: SequenceStep;
  onUpdate: (updates: Partial<SequenceStep>) => void;
}

const DelayStepEditor: React.FC<DelayStepEditorProps> = ({ step, onUpdate }) => {
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <label className="block text-xs font-medium text-gray-400 mb-1">Wait for</label>
        <div className="flex gap-2">
          <input
            type="number"
            min="1"
            value={step.delay_amount || 1}
            onChange={(e) => onUpdate({ delay_amount: parseInt(e.target.value) || 1 })}
            className="w-24 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <select
            value={step.delay_unit || 'days'}
            onChange={(e) => onUpdate({ delay_unit: e.target.value as DelayUnit })}
            className="px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {DELAY_UNITS.map((unit) => (
              <option key={unit.value} value={unit.value}>{unit.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="text-gray-500 text-sm">
        before next step
      </div>
    </div>
  );
};

// ============================================
// CONDITION STEP EDITOR (Enhanced with Simple/Advanced modes)
// ============================================

interface ConditionStepEditorProps {
  step: SequenceStep;
  onUpdate: (updates: Partial<SequenceStep>) => void;
  totalSteps: number;
  sequenceId: string;
}

const ConditionStepEditor: React.FC<ConditionStepEditorProps> = ({ step, onUpdate, totalSteps, sequenceId }) => {
  const useAdvanced = step.use_advanced_conditions || false;

  // Initialize branch config if switching to advanced
  const handleToggleAdvanced = () => {
    if (!useAdvanced) {
      onUpdate({
        use_advanced_conditions: true,
        branch_config: step.branch_config || createDefaultBranchConfig()
      });
    } else {
      onUpdate({ use_advanced_conditions: false });
    }
  };

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-700">
        <span className="text-sm text-gray-400">Condition Mode</span>
        <button
          type="button"
          onClick={handleToggleAdvanced}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
            useAdvanced
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
              : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
          }`}
        >
          <Settings2 className="w-4 h-4" />
          {useAdvanced ? 'Advanced Mode' : 'Simple Mode'}
        </button>
      </div>

      {useAdvanced ? (
        /* Advanced Condition Builder */
        <ConditionBuilder
          value={step.branch_config || createDefaultBranchConfig()}
          onChange={(config) => onUpdate({ branch_config: config })}
          totalSteps={totalSteps}
          sequenceId={sequenceId}
          stepId={step.id}
        />
      ) : (
        /* Simple Condition (Legacy) */
        <>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Condition</label>
            <select
              value={step.condition_type || 'opened_previous'}
              onChange={(e) => onUpdate({ condition_type: e.target.value as ConditionType })}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {CONDITION_TYPES.map((cond) => (
                <option key={cond.value} value={cond.value}>{cond.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Then</label>
            <select
              value={step.condition_action || 'continue'}
              onChange={(e) => onUpdate({ condition_action: e.target.value as ConditionAction })}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {CONDITION_ACTIONS.map((action) => (
                <option key={action.value} value={action.value}>{action.label}</option>
              ))}
            </select>
          </div>

          {/* Upgrade Prompt */}
          <div className="p-3 bg-purple-500/5 border border-purple-500/20 rounded-lg">
            <p className="text-xs text-gray-400">
              Need more complex logic? Switch to{' '}
              <button
                type="button"
                onClick={handleToggleAdvanced}
                className="text-purple-400 hover:text-purple-300 underline"
              >
                Advanced Mode
              </button>{' '}
              for AND/OR conditions, multiple condition groups, and subscriber attribute checks.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

// ============================================
// STEP CARD COMPONENT
// ============================================

interface StepCardProps {
  step: SequenceStep;
  index: number;
  totalSteps: number;
  isExpanded: boolean;
  isDragging: boolean;
  sequenceId: string;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<SequenceStep>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent, index: number) => void;
}

const StepCard: React.FC<StepCardProps> = ({
  step,
  index,
  totalSteps,
  isExpanded,
  isDragging,
  sequenceId,
  onToggleExpand,
  onUpdate,
  onDelete,
  onDuplicate,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop
}) => {
  const config = STEP_TYPE_CONFIG[step.step_type];
  const Icon = config.icon;

  const getStepSummary = () => {
    switch (step.step_type) {
      case 'email':
        return step.subject || 'No subject set';
      case 'delay':
        return `Wait ${step.delay_amount || 1} ${step.delay_unit || 'days'}`;
      case 'condition':
        const condType = CONDITION_TYPES.find(c => c.value === step.condition_type);
        return condType?.label || 'No condition set';
      default:
        return '';
    }
  };

  return (
    <div className="relative">
      {/* Connector Line */}
      {index < totalSteps - 1 && (
        <div className="absolute left-6 top-full w-0.5 h-4 bg-gray-700 z-0" />
      )}

      <div
        draggable
        onDragStart={(e) => onDragStart(e, index)}
        onDragOver={(e) => onDragOver(e, index)}
        onDragEnd={onDragEnd}
        onDrop={(e) => onDrop(e, index)}
        className={`admin-card border ${config.borderColor} ${
          isDragging ? 'opacity-50' : ''
        } transition-all`}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 p-4 cursor-pointer"
          onClick={onToggleExpand}
        >
          {/* Drag Handle */}
          <div
            className="p-1 text-gray-500 hover:text-gray-300 cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-5 h-5" />
          </div>

          {/* Step Number & Icon */}
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.bgColor}`}>
            <Icon className={`w-5 h-5 ${config.color}`} />
          </div>

          {/* Step Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-xs">Step {index + 1}</span>
              <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
              {step.ab_variant_id && (
                <span className="text-xs text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">
                  A/B
                </span>
              )}
            </div>
            <p className="text-white text-sm truncate mt-0.5">{getStepSummary()}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={onDuplicate}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Duplicate step"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Delete step"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onToggleExpand}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="px-4 pb-4 pt-0 border-t border-gray-700">
            <div className="pt-4">
              {step.step_type === 'email' && (
                <EmailStepEditor step={step} onUpdate={onUpdate} />
              )}
              {step.step_type === 'delay' && (
                <DelayStepEditor step={step} onUpdate={onUpdate} />
              )}
              {step.step_type === 'condition' && (
                <ConditionStepEditor
                  step={step}
                  onUpdate={onUpdate}
                  totalSteps={totalSteps}
                  sequenceId={sequenceId}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

const SequenceStepEditor: React.FC<SequenceStepEditorProps> = ({
  sequenceId,
  onStepsChange,
  initialSteps = []
}) => {
  const [steps, setSteps] = useState<SequenceStep[]>(initialSteps);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Load steps on mount
  useEffect(() => {
    if (sequenceId && initialSteps.length === 0) {
      loadSteps();
    }
  }, [sequenceId]);

  const loadSteps = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/email/sequences/${sequenceId}/steps`);
      const result = await response.json();
      if (result.success) {
        setSteps(result.data || []);
      } else {
        setError(result.error || 'Failed to load steps');
      }
    } catch (err) {
      setError('Failed to load steps');
      console.error('Load steps error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSteps = async () => {
    setIsSaving(true);
    setError(null);
    try {
      // Save reordered steps
      const response = await fetch(`/api/admin/email/sequences/${sequenceId}/steps/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps: steps.map((s, i) => ({ id: s.id, step_order: i })) })
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to save');
      }

      // Save individual step updates
      for (const step of steps) {
        if (step.id.startsWith('temp_')) {
          // New step - create it
          const createResponse = await fetch(`/api/admin/email/sequences/${sequenceId}/steps`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(step)
          });
          const createResult = await createResponse.json();
          if (!createResult.success) {
            throw new Error(createResult.error || 'Failed to create step');
          }
        } else {
          // Existing step - update it
          const updateResponse = await fetch(`/api/admin/email/sequences/${sequenceId}/steps/${step.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(step)
          });
          const updateResult = await updateResponse.json();
          if (!updateResult.success) {
            throw new Error(updateResult.error || 'Failed to update step');
          }
        }
      }

      setHasChanges(false);
      await loadSteps(); // Reload to get server-generated IDs
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save steps');
      console.error('Save steps error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const addStep = (type: StepType) => {
    const newStep: SequenceStep = {
      id: `temp_${crypto.randomUUID()}`,
      sequence_id: sequenceId,
      step_order: steps.length,
      step_type: type,
      // Default values based on type
      ...(type === 'email' && { subject: '', body: '', from_name: 'R&G Consulting' }),
      ...(type === 'delay' && { delay_amount: 1, delay_unit: 'days' as DelayUnit }),
      ...(type === 'condition' && { condition_type: 'opened_previous' as ConditionType, condition_action: 'continue' as ConditionAction })
    };

    setSteps([...steps, newStep]);
    setExpandedSteps(new Set([...expandedSteps, newStep.id]));
    setHasChanges(true);
    onStepsChange?.([...steps, newStep]);
  };

  const updateStep = (id: string, updates: Partial<SequenceStep>) => {
    const newSteps = steps.map(s => s.id === id ? { ...s, ...updates } : s);
    setSteps(newSteps);
    setHasChanges(true);
    onStepsChange?.(newSteps);
  };

  const deleteStep = async (id: string) => {
    if (!confirm('Delete this step?')) return;

    // If it's a temp step, just remove from local state
    if (id.startsWith('temp_')) {
      const newSteps = steps.filter(s => s.id !== id).map((s, i) => ({ ...s, step_order: i }));
      setSteps(newSteps);
      setHasChanges(true);
      onStepsChange?.(newSteps);
      return;
    }

    // Delete from server
    try {
      const response = await fetch(`/api/admin/email/sequences/${sequenceId}/steps/${id}`, {
        method: 'DELETE'
      });
      const result = await response.json();
      if (result.success) {
        const newSteps = steps.filter(s => s.id !== id).map((s, i) => ({ ...s, step_order: i }));
        setSteps(newSteps);
        onStepsChange?.(newSteps);
      } else {
        setError(result.error || 'Failed to delete step');
      }
    } catch (err) {
      setError('Failed to delete step');
      console.error('Delete step error:', err);
    }
  };

  const duplicateStep = (step: SequenceStep) => {
    const newStep: SequenceStep = {
      ...step,
      id: `temp_${crypto.randomUUID()}`,
      step_order: steps.length,
      ab_variant_id: step.ab_variant_id ? crypto.randomUUID() : undefined
    };
    setSteps([...steps, newStep]);
    setExpandedSteps(new Set([...expandedSteps, newStep.id]));
    setHasChanges(true);
    onStepsChange?.([...steps, newStep]);
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedSteps(newExpanded);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const newSteps = [...steps];
    const [draggedStep] = newSteps.splice(draggedIndex, 1);
    newSteps.splice(dropIndex, 0, draggedStep);

    // Update step_order
    const reorderedSteps = newSteps.map((s, i) => ({ ...s, step_order: i }));
    setSteps(reorderedSteps);
    setHasChanges(true);
    onStepsChange?.(reorderedSteps);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Steps List */}
      <div className="space-y-4">
        {steps.length === 0 ? (
          <div className="text-center py-12 bg-gray-900/30 rounded-lg border border-gray-700 border-dashed">
            <Mail className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-400 mb-2">No Steps Yet</h3>
            <p className="text-gray-500 text-sm mb-4">
              Add your first step to start building this email sequence
            </p>
          </div>
        ) : (
          steps.map((step, index) => (
            <StepCard
              key={step.id}
              step={step}
              index={index}
              totalSteps={steps.length}
              isExpanded={expandedSteps.has(step.id)}
              isDragging={draggedIndex === index}
              sequenceId={sequenceId}
              onToggleExpand={() => toggleExpand(step.id)}
              onUpdate={(updates) => updateStep(step.id, updates)}
              onDelete={() => deleteStep(step.id)}
              onDuplicate={() => duplicateStep(step)}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
            />
          ))
        )}
      </div>

      {/* Add Step Buttons */}
      <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-gray-700">
        <span className="text-gray-400 text-sm">Add step:</span>
        <button
          type="button"
          onClick={() => addStep('email')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 text-blue-400 rounded-lg text-sm transition-colors"
        >
          <Mail className="w-4 h-4" />
          Email
        </button>
        <button
          type="button"
          onClick={() => addStep('delay')}
          className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 text-yellow-400 rounded-lg text-sm transition-colors"
        >
          <Clock className="w-4 h-4" />
          Delay
        </button>
        <button
          type="button"
          onClick={() => addStep('condition')}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 text-purple-400 rounded-lg text-sm transition-colors"
        >
          <GitBranch className="w-4 h-4" />
          Condition
        </button>
      </div>

      {/* Save Button */}
      {hasChanges && (
        <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-700">
          <span className="text-gray-500 text-sm">Unsaved changes</span>
          <button
            type="button"
            onClick={saveSteps}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Steps
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default SequenceStepEditor;
