import React, { useState, useEffect } from 'react';
import {
  Radio, X, Search, Download, Loader2, Check, ExternalLink,
  Filter, Tag, FileText, Sparkles
} from 'lucide-react';

interface BeaconItem {
  id: string;
  title: string;
  body: string | null;
  url: string | null;
  author: string | null;
  source_type: string;
  source_name: string | null;
  ai_summary: string | null;
  ai_category: string | null;
  ai_sentiment: string | null;
  ai_priority_score: number;
  fetched_at: number;
  already_imported: number;
}

interface Template {
  id: string;
  name: string;
  template_type: string;
  description: string | null;
}

interface BeaconImportProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (postId: string) => void;
}

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'menu', label: 'Menu & Items' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'integrations', label: 'Integrations' },
  { value: 'reports', label: 'Reports' },
  { value: 'labor', label: 'Labor' },
  { value: 'training', label: 'Training' },
  { value: 'general', label: 'General' }
];

const SENTIMENT_COLORS: Record<string, string> = {
  frustrated: 'text-red-400 bg-red-500/20',
  confused: 'text-amber-400 bg-amber-500/20',
  negative: 'text-orange-400 bg-orange-500/20',
  neutral: 'text-gray-400 bg-gray-500/20',
  positive: 'text-green-400 bg-green-500/20'
};

export default function BeaconImport({ isOpen, onClose, onImport }: BeaconImportProps) {
  const [items, setItems] = useState<BeaconItem[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedItem, setSelectedItem] = useState<BeaconItem | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [titleOverride, setTitleOverride] = useState('');
  const [asDraft, setAsDraft] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadBeaconContent();
    }
  }, [isOpen, categoryFilter]);

  const loadBeaconContent = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('status', 'approved');
      if (categoryFilter) params.set('category', categoryFilter);

      const res = await fetch(`/api/admin/toast-hub/import-from-beacon?${params}`, {
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success) {
        setItems(data.data.items || []);
        setTemplates(data.data.templates || []);
      }
    } catch (err) {
      console.error('Failed to load Beacon content:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedItem) return;

    setImporting(selectedItem.id);
    try {
      const res = await fetch('/api/admin/toast-hub/import-from-beacon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          beacon_item_id: selectedItem.id,
          template_id: selectedTemplate || undefined,
          title_override: titleOverride || undefined,
          as_draft: asDraft
        })
      });
      const data = await res.json();
      if (data.success) {
        onImport(data.data.id);
        setSelectedItem(null);
        loadBeaconContent();
      } else {
        alert(data.error || 'Import failed');
      }
    } catch (err: any) {
      alert(err.message || 'Import failed');
    } finally {
      setImporting(null);
    }
  };

  const filteredItems = items.filter(item => {
    if (item.already_imported) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.ai_summary?.toLowerCase().includes(q) ||
      item.author?.toLowerCase().includes(q)
    );
  });

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor(Date.now() / 1000 - timestamp);
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8">
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-4xl m-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Radio className="w-5 h-5 text-amber-400" />
              Import from Beacon
            </h3>
            <p className="text-sm text-gray-400 mt-0.5">
              Select approved content to transform into Toast Hub articles
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex h-[600px]">
          {/* Left: Content list */}
          <div className="w-1/2 border-r border-gray-700 flex flex-col">
            {/* Filters */}
            <div className="p-4 space-y-3 border-b border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search content..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Content list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-12">
                  <Radio className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No content available</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Approve content in Beacon first
                  </p>
                </div>
              ) : (
                filteredItems.map(item => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedItem(item);
                      setTitleOverride('');
                    }}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                      selectedItem?.id === item.id
                        ? 'bg-amber-500/20 border border-amber-500/50'
                        : 'bg-gray-900/50 border border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-white text-sm font-medium line-clamp-2">
                        {item.title}
                      </h4>
                      {selectedItem?.id === item.id && (
                        <Check className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="px-2 py-0.5 text-xs rounded bg-gray-700 text-gray-300">
                        {item.source_type}
                      </span>
                      {item.ai_category && (
                        <span className="px-2 py-0.5 text-xs rounded bg-gray-700 text-gray-300 capitalize">
                          {item.ai_category}
                        </span>
                      )}
                      {item.ai_sentiment && (
                        <span className={`px-2 py-0.5 text-xs rounded ${SENTIMENT_COLORS[item.ai_sentiment] || SENTIMENT_COLORS.neutral}`}>
                          {item.ai_sentiment}
                        </span>
                      )}
                      <span className="text-xs text-gray-500 ml-auto">
                        {formatTimeAgo(item.fetched_at)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: Import options */}
          <div className="w-1/2 flex flex-col">
            {selectedItem ? (
              <>
                {/* Preview */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Original Title</label>
                    <p className="text-white font-medium">{selectedItem.title}</p>
                  </div>

                  {selectedItem.ai_summary && (
                    <div>
                      <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        AI Summary
                      </label>
                      <p className="text-sm text-gray-300">{selectedItem.ai_summary}</p>
                    </div>
                  )}

                  {selectedItem.url && (
                    <a
                      href={selectedItem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-amber-400 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View original
                    </a>
                  )}

                  <hr className="border-gray-700" />

                  {/* Import options */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Custom Title (optional)
                    </label>
                    <input
                      type="text"
                      value={titleOverride}
                      onChange={(e) => setTitleOverride(e.target.value)}
                      placeholder={selectedItem.title}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Content Template
                    </label>
                    <select
                      value={selectedTemplate}
                      onChange={(e) => setSelectedTemplate(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="">No template (import raw)</option>
                      {templates.map(tpl => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.name} - {tpl.template_type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={asDraft}
                        onChange={(e) => setAsDraft(e.target.checked)}
                        className="rounded border-gray-600 text-amber-500 focus:ring-amber-500"
                      />
                      <span className="text-sm text-gray-300">Import as draft</span>
                    </label>
                  </div>
                </div>

                {/* Import button */}
                <div className="p-4 border-t border-gray-700">
                  <button
                    onClick={handleImport}
                    disabled={importing !== null}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
                  >
                    {importing ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Download className="w-5 h-5" />
                    )}
                    {importing ? 'Importing...' : 'Import to Toast Hub'}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">Select content to import</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Click an item from the list to preview
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
