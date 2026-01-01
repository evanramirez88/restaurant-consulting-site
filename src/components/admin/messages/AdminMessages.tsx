import React, { useState, useEffect } from 'react';
import {
  MessageSquare, Plus, X, Building2, User, Users,
  Loader2, AlertCircle, ChevronDown
} from 'lucide-react';
import MessageList from '../../messaging/MessageList';
import MessageThread, { Thread } from '../../messaging/MessageThread';

interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
}

interface Rep {
  id: string;
  name: string;
  email: string;
  territory: string;
}

const AdminMessages: React.FC = () => {
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleThreadSelect = (thread: Thread) => {
    setSelectedThread(thread);
  };

  const handleBack = () => {
    setSelectedThread(null);
    setRefreshKey(prev => prev + 1);
  };

  const handleThreadUpdate = (thread: Thread) => {
    setSelectedThread(thread);
  };

  const handleCreateThread = () => {
    setShowCreateModal(true);
  };

  const handleThreadCreated = (thread: Thread) => {
    setShowCreateModal(false);
    setSelectedThread(thread);
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="h-full flex">
      {/* Thread list - hidden on mobile when viewing a thread */}
      <div className={`${
        selectedThread ? 'hidden lg:flex' : 'flex'
      } flex-col w-full lg:w-96 border-r border-gray-700`}>
        <MessageList
          key={refreshKey}
          viewerType="admin"
          viewerId="admin"
          onSelectThread={handleThreadSelect}
          onCreateThread={handleCreateThread}
          selectedThreadId={selectedThread?.id}
        />
      </div>

      {/* Thread view */}
      <div className={`${
        selectedThread ? 'flex' : 'hidden lg:flex'
      } flex-col flex-1`}>
        {selectedThread ? (
          <MessageThread
            threadId={selectedThread.id}
            viewerType="admin"
            viewerId="admin"
            onBack={handleBack}
            onThreadUpdate={handleThreadUpdate}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <MessageSquare className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg mb-2">No Conversation Selected</p>
            <p className="text-sm">Select a thread from the list or start a new conversation</p>
            <button
              onClick={handleCreateThread}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-gray-900 font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Conversation
            </button>
          </div>
        )}
      </div>

      {/* Create Thread Modal */}
      {showCreateModal && (
        <CreateThreadModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleThreadCreated}
        />
      )}
    </div>
  );
};

interface CreateThreadModalProps {
  onClose: () => void;
  onCreated: (thread: Thread) => void;
}

const CreateThreadModal: React.FC<CreateThreadModalProps> = ({ onClose, onCreated }) => {
  const [title, setTitle] = useState('');
  const [threadType, setThreadType] = useState<'general' | 'support' | 'private'>('general');
  const [clientId, setClientId] = useState('');
  const [repId, setRepId] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [initialMessage, setInitialMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clients, setClients] = useState<Client[]>([]);
  const [reps, setReps] = useState<Rep[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingReps, setLoadingReps] = useState(true);

  useEffect(() => {
    loadClients();
    loadReps();
  }, []);

  const loadClients = async () => {
    try {
      const response = await fetch('/api/admin/clients');
      const result = await response.json();
      if (result.success) {
        setClients(result.data || []);
      }
    } catch (err) {
      console.error('Failed to load clients:', err);
    } finally {
      setLoadingClients(false);
    }
  };

  const loadReps = async () => {
    try {
      const response = await fetch('/api/admin/reps');
      const result = await response.json();
      if (result.success) {
        setReps(result.data || []);
      }
    } catch (err) {
      console.error('Failed to load reps:', err);
    } finally {
      setLoadingReps(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Validate: need at least a client or rep
      if (!clientId && !repId) {
        setError('Please select at least a client or rep');
        setIsLoading(false);
        return;
      }

      // Create thread
      const threadResponse = await fetch('/api/messages/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || null,
          threadType,
          clientId: clientId || null,
          repId: repId || null,
          priority,
          status: 'open'
        })
      });

      const threadResult = await threadResponse.json();
      if (!threadResult.success) {
        setError(threadResult.error || 'Failed to create thread');
        setIsLoading(false);
        return;
      }

      // Send initial message if provided
      if (initialMessage.trim()) {
        await fetch('/api/messages/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            threadId: threadResult.data.id,
            senderType: 'admin',
            senderId: 'admin',
            body: initialMessage.trim(),
            isPrivate: threadType === 'private',
            visibleToClient: threadType !== 'private',
            visibleToRep: true
          })
        });
      }

      onCreated(threadResult.data);
    } catch (err) {
      setError('Failed to create conversation');
      console.error('Failed to create thread:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-amber-400" />
            New Conversation
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-900/50 rounded-lg text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Thread Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Conversation Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'general', label: 'General', icon: MessageSquare },
                { value: 'support', label: 'Support', icon: Users },
                { value: 'private', label: 'Private', icon: User }
              ].map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setThreadType(type.value as typeof threadType)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors ${
                    threadType === type.value
                      ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                      : 'bg-gray-900 border-gray-600 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  <type.icon className="w-5 h-5" />
                  <span className="text-sm">{type.label}</span>
                </button>
              ))}
            </div>
            {threadType === 'private' && (
              <p className="mt-2 text-xs text-amber-400">
                Private conversations are only visible to admin and the selected rep
              </p>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Title (optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title for this conversation..."
              className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Client Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Building2 className="w-4 h-4 inline mr-1" />
              Client
            </label>
            <div className="relative">
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                disabled={loadingClients}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white appearance-none focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
              >
                <option value="">Select a client...</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.company || client.name} ({client.email})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Rep Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <User className="w-4 h-4 inline mr-1" />
              Rep
            </label>
            <div className="relative">
              <select
                value={repId}
                onChange={(e) => setRepId(e.target.value)}
                disabled={loadingReps}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white appearance-none focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
              >
                <option value="">Select a rep...</option>
                {reps.map(rep => (
                  <option key={rep.id} value={rep.id}>
                    {rep.name} ({rep.territory || rep.email})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Priority
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: 'low', label: 'Low', color: 'text-gray-400 border-gray-600' },
                { value: 'normal', label: 'Normal', color: 'text-blue-400 border-blue-500' },
                { value: 'high', label: 'High', color: 'text-amber-400 border-amber-500' },
                { value: 'urgent', label: 'Urgent', color: 'text-red-400 border-red-500' }
              ].map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value as typeof priority)}
                  className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                    priority === p.value
                      ? `${p.color} bg-opacity-20 bg-current`
                      : 'border-gray-600 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Initial Message */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Initial Message (optional)
            </label>
            <textarea
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
              placeholder="Type your first message..."
              rows={4}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || (!clientId && !repId)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-gray-900 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create Conversation
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminMessages;
