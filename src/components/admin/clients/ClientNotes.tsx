import React, { useState, useEffect } from 'react';
import { StickyNote, Pin, Send, Loader2, AlertTriangle } from 'lucide-react';

interface Note {
  id: string;
  author_name: string;
  author_type: string;
  content: string;
  note_type: string;
  is_pinned: boolean | number;
  created_at: number;
}

interface Props {
  clientId: string;
  initialNotes?: Note[];
}

const NOTE_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'strategy', label: 'Strategy' },
  { value: 'call_log', label: 'Call Log' },
  { value: 'meeting_notes', label: 'Meeting' },
  { value: 'risk_alert', label: 'Risk Alert' },
  { value: 'opportunity', label: 'Opportunity' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'internal', label: 'Internal' },
];

const NOTE_TYPE_COLORS: Record<string, string> = {
  general: 'bg-gray-700 text-gray-300',
  strategy: 'bg-purple-500/20 text-purple-400',
  call_log: 'bg-blue-500/20 text-blue-400',
  meeting_notes: 'bg-cyan-500/20 text-cyan-400',
  risk_alert: 'bg-red-500/20 text-red-400',
  opportunity: 'bg-green-500/20 text-green-400',
  follow_up: 'bg-amber-500/20 text-amber-400',
  internal: 'bg-gray-600 text-gray-300',
};

const ClientNotes: React.FC<Props> = ({ clientId, initialNotes }) => {
  const [notes, setNotes] = useState<Note[]>(initialNotes || []);
  const [loading, setLoading] = useState(!initialNotes);
  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState('general');
  const [pinNew, setPinNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!initialNotes) {
      loadNotes();
    }
  }, [clientId]);

  const loadNotes = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/clients/${clientId}/notes`, { credentials: 'include' });
      const data = await response.json();
      if (data.success) setNotes(data.data);
    } catch (err) {
      console.error('Failed to load notes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim() || submitting) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/clients/${clientId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: newContent.trim(), note_type: newType, is_pinned: pinNew })
      });
      const data = await response.json();
      if (data.success) {
        setNotes(prev => [data.data, ...prev]);
        setNewContent('');
        setPinNew(false);
      }
    } catch (err) {
      console.error('Failed to create note:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts * 1000);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHrs = diffMs / 3600000;
    if (diffHrs < 1) return `${Math.floor(diffMs / 60000)}m ago`;
    if (diffHrs < 24) return `${Math.floor(diffHrs)}h ago`;
    if (diffHrs < 168) return `${Math.floor(diffHrs / 24)}d ago`;
    return d.toLocaleDateString();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 text-amber-400 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* New Note Form */}
      <form onSubmit={handleSubmit} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center gap-3 mb-3">
          <select
            value={newType}
            onChange={e => setNewType(e.target.value)}
            className="bg-gray-700 border border-gray-600 text-white text-sm rounded px-2 py-1"
          >
            {NOTE_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={pinNew}
              onChange={e => setPinNew(e.target.checked)}
              className="rounded border-gray-600 bg-gray-700 text-amber-500 focus:ring-amber-500"
            />
            <Pin className="w-3.5 h-3.5" />
            Pin
          </label>
        </div>
        <div className="flex gap-2">
          <textarea
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            placeholder="Add a note..."
            rows={2}
            className="flex-1 bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 resize-none focus:outline-none focus:border-amber-500/50"
          />
          <button
            type="submit"
            disabled={!newContent.trim() || submitting}
            className="self-end px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </form>

      {/* Notes List */}
      {notes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <StickyNote className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No notes yet. Add one above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map(note => (
            <div key={note.id} className={`bg-gray-800/50 border rounded-lg p-4 ${note.is_pinned ? 'border-amber-500/30' : 'border-gray-700'}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {note.is_pinned && <Pin className="w-3.5 h-3.5 text-amber-400" />}
                  <span className={`px-2 py-0.5 rounded text-xs ${NOTE_TYPE_COLORS[note.note_type] || NOTE_TYPE_COLORS.general}`}>
                    {NOTE_TYPES.find(t => t.value === note.note_type)?.label || note.note_type}
                  </span>
                </div>
                <span className="text-xs text-gray-500">{formatDate(note.created_at)}</span>
              </div>
              <p className="text-sm text-gray-200 whitespace-pre-wrap">{note.content}</p>
              <p className="text-xs text-gray-500 mt-2">{note.author_name}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientNotes;
