import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Loader2,
  MessageSquare,
  Send,
  AlertTriangle,
  Lock,
  User,
  Shield
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

interface Message {
  id: string;
  thread_id: string | null;
  sender_type: 'admin' | 'rep';
  sender_id: string | null;
  subject: string | null;
  body: string;
  is_private: boolean;
  read_at: number | null;
  created_at: number;
}

const RepMessages: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useSEO({
    title: 'Messages | Rep Portal | Cape Cod Restaurant Consulting',
    description: 'Private messages with admin.',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [rep, setRep] = useState<RepInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Verify authentication
        const authRes = await fetch(`/api/rep/${slug}/auth/verify`);
        const authData = await authRes.json();

        if (!authData.authenticated) {
          navigate(`/rep/${slug}/login`);
          return;
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

        // Load messages
        await loadMessages();
      } catch (err) {
        console.error('Load error:', err);
        setError('Failed to load messages');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [slug, navigate]);

  const loadMessages = async () => {
    try {
      const messagesRes = await fetch(`/api/rep/${slug}/messages`);
      const messagesData = await messagesRes.json();

      if (messagesData.success) {
        setMessages(messagesData.data || []);
      }
    } catch (err) {
      console.error('Load messages error:', err);
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Poll for new messages every 30 seconds
  useEffect(() => {
    const interval = setInterval(loadMessages, 30000);
    return () => clearInterval(interval);
  }, [slug]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim()) return;

    setIsSending(true);
    setSendError(null);

    try {
      const response = await fetch(`/api/rep/${slug}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: newMessage.trim(),
          is_private: true // Rep-admin messages are always private
        })
      });

      const result = await response.json();

      if (result.success) {
        setMessages((prev) => [...prev, result.data]);
        setNewMessage('');
      } else {
        setSendError(result.error || 'Failed to send message');
      }
    } catch (err) {
      console.error('Send error:', err);
      setSendError('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday =
      new Date(now.getTime() - 86400000).toDateString() === date.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } else if (isYesterday) {
      return `Yesterday ${date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })}`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }
  };

  const groupMessagesByDate = (messages: Message[]) => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = '';

    messages.forEach((message) => {
      const messageDate = new Date(message.created_at * 1000).toDateString();
      if (messageDate !== currentDate) {
        currentDate = messageDate;
        groups.push({ date: messageDate, messages: [message] });
      } else {
        groups[groups.length - 1].messages.push(message);
      }
    });

    return groups;
  };

  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday =
      new Date(now.getTime() - 86400000).toDateString() === date.toDateString();

    if (isToday) return 'Today';
    if (isYesterday) return 'Yesterday';

    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
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

  const messageGroups = groupMessagesByDate(messages);

  return (
    <RepLayout rep={rep}>
      <div className="h-[calc(100vh-280px)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-display font-bold text-white">Messages</h2>
            <p className="text-gray-400 mt-1 flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Private conversation with R&G Consulting Admin
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/30 rounded-lg">
            <Lock className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-purple-400">Private Thread</span>
          </div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 admin-card overflow-hidden flex flex-col">
          {/* Messages List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6 admin-scrollbar">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <MessageSquare className="w-16 h-16 text-gray-600 mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No Messages Yet</h3>
                <p className="text-gray-400 max-w-sm">
                  Start a private conversation with the admin team. Messages here are not visible to clients.
                </p>
              </div>
            ) : (
              <>
                {messageGroups.map((group, groupIndex) => (
                  <div key={groupIndex}>
                    {/* Date Header */}
                    <div className="flex items-center gap-4 mb-4">
                      <div className="flex-1 h-px bg-gray-700" />
                      <span className="text-xs text-gray-500 font-medium">
                        {formatDateHeader(group.date)}
                      </span>
                      <div className="flex-1 h-px bg-gray-700" />
                    </div>

                    {/* Messages */}
                    <div className="space-y-4">
                      {group.messages.map((message) => {
                        const isFromRep = message.sender_type === 'rep';

                        return (
                          <div
                            key={message.id}
                            className={`flex ${isFromRep ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`flex items-start gap-3 max-w-[80%] ${
                                isFromRep ? 'flex-row-reverse' : ''
                              }`}
                            >
                              {/* Avatar */}
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                  isFromRep
                                    ? 'bg-green-500/20'
                                    : 'bg-amber-500/20'
                                }`}
                              >
                                {isFromRep ? (
                                  <User className="w-4 h-4 text-green-400" />
                                ) : (
                                  <Shield className="w-4 h-4 text-amber-400" />
                                )}
                              </div>

                              {/* Message Bubble */}
                              <div>
                                <div
                                  className={`px-4 py-3 rounded-2xl ${
                                    isFromRep
                                      ? 'bg-green-600 text-white rounded-br-none'
                                      : 'bg-gray-700 text-white rounded-bl-none'
                                  }`}
                                >
                                  <p className="whitespace-pre-wrap break-words">{message.body}</p>
                                </div>
                                <p
                                  className={`text-xs text-gray-500 mt-1 ${
                                    isFromRep ? 'text-right' : ''
                                  }`}
                                >
                                  {formatTimestamp(message.created_at)}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Message Input */}
          <div className="border-t border-gray-700 p-4">
            {sendError && (
              <div className="flex items-center gap-2 text-red-400 text-sm mb-3">
                <AlertTriangle className="w-4 h-4" />
                {sendError}
              </div>
            )}
            <form onSubmit={handleSendMessage} className="flex gap-3">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                disabled={isSending}
                className="flex-1 px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isSending || !newMessage.trim()}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
              >
                {isSending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>
            <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              Messages are private and only visible to you and the admin team
            </p>
          </div>
        </div>
      </div>
    </RepLayout>
  );
};

export default RepMessages;
