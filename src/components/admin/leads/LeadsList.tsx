/**
 * LeadsList Component
 *
 * Displays and manages leads in the Admin Dashboard
 * Mobile-first design with filters, search, and quick actions
 */

import { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  ChevronRight,
  Phone,
  Mail,
  MapPin,
  Building2,
  TrendingUp,
  Users,
  RefreshCw,
  ExternalLink,
  MoreVertical,
  UserPlus,
  Send,
  X,
  Loader2,
  CheckCircle
} from 'lucide-react';

interface Lead {
  id: string;
  name: string;
  dba_name?: string;
  domain?: string;
  website_url?: string;
  primary_email?: string;
  primary_phone?: string;
  address_line1?: string;
  city?: string;
  state?: string;
  zip?: string;
  current_pos?: string;
  lead_score?: number;
  status: string;
  segment?: string;
  service_style?: string;
  cuisine_primary?: string;
  source?: string;
  tags?: string;
  notes?: string;
  hubspot_id?: string;
  converted_to_client_id?: string;
  created_at: number;
  updated_at: number;
}

interface Stats {
  total: number;
  prospects: number;
  contacted: number;
  qualified: number;
  clients: number;
  segment_a: number;
  segment_b: number;
  segment_c: number;
  segment_d: number;
}

interface PosCount {
  current_pos: string;
  count: number;
}

interface Sequence {
  id: string;
  name: string;
  description?: string;
  status: string;
}

export default function LeadsList() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [posCounts, setPosCounts] = useState<PosCount[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('');
  const [posFilter, setPosFilter] = useState('');
  const [minScore, setMinScore] = useState('');

  // Pagination
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 25;

  // Selected lead for detail view
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Sequence enrollment state
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollingLead, setEnrollingLead] = useState<Lead | null>(null);
  const [selectedSequence, setSelectedSequence] = useState<string>('');
  const [enrolling, setEnrolling] = useState(false);
  const [enrollResult, setEnrollResult] = useState<{ success: boolean; message: string } | null>(null);

  // Convert to client state
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [converting, setConverting] = useState(false);
  const [convertResult, setConvertResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchLeads = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('offset', String(offset));
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (segmentFilter) params.set('segment', segmentFilter);
      if (posFilter) params.set('pos', posFilter);
      if (minScore) params.set('minScore', minScore);

      const response = await fetch(`/api/admin/leads?${params.toString()}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch leads');
      }

      const data = await response.json();
      if (data.success) {
        setLeads(data.leads);
        setTotal(data.pagination.total);
        setStats(data.stats);
        setPosCounts(data.posCounts);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [offset, statusFilter, segmentFilter, posFilter, minScore]);

  // Fetch sequences on mount
  useEffect(() => {
    fetchSequences();
  }, []);

  const fetchSequences = async () => {
    try {
      const response = await fetch('/api/admin/email/sequences', {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success && data.data) {
        setSequences(data.data.filter((s: Sequence) => s.status === 'active'));
      }
    } catch (err) {
      console.error('Failed to fetch sequences:', err);
    }
  };

  // Handle sequence enrollment
  const handleEnrollInSequence = async () => {
    if (!enrollingLead || !selectedSequence || !enrollingLead.primary_email) return;

    setEnrolling(true);
    setEnrollResult(null);

    try {
      const response = await fetch(`/api/admin/email/sequences/${selectedSequence}/enroll`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'manual',
          emails: [enrollingLead.primary_email],
          schedule: 'immediate',
          exclude_enrolled: true
        })
      });

      const data = await response.json();
      if (data.success) {
        setEnrollResult({
          success: true,
          message: `Successfully enrolled in sequence (${data.data?.success_count || 1} subscriber)`
        });
        // Update lead status to contacted
        await fetch(`/api/admin/leads/${enrollingLead.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'contacted' })
        });
        setTimeout(() => {
          setShowEnrollModal(false);
          setEnrollingLead(null);
          setSelectedSequence('');
          setEnrollResult(null);
          fetchLeads();
        }, 2000);
      } else {
        setEnrollResult({ success: false, message: data.error || 'Enrollment failed' });
      }
    } catch (err: any) {
      setEnrollResult({ success: false, message: err.message });
    } finally {
      setEnrolling(false);
    }
  };

  // Handle convert to client
  const handleConvertToClient = async () => {
    if (!convertingLead || !convertingLead.primary_email) return;

    setConverting(true);
    setConvertResult(null);

    try {
      const response = await fetch('/api/admin/intelligence/convert', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: convertingLead.id,
          email: convertingLead.primary_email,
          name: convertingLead.name,
          company: convertingLead.dba_name || convertingLead.name,
          phone: convertingLead.primary_phone,
          address: convertingLead.address_line1,
          town: convertingLead.city,
          state: convertingLead.state,
          pos_system: convertingLead.current_pos
        })
      });

      const data = await response.json();
      if (data.success) {
        setConvertResult({
          success: true,
          message: `Successfully converted to client!`
        });
        setTimeout(() => {
          setShowConvertModal(false);
          setConvertingLead(null);
          setConvertResult(null);
          fetchLeads();
        }, 2000);
      } else {
        setConvertResult({ success: false, message: data.error || 'Conversion failed' });
      }
    } catch (err: any) {
      setConvertResult({ success: false, message: err.message });
    } finally {
      setConverting(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setOffset(0);
      fetchLeads();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const getScoreColor = (score?: number) => {
    if (!score) return 'bg-gray-600';
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-amber-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      prospect: 'bg-blue-500/20 text-blue-400',
      contacted: 'bg-yellow-500/20 text-yellow-400',
      qualified: 'bg-green-500/20 text-green-400',
      client: 'bg-purple-500/20 text-purple-400',
      dead: 'bg-gray-500/20 text-gray-400'
    };
    return styles[status] || 'bg-gray-500/20 text-gray-400';
  };

  const getSegmentBadge = (segment?: string) => {
    const styles: Record<string, string> = {
      A: 'bg-red-500/20 text-red-400',
      B: 'bg-orange-500/20 text-orange-400',
      C: 'bg-yellow-500/20 text-yellow-400',
      D: 'bg-green-500/20 text-green-400'
    };
    return styles[segment || ''] || 'bg-gray-500/20 text-gray-400';
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (error) {
    return (
      <div className="admin-card p-6 text-center">
        <p className="text-red-400 mb-4">Error: {error}</p>
        <button
          onClick={fetchLeads}
          className="px-4 py-2 bg-amber-500 text-black rounded-lg hover:bg-amber-400"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards - Mobile Horizontal Scroll */}
      {stats && (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex-shrink-0 admin-card p-3 min-w-[120px]">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-xs text-gray-400">Total Leads</div>
          </div>
          <div className="flex-shrink-0 admin-card p-3 min-w-[100px]">
            <div className="text-2xl font-bold text-blue-400">{stats.prospects}</div>
            <div className="text-xs text-gray-400">Prospects</div>
          </div>
          <div className="flex-shrink-0 admin-card p-3 min-w-[100px]">
            <div className="text-2xl font-bold text-yellow-400">{stats.contacted}</div>
            <div className="text-xs text-gray-400">Contacted</div>
          </div>
          <div className="flex-shrink-0 admin-card p-3 min-w-[100px]">
            <div className="text-2xl font-bold text-green-400">{stats.qualified}</div>
            <div className="text-xs text-gray-400">Qualified</div>
          </div>
          <div className="flex-shrink-0 admin-card p-3 min-w-[100px]">
            <div className="text-2xl font-bold text-purple-400">{stats.clients}</div>
            <div className="text-xs text-gray-400">Converted</div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="admin-card p-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2.5 rounded-lg border ${showFilters ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
          >
            <Filter className="w-5 h-5" />
          </button>
          <button
            onClick={fetchLeads}
            className="px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-white"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Expandable Filters */}
        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-gray-700">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setOffset(0); }}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
            >
              <option value="">All Status</option>
              <option value="prospect">Prospect</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="client">Client</option>
            </select>

            <select
              value={segmentFilter}
              onChange={(e) => { setSegmentFilter(e.target.value); setOffset(0); }}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
            >
              <option value="">All Segments</option>
              <option value="A">Segment A (Switchers)</option>
              <option value="B">Segment B (Toast)</option>
              <option value="C">Segment C (Transition)</option>
              <option value="D">Segment D (Local)</option>
            </select>

            <select
              value={posFilter}
              onChange={(e) => { setPosFilter(e.target.value); setOffset(0); }}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
            >
              <option value="">All POS</option>
              {posCounts.map(p => (
                <option key={p.current_pos} value={p.current_pos}>
                  {p.current_pos} ({p.count})
                </option>
              ))}
            </select>

            <select
              value={minScore}
              onChange={(e) => { setMinScore(e.target.value); setOffset(0); }}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
            >
              <option value="">Any Score</option>
              <option value="80">80+ (High)</option>
              <option value="60">60+ (Medium)</option>
              <option value="40">40+ (Low)</option>
            </select>
          </div>
        )}
      </div>

      {/* Leads List */}
      <div className="admin-card divide-y divide-gray-800">
        {loading && leads.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
            Loading leads...
          </div>
        ) : leads.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No leads found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          leads.map((lead) => (
            <div
              key={lead.id}
              className="p-4 hover:bg-gray-800/50 cursor-pointer transition-colors"
              onClick={() => setSelectedLead(selectedLead?.id === lead.id ? null : lead)}
            >
              <div className="flex items-start gap-3">
                {/* Score indicator */}
                <div className={`w-10 h-10 rounded-lg ${getScoreColor(lead.lead_score)} flex items-center justify-center flex-shrink-0`}>
                  <span className="text-white font-bold text-sm">{lead.lead_score || '?'}</span>
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-white truncate">{lead.name}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusBadge(lead.status)}`}>
                      {lead.status}
                    </span>
                    {lead.segment && (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSegmentBadge(lead.segment)}`}>
                        Seg {lead.segment}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                    {lead.current_pos && (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {lead.current_pos}
                      </span>
                    )}
                    {lead.city && lead.state && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {lead.city}, {lead.state}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {lead.primary_email && (
                    <a
                      href={`mailto:${lead.primary_email}`}
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 text-gray-400 hover:text-amber-400 hover:bg-gray-700 rounded-lg"
                    >
                      <Mail className="w-4 h-4" />
                    </a>
                  )}
                  {lead.primary_phone && (
                    <a
                      href={`tel:${lead.primary_phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 text-gray-400 hover:text-green-400 hover:bg-gray-700 rounded-lg"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                  )}
                  <ChevronRight className={`w-5 h-5 text-gray-600 transition-transform ${selectedLead?.id === lead.id ? 'rotate-90' : ''}`} />
                </div>
              </div>

              {/* Expanded detail */}
              {selectedLead?.id === lead.id && (
                <div className="mt-4 pt-4 border-t border-gray-700 space-y-3">
                  {lead.primary_email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-gray-500" />
                      <a href={`mailto:${lead.primary_email}`} className="text-amber-400 hover:underline">
                        {lead.primary_email}
                      </a>
                    </div>
                  )}
                  {lead.primary_phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-gray-500" />
                      <a href={`tel:${lead.primary_phone}`} className="text-white hover:text-amber-400">
                        {lead.primary_phone}
                      </a>
                    </div>
                  )}
                  {lead.address_line1 && (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <MapPin className="w-4 h-4 text-gray-500" />
                      {lead.address_line1}, {lead.city}, {lead.state} {lead.zip}
                    </div>
                  )}
                  {lead.website_url && (
                    <div className="flex items-center gap-2 text-sm">
                      <ExternalLink className="w-4 h-4 text-gray-500" />
                      <a
                        href={lead.website_url.startsWith('http') ? lead.website_url : `https://${lead.website_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-400 hover:underline"
                      >
                        {lead.domain || lead.website_url}
                      </a>
                    </div>
                  )}
                  {lead.notes && (
                    <p className="text-sm text-gray-400 bg-gray-800 p-2 rounded">{lead.notes}</p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>Added: {formatDate(lead.created_at)}</span>
                    {lead.source && <span>Source: {lead.source}</span>}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (lead.primary_email) {
                          setEnrollingLead(lead);
                          setShowEnrollModal(true);
                        }
                      }}
                      disabled={!lead.primary_email}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-amber-500 text-black rounded-lg text-sm font-medium hover:bg-amber-400 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                      Enroll in Sequence
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (lead.primary_email) {
                          setConvertingLead(lead);
                          setShowConvertModal(true);
                        }
                      }}
                      disabled={!lead.primary_email || lead.converted_to_client_id !== null}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-500 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      <UserPlus className="w-4 h-4" />
                      {lead.converted_to_client_id ? 'Already Client' : 'Convert to Client'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between admin-card p-3">
          <span className="text-sm text-gray-400">
            Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="px-3 py-1.5 bg-gray-800 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 text-sm"
            >
              Previous
            </button>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= total}
              className="px-3 py-1.5 bg-gray-800 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 text-sm"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Enroll in Sequence Modal */}
      {showEnrollModal && enrollingLead && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl max-w-md w-full p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Enroll in Email Sequence</h3>
              <button
                onClick={() => {
                  setShowEnrollModal(false);
                  setEnrollingLead(null);
                  setSelectedSequence('');
                  setEnrollResult(null);
                }}
                className="p-1 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-gray-800 rounded-lg">
              <p className="text-white font-medium">{enrollingLead.name}</p>
              <p className="text-sm text-gray-400">{enrollingLead.primary_email}</p>
            </div>

            {enrollResult ? (
              <div className={`p-4 rounded-lg mb-4 ${enrollResult.success ? 'bg-green-500/20 border border-green-500/50' : 'bg-red-500/20 border border-red-500/50'}`}>
                <div className="flex items-center gap-2">
                  {enrollResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <X className="w-5 h-5 text-red-400" />
                  )}
                  <span className={enrollResult.success ? 'text-green-400' : 'text-red-400'}>
                    {enrollResult.message}
                  </span>
                </div>
              </div>
            ) : (
              <>
                <label className="block text-sm text-gray-400 mb-2">Select Sequence</label>
                <select
                  value={selectedSequence}
                  onChange={(e) => setSelectedSequence(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white mb-4 focus:border-amber-500 focus:outline-none"
                >
                  <option value="">Choose a sequence...</option>
                  {sequences.map(seq => (
                    <option key={seq.id} value={seq.id}>{seq.name}</option>
                  ))}
                </select>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowEnrollModal(false);
                      setEnrollingLead(null);
                      setSelectedSequence('');
                    }}
                    className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEnrollInSequence}
                    disabled={!selectedSequence || enrolling}
                    className="flex-1 px-4 py-2 bg-amber-500 text-black rounded-lg font-medium hover:bg-amber-400 disabled:bg-gray-600 disabled:text-gray-400 flex items-center justify-center gap-2"
                  >
                    {enrolling ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Enrolling...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Enroll Now
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Convert to Client Modal */}
      {showConvertModal && convertingLead && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl max-w-md w-full p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Convert to Client</h3>
              <button
                onClick={() => {
                  setShowConvertModal(false);
                  setConvertingLead(null);
                  setConvertResult(null);
                }}
                className="p-1 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {convertResult ? (
              <div className={`p-4 rounded-lg mb-4 ${convertResult.success ? 'bg-green-500/20 border border-green-500/50' : 'bg-red-500/20 border border-red-500/50'}`}>
                <div className="flex items-center gap-2">
                  {convertResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <X className="w-5 h-5 text-red-400" />
                  )}
                  <span className={convertResult.success ? 'text-green-400' : 'text-red-400'}>
                    {convertResult.message}
                  </span>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4 p-4 bg-gray-800 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Name:</span>
                    <span className="text-white">{convertingLead.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Email:</span>
                    <span className="text-white">{convertingLead.primary_email}</span>
                  </div>
                  {convertingLead.primary_phone && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Phone:</span>
                      <span className="text-white">{convertingLead.primary_phone}</span>
                    </div>
                  )}
                  {convertingLead.current_pos && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">POS:</span>
                      <span className="text-amber-400">{convertingLead.current_pos}</span>
                    </div>
                  )}
                  {convertingLead.city && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Location:</span>
                      <span className="text-white">{convertingLead.city}, {convertingLead.state}</span>
                    </div>
                  )}
                </div>

                <p className="text-sm text-gray-400 mb-4">
                  This will create a new client profile and mark this lead as converted.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowConvertModal(false);
                      setConvertingLead(null);
                    }}
                    className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConvertToClient}
                    disabled={converting}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-500 disabled:bg-gray-600 disabled:text-gray-400 flex items-center justify-center gap-2"
                  >
                    {converting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Converting...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        Convert Now
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
