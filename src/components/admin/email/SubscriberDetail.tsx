import React, { useState, useEffect } from 'react';
import {
  X, Mail, Phone, Building2, MapPin, Star, Tag, Clock,
  Send, Eye, MousePointer, AlertTriangle, Loader2, Save,
  Trash2, Play, User, Calendar, TrendingUp, BarChart3
} from 'lucide-react';

interface Subscriber {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  phone: string | null;
  pos_system: string | null;
  geographic_tier: string | null;
  lead_source: string | null;
  status: 'active' | 'unsubscribed' | 'bounced' | 'complained';
  engagement_score: number;
  tags: string[];
  total_emails_sent: number;
  total_emails_opened: number;
  total_emails_clicked: number;
  last_email_sent_at: number | null;
  last_email_opened_at: number | null;
  created_at: number;
  updated_at: number;
}

interface SequenceEnrollment {
  id: string;
  sequence_id: string;
  sequence_name: string;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  current_step: number;
  enrolled_at: number;
  completed_at: number | null;
}

interface EmailLogEntry {
  id: string;
  subject: string;
  sent_at: number;
  opened_at: number | null;
  clicked_at: number | null;
  bounced: boolean;
}

interface SubscriberDetailProps {
  subscriber: Subscriber;
  onClose: () => void;
  onUpdate: () => void;
}

const SubscriberDetail: React.FC<SubscriberDetailProps> = ({
  subscriber: initialSubscriber,
  onClose,
  onUpdate
}) => {
  const [subscriber, setSubscriber] = useState<Subscriber>(initialSubscriber);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: initialSubscriber.first_name || '',
    last_name: initialSubscriber.last_name || '',
    company: initialSubscriber.company || '',
    phone: initialSubscriber.phone || '',
    pos_system: initialSubscriber.pos_system || ''
  });
  const [newTag, setNewTag] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrollments, setEnrollments] = useState<SequenceEnrollment[]>([]);
  const [emailLog, setEmailLog] = useState<EmailLogEntry[]>([]);
  const [isLoadingExtra, setIsLoadingExtra] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'sequences' | 'emails'>('info');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Load additional subscriber data
  useEffect(() => {
    loadSubscriberDetails();
  }, [subscriber.id]);

  const loadSubscriberDetails = async () => {
    setIsLoadingExtra(true);
    try {
      const response = await fetch(`/api/admin/email/subscribers/${subscriber.id}`);
      const result = await response.json();

      if (result.success && result.data) {
        if (result.data.enrollments) setEnrollments(result.data.enrollments);
        if (result.data.email_log) setEmailLog(result.data.email_log);
        // Update subscriber with latest data
        if (result.data.subscriber) {
          setSubscriber({
            ...result.data.subscriber,
            tags: result.data.subscriber.tags
              ? (typeof result.data.subscriber.tags === 'string'
                  ? JSON.parse(result.data.subscriber.tags)
                  : result.data.subscriber.tags)
              : []
          });
        }
      }
    } catch (err) {
      console.error('Failed to load subscriber details:', err);
    } finally {
      setIsLoadingExtra(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/email/subscribers/${subscriber.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          tags: subscriber.tags
        })
      });

      const result = await response.json();

      if (result.success) {
        setSubscriber({
          ...subscriber,
          ...editForm,
          tags: subscriber.tags
        });
        setIsEditing(false);
        onUpdate();
      } else {
        setError(result.error || 'Failed to save changes');
      }
    } catch (err) {
      setError('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/email/subscribers/${subscriber.id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        onUpdate();
        onClose();
      } else {
        setError(result.error || 'Failed to delete subscriber');
      }
    } catch (err) {
      setError('Failed to delete subscriber');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const addTag = async () => {
    if (!newTag.trim() || subscriber.tags.includes(newTag.trim())) return;

    const updatedTags = [...subscriber.tags, newTag.trim()];

    try {
      const response = await fetch(`/api/admin/email/subscribers/${subscriber.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: updatedTags })
      });

      const result = await response.json();
      if (result.success) {
        setSubscriber({ ...subscriber, tags: updatedTags });
        setNewTag('');
      }
    } catch (err) {
      setError('Failed to add tag');
    }
  };

  const removeTag = async (tag: string) => {
    const updatedTags = subscriber.tags.filter(t => t !== tag);

    try {
      const response = await fetch(`/api/admin/email/subscribers/${subscriber.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: updatedTags })
      });

      const result = await response.json();
      if (result.success) {
        setSubscriber({ ...subscriber, tags: updatedTags });
      }
    } catch (err) {
      setError('Failed to remove tag');
    }
  };

  const handleEnrollInSequence = async (sequenceId: string) => {
    try {
      const response = await fetch('/api/admin/email/subscribers/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enroll',
          ids: [subscriber.id],
          sequence_id: sequenceId
        })
      });

      const result = await response.json();
      if (result.success) {
        loadSubscriberDetails();
      } else {
        setError(result.error || 'Failed to enroll in sequence');
      }
    } catch (err) {
      setError('Failed to enroll in sequence');
    }
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatDateShort = (timestamp: number | null) => {
    if (!timestamp) return '-';
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-500/20 text-green-400 border-green-500/50',
      unsubscribed: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
      bounced: 'bg-red-500/20 text-red-400 border-red-500/50',
      complained: 'bg-orange-500/20 text-orange-400 border-orange-500/50'
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs border ${colors[status] || 'bg-gray-500/20 text-gray-400'}`}>
        {status}
      </span>
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  const openRate = subscriber.total_emails_sent > 0
    ? Math.round((subscriber.total_emails_opened / subscriber.total_emails_sent) * 100)
    : 0;

  const clickRate = subscriber.total_emails_opened > 0
    ? Math.round((subscriber.total_emails_clicked / subscriber.total_emails_opened) * 100)
    : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="admin-card w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-gray-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">
                {subscriber.first_name || subscriber.last_name
                  ? `${subscriber.first_name || ''} ${subscriber.last_name || ''}`.trim()
                  : subscriber.email}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                {getStatusBadge(subscriber.status)}
                <span className="text-gray-400 text-sm">{subscriber.email}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          {[
            { id: 'info', label: 'Info', icon: User },
            { id: 'sequences', label: 'Sequences', icon: Play },
            { id: 'emails', label: 'Email Log', icon: Mail }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'text-amber-400 border-amber-400'
                  : 'text-gray-400 border-transparent hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Error Display */}
          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
              <button
                onClick={() => setError(null)}
                className="ml-auto p-1 text-red-400 hover:text-red-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Info Tab */}
          {activeTab === 'info' && (
            <div className="space-y-6">
              {/* Engagement Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Star className={`w-4 h-4 ${getScoreColor(subscriber.engagement_score)}`} />
                    <span className={`text-2xl font-bold ${getScoreColor(subscriber.engagement_score)}`}>
                      {subscriber.engagement_score}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">Engagement Score</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-white">{subscriber.total_emails_sent}</p>
                  <p className="text-xs text-gray-400">Emails Sent</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-blue-400">{openRate}%</p>
                  <p className="text-xs text-gray-400">Open Rate</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-400">{clickRate}%</p>
                  <p className="text-xs text-gray-400">Click Rate</p>
                </div>
              </div>

              {/* Contact Info */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-medium">Contact Information</h3>
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="text-sm text-amber-400 hover:text-amber-300"
                    >
                      Edit
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsEditing(false)}
                        className="text-sm text-gray-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-1 text-sm text-amber-400 hover:text-amber-300"
                      >
                        {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        Save
                      </button>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">First Name</label>
                      <input
                        type="text"
                        value={editForm.first_name}
                        onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Last Name</label>
                      <input
                        type="text"
                        value={editForm.last_name}
                        onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Company</label>
                      <input
                        type="text"
                        value={editForm.company}
                        onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Phone</label>
                      <input
                        type="text"
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-400 mb-1">POS System</label>
                      <input
                        type="text"
                        value={editForm.pos_system}
                        onChange={(e) => setEditForm({ ...editForm, pos_system: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-gray-300">
                      <Mail className="w-4 h-4 text-gray-500" />
                      <span>{subscriber.email}</span>
                    </div>
                    {(subscriber.first_name || subscriber.last_name) && (
                      <div className="flex items-center gap-3 text-gray-300">
                        <User className="w-4 h-4 text-gray-500" />
                        <span>{`${subscriber.first_name || ''} ${subscriber.last_name || ''}`.trim()}</span>
                      </div>
                    )}
                    {subscriber.company && (
                      <div className="flex items-center gap-3 text-gray-300">
                        <Building2 className="w-4 h-4 text-gray-500" />
                        <span>{subscriber.company}</span>
                      </div>
                    )}
                    {subscriber.phone && (
                      <div className="flex items-center gap-3 text-gray-300">
                        <Phone className="w-4 h-4 text-gray-500" />
                        <span>{subscriber.phone}</span>
                      </div>
                    )}
                    {subscriber.pos_system && (
                      <div className="flex items-center gap-3 text-gray-300">
                        <BarChart3 className="w-4 h-4 text-gray-500" />
                        <span>{subscriber.pos_system}</span>
                      </div>
                    )}
                    {subscriber.geographic_tier && (
                      <div className="flex items-center gap-3 text-gray-300">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        <span>{subscriber.geographic_tier}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Tags */}
              <div>
                <h3 className="text-white font-medium mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  {subscriber.tags.length === 0 ? (
                    <span className="text-gray-500 text-sm">No tags</span>
                  ) : (
                    subscriber.tags.map(tag => (
                      <span
                        key={tag}
                        className="flex items-center gap-1 px-2 py-1 bg-gray-700 text-gray-300 text-sm rounded group"
                      >
                        <Tag className="w-3 h-3 text-gray-500" />
                        {tag}
                        <button
                          onClick={() => removeTag(tag)}
                          className="text-gray-500 hover:text-red-400 ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add tag..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTag()}
                    className="flex-1 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    onClick={addTag}
                    disabled={!newTag.trim()}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-lg transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Timestamps */}
              <div className="pt-4 border-t border-gray-700">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Subscribed</p>
                    <p className="text-gray-300">{formatDate(subscriber.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Last Email Sent</p>
                    <p className="text-gray-300">{formatDate(subscriber.last_email_sent_at)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Last Opened</p>
                    <p className="text-gray-300">{formatDate(subscriber.last_email_opened_at)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Lead Source</p>
                    <p className="text-gray-300">{subscriber.lead_source || 'Unknown'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sequences Tab */}
          {activeTab === 'sequences' && (
            <div className="space-y-4">
              {isLoadingExtra ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                </div>
              ) : enrollments.length === 0 ? (
                <div className="text-center py-8">
                  <Play className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-white font-medium mb-2">Not enrolled in any sequences</h3>
                  <p className="text-gray-400 text-sm">
                    This subscriber hasn't been enrolled in any email sequences yet.
                  </p>
                </div>
              ) : (
                enrollments.map(enrollment => (
                  <div
                    key={enrollment.id}
                    className="bg-gray-800/50 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-white font-medium">{enrollment.sequence_name}</h4>
                      <span className={`px-2 py-0.5 text-xs rounded ${
                        enrollment.status === 'active' ? 'bg-green-500/20 text-green-400' :
                        enrollment.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                        enrollment.status === 'paused' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {enrollment.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span>Step {enrollment.current_step}</span>
                      <span>Enrolled {formatDateShort(enrollment.enrolled_at)}</span>
                      {enrollment.completed_at && (
                        <span>Completed {formatDateShort(enrollment.completed_at)}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Emails Tab */}
          {activeTab === 'emails' && (
            <div className="space-y-4">
              {isLoadingExtra ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                </div>
              ) : emailLog.length === 0 ? (
                <div className="text-center py-8">
                  <Mail className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-white font-medium mb-2">No emails sent yet</h3>
                  <p className="text-gray-400 text-sm">
                    Email history will appear here once this subscriber receives emails.
                  </p>
                </div>
              ) : (
                emailLog.map(email => (
                  <div
                    key={email.id}
                    className="bg-gray-800/50 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-white font-medium">{email.subject}</h4>
                      <div className="flex items-center gap-2">
                        {email.bounced && (
                          <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded">
                            Bounced
                          </span>
                        )}
                        {email.clicked_at && (
                          <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded flex items-center gap-1">
                            <MousePointer className="w-3 h-3" />
                            Clicked
                          </span>
                        )}
                        {email.opened_at && !email.clicked_at && (
                          <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            Opened
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Send className="w-3 h-3" />
                        Sent {formatDateShort(email.sent_at)}
                      </span>
                      {email.opened_at && (
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          Opened {formatDateShort(email.opened_at)}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-700 bg-gray-800/30">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
            <div className="admin-card p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-white mb-2">Delete Subscriber?</h3>
              <p className="text-gray-400 text-sm mb-4">
                This will permanently delete {subscriber.email} and all associated data.
                This action cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
                >
                  {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Delete Permanently
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriberDetail;
