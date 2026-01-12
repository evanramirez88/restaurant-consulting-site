import React, { useState, useEffect } from 'react';
import {
  Check, X, ChevronLeft, ChevronRight, Building2, MapPin,
  Loader2, AlertCircle, Clock, Sparkles, FileText, ExternalLink
} from 'lucide-react';

interface AtomicFact {
  fact_id: string;
  client_id: string;
  client_name: string;
  client_company: string;
  field_name: string;
  field_value: string;
  original_text: string | null;
  source: string;
  confidence: number;
  created_at: number;
  ai_provider_name: string | null;
}

interface FactTriageQueueProps {
  onRefresh: () => void;
}

const FactTriageQueue: React.FC<FactTriageQueueProps> = ({ onRefresh }) => {
  const [facts, setFacts] = useState<AtomicFact[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isActioning, setIsActioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'approve' | 'reject'; factId: string } | null>(null);

  useEffect(() => {
    loadPendingFacts();
  }, []);

  const loadPendingFacts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/intelligence/facts?status=pending&limit=50');
      const result = await response.json();

      if (result.success) {
        setFacts(result.facts || []);
        setCurrentIndex(0);
      } else {
        setError(result.error || 'Failed to load pending facts');
      }
    } catch (err) {
      setError('Network error loading facts');
      console.error('Facts load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (action: 'approve' | 'reject') => {
    const currentFact = facts[currentIndex];
    if (!currentFact || isActioning) return;

    setIsActioning(true);
    setActionFeedback({ type: action, factId: currentFact.fact_id });

    try {
      const response = await fetch(`/api/admin/intelligence/facts/${currentFact.fact_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reviewed_by: 'admin',
          rejection_reason: action === 'reject' ? 'Manual review rejection' : undefined
        })
      });

      const result = await response.json();

      if (result.success) {
        // Remove the fact from the list and move to next
        setTimeout(() => {
          setFacts(prev => prev.filter(f => f.fact_id !== currentFact.fact_id));
          setActionFeedback(null);
          // Adjust index if we're at the end
          if (currentIndex >= facts.length - 1) {
            setCurrentIndex(Math.max(0, facts.length - 2));
          }
          onRefresh();
        }, 300);
      } else {
        setError(result.error || `Failed to ${action} fact`);
        setActionFeedback(null);
      }
    } catch (err) {
      setError(`Network error during ${action}`);
      setActionFeedback(null);
    } finally {
      setIsActioning(false);
    }
  };

  const formatFieldName = (field: string): string => {
    return field
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
      .trim();
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'text-green-400 bg-green-400/10';
    if (confidence >= 0.6) return 'text-amber-400 bg-amber-400/10';
    return 'text-red-400 bg-red-400/10';
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'ai_research':
        return <Sparkles className="w-4 h-4" />;
      case 'import':
        return <FileText className="w-4 h-4" />;
      case 'web_scrape':
        return <ExternalLink className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (facts.length === 0) {
    return (
      <div className="bg-gray-800/50 rounded-xl p-12 border border-gray-700 text-center">
        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-400" />
        </div>
        <h3 className="text-xl font-display font-bold text-white mb-2">All caught up!</h3>
        <p className="text-gray-400">No pending facts to review. Import some data or run research to discover new facts.</p>
      </div>
    );
  }

  const currentFact = facts[currentIndex];
  const isApproving = actionFeedback?.type === 'approve' && actionFeedback?.factId === currentFact?.fact_id;
  const isRejecting = actionFeedback?.type === 'reject' && actionFeedback?.factId === currentFact?.fact_id;

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400">
          <AlertCircle className="w-4 h-4" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-sm underline">Dismiss</button>
        </div>
      )}

      {/* Progress indicator */}
      <div className="flex items-center justify-between text-sm text-gray-400">
        <span>Reviewing {currentIndex + 1} of {facts.length} pending facts</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            className="p-1 hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setCurrentIndex(Math.min(facts.length - 1, currentIndex + 1))}
            disabled={currentIndex >= facts.length - 1}
            className="p-1 hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Fact Card - Tinder Style */}
      <div className={`relative bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden transition-all duration-300 ${
        isApproving ? 'border-green-500 shadow-lg shadow-green-500/20 translate-x-4 opacity-0' :
        isRejecting ? 'border-red-500 shadow-lg shadow-red-500/20 -translate-x-4 opacity-0' : ''
      }`}>
        {/* Client Header */}
        <div className="bg-gray-900/50 px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-medium text-white">{currentFact.client_company || currentFact.client_name}</h3>
              <p className="text-sm text-gray-400">{currentFact.client_name}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className={`px-2 py-1 rounded text-xs font-medium ${getConfidenceColor(currentFact.confidence)}`}>
                {Math.round(currentFact.confidence * 100)}% confidence
              </span>
            </div>
          </div>
        </div>

        {/* Fact Content */}
        <div className="p-6 space-y-4">
          {/* Field being updated */}
          <div>
            <div className="text-sm text-gray-400 mb-1">Field</div>
            <div className="text-lg font-medium text-amber-400">
              {formatFieldName(currentFact.field_name)}
            </div>
          </div>

          {/* Proposed Value */}
          <div>
            <div className="text-sm text-gray-400 mb-1">Proposed Value</div>
            <div className="text-xl font-bold text-white bg-gray-900/50 rounded-lg p-4">
              {currentFact.field_value}
            </div>
          </div>

          {/* Original Text / Source */}
          {currentFact.original_text && (
            <div>
              <div className="text-sm text-gray-400 mb-1">Source Text</div>
              <div className="text-sm text-gray-300 bg-gray-900/50 rounded-lg p-3 italic">
                "{currentFact.original_text}"
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-4 text-sm text-gray-500 pt-2 border-t border-gray-700">
            <div className="flex items-center gap-1">
              {getSourceIcon(currentFact.source)}
              <span className="capitalize">{currentFact.source.replace(/_/g, ' ')}</span>
            </div>
            {currentFact.ai_provider_name && (
              <div className="flex items-center gap-1">
                <Sparkles className="w-4 h-4" />
                {currentFact.ai_provider_name}
              </div>
            )}
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {new Date(currentFact.created_at * 1000).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex border-t border-gray-700">
          <button
            onClick={() => handleAction('reject')}
            disabled={isActioning}
            className="flex-1 flex items-center justify-center gap-2 py-4 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
            <span className="font-medium">Reject</span>
          </button>
          <div className="w-px bg-gray-700" />
          <button
            onClick={() => handleAction('approve')}
            disabled={isActioning}
            className="flex-1 flex items-center justify-center gap-2 py-4 text-green-400 hover:bg-green-500/10 transition-colors disabled:opacity-50"
          >
            <Check className="w-6 h-6" />
            <span className="font-medium">Approve</span>
          </button>
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="text-center text-sm text-gray-500">
        Tip: Use <kbd className="px-2 py-1 bg-gray-800 rounded text-gray-400">Left Arrow</kbd> to reject,
        <kbd className="px-2 py-1 bg-gray-800 rounded text-gray-400 ml-1">Right Arrow</kbd> to approve
      </div>
    </div>
  );
};

export default FactTriageQueue;
