import React, { useState, useEffect } from 'react';
import {
  Users, X, Search, Check, Loader2, UserPlus, UserMinus,
  Building, Mail, Clock, Shield
} from 'lucide-react';

interface Client {
  id: string;
  name: string;
  email: string;
  company: string | null;
}

interface SharedClient {
  access_id: string;
  client_id: string;
  client_name: string;
  client_email: string;
  client_company: string | null;
  access_level: string;
  granted_at: number;
  granted_by: string | null;
  expires_at: number | null;
}

interface ShareWithClientsProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  postTitle: string;
  onUpdate?: () => void;
}

const ACCESS_LEVELS = [
  { value: 'read', label: 'Read', description: 'Can view content' },
  { value: 'download', label: 'Download', description: 'Can view and download attachments' },
  { value: 'full', label: 'Full Access', description: 'Full access including future updates' }
];

export default function ShareWithClients({
  isOpen,
  onClose,
  postId,
  postTitle,
  onUpdate
}: ShareWithClientsProps) {
  const [sharedWith, setSharedWith] = useState<SharedClient[]>([]);
  const [availableClients, setAvailableClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [accessLevel, setAccessLevel] = useState('read');
  const [expiresInDays, setExpiresInDays] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && postId) {
      loadSharingStatus();
    }
  }, [isOpen, postId]);

  const loadSharingStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/toast-hub/content/${postId}/share`, {
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success) {
        setSharedWith(data.data.shared_with || []);
        setAvailableClients(data.data.available_clients || []);
      }
    } catch (err) {
      console.error('Failed to load sharing status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (selectedClients.length === 0) return;

    setSharing(true);
    try {
      const res = await fetch(`/api/admin/toast-hub/content/${postId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          client_ids: selectedClients,
          access_level: accessLevel,
          expires_in_days: expiresInDays
        })
      });
      const data = await res.json();
      if (data.success) {
        setSelectedClients([]);
        loadSharingStatus();
        onUpdate?.();
      } else {
        alert(data.error || 'Failed to share');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to share');
    } finally {
      setSharing(false);
    }
  };

  const handleRemoveAccess = async (clientId: string) => {
    if (!confirm('Remove this client\'s access?')) return;

    setRemoving(clientId);
    try {
      const res = await fetch(
        `/api/admin/toast-hub/content/${postId}/share?client_id=${clientId}`,
        {
          method: 'DELETE',
          credentials: 'include'
        }
      );
      const data = await res.json();
      if (data.success) {
        loadSharingStatus();
        onUpdate?.();
      }
    } catch (err) {
      console.error('Failed to remove access:', err);
    } finally {
      setRemoving(null);
    }
  };

  const toggleClient = (clientId: string) => {
    setSelectedClients(prev =>
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const filteredClients = availableClients.filter(client => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      client.name.toLowerCase().includes(q) ||
      client.email.toLowerCase().includes(q) ||
      client.company?.toLowerCase().includes(q)
    );
  });

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8">
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl m-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              Share with Clients
            </h3>
            <p className="text-sm text-gray-400 mt-0.5">{postTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
          </div>
        ) : (
          <>
            {/* Currently shared with */}
            {sharedWith.length > 0 && (
              <div className="px-6 py-4 border-b border-gray-700">
                <h4 className="text-sm font-medium text-gray-400 mb-3">
                  Currently shared with ({sharedWith.length})
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {sharedWith.map(client => (
                    <div
                      key={client.access_id}
                      className="flex items-center justify-between p-2 bg-gray-900/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                          <Check className="w-4 h-4 text-green-400" />
                        </div>
                        <div>
                          <p className="text-sm text-white">{client.client_name}</p>
                          <p className="text-xs text-gray-500">{client.client_email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded capitalize">
                          {client.access_level}
                        </span>
                        <button
                          onClick={() => handleRemoveAccess(client.client_id)}
                          disabled={removing === client.client_id}
                          className="p-1 text-gray-400 hover:text-red-400 rounded transition-colors"
                        >
                          {removing === client.client_id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <UserMinus className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add new clients */}
            <div className="p-6 space-y-4">
              <h4 className="text-sm font-medium text-gray-400">Share with new clients</h4>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search clients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Client selection */}
              <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-700 rounded-lg p-2">
                {filteredClients.length === 0 ? (
                  <p className="text-center text-gray-500 py-4 text-sm">
                    {availableClients.length === 0
                      ? 'All clients already have access'
                      : 'No clients match your search'}
                  </p>
                ) : (
                  filteredClients.map(client => (
                    <div
                      key={client.id}
                      onClick={() => toggleClient(client.id)}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                        selectedClients.includes(client.id)
                          ? 'bg-amber-500/20 border border-amber-500/50'
                          : 'hover:bg-gray-700'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                        selectedClients.includes(client.id)
                          ? 'bg-amber-500 border-amber-500'
                          : 'border-gray-600'
                      }`}>
                        {selectedClients.includes(client.id) && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{client.name}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Mail className="w-3 h-3" />
                          <span className="truncate">{client.email}</span>
                          {client.company && (
                            <>
                              <Building className="w-3 h-3 ml-2" />
                              <span className="truncate">{client.company}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Access options */}
              {selectedClients.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Access Level</label>
                    <select
                      value={accessLevel}
                      onChange={(e) => setAccessLevel(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      {ACCESS_LEVELS.map(level => (
                        <option key={level.value} value={level.value}>
                          {level.label} - {level.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Expires in (optional)</label>
                    <select
                      value={expiresInDays || ''}
                      onChange={(e) => setExpiresInDays(e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="">Never expires</option>
                      <option value="7">7 days</option>
                      <option value="30">30 days</option>
                      <option value="90">90 days</option>
                      <option value="365">1 year</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {selectedClients.length} client{selectedClients.length !== 1 ? 's' : ''} selected
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleShare}
                  disabled={sharing || selectedClients.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {sharing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  {sharing ? 'Sharing...' : 'Share'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
