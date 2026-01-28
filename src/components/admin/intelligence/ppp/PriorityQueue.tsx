/**
 * PriorityQueue Component
 * Displays prospects sorted by P-P-P composite score with quick filters
 */

import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Target,
  Flame,
  Zap,
  Filter,
  ArrowUpDown,
  LayoutGrid,
  List,
  Eye,
  EyeOff,
} from 'lucide-react';
import ProspectCard from './ProspectCard';
import type { PPPProspect, PPPSortField, PPPSortOrder } from '../../../../types/ppp';

interface PriorityQueueProps {
  prospects: PPPProspect[];
  selectedId?: string;
  onSelect: (prospect: PPPProspect) => void;
  sortBy: PPPSortField;
  sortOrder: PPPSortOrder;
  onSortChange: (field: PPPSortField, order: PPPSortOrder) => void;
  scoredOnly?: boolean;
  unscoredOnly?: boolean;
  onFilterChange: (filters: { scoredOnly?: boolean; unscoredOnly?: boolean }) => void;
  stats: {
    total: number;
    scored: number;
    unscored: number;
    avgComposite: number;
  };
}

const PriorityQueue: React.FC<PriorityQueueProps> = ({
  prospects,
  selectedId,
  onSelect,
  sortBy,
  sortOrder,
  onSortChange,
  scoredOnly = false,
  unscoredOnly = false,
  onFilterChange,
  stats,
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'compact'>('compact');

  const sortOptions: { field: PPPSortField; label: string; icon: React.ReactNode }[] = [
    { field: 'composite', label: 'Composite', icon: <TrendingUp className="w-4 h-4" /> },
    { field: 'problem', label: 'Problem', icon: <Target className="w-4 h-4" /> },
    { field: 'pain', label: 'Pain', icon: <Flame className="w-4 h-4" /> },
    { field: 'priority', label: 'Priority', icon: <Zap className="w-4 h-4" /> },
    { field: 'leadScore', label: 'Lead Score', icon: <TrendingUp className="w-4 h-4" /> },
    { field: 'updated', label: 'Updated', icon: <ArrowUpDown className="w-4 h-4" /> },
  ];

  const toggleSort = (field: PPPSortField) => {
    if (sortBy === field) {
      onSortChange(field, sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      onSortChange(field, 'desc');
    }
  };

  // Calculate tier distribution
  const tiers = {
    hot: prospects.filter(p => (p.ppp.composite ?? 0) >= 80).length,
    warm: prospects.filter(p => (p.ppp.composite ?? 0) >= 60 && (p.ppp.composite ?? 0) < 80).length,
    cool: prospects.filter(p => (p.ppp.composite ?? 0) >= 40 && (p.ppp.composite ?? 0) < 60).length,
    cold: prospects.filter(p => (p.ppp.composite ?? 0) < 40 && p.ppp.composite !== null).length,
    unscored: prospects.filter(p => p.ppp.composite === null).length,
  };

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-white">{stats.total}</p>
          <p className="text-xs text-gray-400">Total</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-400">{stats.scored}</p>
          <p className="text-xs text-gray-400">Scored</p>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-gray-400">{stats.unscored}</p>
          <p className="text-xs text-gray-400">Unscored</p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-amber-400">{stats.avgComposite}</p>
          <p className="text-xs text-gray-400">Avg Score</p>
        </div>
      </div>

      {/* Tier Distribution */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
        <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Score Distribution</h4>
        <div className="flex items-center gap-1 h-6">
          {tiers.hot > 0 && (
            <div
              className="h-full bg-red-500 rounded-l transition-all"
              style={{ width: `${(tiers.hot / prospects.length) * 100}%` }}
              title={`Hot (80+): ${tiers.hot}`}
            />
          )}
          {tiers.warm > 0 && (
            <div
              className="h-full bg-amber-500 transition-all"
              style={{ width: `${(tiers.warm / prospects.length) * 100}%` }}
              title={`Warm (60-79): ${tiers.warm}`}
            />
          )}
          {tiers.cool > 0 && (
            <div
              className="h-full bg-yellow-500 transition-all"
              style={{ width: `${(tiers.cool / prospects.length) * 100}%` }}
              title={`Cool (40-59): ${tiers.cool}`}
            />
          )}
          {tiers.cold > 0 && (
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${(tiers.cold / prospects.length) * 100}%` }}
              title={`Cold (<40): ${tiers.cold}`}
            />
          )}
          {tiers.unscored > 0 && (
            <div
              className="h-full bg-gray-600 rounded-r transition-all"
              style={{ width: `${(tiers.unscored / prospects.length) * 100}%` }}
              title={`Unscored: ${tiers.unscored}`}
            />
          )}
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-red-500 rounded" /> Hot: {tiers.hot}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-amber-500 rounded" /> Warm: {tiers.warm}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-yellow-500 rounded" /> Cool: {tiers.cool}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded" /> Cold: {tiers.cold}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-gray-600 rounded" /> Unscored: {tiers.unscored}
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-gray-800/30 rounded-lg p-3">
        {/* Sort Options */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5" />
            Sort:
          </span>
          {sortOptions.map((option) => (
            <button
              key={option.field}
              onClick={() => toggleSort(option.field)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                sortBy === option.field
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                  : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
              }`}
            >
              {option.icon}
              {option.label}
              {sortBy === option.field && (
                sortOrder === 'desc' ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />
              )}
            </button>
          ))}
        </div>

        {/* View & Filter Controls */}
        <div className="flex items-center gap-2">
          {/* Scored/Unscored Filter */}
          <div className="flex items-center gap-1 border-l border-gray-700 pl-2">
            <button
              onClick={() => onFilterChange({ 
                scoredOnly: !scoredOnly, 
                unscoredOnly: false 
              })}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                scoredOnly
                  ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                  : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
              }`}
              title="Show only scored prospects"
            >
              <Eye className="w-3.5 h-3.5" />
              Scored
            </button>
            <button
              onClick={() => onFilterChange({ 
                unscoredOnly: !unscoredOnly, 
                scoredOnly: false 
              })}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                unscoredOnly
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                  : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
              }`}
              title="Show only unscored prospects"
            >
              <EyeOff className="w-3.5 h-3.5" />
              Unscored
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center border border-gray-700 rounded overflow-hidden">
            <button
              onClick={() => setViewMode('compact')}
              className={`p-1.5 ${viewMode === 'compact' ? 'bg-amber-500/20 text-amber-400' : 'text-gray-400 hover:text-white'}`}
              title="Compact view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 ${viewMode === 'list' ? 'bg-amber-500/20 text-amber-400' : 'text-gray-400 hover:text-white'}`}
              title="Card view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Prospect List */}
      <div className={viewMode === 'list' ? 'grid gap-4 md:grid-cols-2' : 'space-y-2'}>
        {prospects.length === 0 ? (
          <div className="col-span-2 text-center py-12 bg-gray-800/30 rounded-lg">
            <Filter className="w-10 h-10 mx-auto mb-3 text-gray-600" />
            <p className="text-gray-400">No prospects match your filters</p>
          </div>
        ) : (
          prospects.map((prospect) => (
            <ProspectCard
              key={prospect.id}
              prospect={prospect}
              isSelected={selectedId === prospect.id}
              onClick={() => onSelect(prospect)}
              compact={viewMode === 'compact'}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default PriorityQueue;
