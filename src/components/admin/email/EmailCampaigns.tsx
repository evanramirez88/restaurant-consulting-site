import React, { useState, useEffect } from 'react';
import {
  Search, Plus, Mail, Filter, RefreshCw, MoreVertical,
  Play, Pause, Copy, Trash2, ChevronRight, Users, Send,
  Eye, MousePointer, Loader2, Calendar, Zap, Tag, UserPlus,
  Bell, Newspaper, List, Grid3X3, AlertCircle, Clock
} from 'lucide-react';
import CampaignEditor from './CampaignEditor';

// TypeScript Interfaces
export interface EmailSequence {
  id: string;
  name: string;
  description: string | null;
  type: 'drip' | 'behavior' | 'onboarding' | 'reengagement' | 'transactional' | 'newsletter';
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  trigger_type: string | null;
  trigger_config: string | null;
  settings: string | null;
  created_at: number;
  updated_at: number;
  // Computed stats
  subscriber_count?: number;
  total_sent?: number;
  total_opened?: number;
  total_clicked?: number;
}

interface SequenceStats {
  subscriberCount: number;
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
}

type ViewMode = 'table' | 'cards';

const EmailCampaigns: React.FC = () => {
  const [sequences, setSequences] = useState<EmailSequence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [showEditor, setShowEditor] = useState(false);
  const [editingSequence, setEditingSequence] = useState<EmailSequence | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSequences();
  }, [filterStatus, filterType]);

  const loadSequences = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (filterType !== 'all') params.append('type', filterType);

      const response = await fetch(`/api/admin/email/sequences?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setSequences(result.data || []);
      } else {
        setError(result.error || 'Failed to load sequences');
      }
    } catch (err) {
      console.error('Failed to load sequences:', err);
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePause = async (id: string) => {
    setActionLoading(id);
    try {
      const response = await fetch(`/api/admin/email/sequences/${id}/pause`, {
        method: 'POST'
      });
      const result = await response.json();
      if (result.success) {
        setSequences(prev => prev.map(s => s.id === id ? { ...s, status: 'paused' } : s));
      } else {
        setError(result.error || 'Failed to pause sequence');
      }
    } catch (err) {
      setError('Failed to pause sequence');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async (id: string) => {
    setActionLoading(id);
    try {
      const response = await fetch(`/api/admin/email/sequences/${id}/resume`, {
        method: 'POST'
      });
      const result = await response.json();
      if (result.success) {
        setSequences(prev => prev.map(s => s.id === id ? { ...s, status: 'active' } : s));
      } else {
        setError(result.error || 'Failed to resume sequence');
      }
    } catch (err) {
      setError('Failed to resume sequence');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDuplicate = async (id: string) => {
    setActionLoading(id);
    try {
      const response = await fetch(`/api/admin/email/sequences/${id}/duplicate`, {
        method: 'POST'
      });
      const result = await response.json();
      if (result.success) {
        await loadSequences();
      } else {
        setError(result.error || 'Failed to duplicate sequence');
      }
    } catch (err) {
      setError('Failed to duplicate sequence');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this sequence? This cannot be undone.')) {
      return;
    }

    setActionLoading(id);
    try {
      const response = await fetch(`/api/admin/email/sequences/${id}`, {
        method: 'DELETE'
      });
      const result = await response.json();
      if (result.success) {
        setSequences(prev => prev.filter(s => s.id !== id));
      } else {
        setError(result.error || 'Failed to delete sequence');
      }
    } catch (err) {
      setError('Failed to delete sequence');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateNew = () => {
    setEditingSequence(null);
    setShowEditor(true);
  };

  const handleEditSequence = (sequence: EmailSequence) => {
    setEditingSequence(sequence);
    setShowEditor(true);
  };

  const handleEditorClose = () => {
    setShowEditor(false);
    setEditingSequence(null);
  };

  const handleEditorSave = () => {
    setShowEditor(false);
    setEditingSequence(null);
    loadSequences();
  };

  const filteredSequences = sequences.filter(seq => {
    const matchesSearch =
      seq.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      seq.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
      draft: { bg: 'bg-gray-500/20', text: 'text-gray-400', icon: <Clock className="w-3 h-3" /> },
      active: { bg: 'bg-green-500/20', text: 'text-green-400', icon: <Play className="w-3 h-3" /> },
      paused: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: <Pause className="w-3 h-3" /> },
      completed: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: <Eye className="w-3 h-3" /> },
      archived: { bg: 'bg-gray-600/20', text: 'text-gray-500', icon: <AlertCircle className="w-3 h-3" /> }
    };

    const config = statusConfig[status] || statusConfig.draft;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${config.bg} ${config.text} border border-current/30`}>
        {config.icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getTypeBadge = (type: string) => {
    const typeConfig: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
      drip: { bg: 'bg-purple-500/20', text: 'text-purple-400', icon: <Zap className="w-3 h-3" /> },
      behavior: { bg: 'bg-orange-500/20', text: 'text-orange-400', icon: <MousePointer className="w-3 h-3" /> },
      onboarding: { bg: 'bg-green-500/20', text: 'text-green-400', icon: <UserPlus className="w-3 h-3" /> },
      reengagement: { bg: 'bg-amber-500/20', text: 'text-amber-400', icon: <Bell className="w-3 h-3" /> },
      transactional: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: <Send className="w-3 h-3" /> },
      newsletter: { bg: 'bg-pink-500/20', text: 'text-pink-400', icon: <Newspaper className="w-3 h-3" /> }
    };

    const config = typeConfig[type] || typeConfig.drip;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${config.bg} ${config.text}`}>
        {config.icon}
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </span>
    );
  };

  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === null) return '-';
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return '-';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-amber-400" />
            Email Campaigns
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {sequences.length} total campaigns{filteredSequences.length !== sequences.length ? ` (${filteredSequences.length} shown)` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadSequences}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Campaign
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span className="text-red-400">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="admin-card p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search campaigns by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">All Types</option>
            <option value="drip">Drip</option>
            <option value="behavior">Behavior</option>
            <option value="onboarding">Onboarding</option>
            <option value="reengagement">Re-engagement</option>
            <option value="transactional">Transactional</option>
            <option value="newsletter">Newsletter</option>
          </select>

          {/* View Toggle */}
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded transition-colors ${viewMode === 'table' ? 'bg-amber-500/20 text-amber-400' : 'text-gray-400 hover:text-white'}`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 rounded transition-colors ${viewMode === 'cards' ? 'bg-amber-500/20 text-amber-400' : 'text-gray-400 hover:text-white'}`}
              title="Card View"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Table View */}
      {viewMode === 'table' && filteredSequences.length > 0 && (
        <div className="admin-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700 bg-gray-800/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Campaign</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <span className="flex items-center justify-center gap-1">
                      <Users className="w-3 h-3" /> Enrolled
                    </span>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <span className="flex items-center justify-center gap-1">
                      <Send className="w-3 h-3" /> Sent
                    </span>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <span className="flex items-center justify-center gap-1">
                      <Eye className="w-3 h-3" /> Opened
                    </span>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <span className="flex items-center justify-center gap-1">
                      <MousePointer className="w-3 h-3" /> Clicked
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Created</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {filteredSequences.map((sequence) => (
                  <tr
                    key={sequence.id}
                    className="hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Mail className="w-4 h-4 text-amber-400" />
                        </div>
                        <div>
                          <button
                            onClick={() => handleEditSequence(sequence)}
                            className="text-white font-medium hover:text-amber-400 transition-colors text-left"
                          >
                            {sequence.name}
                          </button>
                          {sequence.description && (
                            <p className="text-gray-500 text-xs truncate max-w-[200px]">
                              {sequence.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {getTypeBadge(sequence.type)}
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(sequence.status)}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-300">
                      {formatNumber(sequence.subscriber_count)}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-300">
                      {formatNumber(sequence.total_sent)}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-300">
                      {formatNumber(sequence.total_opened)}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-300">
                      {formatNumber(sequence.total_clicked)}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm">
                      {formatDate(sequence.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {actionLoading === sequence.id ? (
                          <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                        ) : (
                          <>
                            {sequence.status === 'active' && (
                              <button
                                onClick={() => handlePause(sequence.id)}
                                className="p-1.5 text-gray-400 hover:text-yellow-400 hover:bg-gray-700 rounded transition-colors"
                                title="Pause"
                              >
                                <Pause className="w-4 h-4" />
                              </button>
                            )}
                            {(sequence.status === 'paused' || sequence.status === 'draft') && (
                              <button
                                onClick={() => handleResume(sequence.id)}
                                className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-gray-700 rounded transition-colors"
                                title="Activate"
                              >
                                <Play className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDuplicate(sequence.id)}
                              className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-700 rounded transition-colors"
                              title="Duplicate"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(sequence.id)}
                              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEditSequence(sequence)}
                              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                              title="Edit"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Card View */}
      {viewMode === 'cards' && filteredSequences.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSequences.map((sequence) => (
            <div
              key={sequence.id}
              className="admin-card p-4 hover:border-amber-500/50 transition-all cursor-pointer group"
              onClick={() => handleEditSequence(sequence)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                    <Mail className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold group-hover:text-amber-400 transition-colors">
                      {sequence.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {getTypeBadge(sequence.type)}
                    </div>
                  </div>
                </div>
                {getStatusBadge(sequence.status)}
              </div>

              {sequence.description && (
                <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                  {sequence.description}
                </p>
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="text-center p-2 bg-gray-900/50 rounded">
                  <Users className="w-3 h-3 text-gray-400 mx-auto mb-1" />
                  <span className="text-white text-sm font-medium block">
                    {formatNumber(sequence.subscriber_count)}
                  </span>
                </div>
                <div className="text-center p-2 bg-gray-900/50 rounded">
                  <Send className="w-3 h-3 text-gray-400 mx-auto mb-1" />
                  <span className="text-white text-sm font-medium block">
                    {formatNumber(sequence.total_sent)}
                  </span>
                </div>
                <div className="text-center p-2 bg-gray-900/50 rounded">
                  <Eye className="w-3 h-3 text-gray-400 mx-auto mb-1" />
                  <span className="text-white text-sm font-medium block">
                    {formatNumber(sequence.total_opened)}
                  </span>
                </div>
                <div className="text-center p-2 bg-gray-900/50 rounded">
                  <MousePointer className="w-3 h-3 text-gray-400 mx-auto mb-1" />
                  <span className="text-white text-sm font-medium block">
                    {formatNumber(sequence.total_clicked)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-700">
                <span className="text-xs text-gray-500">
                  Created {formatDate(sequence.created_at)}
                </span>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {actionLoading === sequence.id ? (
                    <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                  ) : (
                    <>
                      {sequence.status === 'active' && (
                        <button
                          onClick={() => handlePause(sequence.id)}
                          className="p-1.5 text-gray-400 hover:text-yellow-400 hover:bg-gray-700 rounded transition-colors"
                          title="Pause"
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                      )}
                      {(sequence.status === 'paused' || sequence.status === 'draft') && (
                        <button
                          onClick={() => handleResume(sequence.id)}
                          className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-gray-700 rounded transition-colors"
                          title="Activate"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDuplicate(sequence.id)}
                        className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-700 rounded transition-colors"
                        title="Duplicate"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(sequence.id)}
                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {filteredSequences.length === 0 && (
        <div className="admin-card p-12 text-center">
          <Mail className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-white font-semibold mb-2">No Campaigns Found</h3>
          <p className="text-gray-400 text-sm mb-4">
            {searchQuery || filterStatus !== 'all' || filterType !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Get started by creating your first email campaign'}
          </p>
          {!searchQuery && filterStatus === 'all' && filterType === 'all' && (
            <button
              onClick={handleCreateNew}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create First Campaign
            </button>
          )}
        </div>
      )}

      {/* Campaign Editor Modal */}
      {showEditor && (
        <CampaignEditor
          sequence={editingSequence}
          onClose={handleEditorClose}
          onSave={handleEditorSave}
        />
      )}
    </div>
  );
};

export default EmailCampaigns;
