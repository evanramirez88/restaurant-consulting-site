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
  ChevronDown, ChevronUp, List, Grid3X3, Link2, Send, Sparkles
} from 'lucide-react';

// Types
interface IntelClient {
  id: string;
  name: string;
  company: string;
  email: string;
  phone?: string;
  website?: string;
  town?: string;
  region?: string;
  category?: string;
  pos_system?: string;
  revenue_estimate?: string;
  employee_count?: number;
  seasonal?: boolean;
  rating?: number;
  last_contact?: number;
  lead_score?: number;
  status: 'prospect' | 'lead' | 'client' | 'churned';
  tags?: string[];
  notes?: string;
  created_at: number;
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

type TabType = 'overview' | 'prospects' | 'research' | 'facts' | 'import';
type ViewMode = 'table' | 'cards';

const REGIONS = ['Cape Cod', 'South Shore', 'Boston', 'Islands', 'Other'];
const POS_SYSTEMS = ['Toast', 'Square', 'Clover', 'Aloha', 'Micros', 'Lightspeed', 'Unknown'];
const CATEGORIES = ['Casual Dining', 'Fine Dining', 'Fast Casual', 'Bar/Pub', 'Cafe', 'Seafood', 'Pizza', 'Other'];

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

  // Sync State
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load prospects/leads from intelligence API
      const [prospectsRes, factsRes, statsRes] = await Promise.all([
        fetch('/api/admin/intelligence/prospects').catch(() => ({ ok: false })),
        fetch('/api/admin/intelligence/facts?status=pending').catch(() => ({ ok: false })),
        fetch('/api/admin/intelligence/stats').catch(() => ({ ok: false }))
      ]);

      if (prospectsRes.ok) {
        const data = await (prospectsRes as Response).json();
        if (data.success) setProspects(data.data || []);
      }

      if (factsRes.ok) {
        const data = await (factsRes as Response).json();
        if (data.success) setPendingFacts(data.data || []);
      }

      if (statsRes.ok) {
        const data = await (statsRes as Response).json();
        if (data.success) setStats(data.data);
      }

      // If no data from API, use demo data
      if (prospects.length === 0) {
        setProspects(getDemoProspects());
        setStats(getDemoStats());
      }
    } catch (error) {
      console.error('Failed to load intelligence data:', error);
      // Use demo data on error
      setProspects(getDemoProspects());
      setStats(getDemoStats());
    } finally {
      setIsLoading(false);
    }
  };

  // Demo data for development
  const getDemoProspects = (): IntelClient[] => [
    { id: '1', name: 'John Smith', company: 'Cape Cod Seafood House', email: 'john@ccseafood.com', phone: '508-555-0101', town: 'Hyannis', region: 'Cape Cod', category: 'Seafood', pos_system: 'Toast', revenue_estimate: '$1M-2M', employee_count: 25, seasonal: true, rating: 4.5, lead_score: 85, status: 'lead', tags: ['hot-lead', 'menu-build'], created_at: Date.now() - 86400000 * 3 },
    { id: '2', name: 'Sarah Johnson', company: 'The Sandwich Spot', email: 'sarah@sandwichspot.com', phone: '508-555-0102', town: 'Sandwich', region: 'Cape Cod', category: 'Fast Casual', pos_system: 'Square', revenue_estimate: '$500K-1M', employee_count: 12, seasonal: false, rating: 4.2, lead_score: 72, status: 'prospect', tags: ['pos-switch'], created_at: Date.now() - 86400000 * 7 },
    { id: '3', name: 'Mike Davis', company: 'Provincetown Bistro', email: 'mike@ptownbistro.com', phone: '508-555-0103', town: 'Provincetown', region: 'Cape Cod', category: 'Fine Dining', pos_system: 'Aloha', revenue_estimate: '$2M-5M', employee_count: 40, seasonal: true, rating: 4.8, lead_score: 91, status: 'lead', tags: ['premium', 'networking'], created_at: Date.now() - 86400000 * 1 },
    { id: '4', name: 'Lisa Chen', company: 'Plymouth Pizza Co', email: 'lisa@plymouthpizza.com', phone: '508-555-0104', town: 'Plymouth', region: 'South Shore', category: 'Pizza', pos_system: 'Clover', revenue_estimate: '$500K-1M', employee_count: 15, seasonal: false, rating: 4.0, lead_score: 65, status: 'prospect', created_at: Date.now() - 86400000 * 14 },
    { id: '5', name: 'Tom Wilson', company: 'Chatham Oyster Bar', email: 'tom@chathamoyster.com', phone: '508-555-0105', town: 'Chatham', region: 'Cape Cod', category: 'Seafood', pos_system: 'Toast', revenue_estimate: '$1M-2M', employee_count: 20, seasonal: true, rating: 4.6, lead_score: 45, status: 'client', created_at: Date.now() - 86400000 * 30 },
  ];

  const getDemoStats = (): MarketStats => ({
    total_prospects: 156,
    total_leads: 42,
    total_clients: 12,
    avg_lead_score: 68,
    by_region: { 'Cape Cod': 89, 'South Shore': 34, 'Boston': 21, 'Islands': 12 },
    by_pos: { 'Toast': 45, 'Square': 38, 'Clover': 28, 'Aloha': 15, 'Unknown': 30 },
    by_category: { 'Casual Dining': 42, 'Seafood': 35, 'Fast Casual': 28, 'Fine Dining': 18, 'Bar/Pub': 15, 'Other': 18 }
  });

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
      const formData = new FormData();
      if (importFile) {
        formData.append('file', importFile);
      } else {
        formData.append('text', importText);
      }

      const response = await fetch('/api/admin/intelligence/import', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      if (result.success) {
        await loadData();
        setShowImportModal(false);
        setImportText('');
        setImportFile(null);
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
      await fetch(`/api/admin/intelligence/facts/${factId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action === 'approve' ? 'approved' : 'rejected' })
      });
      setPendingFacts(prev => prev.filter(f => f.id !== factId));
    } catch (error) {
      console.error('Fact action failed:', error);
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
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                : 'text-gray-400 hover:text-white hover:bg-gray-800 border border-transparent'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                activeTab === tab.id ? 'bg-amber-500/30' : 'bg-gray-700'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

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

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* By Region */}
            <div className="admin-card p-4">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                By Region
              </h3>
              <div className="space-y-3">
                {Object.entries(stats.by_region).map(([region, count]) => (
                  <div key={region}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-300">{region}</span>
                      <span className="text-white font-medium">{count}</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all"
                        style={{ width: `${(count / Math.max(...Object.values(stats.by_region))) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* By POS System */}
            <div className="admin-card p-4">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Database className="w-4 h-4" />
                By POS System
              </h3>
              <div className="space-y-3">
                {Object.entries(stats.by_pos).slice(0, 5).map(([pos, count]) => (
                  <div key={pos}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-300">{pos}</span>
                      <span className="text-white font-medium">{count}</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pos === 'Toast' ? 'bg-green-500' :
                          pos === 'Square' ? 'bg-blue-500' : 'bg-gray-500'
                        }`}
                        style={{ width: `${(count / Math.max(...Object.values(stats.by_pos))) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* By Category */}
            <div className="admin-card p-4">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Tag className="w-4 h-4" />
                By Category
              </h3>
              <div className="space-y-3">
                {Object.entries(stats.by_category).slice(0, 5).map(([cat, count]) => (
                  <div key={cat}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-300">{cat}</span>
                      <span className="text-white font-medium">{count}</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full transition-all"
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
                            <a
                              href={`mailto:${prospect.email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 text-gray-400 hover:text-amber-400 hover:bg-gray-700 rounded transition-colors"
                              title="Send Email"
                            >
                              <Mail className="w-4 h-4" />
                            </a>
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
      {activeTab === 'research' && (
        <div className="space-y-4">
          <div className="admin-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Sparkles className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">AI Research Assistant</h3>
                <p className="text-gray-400 text-sm">Research restaurants and extract business intelligence</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Research Target</label>
                <input
                  type="text"
                  placeholder="Enter restaurant name, URL, or business details..."
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['Website', 'Social Media', 'Reviews', 'Menu', 'Ownership', 'Tech Stack', 'Competitors', 'News'].map(type => (
                  <label key={type} className="flex items-center gap-2 p-3 bg-gray-900/50 rounded-lg border border-gray-700 cursor-pointer hover:border-amber-500/50 transition-colors">
                    <input type="checkbox" className="rounded bg-gray-800 border-gray-600 text-amber-500 focus:ring-amber-500" />
                    <span className="text-sm text-gray-300">{type}</span>
                  </label>
                ))}
              </div>

              <button className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
                <Search className="w-4 h-4" />
                Start Research
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="admin-card p-4 hover:border-amber-500/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-3 mb-2">
                <Globe className="w-5 h-5 text-blue-400" />
                <span className="text-white font-medium">Bulk Website Scan</span>
              </div>
              <p className="text-gray-400 text-sm">Scan multiple restaurant websites for contact info and tech stack</p>
            </div>

            <div className="admin-card p-4 hover:border-amber-500/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-3 mb-2">
                <Database className="w-5 h-5 text-green-400" />
                <span className="text-white font-medium">POS Detection</span>
              </div>
              <p className="text-gray-400 text-sm">Identify what POS system a restaurant is using</p>
            </div>

            <div className="admin-card p-4 hover:border-amber-500/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-5 h-5 text-purple-400" />
                <span className="text-white font-medium">Lead Scoring</span>
              </div>
              <p className="text-gray-400 text-sm">Re-score all prospects based on latest criteria</p>
            </div>
          </div>
        </div>
      )}

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
                onClick={() => setSelectedProspect(null)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
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
                    <a href={`mailto:${selectedProspect.email}`} className="flex items-center gap-2 text-blue-400 hover:text-blue-300">
                      <Mail className="w-4 h-4" />
                      {selectedProspect.email}
                    </a>
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
                    {selectedProspect.town && <p>{selectedProspect.town}</p>}
                    {selectedProspect.region && <p className="text-gray-500">{selectedProspect.region}</p>}
                  </div>
                </div>
              </div>

              {/* Business Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {selectedProspect.pos_system && (
                  <div className="p-3 bg-gray-900/50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">POS System</p>
                    <p className={`font-medium ${selectedProspect.pos_system === 'Toast' ? 'text-green-400' : 'text-white'}`}>
                      {selectedProspect.pos_system}
                    </p>
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
                {selectedProspect.employee_count && (
                  <div className="p-3 bg-gray-900/50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Employees</p>
                    <p className="text-white font-medium">{selectedProspect.employee_count}</p>
                  </div>
                )}
              </div>

              {/* Notes */}
              {selectedProspect.notes && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Notes</h4>
                  <p className="text-gray-300 text-sm bg-gray-900/50 p-3 rounded-lg">{selectedProspect.notes}</p>
                </div>
              )}

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-700">
                <button className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors">
                  <Send className="w-4 h-4" />
                  Send Email
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
                  <Link2 className="w-4 h-4" />
                  Add to Campaign
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
                  <Building2 className="w-4 h-4" />
                  Convert to Client
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
                  <Search className="w-4 h-4" />
                  Research
                </button>
              </div>
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
