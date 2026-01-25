import React, { useState } from 'react';
import {
  Mail, X, Send, Loader2, Users, Target, TestTube,
  AlertCircle, Check, ChevronDown
} from 'lucide-react';

interface NotifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  postTitle: string;
  postExcerpt?: string | null;
}

const RECIPIENT_FILTERS = [
  { value: 'all', label: 'All Subscribers', description: 'Clients + email subscribers', icon: Users },
  { value: 'active_clients', label: 'Active Clients Only', description: 'Only portal-enabled clients', icon: Target },
  { value: 'leads', label: 'Leads Only', description: 'Email subscribers (non-clients)', icon: Mail }
];

export default function NotifyModal({
  isOpen,
  onClose,
  postId,
  postTitle,
  postExcerpt
}: NotifyModalProps) {
  const [recipientFilter, setRecipientFilter] = useState('all');
  const [subjectOverride, setSubjectOverride] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [testMode, setTestMode] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);

  const handleSend = async () => {
    if (testMode && !testEmail) {
      alert('Please enter a test email address');
      return;
    }

    if (!testMode && !confirm(`Send newsletter to ${recipientFilter === 'all' ? 'all subscribers' : recipientFilter.replace('_', ' ')}?`)) {
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const res = await fetch('/api/admin/toast-hub/notify-subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content_id: postId,
          subject_override: subjectOverride || undefined,
          preview_text: previewText || undefined,
          recipient_filter: recipientFilter,
          test_mode: testMode,
          test_email: testMode ? testEmail : undefined
        })
      });

      const data = await res.json();

      if (data.success) {
        setResult({
          success: true,
          message: data.message,
          details: data.data
        });
      } else {
        setResult({
          success: false,
          message: data.error || 'Failed to send'
        });
      }
    } catch (err: any) {
      setResult({
        success: false,
        message: err.message || 'Failed to send'
      });
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg m-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Mail className="w-5 h-5 text-amber-400" />
              Send Newsletter
            </h3>
            <p className="text-sm text-gray-400 mt-0.5 truncate max-w-md">{postTitle}</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success/Error Result */}
        {result && (
          <div className={`mx-6 mt-6 p-4 rounded-lg border ${
            result.success
              ? 'bg-green-500/20 border-green-500/50'
              : 'bg-red-500/20 border-red-500/50'
          }`}>
            <div className="flex items-start gap-3">
              {result.success ? (
                <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              )}
              <div>
                <p className={result.success ? 'text-green-400' : 'text-red-400'}>
                  {result.message}
                </p>
                {result.details && (
                  <p className="text-sm text-gray-400 mt-1">
                    Sent to {result.details.sent_count} recipient(s)
                    {result.details.failed_count > 0 && ` (${result.details.failed_count} failed)`}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Test Mode Toggle */}
          <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
            <div className="flex items-center gap-2">
              <TestTube className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-gray-300">Test Mode</span>
            </div>
            <button
              onClick={() => setTestMode(!testMode)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                testMode ? 'bg-blue-500' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  testMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Test Email Input */}
          {testMode && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Test Email Address</label>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Recipient Filter */}
          {!testMode && (
            <div>
              <label className="block text-xs text-gray-400 mb-2">Recipients</label>
              <div className="space-y-2">
                {RECIPIENT_FILTERS.map(filter => {
                  const Icon = filter.icon;
                  return (
                    <div
                      key={filter.value}
                      onClick={() => setRecipientFilter(filter.value)}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        recipientFilter === filter.value
                          ? 'bg-amber-500/20 border border-amber-500/50'
                          : 'bg-gray-900/50 border border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        recipientFilter === filter.value
                          ? 'bg-amber-500 border-amber-500'
                          : 'border-gray-600'
                      }`}>
                        {recipientFilter === filter.value && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <Icon className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-white">{filter.label}</p>
                        <p className="text-xs text-gray-500">{filter.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Subject Override */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Subject Line (optional override)
            </label>
            <input
              type="text"
              value={subjectOverride}
              onChange={(e) => setSubjectOverride(e.target.value)}
              placeholder={`New from Toast Hub: ${postTitle}`}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Preview Text */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Preview Text (appears in inbox)
            </label>
            <input
              type="text"
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              placeholder={postExcerpt || 'Email preview text...'}
              maxLength={150}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <p className="text-xs text-gray-500 mt-1">{previewText.length}/150</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {testMode
              ? 'Test email will be sent to you only'
              : `Will send to ${recipientFilter.replace('_', ' ')}`}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
            >
              {result?.success ? 'Done' : 'Cancel'}
            </button>
            {!result?.success && (
              <button
                onClick={handleSend}
                disabled={sending || (testMode && !testEmail)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {sending ? 'Sending...' : testMode ? 'Send Test' : 'Send Newsletter'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
