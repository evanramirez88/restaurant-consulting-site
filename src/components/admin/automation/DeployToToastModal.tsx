import React, { useState, useEffect } from 'react';
import {
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Building2,
  Layers,
  Zap,
  ChevronRight,
  RefreshCw,
  Tag,
  Eye,
  EyeOff,
  Send
} from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: string;
  category: string;
  modifiers: string[];
}

interface ParsedMenu {
  items: MenuItem[];
  categories: string[];
  modifierGroups: string[];
}

interface ModifierOption {
  name: string;
  price: number;
  is_default?: boolean;
}

interface AppliedModifierGroup {
  name: string;
  type: string;
  min_selections: number;
  max_selections: number;
  is_required: boolean;
  options: ModifierOption[];
  applied_by_rule: string;
}

interface ProcessedMenuItem extends MenuItem {
  applied_modifier_groups?: AppliedModifierGroup[];
  matched_rules?: Array<{ rule_id: string; rule_name: string }>;
  has_auto_modifiers?: boolean;
}

interface Client {
  id: string;
  name: string;
  company_name?: string;
}

interface Classification {
  id: string;
  service_style: string;
  establishment_type: string;
  beverage_focus: string;
  template_name?: string;
  config_template_id?: string;
  classification_confidence: number;
}

interface Template {
  id: string;
  name: string;
  description?: string;
  modifier_rule_count?: number;
}

interface DeployToToastModalProps {
  isOpen: boolean;
  onClose: () => void;
  parsedMenu: ParsedMenu;
}

const DeployToToastModal: React.FC<DeployToToastModalProps> = ({
  isOpen,
  onClose,
  parsedMenu
}) => {
  // State
  const [step, setStep] = useState<'select-client' | 'review-modifiers' | 'confirm'>('select-client');
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [classification, setClassification] = useState<Classification | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [processedItems, setProcessedItems] = useState<ProcessedMenuItem[]>([]);
  const [modifierStats, setModifierStats] = useState<{ total_items: number; items_with_modifiers: number; total_modifiers_applied: number } | null>(null);
  const [showModifierPreview, setShowModifierPreview] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deployStatus, setDeployStatus] = useState<'idle' | 'creating' | 'success' | 'error'>('idle');
  const [jobId, setJobId] = useState<string | null>(null);

  // Fetch clients on mount
  useEffect(() => {
    if (isOpen) {
      fetchClients();
      fetchTemplates();
    }
  }, [isOpen]);

  const fetchClients = async () => {
    try {
      const response = await fetch('/api/admin/clients');
      const result = await response.json();
      if (result.success) {
        setClients(result.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/admin/automation/templates');
      const result = await response.json();
      if (result.success) {
        setTemplates(result.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
  };

  // Fetch classification when client is selected
  const handleClientSelect = async (client: Client) => {
    setSelectedClient(client);
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/automation/classifications?client_id=${client.id}`);
      const result = await response.json();
      if (result.success && result.data) {
        setClassification(result.data);
        // Pre-select template from classification
        if (result.data.config_template_id) {
          const template = templates.find(t => t.id === result.data.config_template_id);
          if (template) {
            setSelectedTemplate(template);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch classification:', err);
    } finally {
      setLoading(false);
    }
  };

  // Apply modifier rules to menu items
  const applyModifierRules = async () => {
    if (!parsedMenu) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/automation/apply-modifiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu_items: parsedMenu.items,
          template_id: selectedTemplate?.id,
          classification_id: classification?.id
        })
      });

      const result = await response.json();
      if (result.success) {
        setProcessedItems(result.data.items);
        setModifierStats(result.data.stats);
        setStep('review-modifiers');
      } else {
        setError(result.error || 'Failed to apply modifier rules');
      }
    } catch (err) {
      setError('Failed to apply modifier rules');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Create automation job
  const createDeploymentJob = async () => {
    if (!selectedClient) return;

    setDeployStatus('creating');
    setError(null);

    try {
      const response = await fetch('/api/admin/automation/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: selectedClient.id,
          job_type: 'menu_deployment',
          job_config: {
            menu_items: processedItems,
            template_id: selectedTemplate?.id,
            classification_id: classification?.id,
            modifier_stats: modifierStats,
            source: 'menu_builder'
          }
        })
      });

      const result = await response.json();
      if (result.success) {
        setJobId(result.data.id);
        setDeployStatus('success');
      } else {
        setError(result.error || 'Failed to create deployment job');
        setDeployStatus('error');
      }
    } catch (err) {
      setError('Failed to create deployment job');
      setDeployStatus('error');
      console.error(err);
    }
  };

  // Reset modal state
  const handleClose = () => {
    setStep('select-client');
    setSelectedClient(null);
    setClassification(null);
    setSelectedTemplate(null);
    setProcessedItems([]);
    setModifierStats(null);
    setError(null);
    setDeployStatus('idle');
    setJobId(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Deploy to Toast</h2>
              <p className="text-sm text-gray-400">
                {step === 'select-client' && 'Select client and template'}
                {step === 'review-modifiers' && 'Review auto-applied modifiers'}
                {step === 'confirm' && 'Confirm deployment'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-3 border-b border-gray-700/50 bg-gray-800/30">
          <div className="flex items-center gap-4">
            {['select-client', 'review-modifiers', 'confirm'].map((s, idx) => {
              const stepNames = ['Select Client', 'Review Modifiers', 'Deploy'];
              const currentIdx = ['select-client', 'review-modifiers', 'confirm'].indexOf(step);
              const isActive = step === s;
              const isComplete = currentIdx > idx;

              return (
                <React.Fragment key={s}>
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                      isComplete ? 'bg-green-500 text-white' :
                      isActive ? 'bg-amber-500 text-white' :
                      'bg-gray-700 text-gray-400'
                    }`}>
                      {isComplete ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                    </div>
                    <span className={`text-sm ${isActive || isComplete ? 'text-white' : 'text-gray-500'}`}>
                      {stepNames[idx]}
                    </span>
                  </div>
                  {idx < 2 && (
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Step 1: Select Client */}
          {step === 'select-client' && (
            <div className="space-y-6">
              {/* Client Selection */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Select Client
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[200px] overflow-y-auto pr-2">
                  {clients.map(client => (
                    <button
                      key={client.id}
                      onClick={() => handleClientSelect(client)}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                        selectedClient?.id === client.id
                          ? 'border-amber-500 bg-amber-500/10'
                          : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                      }`}
                    >
                      <Building2 className={`w-5 h-5 ${
                        selectedClient?.id === client.id ? 'text-amber-400' : 'text-gray-500'
                      }`} />
                      <div>
                        <div className="text-sm font-medium text-white">{client.name}</div>
                        {client.company_name && (
                          <div className="text-xs text-gray-500">{client.company_name}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Classification Info */}
              {selectedClient && classification && (
                <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-300 mb-3">Restaurant Classification</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Service Style:</span>
                      <span className="text-white ml-2">{classification.service_style}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Type:</span>
                      <span className="text-white ml-2">{classification.establishment_type}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Beverage Focus:</span>
                      <span className="text-white ml-2">{classification.beverage_focus}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Confidence:</span>
                      <span className="text-white ml-2">{Math.round(classification.classification_confidence * 100)}%</span>
                    </div>
                  </div>
                  {classification.template_name && (
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <span className="text-gray-500 text-sm">Matched Template:</span>
                      <span className="text-amber-400 ml-2 font-medium">{classification.template_name}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Template Selection */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Configuration Template
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[200px] overflow-y-auto pr-2">
                  {templates.map(template => (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors text-left ${
                        selectedTemplate?.id === template.id
                          ? 'border-amber-500 bg-amber-500/10'
                          : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                      }`}
                    >
                      <Layers className={`w-5 h-5 mt-0.5 ${
                        selectedTemplate?.id === template.id ? 'text-amber-400' : 'text-gray-500'
                      }`} />
                      <div>
                        <div className="text-sm font-medium text-white">{template.name}</div>
                        {template.description && (
                          <div className="text-xs text-gray-500 mt-0.5">{template.description}</div>
                        )}
                        {template.modifier_rule_count !== undefined && (
                          <div className="text-xs text-amber-400/70 mt-1">
                            {template.modifier_rule_count} modifier rules
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Menu Summary */}
              <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-300 mb-3">Menu Summary</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">{parsedMenu.items.length}</div>
                    <div className="text-xs text-gray-500 uppercase">Items</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">{parsedMenu.categories.length}</div>
                    <div className="text-xs text-gray-500 uppercase">Categories</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">{parsedMenu.modifierGroups.length}</div>
                    <div className="text-xs text-gray-500 uppercase">Modifier Groups</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Review Modifiers */}
          {step === 'review-modifiers' && (
            <div className="space-y-6">
              {/* Stats Bar */}
              {modifierStats && (
                <div className="flex items-center gap-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                  <div className="flex-1 grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Items with Auto-Modifiers:</span>
                      <span className="text-white ml-2 font-semibold">
                        {modifierStats.items_with_modifiers} / {modifierStats.total_items}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Total Modifiers Applied:</span>
                      <span className="text-white ml-2 font-semibold">{modifierStats.total_modifiers_applied}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Template:</span>
                      <span className="text-amber-400 ml-2 font-semibold">{selectedTemplate?.name}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Toggle Preview */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                  Menu Items with Applied Modifiers
                </h3>
                <button
                  onClick={() => setShowModifierPreview(!showModifierPreview)}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  {showModifierPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showModifierPreview ? 'Hide Details' : 'Show Details'}
                </button>
              </div>

              {/* Items List */}
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {processedItems.map(item => (
                  <div
                    key={item.id}
                    className={`p-4 rounded-lg border ${
                      item.has_auto_modifiers
                        ? 'border-amber-500/30 bg-amber-500/5'
                        : 'border-gray-700 bg-gray-800/30'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{item.name}</span>
                          {item.has_auto_modifiers && (
                            <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded-full">
                              Auto-Modified
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 mt-0.5">{item.category}</div>
                      </div>
                      <div className="text-green-400 font-semibold">${item.price}</div>
                    </div>

                    {/* Auto-Applied Modifiers */}
                    {showModifierPreview && item.applied_modifier_groups && item.applied_modifier_groups.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-700/50 space-y-2">
                        {item.applied_modifier_groups.map((group, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-sm">
                            <Tag className="w-4 h-4 text-amber-400 mt-0.5" />
                            <div>
                              <span className="text-amber-400 font-medium">{group.name}</span>
                              {group.is_required && (
                                <span className="text-red-400 text-xs ml-1">(required)</span>
                              )}
                              <div className="flex flex-wrap gap-1 mt-1">
                                {group.options.map((opt, optIdx) => (
                                  <span
                                    key={optIdx}
                                    className={`px-2 py-0.5 text-xs rounded ${
                                      opt.is_default
                                        ? 'bg-green-500/20 text-green-400'
                                        : 'bg-gray-700 text-gray-400'
                                    }`}
                                  >
                                    {opt.name}
                                    {opt.price > 0 && ` (+$${opt.price})`}
                                    {opt.is_default && ' ✓'}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                        {item.matched_rules && item.matched_rules.length > 0 && (
                          <div className="text-xs text-gray-600 mt-1">
                            Applied by: {item.matched_rules.map(r => r.rule_name).join(', ')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 'confirm' && (
            <div className="space-y-6">
              {deployStatus === 'success' ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-green-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Deployment Job Created</h3>
                  <p className="text-gray-400 mb-4">
                    Your menu deployment has been queued and will be processed shortly.
                  </p>
                  {jobId && (
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg">
                      <span className="text-gray-500 text-sm">Job ID:</span>
                      <span className="text-amber-400 font-mono">{jobId}</span>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                    <h4 className="text-sm font-semibold text-gray-300 mb-4">Deployment Summary</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Client:</span>
                        <span className="text-white">{selectedClient?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Template:</span>
                        <span className="text-amber-400">{selectedTemplate?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Menu Items:</span>
                        <span className="text-white">{processedItems.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Auto-Modifiers Applied:</span>
                        <span className="text-white">{modifierStats?.total_modifiers_applied || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5" />
                      <div className="text-sm">
                        <p className="text-amber-400 font-medium mb-1">Before Deploying</p>
                        <p className="text-amber-400/80">
                          This will create an automation job to deploy the menu to Toast.
                          The job will run during the next automation window and requires
                          valid Toast credentials for the client.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 bg-gray-800/50 flex items-center justify-between">
          <button
            onClick={step === 'select-client' ? handleClose : () => {
              if (step === 'review-modifiers') setStep('select-client');
              if (step === 'confirm') setStep('review-modifiers');
            }}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            disabled={loading || deployStatus === 'creating'}
          >
            {step === 'select-client' ? 'Cancel' : 'Back'}
          </button>

          <div className="flex items-center gap-3">
            {step === 'select-client' && (
              <button
                onClick={applyModifierRules}
                disabled={!selectedClient || !selectedTemplate || loading}
                className="flex items-center gap-2 px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Apply Modifier Rules
              </button>
            )}

            {step === 'review-modifiers' && (
              <button
                onClick={() => setStep('confirm')}
                className="flex items-center gap-2 px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {step === 'confirm' && deployStatus !== 'success' && (
              <button
                onClick={createDeploymentJob}
                disabled={deployStatus === 'creating'}
                className="flex items-center gap-2 px-6 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {deployStatus === 'creating' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Create Deployment Job
              </button>
            )}

            {step === 'confirm' && deployStatus === 'success' && (
              <button
                onClick={handleClose}
                className="flex items-center gap-2 px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeployToToastModal;
