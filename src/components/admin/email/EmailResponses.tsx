import React, { useState, useEffect } from 'react';
import {
  Mail, RefreshCw, Loader2, Check, X, Info, AlertTriangle,
  Phone, Building2, MapPin, UserPlus, ExternalLink, Ban,
  MessageSquare, Filter, ChevronDown
} from 'lucide-react';

interface ReplyData {
  id: string;
  email: string;
  subject: string;
  body_preview: string;
  sentiment: string;
  priority: string;
  source: string;
  received_at: number;
  processed: boolean;
  classification: string | null;
  response_type: string | null;
  enrichment_status: string | null;
  rep_profile_id: string | null;
  notes: string | null;
  extracted: {
    business_name: string | null;
    phone: string | null;
    address: string | null;
    business_type: string | null;
  };
  subscriber: {
    name: string;
    company: string;
    engagement_score: number;
  } | null;
  lead: {
    restaurant: string;
    lead_score: number;
  } | null;
}

interface ReplyStats {
  total: number;
  high_priority: number;
  unprocessed: number;
  positive: number;
  human_positive: number;
  human_negative: number;
  human_info: number;
  auto_reply: number;
  bounces: number;
  human_replies: number;
}

type ClassificationFilter = 'all' | 'human_positive' | 'human_negative' | 'human_info' | 'auto_reply' | 'bounce';

const CLASSIFICATION_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  human_positive: { label: 'Positive', color: 'text-green-400', bgColor: 'bg-green-900/30 border-green-700', icon: <Check className="w-3 h-3" /> },
  human_negative: { label: 'Negative', color: 'text-red-400', bgColor: 'bg-red-900/30 border-red-700', icon: <X className="w-3 h-3" /> },
  human_info: { label: 'Info', color: 'text-blue-400', bgColor: 'bg-blue-900/30 border-blue-700', icon: <Info className="w-3 h-3" /> },
  auto_reply: { label: 'Auto-Reply', color: 'text-yellow-400', bgColor: 'bg-yellow-900/30 border-yellow-700', icon: <Mail className="w-3 h-3" /> },
  bounce: { label: 'Bounce', color: 'text-red-500', bgColor: 'bg-red-950/30 border-red-800', icon: <AlertTriangle className="w-3 h-3" /> },
};

const EmailResponses: React.FC = () => {
  const [replies, setReplies] = useState<ReplyData[]>([]);
  const [stats, setStats] = useState<ReplyStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [classificationFilter, setClassificationFilter] = useState<ClassificationFilter>('all');
  const [processedFilter, setProcessedFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadReplies();
  }, [days, classificationFilter, processedFilter]);

  const loadReplies = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ days: days.toString() });
      if (classificationFilter !== 'all') params.set('classification', classificationFilter);
      if (processedFilter !== 'all') params.set('processed', processedFilter === 'processed' ? '1' : '0');

      const response = await fetch(`/api/admin/email/replies?${params}`);
      const result = await response.json();

      if (result.success) {
        setReplies(result.data.replies || []);
        setStats(result.data.stats || null);
      } else {
        setError(result.error || 'Failed to load replies');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkProcessed = async (replyId: string) => {
    setActionLoading(replyId);
    try {
      const response = await fetch(`/api/admin/email/replies/${replyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processed: 1 })
      });
      const result = await response.json();
      if (result.success) {
        setReplies(prev => prev.map(r => r.id === replyId ? { ...r, processed: true } : r));
      }
    } catch (err) {
      console.error('Mark processed error:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleConvertToRep = async (replyId: string) => {
    if (!confirm('Create a rep profile from this response?')) return;
    setActionLoading(replyId);
    try {
      const response = await fetch(`/api/admin/email/replies/${replyId}/convert-to-rep`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const result = await response.json();
      if (result.success) {
        setReplies(prev => prev.map(r =>
          r.id === replyId
            ? { ...r, rep_profile_id: result.data.rep_id, enrichment_status: 'enriched', processed: true }
            : r
        ));
        alert(`Rep profile created: ${result.data.name}`);
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuppress = async (replyId: string, email: string) => {
    if (!confirm(`Suppress ${email}? This will mark subscriber as bounced.`)) return;
    setActionLoading(replyId);
    try {
      await fetch(`/api/admin/email/replies/${replyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processed: 1,
          enrichment_status: 'skipped',
          notes: 'Suppressed - bounce/unsubscribe'
        })
      });
      setReplies(prev => prev.map(r =>
        r.id === replyId ? { ...r, processed: true, enrichment_status: 'skipped' } : r
      ));
    } catch (err) {
      console.error('Suppress error:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleEnrichLead = async (replyId: string) => {
    setActionLoading(replyId);
    try {
      await fetch(`/api/admin/email/replies/${replyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrichment_status: 'enriched', processed: 1 })
      });
      setReplies(prev => prev.map(r =>
        r.id === replyId ? { ...r, enrichment_status: 'enriched', processed: true } : r
      ));
    } catch (err) {
      console.error('Enrich error:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (ts: number) => {
    if (!ts) return 'Unknown';
    const d = new Date(ts * 1000);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getClassificationBadge = (classification: string | null) => {
    const config = CLASSIFICATION_CONFIG[classification || ''];
    if (!config) return null;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${config.bgColor} ${config.color}`}>
        {config.icon}
        {config.label}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-xs text-gray-400">Total</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
            <div className="text-2xl font-bold text-blue-400">{stats.human_replies}</div>
            <div className="text-xs text-gray-400">Human Replies</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
            <div className="text-2xl font-bold text-green-400">{stats.human_positive}</div>
            <div className="text-xs text-gray-400">Positive</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
            <div className="text-2xl font-bold text-yellow-400">{stats.auto_reply}</div>
            <div className="text-xs text-gray-400">Auto-Reply</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
            <div className="text-2xl font-bold text-red-400">{stats.bounces}</div>
            <div className="text-xs text-gray-400">Bounces</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
            <div className="text-2xl font-bold text-amber-400">{stats.unprocessed}</div>
            <div className="text-xs text-gray-400">Unprocessed</div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={loadReplies}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>

        <select
          value={days}
          onChange={e => setDays(Number(e.target.value))}
          className="px-3 py-2 bg-gray-700 rounded-lg text-sm text-white border border-gray-600"
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={60}>Last 60 days</option>
          <option value={90}>Last 90 days</option>
        </select>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            showFilters ? 'bg-amber-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filters
          <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Filter Row */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Classification</label>
            <select
              value={classificationFilter}
              onChange={e => setClassificationFilter(e.target.value as ClassificationFilter)}
              className="px-3 py-1.5 bg-gray-700 rounded text-sm text-white border border-gray-600"
            >
              <option value="all">All</option>
              <option value="human_positive">Positive</option>
              <option value="human_negative">Negative</option>
              <option value="human_info">Info</option>
              <option value="auto_reply">Auto-Reply</option>
              <option value="bounce">Bounce</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Status</label>
            <select
              value={processedFilter}
              onChange={e => setProcessedFilter(e.target.value)}
              className="px-3 py-1.5 bg-gray-700 rounded text-sm text-white border border-gray-600"
            >
              <option value="all">All</option>
              <option value="unprocessed">Unprocessed</option>
              <option value="processed">Processed</option>
            </select>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
        </div>
      )}

      {/* Response Cards */}
      {!isLoading && replies.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No responses found for this period.</p>
          <p className="text-sm mt-1">Run the gmail_response_processor.cjs script to detect replies.</p>
        </div>
      )}

      {!isLoading && replies.length > 0 && (
        <div className="space-y-3">
          {replies.map(reply => (
            <div
              key={reply.id}
              className={`p-4 rounded-lg border transition-colors ${
                reply.processed
                  ? 'bg-gray-800/50 border-gray-700 opacity-75'
                  : 'bg-gray-800 border-gray-600 hover:border-gray-500'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-medium truncate">{reply.email}</span>
                    {getClassificationBadge(reply.classification)}
                    {reply.processed && (
                      <span className="text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded-full">Processed</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-400 mt-0.5 truncate">
                    {reply.subject || '(no subject)'}
                  </div>
                </div>
                <div className="text-xs text-gray-500 whitespace-nowrap">
                  {formatDate(reply.received_at)}
                </div>
              </div>

              {/* Body Preview */}
              {reply.body_preview && (
                <div className="text-sm text-gray-300 mb-3 line-clamp-2">
                  {reply.body_preview}
                </div>
              )}

              {/* Extracted Data */}
              {(reply.extracted.business_name || reply.extracted.phone || reply.extracted.address || reply.extracted.business_type) && (
                <div className="flex flex-wrap gap-3 mb-3 p-2 bg-gray-900/50 rounded border border-gray-700">
                  {reply.extracted.business_name && (
                    <span className="flex items-center gap-1 text-xs text-blue-300">
                      <Building2 className="w-3 h-3" />
                      {reply.extracted.business_name}
                    </span>
                  )}
                  {reply.extracted.phone && (
                    <span className="flex items-center gap-1 text-xs text-green-300">
                      <Phone className="w-3 h-3" />
                      {reply.extracted.phone}
                    </span>
                  )}
                  {reply.extracted.address && (
                    <span className="flex items-center gap-1 text-xs text-yellow-300">
                      <MapPin className="w-3 h-3" />
                      {reply.extracted.address}
                    </span>
                  )}
                  {reply.extracted.business_type && (
                    <span className="text-xs text-purple-300 bg-purple-900/20 px-2 py-0.5 rounded-full">
                      {reply.extracted.business_type.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
              )}

              {/* Context: Subscriber / Lead info */}
              {(reply.subscriber || reply.lead) && (
                <div className="flex gap-4 mb-3 text-xs text-gray-400">
                  {reply.subscriber && (
                    <span>Subscriber: {reply.subscriber.name} ({reply.subscriber.company}) - Score: {reply.subscriber.engagement_score}</span>
                  )}
                  {reply.lead && (
                    <span>Lead: {reply.lead.restaurant} - Score: {reply.lead.lead_score}</span>
                  )}
                </div>
              )}

              {/* Actions */}
              {!reply.processed && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-700">
                  <button
                    onClick={() => handleMarkProcessed(reply.id)}
                    disabled={actionLoading === reply.id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs text-white transition-colors"
                  >
                    {actionLoading === reply.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Mark Processed
                  </button>

                  {reply.classification === 'human_info' && (reply.extracted.business_name || reply.extracted.business_type) && (
                    <button
                      onClick={() => handleConvertToRep(reply.id)}
                      disabled={actionLoading === reply.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-700 hover:bg-blue-600 rounded text-xs text-white transition-colors"
                    >
                      <UserPlus className="w-3 h-3" />
                      Create Rep Profile
                    </button>
                  )}

                  {(reply.extracted.phone || reply.extracted.business_name) && (
                    <button
                      onClick={() => handleEnrichLead(reply.id)}
                      disabled={actionLoading === reply.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded text-xs text-white transition-colors"
                    >
                      <Building2 className="w-3 h-3" />
                      Enrich Lead
                    </button>
                  )}

                  <a
                    href={`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(reply.email)}&su=${encodeURIComponent('Re: ' + (reply.subject || ''))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs text-white transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Reply
                  </a>

                  {(reply.classification === 'bounce' || reply.classification === 'human_negative') && (
                    <button
                      onClick={() => handleSuppress(reply.id, reply.email)}
                      disabled={actionLoading === reply.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-800 hover:bg-red-700 rounded text-xs text-white transition-colors"
                    >
                      <Ban className="w-3 h-3" />
                      Suppress
                    </button>
                  )}
                </div>
              )}

              {/* Rep Profile Link */}
              {reply.rep_profile_id && (
                <div className="mt-2 text-xs text-green-400">
                  Converted to rep profile: {reply.rep_profile_id}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmailResponses;
