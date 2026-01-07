import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Edit3,
  Eye,
  X,
  Save,
  Loader2,
  AlertCircle,
  Search,
  Code,
  AlignLeft,
  Copy,
  Check
} from 'lucide-react';
import TokenInserter, { EMAIL_TOKENS } from './TokenInserter';
import TemplatePreview from './TemplatePreview';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface EmailTemplate {
  id: string;
  name: string;
  subject?: string;
  body?: string;
  is_html: boolean;
  created_at?: number;
  updated_at?: number;
}

interface EmailTemplateEditorProps {
  onSelectTemplate?: (template: EmailTemplate) => void;
  showSelectButton?: boolean;
}

// ============================================
// TEMPLATE FORM MODAL
// ============================================

interface TemplateFormModalProps {
  template?: EmailTemplate | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: Partial<EmailTemplate>) => Promise<void>;
}

const TemplateFormModal: React.FC<TemplateFormModalProps> = ({
  template,
  isOpen,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState<Partial<EmailTemplate>>({
    name: '',
    subject: '',
    body: '',
    is_html: false
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        subject: template.subject || '',
        body: template.body || '',
        is_html: template.is_html
      });
    } else {
      setFormData({
        name: '',
        subject: '',
        body: '',
        is_html: false
      });
    }
    setError(null);
  }, [template, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name?.trim()) {
      setError('Template name is required');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-6xl max-h-[90vh] bg-gray-900 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            {template ? 'Edit Template' : 'Create Template'}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                showPreview
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 flex overflow-hidden">
          {/* Editor Side */}
          <div className={`flex-1 p-6 overflow-auto ${showPreview ? 'w-1/2' : 'w-full'}`}>
            {error && (
              <div className="flex items-center gap-2 p-4 mb-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Template Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Initial Outreach, Follow-up, Thank You"
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  autoFocus
                />
              </div>

              {/* Subject Line */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-300">Subject Line</label>
                  <TokenInserter
                    targetRef={subjectRef}
                    onInsert={() => {}}
                    size="sm"
                  />
                </div>
                <input
                  ref={subjectRef}
                  type="text"
                  value={formData.subject || ''}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Hi {{first_name}}, about your Toast setup..."
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Content Type Toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Content Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, is_html: false })}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                      !formData.is_html
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                        : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
                    }`}
                  >
                    <AlignLeft className="w-4 h-4" />
                    Plain Text
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, is_html: true })}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                      formData.is_html
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                        : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
                    }`}
                  >
                    <Code className="w-4 h-4" />
                    HTML
                  </button>
                </div>
              </div>

              {/* Body */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-300">Email Body</label>
                  <TokenInserter
                    targetRef={bodyRef}
                    onInsert={() => {}}
                    size="sm"
                  />
                </div>
                <textarea
                  ref={bodyRef}
                  value={formData.body || ''}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  placeholder={formData.is_html
                    ? '<p>Hello {{first_name}},</p>\n<p>I noticed you are using Toast POS at {{company}}...</p>'
                    : 'Hello {{first_name}},\n\nI noticed you are using Toast POS at {{company}}...'
                  }
                  rows={12}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-y font-mono text-sm"
                />
              </div>

              {/* Token Reference */}
              <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <h4 className="text-sm font-medium text-gray-400 mb-2">Available Tokens</h4>
                <div className="flex flex-wrap gap-2">
                  {EMAIL_TOKENS.map((token) => (
                    <span
                      key={token.token}
                      className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded font-mono"
                    >
                      {token.token}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Preview Side */}
          {showPreview && (
            <div className="w-1/2 border-l border-gray-700 flex flex-col bg-gray-800">
              <div className="p-3 border-b border-gray-700 bg-gray-900">
                <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Live Preview
                </h3>
              </div>
              <div className="flex-1 overflow-hidden">
                <TemplatePreview
                  subject={formData.subject || ''}
                  body={formData.body || ''}
                  isHtml={formData.is_html || false}
                />
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {template ? 'Save Changes' : 'Create Template'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// TEMPLATE CARD COMPONENT
// ============================================

interface TemplateCardProps {
  template: EmailTemplate;
  onEdit: () => void;
  onDelete: () => void;
  onSelect?: () => void;
  showSelectButton?: boolean;
}

const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  onEdit,
  onDelete,
  onSelect,
  showSelectButton
}) => {
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = `Subject: ${template.subject || ''}\n\n${template.body || ''}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Truncate body for preview
  const truncatedBody = (template.body || '').substring(0, 150);
  const hasMore = (template.body || '').length > 150;

  return (
    <div className="admin-card hover:border-gray-600 transition-colors group">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-white font-medium">{template.name}</h3>
              <span className={`text-xs ${template.is_html ? 'text-purple-400' : 'text-gray-500'}`}>
                {template.is_html ? 'HTML' : 'Plain Text'}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Preview"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={handleCopy}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Copy content"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={onEdit}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Edit"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Subject */}
        {template.subject && (
          <div className="mb-2">
            <span className="text-xs text-gray-500">Subject: </span>
            <span className="text-sm text-gray-300">{template.subject}</span>
          </div>
        )}

        {/* Body Preview */}
        <p className="text-gray-500 text-sm line-clamp-2">
          {truncatedBody}{hasMore && '...'}
        </p>

        {/* Select Button */}
        {showSelectButton && onSelect && (
          <button
            onClick={onSelect}
            className="mt-3 w-full px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/50 text-amber-400 rounded-lg text-sm transition-colors"
          >
            Use This Template
          </button>
        )}

        {/* Expanded Preview */}
        {showPreview && (
          <div className="mt-4 border-t border-gray-700 pt-4">
            <div className="h-64 rounded-lg overflow-hidden border border-gray-700">
              <TemplatePreview
                subject={template.subject || ''}
                body={template.body || ''}
                isHtml={template.is_html}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

const EmailTemplateEditor: React.FC<EmailTemplateEditorProps> = ({
  onSelectTemplate,
  showSelectButton = false
}) => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);

  // Load templates
  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/email/templates');
      const result = await response.json();
      if (result.success) {
        setTemplates(result.data || []);
      } else {
        setError(result.error || 'Failed to load templates');
      }
    } catch (err) {
      setError('Failed to load templates');
      console.error('Load templates error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Filter templates by search
  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.subject || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Save template (create or update)
  const handleSaveTemplate = async (data: Partial<EmailTemplate>) => {
    const isEdit = !!editingTemplate;
    const url = isEdit
      ? `/api/admin/email/templates/${editingTemplate.id}`
      : '/api/admin/email/templates';

    const response = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to save template');
    }

    await loadTemplates();
  };

  // Delete template
  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/email/templates/${id}`, {
        method: 'DELETE'
      });
      const result = await response.json();
      if (result.success) {
        setTemplates(templates.filter(t => t.id !== id));
      } else {
        setError(result.error || 'Failed to delete template');
      }
    } catch (err) {
      setError('Failed to delete template');
      console.error('Delete template error:', err);
    }
  };

  // Open create modal
  const handleCreate = () => {
    setEditingTemplate(null);
    setShowModal(true);
  };

  // Open edit modal
  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setShowModal(true);
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            Email Templates
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {templates.length} template{templates.length !== 1 ? 's' : ''} available
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Template
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search templates..."
          className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-12 bg-gray-900/30 rounded-lg border border-gray-700 border-dashed">
          <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          {searchQuery ? (
            <>
              <h3 className="text-lg font-medium text-gray-400 mb-2">No Templates Found</h3>
              <p className="text-gray-500 text-sm">
                No templates match "{searchQuery}"
              </p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-medium text-gray-400 mb-2">No Templates Yet</h3>
              <p className="text-gray-500 text-sm mb-4">
                Create your first email template to get started
              </p>
              <button
                onClick={handleCreate}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Template
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={() => handleEdit(template)}
              onDelete={() => handleDeleteTemplate(template.id)}
              onSelect={onSelectTemplate ? () => onSelectTemplate(template) : undefined}
              showSelectButton={showSelectButton}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <TemplateFormModal
        template={editingTemplate}
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingTemplate(null);
        }}
        onSave={handleSaveTemplate}
      />
    </div>
  );
};

export default EmailTemplateEditor;
