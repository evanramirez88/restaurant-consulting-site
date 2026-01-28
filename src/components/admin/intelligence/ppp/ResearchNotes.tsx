/**
 * ResearchNotes Component
 * Display and edit research notes for a prospect
 */

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Globe,
  ExternalLink,
  Clock,
  Save,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Star,
  MessageSquare,
  Calendar,
  TrendingUp,
  Edit2,
  X,
} from 'lucide-react';
import type { PPPProspect, ResearchLogEntry } from '../../../../types/ppp';

interface ResearchNotesProps {
  prospect: PPPProspect;
  researchLog?: ResearchLogEntry[];
  onSaveNotes: (notes: string) => Promise<void>;
  onRefreshWebData?: () => Promise<void>;
}

const ResearchNotes: React.FC<ResearchNotesProps> = ({
  prospect,
  researchLog = [],
  onSaveNotes,
  onRefreshWebData,
}) => {
  const [notes, setNotes] = useState(prospect.research.generalNotes ?? '');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'notes' | 'web' | 'history'>('notes');

  // Update when prospect changes
  useEffect(() => {
    setNotes(prospect.research.generalNotes ?? '');
    setIsEditing(false);
    setSaved(false);
    setError(null);
  }, [prospect]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSaveNotes(notes);
      setSaved(true);
      setIsEditing(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save notes');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (timestamp: number | undefined) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTimeAgo = (timestamp: number | undefined) => {
    if (!timestamp) return 'Never';
    const seconds = Math.floor(Date.now() / 1000 - timestamp);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setActiveTab('notes')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'notes'
              ? 'bg-gray-700/50 text-amber-400 border-b-2 border-amber-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          Notes
        </button>
        <button
          onClick={() => setActiveTab('web')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'web'
              ? 'bg-gray-700/50 text-amber-400 border-b-2 border-amber-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Globe className="w-4 h-4" />
          Web Data
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'history'
              ? 'bg-gray-700/50 text-amber-400 border-b-2 border-amber-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4" />
          History
          {researchLog.length > 0 && (
            <span className="px-1.5 py-0.5 bg-gray-600 text-xs rounded">
              {researchLog.length}
            </span>
          )}
        </button>
      </div>

      {/* Notes Tab */}
      {activeTab === 'notes' && (
        <div className="p-4 space-y-4">
          {/* Messages */}
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}
          {saved && (
            <div className="p-3 bg-green-500/20 border border-green-500/50 rounded-lg flex items-center gap-2 text-green-400">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">Notes saved!</span>
            </div>
          )}

          {/* Structured Research Notes */}
          {(prospect.research.problemDescription || prospect.research.painSymptoms || prospect.research.prioritySignals) && (
            <div className="space-y-3 p-3 bg-gray-900/50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-300">Research Summary</h4>
              
              {prospect.research.problemDescription && (
                <div>
                  <label className="text-xs text-blue-400 uppercase tracking-wider">Problem</label>
                  <p className="text-sm text-gray-300 whitespace-pre-wrap">{prospect.research.problemDescription}</p>
                </div>
              )}
              
              {prospect.research.painSymptoms && (
                <div>
                  <label className="text-xs text-orange-400 uppercase tracking-wider">Pain</label>
                  <p className="text-sm text-gray-300 whitespace-pre-wrap">{prospect.research.painSymptoms}</p>
                </div>
              )}
              
              {prospect.research.prioritySignals && (
                <div>
                  <label className="text-xs text-yellow-400 uppercase tracking-wider">Priority</label>
                  <p className="text-sm text-gray-300 whitespace-pre-wrap">{prospect.research.prioritySignals}</p>
                </div>
              )}
            </div>
          )}

          {/* General Notes Editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-300">General Notes</label>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
                >
                  <Edit2 className="w-3 h-3" />
                  Edit
                </button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-3">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add research notes, observations, follow-up items..."
                  className="w-full px-3 py-2 bg-gray-900/70 border border-gray-600 rounded-lg text-white placeholder-gray-500 text-sm focus:border-amber-500 focus:outline-none resize-none"
                  rows={6}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setNotes(prospect.research.generalNotes ?? '');
                      setIsEditing(false);
                    }}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-sm"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 disabled:opacity-50 text-sm"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div 
                onClick={() => setIsEditing(true)}
                className="p-3 bg-gray-900/50 rounded-lg text-sm text-gray-400 cursor-pointer hover:bg-gray-900/70 min-h-[100px]"
              >
                {notes ? (
                  <p className="whitespace-pre-wrap text-gray-300">{notes}</p>
                ) : (
                  <p className="italic">Click to add notes...</p>
                )}
              </div>
            )}
          </div>

          {/* Last Updated */}
          {prospect.researchLastUpdatedAt && (
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last updated: {formatTimeAgo(prospect.researchLastUpdatedAt)}
            </p>
          )}
        </div>
      )}

      {/* Web Data Tab */}
      {activeTab === 'web' && (
        <div className="p-4 space-y-4">
          {prospect.research.webData ? (
            <>
              {/* Website Info */}
              {prospect.research.webData.website && (
                <div className="p-3 bg-gray-900/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      Website
                    </h4>
                    {prospect.website && (
                      <a
                        href={prospect.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                      >
                        Visit <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <div className="space-y-2 text-sm">
                    {prospect.research.webData.website.title && (
                      <p className="text-white">{prospect.research.webData.website.title}</p>
                    )}
                    {prospect.research.webData.website.description && (
                      <p className="text-gray-400">{prospect.research.webData.website.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 text-xs">
                      {prospect.research.webData.website.hasOnlineOrdering && (
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded">Online Ordering</span>
                      )}
                      {prospect.research.webData.website.hasReservations && (
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded">Reservations</span>
                      )}
                      {prospect.research.webData.website.techStack?.map(tech => (
                        <span key={tech} className="px-2 py-1 bg-gray-700 text-gray-300 rounded">{tech}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Google Places */}
              {prospect.research.webData.googlePlaces && (
                <div className="p-3 bg-gray-900/50 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-2">
                    <Star className="w-4 h-4 text-yellow-400" />
                    Google Reviews
                  </h4>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-white">
                      {prospect.research.webData.googlePlaces.rating?.toFixed(1)} ★
                    </span>
                    <span className="text-gray-400">
                      ({prospect.research.webData.googlePlaces.reviewCount} reviews)
                    </span>
                    {prospect.research.webData.googlePlaces.priceLevel && (
                      <span className="text-gray-400">
                        {'$'.repeat(prospect.research.webData.googlePlaces.priceLevel)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* News */}
              {prospect.research.webData.news && prospect.research.webData.news.length > 0 && (
                <div className="p-3 bg-gray-900/50 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4" />
                    Recent News
                  </h4>
                  <div className="space-y-2">
                    {prospect.research.webData.news.slice(0, 3).map((news, i) => (
                      <a
                        key={i}
                        href={news.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-2 bg-gray-800/50 rounded hover:bg-gray-800 transition-colors"
                      >
                        <p className="text-sm text-white">{news.title}</p>
                        <p className="text-xs text-gray-500">{news.source} • {news.date}</p>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Last Updated */}
              {prospect.research.webData.lastUpdated && (
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Data fetched: {formatTimeAgo(prospect.research.webData.lastUpdated)}
                </p>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <Globe className="w-10 h-10 mx-auto mb-3 text-gray-600" />
              <p className="text-gray-400 mb-4">No web research data available</p>
              {onRefreshWebData && (
                <button
                  onClick={onRefreshWebData}
                  className="px-4 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 text-sm"
                >
                  Fetch Web Data
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="p-4">
          {researchLog.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-10 h-10 mx-auto mb-3 text-gray-600" />
              <p className="text-gray-400">No activity history yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {researchLog.map((entry) => (
                <div
                  key={entry.id}
                  className="p-3 bg-gray-900/50 rounded-lg border-l-2 border-gray-600"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${
                      entry.activityType === 'ppp_scored' ? 'text-amber-400' :
                      entry.activityType === 'note_added' ? 'text-blue-400' :
                      entry.activityType === 'web_research' ? 'text-green-400' :
                      'text-gray-400'
                    }`}>
                      {entry.activityType === 'ppp_scored' ? 'P-P-P Scored' :
                       entry.activityType === 'note_added' ? 'Note Added' :
                       entry.activityType === 'web_research' ? 'Web Research' :
                       entry.activityType === 'status_change' ? 'Status Changed' :
                       entry.activityType}
                    </span>
                    <span className="text-xs text-gray-500">{formatDate(entry.createdAt)}</span>
                  </div>
                  
                  {entry.compositeScore !== undefined && (
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                      <span>P: {entry.problemScore}</span>
                      <span>Pain: {entry.painScore}</span>
                      <span>Pri: {entry.priorityScore}</span>
                      <span className="text-amber-400">= {entry.compositeScore}</span>
                    </div>
                  )}
                  
                  {entry.notes && (
                    <p className="text-sm text-gray-400 mt-2">{entry.notes}</p>
                  )}
                  
                  {entry.performedBy && (
                    <p className="text-xs text-gray-500 mt-1">by {entry.performedBy}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ResearchNotes;
