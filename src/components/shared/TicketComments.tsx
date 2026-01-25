import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Lock, MessageSquare, User, Shield, Users } from 'lucide-react';

interface Comment {
  id: string;
  ticket_id: string;
  author_type: 'admin' | 'rep' | 'client' | 'system';
  author_name: string;
  content: string;
  visibility: 'all' | 'internal' | 'client';
  is_resolution_note?: number;
  created_at: number;
}

interface TicketCommentsProps {
  ticketId: string;
  apiBase: string; // e.g. '/api/admin/tickets', '/api/portal/slug/tickets', '/api/rep/slug/tickets'
  userRole: 'admin' | 'rep' | 'client';
  showVisibilityToggle?: boolean; // Admin/rep can toggle internal vs client-visible
}

const AUTHOR_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  admin: { icon: <Shield className="w-3.5 h-3.5" />, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  rep: { icon: <Users className="w-3.5 h-3.5" />, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  client: { icon: <User className="w-3.5 h-3.5" />, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
  system: { icon: <MessageSquare className="w-3.5 h-3.5" />, color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/20' }
};

export default function TicketComments({ ticketId, apiBase, userRole, showVisibilityToggle = false }: TicketCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [visibility, setVisibility] = useState<'all' | 'internal'>('all');
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadComments();
  }, [ticketId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments]);

  async function loadComments() {
    try {
      setLoading(true);
      const res = await fetch(`${apiBase}/${ticketId}/comments`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setComments(data.data || []);
      }
    } catch (e) {
      setError('Failed to load comments');
    } finally {
      setLoading(false);
    }
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    try {
      setSubmitting(true);
      setError('');
      const res = await fetch(`${apiBase}/${ticketId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content: newComment.trim(),
          visibility: showVisibilityToggle ? visibility : 'all'
        })
      });
      const data = await res.json();
      if (data.success) {
        setComments(prev => [...prev, data.data]);
        setNewComment('');
      } else {
        setError(data.error || 'Failed to post comment');
      }
    } catch (e) {
      setError('Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  }

  function formatTime(ts: number) {
    const d = new Date(ts * 1000);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        Loading conversation...
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-gray-400" />
        <p className="text-xs text-gray-500 uppercase tracking-wide">
          Conversation ({comments.length})
        </p>
      </div>

      {/* Comments Thread */}
      <div
        ref={scrollRef}
        className="max-h-64 overflow-y-auto space-y-3 mb-3 pr-1 scrollbar-thin scrollbar-thumb-gray-700"
      >
        {comments.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-4">No messages yet. Start the conversation below.</p>
        ) : (
          comments.map(comment => {
            const config = AUTHOR_CONFIG[comment.author_type] || AUTHOR_CONFIG.system;
            const isInternal = comment.visibility === 'internal';
            return (
              <div
                key={comment.id}
                className={`p-3 rounded-lg border ${isInternal ? 'bg-yellow-500/5 border-yellow-500/20' : config.bg} ${
                  comment.author_type === userRole ? 'ml-6' : 'mr-6'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className={config.color}>{config.icon}</span>
                    <span className={`text-xs font-medium ${config.color}`}>
                      {comment.author_type === userRole ? 'You' : comment.author_name}
                    </span>
                    {isInternal && (
                      <span className="flex items-center gap-0.5 text-yellow-500 text-[10px] bg-yellow-500/10 px-1.5 py-0.5 rounded">
                        <Lock className="w-2.5 h-2.5" />
                        Internal
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-600">{formatTime(comment.created_at)}</span>
                </div>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{comment.content}</p>
              </div>
            );
          })
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-400 mb-2">{error}</p>
      )}

      {/* Reply Form */}
      <form onSubmit={submitComment} className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder={showVisibilityToggle && visibility === 'internal' ? 'Internal note (hidden from client)...' : 'Type a reply...'}
            className={`w-full bg-gray-900 border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 ${
              showVisibilityToggle && visibility === 'internal'
                ? 'border-yellow-500/30 focus:ring-yellow-500/50'
                : 'border-gray-700 focus:ring-green-500/50'
            }`}
            disabled={submitting}
          />
        </div>
        {showVisibilityToggle && (
          <button
            type="button"
            onClick={() => setVisibility(v => v === 'all' ? 'internal' : 'all')}
            className={`px-2 py-2 rounded-lg text-xs border transition-colors ${
              visibility === 'internal'
                ? 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10'
                : 'border-gray-700 text-gray-500 hover:text-gray-300'
            }`}
            title={visibility === 'internal' ? 'Internal note' : 'Visible to client'}
          >
            <Lock className="w-4 h-4" />
          </button>
        )}
        <button
          type="submit"
          disabled={!newComment.trim() || submitting}
          className="px-3 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
}
