import React, { useState, useEffect } from 'react';
import {
  HelpCircle, Plus, Edit3, Trash2, GripVertical, Eye, EyeOff,
  Loader2, Check, X, ChevronDown, ChevronUp, Save, RefreshCw
} from 'lucide-react';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  display_order: number;
  is_active: number;
  view_count: number;
  created_at: number;
  updated_at: number;
}

const FAQ_CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'implementation', label: 'Implementation' },
  { value: 'support', label: 'Support' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'technical', label: 'Technical' },
  { value: 'migration', label: 'Migration' }
];

export default function FAQManager() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newFaq, setNewFaq] = useState({ question: '', answer: '', category: 'general' });
  const [editForm, setEditForm] = useState<Partial<FAQ>>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  };

  const loadFaqs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/toast-hub/faqs', { credentials: 'include' });
      const data = await res.json();
      if (data.success) setFaqs(data.data || []);
    } catch (err) {
      console.error('Failed to load FAQs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFaqs(); }, []);

  const createFaq = async () => {
    if (!newFaq.question.trim() || !newFaq.answer.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/toast-hub/faqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newFaq)
      });
      const data = await res.json();
      if (data.success) {
        setFaqs(prev => [...prev, data.data]);
        setNewFaq({ question: '', answer: '', category: 'general' });
        setShowAddForm(false);
        showToast('success', 'FAQ created');
      }
    } catch (err) {
      showToast('error', 'Failed to create FAQ');
    } finally {
      setSaving(false);
    }
  };

  const updateFaq = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/toast-hub/faqs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editForm)
      });
      const data = await res.json();
      if (data.success) {
        setFaqs(prev => prev.map(f => f.id === id ? data.data : f));
        setEditingId(null);
        showToast('success', 'FAQ updated');
      }
    } catch (err) {
      showToast('error', 'Failed to update FAQ');
    } finally {
      setSaving(false);
    }
  };

  const deleteFaq = async (id: string) => {
    if (!confirm('Delete this FAQ?')) return;
    try {
      await fetch(`/api/admin/toast-hub/faqs/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      setFaqs(prev => prev.filter(f => f.id !== id));
      showToast('success', 'FAQ deleted');
    } catch (err) {
      showToast('error', 'Failed to delete FAQ');
    }
  };

  const toggleActive = async (faq: FAQ) => {
    try {
      const res = await fetch(`/api/admin/toast-hub/faqs/${faq.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: !faq.is_active })
      });
      const data = await res.json();
      if (data.success) {
        setFaqs(prev => prev.map(f => f.id === faq.id ? data.data : f));
      }
    } catch (err) {
      showToast('error', 'Failed to toggle FAQ');
    }
  };

  const moveUp = async (index: number) => {
    if (index === 0) return;
    const newOrder = [...faqs];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setFaqs(newOrder);
    await saveOrder(newOrder.map(f => f.id));
  };

  const moveDown = async (index: number) => {
    if (index === faqs.length - 1) return;
    const newOrder = [...faqs];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setFaqs(newOrder);
    await saveOrder(newOrder.map(f => f.id));
  };

  const saveOrder = async (order: string[]) => {
    try {
      await fetch('/api/admin/toast-hub/faqs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ order })
      });
    } catch (err) {
      console.error('Failed to save order:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toast notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium animate-in fade-in ${
          toast.type === 'success' ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white'
        }`}>
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-amber-400" />
            FAQ Management
          </h3>
          <p className="text-sm text-gray-400">
            {faqs.length} FAQs, {faqs.filter(f => f.is_active).length} active
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadFaqs}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm"
          >
            <Plus className="w-4 h-4" />
            Add FAQ
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-gray-800/80 border border-gray-700 rounded-lg p-4 space-y-3">
          <input
            type="text"
            placeholder="Question"
            value={newFaq.question}
            onChange={e => setNewFaq({ ...newFaq, question: e.target.value })}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-amber-500"
          />
          <textarea
            placeholder="Answer"
            value={newFaq.answer}
            onChange={e => setNewFaq({ ...newFaq, answer: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm resize-none focus:ring-2 focus:ring-amber-500"
          />
          <div className="flex items-center justify-between">
            <select
              value={newFaq.category}
              onChange={e => setNewFaq({ ...newFaq, category: e.target.value })}
              className="px-3 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm"
            >
              {FAQ_CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowAddForm(false); setNewFaq({ question: '', answer: '', category: 'general' }); }}
                className="px-3 py-1.5 text-gray-400 hover:text-white text-sm"
              >
                Cancel
              </button>
              <button
                onClick={createFaq}
                disabled={saving || !newFaq.question.trim() || !newFaq.answer.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-sm disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAQ List */}
      <div className="space-y-2">
        {faqs.map((faq, index) => (
          <div
            key={faq.id}
            className={`bg-gray-800/50 border rounded-lg transition-all ${
              faq.is_active ? 'border-gray-700' : 'border-gray-800 opacity-60'
            }`}
          >
            {editingId === faq.id ? (
              /* Edit Mode */
              <div className="p-4 space-y-3">
                <input
                  type="text"
                  value={editForm.question || ''}
                  onChange={e => setEditForm({ ...editForm, question: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-amber-500"
                />
                <textarea
                  value={editForm.answer || ''}
                  onChange={e => setEditForm({ ...editForm, answer: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm resize-none focus:ring-2 focus:ring-amber-500"
                />
                <div className="flex items-center justify-between">
                  <select
                    value={editForm.category || 'general'}
                    onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                    className="px-3 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm"
                  >
                    {FAQ_CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 text-gray-400 hover:text-white text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => updateFaq(faq.id)}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-sm disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      Save
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* View Mode */
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {/* Reorder controls */}
                  <div className="flex flex-col gap-0.5 pt-1">
                    <button
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                      className="text-gray-500 hover:text-white disabled:opacity-30 p-0.5"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <GripVertical className="w-3 h-3 text-gray-600" />
                    <button
                      onClick={() => moveDown(index)}
                      disabled={index === faqs.length - 1}
                      className="text-gray-500 hover:text-white disabled:opacity-30 p-0.5"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div
                      className="cursor-pointer"
                      onClick={() => setExpandedId(expandedId === faq.id ? null : faq.id)}
                    >
                      <p className="text-white text-sm font-medium">{faq.question}</p>
                      {expandedId === faq.id && (
                        <p className="text-gray-400 text-sm mt-2 whitespace-pre-wrap">{faq.answer}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      {faq.category && (
                        <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-300 rounded">
                          {faq.category}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">#{faq.display_order}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleActive(faq)}
                      className={`p-1.5 rounded transition-colors ${
                        faq.is_active ? 'text-green-400 hover:bg-green-500/10' : 'text-gray-500 hover:bg-gray-700'
                      }`}
                      title={faq.is_active ? 'Active - click to hide' : 'Hidden - click to show'}
                    >
                      {faq.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(faq.id);
                        setEditForm({ question: faq.question, answer: faq.answer, category: faq.category });
                      }}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteFaq(faq.id)}
                      className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {faqs.length === 0 && !showAddForm && (
        <div className="text-center py-8 bg-gray-800/50 border border-gray-700 rounded-lg">
          <HelpCircle className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 mb-2">No FAQs yet</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600"
          >
            Add First FAQ
          </button>
        </div>
      )}
    </div>
  );
}
