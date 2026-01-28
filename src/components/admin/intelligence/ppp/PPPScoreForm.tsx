/**
 * PPPScoreForm Component
 * Form for scoring prospects using the P-P-P (Problem-Pain-Priority) framework
 */

import React, { useState, useEffect } from 'react';
import {
  Target,
  Flame,
  Zap,
  Save,
  Loader2,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { PROBLEM_CATEGORIES, PAIN_INDICATORS, PRIORITY_SIGNALS } from '../../../../types/ppp';
import type { PPPProspect, PPPScoreFormData } from '../../../../types/ppp';

interface PPPScoreFormProps {
  prospect: PPPProspect;
  onSave: (data: PPPScoreFormData) => Promise<void>;
  onCancel?: () => void;
}

const PPPScoreForm: React.FC<PPPScoreFormProps> = ({
  prospect,
  onSave,
  onCancel,
}) => {
  // Form state
  const [problemScore, setProblemScore] = useState<number>(prospect.ppp.problem ?? 5);
  const [painScore, setPainScore] = useState<number>(prospect.ppp.pain ?? 5);
  const [priorityScore, setPriorityScore] = useState<number>(prospect.ppp.priority ?? 5);
  const [problemDescription, setProblemDescription] = useState(prospect.research.problemDescription ?? '');
  const [painSymptoms, setPainSymptoms] = useState(prospect.research.painSymptoms ?? '');
  const [prioritySignals, setPrioritySignals] = useState(prospect.research.prioritySignals ?? '');
  
  // UI state
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProblemHelper, setShowProblemHelper] = useState(false);
  const [showPainHelper, setShowPainHelper] = useState(false);
  const [showPriorityHelper, setShowPriorityHelper] = useState(false);

  // Calculate composite score
  const compositeScore = Math.round((problemScore + painScore + priorityScore) / 3 * 10);

  // Update form when prospect changes
  useEffect(() => {
    setProblemScore(prospect.ppp.problem ?? 5);
    setPainScore(prospect.ppp.pain ?? 5);
    setPriorityScore(prospect.ppp.priority ?? 5);
    setProblemDescription(prospect.research.problemDescription ?? '');
    setPainSymptoms(prospect.research.painSymptoms ?? '');
    setPrioritySignals(prospect.research.prioritySignals ?? '');
    setSaved(false);
    setError(null);
  }, [prospect]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      await onSave({
        problemScore,
        painScore,
        priorityScore,
        problemDescription,
        painSymptoms,
        prioritySignals,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save scores');
    } finally {
      setSaving(false);
    }
  };

  // Get score color based on value
  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-red-400';
    if (score >= 6) return 'text-amber-400';
    if (score >= 4) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getCompositeColor = (score: number) => {
    if (score >= 80) return 'bg-red-500';
    if (score >= 60) return 'bg-amber-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // Score slider component
  const ScoreSlider: React.FC<{
    label: string;
    icon: React.ReactNode;
    value: number;
    onChange: (v: number) => void;
    color: string;
    description?: string;
    onHelperToggle?: () => void;
    helperOpen?: boolean;
    helpers?: typeof PROBLEM_CATEGORIES | typeof PAIN_INDICATORS | typeof PRIORITY_SIGNALS;
    onHelperSelect?: (text: string, score: number) => void;
  }> = ({ label, icon, value, onChange, color, description, onHelperToggle, helperOpen, helpers, onHelperSelect }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
          {icon}
          {label}
        </label>
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-bold ${color}`}>{value}</span>
          <span className="text-gray-500 text-sm">/10</span>
          {helpers && (
            <button
              type="button"
              onClick={onHelperToggle}
              className="p-1 text-gray-400 hover:text-amber-400 transition-colors"
              title="Show suggestions"
            >
              {helperOpen ? <ChevronUp className="w-4 h-4" /> : <HelpCircle className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>
      
      <input
        type="range"
        min="1"
        max="10"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
      />
      
      <div className="flex justify-between text-xs text-gray-500">
        <span>Low</span>
        <span>Medium</span>
        <span>High</span>
      </div>
      
      {description && (
        <p className="text-xs text-gray-500">{description}</p>
      )}

      {/* Helper suggestions */}
      {helperOpen && helpers && (
        <div className="mt-2 p-3 bg-gray-900/70 border border-gray-700 rounded-lg space-y-2">
          <p className="text-xs text-gray-400 mb-2">Click to add to notes:</p>
          <div className="flex flex-wrap gap-1.5">
            {helpers.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onHelperSelect?.(item.label, 'weight' in item ? item.weight : 'severity' in item ? item.severity : item.urgency)}
                className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded border border-gray-600 hover:border-amber-500/50 transition-colors"
              >
                {item.label}
                <span className={`ml-1 ${
                  ('weight' in item ? item.weight : 'severity' in item ? item.severity : item.urgency) >= 8 
                    ? 'text-red-400' 
                    : ('weight' in item ? item.weight : 'severity' in item ? item.severity : item.urgency) >= 6 
                    ? 'text-amber-400' 
                    : 'text-green-400'
                }`}>
                  {'weight' in item ? item.weight : 'severity' in item ? item.severity : item.urgency}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Composite Score Display */}
      <div className="flex items-center justify-center">
        <div className={`w-24 h-24 rounded-2xl flex flex-col items-center justify-center ${getCompositeColor(compositeScore)} text-white`}>
          <span className="text-3xl font-bold">{compositeScore}</span>
          <span className="text-xs opacity-80">Composite</span>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-2 text-red-400">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}
      {saved && (
        <div className="p-3 bg-green-500/20 border border-green-500/50 rounded-lg flex items-center gap-2 text-green-400">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">Scores saved successfully!</span>
        </div>
      )}

      {/* Problem Score */}
      <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
        <ScoreSlider
          label="Problem"
          icon={<Target className="w-4 h-4 text-blue-400" />}
          value={problemScore}
          onChange={setProblemScore}
          color={getScoreColor(problemScore)}
          description="What problem does this prospect have that we can solve?"
          onHelperToggle={() => setShowProblemHelper(!showProblemHelper)}
          helperOpen={showProblemHelper}
          helpers={PROBLEM_CATEGORIES}
          onHelperSelect={(text, score) => {
            setProblemDescription(prev => prev ? `${prev}\n• ${text}` : `• ${text}`);
            setProblemScore(Math.max(problemScore, score));
          }}
        />
        <textarea
          value={problemDescription}
          onChange={(e) => setProblemDescription(e.target.value)}
          placeholder="Describe the problem they're facing..."
          className="mt-3 w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:border-amber-500 focus:outline-none resize-none"
          rows={3}
        />
      </div>

      {/* Pain Score */}
      <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
        <ScoreSlider
          label="Pain"
          icon={<Flame className="w-4 h-4 text-orange-400" />}
          value={painScore}
          onChange={setPainScore}
          color={getScoreColor(painScore)}
          description="How severe is their pain? What symptoms are they showing?"
          onHelperToggle={() => setShowPainHelper(!showPainHelper)}
          helperOpen={showPainHelper}
          helpers={PAIN_INDICATORS}
          onHelperSelect={(text, score) => {
            setPainSymptoms(prev => prev ? `${prev}\n• ${text}` : `• ${text}`);
            setPainScore(Math.max(painScore, score));
          }}
        />
        <textarea
          value={painSymptoms}
          onChange={(e) => setPainSymptoms(e.target.value)}
          placeholder="Observable pain symptoms..."
          className="mt-3 w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:border-amber-500 focus:outline-none resize-none"
          rows={3}
        />
      </div>

      {/* Priority Score */}
      <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
        <ScoreSlider
          label="Priority"
          icon={<Zap className="w-4 h-4 text-yellow-400" />}
          value={priorityScore}
          onChange={setPriorityScore}
          color={getScoreColor(priorityScore)}
          description="How urgent is solving this for them? What signals priority?"
          onHelperToggle={() => setShowPriorityHelper(!showPriorityHelper)}
          helperOpen={showPriorityHelper}
          helpers={PRIORITY_SIGNALS}
          onHelperSelect={(text, score) => {
            setPrioritySignals(prev => prev ? `${prev}\n• ${text}` : `• ${text}`);
            setPriorityScore(Math.max(priorityScore, score));
          }}
        />
        <textarea
          value={prioritySignals}
          onChange={(e) => setPrioritySignals(e.target.value)}
          placeholder="Urgency indicators..."
          className="mt-3 w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:border-amber-500 focus:outline-none resize-none"
          rows={3}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save P-P-P Scores
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default PPPScoreForm;
