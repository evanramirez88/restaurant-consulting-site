/**
 * ProspectCard Component
 * Displays prospect information with P-P-P scores in a compact card format
 */

import React from 'react';
import {
  Building2,
  MapPin,
  Mail,
  Phone,
  Globe,
  ExternalLink,
  ChevronRight,
  Target,
  Flame,
  Zap,
  Clock,
} from 'lucide-react';
import type { PPPProspect } from '../../../../types/ppp';

interface ProspectCardProps {
  prospect: PPPProspect;
  isSelected?: boolean;
  onClick?: () => void;
  compact?: boolean;
}

const ProspectCard: React.FC<ProspectCardProps> = ({
  prospect,
  isSelected = false,
  onClick,
  compact = false,
}) => {
  const hasScores = prospect.ppp.composite !== null;
  
  // Get score color based on value
  const getScoreColor = (score: number | null, type: 'bg' | 'text' | 'border' = 'bg') => {
    if (score === null) return type === 'bg' ? 'bg-gray-700' : type === 'text' ? 'text-gray-500' : 'border-gray-600';
    if (score >= 80) return type === 'bg' ? 'bg-red-500' : type === 'text' ? 'text-red-400' : 'border-red-500';
    if (score >= 60) return type === 'bg' ? 'bg-amber-500' : type === 'text' ? 'text-amber-400' : 'border-amber-500';
    if (score >= 40) return type === 'bg' ? 'bg-yellow-500' : type === 'text' ? 'text-yellow-400' : 'border-yellow-500';
    return type === 'bg' ? 'bg-green-500' : type === 'text' ? 'text-green-400' : 'border-green-500';
  };

  const formatTimeAgo = (timestamp: number | undefined) => {
    if (!timestamp) return 'Never';
    const seconds = Math.floor(Date.now() / 1000 - timestamp);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  if (compact) {
    return (
      <div
        onClick={onClick}
        className={`p-3 bg-gray-800/50 border rounded-lg cursor-pointer transition-all hover:border-amber-500/50 ${
          isSelected ? 'border-amber-500 bg-amber-500/10' : 'border-gray-700'
        }`}
      >
        <div className="flex items-center gap-3">
          {/* Composite Score Badge */}
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getScoreColor(prospect.ppp.composite)} text-white font-bold`}>
            {prospect.ppp.composite ?? '?'}
          </div>

          {/* Name & Location */}
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium truncate">{prospect.name}</p>
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {prospect.city}, {prospect.state}
              {prospect.posSystem && prospect.posSystem !== 'Unknown' && (
                <span className="ml-2 px-1.5 py-0.5 bg-gray-700 rounded text-gray-300">
                  {prospect.posSystem}
                </span>
              )}
            </p>
          </div>

          {/* Mini P-P-P indicators */}
          <div className="flex gap-1">
            <div className={`w-6 h-6 rounded text-xs flex items-center justify-center ${getScoreColor(prospect.ppp.problem ? prospect.ppp.problem * 10 : null)} text-white`}>
              {prospect.ppp.problem ?? '-'}
            </div>
            <div className={`w-6 h-6 rounded text-xs flex items-center justify-center ${getScoreColor(prospect.ppp.pain ? prospect.ppp.pain * 10 : null)} text-white`}>
              {prospect.ppp.pain ?? '-'}
            </div>
            <div className={`w-6 h-6 rounded text-xs flex items-center justify-center ${getScoreColor(prospect.ppp.priority ? prospect.ppp.priority * 10 : null)} text-white`}>
              {prospect.ppp.priority ?? '-'}
            </div>
          </div>

          <ChevronRight className={`w-5 h-5 text-gray-500 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`bg-gray-800/50 border rounded-xl overflow-hidden cursor-pointer transition-all hover:border-amber-500/50 ${
        isSelected ? 'border-amber-500 ring-1 ring-amber-500/30' : 'border-gray-700'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-700/50">
        <div className="flex items-start gap-4">
          {/* Composite Score */}
          <div className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center ${getScoreColor(prospect.ppp.composite)} text-white`}>
            <span className="text-2xl font-bold">{prospect.ppp.composite ?? '?'}</span>
            <span className="text-xs opacity-80">P-P-P</span>
          </div>

          {/* Name & Details */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-white truncate">{prospect.name}</h3>
            {prospect.dbaName && prospect.dbaName !== prospect.name && (
              <p className="text-sm text-gray-400 truncate">DBA: {prospect.dbaName}</p>
            )}
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {prospect.city}, {prospect.state}
              </span>
              {prospect.region && (
                <span className="px-2 py-0.5 bg-gray-700 rounded text-xs">
                  {prospect.region}
                </span>
              )}
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex flex-col items-end gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
              prospect.status === 'qualified' ? 'bg-green-500/20 text-green-400' :
              prospect.status === 'contacted' ? 'bg-amber-500/20 text-amber-400' :
              prospect.status === 'client' ? 'bg-purple-500/20 text-purple-400' :
              'bg-blue-500/20 text-blue-400'
            }`}>
              {prospect.status}
            </span>
            {prospect.leadScore && (
              <span className="text-xs text-gray-500">
                Lead: {prospect.leadScore}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* P-P-P Scores Row */}
      <div className="grid grid-cols-3 gap-px bg-gray-700/30">
        {/* Problem */}
        <div className="bg-gray-800/50 p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-xs text-gray-400 mb-1">
            <Target className="w-3.5 h-3.5" />
            Problem
          </div>
          <div className={`text-xl font-bold ${getScoreColor(prospect.ppp.problem ? prospect.ppp.problem * 10 : null, 'text')}`}>
            {prospect.ppp.problem ?? '-'}<span className="text-xs text-gray-500">/10</span>
          </div>
        </div>

        {/* Pain */}
        <div className="bg-gray-800/50 p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-xs text-gray-400 mb-1">
            <Flame className="w-3.5 h-3.5" />
            Pain
          </div>
          <div className={`text-xl font-bold ${getScoreColor(prospect.ppp.pain ? prospect.ppp.pain * 10 : null, 'text')}`}>
            {prospect.ppp.pain ?? '-'}<span className="text-xs text-gray-500">/10</span>
          </div>
        </div>

        {/* Priority */}
        <div className="bg-gray-800/50 p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-xs text-gray-400 mb-1">
            <Zap className="w-3.5 h-3.5" />
            Priority
          </div>
          <div className={`text-xl font-bold ${getScoreColor(prospect.ppp.priority ? prospect.ppp.priority * 10 : null, 'text')}`}>
            {prospect.ppp.priority ?? '-'}<span className="text-xs text-gray-500">/10</span>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="p-4 space-y-3">
        {/* Business Info */}
        <div className="flex flex-wrap gap-2 text-sm">
          {prospect.posSystem && prospect.posSystem !== 'Unknown' && (
            <span className="flex items-center gap-1 px-2 py-1 bg-gray-700/50 rounded text-gray-300">
              <Building2 className="w-3.5 h-3.5" />
              {prospect.posSystem}
            </span>
          )}
          {prospect.cuisine && (
            <span className="px-2 py-1 bg-gray-700/50 rounded text-gray-300">
              {prospect.cuisine}
            </span>
          )}
          {prospect.serviceStyle && (
            <span className="px-2 py-1 bg-gray-700/50 rounded text-gray-300">
              {prospect.serviceStyle}
            </span>
          )}
        </div>

        {/* Contact Info */}
        <div className="flex flex-wrap gap-3 text-sm">
          {prospect.email && (
            <a 
              href={`mailto:${prospect.email}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-amber-400 hover:text-amber-300"
            >
              <Mail className="w-3.5 h-3.5" />
              {prospect.email}
            </a>
          )}
          {prospect.phone && (
            <a 
              href={`tel:${prospect.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-green-400 hover:text-green-300"
            >
              <Phone className="w-3.5 h-3.5" />
              {prospect.phone}
            </a>
          )}
          {prospect.website && (
            <a 
              href={prospect.website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
            >
              <Globe className="w-3.5 h-3.5" />
              Website
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {/* Research Preview */}
        {prospect.research.problemDescription && (
          <div className="p-2 bg-gray-900/50 rounded text-sm text-gray-400 line-clamp-2">
            <strong className="text-gray-300">Problem:</strong> {prospect.research.problemDescription}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-700/50">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Scored: {hasScores ? formatTimeAgo(prospect.pppLastScoredAt) : 'Never'}
          </span>
          {prospect.pppScoredBy && (
            <span>by {prospect.pppScoredBy}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProspectCard;
