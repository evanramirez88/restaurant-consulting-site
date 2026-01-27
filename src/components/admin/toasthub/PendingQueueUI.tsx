import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Inbox, CheckCircle, XCircle, Eye, EyeOff, Globe, Users, Briefcase,
  Loader2, RefreshCw, ChevronRight, ExternalLink, Edit3, X,
  FileText, Clock, CheckSquare, Square, ArrowUpRight, Sparkles,
  Rss, MessageCircle, BookOpen, TrendingUp, Quote, Lightbulb,
  Calendar, User, Link2, Zap
} from 'lucide-react';

interface Import {
  id: string;
  source_id: string | null;
  source_name: string | null;
  source_type: string | null;
  external_id: string | null;
  external_url: string | null;
  title: string;
  excerpt: string | null;
  content_body: string | null;
  author: string | null;
  published_at: number | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: number | null;
  visible_public: number;
  visible_client_portal: number;
  visible_rep_portal: number;
  post_id: string | null;
  tldr_summary: string | null;
  expert_commentary: string | null;
  ai_score: number | null;
  created_at: number;
}

interface Counts {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

interface PendingQueueUIProps {
  onEditImport?: (importItem: Import) => void;
}

// Strip HTML tags for plain text display
const stripHtml = (html: string): string => {
  if (!html) return '';
  return html
    // Remove HTML comments (like Reddit's SC_OFF/SC_ON)
    .replace(/<!--[\s\S]*?-->/g, '')
    // Remove script and style blocks entirely
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Decode numeric HTML entities
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([a-fA-F0-9]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    // Decode common named HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '...')
    .replace(/&bull;/g, '•')
    .replace(/&copy;/g, '©')
    .replace(/&reg;/g, '®')
    .replace(/&trade;/g, '™')
    // Remove "submitted by /u/username" and Reddit link patterns
    .replace(/submitted by\s*<a[^>]*>.*?<\/a>/gi, '')
    .replace(/\[link\]/gi, '')
    .replace(/\[comments\]/gi, '')
    // Remove all HTML tags
    .replace(/<[^>]*>/g, ' ')
    // Clean up whitespace
    .replace(/\s+/g, ' ')
    .trim();
};

// Convert HTML content to styled HTML for display
const renderHtmlContent = (html: string): string => {
  if (!html) return '';

  // Check if content is already HTML (has tags)
  const hasHtmlTags = /<[a-z][\s\S]*>/i.test(html);

  if (hasHtmlTags) {
    // It's HTML - style the existing tags
    return html
      // Style headings
      .replace(/<h1([^>]*)>/gi, '<h1 class="text-2xl font-bold text-white mt-8 mb-4"$1>')
      .replace(/<h2([^>]*)>/gi, '<h2 class="text-xl font-bold text-white mt-8 mb-4"$1>')
      .replace(/<h3([^>]*)>/gi, '<h3 class="text-lg font-semibold text-white mt-6 mb-3"$1>')
      .replace(/<h4([^>]*)>/gi, '<h4 class="text-base font-semibold text-white mt-4 mb-2"$1>')
      // Style paragraphs
      .replace(/<p([^>]*)>/gi, '<p class="text-zinc-300 mb-4 leading-relaxed"$1>')
      // Style lists
      .replace(/<ul([^>]*)>/gi, '<ul class="my-4 space-y-2 list-disc list-inside text-zinc-300"$1>')
      .replace(/<ol([^>]*)>/gi, '<ol class="my-4 space-y-2 list-decimal list-inside text-zinc-300"$1>')
      .replace(/<li([^>]*)>/gi, '<li class="text-zinc-300"$1>')
      // Style links
      .replace(/<a([^>]*)>/gi, '<a class="text-amber-400 hover:text-amber-300 underline"$1 target="_blank" rel="noopener">')
      // Style blockquotes
      .replace(/<blockquote([^>]*)>/gi, '<blockquote class="border-l-4 border-amber-500 pl-4 py-2 my-4 bg-zinc-800/50 rounded-r text-zinc-300 italic"$1>')
      // Style code
      .replace(/<code([^>]*)>/gi, '<code class="bg-zinc-800 text-amber-400 px-1.5 py-0.5 rounded text-sm font-mono"$1>')
      .replace(/<pre([^>]*)>/gi, '<pre class="bg-zinc-950 border border-zinc-800 rounded-lg p-4 my-4 overflow-x-auto"$1>')
      // Style strong/em
      .replace(/<strong([^>]*)>/gi, '<strong class="font-semibold text-white"$1>')
      .replace(/<b([^>]*)>/gi, '<strong class="font-semibold text-white"$1>')
      .replace(/<em([^>]*)>/gi, '<em class="text-zinc-300 italic"$1>')
      .replace(/<i([^>]*)>/gi, '<em class="text-zinc-300 italic"$1>')
      // Style images
      .replace(/<img([^>]*)>/gi, '<img class="rounded-lg max-w-full h-auto my-4"$1>')
      // Add line breaks
      .replace(/<br\s*\/?>/gi, '<br class="my-2">');
  }

  // It's markdown or plain text - convert to HTML
  return html
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-white mt-6 mb-3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-white mt-8 mb-4">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-white mt-8 mb-4">$1</h1>')
    // Bold and italic
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-zinc-300 italic">$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-amber-400 hover:text-amber-300 underline">$1</a>')
    // Blockquotes
    .replace(/^>\s*(.+)$/gm, '<blockquote class="border-l-4 border-amber-500 pl-4 py-2 my-4 bg-zinc-800/50 rounded-r"><p class="text-zinc-300 italic">$1</p></blockquote>')
    // Bullet lists
    .replace(/^[-*]\s+(.+)$/gm, '<li class="flex items-start gap-2 mb-2"><span class="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 flex-shrink-0"></span><span class="text-zinc-300">$1</span></li>')
    // Numbered lists
    .replace(/^(\d+)\.\s+(.+)$/gm, '<li class="flex items-start gap-2 mb-2"><span class="text-amber-400 font-medium min-w-[1.5rem]">$1.</span><span class="text-zinc-300">$2</span></li>')
    // Code blocks
    .replace(/```([\s\S]*?)```/g, '<pre class="bg-zinc-950 border border-zinc-800 rounded-lg p-4 my-4 overflow-x-auto"><code class="text-sm text-zinc-300 font-mono">$1</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-zinc-800 text-amber-400 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
    // Line breaks to paragraphs
    .replace(/\n\n+/g, '</p><p class="text-zinc-300 mb-4 leading-relaxed">')
    // Wrap in paragraph
    .replace(/^(.+)$/gm, (match) => {
      if (match.startsWith('<')) return match;
      return `<p class="text-zinc-300 mb-4 leading-relaxed">${match}</p>`;
    })
    // Clean up empty paragraphs
    .replace(/<p class="[^"]*"><\/p>/g, '')
    // Wrap lists
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul class="my-4 space-y-1">$&</ul>');
};

// Estimate reading time
const estimateReadTime = (text: string | null): number => {
  if (!text) return 1;
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
};

const PendingQueueUI: React.FC<PendingQueueUIProps> = ({ onEditImport }) => {
  const [imports, setImports] = useState<Import[]>([]);
  const [counts, setCounts] = useState<Counts>({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedItem, setExpandedItem] = useState<Import | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const loadImports = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus && filterStatus !== 'all') {
        params.set('status', filterStatus);
      }
      params.set('limit', '50');

      const response = await fetch(`/api/admin/toast-hub/imports?${params}`, {
        credentials: 'include'
      });
      const result = await response.json();

      if (result.success) {
        setImports(result.data || []);
        setCounts(result.counts || { total: 0, pending: 0, approved: 0, rejected: 0 });
      }
    } catch (error) {
      console.error('Failed to load imports:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    loadImports();
  }, [loadImports]);

  // Close expanded view on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpandedItem(null);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  const updateImportStatus = async (id: string, status: 'approved' | 'rejected') => {
    setProcessingIds(prev => new Set(prev).add(id));
    try {
      const response = await fetch(`/api/admin/toast-hub/imports/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status })
      });
      const result = await response.json();
      if (result.success) {
        setImports(prev => prev.map(i => i.id === id ? { ...i, status } : i));
        if (expandedItem?.id === id) {
          setExpandedItem(prev => prev ? { ...prev, status } : null);
        }
        setCounts(prev => ({
          ...prev,
          pending: Math.max(0, prev.pending - (status === 'approved' || status === 'rejected' ? 1 : 0)),
          [status]: prev[status] + 1
        }));
      }
    } catch (error) {
      console.error('Failed to update import:', error);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const updateVisibility = async (id: string, field: string, value: boolean) => {
    setProcessingIds(prev => new Set(prev).add(id));
    try {
      const response = await fetch(`/api/admin/toast-hub/imports/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [field]: value ? 1 : 0 })
      });
      const result = await response.json();
      if (result.success) {
        setImports(prev => prev.map(i => i.id === id ? { ...i, [field]: value ? 1 : 0 } : i));
        if (expandedItem?.id === id) {
          setExpandedItem(prev => prev ? { ...prev, [field]: value ? 1 : 0 } : null);
        }
      }
    } catch (error) {
      console.error('Failed to update visibility:', error);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const promoteToPost = async (id: string) => {
    if (!confirm('Promote this import to a published post?')) return;
    setProcessingIds(prev => new Set(prev).add(id));
    try {
      const response = await fetch(`/api/admin/toast-hub/imports/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'promote' })
      });
      const result = await response.json();
      if (result.success) {
        setExpandedItem(null);
        loadImports();
      } else {
        alert(result.error || 'Failed to promote');
      }
    } catch (error) {
      console.error('Failed to promote:', error);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const bulkUpdateStatus = async (status: 'approved' | 'rejected') => {
    if (selectedIds.size === 0) return;
    if (!confirm(`${status === 'approved' ? 'Approve' : 'Reject'} ${selectedIds.size} selected items?`)) return;

    try {
      const response = await fetch('/api/admin/toast-hub/imports', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'bulk_status',
          ids: Array.from(selectedIds),
          status
        })
      });
      const result = await response.json();
      if (result.success) {
        setSelectedIds(new Set());
        loadImports();
      }
    } catch (error) {
      console.error('Failed to bulk update:', error);
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === imports.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(imports.map(i => i.id)));
    }
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatFullDate = (timestamp: number | null) => {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getSourceIcon = (type: string | null) => {
    switch (type) {
      case 'rss': return Rss;
      case 'reddit': return MessageCircle;
      case 'manual': return Edit3;
      case 'data_context': return BookOpen;
      default: return FileText;
    }
  };

  const getSourceColor = (type: string | null) => {
    switch (type) {
      case 'rss': return 'from-orange-500 to-amber-600';
      case 'reddit': return 'from-red-500 to-orange-600';
      case 'manual': return 'from-blue-500 to-indigo-600';
      case 'data_context': return 'from-purple-500 to-pink-600';
      default: return 'from-zinc-500 to-zinc-600';
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'approved':
        return { bg: 'bg-emerald-500/20', border: 'border-emerald-500/50', text: 'text-emerald-400', icon: CheckCircle };
      case 'rejected':
        return { bg: 'bg-red-500/20', border: 'border-red-500/50', text: 'text-red-400', icon: XCircle };
      default:
        return { bg: 'bg-amber-500/20', border: 'border-amber-500/50', text: 'text-amber-400', icon: Clock };
    }
  };

  // Rendered HTML/markdown content for expanded view
  const renderedContent = useMemo(() => {
    if (!expandedItem?.content_body) return '';
    return renderHtmlContent(expandedItem.content_body);
  }, [expandedItem?.content_body]);

  return (
    <div className="relative">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { key: 'all', label: 'Total', count: counts.total, color: 'from-zinc-600 to-zinc-700', textColor: 'text-white' },
          { key: 'pending', label: 'Pending Review', count: counts.pending, color: 'from-amber-500 to-orange-600', textColor: 'text-amber-400' },
          { key: 'approved', label: 'Approved', count: counts.approved, color: 'from-emerald-500 to-teal-600', textColor: 'text-emerald-400' },
          { key: 'rejected', label: 'Rejected', count: counts.rejected, color: 'from-red-500 to-rose-600', textColor: 'text-red-400' },
        ].map((stat) => (
          <button
            key={stat.key}
            onClick={() => setFilterStatus(stat.key)}
            className={`relative overflow-hidden rounded-xl p-5 transition-all duration-300 ${
              filterStatus === stat.key
                ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-zinc-900 scale-[1.02]'
                : 'hover:scale-[1.01]'
            }`}
          >
            {/* Background gradient */}
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-20`} />
            <div className="absolute inset-0 bg-zinc-900/60" />

            {/* Content */}
            <div className="relative">
              <div className={`text-4xl font-bold ${stat.textColor} mb-1`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {stat.count}
              </div>
              <div className="text-sm text-zinc-400 font-medium">{stat.label}</div>
            </div>

            {/* Active indicator */}
            {filterStatus === stat.key && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-600" />
            )}
          </button>
        ))}
      </div>

      {/* Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={selectAll}
            className="flex items-center gap-2 px-4 py-2.5 text-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors"
          >
            {selectedIds.size === imports.length && imports.length > 0 ? (
              <CheckSquare size={16} className="text-amber-400" />
            ) : (
              <Square size={16} className="text-zinc-400" />
            )}
            <span className="text-zinc-300">Select All</span>
          </button>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 animate-in slide-in-from-left-4">
              <button
                onClick={() => bulkUpdateStatus('approved')}
                className="flex items-center gap-2 px-4 py-2.5 text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors shadow-lg shadow-emerald-500/20"
              >
                <CheckCircle size={16} />
                Approve ({selectedIds.size})
              </button>
              <button
                onClick={() => bulkUpdateStatus('rejected')}
                className="flex items-center gap-2 px-4 py-2.5 text-sm bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors shadow-lg shadow-red-500/20"
              >
                <XCircle size={16} />
                Reject ({selectedIds.size})
              </button>
            </div>
          )}
        </div>

        <button
          onClick={loadImports}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2.5 text-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors"
        >
          <RefreshCw size={16} className={`text-zinc-400 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="text-zinc-300">Refresh</span>
        </button>
      </div>

      {/* Import Cards Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 border-2 border-zinc-800 rounded-full" />
              <div className="absolute inset-0 border-2 border-amber-500 rounded-full border-t-transparent animate-spin" />
            </div>
            <p className="text-zinc-400">Loading content...</p>
          </div>
        </div>
      ) : imports.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
            <Inbox className="w-10 h-10 text-zinc-600" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No Content Found</h3>
          <p className="text-zinc-500">
            {filterStatus === 'pending' ? 'All caught up! No pending items to review.' : `No ${filterStatus} items.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {imports.map((item) => {
            const SourceIcon = getSourceIcon(item.source_type);
            const sourceColor = getSourceColor(item.source_type);
            const statusConfig = getStatusConfig(item.status);
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={item.id}
                onClick={() => setExpandedItem(item)}
                className={`group relative bg-zinc-900/80 border rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-amber-500/10 ${
                  selectedIds.has(item.id)
                    ? 'border-amber-500 ring-1 ring-amber-500/50'
                    : 'border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {/* Gradient accent bar */}
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${sourceColor} opacity-80`} />

                {/* Selection checkbox */}
                <button
                  onClick={(e) => toggleSelect(item.id, e)}
                  className="absolute top-4 right-4 z-10 p-1.5 rounded-lg bg-zinc-800/80 backdrop-blur border border-zinc-700 hover:border-amber-500 transition-colors"
                >
                  {selectedIds.has(item.id) ? (
                    <CheckSquare size={16} className="text-amber-400" />
                  ) : (
                    <Square size={16} className="text-zinc-500" />
                  )}
                </button>

                <div className="p-5">
                  {/* Header with source and status */}
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${sourceColor} flex items-center justify-center`}>
                      <SourceIcon size={14} className="text-white" />
                    </div>
                    <span className="text-sm text-zinc-400 font-medium truncate flex-1">
                      {item.source_name || item.source_type || 'Unknown'}
                    </span>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${statusConfig.bg} border ${statusConfig.border}`}>
                      <StatusIcon size={12} className={statusConfig.text} />
                      <span className={`text-xs font-medium ${statusConfig.text} capitalize`}>{item.status}</span>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-semibold text-white mb-2 line-clamp-2 group-hover:text-amber-400 transition-colors">
                    {item.title}
                  </h3>

                  {/* Excerpt preview - strip HTML for clean display */}
                  {(item.excerpt || item.content_body) && (
                    <p className="text-sm text-zinc-400 line-clamp-3 mb-4">
                      {stripHtml(item.excerpt || item.content_body || '').slice(0, 200)}
                      {(item.excerpt || item.content_body || '').length > 200 ? '...' : ''}
                    </p>
                  )}

                  {/* Meta info */}
                  <div className="flex items-center gap-4 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {formatDate(item.published_at || item.created_at)}
                    </span>
                    {item.ai_score && (
                      <span className="flex items-center gap-1">
                        <Sparkles size={12} className="text-amber-400" />
                        <span className="text-amber-400">{Math.round(item.ai_score)}</span>
                      </span>
                    )}
                    {item.post_id && (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle size={12} />
                        Published
                      </span>
                    )}
                  </div>

                  {/* Quick visibility indicators */}
                  {item.status === 'approved' && (
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-zinc-800">
                      <div className={`px-2 py-1 rounded text-xs ${item.visible_public ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-800 text-zinc-600'}`}>
                        <Globe size={10} className="inline mr-1" />Public
                      </div>
                      <div className={`px-2 py-1 rounded text-xs ${item.visible_client_portal ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-600'}`}>
                        <Users size={10} className="inline mr-1" />Client
                      </div>
                      <div className={`px-2 py-1 rounded text-xs ${item.visible_rep_portal ? 'bg-purple-500/20 text-purple-400' : 'bg-zinc-800 text-zinc-600'}`}>
                        <Briefcase size={10} className="inline mr-1" />Rep
                      </div>
                    </div>
                  )}
                </div>

                {/* Hover indicator */}
                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-1 text-xs text-amber-400">
                    <span>View</span>
                    <ChevronRight size={14} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full-Screen Expanded View */}
      {expandedItem && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setExpandedItem(null)}
          />

          {/* Content Panel */}
          <div className="relative w-full max-w-5xl mx-4 my-8 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header gradient bar */}
            <div className={`h-2 bg-gradient-to-r ${getSourceColor(expandedItem.source_type)}`} />

            {/* Close button */}
            <button
              onClick={() => setExpandedItem(null)}
              className="absolute top-6 right-6 z-10 p-2.5 rounded-xl bg-zinc-800/80 backdrop-blur border border-zinc-700 hover:border-amber-500 hover:bg-zinc-700 transition-all"
            >
              <X size={20} className="text-zinc-400" />
            </button>

            {/* Header Section */}
            <div className="p-8 pb-6 border-b border-zinc-800">
              <div className="flex items-center gap-3 mb-4">
                {/* Source badge */}
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r ${getSourceColor(expandedItem.source_type)}`}>
                  {React.createElement(getSourceIcon(expandedItem.source_type), { size: 14, className: 'text-white' })}
                  <span className="text-sm font-medium text-white">
                    {expandedItem.source_name || expandedItem.source_type}
                  </span>
                </div>

                {/* Status badge */}
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${getStatusConfig(expandedItem.status).bg} border ${getStatusConfig(expandedItem.status).border}`}>
                  {React.createElement(getStatusConfig(expandedItem.status).icon, { size: 14, className: getStatusConfig(expandedItem.status).text })}
                  <span className={`text-sm font-medium ${getStatusConfig(expandedItem.status).text} capitalize`}>
                    {expandedItem.status}
                  </span>
                </div>

                {expandedItem.ai_score && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/50">
                    <Sparkles size={14} className="text-amber-400" />
                    <span className="text-sm font-medium text-amber-400">Score: {Math.round(expandedItem.ai_score)}</span>
                  </div>
                )}

                {expandedItem.post_id && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/50">
                    <CheckCircle size={14} className="text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-400">Published</span>
                  </div>
                )}
              </div>

              {/* Title */}
              <h1 className="text-3xl font-bold text-white mb-4 pr-12" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                {expandedItem.title}
              </h1>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-6 text-sm text-zinc-400">
                {expandedItem.author && (
                  <span className="flex items-center gap-2">
                    <User size={14} />
                    {expandedItem.author}
                  </span>
                )}
                <span className="flex items-center gap-2">
                  <Calendar size={14} />
                  {formatFullDate(expandedItem.published_at || expandedItem.created_at)}
                </span>
                <span className="flex items-center gap-2">
                  <Clock size={14} />
                  {estimateReadTime(expandedItem.content_body)} min read
                </span>
                {expandedItem.external_url && (
                  <a
                    href={expandedItem.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    <Link2 size={14} />
                    View Original
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </div>

            {/* Content Area with Split Layout */}
            <div className="flex">
              {/* Main Content */}
              <div className="flex-1 p-8 overflow-y-auto max-h-[60vh]">
                {/* TL;DR Block */}
                {expandedItem.excerpt && (
                  <div className="mb-8 p-6 bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 rounded-xl">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb size={18} className="text-amber-400" />
                      <span className="text-amber-400 font-semibold text-sm uppercase tracking-wider">Summary</span>
                    </div>
                    <p className="text-lg text-zinc-200 leading-relaxed">
                      {stripHtml(expandedItem.excerpt)}
                    </p>
                  </div>
                )}

                {/* Expert Commentary */}
                {expandedItem.expert_commentary && (
                  <div className="mb-8 p-6 bg-zinc-800/50 border border-zinc-700 rounded-xl">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                        <Quote size={16} className="text-white" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold">Expert Commentary</h3>
                        <p className="text-zinc-500 text-sm">Analysis from R&G Consulting</p>
                      </div>
                    </div>
                    <p className="text-zinc-300 italic leading-relaxed pl-13">
                      "{expandedItem.expert_commentary}"
                    </p>
                  </div>
                )}

                {/* Main Content Body */}
                {expandedItem.content_body && (
                  <div className="prose-custom">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <FileText size={18} className="text-zinc-400" />
                      Full Content
                    </h3>
                    <div
                      className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-6"
                      dangerouslySetInnerHTML={{ __html: renderedContent }}
                    />
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <div className="w-80 border-l border-zinc-800 p-6 bg-zinc-950/50">
                {/* Actions Section */}
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Actions</h3>

                  {expandedItem.status === 'pending' && (
                    <div className="space-y-3">
                      <button
                        onClick={() => updateImportStatus(expandedItem.id, 'approved')}
                        disabled={processingIds.has(expandedItem.id)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                      >
                        {processingIds.has(expandedItem.id) ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <CheckCircle size={18} />
                        )}
                        Approve Content
                      </button>
                      <button
                        onClick={() => updateImportStatus(expandedItem.id, 'rejected')}
                        disabled={processingIds.has(expandedItem.id)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-red-600 border border-zinc-700 hover:border-red-500 text-zinc-300 hover:text-white font-semibold rounded-xl transition-all"
                      >
                        <XCircle size={18} />
                        Reject Content
                      </button>
                    </div>
                  )}

                  {expandedItem.status === 'approved' && !expandedItem.post_id && (
                    <button
                      onClick={() => promoteToPost(expandedItem.id)}
                      disabled={processingIds.has(expandedItem.id)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-amber-500/25"
                    >
                      {processingIds.has(expandedItem.id) ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <ArrowUpRight size={18} />
                      )}
                      Promote to Article
                    </button>
                  )}

                  {expandedItem.post_id && (
                    <div className="text-center py-4">
                      <CheckCircle size={24} className="text-emerald-400 mx-auto mb-2" />
                      <p className="text-emerald-400 font-medium">Already Published</p>
                    </div>
                  )}
                </div>

                {/* Visibility Controls */}
                {expandedItem.status === 'approved' && (
                  <div className="mb-8">
                    <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Visibility</h3>
                    <div className="space-y-3">
                      {[
                        { field: 'visible_public', label: 'Public Website', icon: Globe, color: 'blue', value: expandedItem.visible_public },
                        { field: 'visible_client_portal', label: 'Client Portal', icon: Users, color: 'emerald', value: expandedItem.visible_client_portal },
                        { field: 'visible_rep_portal', label: 'Rep Portal', icon: Briefcase, color: 'purple', value: expandedItem.visible_rep_portal },
                      ].map(({ field, label, icon: Icon, color, value }) => (
                        <button
                          key={field}
                          onClick={() => updateVisibility(expandedItem.id, field, !value)}
                          disabled={processingIds.has(expandedItem.id)}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                            value
                              ? `bg-${color}-500/20 border-${color}-500/50 text-${color}-400`
                              : 'bg-zinc-800/50 border-zinc-700 text-zinc-500 hover:border-zinc-600'
                          }`}
                          style={{
                            backgroundColor: value ? `rgb(var(--${color}-500) / 0.2)` : undefined,
                            borderColor: value ? `rgb(var(--${color}-500) / 0.5)` : undefined,
                          }}
                        >
                          <span className="flex items-center gap-2">
                            <Icon size={16} />
                            {label}
                          </span>
                          {value ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-zinc-600 mt-3">
                      Toggle where this content appears
                    </p>
                  </div>
                )}

                {/* Quick Stats */}
                <div>
                  <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Details</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between py-2 border-b border-zinc-800">
                      <span className="text-zinc-500">Import ID</span>
                      <span className="text-zinc-300 font-mono text-xs">{expandedItem.id.slice(0, 12)}...</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-zinc-800">
                      <span className="text-zinc-500">Created</span>
                      <span className="text-zinc-300">{formatDate(expandedItem.created_at)}</span>
                    </div>
                    {expandedItem.reviewed_at && (
                      <div className="flex items-center justify-between py-2 border-b border-zinc-800">
                        <span className="text-zinc-500">Reviewed</span>
                        <span className="text-zinc-300">{formatDate(expandedItem.reviewed_at)}</span>
                      </div>
                    )}
                    {expandedItem.external_id && (
                      <div className="flex items-center justify-between py-2 border-b border-zinc-800">
                        <span className="text-zinc-500">External ID</span>
                        <span className="text-zinc-300 font-mono text-xs truncate max-w-[120px]">{expandedItem.external_id}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        .animate-in {
          animation: animateIn 0.2s ease-out forwards;
        }

        @keyframes animateIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .prose-custom h1,
        .prose-custom h2,
        .prose-custom h3 {
          font-family: 'Playfair Display', Georgia, serif;
        }

        .prose-custom a:hover {
          text-decoration: none;
        }

        /* Custom scrollbar for content area */
        .overflow-y-auto::-webkit-scrollbar {
          width: 8px;
        }

        .overflow-y-auto::-webkit-scrollbar-track {
          background: #18181b;
          border-radius: 4px;
        }

        .overflow-y-auto::-webkit-scrollbar-thumb {
          background: #3f3f46;
          border-radius: 4px;
        }

        .overflow-y-auto::-webkit-scrollbar-thumb:hover {
          background: #52525b;
        }
      `}</style>
    </div>
  );
};

export default PendingQueueUI;
