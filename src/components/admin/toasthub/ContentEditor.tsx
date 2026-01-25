import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bold, Italic, Heading1, Heading2, Heading3, Link2, Image, Code,
  List, ListOrdered, Quote, Minus, Save, Eye, EyeOff, Loader2,
  ArrowLeft, Globe, Check, AlertCircle, Clock, FileText, Tag
} from 'lucide-react';

interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  content_format: string;
  category: string | null;
  tags_json: string | null;
  meta_title: string | null;
  meta_description: string | null;
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  author: string | null;
  published_at: number | null;
  scheduled_for: number | null;
  featured: boolean;
}

interface Category {
  id: string;
  slug: string;
  name: string;
}

interface ContentEditorProps {
  post: Post | null;
  categories: Category[];
  onSave: (post: Post) => Promise<void>;
  onBack: () => void;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function readingTime(words: number): string {
  const minutes = Math.ceil(words / 200);
  return `${minutes} min read`;
}

// Simple markdown to HTML converter for preview
function markdownToHtml(md: string): string {
  if (!md) return '';
  let html = md
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-gray-100 p-4 rounded-lg overflow-x-auto my-4"><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-sm">$1</code>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-xl font-bold mt-6 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold mt-8 mb-3">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold mt-8 mb-4">$1</h1>')
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-amber-600 underline">$1</a>')
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full rounded-lg my-4" />')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-amber-400 pl-4 italic text-gray-600 my-4">$1</blockquote>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr class="my-8 border-gray-200" />')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    // Paragraphs (double newlines)
    .replace(/\n\n/g, '</p><p class="my-4">')
    // Single newlines -> br
    .replace(/\n/g, '<br/>');

  return `<p class="my-4">${html}</p>`;
}

export default function ContentEditor({ post, categories, onSave, onBack }: ContentEditorProps) {
  const [formData, setFormData] = useState<Post>({
    id: '',
    slug: '',
    title: '',
    excerpt: null,
    content: null,
    content_format: 'markdown',
    category: null,
    tags_json: null,
    meta_title: null,
    meta_description: null,
    status: 'draft',
    author: null,
    published_at: null,
    scheduled_for: null,
    featured: false,
    ...post
  });

  const [showPreview, setShowPreview] = useState(false);
  const [showSEO, setShowSEO] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [autoSlug, setAutoSlug] = useState(!post?.id);
  const [tagsInput, setTagsInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Parse tags from JSON
  useEffect(() => {
    if (formData.tags_json) {
      try {
        const tags = JSON.parse(formData.tags_json);
        setTagsInput(Array.isArray(tags) ? tags.join(', ') : '');
      } catch { setTagsInput(''); }
    }
  }, []);

  // Auto-slug from title
  useEffect(() => {
    if (autoSlug && formData.title) {
      setFormData(prev => ({ ...prev, slug: slugify(prev.title) }));
    }
  }, [formData.title, autoSlug]);

  // Auto-save to localStorage every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      if (formData.title || formData.content) {
        localStorage.setItem(`toast_hub_draft_${formData.id || 'new'}`, JSON.stringify(formData));
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [formData]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 's':
            e.preventDefault();
            handleSave();
            break;
          case 'b':
            e.preventDefault();
            insertMarkdown('**', '**');
            break;
          case 'i':
            e.preventDefault();
            insertMarkdown('*', '*');
            break;
          case 'k':
            e.preventDefault();
            insertMarkdown('[', '](url)');
            break;
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [formData]);

  const insertMarkdown = useCallback((before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.content || '';
    const selected = text.substring(start, end);

    const newText = text.substring(0, start) + before + selected + after + text.substring(end);
    setFormData(prev => ({ ...prev, content: newText }));

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      const newPos = start + before.length + selected.length;
      textarea.setSelectionRange(
        selected ? start + before.length : newPos,
        selected ? start + before.length + selected.length : newPos
      );
    }, 0);
  }, [formData.content]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Build tags JSON from input
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      const saveData = {
        ...formData,
        tags_json: tags.length ? JSON.stringify(tags) : null
      };
      await onSave(saveData);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      // Clear draft from localStorage
      localStorage.removeItem(`toast_hub_draft_${formData.id || 'new'}`);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const words = wordCount(formData.content || '');

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-200px)]">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800/80 border-b border-gray-700 rounded-t-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <span className="text-gray-600">|</span>
          <span className="text-sm text-gray-400">
            {formData.id ? 'Editing' : 'New Post'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {words} words &middot; {readingTime(words)}
          </span>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`p-2 rounded-lg text-sm ${showPreview ? 'bg-amber-500/20 text-amber-400' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
            title={showPreview ? 'Hide preview' : 'Show preview'}
          >
            {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setShowSEO(!showSEO)}
            className={`p-2 rounded-lg text-sm ${showSEO ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
            title="SEO settings"
          >
            <Globe className="w-4 h-4" />
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !formData.title}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> :
             saved ? <Check className="w-4 h-4" /> :
             <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Panel */}
        <div className={`flex-1 flex flex-col overflow-hidden ${showPreview ? 'w-1/2' : 'w-full'}`}>
          {/* Title & Meta */}
          <div className="p-4 space-y-3 border-b border-gray-700/50">
            <input
              type="text"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              placeholder="Post title..."
              className="w-full text-xl font-bold bg-transparent text-white placeholder-gray-500 focus:outline-none"
            />
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <span>/toast-hub/</span>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={e => { setAutoSlug(false); setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }); }}
                  className="bg-transparent text-gray-300 font-mono text-xs focus:outline-none w-48 border-b border-dashed border-gray-600"
                />
              </div>
              <select
                value={formData.category || ''}
                onChange={e => setFormData({ ...formData, category: e.target.value || null })}
                className="text-xs bg-gray-800 border border-gray-600 text-white rounded px-2 py-1"
              >
                <option value="">No category</option>
                {categories.map(c => (
                  <option key={c.id} value={c.slug}>{c.name}</option>
                ))}
              </select>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                className="text-xs bg-gray-800 border border-gray-600 text-white rounded px-2 py-1"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="scheduled">Scheduled</option>
                <option value="archived">Archived</option>
              </select>
              <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.featured}
                  onChange={e => setFormData({ ...formData, featured: e.target.checked })}
                  className="rounded border-gray-600 text-amber-500 focus:ring-amber-500"
                />
                Featured
              </label>
            </div>
            <textarea
              value={formData.excerpt || ''}
              onChange={e => setFormData({ ...formData, excerpt: e.target.value })}
              placeholder="Brief excerpt for cards and SEO..."
              rows={2}
              className="w-full text-sm bg-transparent text-gray-300 placeholder-gray-600 focus:outline-none resize-none border-b border-gray-700/50 pb-2"
            />
          </div>

          {/* Markdown Toolbar */}
          <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-700/50 bg-gray-800/30 flex-wrap">
            <ToolbarButton icon={Bold} title="Bold (Ctrl+B)" onClick={() => insertMarkdown('**', '**')} />
            <ToolbarButton icon={Italic} title="Italic (Ctrl+I)" onClick={() => insertMarkdown('*', '*')} />
            <span className="w-px h-4 bg-gray-700 mx-1" />
            <ToolbarButton icon={Heading1} title="Heading 1" onClick={() => insertMarkdown('# ', '')} />
            <ToolbarButton icon={Heading2} title="Heading 2" onClick={() => insertMarkdown('## ', '')} />
            <ToolbarButton icon={Heading3} title="Heading 3" onClick={() => insertMarkdown('### ', '')} />
            <span className="w-px h-4 bg-gray-700 mx-1" />
            <ToolbarButton icon={Link2} title="Link (Ctrl+K)" onClick={() => insertMarkdown('[', '](url)')} />
            <ToolbarButton icon={Image} title="Image" onClick={() => insertMarkdown('![alt](', ')')} />
            <ToolbarButton icon={Code} title="Code" onClick={() => insertMarkdown('`', '`')} />
            <span className="w-px h-4 bg-gray-700 mx-1" />
            <ToolbarButton icon={List} title="Bullet List" onClick={() => insertMarkdown('- ', '')} />
            <ToolbarButton icon={ListOrdered} title="Numbered List" onClick={() => insertMarkdown('1. ', '')} />
            <ToolbarButton icon={Quote} title="Blockquote" onClick={() => insertMarkdown('> ', '')} />
            <ToolbarButton icon={Minus} title="Horizontal Rule" onClick={() => insertMarkdown('\n---\n', '')} />
          </div>

          {/* Content Textarea */}
          <textarea
            ref={textareaRef}
            value={formData.content || ''}
            onChange={e => setFormData({ ...formData, content: e.target.value })}
            placeholder="Write your content in markdown..."
            className="flex-1 w-full px-4 py-3 bg-transparent text-white font-mono text-sm resize-none focus:outline-none leading-relaxed overflow-y-auto"
          />

          {/* Tags Input */}
          <div className="px-4 py-2 border-t border-gray-700/50">
            <div className="flex items-center gap-2">
              <Tag className="w-3 h-3 text-gray-500" />
              <input
                type="text"
                value={tagsInput}
                onChange={e => setTagsInput(e.target.value)}
                placeholder="Tags (comma separated)"
                className="flex-1 text-xs bg-transparent text-gray-300 placeholder-gray-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Preview Panel */}
        {showPreview && (
          <div className="w-1/2 border-l border-gray-700 overflow-y-auto bg-white p-8">
            <article className="max-w-2xl mx-auto prose">
              {formData.category && (
                <span className="inline-block px-3 py-1 bg-amber-100 text-amber-700 text-xs font-semibold uppercase rounded-full mb-4">
                  {categories.find(c => c.slug === formData.category)?.name || formData.category}
                </span>
              )}
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {formData.title || 'Untitled'}
              </h1>
              {formData.excerpt && (
                <p className="text-lg text-gray-600 mb-6 border-b pb-6">
                  {formData.excerpt}
                </p>
              )}
              <div
                className="text-gray-700 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: markdownToHtml(formData.content || '') }}
              />
            </article>
          </div>
        )}

        {/* SEO Panel */}
        {showSEO && (
          <div className="w-80 border-l border-gray-700 overflow-y-auto p-4 space-y-4 bg-gray-800/50">
            <h4 className="text-sm font-medium text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-400" />
              SEO Settings
            </h4>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Meta Title ({(formData.meta_title || formData.title || '').length}/60)
              </label>
              <input
                type="text"
                value={formData.meta_title || ''}
                onChange={e => setFormData({ ...formData, meta_title: e.target.value })}
                placeholder={formData.title || 'Page title'}
                maxLength={60}
                className="w-full px-3 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Meta Description ({(formData.meta_description || '').length}/160)
              </label>
              <textarea
                value={formData.meta_description || ''}
                onChange={e => setFormData({ ...formData, meta_description: e.target.value })}
                placeholder={formData.excerpt || 'Page description for search results'}
                maxLength={160}
                rows={3}
                className="w-full px-3 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm resize-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* SERP Preview */}
            <div className="bg-white rounded-lg p-3 mt-4">
              <p className="text-xs text-gray-500 mb-2">Search Preview</p>
              <p className="text-blue-700 text-sm font-medium truncate">
                {formData.meta_title || formData.title || 'Page Title'}
              </p>
              <p className="text-green-700 text-xs truncate">
                ccrestaurantconsulting.com/toast-hub/{formData.slug || 'post-slug'}
              </p>
              <p className="text-gray-600 text-xs line-clamp-2 mt-0.5">
                {formData.meta_description || formData.excerpt || 'No description set'}
              </p>
            </div>

            {/* SEO Score */}
            <div className="space-y-2 pt-2">
              <p className="text-xs font-medium text-gray-300">SEO Checklist</p>
              <SEOCheck label="Title length (30-60 chars)" pass={(formData.title?.length || 0) >= 30 && (formData.title?.length || 0) <= 60} />
              <SEOCheck label="Meta description set" pass={!!formData.meta_description} />
              <SEOCheck label="Excerpt provided" pass={!!formData.excerpt} />
              <SEOCheck label="Category assigned" pass={!!formData.category} />
              <SEOCheck label="Has headings" pass={/^#{1,3}\s/m.test(formData.content || '')} />
              <SEOCheck label="300+ words" pass={words >= 300} />
              <SEOCheck label="Has internal links" pass={/\[.+\]\(/.test(formData.content || '')} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolbarButton({ icon: Icon, title, onClick }: { icon: any; title: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

function SEOCheck({ label, pass }: { label: string; pass: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {pass ? (
        <Check className="w-3 h-3 text-green-400" />
      ) : (
        <AlertCircle className="w-3 h-3 text-gray-500" />
      )}
      <span className={pass ? 'text-green-400' : 'text-gray-500'}>{label}</span>
    </div>
  );
}
