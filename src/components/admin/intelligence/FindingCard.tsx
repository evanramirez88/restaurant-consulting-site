import React, { useState } from 'react';
import {
  Brain, AlertTriangle, TrendingUp, Users, Globe, Zap, Star,
  MapPin, ExternalLink, ChevronDown, CheckCircle, Clock, XCircle
} from 'lucide-react';

interface Finding {
  id: string;
  agent_type: string;
  finding_type: string;
  title: string;
  summary: string | null;
  confidence_score: number;
  priority: string;
  status: string;
  territory: string | null;
  source_url: string | null;
  action_taken?: string | null;
  created_at: number;
}

interface FindingCardProps {
  finding: Finding;
  compact?: boolean;
  onUpdate?: () => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  normal: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  low: 'bg-gray-700 text-gray-400 border-gray-600',
};

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-400',
  reviewed: 'bg-purple-500/20 text-purple-400',
  actionable: 'bg-amber-500/20 text-amber-400',
  acted_on: 'bg-green-500/20 text-green-400',
  dismissed: 'bg-gray-700 text-gray-400',
};

const FINDING_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  lead_opportunity: Users,
  competitor_move: AlertTriangle,
  market_trend: TrendingUp,
  client_risk: AlertTriangle,
  upsell_signal: Star,
  news_mention: Globe,
  technology_change: Zap,
  expansion_opportunity: MapPin,
  review_alert: AlertTriangle,
  pricing_intel: TrendingUp,
  partnership_lead: Users,
};

const FindingCard: React.FC<FindingCardProps> = ({ finding, compact = false, onUpdate }) => {
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState(false);

  const Icon = FINDING_TYPE_ICONS[finding.finding_type] || Brain;

  const formatDate = (ts: number) => {
    const d = new Date(ts * 1000);
    const now = new Date();
    const diffHrs = (now.getTime() - d.getTime()) / 3600000;
    if (diffHrs < 1) return `${Math.floor((now.getTime() - d.getTime()) / 60000)}m ago`;
    if (diffHrs < 24) return `${Math.floor(diffHrs)}h ago`;
    if (diffHrs < 168) return `${Math.floor(diffHrs / 24)}d ago`;
    return d.toLocaleDateString();
  };

  const handleStatusUpdate = async (newStatus: string, actionTaken?: string) => {
    setUpdating(true);
    try {
      await fetch('/api/admin/intelligence/findings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: finding.id, status: newStatus, action_taken: actionTaken })
      });
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Failed to update finding:', err);
    } finally {
      setUpdating(false);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg hover:bg-gray-900/70 transition-colors">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            finding.priority === 'urgent' ? 'bg-red-500/20' :
            finding.priority === 'high' ? 'bg-orange-500/20' : 'bg-gray-700'
          }`}>
            <Icon className={`w-4 h-4 ${
              finding.priority === 'urgent' ? 'text-red-400' :
              finding.priority === 'high' ? 'text-orange-400' : 'text-gray-400'
            }`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white truncate">{finding.title}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`px-1.5 py-0.5 rounded text-xs border ${PRIORITY_COLORS[finding.priority]}`}>
                {finding.priority}
              </span>
              <span className="text-xs text-gray-500 capitalize">{finding.finding_type.replace(/_/g, ' ')}</span>
            </div>
          </div>
        </div>
        <div className="text-right shrink-0 ml-3">
          <p className="text-xs text-gray-500">{formatDate(finding.created_at)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden hover:border-gray-600 transition-colors">
      <div
        className="flex items-center gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          finding.priority === 'urgent' ? 'bg-red-500/20' :
          finding.priority === 'high' ? 'bg-orange-500/20' : 'bg-gray-700'
        }`}>
          <Icon className={`w-4 h-4 ${
            finding.priority === 'urgent' ? 'text-red-400' :
            finding.priority === 'high' ? 'text-orange-400' : 'text-gray-400'
          }`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white truncate">{finding.title}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={`px-1.5 py-0.5 rounded text-xs border ${PRIORITY_COLORS[finding.priority]}`}>
              {finding.priority}
            </span>
            <span className={`px-1.5 py-0.5 rounded text-xs ${STATUS_COLORS[finding.status]}`}>
              {finding.status.replace('_', ' ')}
            </span>
            <span className="text-xs text-gray-500 capitalize">{finding.finding_type.replace(/_/g, ' ')}</span>
            {finding.territory && (
              <span className="text-xs text-gray-600 flex items-center gap-0.5">
                <MapPin className="w-3 h-3" />{finding.territory}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <p className="text-xs text-gray-500">{formatDate(finding.created_at)}</p>
            <p className="text-xs text-gray-600">{finding.confidence_score}% conf.</p>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Expanded Detail */}
      {expanded && (
        <div className="border-t border-gray-700 p-4 bg-gray-900/30">
          {finding.summary && (
            <p className="text-sm text-gray-300 mb-3">{finding.summary}</p>
          )}
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
            <span>Agent: {finding.agent_type.replace(/_/g, ' ')}</span>
            {finding.source_url && (
              <a
                href={finding.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-amber-400 hover:underline"
                onClick={e => e.stopPropagation()}
              >
                <ExternalLink className="w-3 h-3" />Source
              </a>
            )}
          </div>

          {finding.action_taken && (
            <div className="bg-green-500/10 border border-green-500/20 rounded p-2 mb-3">
              <p className="text-xs text-green-400 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Action taken: {finding.action_taken}
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {finding.status === 'new' && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); handleStatusUpdate('actionable'); }}
                  disabled={updating}
                  className="px-3 py-1.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-xs hover:bg-amber-500/30 disabled:opacity-50 flex items-center gap-1"
                >
                  <Zap className="w-3 h-3" />
                  Mark Actionable
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleStatusUpdate('reviewed'); }}
                  disabled={updating}
                  className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-xs hover:bg-gray-600 disabled:opacity-50 flex items-center gap-1"
                >
                  <Clock className="w-3 h-3" />
                  Mark Reviewed
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleStatusUpdate('dismissed'); }}
                  disabled={updating}
                  className="px-3 py-1.5 text-gray-500 rounded text-xs hover:text-gray-300 disabled:opacity-50 flex items-center gap-1"
                >
                  <XCircle className="w-3 h-3" />
                  Dismiss
                </button>
              </>
            )}
            {finding.status === 'reviewed' && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); handleStatusUpdate('actionable'); }}
                  disabled={updating}
                  className="px-3 py-1.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-xs hover:bg-amber-500/30 disabled:opacity-50 flex items-center gap-1"
                >
                  <Zap className="w-3 h-3" />
                  Mark Actionable
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleStatusUpdate('dismissed'); }}
                  disabled={updating}
                  className="px-3 py-1.5 text-gray-500 rounded text-xs hover:text-gray-300 disabled:opacity-50 flex items-center gap-1"
                >
                  <XCircle className="w-3 h-3" />
                  Dismiss
                </button>
              </>
            )}
            {finding.status === 'actionable' && (
              <button
                onClick={(e) => { e.stopPropagation(); handleStatusUpdate('acted_on', 'Reviewed and addressed'); }}
                disabled={updating}
                className="px-3 py-1.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded text-xs hover:bg-green-500/30 disabled:opacity-50 flex items-center gap-1"
              >
                <CheckCircle className="w-3 h-3" />
                Mark Completed
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FindingCard;
