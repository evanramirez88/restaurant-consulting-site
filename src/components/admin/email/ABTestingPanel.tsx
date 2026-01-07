import React, { useState, useEffect, useCallback } from 'react';
import {
  Beaker, Plus, Play, Pause, Trophy, ChevronRight, Search, Filter,
  RefreshCw, Loader2, AlertCircle, Check, X, ArrowRight, Percent,
  BarChart3, Eye, MousePointer, Mail, Clock, Target, Zap, Info,
  ChevronDown, ChevronUp, Copy, Trash2, Settings, Award
} from 'lucide-react';

// ============================================
// TYPE DEFINITIONS
// ============================================

export type ABTestStatus = 'draft' | 'running' | 'completed' | 'winner_selected';
export type TestType = 'subject' | 'body' | 'sender';
export type WinningMetric = 'open_rate' | 'click_rate' | 'conversion_rate';

export interface ABTest {
  id: string;
  sequence_id: string;
  step_id: string;
  name: string;
  status: ABTestStatus;
  test_type: TestType;
  variant_a_content: string;
  variant_b_content: string;
  traffic_split: number; // Percentage to variant B (0-100)
  winning_metric: WinningMetric;
  confidence_level: number;
  auto_declare_winner: boolean;
  winner_variant?: 'A' | 'B' | null;
  started_at?: number;
  ended_at?: number;
  created_at: number;
  updated_at: number;
  // Joined data
  sequence_name?: string;
  step_subject?: string;
  // Stats
  stats?: ABTestStats;
}

export interface ABTestStats {
  variant_a: VariantStats;
  variant_b: VariantStats;
  significance: SignificanceResult;
}

export interface VariantStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  converted: number;
  open_rate: number;
  click_rate: number;
  conversion_rate: number;
}

export interface SignificanceResult {
  z_score: number;
  p_value: number;
  significant: boolean;
  confidence_interval_a: [number, number];
  confidence_interval_b: [number, number];
  winner: 'A' | 'B' | null;
  recommendation: string;
}

interface EmailSequence {
  id: string;
  name: string;
}

interface SequenceStep {
  id: string;
  sequence_id: string;
  step_order: number;
  step_type: string;
  subject?: string;
  body?: string;
  from_name?: string;
}

// ============================================
// STATISTICAL FUNCTIONS
// ============================================

/**
 * Calculate confidence interval for a proportion
 * Using Wilson score interval for better accuracy with small samples
 */
export function confidenceInterval(
  conversions: number,
  total: number,
  confidence: number = 0.95
): [number, number] {
  if (total === 0) return [0, 0];

  // Z-score for confidence level
  const zScores: Record<number, number> = {
    0.90: 1.645,
    0.95: 1.96,
    0.99: 2.576
  };
  const z = zScores[confidence] || 1.96;

  const p = conversions / total;
  const n = total;

  // Wilson score interval
  const denominator = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) / denominator;

  return [
    Math.max(0, (center - margin) * 100),
    Math.min(100, (center + margin) * 100)
  ];
}

/**
 * Calculate statistical significance using two-proportion z-test
 */
export function calculateSignificance(
  conversionsA: number,
  totalA: number,
  conversionsB: number,
  totalB: number
): { zScore: number; pValue: number; significant: boolean } {
  if (totalA === 0 || totalB === 0) {
    return { zScore: 0, pValue: 1, significant: false };
  }

  const pA = conversionsA / totalA;
  const pB = conversionsB / totalB;

  // Pooled proportion
  const pPooled = (conversionsA + conversionsB) / (totalA + totalB);

  // Standard error
  const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / totalA + 1 / totalB));

  if (se === 0) {
    return { zScore: 0, pValue: 1, significant: false };
  }

  // Z-score
  const zScore = (pB - pA) / se;

  // Two-tailed p-value using normal approximation
  const pValue = 2 * (1 - normalCDF(Math.abs(zScore)));

  return {
    zScore,
    pValue,
    significant: pValue < 0.05
  };
}

/**
 * Standard normal cumulative distribution function
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Calculate minimum sample size needed for detecting a given effect
 */
export function minimumSampleSize(
  baselineRate: number,
  minDetectableEffect: number,
  power: number = 0.8
): number {
  // Z-scores
  const zAlpha = 1.96; // 95% confidence
  const zBeta = power === 0.8 ? 0.84 : power === 0.9 ? 1.28 : 0.84;

  const p1 = baselineRate;
  const p2 = baselineRate + minDetectableEffect;
  const pAvg = (p1 + p2) / 2;

  const numerator = Math.pow(
    zAlpha * Math.sqrt(2 * pAvg * (1 - pAvg)) +
    zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2)),
    2
  );
  const denominator = Math.pow(p2 - p1, 2);

  return Math.ceil(numerator / denominator);
}

// ============================================
// SUB-COMPONENTS
// ============================================

// Traffic Split Slider Component
interface TrafficSplitSliderProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

const TrafficSplitSlider: React.FC<TrafficSplitSliderProps> = ({ value, onChange, disabled }) => {
  const presets = [50, 40, 30, 20, 10];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">Traffic Split</span>
        <div className="flex gap-2">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(preset)}
              disabled={disabled}
              className={`px-2 py-1 text-xs rounded ${
                value === preset
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                  : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
              } disabled:opacity-50`}
            >
              {100 - preset}/{preset}
            </button>
          ))}
        </div>
      </div>

      <div className="relative pt-2">
        <input
          type="range"
          min="10"
          max="50"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          disabled={disabled}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb disabled:cursor-not-allowed"
        />
        <div className="flex justify-between mt-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-sm text-gray-300">Variant A: {100 - value}%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <span className="text-sm text-gray-300">Variant B: {value}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Significance Indicator Component
interface SignificanceIndicatorProps {
  stats: ABTestStats;
  metric: WinningMetric;
  minSampleSize?: number;
}

const SignificanceIndicator: React.FC<SignificanceIndicatorProps> = ({
  stats,
  metric,
  minSampleSize = 100
}) => {
  const totalA = stats.variant_a.sent;
  const totalB = stats.variant_b.sent;

  // Check if we have enough data
  if (totalA < minSampleSize || totalB < minSampleSize) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-500/10 border border-gray-500/30 rounded-lg">
        <Info className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-400">
          Not enough data (need {minSampleSize}+ per variant)
        </span>
      </div>
    );
  }

  const { significant, winner, recommendation } = stats.significance;

  if (!significant) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <AlertCircle className="w-4 h-4 text-yellow-400" />
        <span className="text-sm text-yellow-400">
          No significant difference yet
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
      <Trophy className="w-4 h-4 text-green-400" />
      <span className="text-sm text-green-400">
        Variant {winner} is winning! ({recommendation})
      </span>
    </div>
  );
};

// Results Comparison Component
interface ResultsComparisonProps {
  stats: ABTestStats;
  metric: WinningMetric;
  confidenceLevel: number;
}

const ResultsComparison: React.FC<ResultsComparisonProps> = ({
  stats,
  metric,
  confidenceLevel
}) => {
  const { variant_a, variant_b, significance } = stats;

  const getMetricValue = (variant: VariantStats) => {
    switch (metric) {
      case 'open_rate': return variant.open_rate;
      case 'click_rate': return variant.click_rate;
      case 'conversion_rate': return variant.conversion_rate;
      default: return variant.open_rate;
    }
  };

  const metricLabels: Record<WinningMetric, string> = {
    open_rate: 'Open Rate',
    click_rate: 'Click Rate',
    conversion_rate: 'Conversion Rate'
  };

  const valueA = getMetricValue(variant_a);
  const valueB = getMetricValue(variant_b);
  const maxValue = Math.max(valueA, valueB, 1);

  return (
    <div className="space-y-6">
      {/* Side by Side Stats */}
      <div className="grid grid-cols-2 gap-4">
        {/* Variant A */}
        <div className={`p-4 rounded-lg border ${
          significance.winner === 'A'
            ? 'bg-green-500/10 border-green-500/50'
            : 'bg-gray-900/50 border-gray-700'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-white font-medium">Variant A (Control)</span>
            </div>
            {significance.winner === 'A' && (
              <Trophy className="w-5 h-5 text-green-400" />
            )}
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Sent</span>
              <span className="text-white">{variant_a.sent.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Opened</span>
              <span className="text-white">{variant_a.opened.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Clicked</span>
              <span className="text-white">{variant_a.clicked.toLocaleString()}</span>
            </div>
            <div className="pt-2 border-t border-gray-700">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">{metricLabels[metric]}</span>
                <span className="text-white font-semibold">{valueA.toFixed(2)}%</span>
              </div>
              <div className="text-xs text-gray-500 text-right">
                CI: [{significance.confidence_interval_a[0].toFixed(2)}% - {significance.confidence_interval_a[1].toFixed(2)}%]
              </div>
            </div>
          </div>
        </div>

        {/* Variant B */}
        <div className={`p-4 rounded-lg border ${
          significance.winner === 'B'
            ? 'bg-green-500/10 border-green-500/50'
            : 'bg-gray-900/50 border-gray-700'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-white font-medium">Variant B (Test)</span>
            </div>
            {significance.winner === 'B' && (
              <Trophy className="w-5 h-5 text-green-400" />
            )}
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Sent</span>
              <span className="text-white">{variant_b.sent.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Opened</span>
              <span className="text-white">{variant_b.opened.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Clicked</span>
              <span className="text-white">{variant_b.clicked.toLocaleString()}</span>
            </div>
            <div className="pt-2 border-t border-gray-700">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">{metricLabels[metric]}</span>
                <span className="text-white font-semibold">{valueB.toFixed(2)}%</span>
              </div>
              <div className="text-xs text-gray-500 text-right">
                CI: [{significance.confidence_interval_b[0].toFixed(2)}% - {significance.confidence_interval_b[1].toFixed(2)}%]
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Comparison Bar */}
      <div className="space-y-2">
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400 w-24">Variant A</span>
          <div className="flex-1 h-8 bg-gray-800 rounded-lg overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${(valueA / maxValue) * 100}%` }}
            />
          </div>
          <span className="text-sm text-white w-16 text-right">{valueA.toFixed(2)}%</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400 w-24">Variant B</span>
          <div className="flex-1 h-8 bg-gray-800 rounded-lg overflow-hidden">
            <div
              className="h-full bg-purple-500 transition-all duration-500"
              style={{ width: `${(valueB / maxValue) * 100}%` }}
            />
          </div>
          <span className="text-sm text-white w-16 text-right">{valueB.toFixed(2)}%</span>
        </div>
      </div>

      {/* Statistical Details */}
      <div className="p-3 bg-gray-900/50 rounded-lg border border-gray-700">
        <div className="flex items-center gap-2 text-sm">
          <BarChart3 className="w-4 h-4 text-gray-400" />
          <span className="text-gray-400">Statistical Analysis</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Z-Score</span>
            <p className="text-white">{significance.z_score.toFixed(3)}</p>
          </div>
          <div>
            <span className="text-gray-500">P-Value</span>
            <p className="text-white">{significance.p_value.toFixed(4)}</p>
          </div>
          <div>
            <span className="text-gray-500">Confidence</span>
            <p className="text-white">{(confidenceLevel * 100).toFixed(0)}%</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// CREATE/EDIT WIZARD MODAL
// ============================================

interface ABTestWizardProps {
  test?: ABTest | null;
  onClose: () => void;
  onSave: () => void;
}

const ABTestWizard: React.FC<ABTestWizardProps> = ({ test, onClose, onSave }) => {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [sequences, setSequences] = useState<EmailSequence[]>([]);
  const [steps, setSteps] = useState<SequenceStep[]>([]);
  const [selectedSequence, setSelectedSequence] = useState(test?.sequence_id || '');
  const [selectedStep, setSelectedStep] = useState(test?.step_id || '');
  const [name, setName] = useState(test?.name || '');
  const [testType, setTestType] = useState<TestType>(test?.test_type || 'subject');
  const [variantAContent, setVariantAContent] = useState(test?.variant_a_content || '');
  const [variantBContent, setVariantBContent] = useState(test?.variant_b_content || '');
  const [trafficSplit, setTrafficSplit] = useState(test?.traffic_split || 50);
  const [winningMetric, setWinningMetric] = useState<WinningMetric>(test?.winning_metric || 'open_rate');
  const [confidenceLevel, setConfidenceLevel] = useState(test?.confidence_level || 0.95);
  const [autoDeclareWinner, setAutoDeclareWinner] = useState(test?.auto_declare_winner || false);

  // Load sequences on mount
  useEffect(() => {
    loadSequences();
  }, []);

  // Load steps when sequence changes
  useEffect(() => {
    if (selectedSequence) {
      loadSteps(selectedSequence);
    }
  }, [selectedSequence]);

  // Set variant A content when step is selected
  useEffect(() => {
    if (selectedStep && steps.length > 0) {
      const selectedStepData = steps.find(s => s.id === selectedStep);
      if (selectedStepData) {
        if (testType === 'subject') {
          setVariantAContent(selectedStepData.subject || '');
          if (!variantBContent) setVariantBContent(selectedStepData.subject || '');
        } else if (testType === 'body') {
          setVariantAContent(selectedStepData.body || '');
          if (!variantBContent) setVariantBContent(selectedStepData.body || '');
        } else if (testType === 'sender') {
          setVariantAContent(selectedStepData.from_name || '');
          if (!variantBContent) setVariantBContent(selectedStepData.from_name || '');
        }
      }
    }
  }, [selectedStep, testType, steps]);

  const loadSequences = async () => {
    try {
      const response = await fetch('/api/admin/email/sequences');
      const result = await response.json();
      if (result.success) {
        setSequences(result.data || []);
      }
    } catch (err) {
      console.error('Failed to load sequences:', err);
    }
  };

  const loadSteps = async (sequenceId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/email/sequences/${sequenceId}/steps`);
      const result = await response.json();
      if (result.success) {
        // Filter to only email steps
        const emailSteps = (result.data || []).filter((s: SequenceStep) => s.step_type === 'email');
        setSteps(emailSteps);
      }
    } catch (err) {
      console.error('Failed to load steps:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        sequence_id: selectedSequence,
        step_id: selectedStep,
        name: name.trim(),
        test_type: testType,
        variant_a_content: variantAContent,
        variant_b_content: variantBContent,
        traffic_split: trafficSplit,
        winning_metric: winningMetric,
        confidence_level: confidenceLevel,
        auto_declare_winner: autoDeclareWinner
      };

      const url = test
        ? `/api/admin/email/ab-tests/${test.id}`
        : '/api/admin/email/ab-tests';

      const response = await fetch(url, {
        method: test ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.success) {
        onSave();
      } else {
        setError(result.error || 'Failed to save A/B test');
      }
    } catch (err) {
      setError('Failed to save A/B test');
      console.error('Save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return selectedSequence && selectedStep;
      case 2:
        return variantAContent.trim() && variantBContent.trim() && variantAContent !== variantBContent;
      case 3:
        return trafficSplit >= 10 && trafficSplit <= 50;
      case 4:
        return name.trim().length > 0;
      default:
        return false;
    }
  };

  const selectedStepData = steps.find(s => s.id === selectedStep);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {test ? 'Edit A/B Test' : 'Create A/B Test'}
            </h2>
            <p className="text-sm text-gray-400">Step {step} of 4</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-3 bg-gray-900/50">
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((s) => (
              <React.Fragment key={s}>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    s < step
                      ? 'bg-green-500 text-white'
                      : s === step
                      ? 'bg-amber-500 text-white'
                      : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {s < step ? <Check className="w-4 h-4" /> : s}
                </div>
                {s < 4 && (
                  <div className={`flex-1 h-1 rounded ${s < step ? 'bg-green-500' : 'bg-gray-700'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>Select Step</span>
            <span>Create Variants</span>
            <span>Traffic Split</span>
            <span>Criteria</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Step 1: Select Sequence & Step */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Select Email Sequence
                </label>
                <select
                  value={selectedSequence}
                  onChange={(e) => {
                    setSelectedSequence(e.target.value);
                    setSelectedStep('');
                  }}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Choose a sequence...</option>
                  {sequences.map((seq) => (
                    <option key={seq.id} value={seq.id}>{seq.name}</option>
                  ))}
                </select>
              </div>

              {selectedSequence && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Select Email Step to Test
                  </label>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                    </div>
                  ) : steps.length === 0 ? (
                    <div className="p-4 bg-gray-900/50 rounded-lg text-center text-gray-400">
                      No email steps found in this sequence
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {steps.map((s, index) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelectedStep(s.id)}
                          className={`w-full p-4 rounded-lg border text-left transition-all ${
                            selectedStep === s.id
                              ? 'bg-amber-500/10 border-amber-500/50'
                              : 'bg-gray-900/50 border-gray-700 hover:border-gray-600'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                              <Mail className="w-4 h-4 text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-xs text-gray-500">Step {index + 1}</span>
                              <p className="text-white truncate">{s.subject || 'No subject'}</p>
                            </div>
                            {selectedStep === s.id && (
                              <Check className="w-5 h-5 text-amber-400" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {selectedStepData && (
                <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Current Content Preview</h4>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs text-gray-500">Subject:</span>
                      <p className="text-white text-sm">{selectedStepData.subject}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Body Preview:</span>
                      <p className="text-white text-sm line-clamp-3">{selectedStepData.body}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Create Variants */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  What do you want to test?
                </label>
                <div className="flex gap-2">
                  {(['subject', 'body', 'sender'] as TestType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setTestType(type)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        testType === type
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                          : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
                      }`}
                    >
                      {type === 'subject' ? 'Subject Line' : type === 'body' ? 'Email Body' : 'Sender Name'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Variant A */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <label className="text-sm font-medium text-gray-300">Variant A (Control)</label>
                  </div>
                  {testType === 'body' ? (
                    <textarea
                      value={variantAContent}
                      onChange={(e) => setVariantAContent(e.target.value)}
                      rows={8}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                    />
                  ) : (
                    <input
                      type="text"
                      value={variantAContent}
                      onChange={(e) => setVariantAContent(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>

                {/* Variant B */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-purple-500" />
                    <label className="text-sm font-medium text-gray-300">Variant B (Test)</label>
                  </div>
                  {testType === 'body' ? (
                    <textarea
                      value={variantBContent}
                      onChange={(e) => setVariantBContent(e.target.value)}
                      rows={8}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y"
                    />
                  ) : (
                    <input
                      type="text"
                      value={variantBContent}
                      onChange={(e) => setVariantBContent(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  )}
                </div>
              </div>

              {variantAContent === variantBContent && variantAContent.trim() && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-2 text-yellow-400">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">Variants must be different to run an A/B test</span>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Traffic Split */}
          {step === 3 && (
            <div className="space-y-6">
              <TrafficSplitSlider
                value={trafficSplit}
                onChange={setTrafficSplit}
              />

              <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Sample Size Recommendation</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Minimum per variant for significance:</span>
                    <span className="text-white font-medium">100 recipients</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Recommended for reliable results:</span>
                    <span className="text-white font-medium">300+ recipients</span>
                  </div>
                  <p className="text-xs text-gray-500 pt-2 border-t border-gray-700">
                    With a {100 - trafficSplit}/{trafficSplit} split, you need at least{' '}
                    {Math.ceil(100 / ((100 - trafficSplit) / 100))} total recipients to reach minimum sample size
                    for Variant A and {Math.ceil(100 / (trafficSplit / 100))} for Variant B.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Winning Criteria */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Test Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Subject Line Test - January Welcome"
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Winning Metric
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { value: 'open_rate', label: 'Open Rate', icon: Eye },
                    { value: 'click_rate', label: 'Click Rate', icon: MousePointer },
                    { value: 'conversion_rate', label: 'Conversion', icon: Target }
                  ] as const).map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setWinningMetric(value)}
                      className={`p-4 rounded-lg border text-center transition-all ${
                        winningMetric === value
                          ? 'bg-amber-500/10 border-amber-500/50'
                          : 'bg-gray-900/50 border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <Icon className={`w-6 h-6 mx-auto mb-2 ${
                        winningMetric === value ? 'text-amber-400' : 'text-gray-400'
                      }`} />
                      <span className={`text-sm ${
                        winningMetric === value ? 'text-amber-400' : 'text-gray-300'
                      }`}>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Confidence Level
                </label>
                <div className="flex gap-2">
                  {[0.90, 0.95, 0.99].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setConfidenceLevel(level)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        confidenceLevel === level
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                          : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
                      }`}
                    >
                      {(level * 100).toFixed(0)}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                <div>
                  <p className="text-white text-sm font-medium">Auto-declare winner</p>
                  <p className="text-gray-400 text-xs">Automatically select winner when confidence is reached</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoDeclareWinner(!autoDeclareWinner)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    autoDeclareWinner ? 'bg-amber-500' : 'bg-gray-600'
                  }`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    autoDeclareWinner ? 'translate-x-7' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-between">
          <button
            onClick={step > 1 ? () => setStep(step - 1) : onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            {step > 1 ? 'Back' : 'Cancel'}
          </button>
          <div className="flex gap-3">
            {step < 4 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
                className="flex items-center gap-2 px-6 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={isSaving || !canProceed()}
                className="flex items-center gap-2 px-6 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {test ? 'Update Test' : 'Create Test'}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// RESULTS VIEW MODAL
// ============================================

interface ABTestResultsViewProps {
  test: ABTest;
  onClose: () => void;
  onDeclareWinner: (testId: string, winner: 'A' | 'B') => void;
}

const ABTestResultsView: React.FC<ABTestResultsViewProps> = ({ test, onClose, onDeclareWinner }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<ABTestStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDeclareModal, setShowDeclareModal] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<'A' | 'B' | null>(null);

  useEffect(() => {
    loadResults();
  }, [test.id]);

  const loadResults = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/email/ab-tests/${test.id}/results`);
      const result = await response.json();
      if (result.success) {
        setStats(result.data);
      } else {
        setError(result.error || 'Failed to load results');
      }
    } catch (err) {
      setError('Failed to load results');
      console.error('Load results error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeclareWinner = (winner: 'A' | 'B') => {
    setSelectedWinner(winner);
    setShowDeclareModal(true);
  };

  const confirmDeclareWinner = () => {
    if (selectedWinner) {
      onDeclareWinner(test.id, selectedWinner);
      setShowDeclareModal(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">{test.name}</h2>
            <p className="text-sm text-gray-400">
              Testing: {test.test_type === 'subject' ? 'Subject Line' : test.test_type === 'body' ? 'Email Body' : 'Sender Name'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            </div>
          ) : error ? (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-center">
              {error}
            </div>
          ) : stats ? (
            <div className="space-y-6">
              {/* Significance Indicator */}
              <SignificanceIndicator stats={stats} metric={test.winning_metric} />

              {/* Results Comparison */}
              <ResultsComparison
                stats={stats}
                metric={test.winning_metric}
                confidenceLevel={test.confidence_level}
              />

              {/* Variant Content Preview */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-sm font-medium text-gray-300">Variant A Content</span>
                  </div>
                  <p className="text-white text-sm whitespace-pre-wrap">{test.variant_a_content}</p>
                </div>
                <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full bg-purple-500" />
                    <span className="text-sm font-medium text-gray-300">Variant B Content</span>
                  </div>
                  <p className="text-white text-sm whitespace-pre-wrap">{test.variant_b_content}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-400 py-12">
              No results available yet
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Close
          </button>
          {test.status === 'running' && stats && (
            <div className="flex gap-3">
              <button
                onClick={() => handleDeclareWinner('A')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 text-blue-400 font-medium rounded-lg transition-colors"
              >
                <Award className="w-4 h-4" />
                Declare A Winner
              </button>
              <button
                onClick={() => handleDeclareWinner('B')}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 text-purple-400 font-medium rounded-lg transition-colors"
              >
                <Award className="w-4 h-4" />
                Declare B Winner
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Declare Winner Confirmation Modal */}
      {showDeclareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
                <Trophy className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Declare Winner</h3>
                <p className="text-sm text-gray-400">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-gray-300 mb-6">
              Are you sure you want to declare <strong className={selectedWinner === 'A' ? 'text-blue-400' : 'text-purple-400'}>
                Variant {selectedWinner}
              </strong> as the winner? The test will be stopped and the winning variant will be marked.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeclareModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeclareWinner}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
              >
                <Trophy className="w-4 h-4" />
                Confirm Winner
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

const ABTestingPanel: React.FC = () => {
  const [tests, setTests] = useState<ABTest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showWizard, setShowWizard] = useState(false);
  const [editingTest, setEditingTest] = useState<ABTest | null>(null);
  const [viewingResults, setViewingResults] = useState<ABTest | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadTests();
  }, [filterStatus]);

  const loadTests = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.append('status', filterStatus);

      const response = await fetch(`/api/admin/email/ab-tests?${params}`);
      const result = await response.json();

      if (result.success) {
        setTests(result.data || []);
      } else {
        setError(result.error || 'Failed to load A/B tests');
      }
    } catch (err) {
      console.error('Failed to load tests:', err);
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartTest = async (id: string) => {
    setActionLoading(id);
    try {
      const response = await fetch(`/api/admin/email/ab-tests/${id}/start`, {
        method: 'POST'
      });
      const result = await response.json();
      if (result.success) {
        setTests(prev => prev.map(t => t.id === id ? { ...t, status: 'running', started_at: Math.floor(Date.now() / 1000) } : t));
      } else {
        setError(result.error || 'Failed to start test');
      }
    } catch (err) {
      setError('Failed to start test');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStopTest = async (id: string) => {
    setActionLoading(id);
    try {
      const response = await fetch(`/api/admin/email/ab-tests/${id}/stop`, {
        method: 'POST'
      });
      const result = await response.json();
      if (result.success) {
        setTests(prev => prev.map(t => t.id === id ? { ...t, status: 'completed', ended_at: Math.floor(Date.now() / 1000) } : t));
      } else {
        setError(result.error || 'Failed to stop test');
      }
    } catch (err) {
      setError('Failed to stop test');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeclareWinner = async (id: string, winner: 'A' | 'B') => {
    setActionLoading(id);
    try {
      const response = await fetch(`/api/admin/email/ab-tests/${id}/declare-winner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winner })
      });
      const result = await response.json();
      if (result.success) {
        setTests(prev => prev.map(t => t.id === id ? {
          ...t,
          status: 'winner_selected',
          winner_variant: winner,
          ended_at: Math.floor(Date.now() / 1000)
        } : t));
      } else {
        setError(result.error || 'Failed to declare winner');
      }
    } catch (err) {
      setError('Failed to declare winner');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteTest = async (id: string) => {
    if (!confirm('Are you sure you want to delete this A/B test? This cannot be undone.')) {
      return;
    }

    setActionLoading(id);
    try {
      const response = await fetch(`/api/admin/email/ab-tests/${id}`, {
        method: 'DELETE'
      });
      const result = await response.json();
      if (result.success) {
        setTests(prev => prev.filter(t => t.id !== id));
      } else {
        setError(result.error || 'Failed to delete test');
      }
    } catch (err) {
      setError('Failed to delete test');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredTests = tests.filter(test => {
    const matchesSearch =
      test.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      test.sequence_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const getStatusBadge = (status: ABTestStatus, winner?: string | null) => {
    const statusConfig: Record<ABTestStatus, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
      draft: { bg: 'bg-gray-500/20', text: 'text-gray-400', icon: <Clock className="w-3 h-3" />, label: 'Draft' },
      running: { bg: 'bg-green-500/20', text: 'text-green-400', icon: <Play className="w-3 h-3" />, label: 'Running' },
      completed: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: <Pause className="w-3 h-3" />, label: 'Completed' },
      winner_selected: {
        bg: 'bg-amber-500/20',
        text: 'text-amber-400',
        icon: <Trophy className="w-3 h-3" />,
        label: winner ? `Winner: ${winner}` : 'Winner Selected'
      }
    };

    const config = statusConfig[status] || statusConfig.draft;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${config.bg} ${config.text} border border-current/30`}>
        {config.icon}
        {config.label}
      </span>
    );
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '-';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
            <Beaker className="w-5 h-5 text-amber-400" />
            A/B Testing
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {tests.length} total tests{filteredTests.length !== tests.length ? ` (${filteredTests.length} shown)` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadTests}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setEditingTest(null);
              setShowWizard(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create A/B Test
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span className="text-red-400">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="admin-card p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search tests by name or sequence..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="winner_selected">Winner Selected</option>
          </select>
        </div>
      </div>

      {/* Tests Table */}
      {filteredTests.length > 0 ? (
        <div className="admin-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700 bg-gray-800/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Test</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Sequence</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Split</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Started</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {filteredTests.map((test) => (
                  <tr key={test.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Beaker className="w-4 h-4 text-purple-400" />
                        </div>
                        <div>
                          <button
                            onClick={() => setViewingResults(test)}
                            className="text-white font-medium hover:text-amber-400 transition-colors text-left"
                          >
                            {test.name}
                          </button>
                          <p className="text-gray-500 text-xs truncate max-w-[200px]">
                            {test.step_subject || 'Step subject'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-sm">
                      {test.sequence_name || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(test.status, test.winner_variant)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs text-gray-400 capitalize">{test.test_type}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm text-gray-300">{100 - test.traffic_split}/{test.traffic_split}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm">
                      {formatDate(test.started_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {actionLoading === test.id ? (
                          <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                        ) : (
                          <>
                            {test.status === 'draft' && (
                              <button
                                onClick={() => handleStartTest(test.id)}
                                className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-gray-700 rounded transition-colors"
                                title="Start Test"
                              >
                                <Play className="w-4 h-4" />
                              </button>
                            )}
                            {test.status === 'running' && (
                              <button
                                onClick={() => handleStopTest(test.id)}
                                className="p-1.5 text-gray-400 hover:text-yellow-400 hover:bg-gray-700 rounded transition-colors"
                                title="Stop Test"
                              >
                                <Pause className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => setViewingResults(test)}
                              className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-700 rounded transition-colors"
                              title="View Results"
                            >
                              <BarChart3 className="w-4 h-4" />
                            </button>
                            {test.status === 'draft' && (
                              <button
                                onClick={() => {
                                  setEditingTest(test);
                                  setShowWizard(true);
                                }}
                                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                                title="Edit"
                              >
                                <Settings className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteTest(test.id)}
                              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="admin-card p-12 text-center">
          <Beaker className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-white font-semibold mb-2">No A/B Tests Found</h3>
          <p className="text-gray-400 text-sm mb-4">
            {searchQuery || filterStatus !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Create your first A/B test to optimize your email campaigns'}
          </p>
          {!searchQuery && filterStatus === 'all' && (
            <button
              onClick={() => {
                setEditingTest(null);
                setShowWizard(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create First A/B Test
            </button>
          )}
        </div>
      )}

      {/* Wizard Modal */}
      {showWizard && (
        <ABTestWizard
          test={editingTest}
          onClose={() => {
            setShowWizard(false);
            setEditingTest(null);
          }}
          onSave={() => {
            setShowWizard(false);
            setEditingTest(null);
            loadTests();
          }}
        />
      )}

      {/* Results Modal */}
      {viewingResults && (
        <ABTestResultsView
          test={viewingResults}
          onClose={() => setViewingResults(null)}
          onDeclareWinner={handleDeclareWinner}
        />
      )}
    </div>
  );
};

export default ABTestingPanel;
