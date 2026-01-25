import React, { useState, useEffect } from 'react';
import {
  FileText, X, Check, Loader2, BookOpen, Lightbulb, Newspaper,
  GraduationCap, Megaphone, ClipboardList
} from 'lucide-react';

interface Template {
  id: string;
  name: string;
  template_type: string;
  description: string | null;
  default_content: string | null;
  usage_count: number;
}

interface TemplateSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (template: Template) => void;
}

const TYPE_ICONS: Record<string, any> = {
  article: Newspaper,
  guide: BookOpen,
  faq: Lightbulb,
  announcement: Megaphone,
  case_study: FileText,
  tutorial: GraduationCap
};

const TYPE_COLORS: Record<string, string> = {
  article: 'text-blue-400 bg-blue-500/20',
  guide: 'text-green-400 bg-green-500/20',
  faq: 'text-amber-400 bg-amber-500/20',
  announcement: 'text-purple-400 bg-purple-500/20',
  case_study: 'text-pink-400 bg-pink-500/20',
  tutorial: 'text-cyan-400 bg-cyan-500/20'
};

export default function TemplateSelector({ isOpen, onClose, onSelect }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string>('');
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/toast-hub/import-from-beacon', {
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success) {
        setTemplates(data.data.templates || []);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (template: Template) => {
    onSelect(template);
    onClose();
  };

  const filteredTemplates = templates.filter(tpl =>
    !selectedType || tpl.template_type === selectedType
  );

  const templateTypes = Array.from(new Set(templates.map(t => t.template_type)));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8">
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-3xl m-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-amber-400" />
              Content Templates
            </h3>
            <p className="text-sm text-gray-400 mt-0.5">
              Start with a pre-built structure
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Type filters */}
        <div className="px-6 py-3 border-b border-gray-700">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedType('')}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                selectedType === ''
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              All Types
            </button>
            {templateTypes.map(type => {
              const Icon = TYPE_ICONS[type] || FileText;
              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    selectedType === type
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="capitalize">{type.replace('_', ' ')}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Templates list */}
        <div className="p-6 max-h-[500px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No templates found</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredTemplates.map(template => {
                const Icon = TYPE_ICONS[template.template_type] || FileText;
                const colorClass = TYPE_COLORS[template.template_type] || 'text-gray-400 bg-gray-500/20';

                return (
                  <div
                    key={template.id}
                    className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-white font-medium">{template.name}</h4>
                          <p className="text-sm text-gray-400 mt-0.5">
                            {template.description || `${template.template_type} template`}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                            <span className="capitalize">{template.template_type.replace('_', ' ')}</span>
                            <span>Used {template.usage_count} times</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {template.default_content && (
                          <button
                            onClick={() => setPreviewTemplate(
                              previewTemplate?.id === template.id ? null : template
                            )}
                            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                          >
                            Preview
                          </button>
                        )}
                        <button
                          onClick={() => handleSelect(template)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          <Check className="w-4 h-4" />
                          Use
                        </button>
                      </div>
                    </div>

                    {/* Content preview */}
                    {previewTemplate?.id === template.id && template.default_content && (
                      <div className="mt-4 p-4 bg-gray-800 rounded-lg">
                        <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
                          {template.default_content}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700">
          <button
            onClick={() => onSelect({ id: '', name: 'Blank', template_type: 'article', description: null, default_content: '', usage_count: 0 })}
            className="text-sm text-gray-400 hover:text-white"
          >
            Or start with a blank post
          </button>
        </div>
      </div>
    </div>
  );
}
