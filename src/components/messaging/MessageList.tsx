import React, { useState, useEffect } from 'react';
import {
  Search, Plus, MessageSquare, Clock, AlertCircle, CheckCircle,
  Archive, Loader2, RefreshCw, Filter, ChevronRight, Lock,
  Building2, User, Shield
} from 'lucide-react';
import { Thread } from './MessageThread';

interface MessageListProps {
  viewerType: 'admin' | 'client' | 'rep';
  viewerId: string;
  onSelectThread: (thread: Thread) => void;
  onCreateThread?: () => void;
  selectedThreadId?: string;
}

const MessageList: React.FC<MessageListProps> = ({
  viewerType,
  viewerId,
  onSelectThread,
  onCreateThread,
  selectedThreadId
}) => {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadThreads();
  }, [viewerType, viewerId]);

  const loadThreads = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/messages/threads?viewerType=${viewerType}&viewerId=${viewerId}`);
      const result = await response.json();
      if (result.success) {
        setThreads(result.data || []);
      }
    } catch (error) {
      console.error('Failed to load threads:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredThreads = threads.filter(thread => {
    const matchesSearch =
      thread.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      thread.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      thread.client_company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      thread.rep_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = filterStatus === 'all' || thread.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || thread.priority === filterPriority;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getStatusIcon = (status: Thread['status']) => {
    switch (status) {
      case 'open':
        return <AlertCircle className="w-4 h-4 text-blue-400" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-amber-400" />;
      case 'resolved':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'closed':
        return <Archive className="w-4 h-4 text-gray-400" />;
      default:
        return null;
    }
  };

  const getPriorityColor = (priority: Thread['priority']) => {
    switch (priority) {
      case 'urgent':
        return 'border-l-red-500';
      case 'high':
        return 'border-l-amber-500';
      case 'normal':
        return 'border-l-blue-500';
      case 'low':
        return 'border-l-gray-500';
      default:
        return 'border-l-gray-600';
    }
  };

  const getThreadTypeIcon = (type: Thread['thread_type']) => {
    switch (type) {
      case 'private':
        return <Lock className="w-3 h-3 text-amber-400" />;
      case 'support':
        return <Shield className="w-3 h-3 text-green-400" />;
      default:
        return null;
    }
  };

  const getParticipantIcon = (thread: Thread) => {
    if (thread.client_id && thread.rep_id) {
      return <div className="flex -space-x-1">
        <Building2 className="w-4 h-4 text-blue-400" />
        <User className="w-4 h-4 text-green-400" />
      </div>;
    }
    if (thread.client_id) {
      return <Building2 className="w-4 h-4 text-blue-400" />;
    }
    if (thread.rep_id) {
      return <User className="w-4 h-4 text-green-400" />;
    }
    return null;
  };

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getThreadTitle = (thread: Thread) => {
    if (thread.title) return thread.title;
    if (viewerType === 'admin') {
      if (thread.client_company) return thread.client_company;
      if (thread.client_name) return thread.client_name;
      if (thread.rep_name) return thread.rep_name;
    }
    if (viewerType === 'client') {
      return 'Support Conversation';
    }
    if (viewerType === 'rep') {
      if (thread.client_company) return thread.client_company;
      if (thread.client_name) return thread.client_name;
      return 'Admin Conversation';
    }
    return 'Conversation';
  };

  const getThreadSubtitle = (thread: Thread) => {
    const parts: string[] = [];
    if (viewerType === 'admin') {
      if (thread.client_name && thread.client_company) {
        parts.push(thread.client_name);
      }
      if (thread.rep_name) {
        parts.push(`Rep: ${thread.rep_name}`);
      }
    }
    return parts.join(' | ') || thread.thread_type;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-amber-400" />
            Messages
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={loadThreads}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {onCreateThread && (
              <button
                onClick={onCreateThread}
                className="flex items-center gap-2 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-gray-900 font-medium rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New</span>
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded transition-colors ${
              showFilters || filterStatus !== 'all' || filterPriority !== 'all'
                ? 'text-amber-400 bg-amber-500/20'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="flex gap-2 mt-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="pending">Pending</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">All Priority</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </div>
        )}
      </div>

      {/* Thread count */}
      <div className="flex-shrink-0 px-4 py-2 bg-gray-800/50 text-xs text-gray-400">
        {filteredThreads.length} conversation{filteredThreads.length !== 1 ? 's' : ''}
        {(filterStatus !== 'all' || filterPriority !== 'all' || searchQuery) && (
          <span> (filtered from {threads.length})</span>
        )}
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto">
        {filteredThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <MessageSquare className="w-12 h-12 text-gray-600 mb-4" />
            <h3 className="text-white font-semibold mb-2">No Conversations</h3>
            <p className="text-gray-400 text-sm mb-4">
              {searchQuery || filterStatus !== 'all' || filterPriority !== 'all'
                ? 'Try adjusting your filters'
                : 'Start a new conversation to get in touch'}
            </p>
            {onCreateThread && !searchQuery && filterStatus === 'all' && filterPriority === 'all' && (
              <button
                onClick={onCreateThread}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-gray-900 font-medium rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Start Conversation
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {filteredThreads.map((thread) => (
              <div
                key={thread.id}
                onClick={() => onSelectThread(thread)}
                className={`p-4 cursor-pointer transition-colors border-l-4 ${getPriorityColor(thread.priority)} ${
                  selectedThreadId === thread.id
                    ? 'bg-gray-700/50'
                    : 'hover:bg-gray-800/50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getParticipantIcon(thread)}
                      <h3 className={`font-semibold truncate ${
                        thread.unread_count && thread.unread_count > 0
                          ? 'text-white'
                          : 'text-gray-200'
                      }`}>
                        {getThreadTitle(thread)}
                      </h3>
                      {getThreadTypeIcon(thread.thread_type)}
                      {thread.unread_count && thread.unread_count > 0 && (
                        <span className="flex-shrink-0 w-5 h-5 bg-amber-500 text-gray-900 text-xs font-bold rounded-full flex items-center justify-center">
                          {thread.unread_count > 9 ? '9+' : thread.unread_count}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 truncate">
                      {getThreadSubtitle(thread)}
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    <span className="text-xs text-gray-500">
                      {formatTime(thread.last_message_at || thread.created_at)}
                    </span>
                    <div className="flex items-center gap-1">
                      {getStatusIcon(thread.status)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageList;
