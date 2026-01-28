/**
 * IntelligenceResearcher Component
 * Main admin interface for P-P-P (Problem-Pain-Priority) prospect research
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Brain,
  Search,
  RefreshCw,
  Filter,
  MapPin,
  Building2,
  ChevronLeft,
  Loader2,
  X,
  AlertTriangle,
} from 'lucide-react';
import ProspectCard from './ProspectCard';
import PPPScoreForm from './PPPScoreForm';
import ResearchNotes from './ResearchNotes';
import PriorityQueue from './PriorityQueue';
import type { PPPProspect, PPPSortField, PPPSortOrder, PPPFilters, PPPScoreFormData, ResearchLogEntry } from '../../../../types/ppp';

// Cape Cod regions for filtering
const CAPE_COD_REGIONS = ['Outer Cape', 'Lower Cape', 'Mid Cape', 'Upper Cape'];

interface IntelligenceResearcherProps {
  // Optional: pre-select a prospect
  initialProspectId?: string;
}

const IntelligenceResearcher: React.FC<IntelligenceResearcherProps> = ({
  initialProspectId,
}) => {
  // Data state
  const [prospects, setProspects] = useState<PPPProspect[]>([]);
  const [selectedProspect, setSelectedProspect] = useState<PPPProspect | null>(null);
  const [researchLog, setResearchLog] = useState<ResearchLogEntry[]>([]);
  const [stats, setStats] = useState({ total: 0, scored: 0, unscored: 0, avgComposite: 0 });
  
  // Loading/error state
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filter state
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState<string>('all');
  const [posSystem, setPosSystem] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [scoredOnly, setScoredOnly] = useState(false);
  const [unscoredOnly, setUnscoredOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Sort state
  const [sortBy, setSortBy] = useState<PPPSortField>('composite');
  const [sortOrder, setSortOrder] = useState<PPPSortOrder>('desc');
  
  // Pagination
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);

  // Fetch prospects
  const fetchProspects = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('offset', String(offset));
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);
      if (search) params.set('search', search);
      if (region !== 'all') params.set('region', region);
      if (posSystem !== 'all') params.set('pos', posSystem);
      if (status !== 'all') params.set('status', status);
      if (scoredOnly) params.set('scoredOnly', 'true');
      if (unscoredOnly) params.set('unscoredOnly', 'true');

      const response = await fetch(`/api/admin/intelligence/ppp?${params}`, {
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to fetch prospects');

      const data = await response.json();
      if (data.success) {
        setProspects(data.data);
        setStats({
          total: data.total,
          scored: data.scored,
          unscored: data.unscored,
          avgComposite: data.avgComposite,
        });
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [limit, offset, sortBy, sortOrder, search, region, posSystem, status, scoredOnly, unscoredOnly]);

  // Fetch prospect detail
  const fetchProspectDetail = async (id: string) => {
    setLoadingDetail(true);
    try {
      const response = await fetch(`/api/admin/intelligence/ppp/${id}`, {
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Failed to fetch prospect details');
      
      const data = await response.json();
      if (data.success) {
        setSelectedProspect(data.data);
        setResearchLog(data.data.researchLog || []);
      }
    } catch (err: any) {
      console.error('Failed to fetch prospect detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Handle prospect selection
  const handleSelectProspect = (prospect: PPPProspect) => {
    if (selectedProspect?.id === prospect.id) {
      setSelectedProspect(null);
    } else {
      fetchProspectDetail(prospect.id);
    }
  };

  // Handle P-P-P score save
  const handleSavePPP = async (data: PPPScoreFormData) => {
    if (!selectedProspect) return;

    const response = await fetch(`/api/admin/intelligence/ppp/${selectedProspect.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || 'Failed to save scores');
    }

    // Refresh data
    await fetchProspectDetail(selectedProspect.id);
    await fetchProspects(true);
  };

  // Handle notes save
  const handleSaveNotes = async (notes: string) => {
    if (!selectedProspect) return;

    const response = await fetch(`/api/admin/intelligence/ppp/${selectedProspect.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ researchNotes: notes }),
    });

    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || 'Failed to save notes');
    }

    await fetchProspectDetail(selectedProspect.id);
  };

  // Initial load
  useEffect(() => {
    fetchProspects();
  }, [fetchProspects]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setOffset(0);
      fetchProspects();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Initial prospect selection
  useEffect(() => {
    if (initialProspectId && !selectedProspect) {
      fetchProspectDetail(initialProspectId);
    }
  }, [initialProspectId]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
            <Brain className="w-5 h-5 text-amber-400" />
            Intelligence Researcher
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            P-P-P Framework: Problem • Pain • Priority
          </p>
        </div>
        <button
          onClick={() => fetchProspects(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-gray-900 font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-3 text-red-400">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => fetchProspects()} className="ml-auto text-sm underline">
            Retry
          </button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 space-y-4">
        <div className="flex gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search prospects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors ${
              showFilters 
                ? 'bg-amber-500/20 border-amber-500 text-amber-400' 
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>

        {/* Expandable Filters */}
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-gray-700">
            <select
              value={region}
              onChange={(e) => { setRegion(e.target.value); setOffset(0); }}
              className="px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white text-sm focus:border-amber-500"
            >
              <option value="all">All Regions</option>
              {CAPE_COD_REGIONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            <select
              value={posSystem}
              onChange={(e) => { setPosSystem(e.target.value); setOffset(0); }}
              className="px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white text-sm focus:border-amber-500"
            >
              <option value="all">All POS</option>
              <option value="Toast">Toast</option>
              <option value="Square">Square</option>
              <option value="Clover">Clover</option>
              <option value="unknown">Unknown</option>
            </select>

            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setOffset(0); }}
              className="px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white text-sm focus:border-amber-500"
            >
              <option value="all">All Status</option>
              <option value="prospect">Prospect</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="client">Client</option>
            </select>

            <button
              onClick={() => {
                setSearch('');
                setRegion('all');
                setPosSystem('all');
                setStatus('all');
                setScoredOnly(false);
                setUnscoredOnly(false);
                setOffset(0);
              }}
              className="px-3 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg hover:border-gray-600"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Priority Queue */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
              Priority Queue
              <span className="px-2 py-0.5 bg-gray-700 rounded text-xs">
                {prospects.length} prospects
              </span>
            </h3>
            <PriorityQueue
              prospects={prospects}
              selectedId={selectedProspect?.id}
              onSelect={handleSelectProspect}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={(field, order) => {
                setSortBy(field);
                setSortOrder(order);
                setOffset(0);
              }}
              scoredOnly={scoredOnly}
              unscoredOnly={unscoredOnly}
              onFilterChange={(filters) => {
                if (filters.scoredOnly !== undefined) setScoredOnly(filters.scoredOnly);
                if (filters.unscoredOnly !== undefined) setUnscoredOnly(filters.unscoredOnly);
                setOffset(0);
              }}
              stats={stats}
            />
          </div>

          {/* Right: Detail Panel */}
          <div className="space-y-4">
            {selectedProspect ? (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                    P-P-P Scoring
                  </h3>
                  <button
                    onClick={() => setSelectedProspect(null)}
                    className="text-gray-400 hover:text-white text-sm flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Close
                  </button>
                </div>

                {loadingDetail ? (
                  <div className="flex items-center justify-center py-20 bg-gray-800/30 rounded-xl">
                    <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Prospect Info Card */}
                    <ProspectCard prospect={selectedProspect} isSelected />

                    {/* P-P-P Score Form */}
                    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                      <h4 className="text-sm font-medium text-gray-300 mb-4">Score Prospect</h4>
                      <PPPScoreForm
                        prospect={selectedProspect}
                        onSave={handleSavePPP}
                      />
                    </div>

                    {/* Research Notes */}
                    <ResearchNotes
                      prospect={selectedProspect}
                      researchLog={researchLog}
                      onSaveNotes={handleSaveNotes}
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 bg-gray-800/30 rounded-xl border border-gray-700">
                <Brain className="w-12 h-12 text-gray-600 mb-4" />
                <p className="text-gray-400 text-center">
                  Select a prospect from the priority queue<br />
                  to score and research
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default IntelligenceResearcher;
