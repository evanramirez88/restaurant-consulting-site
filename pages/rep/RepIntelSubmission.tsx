import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Loader2,
  Search,
  Lightbulb,
  Plus,
  User,
  Mail,
  Phone,
  MapPin,
  Building2,
  DollarSign,
  Flame,
  Clock,
  CheckCircle,
  XCircle,
  Archive,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  X,
  Send,
  Target,
  ArrowRight
} from 'lucide-react';
import { useSEO } from '../../src/components/SEO';

// ============================================
// TYPE DEFINITIONS
// ============================================
interface IntelSubmission {
  id: string;
  submission_type: 'lead' | 'market_intel' | 'competitor_info' | 'opportunity' | 'feedback';
  subject: string;
  body: string | null;
  restaurant_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  location: string | null;
  city: string | null;
  state: string | null;
  current_pos: string | null;
  estimated_value: number | null;
  urgency: 'low' | 'normal' | 'high' | 'hot';
  status: 'pending' | 'reviewed' | 'converted' | 'rejected' | 'archived';
  admin_notes: string | null;
  reviewed_at: number | null;
  client_name: string | null;
  opportunity_type: string | null;
  created_at: number;
}

interface Client {
  id: string;
  company: string;
}

// ============================================
// REP INTEL SUBMISSION PAGE
// ============================================
const RepIntelSubmission: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [submissions, setSubmissions] = useState<IntelSubmission[]>([]);
  const [counts, setCounts] = useState({ total: 0, pending: 0, converted: 0 });
  const [error, setError] = useState<string | null>(null);
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Modal state
  const [showNewSubmissionModal, setShowNewSubmissionModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);

  // Convert to lead state
  const [isConverting, setIsConverting] = useState<string | null>(null);

  // New submission form
  const [newSubmission, setNewSubmission] = useState({
    submission_type: 'lead' as const,
    subject: '',
    body: '',
    restaurant_name: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    location: '',
    city: '',
    state: '',
    current_pos: '',
    current_pos_issues: '',
    estimated_stations: '',
    estimated_value: '',
    urgency: 'normal' as const,
    best_time_to_contact: '',
    decision_timeline: '',
    client_id: '',
    opportunity_type: ''
  });

  useSEO({
    title: 'Intel Submission | Rep Portal',
    description: 'Submit leads, market intelligence, and opportunities.',
  });

  // Load data
  useEffect(() => {
    loadData();
  }, [slug]);

  const loadData = async () => {
    if (!slug) return;

    try {
      const intelRes = await fetch(`/api/rep/${slug}/intel`);
      const intelData = await intelRes.json();

      if (intelData.success) {
        setSubmissions(intelData.data || []);
        setCounts(intelData.counts || { total: 0, pending: 0, converted: 0 });
      } else {
        setError(intelData.error || 'Failed to load submissions');
      }

      // Load clients for opportunity dropdown
      const clientsRes = await fetch(`/api/rep/${slug}/clients`);
      const clientsData = await clientsRes.json();

      if (clientsData.success) {
        setClients(clientsData.data || []);
      }
    } catch (err) {
      console.error('Load error:', err);
      setError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit new intel
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug || !newSubmission.subject.trim()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        ...newSubmission,
        estimated_stations: newSubmission.estimated_stations ? parseInt(newSubmission.estimated_stations) : null,
        estimated_value: newSubmission.estimated_value ? parseFloat(newSubmission.estimated_value) : null
      };

      const response = await fetch(`/api/rep/${slug}/intel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.success) {
        setShowNewSubmissionModal(false);
        resetForm();
        loadData();
      } else {
        alert(data.error || 'Failed to submit');
      }
    } catch (err) {
      console.error('Submit error:', err);
      alert('Failed to submit');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setNewSubmission({
      submission_type: 'lead',
      subject: '',
      body: '',
      restaurant_name: '',
      contact_name: '',
      contact_email: '',
      contact_phone: '',
      location: '',
      city: '',
      state: '',
      current_pos: '',
      current_pos_issues: '',
      estimated_stations: '',
      estimated_value: '',
      urgency: 'normal',
      best_time_to_contact: '',
      decision_timeline: '',
      client_id: '',
      opportunity_type: ''
    });
  };

  // Convert intel submission to lead
  const handleConvertToLead = async (submission: IntelSubmission) => {
    if (!slug || isConverting) return;

    setIsConverting(submission.id);
    try {
      const response = await fetch(`/api/rep/${slug}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intelId: submission.id,
          restaurantName: submission.restaurant_name || submission.subject,
          contactName: submission.contact_name,
          email: submission.contact_email,
          phone: submission.contact_phone,
          city: submission.city,
          state: submission.state,
          currentPos: submission.current_pos,
          estimatedValue: submission.estimated_value,
          notes: submission.body
        })
      });

      const data = await response.json();

      if (data.success) {
        // Update the local submission status
        setSubmissions(prev => prev.map(s =>
          s.id === submission.id ? { ...s, status: 'converted' as const } : s
        ));
        // Navigate to the leads page
        navigate(`/rep/${slug}/leads`);
      } else {
        alert(data.error || 'Failed to convert to lead');
      }
    } catch (err) {
      console.error('Convert error:', err);
      alert('Failed to convert to lead');
    } finally {
      setIsConverting(null);
    }
  };

  // Check if submission can be converted to lead
  const canConvertToLead = (submission: IntelSubmission) => {
    return (
      submission.submission_type === 'lead' &&
      (submission.status === 'pending' || submission.status === 'reviewed') &&
      submission.restaurant_name
    );
  };

  // Utility functions
  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'converted':
        return { color: 'text-green-400 bg-green-400/10', icon: <CheckCircle className="w-4 h-4" />, label: 'Converted' };
      case 'reviewed':
        return { color: 'text-blue-400 bg-blue-400/10', icon: <Clock className="w-4 h-4" />, label: 'Reviewed' };
      case 'rejected':
        return { color: 'text-red-400 bg-red-400/10', icon: <XCircle className="w-4 h-4" />, label: 'Rejected' };
      case 'archived':
        return { color: 'text-gray-400 bg-gray-400/10', icon: <Archive className="w-4 h-4" />, label: 'Archived' };
      default:
        return { color: 'text-amber-400 bg-amber-400/10', icon: <Clock className="w-4 h-4" />, label: 'Pending' };
    }
  };

  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'lead':
        return { color: 'text-green-400', icon: <User className="w-4 h-4" />, label: 'Lead' };
      case 'opportunity':
        return { color: 'text-purple-400', icon: <Lightbulb className="w-4 h-4" />, label: 'Opportunity' };
      case 'market_intel':
        return { color: 'text-blue-400', icon: <Lightbulb className="w-4 h-4" />, label: 'Market Intel' };
      case 'competitor_info':
        return { color: 'text-orange-400', icon: <AlertTriangle className="w-4 h-4" />, label: 'Competitor' };
      default:
        return { color: 'text-gray-400', icon: <Lightbulb className="w-4 h-4" />, label: 'Feedback' };
    }
  };

  const getUrgencyConfig = (urgency: string) => {
    switch (urgency) {
      case 'hot':
        return { color: 'text-red-400', icon: <Flame className="w-4 h-4" />, label: 'Hot' };
      case 'high':
        return { color: 'text-orange-400', label: 'High' };
      case 'low':
        return { color: 'text-gray-400', label: 'Low' };
      default:
        return { color: 'text-gray-300', label: 'Normal' };
    }
  };

  // Filter submissions
  const filteredSubmissions = submissions.filter(s => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!s.subject.toLowerCase().includes(q) &&
          !(s.restaurant_name || '').toLowerCase().includes(q) &&
          !(s.contact_name || '').toLowerCase().includes(q)) {
        return false;
      }
    }

    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (typeFilter !== 'all' && s.submission_type !== typeFilter) return false;

    return true;
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Error Loading Data</h2>
        <p className="text-gray-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Intel & Leads</h1>
          <p className="text-gray-400">
            {counts.total} submissions ({counts.pending} pending, {counts.converted} converted)
          </p>
        </div>

        <button
          onClick={() => setShowNewSubmissionModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Submission
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search submissions..."
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="reviewed">Reviewed</option>
          <option value="converted">Converted</option>
          <option value="rejected">Rejected</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="all">All Types</option>
          <option value="lead">Lead</option>
          <option value="opportunity">Opportunity</option>
          <option value="market_intel">Market Intel</option>
          <option value="competitor_info">Competitor Info</option>
          <option value="feedback">Feedback</option>
        </select>
      </div>

      {/* Submissions List */}
      {filteredSubmissions.length === 0 ? (
        <div className="admin-card p-12 text-center">
          <Lightbulb className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Submissions Found</h3>
          <p className="text-gray-400 mb-6">
            Submit leads, market intelligence, or opportunities to help grow the business.
          </p>
          <button
            onClick={() => setShowNewSubmissionModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Make Your First Submission
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSubmissions.map((submission) => {
            const isExpanded = expandedSubmission === submission.id;
            const statusConfig = getStatusConfig(submission.status);
            const typeConfig = getTypeConfig(submission.submission_type);
            const urgencyConfig = getUrgencyConfig(submission.urgency);

            return (
              <div key={submission.id} className="admin-card overflow-hidden">
                <button
                  onClick={() => setExpandedSubmission(isExpanded ? null : submission.id)}
                  className="w-full px-5 py-4 text-left hover:bg-gray-800/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                          {statusConfig.icon}
                          {statusConfig.label}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 ${typeConfig.color}`}>
                          {typeConfig.icon}
                          {typeConfig.label}
                        </span>
                        {submission.urgency !== 'normal' && (
                          <span className={`inline-flex items-center gap-1 text-xs font-medium ${urgencyConfig.color}`}>
                            {urgencyConfig.icon}
                            {urgencyConfig.label}
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-medium text-white truncate">{submission.subject}</h3>

                      {(submission.restaurant_name || submission.client_name) && (
                        <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
                          <Building2 className="w-3 h-3" />
                          {submission.restaurant_name || submission.client_name}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {submission.estimated_value && (
                        <div className="hidden sm:block text-right">
                          <div className="text-green-400 font-medium">{formatCurrency(submission.estimated_value)}</div>
                          <div className="text-xs text-gray-500">Est. Value</div>
                        </div>
                      )}
                      <div className="hidden sm:block text-xs text-gray-500">{formatDate(submission.created_at)}</div>
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-700 px-5 py-4 bg-gray-900/30">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 uppercase mb-3">Details</h4>
                        {submission.body && (
                          <p className="text-gray-300 text-sm whitespace-pre-wrap mb-4">{submission.body}</p>
                        )}

                        <dl className="space-y-2 text-sm">
                          {submission.contact_name && (
                            <div className="flex items-center gap-2 text-gray-400">
                              <User className="w-4 h-4" />
                              <span className="text-white">{submission.contact_name}</span>
                            </div>
                          )}
                          {submission.contact_email && (
                            <div className="flex items-center gap-2 text-gray-400">
                              <Mail className="w-4 h-4" />
                              <span className="text-white">{submission.contact_email}</span>
                            </div>
                          )}
                          {submission.contact_phone && (
                            <div className="flex items-center gap-2 text-gray-400">
                              <Phone className="w-4 h-4" />
                              <span className="text-white">{submission.contact_phone}</span>
                            </div>
                          )}
                          {(submission.city || submission.state) && (
                            <div className="flex items-center gap-2 text-gray-400">
                              <MapPin className="w-4 h-4" />
                              <span className="text-white">{[submission.city, submission.state].filter(Boolean).join(', ')}</span>
                            </div>
                          )}
                          {submission.current_pos && (
                            <div className="flex justify-between">
                              <dt className="text-gray-400">Current POS</dt>
                              <dd className="text-white">{submission.current_pos}</dd>
                            </div>
                          )}
                        </dl>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-gray-400 uppercase mb-3">Admin Review</h4>
                        {submission.admin_notes ? (
                          <div className="p-3 bg-gray-800 rounded-lg">
                            <p className="text-sm text-gray-300">{submission.admin_notes}</p>
                            {submission.reviewed_at && (
                              <p className="text-xs text-gray-500 mt-2">Reviewed {formatDate(submission.reviewed_at)}</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-sm italic">Awaiting admin review</p>
                        )}

                        {/* Convert to Lead Button */}
                        {canConvertToLead(submission) && (
                          <div className="mt-4 pt-4 border-t border-gray-700">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConvertToLead(submission);
                              }}
                              disabled={isConverting === submission.id}
                              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                            >
                              {isConverting === submission.id ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Converting...
                                </>
                              ) : (
                                <>
                                  <Target className="w-4 h-4" />
                                  Convert to Lead
                                  <ArrowRight className="w-4 h-4" />
                                </>
                              )}
                            </button>
                            <p className="text-xs text-gray-500 mt-2 text-center">
                              This will add "{submission.restaurant_name}" to your lead pipeline
                            </p>
                          </div>
                        )}

                        {submission.status === 'converted' && (
                          <div className="mt-4 pt-4 border-t border-gray-700">
                            <div className="flex items-center gap-2 text-green-400 text-sm">
                              <CheckCircle className="w-4 h-4" />
                              <span>Already converted to lead</span>
                            </div>
                            <button
                              onClick={() => navigate(`/rep/${slug}/leads`)}
                              className="mt-2 text-sm text-green-400 hover:text-green-300 underline"
                            >
                              View in Lead Pipeline
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Submission Modal */}
      {showNewSubmissionModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 sticky top-0 bg-gray-900">
              <h2 className="text-lg font-semibold text-white">New Submission</h2>
              <button onClick={() => setShowNewSubmissionModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Submission Type */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Type <span className="text-red-400">*</span></label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {(['lead', 'opportunity', 'market_intel', 'competitor_info', 'feedback'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setNewSubmission({ ...newSubmission, submission_type: type })}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        newSubmission.submission_type === type
                          ? 'bg-amber-500 border-amber-500 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                      }`}
                    >
                      {type === 'market_intel' ? 'Market' : type === 'competitor_info' ? 'Competitor' : type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Subject <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={newSubmission.subject}
                  onChange={(e) => setNewSubmission({ ...newSubmission, subject: e.target.value })}
                  placeholder="Brief summary"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              {/* Lead-specific fields */}
              {newSubmission.submission_type === 'lead' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Restaurant Name</label>
                      <input
                        type="text"
                        value={newSubmission.restaurant_name}
                        onChange={(e) => setNewSubmission({ ...newSubmission, restaurant_name: e.target.value })}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Contact Name</label>
                      <input
                        type="text"
                        value={newSubmission.contact_name}
                        onChange={(e) => setNewSubmission({ ...newSubmission, contact_name: e.target.value })}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                      <input
                        type="email"
                        value={newSubmission.contact_email}
                        onChange={(e) => setNewSubmission({ ...newSubmission, contact_email: e.target.value })}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={newSubmission.contact_phone}
                        onChange={(e) => setNewSubmission({ ...newSubmission, contact_phone: e.target.value })}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-300 mb-1">City</label>
                      <input
                        type="text"
                        value={newSubmission.city}
                        onChange={(e) => setNewSubmission({ ...newSubmission, city: e.target.value })}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">State</label>
                      <input
                        type="text"
                        value={newSubmission.state}
                        onChange={(e) => setNewSubmission({ ...newSubmission, state: e.target.value })}
                        maxLength={2}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Current POS</label>
                      <input
                        type="text"
                        value={newSubmission.current_pos}
                        onChange={(e) => setNewSubmission({ ...newSubmission, current_pos: e.target.value })}
                        placeholder="e.g., Square, Clover, None"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Est. Value ($)</label>
                      <input
                        type="number"
                        value={newSubmission.estimated_value}
                        onChange={(e) => setNewSubmission({ ...newSubmission, estimated_value: e.target.value })}
                        placeholder="e.g., 5000"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Opportunity-specific fields */}
              {newSubmission.submission_type === 'opportunity' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Client <span className="text-red-400">*</span></label>
                    <select
                      value={newSubmission.client_id}
                      onChange={(e) => setNewSubmission({ ...newSubmission, client_id: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      required={newSubmission.submission_type === 'opportunity'}
                    >
                      <option value="">Select client...</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Opportunity Type</label>
                    <select
                      value={newSubmission.opportunity_type}
                      onChange={(e) => setNewSubmission({ ...newSubmission, opportunity_type: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="">Select...</option>
                      <option value="go_live_support">Go-Live Support</option>
                      <option value="training">Staff Training</option>
                      <option value="support_plan">Support Plan Upgrade</option>
                      <option value="add_locations">Add Locations</option>
                      <option value="optimization">System Optimization</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Details</label>
                <textarea
                  value={newSubmission.body}
                  onChange={(e) => setNewSubmission({ ...newSubmission, body: e.target.value })}
                  placeholder="Provide more context..."
                  rows={4}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              {/* Urgency */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Urgency</label>
                <div className="flex gap-2">
                  {(['low', 'normal', 'high', 'hot'] as const).map(u => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setNewSubmission({ ...newSubmission, urgency: u })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        newSubmission.urgency === u
                          ? u === 'hot' ? 'bg-red-500 border-red-500 text-white'
                            : u === 'high' ? 'bg-orange-500 border-orange-500 text-white'
                            : 'bg-amber-500 border-amber-500 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                      }`}
                    >
                      {u === 'hot' && <Flame className="w-4 h-4 inline mr-1" />}
                      {u.charAt(0).toUpperCase() + u.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowNewSubmissionModal(false)} className="px-4 py-2 text-gray-400 hover:text-white">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newSubmission.subject.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RepIntelSubmission;
