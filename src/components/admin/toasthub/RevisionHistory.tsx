import React, { useState, useEffect } from 'react';
import {
  History, Clock, RotateCcw, X, Eye, Loader2, ChevronDown, ChevronUp,
  User, FileText
} from 'lucide-react';

interface Revision {
  id: string;
  post_id: string;
  version: number;
  title: string;
  content: string | null;
  content_format: string;
  excerpt: string | null;
  category: string | null;
  status: string | null;
  tags_json: string | null;
  changed_by: string | null;
  change_summary: string | null;
  created_at: number;
}

interface RevisionHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  postTitle: string;
  onRestore: (revisionId: string) => Promise<void>;
}

export default function RevisionHistory({
  isOpen,
  onClose,
  postId,
  postTitle,
  onRestore
}: RevisionHistoryProps) {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && postId) {
      loadRevisions();
    }
  }, [isOpen, postId]);

  const loadRevisions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/toast-hub/content/${postId}/revisions`, {
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success) {
        setRevisions(data.data.revisions || []);
      }
    } catch (err) {
      console.error('Failed to load revisions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (revisionId: string) => {
    if (!confirm('Restore this version? Your current content will be saved as a new revision first.')) {
      return;
    }

    setRestoring(revisionId);
    try {
      await onRestore(revisionId);
      onClose();
    } catch (err) {
      console.error('Restore failed:', err);
    } finally {
      setRestoring(null);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor(Date.now() / 1000 - timestamp);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return formatDate(timestamp);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8">
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-3xl m-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-amber-400" />
              Revision History
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

        {/* Content */}
        <div className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
            </div>
          ) : revisions.length === 0 ? (
            <div className="text-center py-12">
              <History className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No revisions yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Revisions are created when you publish, schedule, or restore content
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {revisions.map((revision, index) => (
                <div
                  key={revision.id}
                  className="bg-gray-900/50 border border-gray-700 rounded-lg overflow-hidden"
                >
                  {/* Revision header */}
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-800/50"
                    onClick={() => setExpandedId(expandedId === revision.id ? null : revision.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-300">v{revision.version}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">
                            {revision.title || 'Untitled'}
                          </span>
                          {index === 0 && (
                            <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded">
                              Latest
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTimeAgo(revision.created_at)}
                          </span>
                          {revision.changed_by && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {revision.changed_by}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {index > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRestore(revision.id);
                          }}
                          disabled={restoring !== null}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                        >
                          {restoring === revision.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RotateCcw className="w-4 h-4" />
                          )}
                          Restore
                        </button>
                      )}
                      {expandedId === revision.id ? (
                        <ChevronUp className="w-5 h-5 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-500" />
                      )}
                    </div>
                  </div>

                  {/* Expanded details */}
                  {expandedId === revision.id && (
                    <div className="px-4 pb-4 border-t border-gray-700/50">
                      {/* Change summary */}
                      {revision.change_summary && (
                        <div className="mt-3 p-3 bg-gray-800 rounded-lg">
                          <p className="text-xs text-gray-400 mb-1">Change Note</p>
                          <p className="text-sm text-gray-300">{revision.change_summary}</p>
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Status:</span>
                          <span className="ml-2 text-gray-300">{revision.status || 'draft'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Category:</span>
                          <span className="ml-2 text-gray-300">{revision.category || 'None'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Format:</span>
                          <span className="ml-2 text-gray-300">{revision.content_format}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Created:</span>
                          <span className="ml-2 text-gray-300">{formatDate(revision.created_at)}</span>
                        </div>
                      </div>

                      {/* Content preview */}
                      {revision.content && (
                        <div className="mt-4">
                          <button
                            onClick={() => setPreviewContent(
                              previewContent === revision.id ? null : revision.id
                            )}
                            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white"
                          >
                            <Eye className="w-4 h-4" />
                            {previewContent === revision.id ? 'Hide' : 'Preview'} Content
                          </button>
                          {previewContent === revision.id && (
                            <div className="mt-2 p-4 bg-gray-800 rounded-lg max-h-64 overflow-y-auto">
                              <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                                {revision.content.substring(0, 1000)}
                                {revision.content.length > 1000 && '...'}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 bg-gray-800/50">
          <p className="text-xs text-gray-500">
            {revisions.length} revision{revisions.length !== 1 ? 's' : ''} saved.
            Revisions are created automatically when content is published, scheduled, or restored.
          </p>
        </div>
      </div>
    </div>
  );
}
