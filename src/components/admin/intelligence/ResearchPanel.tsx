/**
 * Research Panel Component
 *
 * Comprehensive research tools for:
 * - Website scraping and tech stack detection
 * - Lead discovery by location
 * - Lead enrichment
 * - Bulk operations
 * - Crawler queue monitoring
 * - Public records lookup
 */

import React, { useState, useEffect } from 'react';
import {
  Search, Globe, Database, TrendingUp, Loader2, Play, Pause,
  CheckCircle, XCircle, AlertCircle, RefreshCw, Zap, Target,
  MapPin, Building2, FileText, Users, Link2, ExternalLink,
  ChevronRight, Clock, Activity, Layers, Shield, Download
} from 'lucide-react';

interface CrawlerStats {
  pending: number;
  processing: number;
  completed_24h: number;
  failed_24h: number;
}

interface DiscoveryResult {
  method: string;
  discovered?: any[];
  existing_leads?: number;
  leads_created?: any[];
  message?: string;
}

interface EnrichmentResult {
  success: boolean;
  enriched_fields: Record<string, any>;
  facts_created: number;
  message?: string;
}

const ResearchPanel: React.FC = () => {
  // Research state
  const [researchTarget, setResearchTarget] = useState('');
  const [researchType, setResearchType] = useState<'url' | 'location' | 'technology'>('url');
  const [isResearching, setIsResearching] = useState(false);
  const [researchResult, setResearchResult] = useState<any>(null);

  // Bulk scan state
  const [bulkUrls, setBulkUrls] = useState('');
  const [isBulkScanning, setIsBulkScanning] = useState(false);
  const [bulkResult, setBulkResult] = useState<any>(null);

  // Crawler queue state
  const [crawlerStats, setCrawlerStats] = useState<CrawlerStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Enrichment state
  const [enrichableCount, setEnrichableCount] = useState(0);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState<EnrichmentResult | null>(null);

  // Load crawler stats on mount
  useEffect(() => {
    loadCrawlerStats();
    loadEnrichmentStats();
  }, []);

  const loadCrawlerStats = async () => {
    try {
      const response = await fetch('/api/admin/intelligence/crawler');
      const data = await response.json();
      if (data.success) {
        setCrawlerStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load crawler stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const loadEnrichmentStats = async () => {
    try {
      const response = await fetch('/api/admin/intelligence/enrich');
      const data = await response.json();
      if (data.success) {
        setEnrichableCount(data.stats?.enrichable_leads || 0);
      }
    } catch (error) {
      console.error('Failed to load enrichment stats:', error);
    }
  };

  // Handle single research
  const handleResearch = async () => {
    if (!researchTarget.trim()) return;

    setIsResearching(true);
    setResearchResult(null);

    try {
      let endpoint = '/api/admin/intelligence/discover';
      let body: any = {};

      if (researchType === 'url') {
        body = {
          method: 'bulk_websites',
          websites: [researchTarget.trim()],
        };
      } else if (researchType === 'location') {
        body = {
          method: 'location',
          location: researchTarget.trim(),
        };
      } else if (researchType === 'technology') {
        body = {
          method: 'technology',
          technology: researchTarget.trim(),
        };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      setResearchResult(data);
    } catch (error) {
      setResearchResult({ success: false, error: (error as Error).message });
    } finally {
      setIsResearching(false);
    }
  };

  // Handle bulk website scan
  const handleBulkScan = async () => {
    const urls = bulkUrls
      .split('\n')
      .map(u => u.trim())
      .filter(u => u && (u.startsWith('http') || u.includes('.')));

    if (urls.length === 0) return;

    setIsBulkScanning(true);
    setBulkResult(null);

    try {
      const response = await fetch('/api/admin/intelligence/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'bulk_websites',
          websites: urls,
        }),
      });

      const data = await response.json();
      setBulkResult(data);
      loadCrawlerStats(); // Refresh stats
    } catch (error) {
      setBulkResult({ success: false, error: (error as Error).message });
    } finally {
      setIsBulkScanning(false);
    }
  };

  // Handle bulk enrichment
  const handleBulkEnrich = async () => {
    setIsEnriching(true);
    setEnrichResult(null);

    try {
      // Get leads that need enrichment
      const leadsResponse = await fetch('/api/admin/intelligence/prospects?limit=20');
      const leadsData = await leadsResponse.json();

      if (!leadsData.success || !leadsData.data?.length) {
        setEnrichResult({ success: false, enriched_fields: {}, facts_created: 0, message: 'No leads to enrich' });
        return;
      }

      // Filter to leads with websites but missing data
      const enrichableLeads = leadsData.data
        .filter((l: any) => l.website && (!l.pos_system || l.pos_system === 'Unknown'))
        .slice(0, 10);

      const response = await fetch('/api/admin/intelligence/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bulk_ids: enrichableLeads.map((l: any) => l.id),
        }),
      });

      const data = await response.json();
      setEnrichResult(data);
      loadEnrichmentStats(); // Refresh count
    } catch (error) {
      setEnrichResult({ success: false, enriched_fields: {}, facts_created: 0, message: (error as Error).message });
    } finally {
      setIsEnriching(false);
    }
  };

  // Process crawler queue
  const handleProcessQueue = async () => {
    try {
      const response = await fetch('/api/admin/intelligence/crawler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'process', limit: 10 }),
      });

      await response.json();
      loadCrawlerStats(); // Refresh stats
    } catch (error) {
      console.error('Failed to process queue:', error);
    }
  };

  // Trigger sync
  const handleSync = async () => {
    try {
      await fetch('/api/admin/intelligence/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'all' }),
      });
      loadCrawlerStats();
      loadEnrichmentStats();
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Crawler Queue Status */}
      <div className="admin-card p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-amber-400" />
            <h3 className="text-white font-semibold">Research Queue</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleProcessQueue}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Process Queue"
            >
              <Play className="w-4 h-4" />
            </button>
            <button
              onClick={loadCrawlerStats}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingStats ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {crawlerStats && (
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-500/10 rounded-lg">
              <p className="text-2xl font-bold text-blue-400">{crawlerStats.pending}</p>
              <p className="text-xs text-gray-400">Pending</p>
            </div>
            <div className="text-center p-3 bg-amber-500/10 rounded-lg">
              <p className="text-2xl font-bold text-amber-400">{crawlerStats.processing}</p>
              <p className="text-xs text-gray-400">Processing</p>
            </div>
            <div className="text-center p-3 bg-green-500/10 rounded-lg">
              <p className="text-2xl font-bold text-green-400">{crawlerStats.completed_24h}</p>
              <p className="text-xs text-gray-400">Completed (24h)</p>
            </div>
            <div className="text-center p-3 bg-red-500/10 rounded-lg">
              <p className="text-2xl font-bold text-red-400">{crawlerStats.failed_24h}</p>
              <p className="text-xs text-gray-400">Failed (24h)</p>
            </div>
          </div>
        )}
      </div>

      {/* Single Research */}
      <div className="admin-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Search className="w-5 h-5 text-amber-400" />
          Research Target
        </h3>

        <div className="space-y-4">
          {/* Research Type Selector */}
          <div className="flex gap-2">
            {[
              { id: 'url', label: 'Website URL', icon: Globe },
              { id: 'location', label: 'Location', icon: MapPin },
              { id: 'technology', label: 'Technology', icon: Database },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setResearchType(id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                  researchType === id
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                    : 'bg-gray-800 text-gray-400 border border-gray-700 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={researchTarget}
              onChange={(e) => setResearchTarget(e.target.value)}
              placeholder={
                researchType === 'url' ? 'https://restaurant-website.com' :
                researchType === 'location' ? 'Cape Cod, MA' :
                'Toast, Square, Clover...'
              }
              className="flex-1 px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              onKeyDown={(e) => e.key === 'Enter' && handleResearch()}
            />
            <button
              onClick={handleResearch}
              disabled={isResearching || !researchTarget.trim()}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {isResearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Research
            </button>
          </div>

          {/* Research Result */}
          {researchResult && (
            <div className={`p-4 rounded-lg border ${researchResult.success ? 'bg-green-500/10 border-green-500/50' : 'bg-red-500/10 border-red-500/50'}`}>
              <div className="flex items-start gap-3">
                {researchResult.success ? (
                  <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className={`font-medium ${researchResult.success ? 'text-green-400' : 'text-red-400'}`}>
                    {researchResult.message || researchResult.error || 'Research complete'}
                  </p>
                  {researchResult.new_leads?.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {researchResult.new_leads.map((lead: any, i: number) => (
                        <div key={i} className="text-sm text-gray-300">
                          • {lead.company} {lead.pos && <span className="text-amber-400">({lead.pos})</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  {researchResult.results?.[0]?.data?.tech_stack && (
                    <div className="mt-2 text-sm text-gray-400">
                      <span className="text-gray-300">Tech Stack:</span>
                      {Object.entries(researchResult.results[0].data.tech_stack)
                        .filter(([_, v]) => v)
                        .map(([k, v]) => (
                          <span key={k} className="ml-2 px-2 py-0.5 bg-gray-700 rounded text-xs">
                            {v as string}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Bulk Website Scan */}
        <div className="admin-card p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Layers className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-white font-medium">Bulk Website Scan</span>
          </div>
          <textarea
            value={bulkUrls}
            onChange={(e) => setBulkUrls(e.target.value)}
            placeholder="Paste URLs (one per line)..."
            rows={4}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
          />
          <button
            onClick={handleBulkScan}
            disabled={isBulkScanning || !bulkUrls.trim()}
            className="w-full py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isBulkScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
            Scan Websites
          </button>
          {bulkResult && (
            <p className={`text-xs mt-2 ${bulkResult.success ? 'text-green-400' : 'text-red-400'}`}>
              {bulkResult.message || bulkResult.error}
            </p>
          )}
        </div>

        {/* Lead Enrichment */}
        <div className="admin-card p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Zap className="w-5 h-5 text-green-400" />
            </div>
            <span className="text-white font-medium">Auto-Enrich Leads</span>
          </div>
          <p className="text-gray-400 text-sm mb-3">
            Automatically enrich leads that have websites but missing POS or contact data.
          </p>
          <div className="text-center p-3 bg-gray-900/50 rounded-lg mb-3">
            <p className="text-2xl font-bold text-green-400">{enrichableCount}</p>
            <p className="text-xs text-gray-400">Leads ready to enrich</p>
          </div>
          <button
            onClick={handleBulkEnrich}
            disabled={isEnriching || enrichableCount === 0}
            className="w-full py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isEnriching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Enrich Top 10
          </button>
          {enrichResult && (
            <p className={`text-xs mt-2 ${enrichResult.success ? 'text-green-400' : 'text-red-400'}`}>
              {enrichResult.message || `Enriched ${Object.keys(enrichResult.enriched_fields || {}).length} fields`}
            </p>
          )}
        </div>

        {/* Data Sync */}
        <div className="admin-card p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <RefreshCw className="w-5 h-5 text-purple-400" />
            </div>
            <span className="text-white font-medium">Data Sync</span>
          </div>
          <p className="text-gray-400 text-sm mb-4">
            Sync data from HubSpot, recalculate lead scores, and update client profiles.
          </p>
          <button
            onClick={handleSync}
            className="w-full py-2 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 mb-2"
          >
            <RefreshCw className="w-4 h-4" />
            Run Full Sync
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => fetch('/api/admin/intelligence/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'scores' })
              })}
              className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition-colors"
            >
              Rescore Leads
            </button>
            <button
              onClick={() => fetch('/api/admin/intelligence/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'hubspot' })
              })}
              className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition-colors"
            >
              HubSpot Sync
            </button>
          </div>
        </div>
      </div>

      {/* Research Capabilities */}
      <div className="admin-card p-4">
        <h3 className="text-white font-semibold mb-4">Research Capabilities</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Globe, label: 'Website Scraping', desc: 'Extract contacts, tech stack, social' },
            { icon: Database, label: 'POS Detection', desc: 'Identify Toast, Square, Clover, etc.' },
            { icon: Shield, label: 'Public Records', desc: 'Health inspections, licenses' },
            { icon: Users, label: 'Social Profiles', desc: 'Yelp, Google, Facebook, Instagram' },
            { icon: MapPin, label: 'Location Discovery', desc: 'Find restaurants by area' },
            { icon: Target, label: 'Competitor Research', desc: 'Analyze competitor restaurants' },
            { icon: FileText, label: 'Data Import', desc: 'CSV, JSON, text extraction' },
            { icon: Activity, label: 'Continuous Crawler', desc: 'Background enrichment queue' },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="p-3 bg-gray-900/50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-white font-medium">{label}</span>
              </div>
              <p className="text-xs text-gray-500">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ResearchPanel;
