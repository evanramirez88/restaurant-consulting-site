import React, { useState } from 'react';
import {
  FileEdit, Clock, Globe, Archive, Calendar, Send, History,
  Loader2, ChevronDown, Check, X, RotateCcw
} from 'lucide-react';
import SchedulePopover from './SchedulePopover';

interface Post {
  id: string;
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  scheduled_for: number | null;
  published_at: number | null;
}

interface WorkflowBarProps {
  post: Post;
  onPublish: () => Promise<void>;
  onUnpublish: () => Promise<void>;
  onSchedule: (scheduledFor: number) => Promise<void>;
  onCancelSchedule: () => Promise<void>;
  onShowRevisions: () => void;
  isSaving?: boolean;
}

const STATUS_CONFIG = {
  draft: {
    icon: FileEdit,
    color: 'text-gray-400',
    bg: 'bg-gray-500/20',
    border: 'border-gray-500/50',
    label: 'Draft'
  },
  scheduled: {
    icon: Clock,
    color: 'text-blue-400',
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/50',
    label: 'Scheduled'
  },
  published: {
    icon: Globe,
    color: 'text-green-400',
    bg: 'bg-green-500/20',
    border: 'border-green-500/50',
    label: 'Published'
  },
  archived: {
    icon: Archive,
    color: 'text-amber-400',
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/50',
    label: 'Archived'
  }
};

export default function WorkflowBar({
  post,
  onPublish,
  onUnpublish,
  onSchedule,
  onCancelSchedule,
  onShowRevisions,
  isSaving = false
}: WorkflowBarProps) {
  const [showSchedule, setShowSchedule] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const config = STATUS_CONFIG[post.status];
  const StatusIcon = config.icon;

  const handlePublish = async () => {
    setActionLoading('publish');
    try {
      await onPublish();
    } finally {
      setActionLoading(null);
      setShowMenu(false);
    }
  };

  const handleUnpublish = async () => {
    setActionLoading('unpublish');
    try {
      await onUnpublish();
    } finally {
      setActionLoading(null);
      setShowMenu(false);
    }
  };

  const handleCancelSchedule = async () => {
    setActionLoading('cancel');
    try {
      await onCancelSchedule();
    } finally {
      setActionLoading(null);
      setShowMenu(false);
    }
  };

  const handleSchedule = async (scheduledFor: number) => {
    setActionLoading('schedule');
    try {
      await onSchedule(scheduledFor);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return '';
    return new Date(timestamp * 1000).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800/60 border-b border-gray-700/50">
        {/* Left: Status indicator */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${config.bg} ${config.border}`}>
            <StatusIcon className={`w-4 h-4 ${config.color}`} />
            <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
          </div>

          {/* Show scheduled/published date */}
          {post.status === 'scheduled' && post.scheduled_for && (
            <span className="text-sm text-gray-400">
              Publishes: {formatDate(post.scheduled_for)}
            </span>
          )}
          {post.status === 'published' && post.published_at && (
            <span className="text-sm text-gray-400">
              Published: {formatDate(post.published_at)}
            </span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Revisions button */}
          <button
            onClick={onShowRevisions}
            className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg text-sm transition-colors"
            title="View revision history"
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">Revisions</span>
          </button>

          {/* Primary action based on status */}
          {post.status === 'draft' && (
            <>
              <button
                onClick={() => setShowSchedule(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-blue-400 hover:bg-blue-500/10 rounded-lg text-sm transition-colors"
              >
                <Calendar className="w-4 h-4" />
                Schedule
              </button>
              <button
                onClick={handlePublish}
                disabled={isSaving || actionLoading !== null}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {actionLoading === 'publish' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Publish Now
              </button>
            </>
          )}

          {post.status === 'scheduled' && (
            <>
              <button
                onClick={handleCancelSchedule}
                disabled={actionLoading !== null}
                className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg text-sm transition-colors"
              >
                {actionLoading === 'cancel' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <X className="w-4 h-4" />
                )}
                Cancel
              </button>
              <button
                onClick={() => setShowSchedule(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-blue-400 hover:bg-blue-500/10 rounded-lg text-sm transition-colors"
              >
                <Calendar className="w-4 h-4" />
                Reschedule
              </button>
              <button
                onClick={handlePublish}
                disabled={actionLoading !== null}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {actionLoading === 'publish' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Publish Now
              </button>
            </>
          )}

          {post.status === 'published' && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Actions
                <ChevronDown className="w-4 h-4" />
              </button>

              {showMenu && (
                <div className="absolute right-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 overflow-hidden">
                  <button
                    onClick={handleUnpublish}
                    disabled={actionLoading !== null}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    {actionLoading === 'unpublish' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}
                    Revert to Draft
                  </button>
                  <button
                    onClick={() => { setShowMenu(false); setShowSchedule(true); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    <Calendar className="w-4 h-4" />
                    Schedule Update
                  </button>
                </div>
              )}
            </div>
          )}

          {post.status === 'archived' && (
            <button
              onClick={handleUnpublish}
              disabled={actionLoading !== null}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {actionLoading === 'unpublish' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              Restore to Draft
            </button>
          )}
        </div>
      </div>

      {/* Click outside to close menu */}
      {showMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowMenu(false)}
        />
      )}

      {/* Schedule Popover */}
      <SchedulePopover
        isOpen={showSchedule}
        onClose={() => setShowSchedule(false)}
        onSchedule={handleSchedule}
        currentSchedule={post.scheduled_for}
      />
    </>
  );
}
