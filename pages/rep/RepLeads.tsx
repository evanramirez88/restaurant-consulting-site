import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Loader2,
  Search,
  Target,
  Building2,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Clock,
  ChevronRight,
  ChevronDown,
  Filter,
  LayoutGrid,
  List,
  Plus,
  AlertTriangle,
  CheckCircle,
  XCircle,
  DollarSign,
  Monitor,
  ArrowRight,
  UserPlus,
  MessageSquare,
  MoreVertical
} from 'lucide-react';
import { useSEO } from '../../src/components/SEO';
import RepLayout from './RepLayout';

interface RepInfo {
  id: string;
  name: string;
  email: string;
  territory: string | null;
  avatar_url: string | null;
  slug: string;
}

interface Lead {
  id: string;
  restaurant_name: string;
  restaurant_address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  current_pos: string | null;
  lead_stage: string;
  estimated_value: number | null;
  notes: string | null;
  source_rep_id: string | null;
  converted_from_intel_id: string | null;
  created_at: number;
  updated_at: number;
  contact_name: string | null;
  contact_role: string | null;
}

type ViewMode = 'kanban' | 'list';

const LEAD_STAGES = [
  { id: 'new', label: 'New', color: 'bg-blue-500', textColor: 'text-blue-400', bgLight: 'bg-blue-500/10' },
  { id: 'contacted', label: 'Contacted', color: 'bg-purple-500', textColor: 'text-purple-400', bgLight: 'bg-purple-500/10' },
  { id: 'qualified', label: 'Qualified', color: 'bg-cyan-500', textColor: 'text-cyan-400', bgLight: 'bg-cyan-500/10' },
  { id: 'proposal', label: 'Proposal', color: 'bg-amber-500', textColor: 'text-amber-400', bgLight: 'bg-amber-500/10' },
  { id: 'negotiation', label: 'Negotiation', color: 'bg-orange-500', textColor: 'text-orange-400', bgLight: 'bg-orange-500/10' },
  { id: 'won', label: 'Won', color: 'bg-green-500', textColor: 'text-green-400', bgLight: 'bg-green-500/10' },
  { id: 'lost', label: 'Lost', color: 'bg-red-500', textColor: 'text-red-400', bgLight: 'bg-red-500/10' },
];

const RepLeads: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  useSEO({
    title: 'Lead Pipeline | Rep Portal | Cape Cod Restaurant Consulting',
    description: 'Manage your restaurant leads and pipeline.',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [rep, setRep] = useState<RepInfo | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isUpdatingStage, setIsUpdatingStage] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Check for demo mode
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
        const isDemoMode = urlParams.get('demo') === 'true' || hashParams.get('demo') === 'true' || slug?.startsWith('demo-');

        // Check if user is authenticated as admin
        let isAdmin = false;
        try {
          const adminResponse = await fetch('/api/auth/verify', { credentials: 'include' });
          const adminData = await adminResponse.json();
          isAdmin = adminData.authenticated === true;
        } catch {
          // Not an admin
        }

        // Only verify rep auth if not in demo mode and not admin
        if (!isDemoMode && !isAdmin) {
          const authRes = await fetch(`/api/rep/${slug}/auth/verify`);
          const authData = await authRes.json();

          if (!authData.authenticated) {
            navigate(`/rep/${slug}/login`);
            return;
          }
        }

        // Load rep info
        const repRes = await fetch(`/api/rep/${slug}/info`);
        const repData = await repRes.json();

        if (!repData.success) {
          setError('Failed to load rep information');
          setIsLoading(false);
          return;
        }

        setRep(repData.data);

        // Load leads
        const leadsRes = await fetch(`/api/rep/${slug}/leads`);
        const leadsData = await leadsRes.json();

        if (leadsData.success) {
          setLeads(leadsData.data || []);
          setFilteredLeads(leadsData.data || []);
        }
      } catch (err) {
        console.error('Load error:', err);
        setError('Failed to load leads');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [slug, navigate]);

  // Filter leads
  useEffect(() => {
    let result = [...leads];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (lead) =>
          lead.restaurant_name.toLowerCase().includes(query) ||
          (lead.city && lead.city.toLowerCase().includes(query)) ||
          (lead.current_pos && lead.current_pos.toLowerCase().includes(query)) ||
          (lead.contact_name && lead.contact_name.toLowerCase().includes(query))
      );
    }

    // Apply stage filter (for list view)
    if (stageFilter !== 'all') {
      result = result.filter((lead) => lead.lead_stage === stageFilter);
    }

    setFilteredLeads(result);
  }, [leads, searchQuery, stageFilter]);

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getDaysInStage = (lead: Lead) => {
    const now = Math.floor(Date.now() / 1000);
    const updated = lead.updated_at || lead.created_at;
    const days = Math.floor((now - updated) / 86400);
    return days;
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStageConfig = (stageId: string) => {
    return LEAD_STAGES.find(s => s.id === stageId) || LEAD_STAGES[0];
  };

  const handleAdvanceStage = async (lead: Lead) => {
    const currentIndex = LEAD_STAGES.findIndex(s => s.id === lead.lead_stage);
    if (currentIndex === -1 || currentIndex >= LEAD_STAGES.length - 2) return; // Can't advance won/lost

    const nextStage = LEAD_STAGES[currentIndex + 1].id;
    setIsUpdatingStage(lead.id);

    try {
      const response = await fetch(`/api/rep/${slug}/leads/${lead.id}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: nextStage })
      });

      const data = await response.json();
      if (data.success) {
        setLeads(prev => prev.map(l =>
          l.id === lead.id ? { ...l, lead_stage: nextStage, updated_at: Math.floor(Date.now() / 1000) } : l
        ));
      }
    } catch (err) {
      console.error('Failed to update stage:', err);
    } finally {
      setIsUpdatingStage(null);
    }
  };

  const handleSetStage = async (lead: Lead, newStage: string) => {
    setIsUpdatingStage(lead.id);

    try {
      const response = await fetch(`/api/rep/${slug}/leads/${lead.id}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage })
      });

      const data = await response.json();
      if (data.success) {
        setLeads(prev => prev.map(l =>
          l.id === lead.id ? { ...l, lead_stage: newStage, updated_at: Math.floor(Date.now() / 1000) } : l
        ));
      }
    } catch (err) {
      console.error('Failed to update stage:', err);
    } finally {
      setIsUpdatingStage(null);
    }
  };

  const handleConvertToClient = async () => {
    if (!selectedLead) return;
    setIsConverting(true);

    try {
      const response = await fetch(`/api/rep/${slug}/clients/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: selectedLead.id,
          name: selectedLead.contact_name || 'Owner',
          company: selectedLead.restaurant_name,
          email: selectedLead.email,
          phone: selectedLead.phone,
          city: selectedLead.city,
          state: selectedLead.state,
          address: selectedLead.restaurant_address
        })
      });

      const data = await response.json();
      if (data.success) {
        // Navigate to the new client
        navigate(`/rep/${slug}/clients/${data.data.id}`);
      } else {
        alert(data.error || 'Failed to create client');
      }
    } catch (err) {
      console.error('Failed to convert lead:', err);
      alert('Failed to create client');
    } finally {
      setIsConverting(false);
      setShowConvertModal(false);
    }
  };

  const getLeadsByStage = (stageId: string) => {
    return filteredLeads.filter(lead => lead.lead_stage === stageId);
  };

  const getStageStats = () => {
    return LEAD_STAGES.map(stage => ({
      ...stage,
      count: leads.filter(l => l.lead_stage === stage.id).length,
      value: leads
        .filter(l => l.lead_stage === stage.id)
        .reduce((sum, l) => sum + (l.estimated_value || 0), 0)
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-dark to-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-400 animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-dark to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Error</h2>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  const stageStats = getStageStats();

  return (
    <RepLayout rep={rep}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-display font-bold text-white">Lead Pipeline</h2>
            <p className="text-gray-400 mt-1">
              {filteredLeads.length} of {leads.length} leads shown
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-2.5 rounded-lg transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
              aria-label="Kanban view"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2.5 rounded-lg transition-colors ${
                viewMode === 'list'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
              aria-label="List view"
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Pipeline Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {stageStats.map((stage) => (
            <div
              key={stage.id}
              className={`admin-card p-3 cursor-pointer transition-all hover:border-gray-600 ${
                stageFilter === stage.id ? 'border-green-500/50' : ''
              }`}
              onClick={() => setStageFilter(stageFilter === stage.id ? 'all' : stage.id)}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                <span className="text-xs text-gray-400 truncate">{stage.label}</span>
              </div>
              <p className={`text-xl font-bold ${stage.textColor}`}>{stage.count}</p>
              {stage.value > 0 && (
                <p className="text-xs text-gray-500">{formatCurrency(stage.value)}</p>
              )}
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="admin-card p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder="Search by restaurant, city, or contact..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Stage Filter (List View Only) */}
            {viewMode === 'list' && (
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value)}
                  className="pl-10 pr-10 py-2.5 bg-gray-900/50 border border-gray-700 rounded-lg text-white appearance-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent cursor-pointer"
                >
                  <option value="all">All Stages</option>
                  {LEAD_STAGES.map((stage) => (
                    <option key={stage.id} value={stage.id}>{stage.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        {leads.length === 0 ? (
          <div className="admin-card p-12 text-center">
            <Target className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Leads Yet</h3>
            <p className="text-gray-400 mb-6">
              Convert intel submissions to leads or submit new intel to get started.
            </p>
          </div>
        ) : viewMode === 'kanban' ? (
          /* Kanban View */
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
              {LEAD_STAGES.filter(s => s.id !== 'lost').map((stage) => {
                const stageLeads = getLeadsByStage(stage.id);
                return (
                  <div
                    key={stage.id}
                    className="w-72 flex-shrink-0"
                  >
                    {/* Column Header */}
                    <div className={`${stage.bgLight} rounded-t-lg p-3 border-b-2 ${stage.color.replace('bg-', 'border-')}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                          <span className={`font-medium ${stage.textColor}`}>{stage.label}</span>
                        </div>
                        <span className="text-sm text-gray-400">{stageLeads.length}</span>
                      </div>
                    </div>

                    {/* Column Content */}
                    <div className="bg-gray-900/30 rounded-b-lg p-2 min-h-[400px] space-y-2">
                      {stageLeads.map((lead) => (
                        <LeadCard
                          key={lead.id}
                          lead={lead}
                          compact
                          onAdvance={() => handleAdvanceStage(lead)}
                          onConvert={() => {
                            setSelectedLead(lead);
                            setShowConvertModal(true);
                          }}
                          isUpdating={isUpdatingStage === lead.id}
                          formatCurrency={formatCurrency}
                          getDaysInStage={getDaysInStage}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Lost Column (collapsed) */}
              <div className="w-48 flex-shrink-0">
                <div className={`${LEAD_STAGES[6].bgLight} rounded-t-lg p-3 border-b-2 border-red-500`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-red-400" />
                      <span className="font-medium text-red-400">Lost</span>
                    </div>
                    <span className="text-sm text-gray-400">{getLeadsByStage('lost').length}</span>
                  </div>
                </div>
                <div className="bg-gray-900/30 rounded-b-lg p-2 min-h-[100px]">
                  {getLeadsByStage('lost').length > 0 && (
                    <p className="text-xs text-gray-500 text-center py-4">
                      {getLeadsByStage('lost').length} lost leads
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* List View */
          <div className="space-y-3">
            {filteredLeads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                compact={false}
                onAdvance={() => handleAdvanceStage(lead)}
                onConvert={() => {
                  setSelectedLead(lead);
                  setShowConvertModal(true);
                }}
                onSetStage={(stage) => handleSetStage(lead, stage)}
                isUpdating={isUpdatingStage === lead.id}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
                getDaysInStage={getDaysInStage}
              />
            ))}
          </div>
        )}
      </div>

      {/* Convert to Client Modal */}
      {showConvertModal && selectedLead && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="admin-card p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Convert to Client</h3>
                <p className="text-sm text-gray-400">Create a new client from this lead</p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h4 className="font-medium text-white mb-2">{selectedLead.restaurant_name}</h4>
                <div className="space-y-1 text-sm text-gray-400">
                  {selectedLead.contact_name && (
                    <p>Contact: {selectedLead.contact_name}</p>
                  )}
                  {selectedLead.email && (
                    <p>Email: {selectedLead.email}</p>
                  )}
                  {selectedLead.phone && (
                    <p>Phone: {selectedLead.phone}</p>
                  )}
                  {(selectedLead.city || selectedLead.state) && (
                    <p>Location: {[selectedLead.city, selectedLead.state].filter(Boolean).join(', ')}</p>
                  )}
                </div>
              </div>

              <p className="text-sm text-gray-400">
                This will create a new client record and assign you as the primary representative.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConvertModal(false)}
                className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                disabled={isConverting}
              >
                Cancel
              </button>
              <button
                onClick={handleConvertToClient}
                disabled={isConverting}
                className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isConverting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Create Client
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </RepLayout>
  );
};

// Lead Card Component
interface LeadCardProps {
  lead: Lead;
  compact: boolean;
  onAdvance: () => void;
  onConvert: () => void;
  onSetStage?: (stage: string) => void;
  isUpdating: boolean;
  formatCurrency: (amount: number | null) => string;
  formatDate?: (timestamp: number | null) => string;
  getDaysInStage: (lead: Lead) => number;
}

const LeadCard: React.FC<LeadCardProps> = ({
  lead,
  compact,
  onAdvance,
  onConvert,
  onSetStage,
  isUpdating,
  formatCurrency,
  formatDate,
  getDaysInStage
}) => {
  const [showActions, setShowActions] = useState(false);
  const stageConfig = LEAD_STAGES.find(s => s.id === lead.lead_stage) || LEAD_STAGES[0];
  const daysInStage = getDaysInStage(lead);
  const canAdvance = lead.lead_stage !== 'won' && lead.lead_stage !== 'lost';
  const canConvert = lead.lead_stage === 'won';

  if (compact) {
    return (
      <div className="admin-card p-3 hover:border-gray-600 transition-all group">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="text-sm font-medium text-white truncate flex-1">
            {lead.restaurant_name}
          </h4>
          {isUpdating && (
            <Loader2 className="w-4 h-4 text-green-400 animate-spin flex-shrink-0" />
          )}
        </div>

        {lead.city && (
          <p className="text-xs text-gray-500 flex items-center gap-1 mb-1">
            <MapPin className="w-3 h-3" />
            {lead.city}{lead.state ? `, ${lead.state}` : ''}
          </p>
        )}

        {lead.current_pos && (
          <p className="text-xs text-gray-500 flex items-center gap-1 mb-1">
            <Monitor className="w-3 h-3" />
            {lead.current_pos}
          </p>
        )}

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            {lead.estimated_value && (
              <span className="text-xs text-green-400 font-medium">
                {formatCurrency(lead.estimated_value)}
              </span>
            )}
            <span className="text-xs text-gray-500">
              {daysInStage}d
            </span>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {lead.phone && (
              <a
                href={`tel:${lead.phone}`}
                className="p-1 text-gray-500 hover:text-green-400 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Phone className="w-3.5 h-3.5" />
              </a>
            )}
            {lead.email && (
              <a
                href={`mailto:${lead.email}`}
                className="p-1 text-gray-500 hover:text-green-400 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Mail className="w-3.5 h-3.5" />
              </a>
            )}
            {canAdvance && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAdvance();
                }}
                disabled={isUpdating}
                className="p-1 text-gray-500 hover:text-green-400 transition-colors"
                title="Advance stage"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            {canConvert && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onConvert();
                }}
                className="p-1 text-green-400 hover:text-green-300 transition-colors"
                title="Convert to client"
              >
                <UserPlus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Full list view card
  return (
    <div className="admin-card p-5 hover:border-gray-600 transition-all">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Lead Info */}
        <div className="flex items-start gap-4 flex-1">
          <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
            <Building2 className="w-6 h-6 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h3 className="text-lg font-semibold text-white">
                {lead.restaurant_name}
              </h3>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${stageConfig.bgLight} ${stageConfig.textColor}`}>
                {stageConfig.label}
              </span>
            </div>
            {lead.contact_name && (
              <p className="text-gray-400 mb-2">{lead.contact_name}{lead.contact_role ? ` (${lead.contact_role})` : ''}</p>
            )}
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
              {lead.email && (
                <a
                  href={`mailto:${lead.email}`}
                  className="flex items-center gap-1 hover:text-green-400 transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  {lead.email}
                </a>
              )}
              {lead.phone && (
                <a
                  href={`tel:${lead.phone}`}
                  className="flex items-center gap-1 hover:text-green-400 transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  {lead.phone}
                </a>
              )}
              {(lead.city || lead.state) && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {[lead.city, lead.state].filter(Boolean).join(', ')}
                </span>
              )}
              {lead.current_pos && (
                <span className="flex items-center gap-1">
                  <Monitor className="w-4 h-4" />
                  {lead.current_pos}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats & Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 lg:gap-6">
          {lead.estimated_value && (
            <div className="text-sm">
              <p className="text-gray-500">Est. Value</p>
              <p className="text-green-400 font-medium">{formatCurrency(lead.estimated_value)}</p>
            </div>
          )}
          <div className="text-sm">
            <p className="text-gray-500">Days in Stage</p>
            <p className={`font-medium ${daysInStage > 14 ? 'text-amber-400' : 'text-white'}`}>
              {daysInStage} days
            </p>
          </div>
          {formatDate && (
            <div className="text-sm">
              <p className="text-gray-500">Created</p>
              <p className="text-white">{formatDate(lead.created_at)}</p>
            </div>
          )}

          <div className="flex items-center gap-2">
            {canAdvance && (
              <button
                onClick={onAdvance}
                disabled={isUpdating}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
              >
                {isUpdating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                Advance
              </button>
            )}
            {canConvert && (
              <button
                onClick={onConvert}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors text-sm font-medium"
              >
                <UserPlus className="w-4 h-4" />
                Convert to Client
              </button>
            )}

            {/* Stage dropdown for quick stage changes */}
            {onSetStage && (
              <div className="relative">
                <button
                  onClick={() => setShowActions(!showActions)}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
                {showActions && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowActions(false)}
                    />
                    <div className="absolute right-0 mt-2 w-40 bg-gray-800 rounded-lg shadow-xl border border-gray-700 py-1 z-20">
                      <p className="px-3 py-1 text-xs text-gray-500 uppercase">Move to</p>
                      {LEAD_STAGES.map((stage) => (
                        <button
                          key={stage.id}
                          onClick={() => {
                            onSetStage(stage.id);
                            setShowActions(false);
                          }}
                          disabled={stage.id === lead.lead_stage}
                          className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                            stage.id === lead.lead_stage
                              ? 'text-gray-500 cursor-not-allowed'
                              : 'text-gray-300 hover:bg-gray-700'
                          }`}
                        >
                          <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                          {stage.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RepLeads;
