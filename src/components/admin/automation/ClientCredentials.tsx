import React, { useState } from 'react';
import {
  Key,
  Plus,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Edit2,
  Loader2
} from 'lucide-react';
import { ToastCredential } from './AutomationDashboard';

interface ClientCredentialsProps {
  credentials: ToastCredential[];
  onRefresh: () => void;
}

const ClientCredentials: React.FC<ClientCredentialsProps> = ({ credentials, onRefresh }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="flex items-center gap-1 text-green-400 text-xs bg-green-500/20 px-2 py-1 rounded">
            <CheckCircle2 className="w-3 h-3" /> Active
          </span>
        );
      case 'invalid':
        return (
          <span className="flex items-center gap-1 text-red-400 text-xs bg-red-500/20 px-2 py-1 rounded">
            <AlertCircle className="w-3 h-3" /> Invalid
          </span>
        );
      case 'pending_verification':
        return (
          <span className="flex items-center gap-1 text-yellow-400 text-xs bg-yellow-500/20 px-2 py-1 rounded">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case 'expired':
        return (
          <span className="flex items-center gap-1 text-orange-400 text-xs bg-orange-500/20 px-2 py-1 rounded">
            <Clock className="w-3 h-3" /> Expired
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-gray-400 text-xs bg-gray-500/20 px-2 py-1 rounded">
            {status}
          </span>
        );
    }
  };

  const handleVerify = async (credentialId: string) => {
    setVerifying(credentialId);
    try {
      const response = await fetch(`/api/automation/credentials/${credentialId}/verify`, {
        method: 'POST'
      });
      const result = await response.json();
      if (result.success) {
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to verify credentials:', err);
    }
    setVerifying(null);
  };

  const handleDelete = async (credentialId: string) => {
    if (!confirm('Are you sure you want to delete these credentials?')) return;
    try {
      const response = await fetch(`/api/automation/credentials/${credentialId}`, {
        method: 'DELETE'
      });
      const result = await response.json();
      if (result.success) {
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to delete credentials:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Key className="w-5 h-5 text-amber-400" />
            Toast Credentials
          </h3>
          <p className="text-gray-400 text-sm mt-1">
            Manage encrypted Toast login credentials for automation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Credentials
          </button>
        </div>
      </div>

      {/* Credentials List */}
      {credentials.length === 0 ? (
        <div className="admin-card p-8 text-center">
          <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Key className="w-8 h-8 text-gray-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-400 mb-2">No Credentials Stored</h3>
          <p className="text-gray-500 text-sm mb-4">
            Add Toast login credentials to enable automation for clients
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add First Credentials
          </button>
        </div>
      ) : (
        <div className="admin-card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">
                  Client
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">
                  Restaurant
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">
                  Status
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">
                  Last Verified
                </th>
                <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {credentials.map((cred) => (
                <tr key={cred.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{cred.client_name || 'Unknown Client'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-300">{cred.restaurant_name || '—'}</p>
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(cred.status)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-400 text-sm">
                      {cred.last_verified_at
                        ? new Date(cred.last_verified_at).toLocaleDateString()
                        : 'Never'}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleVerify(cred.id)}
                        disabled={verifying === cred.id}
                        className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-gray-800 rounded transition-colors"
                        title="Verify credentials"
                      >
                        {verifying === cred.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => setEditingId(cred.id)}
                        className="p-1.5 text-gray-400 hover:text-amber-400 hover:bg-gray-800 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(cred.id)}
                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Security Note */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <p className="text-blue-400 text-sm">
          <strong>Security:</strong> All credentials are encrypted with AES-256 before storage.
          Passwords are never stored in plaintext and are only decrypted on the automation server.
        </p>
      </div>

      {/* TODO: Add modal for adding/editing credentials */}
    </div>
  );
};

export default ClientCredentials;
