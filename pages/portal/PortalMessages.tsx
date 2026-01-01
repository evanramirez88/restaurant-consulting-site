import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Loader2,
  AlertTriangle,
  MessageSquare,
  Send,
  Plus,
  Search,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  Paperclip,
  X,
  ChevronRight
} from 'lucide-react';
import { useSEO } from '../../src/components/SEO';

// ============================================
// TYPE DEFINITIONS
// ============================================
interface MessageThread {
  id: string;
  title: string;
  thread_type: 'ticket' | 'project' | 'general' | 'support';
  status: 'open' | 'pending' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  last_message_at: number;
  created_at: number;
  unread_count: number;
}

interface Message {
  id: string;
  thread_id: string;
  sender_type: 'admin' | 'client' | 'system';
  sender_id: string | null;
  sender_name?: string;
  body: string;
  attachments_json: string | null;
  read_at: number | null;
  created_at: number;
}

interface Attachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

// ============================================
// PORTAL MESSAGES PAGE
// ============================================
const PortalMessages: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);

  // New message state
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showNewThreadModal, setShowNewThreadModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // New thread form
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [newThreadType, setNewThreadType] = useState<'general' | 'support'>('support');
  const [newThreadMessage, setNewThreadMessage] = useState('');
  const [newThreadPriority, setNewThreadPriority] = useState<'low' | 'normal' | 'high'>('normal');

  useSEO({
    title: 'Messages | Client Portal',
    description: 'Communicate with your support team.',
  });

  // Load threads
  useEffect(() => {
    const loadThreads = async () => {
      if (!slug) return;

      try {
        const response = await fetch(`/api/portal/${slug}/messages`);
        const data = await response.json();

        if (data.success) {
          setThreads(data.data || []);
          // Auto-select first thread if available
          if (data.data && data.data.length > 0 && !selectedThread) {
            setSelectedThread(data.data[0]);
          }
        } else {
          setError(data.error || 'Failed to load messages');
        }
      } catch (err) {
        console.error('Messages load error:', err);
        setError('Failed to load messages');
      } finally {
        setIsLoading(false);
      }
    };

    loadThreads();
  }, [slug]);

  // Load messages for selected thread
  useEffect(() => {
    const loadMessages = async () => {
      if (!slug || !selectedThread) return;

      try {
        const response = await fetch(`/api/portal/${slug}/messages/${selectedThread.id}`);
        const data = await response.json();

        if (data.success) {
          setMessages(data.data || []);
          // Scroll to bottom
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }
      } catch (err) {
        console.error('Messages load error:', err);
      }
    };

    loadMessages();
  }, [slug, selectedThread]);

  // Utility functions
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved':
      case 'closed':
        return 'text-green-400 bg-green-400/10';
      case 'pending':
        return 'text-amber-400 bg-amber-400/10';
      case 'open':
        return 'text-blue-400 bg-blue-400/10';
      default:
        return 'text-gray-400 bg-gray-400/10';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'text-red-400';
      case 'high':
        return 'text-orange-400';
      case 'normal':
        return 'text-gray-400';
      case 'low':
        return 'text-gray-500';
      default:
        return 'text-gray-400';
    }
  };

  const parseAttachments = (json: string | null): Attachment[] => {
    if (!json) return [];
    try {
      return JSON.parse(json);
    } catch {
      return [];
    }
  };

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedThread || !slug) return;

    setIsSending(true);
    try {
      const response = await fetch(`/api/portal/${slug}/messages/${selectedThread.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: newMessage })
      });

      const data = await response.json();

      if (data.success) {
        setMessages([...messages, data.data]);
        setNewMessage('');
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (err) {
      console.error('Send message error:', err);
    } finally {
      setIsSending(false);
    }
  };

  // Create new thread
  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newThreadTitle.trim() || !newThreadMessage.trim() || !slug) return;

    setIsSending(true);
    try {
      const response = await fetch(`/api/portal/${slug}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newThreadTitle,
          thread_type: newThreadType,
          priority: newThreadPriority,
          body: newThreadMessage
        })
      });

      const data = await response.json();

      if (data.success) {
        setThreads([data.data, ...threads]);
        setSelectedThread(data.data);
        setShowNewThreadModal(false);
        setNewThreadTitle('');
        setNewThreadMessage('');
        setNewThreadType('support');
        setNewThreadPriority('normal');
      }
    } catch (err) {
      console.error('Create thread error:', err);
    } finally {
      setIsSending(false);
    }
  };

  // Filter threads
  const filteredThreads = threads.filter(thread =>
    thread.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <h2 className="text-xl font-bold text-white mb-2">Error Loading Messages</h2>
        <p className="text-gray-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-200px)] min-h-[500px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Messages</h1>
          <p className="text-gray-400">Communicate with your support team</p>
        </div>
        <button
          onClick={() => setShowNewThreadModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors"
        >
          <Plus className="w-5 h-5" />
          New Message
        </button>
      </div>

      {/* Messages Container */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Thread List */}
        <div className="w-80 flex-shrink-0 admin-card flex flex-col overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-9 pr-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Thread List */}
          <div className="flex-1 overflow-y-auto">
            {filteredThreads.length === 0 ? (
              <div className="p-6 text-center">
                <MessageSquare className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No conversations</p>
              </div>
            ) : (
              filteredThreads.map((thread) => (
                <button
                  key={thread.id}
                  onClick={() => setSelectedThread(thread)}
                  className={`w-full text-left p-4 border-b border-gray-700/50 hover:bg-gray-800/30 transition-colors ${
                    selectedThread?.id === thread.id ? 'bg-amber-500/10 border-l-2 border-l-amber-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="text-sm font-medium text-white truncate">{thread.title}</h4>
                    {thread.unread_count > 0 && (
                      <span className="bg-amber-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                        {thread.unread_count}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`px-1.5 py-0.5 rounded ${getStatusColor(thread.status)}`}>
                      {thread.status}
                    </span>
                    <span className="text-gray-500">{formatTime(thread.last_message_at)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Message View */}
        <div className="flex-1 admin-card flex flex-col overflow-hidden">
          {selectedThread ? (
            <>
              {/* Thread Header */}
              <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white">{selectedThread.title}</h3>
                  <div className="flex items-center gap-2 mt-1 text-sm">
                    <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(selectedThread.status)}`}>
                      {selectedThread.status}
                    </span>
                    <span className={`text-xs ${getPriorityColor(selectedThread.priority)}`}>
                      {selectedThread.priority} priority
                    </span>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => {
                  const isClient = message.sender_type === 'client';
                  const attachments = parseAttachments(message.attachments_json);

                  return (
                    <div
                      key={message.id}
                      className={`flex ${isClient ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[70%] ${isClient ? 'order-2' : 'order-1'}`}>
                        {/* Sender Info */}
                        <div className={`flex items-center gap-2 mb-1 ${isClient ? 'justify-end' : 'justify-start'}`}>
                          <span className="text-xs text-gray-500">
                            {message.sender_type === 'admin' ? 'Support Team' :
                             message.sender_type === 'system' ? 'System' : 'You'}
                          </span>
                          <span className="text-xs text-gray-600">{formatTime(message.created_at)}</span>
                        </div>

                        {/* Message Bubble */}
                        <div className={`p-3 rounded-lg ${
                          isClient
                            ? 'bg-amber-500/20 text-white rounded-br-none'
                            : message.sender_type === 'system'
                              ? 'bg-gray-700/50 text-gray-400 rounded-bl-none'
                              : 'bg-gray-700 text-white rounded-bl-none'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap">{message.body}</p>

                          {/* Attachments */}
                          {attachments.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-600/50 space-y-1">
                              {attachments.map((att, index) => (
                                <a
                                  key={index}
                                  href={att.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-xs text-amber-400 hover:text-amber-300"
                                >
                                  <Paperclip className="w-3 h-3" />
                                  {att.name}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              {selectedThread.status !== 'closed' && (
                <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-700">
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your message..."
                        rows={2}
                        className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!newMessage.trim() || isSending}
                      className="p-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Select a Conversation</h3>
                <p className="text-gray-400 mb-4">Choose a thread from the list or start a new conversation</p>
                <button
                  onClick={() => setShowNewThreadModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  New Message
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Thread Modal */}
      {showNewThreadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="admin-card w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">New Message</h3>
              <button
                onClick={() => setShowNewThreadModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateThread} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Subject</label>
                <input
                  type="text"
                  value={newThreadTitle}
                  onChange={(e) => setNewThreadTitle(e.target.value)}
                  placeholder="What do you need help with?"
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
                  <select
                    value={newThreadType}
                    onChange={(e) => setNewThreadType(e.target.value as any)}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="support">Support Request</option>
                    <option value="general">General Inquiry</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Priority</label>
                  <select
                    value={newThreadPriority}
                    onChange={(e) => setNewThreadPriority(e.target.value as any)}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Message</label>
                <textarea
                  value={newThreadMessage}
                  onChange={(e) => setNewThreadMessage(e.target.value)}
                  placeholder="Describe your question or issue..."
                  rows={4}
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewThreadModal(false)}
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSending}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Send Message
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortalMessages;
