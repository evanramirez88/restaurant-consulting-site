import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, MoreVertical, Archive, Trash2, AlertCircle,
  CheckCircle, Clock, Loader2, RefreshCw, Lock, Users
} from 'lucide-react';
import MessageBubble, { Message } from './MessageBubble';
import MessageComposer from './MessageComposer';

export interface Thread {
  id: string;
  title: string | null;
  thread_type: 'ticket' | 'project' | 'general' | 'support' | 'private';
  client_id: string | null;
  client_name?: string;
  client_company?: string;
  rep_id: string | null;
  rep_name?: string;
  project_id: string | null;
  ticket_id: string | null;
  status: 'open' | 'pending' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  participants_json: string | null;
  last_message_at: number | null;
  created_at: number;
  updated_at: number;
  unread_count?: number;
}

interface MessageThreadProps {
  threadId: string;
  viewerType: 'admin' | 'client' | 'rep';
  viewerId: string;
  onBack?: () => void;
  onThreadUpdate?: (thread: Thread) => void;
}

const MessageThread: React.FC<MessageThreadProps> = ({
  threadId,
  viewerType,
  viewerId,
  onBack,
  onThreadUpdate
}) => {
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadThread();
  }, [threadId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadThread = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/messages/threads/${threadId}?viewerType=${viewerType}&viewerId=${viewerId}`);
      const result = await response.json();
      if (result.success) {
        setThread(result.data.thread);
        setMessages(result.data.messages || []);
        if (onThreadUpdate) {
          onThreadUpdate(result.data.thread);
        }
        // Mark messages as read
        markAsRead();
      } else {
        setError(result.error || 'Failed to load thread');
      }
    } catch (err) {
      setError('Failed to load thread');
      console.error('Failed to load thread:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async () => {
    try {
      await fetch('/api/messages/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId,
          viewerType,
          viewerId
        })
      });
    } catch (err) {
      console.error('Failed to mark messages as read:', err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (body: string, isPrivate: boolean, attachments: File[]) => {
    setIsSending(true);
    try {
      // Handle attachments upload if any
      let attachmentsData: { name: string; url: string; type: string; size: number }[] = [];

      if (attachments.length > 0) {
        // Upload each attachment
        for (const file of attachments) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('threadId', threadId);

          const uploadResponse = await fetch('/api/files/upload', {
            method: 'POST',
            body: formData
          });

          if (uploadResponse.ok) {
            const uploadResult = await uploadResponse.json();
            if (uploadResult.success) {
              attachmentsData.push({
                name: file.name,
                url: uploadResult.data.url,
                type: file.type,
                size: file.size
              });
            }
          }
        }
      }

      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId,
          senderType: viewerType,
          senderId: viewerId,
          body,
          isPrivate,
          visibleToClient: viewerType === 'client' || !isPrivate,
          visibleToRep: viewerType === 'rep' || !isPrivate,
          attachments: attachmentsData.length > 0 ? attachmentsData : undefined
        })
      });

      const result = await response.json();
      if (result.success) {
        setMessages(prev => [...prev, result.data]);
        // Update thread's last_message_at
        if (thread) {
          const updatedThread = { ...thread, last_message_at: result.data.created_at };
          setThread(updatedThread);
          if (onThreadUpdate) {
            onThreadUpdate(updatedThread);
          }
        }
      } else {
        setError(result.error || 'Failed to send message');
      }
    } catch (err) {
      setError('Failed to send message');
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleStatusChange = async (newStatus: Thread['status']) => {
    try {
      const response = await fetch(`/api/messages/threads/${threadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      const result = await response.json();
      if (result.success) {
        setThread(result.data);
        if (onThreadUpdate) {
          onThreadUpdate(result.data);
        }
      }
    } catch (err) {
      console.error('Failed to update thread status:', err);
    }
    setShowMenu(false);
  };

  const handlePriorityChange = async (newPriority: Thread['priority']) => {
    try {
      const response = await fetch(`/api/messages/threads/${threadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: newPriority })
      });

      const result = await response.json();
      if (result.success) {
        setThread(result.data);
        if (onThreadUpdate) {
          onThreadUpdate(result.data);
        }
      }
    } catch (err) {
      console.error('Failed to update thread priority:', err);
    }
    setShowMenu(false);
  };

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

  const getPriorityBadge = (priority: Thread['priority']) => {
    const colors: Record<string, string> = {
      low: 'bg-gray-500/20 text-gray-400',
      normal: 'bg-blue-500/20 text-blue-400',
      high: 'bg-amber-500/20 text-amber-400',
      urgent: 'bg-red-500/20 text-red-400'
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs ${colors[priority]}`}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </span>
    );
  };

  const getThreadTitle = () => {
    if (thread?.title) return thread.title;
    if (thread?.client_company) return `Conversation with ${thread.client_company}`;
    if (thread?.client_name) return `Conversation with ${thread.client_name}`;
    if (thread?.rep_name) return `Conversation with ${thread.rep_name}`;
    return 'Conversation';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full py-12">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (error && !thread) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={loadThread}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-700 bg-gray-800/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-400" />
              </button>
            )}
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                {getThreadTitle()}
                {thread?.thread_type === 'private' && (
                  <Lock className="w-4 h-4 text-amber-400" />
                )}
              </h2>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                {thread && getStatusIcon(thread.status)}
                <span>{thread?.status}</span>
                {thread && getPriorityBadge(thread.priority)}
                {thread?.client_name && viewerType === 'admin' && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {thread.client_company || thread.client_name}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions menu (admin only) */}
          {viewerType === 'admin' && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <MoreVertical className="w-5 h-5 text-gray-400" />
              </button>

              {showMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50">
                  <div className="p-2">
                    <div className="text-xs text-gray-500 px-2 py-1 mb-1">Status</div>
                    {(['open', 'pending', 'resolved', 'closed'] as Thread['status'][]).map(status => (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(status)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors ${
                          thread?.status === status
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        {getStatusIcon(status)}
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-gray-700 p-2">
                    <div className="text-xs text-gray-500 px-2 py-1 mb-1">Priority</div>
                    {(['low', 'normal', 'high', 'urgent'] as Thread['priority'][]).map(priority => (
                      <button
                        key={priority}
                        onClick={() => handlePriorityChange(priority)}
                        className={`w-full px-2 py-1.5 rounded text-sm text-left transition-colors ${
                          thread?.priority === priority
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        {priority.charAt(0).toUpperCase() + priority.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 space-y-2"
        style={{ minHeight: 0 }}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p>No messages yet</p>
            <p className="text-sm">Send a message to start the conversation</p>
          </div>
        ) : (
          messages.map(message => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwnMessage={message.sender_type === viewerType && message.sender_id === viewerId}
              viewerType={viewerType}
              showPrivateIndicator={viewerType === 'admin'}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error message */}
      {error && (
        <div className="flex-shrink-0 px-4 py-2 bg-red-900/30 border-t border-red-900/50">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Composer */}
      <div className="flex-shrink-0 border-t border-gray-700">
        <MessageComposer
          onSend={handleSendMessage}
          isSending={isSending}
          viewerType={viewerType}
          allowPrivate={viewerType === 'admin'}
          disabled={thread?.status === 'closed'}
          placeholder={
            thread?.status === 'closed'
              ? 'This conversation is closed'
              : 'Type your message...'
          }
        />
      </div>
    </div>
  );
};

export default MessageThread;
