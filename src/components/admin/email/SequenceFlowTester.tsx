import React, { useState, useEffect } from 'react';
import {
  Play, Zap, Mail, Check, X, AlertTriangle, Loader2, ChevronRight,
  Clock, User, Send, Eye, Search, RefreshCw, CheckCircle2,
  XCircle, AlertCircle, FastForward, TestTube2, FileText, Link
} from 'lucide-react';

// TypeScript Interfaces
interface SequenceStep {
  id: string;
  step_number: number;
  subject: string;
  delay_minutes: number;
  html_content?: string;
  text_content?: string;
  send_conditions?: string;
}

interface ValidationIssue {
  step_id?: string;
  step_number?: number;
  severity: 'error' | 'warning' | 'info';
  type: string;
  message: string;
  field?: string;
}

interface TestResult {
  step_id: string;
  step_number: number;
  subject: string;
  status: 'sent' | 'failed' | 'pending' | 'skipped';
  sent_at?: number;
  error?: string;
}

interface SequenceFlowTesterProps {
  sequenceId: string;
  sequenceName: string;
  steps: SequenceStep[];
  onClose: () => void;
}

const SequenceFlowTester: React.FC<SequenceFlowTesterProps> = ({
  sequenceId,
  sequenceName,
  steps,
  onClose
}) => {
  // State
  const [activeTab, setActiveTab] = useState<'validate' | 'test' | 'fulltest'>('validate');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<ValidationIssue[]>([]);
  const [validationComplete, setValidationComplete] = useState(false);

  // Test send state
  const [testEmail, setTestEmail] = useState('');
  const [selectedStepId, setSelectedStepId] = useState<string>('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testSendResult, setTestSendResult] = useState<{ success: boolean; message: string } | null>(null);

  // Full sequence test state
  const [fullTestEmail, setFullTestEmail] = useState('');
  const [isRunningFullTest, setIsRunningFullTest] = useState(false);
  const [fullTestResults, setFullTestResults] = useState<TestResult[]>([]);
  const [fastForwardDelays, setFastForwardDelays] = useState(true);
  const [currentTestStep, setCurrentTestStep] = useState<number>(0);

  // Sample data for token replacement
  const [sampleData, setSampleData] = useState({
    first_name: 'Test',
    last_name: 'User',
    email: '',
    company_name: 'Test Company'
  });

  // Run validation on mount
  useEffect(() => {
    runValidation();
  }, [sequenceId]);

  // Update sample email when test email changes
  useEffect(() => {
    setSampleData(prev => ({ ...prev, email: testEmail || fullTestEmail }));
  }, [testEmail, fullTestEmail]);

  // Run sequence validation
  const runValidation = async () => {
    setIsValidating(true);
    setValidationComplete(false);
    setValidationResults([]);

    try {
      const response = await fetch(`/api/admin/email/sequences/${sequenceId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps })
      });

      const result = await response.json();

      if (result.success) {
        setValidationResults(result.data.issues || []);
      } else {
        setValidationResults([{
          severity: 'error',
          type: 'api_error',
          message: result.error || 'Validation failed'
        }]);
      }
    } catch (err) {
      console.error('Validation error:', err);
      // Fallback to client-side validation
      const clientIssues = validateClientSide();
      setValidationResults(clientIssues);
    } finally {
      setIsValidating(false);
      setValidationComplete(true);
    }
  };

  // Client-side validation fallback
  const validateClientSide = (): ValidationIssue[] => {
    const issues: ValidationIssue[] = [];

    if (steps.length === 0) {
      issues.push({
        severity: 'error',
        type: 'no_steps',
        message: 'Sequence has no email steps'
      });
      return issues;
    }

    steps.forEach((step, index) => {
      // Check for missing subject
      if (!step.subject || step.subject.trim() === '') {
        issues.push({
          step_id: step.id,
          step_number: step.step_number,
          severity: 'error',
          type: 'missing_subject',
          message: `Step ${step.step_number} is missing a subject line`,
          field: 'subject'
        });
      }

      // Check for missing content
      if (!step.html_content && !step.text_content) {
        issues.push({
          step_id: step.id,
          step_number: step.step_number,
          severity: 'error',
          type: 'missing_content',
          message: `Step ${step.step_number} has no email content`,
          field: 'content'
        });
      }

      // Check for broken tokens
      const tokenRegex = /\{\{([^}]+)\}\}/g;
      const validTokens = ['first_name', 'last_name', 'email', 'company_name', 'unsubscribe_link', 'view_in_browser'];
      const content = (step.html_content || '') + (step.text_content || '') + (step.subject || '');
      let match;

      while ((match = tokenRegex.exec(content)) !== null) {
        const token = match[1].trim();
        if (!validTokens.includes(token)) {
          issues.push({
            step_id: step.id,
            step_number: step.step_number,
            severity: 'warning',
            type: 'unknown_token',
            message: `Step ${step.step_number} uses unknown token: {{${token}}}`,
            field: 'content'
          });
        }
      }

      // Check for potentially broken links
      const linkRegex = /href=["']([^"']+)["']/gi;
      let linkMatch;
      while ((linkMatch = linkRegex.exec(step.html_content || '')) !== null) {
        const url = linkMatch[1];
        if (!url.startsWith('http') && !url.startsWith('{{') && !url.startsWith('mailto:') && !url.startsWith('#')) {
          issues.push({
            step_id: step.id,
            step_number: step.step_number,
            severity: 'warning',
            type: 'suspicious_link',
            message: `Step ${step.step_number} has a potentially invalid link: ${url.substring(0, 50)}`,
            field: 'content'
          });
        }
      }

      // Check for very long delay (warning only)
      if (step.delay_minutes > 7 * 24 * 60 && index > 0) { // More than 7 days
        issues.push({
          step_id: step.id,
          step_number: step.step_number,
          severity: 'info',
          type: 'long_delay',
          message: `Step ${step.step_number} has a delay of ${Math.round(step.delay_minutes / 1440)} days`,
          field: 'delay'
        });
      }

      // Parse and validate send conditions
      if (step.send_conditions) {
        try {
          const conditions = JSON.parse(step.send_conditions);
          if (conditions.condition_groups && conditions.condition_groups.length > 0) {
            // Check if conditions reference valid fields
            for (const group of conditions.condition_groups) {
              for (const condition of group.conditions || []) {
                if (condition.type === 'has_tag' && !condition.tag_name && !condition.tag_id) {
                  issues.push({
                    step_id: step.id,
                    step_number: step.step_number,
                    severity: 'warning',
                    type: 'incomplete_condition',
                    message: `Step ${step.step_number} has a tag condition without specifying a tag`,
                    field: 'conditions'
                  });
                }
              }
            }
          }
        } catch (e) {
          issues.push({
            step_id: step.id,
            step_number: step.step_number,
            severity: 'error',
            type: 'invalid_conditions',
            message: `Step ${step.step_number} has invalid condition configuration`,
            field: 'conditions'
          });
        }
      }
    });

    return issues;
  };

  // Send test email for single step
  const handleSendTest = async () => {
    if (!testEmail || !selectedStepId) return;

    setIsSendingTest(true);
    setTestSendResult(null);

    try {
      const response = await fetch(`/api/admin/email/sequences/${sequenceId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step_id: selectedStepId,
          recipient_email: testEmail,
          sample_data: sampleData
        })
      });

      const result = await response.json();
      setTestSendResult({
        success: result.success,
        message: result.success
          ? `Test email sent successfully to ${testEmail}`
          : result.error || 'Failed to send test email'
      });
    } catch (err) {
      setTestSendResult({
        success: false,
        message: 'Failed to connect to server'
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  // Run full sequence test
  const handleFullSequenceTest = async () => {
    if (!fullTestEmail) return;

    setIsRunningFullTest(true);
    setFullTestResults([]);
    setCurrentTestStep(0);

    const results: TestResult[] = steps.map(step => ({
      step_id: step.id,
      step_number: step.step_number,
      subject: step.subject,
      status: 'pending' as const
    }));
    setFullTestResults([...results]);

    for (let i = 0; i < steps.length; i++) {
      setCurrentTestStep(i + 1);
      const step = steps[i];

      try {
        // If not first step and not fast-forwarding, show delay info
        if (i > 0 && !fastForwardDelays && step.delay_minutes > 0) {
          results[i] = { ...results[i], status: 'pending' };
          setFullTestResults([...results]);
          // In real implementation, would wait or show countdown
        }

        // Send test email for this step
        const response = await fetch(`/api/admin/email/sequences/${sequenceId}/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            step_id: step.id,
            recipient_email: fullTestEmail,
            sample_data: {
              ...sampleData,
              email: fullTestEmail
            },
            is_sequence_test: true,
            test_step_number: i + 1
          })
        });

        const result = await response.json();

        results[i] = {
          ...results[i],
          status: result.success ? 'sent' : 'failed',
          sent_at: result.success ? Math.floor(Date.now() / 1000) : undefined,
          error: result.success ? undefined : result.error
        };
        setFullTestResults([...results]);

        // Small delay between sends to not overwhelm
        if (i < steps.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (err) {
        results[i] = {
          ...results[i],
          status: 'failed',
          error: 'Network error'
        };
        setFullTestResults([...results]);
      }
    }

    setIsRunningFullTest(false);
    setCurrentTestStep(0);
  };

  // Get severity icon
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'info':
        return <AlertCircle className="w-4 h-4 text-blue-400" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  // Get severity color class
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'bg-red-500/10 border-red-500/30 text-red-400';
      case 'warning':
        return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
      case 'info':
        return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
      default:
        return 'bg-gray-500/10 border-gray-500/30 text-gray-400';
    }
  };

  // Count issues by severity
  const errorCount = validationResults.filter(i => i.severity === 'error').length;
  const warningCount = validationResults.filter(i => i.severity === 'warning').length;
  const infoCount = validationResults.filter(i => i.severity === 'info').length;

  const formatDelay = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1440) return `${Math.round(minutes / 60)} hr`;
    return `${Math.round(minutes / 1440)} day${Math.round(minutes / 1440) !== 1 ? 's' : ''}`;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70" onClick={onClose} />

      {/* Modal */}
      <div className="relative min-h-full flex items-center justify-center p-4">
        <div className="relative bg-gray-900 rounded-xl border border-gray-700 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                <TestTube2 className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-display font-bold text-white">
                  Sequence Flow Tester
                </h2>
                <p className="text-gray-400 text-sm">{sequenceName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setActiveTab('validate')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab === 'validate'
                  ? 'text-amber-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Validate
                {validationComplete && errorCount > 0 && (
                  <span className="bg-red-500 text-white text-xs px-1.5 rounded-full">{errorCount}</span>
                )}
              </span>
              {activeTab === 'validate' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('test')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab === 'test'
                  ? 'text-amber-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <Send className="w-4 h-4" />
                Test Step
              </span>
              {activeTab === 'test' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('fulltest')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab === 'fulltest'
                  ? 'text-amber-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <Zap className="w-4 h-4" />
                Full Sequence
              </span>
              {activeTab === 'fulltest' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400" />
              )}
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Validate Tab */}
            {activeTab === 'validate' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-medium">Sequence Validation</h3>
                    <p className="text-gray-400 text-sm">
                      Check all steps for issues before sending
                    </p>
                  </div>
                  <button
                    onClick={runValidation}
                    disabled={isValidating}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
                  >
                    {isValidating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    Re-validate
                  </button>
                </div>

                {/* Summary */}
                {validationComplete && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className={`rounded-lg p-3 border ${errorCount > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-gray-800 border-gray-700'}`}>
                      <div className="flex items-center gap-2">
                        <XCircle className={`w-4 h-4 ${errorCount > 0 ? 'text-red-400' : 'text-gray-500'}`} />
                        <span className={`text-lg font-bold ${errorCount > 0 ? 'text-red-400' : 'text-gray-500'}`}>
                          {errorCount}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Errors</p>
                    </div>
                    <div className={`rounded-lg p-3 border ${warningCount > 0 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-gray-800 border-gray-700'}`}>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className={`w-4 h-4 ${warningCount > 0 ? 'text-yellow-400' : 'text-gray-500'}`} />
                        <span className={`text-lg font-bold ${warningCount > 0 ? 'text-yellow-400' : 'text-gray-500'}`}>
                          {warningCount}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Warnings</p>
                    </div>
                    <div className={`rounded-lg p-3 border ${infoCount > 0 ? 'bg-blue-500/10 border-blue-500/30' : 'bg-gray-800 border-gray-700'}`}>
                      <div className="flex items-center gap-2">
                        <AlertCircle className={`w-4 h-4 ${infoCount > 0 ? 'text-blue-400' : 'text-gray-500'}`} />
                        <span className={`text-lg font-bold ${infoCount > 0 ? 'text-blue-400' : 'text-gray-500'}`}>
                          {infoCount}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Info</p>
                    </div>
                  </div>
                )}

                {/* Loading */}
                {isValidating && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                  </div>
                )}

                {/* No Issues */}
                {validationComplete && validationResults.length === 0 && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6 text-center">
                    <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
                    <h4 className="text-white font-medium mb-1">All Checks Passed</h4>
                    <p className="text-gray-400 text-sm">
                      Your sequence is ready to send. No issues found.
                    </p>
                  </div>
                )}

                {/* Issues List */}
                {validationResults.length > 0 && (
                  <div className="space-y-2">
                    {validationResults.map((issue, index) => (
                      <div
                        key={index}
                        className={`rounded-lg p-3 border ${getSeverityColor(issue.severity)}`}
                      >
                        <div className="flex items-start gap-3">
                          {getSeverityIcon(issue.severity)}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              {issue.step_number && (
                                <span className="bg-gray-800 text-gray-300 text-xs px-2 py-0.5 rounded">
                                  Step {issue.step_number}
                                </span>
                              )}
                              <span className="text-xs text-gray-500 uppercase">{issue.type.replace(/_/g, ' ')}</span>
                            </div>
                            <p className="text-white text-sm mt-1">{issue.message}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Test Step Tab */}
            {activeTab === 'test' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-white font-medium mb-2">Send Test Email</h3>
                  <p className="text-gray-400 text-sm">
                    Send a test email for a specific step to preview how it will look
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Test Email Address
                    </label>
                    <input
                      type="email"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="your-email@example.com"
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Select Step to Test
                    </label>
                    <select
                      value={selectedStepId}
                      onChange={(e) => setSelectedStepId(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="">Select a step...</option>
                      {steps.map(step => (
                        <option key={step.id} value={step.id}>
                          Step {step.step_number}: {step.subject || '(No subject)'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sample Data */}
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-300 mb-3">Sample Data (for tokens)</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">First Name</label>
                        <input
                          type="text"
                          value={sampleData.first_name}
                          onChange={(e) => setSampleData({ ...sampleData, first_name: e.target.value })}
                          className="w-full px-3 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Last Name</label>
                        <input
                          type="text"
                          value={sampleData.last_name}
                          onChange={(e) => setSampleData({ ...sampleData, last_name: e.target.value })}
                          className="w-full px-3 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Company Name</label>
                        <input
                          type="text"
                          value={sampleData.company_name}
                          onChange={(e) => setSampleData({ ...sampleData, company_name: e.target.value })}
                          className="w-full px-3 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleSendTest}
                    disabled={isSendingTest || !testEmail || !selectedStepId}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 disabled:text-gray-400 text-white font-medium rounded-lg transition-colors"
                  >
                    {isSendingTest ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send Test Email
                      </>
                    )}
                  </button>

                  {/* Test Result */}
                  {testSendResult && (
                    <div className={`rounded-lg p-4 border ${
                      testSendResult.success
                        ? 'bg-green-500/10 border-green-500/30'
                        : 'bg-red-500/10 border-red-500/30'
                    }`}>
                      <div className="flex items-center gap-2">
                        {testSendResult.success ? (
                          <CheckCircle2 className="w-5 h-5 text-green-400" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-400" />
                        )}
                        <span className={testSendResult.success ? 'text-green-400' : 'text-red-400'}>
                          {testSendResult.message}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Full Sequence Test Tab */}
            {activeTab === 'fulltest' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-white font-medium mb-2">Full Sequence Test</h3>
                  <p className="text-gray-400 text-sm">
                    Test the entire sequence by sending all emails to a test address
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Test Email Address
                    </label>
                    <input
                      type="email"
                      value={fullTestEmail}
                      onChange={(e) => setFullTestEmail(e.target.value)}
                      placeholder="your-email@example.com"
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="flex items-center gap-3 bg-gray-800/50 rounded-lg p-3">
                    <button
                      onClick={() => setFastForwardDelays(!fastForwardDelays)}
                      className={`w-10 h-6 rounded-full transition-colors ${
                        fastForwardDelays ? 'bg-amber-500' : 'bg-gray-600'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        fastForwardDelays ? 'translate-x-5' : 'translate-x-1'
                      }`} />
                    </button>
                    <div>
                      <p className="text-white text-sm font-medium flex items-center gap-2">
                        <FastForward className="w-4 h-4" />
                        Fast-forward delays
                      </p>
                      <p className="text-gray-500 text-xs">Skip wait times and send all emails immediately</p>
                    </div>
                  </div>

                  <button
                    onClick={handleFullSequenceTest}
                    disabled={isRunningFullTest || !fullTestEmail}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 disabled:text-gray-400 text-white font-medium rounded-lg transition-colors"
                  >
                    {isRunningFullTest ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Testing Step {currentTestStep} of {steps.length}...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Run Full Sequence Test
                      </>
                    )}
                  </button>
                </div>

                {/* Sequence Timeline */}
                {(fullTestResults.length > 0 || !isRunningFullTest) && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-gray-400">Sequence Timeline</h4>
                    {steps.map((step, index) => {
                      const result = fullTestResults[index];
                      const isCurrentStep = isRunningFullTest && currentTestStep === index + 1;

                      return (
                        <div key={step.id} className="relative">
                          {/* Connector line */}
                          {index > 0 && (
                            <div className="absolute left-4 -top-3 w-0.5 h-3 bg-gray-700" />
                          )}

                          <div className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                            result?.status === 'sent' ? 'bg-green-500/10 border-green-500/30' :
                            result?.status === 'failed' ? 'bg-red-500/10 border-red-500/30' :
                            isCurrentStep ? 'bg-amber-500/10 border-amber-500/30' :
                            'bg-gray-800 border-gray-700'
                          }`}>
                            {/* Status indicator */}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                              result?.status === 'sent' ? 'bg-green-500/20' :
                              result?.status === 'failed' ? 'bg-red-500/20' :
                              isCurrentStep ? 'bg-amber-500/20' :
                              'bg-gray-700'
                            }`}>
                              {result?.status === 'sent' ? (
                                <Check className="w-4 h-4 text-green-400" />
                              ) : result?.status === 'failed' ? (
                                <X className="w-4 h-4 text-red-400" />
                              ) : isCurrentStep ? (
                                <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                              ) : (
                                <span className="text-sm font-medium text-gray-400">{step.step_number}</span>
                              )}
                            </div>

                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-white font-medium">{step.subject || '(No subject)'}</span>
                                {index > 0 && step.delay_minutes > 0 && (
                                  <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded">
                                    <Clock className="w-3 h-3 inline mr-1" />
                                    {formatDelay(step.delay_minutes)}
                                  </span>
                                )}
                              </div>
                              {result?.error && (
                                <p className="text-red-400 text-xs mt-1">{result.error}</p>
                              )}
                              {result?.sent_at && (
                                <p className="text-green-400 text-xs mt-1">
                                  Sent at {new Date(result.sent_at * 1000).toLocaleTimeString()}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end px-6 py-4 border-t border-gray-700">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SequenceFlowTester;
