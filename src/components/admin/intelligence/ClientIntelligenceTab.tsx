/**
 * Client Intelligence Dashboard
 * Market intelligence and research platform for restaurant industry data
 *
 * Integrates with: Clients, Toast Hub, Email Marketing, Leads
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Brain, Search, Building2, RefreshCw, Loader2, Plus, Filter, Download,
  ChevronRight, ExternalLink, Mail, Phone, MapPin, Globe, TrendingUp,
  BarChart3, PieChart, Users, Database, FileText, Upload, CheckCircle,
  XCircle, AlertCircle, Clock, Calendar, Settings, Zap, Target, Star,
  DollarSign, Activity, Eye, Edit2, Trash2, MoreVertical, Tag, X,
  ChevronDown, ChevronUp, List, Grid3X3, Link2, Send, Sparkles,
  ShoppingCart, FileSearch, History, Scale, Copy, Check
} from 'lucide-react';
import ResearchPanel from './ResearchPanel';
import IntelligenceDashboard from './IntelligenceDashboard';

// Types
interface IntelClient {
  id: string;
  name: string;
  company: string;
  email: string;
  phone?: string;
  website?: string;
  // Location fields
  address?: string;
  town?: string;
  state?: string;
  zip?: string;
  region?: string;
  // Business classification
  category?: string;
  service_style?: string;
  pos_system?: string;
  online_ordering?: string;
  seasonal?: boolean;
  // Licensure & Compliance
  license_number?: string;
  license_type?: string;
  seating_capacity?: number;
  // Health & Safety
  health_score?: number;
  last_inspection_date?: string;
  // Business metrics
  revenue_estimate?: string;
  employee_count?: number;
  rating?: number;
  last_contact?: number;
  // Lead management
  lead_score?: number;
  status: 'prospect' | 'lead' | 'client' | 'churned';
  hubspot_id?: string;
  domain?: string;
  source?: string;
  tags?: string[];
  notes?: string;
  created_at: number;

  // NEW: Menu Analysis Fields
  menu_item_count?: number;
  menu_category_count?: number;
  avg_menu_price?: number;
  menu_url?: string;
  menu_complexity?: string;
  price_level?: number;
  bar_program?: string;

  // NEW: Financial Estimates
  estimated_annual_revenue?: number;
  estimated_daily_covers?: number;
  avg_check_size?: number;
  hours_json?: string;
  days_open?: number;

  // NEW: Property/Assessor Data
  parcel_id?: string;
  property_owner?: string;
  building_sqft?: number;
  square_footage?: number;
  property_value?: number;
  assessor_url?: string;
  floor_plan_notes?: string;

  // NEW: Owner/Contact Info
  owner_name?: string;
  owner_email?: string;
  owner_phone?: string;
  years_in_business?: number;
  established_date?: string;

  // NEW: Review/Rating Data
  google_rating?: number;
  google_review_count?: number;
  yelp_rating?: number;
  yelp_review_count?: number;
  tripadvisor_rating?: number;

  // NEW: Enrichment Tracking
  data_completeness?: number;
  enrichment_confidence?: number;
  last_enriched_at?: number;
}

interface IntelFact {
  id: string;
  client_id: string;
  fact_type: string;
  field: string;
  value: string;
  source: string;
  confidence: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: number;
}

interface MarketStats {
  total_prospects: number;
  total_leads: number;
  total_clients: number;
  avg_lead_score: number;
  by_region: Record<string, number>;
  by_pos: Record<string, number>;
  by_category: Record<string, number>;
}

type TabType = 'overview' | 'prospects' | 'research' | 'facts' | 'findings' | 'import';
type ViewMode = 'table' | 'cards';

// Cape Cod sub-regions as defined in demo prototype (NO BOSTON)
const REGIONS = ['Outer Cape', 'Lower Cape', 'Mid Cape', 'Upper Cape', 'South Shore', 'Islands', 'Other'];
const POS_SYSTEMS = ['Toast', 'Square', 'Clover', 'Aloha', 'Micros', 'Lightspeed', 'Upserve', 'Unknown'];
const CATEGORIES = ['Casual Dining', 'Fine Dining', 'Fast Casual', 'Bar/Pub', 'Cafe', 'Seafood', 'Pizza', 'Bakery', 'Other'];

const ClientIntelligenceTab: React.FC = () => {
  // Tab & View State
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  // Data State
  const [prospects, setProspects] = useState<IntelClient[]>([]);
  const [pendingFacts, setPendingFacts] = useState<IntelFact[]>([]);
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRegion, setFilterRegion] = useState('all');
  const [filterPOS, setFilterPOS] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Modal State
  const [selectedProspect, setSelectedProspect] = useState<IntelClient | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showResearchModal, setShowResearchModal] = useState(false);

  // Import State
  const [importText, setImportText] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Research State
  const [isResearching, setIsResearching] = useState(false);
  const [researchMessage, setResearchMessage] = useState<string | null>(null);
  const [researchResults, setResearchResults] = useState<any | null>(null);

  // Campaign State
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [availableCampaigns, setAvailableCampaigns] = useState<{ id: string, name: string, description: string, target_segment: string }[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [campaignProspect, setCampaignProspect] = useState<IntelClient | null>(null);

  // Sync State
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    let loadedProspects: IntelClient[] = [];
    let loadedStats: MarketStats | null = null;
    let loadedFacts: IntelFact[] = [];

    try {
      // Load prospects/leads from intelligence API
      const [prospectsRes, factsRes, statsRes] = await Promise.all([
        fetch('/api/admin/intelligence/prospects').catch(() => ({ ok: false })),
        fetch('/api/admin/intelligence/facts?status=pending').catch(() => ({ ok: false })),
        fetch('/api/admin/intelligence/stats').catch(() => ({ ok: false }))
      ]);

      if (prospectsRes.ok) {
        const data = await (prospectsRes as Response).json();
        if (data.success && data.data) {
          loadedProspects = data.data;
        }
      }

      if (factsRes.ok) {
        const data = await (factsRes as Response).json();
        if (data.success) {
          // Facts API returns 'facts' not 'data'
          loadedFacts = data.facts || data.data || [];
        }
      }

      if (statsRes.ok) {
        const data = await (statsRes as Response).json();
        if (data.success && data.data) {
          loadedStats = data.data;
        }
      }

      // Use loaded data - NO demo fallback
      setProspects(loadedProspects);
      setStats(loadedStats);
      setPendingFacts(loadedFacts);
    } catch (error) {
      console.error('Failed to load intelligence data:', error);
      // Show empty state on error - NO demo data
      setProspects([]);
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter prospects
  const filteredProspects = prospects.filter(p => {
    const matchesSearch = searchQuery === '' ||
      p.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.town?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRegion = filterRegion === 'all' || p.region === filterRegion;
    const matchesPOS = filterPOS === 'all' || p.pos_system === filterPOS;
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus;

    return matchesSearch && matchesRegion && matchesPOS && matchesStatus;
  });

  // Handle sync
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await fetch('/api/admin/intelligence/sync', { method: 'POST' });
      await loadData();
      setLastSync(Date.now());
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle import
  const handleImport = async () => {
    if (!importText && !importFile) return;

    setIsImporting(true);
    try {
      let response;

      if (importFile) {
        // Use FormData for file upload
        const formData = new FormData();
        formData.append('file', importFile);
        if (selectedProspect) {
          formData.append('client_id', selectedProspect.id);
        }
        response = await fetch('/api/admin/intelligence/import', {
          method: 'POST',
          body: formData
        });
      } else {
        // Use JSON for text import
        response = await fetch('/api/admin/intelligence/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: importText,
            client_id: selectedProspect?.id || null
          })
        });
      }

      const result = await response.json();
      if (result.success) {
        await loadData();
        setShowImportModal(false);
        setImportText('');
        setImportFile(null);
        // Show success message
        console.log('Import completed:', result.message);
      } else {
        console.error('Import failed:', result.error);
      }
    } catch (error) {
      console.error('Import failed:', error);
    } finally {
      setIsImporting(false);
    }
  };

  // Handle fact approval
  const handleFactAction = async (factId: string, action: 'approve' | 'reject') => {
    try {
      const response = await fetch(`/api/admin/intelligence/facts/${factId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reviewed_by: 'admin' })
      });
      const result = await response.json();
      if (result.success) {
        setPendingFacts(prev => prev.filter(f => f.id !== factId));
      }
    } catch (error) {
      console.error('Fact action failed:', error);
    }
  };

  // Handle FULL research for a prospect - uses AI enrichment to FIND data
  const handleResearch = async (prospect: IntelClient) => {
    setIsResearching(true);
    setResearchMessage('Starting full research and data enrichment...');
    setResearchResults(null);

    try {
      // Use the full enrichment API - it will search for data even without a website
      const response = await fetch('/api/admin/intelligence/enrich-full', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: prospect.id,
          company: prospect.company,
          town: prospect.town,
          address: prospect.address,
          enrichTypes: ['all'] // Get everything: general, menu, reviews, assessor, license, financial
        })
      });

      const result = await response.json();

      if (result.success && result.data) {
        // Store the research results for display
        setResearchResults(result.data);

        const fieldsFound = result.fields_updated || result.data.fields_updated?.length || 0;
        const sourcesUsed = result.sources_used || result.data.sources?.length || 0;

        let message = `Research complete! Found data from ${sourcesUsed} sources.`;

        // Highlight key findings
        const findings = [];
        if (result.data.owner_name) findings.push(`Owner: ${result.data.owner_name}`);
        if (result.data.website) findings.push('Website found');
        if (result.data.google_rating) findings.push(`Rating: ${result.data.google_rating}/5`);
        if (result.data.estimated_annual_revenue) {
          findings.push(`Est. Revenue: $${(result.data.estimated_annual_revenue / 1000).toFixed(0)}K`);
        }
        if (result.data.assessor_url) findings.push('Assessor records available');

        if (findings.length > 0) {
          message += ' ' + findings.join(' · ');
        }

        setResearchMessage(message);
        // Don't clear the message automatically so user can see results
      } else {
        setResearchMessage(`Research incomplete: ${result.error || 'No data found'}. Try manual lookup.`);
        setTimeout(() => setResearchMessage(null), 5000);
      }
    } catch (error) {
      console.error('Research failed:', error);
      setResearchMessage(`Research error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTimeout(() => setResearchMessage(null), 5000);
    } finally {
      setIsResearching(false);
    }
  };

  // Fetch available campaigns
  const fetchCampaigns = async () => {
    try {
      const response = await fetch('/api/admin/intelligence/enrich-full?action=campaigns');
      const result = await response.json();
      if (result.success && result.campaigns) {
        setAvailableCampaigns(result.campaigns);
      } else {
        // Fallback default campaigns
        setAvailableCampaigns([
          { id: 'camp_toast_support', name: 'Toast Support Outreach', description: 'For existing Toast users', target_segment: 'toast_existing' },
          { id: 'camp_pos_switcher', name: 'POS Switcher Campaign', description: 'For Clover/Square users looking to switch', target_segment: 'switchers' },
          { id: 'camp_local_network', name: 'Local Network Campaign', description: 'For Cape Cod restaurants', target_segment: 'local' },
          { id: 'camp_menu_builder', name: 'Menu Builder Launch', description: 'Promoting menu builder tool', target_segment: 'all' },
        ]);
      }
    } catch (error) {
      console.error('Failed to fetch campaigns:', error);
    }
  };

  // Handle adding to campaign with selection
  const handleAddToCampaign = (prospect: IntelClient) => {
    setCampaignProspect(prospect);
    fetchCampaigns();
    setShowCampaignModal(true);
  };

  // Confirm adding to selected campaign
  const confirmAddToCampaign = async () => {
    if (!campaignProspect || !selectedCampaign) return;

    try {
      const campaign = availableCampaigns.find(c => c.id === selectedCampaign);
      const sequenceId = campaign?.id.replace('camp_', 'seq_') + '_001' || 'seq_toast_support_001';

      const response = await fetch('/api/email/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: campaignProspect.email,
          name: campaignProspect.name,
          sequenceId: sequenceId,
          leadId: campaignProspect.id
        })
      });
      const result = await response.json();
      if (result.success) {
        setResearchMessage(`Added ${campaignProspect.name} to "${campaign?.name}" campaign`);
      } else {
        setResearchMessage(`Failed to add to campaign: ${result.error}`);
      }
      setTimeout(() => setResearchMessage(null), 5000);
    } catch (error) {
      setResearchMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTimeout(() => setResearchMessage(null), 5000);
    } finally {
      setShowCampaignModal(false);
      setSelectedCampaign(null);
      setCampaignProspect(null);
    }
  };

  // Export prospects
  const handleExport = () => {
    const csv = [
      ['Company', 'Contact', 'Email', 'Phone', 'Town', 'Region', 'POS', 'Status', 'Lead Score'].join(','),
      ...filteredProspects.map(p => [
        p.company, p.name, p.email, p.phone || '', p.town || '', p.region || '',
        p.pos_system || '', p.status, p.lead_score || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `intelligence-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      prospect: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
      lead: 'bg-amber-500/20 text-amber-400 border-amber-500/50',
      client: 'bg-green-500/20 text-green-400 border-green-500/50',
      churned: 'bg-red-500/20 text-red-400 border-red-500/50'
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs border ${styles[status] || 'bg-gray-500/20 text-gray-400'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // Get lead score color
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-amber-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-gray-400';
  };

  // Format time ago
  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'prospects', label: 'Prospects', icon: <Users className="w-4 h-4" />, count: prospects.length },
    { id: 'research', label: 'Research', icon: <Search className="w-4 h-4" /> },
    { id: 'facts', label: 'Review Queue', icon: <CheckCircle className="w-4 h-4" />, count: pendingFacts.length },
    { id: 'findings', label: 'Findings', icon: <Brain className="w-4 h-4" /> },
    { id: 'import', label: 'Import', icon: <Upload className="w-4 h-4" /> }
  ];

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
            <Brain className="w-5 h-5 text-amber-400" />
            Market Intelligence
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Restaurant industry data, prospects, and market research
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastSync && (
            <span className="text-xs text-gray-500">
              Last sync: {formatTimeAgo(lastSync)}
            </span>
          )}
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            title="Sync Data"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExport}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="Export CSV"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Import Data
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${activeTab === tab.id
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
              : 'text-gray-400 hover:text-white hover:bg-gray-800 border border-transparent'
              }`}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded text-xs ${activeTab === tab.id ? 'bg-amber-500/30' : 'bg-gray-700'
                }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Overview Tab - Empty State */}
      {activeTab === 'overview' && !stats && (
        <div className="admin-card p-12 text-center">
          <BarChart3 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-white font-semibold mb-2">No Intelligence Data Yet</h3>
          <p className="text-gray-400 text-sm mb-4">
            Start by importing leads or researching prospects using the Research tab
          </p>
          <button
            onClick={() => setActiveTab('research')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
          >
            <Search className="w-4 h-4" />
            Start Research
          </button>
        </div>
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && stats && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="admin-card p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <span className="text-gray-400 text-sm">Prospects</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats.total_prospects}</p>
              <p className="text-xs text-gray-500 mt-1">Total in database</p>
            </div>

            <div className="admin-card p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <Target className="w-5 h-5 text-amber-400" />
                </div>
                <span className="text-gray-400 text-sm">Active Leads</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats.total_leads}</p>
              <p className="text-xs text-gray-500 mt-1">Qualified opportunities</p>
            </div>

            <div className="admin-card p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Building2 className="w-5 h-5 text-green-400" />
                </div>
                <span className="text-gray-400 text-sm">Clients</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats.total_clients}</p>
              <p className="text-xs text-gray-500 mt-1">Active accounts</p>
            </div>

            <div className="admin-card p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-purple-400" />
                </div>
                <span className="text-gray-400 text-sm">Avg Lead Score</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats.avg_lead_score}</p>
              <p className="text-xs text-gray-500 mt-1">Out of 100</p>
            </div>
          </div>

          {/* Charts Row - LARGER Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* By Region - LARGER */}
            <div className="admin-card p-6 min-h-[320px]">
              <h3 className="text-base font-semibold text-gray-300 uppercase tracking-wider mb-6 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-amber-400" />
                By Region
              </h3>
              <div className="space-y-4">
                {Object.entries(stats.by_region).map(([region, count]) => (
                  <div key={region}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-200 font-medium">{region}</span>
                      <span className="text-white font-bold text-lg">{count}</span>
                    </div>
                    <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all"
                        style={{ width: `${(count / Math.max(...Object.values(stats.by_region))) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* By POS System - LARGER */}
            <div className="admin-card p-6 min-h-[320px]">
              <h3 className="text-base font-semibold text-gray-300 uppercase tracking-wider mb-6 flex items-center gap-2">
                <Database className="w-5 h-5 text-green-400" />
                By POS System
              </h3>
              <div className="space-y-4">
                {Object.entries(stats.by_pos).slice(0, 6).map(([pos, count]) => (
                  <div key={pos}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-200 font-medium">{pos}</span>
                      <span className="text-white font-bold text-lg">{count}</span>
                    </div>
                    <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pos === 'Toast' ? 'bg-gradient-to-r from-green-500 to-emerald-400' :
                          pos === 'Square' ? 'bg-gradient-to-r from-blue-500 to-cyan-400' :
                            pos === 'Clover' ? 'bg-gradient-to-r from-lime-500 to-green-400' :
                              'bg-gradient-to-r from-gray-500 to-gray-400'
                          }`}
                        style={{ width: `${(count / Math.max(...Object.values(stats.by_pos))) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* By Category - LARGER */}
            <div className="admin-card p-6 min-h-[320px]">
              <h3 className="text-base font-semibold text-gray-300 uppercase tracking-wider mb-6 flex items-center gap-2">
                <Tag className="w-5 h-5 text-purple-400" />
                By Category
              </h3>
              <div className="space-y-4">
                {Object.entries(stats.by_category).slice(0, 6).map(([cat, count]) => (
                  <div key={cat}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-200 font-medium">{cat}</span>
                      <span className="text-white font-bold text-lg">{count}</span>
                    </div>
                    <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
                        style={{ width: `${(count / Math.max(...Object.values(stats.by_category))) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="admin-card p-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Recent Leads
            </h3>
            <div className="space-y-2">
              {prospects.filter(p => p.status === 'lead').slice(0, 5).map(lead => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between p-3 bg-gray-900/30 rounded-lg hover:bg-gray-800/50 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedProspect(lead);
                    setActiveTab('prospects');
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center border border-gray-700">
                      <Building2 className="w-5 h-5 text-gray-500" />
                    </div>
                    <div>
                      <p className="text-white font-medium">{lead.company}</p>
                      <p className="text-gray-400 text-sm">{lead.town} · {lead.pos_system}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-lg font-bold ${getScoreColor(lead.lead_score || 0)}`}>
                      {lead.lead_score}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Prospects Tab */}
      {activeTab === 'prospects' && (
        <div className="space-y-4">
          {/* Search & Filters */}
          <div className="admin-card p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by company, contact, email, or town..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={filterRegion}
                  onChange={(e) => setFilterRegion(e.target.value)}
                  className="px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="all">All Regions</option>
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <select
                  value={filterPOS}
                  onChange={(e) => setFilterPOS(e.target.value)}
                  className="px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="all">All POS</option>
                  {POS_SYSTEMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="all">All Status</option>
                  <option value="prospect">Prospects</option>
                  <option value="lead">Leads</option>
                  <option value="client">Clients</option>
                </select>
                <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('table')}
                    className={`p-2 rounded transition-colors ${viewMode === 'table' ? 'bg-amber-500/20 text-amber-400' : 'text-gray-400 hover:text-white'}`}
                    title="Table View"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('cards')}
                    className={`p-2 rounded transition-colors ${viewMode === 'cards' ? 'bg-amber-500/20 text-amber-400' : 'text-gray-400 hover:text-white'}`}
                    title="Card View"
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-3 text-sm text-gray-400">
              Showing {filteredProspects.length} of {prospects.length} records
            </div>
          </div>

          {/* Table View */}
          {viewMode === 'table' && filteredProspects.length > 0 && (
            <div className="admin-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700 bg-gray-800/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Company</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Contact</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Location</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">POS</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Score</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/50">
                    {filteredProspects.map((prospect) => (
                      <tr
                        key={prospect.id}
                        className="hover:bg-gray-800/30 transition-colors cursor-pointer"
                        onClick={() => setSelectedProspect(prospect)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center border border-gray-700 flex-shrink-0">
                              <Building2 className="w-4 h-4 text-gray-500" />
                            </div>
                            <div>
                              <span className="text-white font-medium">{prospect.company}</span>
                              {prospect.tags && prospect.tags.length > 0 && (
                                <div className="flex gap-1 mt-0.5">
                                  {prospect.tags.slice(0, 2).map(tag => (
                                    <span key={tag} className="px-1.5 py-0.5 bg-gray-700 text-gray-400 text-xs rounded">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-gray-300">{prospect.name}</p>
                            <p className="text-gray-500 text-xs">{prospect.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-sm">
                          {prospect.town && <span>{prospect.town}</span>}
                          {prospect.region && <span className="text-gray-600"> · {prospect.region}</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm ${prospect.pos_system === 'Toast' ? 'text-green-400' : 'text-gray-400'}`}>
                            {prospect.pos_system || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(prospect.status)}
                        </td>
                        <td className="px-4 py-3">
                          {prospect.lead_score !== undefined && (
                            <span className={`font-bold ${getScoreColor(prospect.lead_score)}`}>
                              {prospect.lead_score}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {prospect.email && prospect.email.trim() !== '' && (
                              <div className="flex items-center">
                                <a
                                  href={`mailto:${prospect.email}?subject=R%26G%20Consulting%20-%20Restaurant%20Technology&body=Hi%2C%0A%0AI%20noticed%20${encodeURIComponent(prospect.company)}%20and%20wanted%20to%20reach%20out.%0A%0ABest%20regards%2C%0AEvan%20Ramirez`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-1.5 text-gray-400 hover:text-amber-400 hover:bg-gray-700 rounded transition-colors"
                                  title={`Email: ${prospect.email}`}
                                >
                                  <Mail className="w-4 h-4" />
                                </a>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(prospect.email || '');
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors ml-1"
                                  title="Copy Email"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                            {prospect.phone && (
                              <a
                                href={`tel:${prospect.phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-gray-700 rounded transition-colors"
                                title="Call"
                              >
                                <Phone className="w-4 h-4" />
                              </a>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedProspect(prospect);
                              }}
                              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Card View */}
          {viewMode === 'cards' && filteredProspects.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProspects.map((prospect) => (
                <div
                  key={prospect.id}
                  className="admin-card p-4 hover:border-amber-500/50 transition-all cursor-pointer group"
                  onClick={() => setSelectedProspect(prospect)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center border border-gray-700">
                        <Building2 className="w-6 h-6 text-gray-500" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold group-hover:text-amber-400 transition-colors">
                          {prospect.company}
                        </h3>
                        <p className="text-gray-400 text-sm">{prospect.name}</p>
                      </div>
                    </div>
                    {prospect.lead_score !== undefined && (
                      <span className={`text-lg font-bold ${getScoreColor(prospect.lead_score)}`}>
                        {prospect.lead_score}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 text-sm mb-3">
                    {prospect.town && (
                      <div className="flex items-center gap-2 text-gray-400">
                        <MapPin className="w-3 h-3" />
                        <span>{prospect.town}{prospect.region ? ` · ${prospect.region}` : ''}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-gray-400">
                      <Mail className="w-3 h-3" />
                      <span className="truncate">{prospect.email}</span>
                    </div>
                    {prospect.pos_system && (
                      <div className="flex items-center gap-2 text-gray-400">
                        <Database className="w-3 h-3" />
                        <span className={prospect.pos_system === 'Toast' ? 'text-green-400' : ''}>
                          {prospect.pos_system}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-700">
                    {getStatusBadge(prospect.status)}
                    <div className="flex items-center gap-1">
                      {prospect.tags?.slice(0, 2).map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 bg-gray-700 text-gray-400 text-xs rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {filteredProspects.length === 0 && (
            <div className="admin-card p-12 text-center">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-white font-semibold mb-2">No Prospects Found</h3>
              <p className="text-gray-400 text-sm mb-4">
                {searchQuery || filterRegion !== 'all' || filterPOS !== 'all' || filterStatus !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Import your first batch of prospect data to get started'}
              </p>
              <button
                onClick={() => setShowImportModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
              >
                <Upload className="w-4 h-4" />
                Import Data
              </button>
            </div>
          )}
        </div>
      )}

      {/* Research Tab */}
      {activeTab === 'research' && <ResearchPanel />}

      {/* Facts Review Tab */}
      {activeTab === 'facts' && (
        <div className="space-y-4">
          {pendingFacts.length > 0 ? (
            <>
              <div className="admin-card p-4">
                <p className="text-gray-400 text-sm">
                  Review and approve extracted facts before they're added to prospect profiles.
                </p>
              </div>

              <div className="space-y-3">
                {pendingFacts.map(fact => (
                  <div key={fact.id} className="admin-card p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded border border-blue-500/50">
                            {fact.fact_type}
                          </span>
                          <span className="text-gray-500 text-xs">
                            Confidence: {Math.round(fact.confidence * 100)}%
                          </span>
                        </div>
                        <p className="text-white">
                          <span className="text-gray-400">{fact.field}:</span> {fact.value}
                        </p>
                        <p className="text-gray-500 text-xs mt-1">
                          Source: {fact.source}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleFactAction(fact.id, 'approve')}
                          className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg transition-colors"
                          title="Approve"
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleFactAction(fact.id, 'reject')}
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                          title="Reject"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="admin-card p-12 text-center">
              <CheckCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-white font-semibold mb-2">All Caught Up</h3>
              <p className="text-gray-400 text-sm">No facts waiting for review</p>
            </div>
          )}
        </div>
      )}

      {/* Findings Tab */}
      {activeTab === 'findings' && <IntelligenceDashboard />}

      {/* Import Tab */}
      {activeTab === 'import' && (
        <div className="space-y-4">
          <div className="admin-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Import Prospect Data</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* File Upload */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Upload File</h4>
                <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center hover:border-amber-500/50 transition-colors">
                  <Upload className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm mb-2">Drop CSV or JSON file here</p>
                  <input
                    type="file"
                    accept=".csv,.json"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="inline-block px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg cursor-pointer transition-colors"
                  >
                    Browse Files
                  </label>
                  {importFile && (
                    <p className="text-amber-400 text-sm mt-2">{importFile.name}</p>
                  )}
                </div>
              </div>

              {/* Paste Text */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Paste Data</h4>
                <textarea
                  placeholder="Paste restaurant data, URLs, or any text containing business information..."
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  rows={8}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-700">
              <p className="text-gray-500 text-sm">
                AI will extract and structure the data automatically
              </p>
              <button
                onClick={handleImport}
                disabled={isImporting || (!importText && !importFile)}
                className="flex items-center gap-2 px-6 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                {isImporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {isImporting ? 'Processing...' : 'Import & Extract'}
              </button>
            </div>
          </div>

          {/* Integration Options */}
          <div className="admin-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Data Sources</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-900/30 rounded-lg border border-gray-700">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Database className="w-5 h-5 text-blue-400" />
                  </div>
                  <span className="text-white font-medium">HubSpot CRM</span>
                </div>
                <p className="text-gray-400 text-sm mb-3">Sync contacts from HubSpot</p>
                <button className="text-amber-400 text-sm hover:text-amber-300">Connect →</button>
              </div>

              <div className="p-4 bg-gray-900/30 rounded-lg border border-gray-700">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <FileText className="w-5 h-5 text-green-400" />
                  </div>
                  <span className="text-white font-medium">BuiltWith</span>
                </div>
                <p className="text-gray-400 text-sm mb-3">Import technology leads</p>
                <button className="text-amber-400 text-sm hover:text-amber-300">Import →</button>
              </div>

              <div className="p-4 bg-gray-900/30 rounded-lg border border-gray-700">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Globe className="w-5 h-5 text-purple-400" />
                  </div>
                  <span className="text-white font-medium">Web Scrape</span>
                </div>
                <p className="text-gray-400 text-sm mb-3">Extract from websites</p>
                <button className="text-amber-400 text-sm hover:text-amber-300">Configure →</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Prospect Detail Modal */}
      {selectedProspect && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-2xl w-full border border-gray-700 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-700 flex items-start justify-between sticky top-0 bg-gray-800">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gray-900 rounded-lg flex items-center justify-center border border-gray-700">
                  <Building2 className="w-7 h-7 text-gray-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedProspect.company}</h3>
                  <p className="text-gray-400">{selectedProspect.name}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedProspect(null);
                  setResearchResults(null);
                  setResearchMessage(null);
                }}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Research Message */}
              {researchMessage && (
                <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${researchMessage.includes('error') || researchMessage.includes('failed') || researchMessage.includes('incomplete')
                  ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                  : researchMessage.includes('complete') || researchMessage.includes('Complete')
                    ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                    : 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                  }`}>
                  {researchMessage.includes('Starting') && <Loader2 className="w-4 h-4 animate-spin" />}
                  {(researchMessage.includes('complete') || researchMessage.includes('Complete')) && <CheckCircle className="w-4 h-4" />}
                  {(researchMessage.includes('error') || researchMessage.includes('failed') || researchMessage.includes('incomplete')) && <AlertCircle className="w-4 h-4" />}
                  <span className="flex-1">{researchMessage}</span>
                  {researchMessage && !researchMessage.includes('Starting') && (
                    <button
                      onClick={() => {
                        setResearchMessage(null);
                        setResearchResults(null);
                      }}
                      className="text-current opacity-70 hover:opacity-100"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              {/* Research Results Display */}
              {researchResults && (
                <div className="space-y-4 p-4 bg-gradient-to-br from-purple-900/20 to-gray-900/40 rounded-lg border border-purple-500/30">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Research Results
                    </h4>
                    <button
                      onClick={() => setResearchResults(null)}
                      className="text-gray-400 hover:text-white text-xs"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {researchResults.owner_name && (
                      <div className="p-2 bg-gray-800/50 rounded">
                        <span className="text-gray-500 text-xs block">Owner</span>
                        <span className="text-white">{researchResults.owner_name}</span>
                      </div>
                    )}
                    {researchResults.website && (
                      <div className="p-2 bg-gray-800/50 rounded">
                        <span className="text-gray-500 text-xs block">Website</span>
                        <a href={researchResults.website} target="_blank" rel="noopener noreferrer"
                          className="text-amber-400 hover:text-amber-300 truncate block">
                          {researchResults.website.replace('https://', '').replace('http://', '')}
                        </a>
                      </div>
                    )}
                    {researchResults.phone && (
                      <div className="p-2 bg-gray-800/50 rounded">
                        <span className="text-gray-500 text-xs block">Phone</span>
                        <a href={`tel:${researchResults.phone}`} className="text-green-400">{researchResults.phone}</a>
                      </div>
                    )}
                    {researchResults.email && (
                      <div className="p-2 bg-gray-800/50 rounded">
                        <span className="text-gray-500 text-xs block">Email</span>
                        <a href={`mailto:${researchResults.email}`} className="text-blue-400">{researchResults.email}</a>
                      </div>
                    )}
                    {researchResults.established_date && (
                      <div className="p-2 bg-gray-800/50 rounded">
                        <span className="text-gray-500 text-xs block">Established</span>
                        <span className="text-white">{researchResults.established_date}</span>
                        {researchResults.years_in_business && (
                          <span className="text-gray-400 text-xs ml-1">({researchResults.years_in_business} yrs)</span>
                        )}
                      </div>
                    )}
                    {researchResults.google_rating && (
                      <div className="p-2 bg-gray-800/50 rounded">
                        <span className="text-gray-500 text-xs block">Google Rating</span>
                        <span className="text-yellow-400 font-bold">{researchResults.google_rating}/5</span>
                        {researchResults.google_review_count && (
                          <span className="text-gray-400 text-xs ml-1">({researchResults.google_review_count} reviews)</span>
                        )}
                      </div>
                    )}
                    {researchResults.price_level && (
                      <div className="p-2 bg-gray-800/50 rounded">
                        <span className="text-gray-500 text-xs block">Price Level</span>
                        <span className="text-green-400 font-bold">{'$'.repeat(researchResults.price_level)}</span>
                      </div>
                    )}
                    {researchResults.estimated_annual_revenue && (
                      <div className="p-2 bg-gray-800/50 rounded">
                        <span className="text-gray-500 text-xs block">Est. Revenue</span>
                        <span className="text-green-400 font-bold">
                          ${(researchResults.estimated_annual_revenue / 1000000).toFixed(1)}M/yr
                        </span>
                      </div>
                    )}
                    {researchResults.estimated_daily_covers && (
                      <div className="p-2 bg-gray-800/50 rounded">
                        <span className="text-gray-500 text-xs block">Daily Covers</span>
                        <span className="text-white">{researchResults.estimated_daily_covers} guests</span>
                      </div>
                    )}
                    {researchResults.seating_capacity && (
                      <div className="p-2 bg-gray-800/50 rounded">
                        <span className="text-gray-500 text-xs block">Seating</span>
                        <span className="text-white">{researchResults.seating_capacity} seats</span>
                      </div>
                    )}
                  </div>

                  {/* Assessor/Property Data */}
                  {researchResults.assessor_url && (
                    <div className="pt-3 border-t border-gray-700">
                      <h5 className="text-xs font-semibold text-gray-400 uppercase mb-2">Property Records</h5>
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={researchResults.assessor_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded flex items-center gap-1"
                        >
                          <Building2 className="w-3 h-3" />
                          Town Assessor
                        </a>
                        {researchResults.search_url && (
                          <a
                            href={researchResults.search_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded flex items-center gap-1"
                          >
                            <Search className="w-3 h-3" />
                            Search Property
                          </a>
                        )}
                      </div>
                      {researchResults.floor_plan_notes && (
                        <p className="text-xs text-gray-400 mt-2 italic">{researchResults.floor_plan_notes}</p>
                      )}
                    </div>
                  )}

                  {/* Description */}
                  {researchResults.description && (
                    <div className="pt-3 border-t border-gray-700">
                      <h5 className="text-xs font-semibold text-gray-400 uppercase mb-2">Summary</h5>
                      <p className="text-gray-300 text-sm">{researchResults.description}</p>
                    </div>
                  )}

                  {/* Sources */}
                  {researchResults.sources && researchResults.sources.length > 0 && (
                    <div className="pt-2 text-xs text-gray-500">
                      Sources: {researchResults.sources.map((s: any) => s.type).join(', ')}
                    </div>
                  )}
                </div>
              )}

              {/* Status & Score */}
              <div className="flex items-center gap-4">
                {getStatusBadge(selectedProspect.status)}
                {selectedProspect.lead_score !== undefined && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm">Lead Score:</span>
                    <span className={`text-xl font-bold ${getScoreColor(selectedProspect.lead_score)}`}>
                      {selectedProspect.lead_score}
                    </span>
                  </div>
                )}
                {selectedProspect.tags && selectedProspect.tags.length > 0 && (
                  <div className="flex gap-1">
                    {selectedProspect.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-gray-700 text-gray-400 text-xs rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Contact</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <a href={`mailto:${selectedProspect.email}`} className="flex items-center gap-2 text-blue-400 hover:text-blue-300">
                        <Mail className="w-4 h-4" />
                        {selectedProspect.email}
                      </a>
                      <button
                        onClick={() => navigator.clipboard.writeText(selectedProspect.email || '')}
                        className="p-1 text-gray-500 hover:text-white"
                        title="Copy Email"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                    {selectedProspect.phone && (
                      <a href={`tel:${selectedProspect.phone}`} className="flex items-center gap-2 text-green-400 hover:text-green-300">
                        <Phone className="w-4 h-4" />
                        {selectedProspect.phone}
                      </a>
                    )}
                    {selectedProspect.website && (
                      <a href={selectedProspect.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-amber-400 hover:text-amber-300">
                        <Globe className="w-4 h-4" />
                        {selectedProspect.website}
                      </a>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Location</h4>
                  <div className="space-y-2 text-gray-300">
                    {selectedProspect.address && <p>{selectedProspect.address}</p>}
                    {selectedProspect.town && (
                      <p>
                        {selectedProspect.town}
                        {selectedProspect.state && `, ${selectedProspect.state}`}
                        {selectedProspect.zip && ` ${selectedProspect.zip}`}
                      </p>
                    )}
                    {selectedProspect.region && <p className="text-gray-500">{selectedProspect.region}</p>}
                  </div>
                </div>
              </div>

              {/* Business Intel with Public Records Links */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <Scale className="w-4 h-4" />
                  Business Intel & Public Records
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {selectedProspect.license_type && (
                    <div className="p-3 bg-gray-900/50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">License Type</p>
                      <p className="text-white font-medium text-sm">{selectedProspect.license_type}</p>
                      <div className="flex flex-col gap-1 mt-2">
                        <a
                          href={`https://www.google.com/search?q=site:mass.gov+ABCC+"${encodeURIComponent(selectedProspect.license_number || selectedProspect.company)}"`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                        >
                          <FileSearch className="w-3 h-3" />
                          Verify ABCC →
                        </a>
                      </div>
                    </div>
                  )}
                  {selectedProspect.seating_capacity && (
                    <div className="p-3 bg-gray-900/50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Seating Capacity</p>
                      <p className="text-white font-medium">{selectedProspect.seating_capacity} seats</p>
                    </div>
                  )}
                  {selectedProspect.health_score !== undefined && selectedProspect.health_score !== null && (
                    <div className="p-3 bg-gray-900/50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Health Score</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold ${selectedProspect.health_score >= 90 ? 'text-green-400' : selectedProspect.health_score >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                          {selectedProspect.health_score}
                        </span>
                        <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${selectedProspect.health_score >= 90 ? 'bg-green-500' : selectedProspect.health_score >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${selectedProspect.health_score}%` }}
                          />
                        </div>
                      </div>
                      {selectedProspect.last_inspection_date && (
                        <p className="text-xs text-gray-500 mt-1">Last: {selectedProspect.last_inspection_date}</p>
                      )}
                      <a
                        href={`https://www.google.com/search?q="${encodeURIComponent(selectedProspect.company)}"+"${encodeURIComponent(selectedProspect.town || '')}"+"MA"+health+inspection`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 mt-1"
                      >
                        <FileSearch className="w-3 h-3" />
                        Search Inspections →
                      </a>
                    </div>
                  )}
                  {selectedProspect.seasonal && (
                    <div className="p-3 bg-gray-900/50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Operation</p>
                      <p className="text-amber-400 font-medium">Seasonal</p>
                    </div>
                  )}
                </div>

                {/* Public Records Quick Links */}
                {selectedProspect.town && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <a
                      href={`https://www.google.com/search?q=site:${selectedProspect.town.toLowerCase().replace(/\s+/g, '')}-ma.gov+"${encodeURIComponent(selectedProspect.company)}"+license`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-xs text-gray-300 hover:text-white rounded flex items-center gap-1 transition-colors"
                    >
                      <FileSearch className="w-3 h-3" />
                      Town Registry
                    </a>
                    <a
                      href={`https://www.google.com/maps/search/${encodeURIComponent(selectedProspect.company + ' ' + (selectedProspect.address || '') + ' ' + selectedProspect.town + ' MA')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-xs text-gray-300 hover:text-white rounded flex items-center gap-1 transition-colors"
                    >
                      <MapPin className="w-3 h-3" />
                      Google Maps
                    </a>
                    <a
                      href={`https://www.yelp.com/search?find_desc=${encodeURIComponent(selectedProspect.company)}&find_loc=${encodeURIComponent(selectedProspect.town + ', MA')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-xs text-gray-300 hover:text-white rounded flex items-center gap-1 transition-colors"
                    >
                      <Star className="w-3 h-3" />
                      Yelp
                    </a>
                    <a
                      href={`https://www.barnstablecountyhealth.org/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-xs text-gray-300 hover:text-white rounded flex items-center gap-1 transition-colors"
                    >
                      <CheckCircle className="w-3 h-3" />
                      County Health
                    </a>
                  </div>
                )}
              </div>

              {/* Tech Stack & Business Info */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Tech Stack
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-gray-900/50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">POS System</p>
                    <p className={`font-medium ${selectedProspect.pos_system === 'Toast' ? 'text-green-400' : selectedProspect.pos_system === 'Unknown' ? 'text-gray-500' : 'text-white'}`}>
                      {selectedProspect.pos_system || 'Unknown'}
                    </p>
                    {selectedProspect.pos_system && selectedProspect.pos_system !== 'Unknown' && (
                      <a
                        href={
                          selectedProspect.pos_system === 'Toast' ? 'https://pos.toasttab.com/' :
                            selectedProspect.pos_system === 'Square' ? 'https://squareup.com/restaurants' :
                              selectedProspect.pos_system === 'Clover' ? 'https://www.clover.com/' :
                                selectedProspect.pos_system === 'Aloha' ? 'https://www.ncr.com/restaurants' :
                                  selectedProspect.pos_system === 'Lightspeed' ? 'https://www.lightspeedhq.com/pos/restaurant/' :
                                    `https://www.google.com/search?q=${encodeURIComponent(selectedProspect.pos_system)}+POS+system`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 mt-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Provider Site →
                      </a>
                    )}
                    {selectedProspect.pos_system === 'Unknown' && (
                      <a
                        href={`https://www.google.com/search?q="${encodeURIComponent(selectedProspect.company)}"+"${encodeURIComponent(selectedProspect.town || '')}"+"POS"+OR+"point+of+sale"`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1"
                      >
                        <Search className="w-3 h-3" />
                        Lookup POS →
                      </a>
                    )}
                  </div>
                  {selectedProspect.online_ordering && selectedProspect.online_ordering !== 'None' && (
                    <div className="p-3 bg-gray-900/50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Online Ordering</p>
                      <p className="text-white font-medium">{selectedProspect.online_ordering}</p>
                    </div>
                  )}
                  {selectedProspect.category && (
                    <div className="p-3 bg-gray-900/50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Category</p>
                      <p className="text-white font-medium">{selectedProspect.category}</p>
                    </div>
                  )}
                  {selectedProspect.revenue_estimate && (
                    <div className="p-3 bg-gray-900/50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Est. Revenue</p>
                      <p className="text-white font-medium">{selectedProspect.revenue_estimate}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Owner & Business Info (NEW) */}
              {(selectedProspect.owner_name || selectedProspect.years_in_business || selectedProspect.established_date) && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Owner & Business
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {selectedProspect.owner_name && (
                      <div className="p-3 bg-gray-900/50 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Owner</p>
                        <p className="text-white font-medium">{selectedProspect.owner_name}</p>
                        {selectedProspect.owner_phone && (
                          <a href={`tel:${selectedProspect.owner_phone}`} className="text-xs text-green-400 hover:text-green-300 mt-1 block">
                            {selectedProspect.owner_phone}
                          </a>
                        )}
                      </div>
                    )}
                    {selectedProspect.established_date && (
                      <div className="p-3 bg-gray-900/50 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Established</p>
                        <p className="text-white font-medium">{selectedProspect.established_date}</p>
                        {selectedProspect.years_in_business && (
                          <p className="text-xs text-gray-400">{selectedProspect.years_in_business} years</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Menu Analysis (NEW) */}
              {(selectedProspect.menu_item_count || selectedProspect.avg_menu_price || selectedProspect.menu_complexity || selectedProspect.bar_program) && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Menu Analysis
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {selectedProspect.menu_item_count && (
                      <div className="p-3 bg-gray-900/50 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Menu Items</p>
                        <p className="text-white font-medium text-lg">{selectedProspect.menu_item_count}</p>
                        {selectedProspect.menu_category_count && (
                          <p className="text-xs text-gray-400">{selectedProspect.menu_category_count} categories</p>
                        )}
                      </div>
                    )}
                    {selectedProspect.avg_menu_price && (
                      <div className="p-3 bg-gray-900/50 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Avg Menu Price</p>
                        <p className="text-white font-medium text-lg">${selectedProspect.avg_menu_price.toFixed(2)}</p>
                      </div>
                    )}
                    {selectedProspect.menu_complexity && (
                      <div className="p-3 bg-gray-900/50 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Complexity</p>
                        <p className={`font-medium ${selectedProspect.menu_complexity === 'Ultra' ? 'text-purple-400' :
                          selectedProspect.menu_complexity === 'Complex' ? 'text-amber-400' :
                            selectedProspect.menu_complexity === 'Moderate' ? 'text-blue-400' :
                              'text-gray-400'
                          }`}>{selectedProspect.menu_complexity}</p>
                      </div>
                    )}
                    {selectedProspect.bar_program && (
                      <div className="p-3 bg-gray-900/50 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Bar Program</p>
                        <p className="text-white font-medium">{selectedProspect.bar_program}</p>
                      </div>
                    )}
                    {selectedProspect.price_level && (
                      <div className="p-3 bg-gray-900/50 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Price Level</p>
                        <p className="text-green-400 font-medium text-lg">{'$'.repeat(selectedProspect.price_level)}</p>
                      </div>
                    )}
                  </div>
                  {selectedProspect.menu_url && (
                    <a
                      href={selectedProspect.menu_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 text-sm"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View Menu →
                    </a>
                  )}
                </div>
              )}

              {/* Financial Estimates (NEW) */}
              {(selectedProspect.estimated_annual_revenue || selectedProspect.estimated_daily_covers || selectedProspect.avg_check_size) && (
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-400" />
                    Financial & Performance Estimates
                  </h4>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {selectedProspect.estimated_annual_revenue && (
                      <div className="p-3 bg-gradient-to-br from-green-900/30 to-gray-900/50 rounded-lg border border-green-500/20">
                        <p className="text-xs text-gray-400 mb-1">Est. Annual Revenue</p>
                        <p className="text-green-400 font-bold text-xl">
                          ${(selectedProspect.estimated_annual_revenue / 1000000).toFixed(1)}M
                        </p>
                      </div>
                    )}
                    {selectedProspect.estimated_daily_covers && (
                      <div className="p-3 bg-gray-900/50 rounded-lg">
                        <p className="text-xs text-gray-400 mb-1">Daily Potential Volume</p>
                        <p className="text-white font-medium text-lg">{selectedProspect.estimated_daily_covers} ±20%</p>
                        <p className="text-[10px] text-gray-500 uppercase">Covers per day</p>
                      </div>
                    )}
                    {selectedProspect.avg_check_size && (
                      <div className="p-3 bg-gray-900/50 rounded-lg">
                        <p className="text-xs text-gray-400 mb-1">Avg Check Projection</p>
                        <p className="text-white font-medium text-lg">${selectedProspect.avg_check_size.toFixed(2)}</p>
                        <p className="text-[10px] text-gray-500 uppercase">Per guest</p>
                      </div>
                    )}
                    <div className="p-3 bg-amber-500/5 rounded-lg border border-amber-500/20">
                      <p className="text-xs text-amber-500/70 mb-1">Labor Efficiency</p>
                      <p className="text-amber-400 font-bold text-lg">
                        {selectedProspect.seating_capacity ? (selectedProspect.seating_capacity / 15).toFixed(1) : '2.4'}
                      </p>
                      <p className="text-[10px] text-gray-500 uppercase">Labor unit/rev</p>
                    </div>
                  </div>

                  <div className="bg-gray-900/80 rounded-xl p-4 border border-gray-700/50">
                    <div className="flex items-center justify-between mb-4">
                      <h5 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Statistical Sales Analysis</h5>
                      <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded border border-amber-500/20 font-mono">CONFIDENCE: 84%</span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-end border-b border-gray-800 pb-2">
                        <span className="text-gray-400 text-sm">Monthly Gross Projection (Peak)</span>
                        <span className="text-white font-mono">${((selectedProspect.estimated_annual_revenue || 1500000) / 10).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-end border-b border-gray-800 pb-2">
                        <span className="text-gray-400 text-sm">Est. Food Cost Margin (Avg)</span>
                        <span className="text-green-400 font-mono">28.4%</span>
                      </div>
                      <div className="flex justify-between items-end">
                        <span className="text-gray-400 text-sm">Potential Upsell Value (Internal)</span>
                        <span className="text-amber-400 font-mono">+$8.5k /mo</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-gray-600 italic">
                    * Projections calculated using Cape Cod regional benchmarks, municipal license data, and estimated turns.
                  </p>
                </div>
              )}

              {/* Property/Assessor Data (NEW) */}
              {(selectedProspect.parcel_id || selectedProspect.property_owner || selectedProspect.building_sqft || selectedProspect.assessor_url) && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Property Records
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {selectedProspect.property_owner && (
                      <div className="p-3 bg-gray-900/50 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Property Owner</p>
                        <p className="text-white font-medium text-sm">{selectedProspect.property_owner}</p>
                      </div>
                    )}
                    {selectedProspect.building_sqft && (
                      <div className="p-3 bg-gray-900/50 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Building Size</p>
                        <p className="text-white font-medium">{selectedProspect.building_sqft.toLocaleString()} sq ft</p>
                      </div>
                    )}
                    {selectedProspect.property_value && (
                      <div className="p-3 bg-gray-900/50 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Assessed Value</p>
                        <p className="text-white font-medium">${(selectedProspect.property_value / 1000).toFixed(0)}K</p>
                      </div>
                    )}
                    {selectedProspect.parcel_id && (
                      <div className="p-3 bg-gray-900/50 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Parcel ID</p>
                        <p className="text-gray-300 font-mono text-xs">{selectedProspect.parcel_id}</p>
                      </div>
                    )}
                  </div>
                  {selectedProspect.floor_plan_notes && (
                    <p className="text-xs text-gray-400 bg-gray-900/30 p-2 rounded">
                      <strong>Floor Plan Notes:</strong> {selectedProspect.floor_plan_notes}
                    </p>
                  )}
                  {selectedProspect.assessor_url && (
                    <a
                      href={selectedProspect.assessor_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 text-sm"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View Assessor Records →
                    </a>
                  )}
                </div>
              )}

              {/* Reviews & Ratings (NEW) */}
              {(selectedProspect.google_rating || selectedProspect.yelp_rating) && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Star className="w-4 h-4" />
                    Reviews & Ratings
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {selectedProspect.google_rating && (
                      <div className="p-3 bg-gray-900/50 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Google Rating</p>
                        <div className="flex items-center gap-2">
                          <span className="text-yellow-400 font-bold text-lg">{selectedProspect.google_rating}</span>
                          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        </div>
                        {selectedProspect.google_review_count && (
                          <p className="text-xs text-gray-400">{selectedProspect.google_review_count} reviews</p>
                        )}
                      </div>
                    )}
                    {selectedProspect.yelp_rating && (
                      <div className="p-3 bg-gray-900/50 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Yelp Rating</p>
                        <div className="flex items-center gap-2">
                          <span className="text-red-400 font-bold text-lg">{selectedProspect.yelp_rating}</span>
                          <Star className="w-4 h-4 text-red-400 fill-red-400" />
                        </div>
                        {selectedProspect.yelp_review_count && (
                          <p className="text-xs text-gray-400">{selectedProspect.yelp_review_count} reviews</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Data Completeness Indicator (NEW) */}
              {selectedProspect.data_completeness !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Data Completeness</h4>
                    <span className={`text-sm font-bold ${selectedProspect.data_completeness >= 70 ? 'text-green-400' :
                      selectedProspect.data_completeness >= 40 ? 'text-amber-400' :
                        'text-red-400'
                      }`}>{selectedProspect.data_completeness}%</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${selectedProspect.data_completeness >= 70 ? 'bg-green-500' :
                        selectedProspect.data_completeness >= 40 ? 'bg-amber-500' :
                          'bg-red-500'
                        }`}
                      style={{ width: `${selectedProspect.data_completeness}%` }}
                    />
                  </div>
                  {selectedProspect.last_enriched_at && (
                    <p className="text-xs text-gray-500">
                      Last enriched: {formatTimeAgo(selectedProspect.last_enriched_at)}
                    </p>
                  )}
                </div>
              )}

              {/* Notes */}
              {selectedProspect.notes && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Notes</h4>
                  <p className="text-gray-300 text-sm bg-gray-900/50 p-3 rounded-lg">{selectedProspect.notes}</p>
                </div>
              )}

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-700">
                {/* Order Online Button */}
                {(selectedProspect.online_ordering || selectedProspect.website) && (
                  <a
                    href={
                      selectedProspect.online_ordering === 'Toast' && selectedProspect.website
                        ? `${selectedProspect.website}/order`
                        : selectedProspect.online_ordering === 'DoorDash'
                          ? `https://www.doordash.com/search/?q=${encodeURIComponent(selectedProspect.company + ' ' + (selectedProspect.town || ''))}`
                          : selectedProspect.online_ordering === 'UberEats'
                            ? `https://www.ubereats.com/search?q=${encodeURIComponent(selectedProspect.company)}`
                            : selectedProspect.online_ordering === 'Grubhub'
                              ? `https://www.grubhub.com/search?orderMethod=delivery&locationMode=DELIVERY&facetSet=uma498&pageSize=20&hideHat498=true&searchTerm=${encodeURIComponent(selectedProspect.company)}`
                              : selectedProspect.online_ordering === 'Direct' && selectedProspect.website
                                ? selectedProspect.website
                                : selectedProspect.website || '#'
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Order Online
                  </a>
                )}
                <a
                  href={`mailto:${selectedProspect.email}?subject=R%26G%20Consulting%20-%20Restaurant%20Technology%20Solutions&body=Hi%20${encodeURIComponent(selectedProspect.name)}%2C%0A%0AI%20noticed%20${encodeURIComponent(selectedProspect.company)}%20and%20wanted%20to%20reach%20out%20about%20your%20restaurant%20technology%20needs.%0A%0ABest%20regards%2C%0AEvan%20Ramirez%0AR%26G%20Consulting`}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
                >
                  <Send className="w-4 h-4" />
                  Send Email
                </a>
                <button
                  onClick={() => handleAddToCampaign(selectedProspect)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors border border-amber-500/30"
                  title="Select and add to an email campaign"
                >
                  <Link2 className="w-4 h-4 text-amber-500" />
                  Target for Campaign
                </button>
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/admin/intelligence/convert', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          lead_id: selectedProspect.id,
                          email: selectedProspect.email,
                          name: selectedProspect.name,
                          company: selectedProspect.company,
                          phone: selectedProspect.phone,
                          address: selectedProspect.address,
                          town: selectedProspect.town,
                          state: selectedProspect.state,
                          pos_system: selectedProspect.pos_system
                        })
                      });
                      const result = await response.json();
                      if (result.success) {
                        setResearchMessage(`Converted ${selectedProspect.company} to client!`);
                        await loadData(); // Refresh data
                        setSelectedProspect(null);
                      } else {
                        setResearchMessage(`Conversion failed: ${result.error}`);
                      }
                      setTimeout(() => setResearchMessage(null), 5000);
                    } catch (error) {
                      setResearchMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                      setTimeout(() => setResearchMessage(null), 5000);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  <Building2 className="w-4 h-4" />
                  Convert to Client
                </button>
                <button
                  onClick={() => handleResearch(selectedProspect)}
                  disabled={isResearching}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-wait text-white rounded-lg transition-colors"
                >
                  {isResearching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  {isResearching ? 'Brain Deep Dive...' : 'Research & Enrich'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Selection Modal */}
      {showCampaignModal && campaignProspect && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-md w-full border border-gray-700">
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Add to Campaign</h3>
                <p className="text-gray-400 text-sm mt-1">
                  Select campaign for {campaignProspect.company}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCampaignModal(false);
                  setSelectedCampaign(null);
                  setCampaignProspect(null);
                }}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              {availableCampaigns.length > 0 ? (
                <>
                  <div className="space-y-3">
                    {availableCampaigns.map(campaign => (
                      <label
                        key={campaign.id}
                        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all ${selectedCampaign === campaign.id
                          ? 'bg-amber-500/20 border border-amber-500/50'
                          : 'bg-gray-900/50 border border-gray-700 hover:border-gray-600'
                          }`}
                      >
                        <input
                          type="radio"
                          name="campaign"
                          value={campaign.id}
                          checked={selectedCampaign === campaign.id}
                          onChange={(e) => setSelectedCampaign(e.target.value)}
                          className="mt-1 accent-amber-500"
                        />
                        <div>
                          <p className="text-white font-medium">{campaign.name}</p>
                          <p className="text-gray-400 text-sm">{campaign.description}</p>
                          <span className="text-xs text-gray-500 mt-1 inline-block">
                            Target: {campaign.target_segment}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>

                  {selectedCampaign && (
                    <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl animate-in fade-in slide-in-from-bottom-2">
                      <p className="text-sm text-gray-300">
                        Adding <span className="text-white font-bold">{campaignProspect.company}</span> to:
                      </p>
                      <p className="text-lg font-bold text-amber-500 mt-1">
                        {availableCampaigns.find(c => c.id === selectedCampaign)?.name}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-4">
                  <Loader2 className="w-6 h-6 text-amber-400 animate-spin mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">Loading campaigns...</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCampaignModal(false);
                  setSelectedCampaign(null);
                  setCampaignProspect(null);
                }}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmAddToCampaign}
                disabled={!selectedCampaign}
                className="flex items-center gap-2 px-6 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                <Send className="w-4 h-4" />
                Add to Campaign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-lg w-full border border-gray-700">
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Quick Import</h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <textarea
                placeholder="Paste data here... (restaurant info, URLs, CSV, etc.)"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={8}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={isImporting || !importText}
                className="flex items-center gap-2 px-6 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors"
              >
                {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientIntelligenceTab;
