import React, { useState, useEffect, useMemo } from 'react';
import {
  Eye,
  Monitor,
  Smartphone,
  Code,
  AlignLeft,
  Send,
  Copy,
  Check,
  RefreshCw,
  Search,
  User,
  X,
  Loader2,
  AlertCircle,
  ChevronDown
} from 'lucide-react';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface SampleData {
  first_name: string;
  last_name: string;
  company: string;
  email: string;
  phone: string;
  unsubscribe_link: string;
  [key: string]: string; // Allow custom fields
}

export interface PreviewMode {
  device: 'desktop' | 'mobile';
  view: 'rendered' | 'html' | 'text';
}

interface TemplatePreviewProps {
  subject: string;
  body: string;
  isHtml?: boolean;
  sampleData?: Partial<SampleData>;
  onSampleDataChange?: (data: SampleData) => void;
  showTestEmail?: boolean;
  templateId?: string;
  className?: string;
}

// ============================================
// DEFAULT SAMPLE DATA
// ============================================

const DEFAULT_SAMPLE_DATA: SampleData = {
  first_name: 'John',
  last_name: 'Smith',
  company: 'The Seafood Shack',
  email: 'john@seafoodshack.com',
  phone: '508-555-1234',
  unsubscribe_link: 'https://ccrestaurantconsulting.com/unsubscribe/abc123'
};

// Sample subscribers for quick selection
const SAMPLE_SUBSCRIBERS = [
  { first_name: 'John', last_name: 'Smith', company: 'The Seafood Shack', email: 'john@seafoodshack.com', phone: '508-555-1234' },
  { first_name: 'Sarah', last_name: 'Johnson', company: 'Cape Cod Bistro', email: 'sarah@capecodbistro.com', phone: '508-555-2345' },
  { first_name: 'Mike', last_name: 'Williams', company: 'Harbor View Restaurant', email: 'mike@harborview.com', phone: '508-555-3456' },
  { first_name: 'Emily', last_name: 'Brown', company: 'Oceanside Grill', email: 'emily@oceansidegrill.com', phone: '508-555-4567' }
];

// ============================================
// SAMPLE DATA EDITOR
// ============================================

interface SampleDataEditorProps {
  data: SampleData;
  onChange: (data: SampleData) => void;
  onReset: () => void;
}

const SampleDataEditor: React.FC<SampleDataEditorProps> = ({
  data,
  onChange,
  onReset
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSubscriberPicker, setShowSubscriberPicker] = useState(false);

  const handleFieldChange = (field: string, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const handleSelectSubscriber = (subscriber: typeof SAMPLE_SUBSCRIBERS[0]) => {
    onChange({
      ...data,
      ...subscriber,
      unsubscribe_link: `https://ccrestaurantconsulting.com/unsubscribe/${crypto.randomUUID().slice(0, 8)}`
    });
    setShowSubscriberPicker(false);
  };

  const fields = [
    { key: 'first_name', label: 'First Name', placeholder: 'John' },
    { key: 'last_name', label: 'Last Name', placeholder: 'Smith' },
    { key: 'company', label: 'Company', placeholder: 'Restaurant Name' },
    { key: 'email', label: 'Email', placeholder: 'email@example.com' },
    { key: 'phone', label: 'Phone', placeholder: '508-555-1234' }
  ];

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-300">Sample Data</span>
          <span className="text-xs text-gray-500">({data.first_name} {data.last_name})</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {isExpanded && (
        <div className="p-3 border-t border-gray-700 space-y-3">
          {/* Quick Select */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <button
                type="button"
                onClick={() => setShowSubscriberPicker(!showSubscriberPicker)}
                className="w-full flex items-center gap-2 px-3 py-1.5 bg-gray-900 border border-gray-600 rounded text-sm text-gray-300 hover:border-gray-500"
              >
                <Search className="w-3 h-3" />
                Quick fill with sample...
              </button>

              {showSubscriberPicker && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                  {SAMPLE_SUBSCRIBERS.map((sub, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectSubscriber(sub)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-700 transition-colors"
                    >
                      <div className="text-white text-sm">{sub.first_name} {sub.last_name}</div>
                      <div className="text-gray-500 text-xs">{sub.company}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1 px-2 py-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
              title="Reset to defaults"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>

          {/* Fields */}
          <div className="grid grid-cols-2 gap-2">
            {fields.map((field) => (
              <div key={field.key}>
                <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                <input
                  type="text"
                  value={data[field.key] || ''}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full px-2 py-1 bg-gray-900 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// DEVICE FRAME
// ============================================

interface DeviceFrameProps {
  device: 'desktop' | 'mobile';
  children: React.ReactNode;
}

const DeviceFrame: React.FC<DeviceFrameProps> = ({ device, children }) => {
  if (device === 'mobile') {
    return (
      <div className="flex justify-center py-4">
        <div className="relative w-[375px] bg-gray-900 rounded-[2.5rem] p-2 shadow-2xl">
          {/* Phone notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-900 rounded-b-2xl z-10" />
          {/* Screen */}
          <div className="bg-white rounded-[2rem] overflow-hidden h-[667px]">
            {children}
          </div>
          {/* Home indicator */}
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-32 h-1 bg-gray-700 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg overflow-hidden border border-gray-300 shadow-lg">
      {children}
    </div>
  );
};

// ============================================
// TEST EMAIL MODAL
// ============================================

interface TestEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject: string;
  body: string;
  isHtml: boolean;
  templateId?: string;
}

const TestEmailModal: React.FC<TestEmailModalProps> = ({
  isOpen,
  onClose,
  subject,
  body,
  isHtml,
  templateId
}) => {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSend = async () => {
    if (!recipientEmail.trim()) {
      setResult({ success: false, message: 'Please enter an email address' });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/admin/email/templates/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: recipientEmail,
          subject,
          body,
          is_html: isHtml,
          template_id: templateId
        })
      });

      const data = await response.json();
      if (data.success) {
        setResult({ success: true, message: 'Test email sent successfully!' });
      } else {
        setResult({ success: false, message: data.error || 'Failed to send test email' });
      }
    } catch (err) {
      setResult({ success: false, message: 'Failed to send test email' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-md bg-gray-900 rounded-xl shadow-2xl">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
            <Send className="w-5 h-5 text-amber-400" />
            Send Test Email
          </h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Send to Email</label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="your-email@example.com"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="text-sm text-gray-500">
            Subject: <span className="text-gray-300">{subject || '(no subject)'}</span>
          </div>

          {result && (
            <div className={`flex items-center gap-2 p-3 rounded-lg border ${
              result.success
                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              {result.success ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {result.message}
            </div>
          )}

          <button
            type="button"
            onClick={handleSend}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send Test
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// MAIN TEMPLATE PREVIEW COMPONENT
// ============================================

const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  subject,
  body,
  isHtml = false,
  sampleData: externalSampleData,
  onSampleDataChange,
  showTestEmail = true,
  templateId,
  className = ''
}) => {
  const [sampleData, setSampleData] = useState<SampleData>({
    ...DEFAULT_SAMPLE_DATA,
    ...externalSampleData
  });
  const [mode, setMode] = useState<PreviewMode>({
    device: 'desktop',
    view: 'rendered'
  });
  const [copied, setCopied] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [unreplacedTokens, setUnreplacedTokens] = useState<string[]>([]);

  // Update local state when external sample data changes
  useEffect(() => {
    if (externalSampleData) {
      setSampleData(prev => ({ ...prev, ...externalSampleData }));
    }
  }, [externalSampleData]);

  // Handle sample data changes
  const handleSampleDataChange = (data: SampleData) => {
    setSampleData(data);
    onSampleDataChange?.(data);
  };

  // Replace tokens with sample data
  const renderContent = useMemo(() => {
    let renderedSubject = subject || '';
    let renderedBody = body || '';
    const unreplaced: string[] = [];

    // Replace all tokens
    Object.entries(sampleData).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      renderedSubject = renderedSubject.replace(regex, value);
      renderedBody = renderedBody.replace(regex, value);
    });

    // Find unreplaced tokens
    const tokenRegex = /\{\{([^}]+)\}\}/g;
    let match;
    while ((match = tokenRegex.exec(renderedSubject)) !== null) {
      if (!unreplaced.includes(match[1])) unreplaced.push(match[1]);
    }
    tokenRegex.lastIndex = 0;
    while ((match = tokenRegex.exec(renderedBody)) !== null) {
      if (!unreplaced.includes(match[1])) unreplaced.push(match[1]);
    }

    return { subject: renderedSubject, body: renderedBody, unreplaced };
  }, [subject, body, sampleData]);

  // Update unreplaced tokens state
  useEffect(() => {
    setUnreplacedTokens(renderContent.unreplaced);
  }, [renderContent.unreplaced]);

  // Generate full HTML preview
  const generateHtmlPreview = () => {
    const bodyContent = isHtml ? renderContent.body : renderContent.body.replace(/\n/g, '<br>');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    a { color: #f59e0b; }
    h1, h2, h3 { color: #1a1a1a; }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #f59e0b;
      color: white !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  ${bodyContent}
</body>
</html>
    `.trim();
  };

  // Copy rendered HTML
  const handleCopy = async () => {
    const html = generateHtmlPreview();
    await navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Reset sample data
  const handleReset = () => {
    setSampleData({ ...DEFAULT_SAMPLE_DATA });
    onSampleDataChange?.({ ...DEFAULT_SAMPLE_DATA });
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Sample Data Editor */}
      <div className="flex-shrink-0 p-3 border-b border-gray-700">
        <SampleDataEditor
          data={sampleData}
          onChange={handleSampleDataChange}
          onReset={handleReset}
        />
      </div>

      {/* Preview Controls */}
      <div className="flex-shrink-0 flex items-center justify-between p-3 border-b border-gray-700 bg-gray-800">
        {/* Device Toggle */}
        <div className="flex items-center gap-1 bg-gray-900 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setMode(m => ({ ...m, device: 'desktop' }))}
            className={`flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors ${
              mode.device === 'desktop'
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Monitor className="w-4 h-4" />
            Desktop
          </button>
          <button
            type="button"
            onClick={() => setMode(m => ({ ...m, device: 'mobile' }))}
            className={`flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors ${
              mode.device === 'mobile'
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            Mobile
          </button>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-gray-900 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setMode(m => ({ ...m, view: 'rendered' }))}
            className={`flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors ${
              mode.view === 'rendered'
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Eye className="w-4 h-4" />
            Preview
          </button>
          <button
            type="button"
            onClick={() => setMode(m => ({ ...m, view: 'html' }))}
            className={`flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors ${
              mode.view === 'html'
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Code className="w-4 h-4" />
            HTML
          </button>
          <button
            type="button"
            onClick={() => setMode(m => ({ ...m, view: 'text' }))}
            className={`flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors ${
              mode.view === 'text'
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <AlignLeft className="w-4 h-4" />
            Text
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 text-sm text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          {showTestEmail && (
            <button
              type="button"
              onClick={() => setShowTestModal(true)}
              className="flex items-center gap-1 px-2 py-1 text-sm bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 rounded transition-colors"
            >
              <Send className="w-4 h-4" />
              Test
            </button>
          )}
        </div>
      </div>

      {/* Token Validation Warning */}
      {unreplacedTokens.length > 0 && (
        <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border-b border-yellow-500/30 text-yellow-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          Unreplaced tokens: {unreplacedTokens.map(t => `{{${t}}}`).join(', ')}
        </div>
      )}

      {/* Preview Content */}
      <div className="flex-1 overflow-auto bg-gray-700 p-4">
        <DeviceFrame device={mode.device}>
          {mode.view === 'rendered' ? (
            <div className="h-full flex flex-col">
              {/* Email Header */}
              <div className="p-4 bg-gray-100 border-b border-gray-200">
                <div className="text-xs text-gray-500 mb-1">Subject:</div>
                <div className="text-gray-900 font-medium">
                  {renderContent.subject || '(No subject)'}
                </div>
              </div>
              {/* Email Body */}
              <div className="flex-1 p-4 overflow-auto">
                {isHtml ? (
                  <div
                    className="prose prose-sm max-w-none text-gray-900"
                    dangerouslySetInnerHTML={{ __html: renderContent.body }}
                  />
                ) : (
                  <pre className="text-sm text-gray-900 whitespace-pre-wrap font-sans">
                    {renderContent.body || '(No content)'}
                  </pre>
                )}
              </div>
            </div>
          ) : mode.view === 'html' ? (
            <div className="h-full p-4 bg-gray-900 overflow-auto">
              <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap">
                {generateHtmlPreview()}
              </pre>
            </div>
          ) : (
            <div className="h-full p-4 bg-white overflow-auto">
              <pre className="text-sm text-gray-900 whitespace-pre-wrap font-mono">
                {`Subject: ${renderContent.subject}\n\n${renderContent.body}`}
              </pre>
            </div>
          )}
        </DeviceFrame>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 p-2 bg-gray-800 border-t border-gray-700 text-center">
        <span className="text-xs text-gray-500">
          Preview with sample data - Actual content may vary per subscriber
        </span>
      </div>

      {/* Test Email Modal */}
      <TestEmailModal
        isOpen={showTestModal}
        onClose={() => setShowTestModal(false)}
        subject={renderContent.subject}
        body={renderContent.body}
        isHtml={isHtml}
        templateId={templateId}
      />
    </div>
  );
};

export default TemplatePreview;
