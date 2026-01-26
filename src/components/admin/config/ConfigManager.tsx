import React, { useState, useEffect } from 'react';
import {
  Settings, Phone, Mail, Clock, DollarSign, Car, Shield, ToggleLeft, ToggleRight,
  Save, Loader2, RefreshCw, CheckCircle, AlertCircle, Monitor, MapPin, Sliders,
  AlertTriangle, FileText, Cpu, ChevronDown, ChevronUp, Brain, Sparkles, Database,
  Target, Users, TrendingUp, Zap
} from 'lucide-react';

interface ConfigData {
  phone: string;
  email: string;
  hourly_rate_remote: string;
  hourly_rate_onsite: string;
  business_hours: string;
}

interface BusinessRates {
  hourly_rate: number;
  remote_rate: number;
  onsite_rate: number;
  emergency_rate: number;
  after_hours_multiplier: number;
  travel_cape_cod: number;
  travel_south_shore: number;
  travel_islands: number;
  support_tier_1_percent: number;
  support_tier_2_percent: number;
  support_tier_3_percent: number;
}

interface FeatureFlags {
  // Tool Feature Flags
  quote_builder_enabled: boolean;
  menu_builder_enabled: boolean;
  client_portal_enabled: boolean;
  rep_portal_enabled: boolean;
  toast_hub_enabled: boolean;
  // Mode Flags
  maintenance_mode: boolean;
  // "Coming Soon" Mode Flags
  quote_builder_coming_soon: boolean;
  menu_builder_coming_soon: boolean;
  client_portal_coming_soon: boolean;
  rep_portal_coming_soon: boolean;
  toast_hub_coming_soon: boolean;
}

interface ApiConfig {
  id: string;
  service: string;
  provider: string;
  display_name: string;
  is_active: boolean;
  fallback_provider: string | null;
}

interface SiteContent {
  id: string;
  page: string;
  section: string;
  content_key: string;
  content_value: string;
  content_type: 'text' | 'html' | 'markdown' | 'json';
  is_editable: boolean;
  updated_at: number;
}

interface AIModelConfig {
  model: string;
  max_tokens: number;
  prompt: string;
  fallback_model?: string;
  temperature?: number;
}

interface AIConfigEntry {
  id: string;
  service: string;
  provider: string;
  display_name: string;
  config_json: string;
  is_active: boolean;
}

// Available Cloudflare AI Vision models
const AI_VISION_MODELS = [
  { id: '@cf/llava-hf/llava-1.5-7b-hf', name: 'LLaVA 1.5 7B', desc: 'Best for menu images', recommended: true },
  { id: '@cf/meta/llama-3.2-11b-vision-instruct', name: 'Llama 3.2 11B Vision', desc: 'Best for PDF documents' },
  { id: '@cf/unum/uform-gen2-qwen-500m', name: 'UForm Gen2', desc: 'Fast, lightweight' }
];

type SectionType = 'contact' | 'rates' | 'flags' | 'api' | 'ai' | 'intelligence' | 'content';

// Feature Flag Descriptions for TL-1 (explain what each flag does)
const FEATURE_FLAG_DESCRIPTIONS: Record<string, {
  name: string;
  description: string;
  prerequisites: string[];
}> = {
  quote_builder_enabled: {
    name: 'Quote Builder (DCI)',
    description: 'Generate professional quotes with line items and pricing',
    prerequisites: ['Stripe connected', 'PandaDoc integration (optional)']
  },
  menu_builder_enabled: {
    name: 'Menu Builder',
    description: 'AI-powered menu migration and customization',
    prerequisites: ['Client profile complete']
  },
  client_portal_enabled: {
    name: 'Client Portal',
    description: 'Self-service portal for clients to view projects and files',
    prerequisites: ['Magic link auth configured']
  },
  rep_portal_enabled: {
    name: 'Rep Portal',
    description: 'Sales rep dashboard for lead management and commissions',
    prerequisites: ['Rep accounts created']
  },
  toast_hub_enabled: {
    name: 'Toast Hub',
    description: 'Content marketing and knowledge base platform',
    prerequisites: ['At least 5 articles published']
  },
  maintenance_mode: {
    name: 'Maintenance Mode',
    description: 'Disables all public features and shows maintenance page',
    prerequisites: []
  }
};

// Intelligence Configuration
interface IntelligenceConfig {
  ai_provider: string;
  lead_scoring_enabled: boolean;
  auto_sync_enabled: boolean;
  sync_schedule: string;
  min_confidence_score: number;
  auto_approve_threshold: number;
  hubspot_sync_enabled: boolean;
  email_enrichment_enabled: boolean;
}

const AI_PROVIDERS = [
  { id: 'cloudflare', name: 'Cloudflare Workers AI', desc: 'Built-in, no API key needed', recommended: true },
  { id: 'openai', name: 'OpenAI GPT-4', desc: 'Most capable, requires API key' },
  { id: 'anthropic', name: 'Anthropic Claude', desc: 'Great for analysis, requires API key' },
  { id: 'google', name: 'Google Gemini', desc: 'Multimodal, requires API key' }
];

const ConfigManager: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SectionType>('contact');
  const [isLoading, setIsLoading] = useState(true);

  // Contact Info
  const [config, setConfig] = useState<ConfigData>({
    phone: '',
    email: '',
    hourly_rate_remote: '',
    hourly_rate_onsite: '',
    business_hours: ''
  });
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Business Rates - Documented in CLAUDE.md: Non-plan $175/hr, On-site $200/hr (2hr min), Emergency $250/hr
  const [businessRates, setBusinessRates] = useState<BusinessRates>({
    hourly_rate: 175,     // Standard/Non-plan hourly (CLAUDE.md)
    remote_rate: 175,     // Remote rate same as standard
    onsite_rate: 200,     // On-site rate (2hr min) - CLAUDE.md
    emergency_rate: 250,  // Urgent/after-hours - CLAUDE.md
    after_hours_multiplier: 1.25,
    travel_cape_cod: 0,
    travel_south_shore: 100,
    travel_islands: 300,
    support_tier_1_percent: 10,
    support_tier_2_percent: 20,
    support_tier_3_percent: 30
  });
  const [editedRates, setEditedRates] = useState<Partial<BusinessRates>>({});
  const [ratesSaveStatus, setRatesSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  // Feature Flags
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>({
    // Tool Feature Flags
    quote_builder_enabled: false,
    menu_builder_enabled: false,
    client_portal_enabled: false,
    rep_portal_enabled: false,
    toast_hub_enabled: false,
    // Mode Flags
    maintenance_mode: false,
    // "Coming Soon" Mode Flags
    quote_builder_coming_soon: false,
    menu_builder_coming_soon: false,
    client_portal_coming_soon: false,
    rep_portal_coming_soon: false,
    toast_hub_coming_soon: false
  });
  const [pendingFlagToggle, setPendingFlagToggle] = useState<string | null>(null);
  const [showFlagConfirm, setShowFlagConfirm] = useState<{ key: string; newValue: boolean } | null>(null);

  // API Configs
  const [apiConfigs, setApiConfigs] = useState<ApiConfig[]>([]);

  // Site Content
  const [siteContent, setSiteContent] = useState<SiteContent[]>([]);
  const [contentGrouped, setContentGrouped] = useState<Record<string, Record<string, SiteContent[]>>>({});
  const [editingContent, setEditingContent] = useState<SiteContent | null>(null);
  const [contentSaveStatus, setContentSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [showAddContent, setShowAddContent] = useState(false);
  const [newContent, setNewContent] = useState({ page: '', section: '', content_key: '', content_value: '', content_type: 'text' as const });

  // AI Model Configs
  const [menuOcrConfig, setMenuOcrConfig] = useState<AIModelConfig>({
    model: '@cf/llava-hf/llava-1.5-7b-hf',
    max_tokens: 2048,
    prompt: 'Extract all text from this menu image. List each menu item with its name, description, and price. Format: "Item Name - Description... $Price"'
  });
  const [quoteOcrConfig, setQuoteOcrConfig] = useState<AIModelConfig>({
    model: '@cf/meta/llama-3.2-11b-vision-instruct',
    max_tokens: 2048,
    prompt: 'Extract hardware items from this Toast POS quote PDF. Focus on the HARDWARE section table. For each item, extract: Product Name, Quantity (QTY column). Return as JSON array: [{"name": "...", "qty": 1}, ...]'
  });
  const [aiConfigSaveStatus, setAiConfigSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [aiConfigsLoaded, setAiConfigsLoaded] = useState(false);

  // Intelligence Config
  const [intelligenceConfig, setIntelligenceConfig] = useState<IntelligenceConfig>({
    ai_provider: 'cloudflare',
    lead_scoring_enabled: true,
    auto_sync_enabled: false,
    sync_schedule: '0 5,17 * * *',
    min_confidence_score: 0.7,
    auto_approve_threshold: 0.9,
    hubspot_sync_enabled: false,
    email_enrichment_enabled: true
  });
  const [intelConfigSaveStatus, setIntelConfigSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadConfig(),
        loadRates(),
        loadFeatureFlags(),
        loadApiConfigs(),
        loadSiteContent(),
        loadAIConfigs()
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/config');
      const result = await response.json();
      if (result.success && result.data) {
        setConfig(result.data);
      }
    } catch (error) {
      console.error('Load config error:', error);
    }
  };

  const loadRates = async () => {
    try {
      const response = await fetch('/api/admin/rates');
      const result = await response.json();
      if (result.success && result.data) {
        setBusinessRates(result.data.rates);
      }
    } catch (error) {
      console.error('Load rates error:', error);
    }
  };

  const loadFeatureFlags = async () => {
    try {
      const response = await fetch('/api/admin/feature-flags');
      const result = await response.json();
      if (result.success && result.data) {
        setFeatureFlags(result.data.flags);
      }
    } catch (error) {
      console.error('Load feature flags error:', error);
    }
  };

  const loadApiConfigs = async () => {
    try {
      const response = await fetch('/api/admin/api-configs');
      const result = await response.json();
      if (result.success) {
        setApiConfigs(result.data || []);
      }
    } catch (error) {
      console.error('Load API configs error:', error);
    }
  };

  const loadSiteContent = async () => {
    try {
      const response = await fetch('/api/admin/site-content');
      const result = await response.json();
      if (result.success) {
        setSiteContent(result.data || []);
        setContentGrouped(result.grouped || {});
      }
    } catch (error) {
      console.error('Load site content error:', error);
    }
  };

  const loadAIConfigs = async () => {
    try {
      const response = await fetch('/api/admin/api-configs');
      const result = await response.json();
      if (result.success && result.data) {
        // Find menu_ocr and quote_ocr configs
        const menuConfig = result.data.find((c: AIConfigEntry) => c.service === 'menu_ocr');
        const quoteConfig = result.data.find((c: AIConfigEntry) => c.service === 'quote_ocr');

        if (menuConfig?.config_json) {
          try {
            const parsed = JSON.parse(menuConfig.config_json);
            setMenuOcrConfig(prev => ({ ...prev, ...parsed }));
          } catch (e) {
            console.error('Parse menu OCR config error:', e);
          }
        }

        if (quoteConfig?.config_json) {
          try {
            const parsed = JSON.parse(quoteConfig.config_json);
            setQuoteOcrConfig(prev => ({ ...prev, ...parsed }));
          } catch (e) {
            console.error('Parse quote OCR config error:', e);
          }
        }

        setAiConfigsLoaded(true);
      }
    } catch (error) {
      console.error('Load AI configs error:', error);
    }
  };

  const saveAIConfigs = async () => {
    setAiConfigSaveStatus('saving');
    try {
      // Save menu OCR config
      const menuResponse = await fetch('/api/admin/api-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: 'menu_ocr',
          provider: 'cloudflare_ai',
          display_name: 'Menu Builder OCR',
          config_json: JSON.stringify(menuOcrConfig),
          is_active: true
        })
      });

      // Save quote OCR config
      const quoteResponse = await fetch('/api/admin/api-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: 'quote_ocr',
          provider: 'cloudflare_ai',
          display_name: 'Quote Builder PDF OCR',
          config_json: JSON.stringify(quoteOcrConfig),
          is_active: true
        })
      });

      const menuResult = await menuResponse.json();
      const quoteResult = await quoteResponse.json();

      if (menuResult.success && quoteResult.success) {
        setAiConfigSaveStatus('success');
        setTimeout(() => setAiConfigSaveStatus('idle'), 3000);
      } else {
        setAiConfigSaveStatus('error');
      }
    } catch (error) {
      console.error('Save AI configs error:', error);
      setAiConfigSaveStatus('error');
    }
  };

  const saveSiteContent = async (content: { page: string; section: string; content_key: string; content_value: string; content_type: string }) => {
    setContentSaveStatus('saving');
    try {
      const response = await fetch('/api/admin/site-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content)
      });
      const result = await response.json();
      if (result.success) {
        await loadSiteContent();
        setEditingContent(null);
        setShowAddContent(false);
        setNewContent({ page: '', section: '', content_key: '', content_value: '', content_type: 'text' });
        setContentSaveStatus('success');
        setTimeout(() => setContentSaveStatus('idle'), 3000);
      } else {
        setContentSaveStatus('error');
      }
    } catch (error) {
      console.error('Save content error:', error);
      setContentSaveStatus('error');
    }
  };

  const deleteSiteContent = async (id: string) => {
    if (!confirm('Delete this content block?')) return;
    try {
      await fetch('/api/admin/site-content', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      await loadSiteContent();
    } catch (error) {
      console.error('Delete content error:', error);
    }
  };

  const saveConfigField = async (key: string, value: string) => {
    try {
      const response = await fetch(`/api/config/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
      });
      const result = await response.json();
      if (result.success) {
        setConfig(prev => ({ ...prev, [key]: value }));
        setEditingField(null);
      }
    } catch (error) {
      console.error('Save config error:', error);
    }
  };

  const saveRates = async () => {
    if (Object.keys(editedRates).length === 0) return;
    setRatesSaveStatus('saving');
    try {
      const response = await fetch('/api/admin/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rates: editedRates })
      });
      const result = await response.json();
      if (result.success) {
        setBusinessRates(result.data.rates);
        setEditedRates({});
        setRatesSaveStatus('success');
        setTimeout(() => setRatesSaveStatus('idle'), 3000);
      }
    } catch (error) {
      setRatesSaveStatus('error');
    }
  };

  const toggleFeatureFlag = async (key: string, newValue: boolean) => {
    setPendingFlagToggle(key);
    try {
      const response = await fetch('/api/admin/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: newValue })
      });
      const result = await response.json();
      if (result.success) {
        setFeatureFlags(result.data.flags);
      }
    } finally {
      setPendingFlagToggle(null);
      setShowFlagConfirm(null);
    }
  };

  const handleRateChange = (key: keyof BusinessRates, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setEditedRates(prev => ({ ...prev, [key]: numValue }));
    }
  };

  const getRateValue = (key: keyof BusinessRates): string => {
    if (key in editedRates) return String(editedRates[key]);
    return String(businessRates[key]);
  };

  const sections: { id: SectionType; label: string; icon: React.ReactNode }[] = [
    { id: 'contact', label: 'Contact Info', icon: <Phone className="w-4 h-4" /> },
    { id: 'rates', label: 'Business Rates', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'flags', label: 'Feature Flags', icon: <ToggleRight className="w-4 h-4" /> },
    { id: 'ai', label: 'AI Models', icon: <Brain className="w-4 h-4" /> },
    { id: 'intelligence', label: 'Intelligence', icon: <Target className="w-4 h-4" /> },
    { id: 'api', label: 'API Settings', icon: <Cpu className="w-4 h-4" /> },
    { id: 'content', label: 'Site Content', icon: <FileText className="w-4 h-4" /> }
  ];

  // Save Intelligence Config
  const saveIntelligenceConfig = async () => {
    setIntelConfigSaveStatus('saving');
    try {
      const response = await fetch('/api/admin/api-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: 'intelligence',
          provider: intelligenceConfig.ai_provider,
          display_name: 'Market Intelligence',
          config_json: JSON.stringify(intelligenceConfig),
          is_active: true
        })
      });
      const result = await response.json();
      if (result.success) {
        setIntelConfigSaveStatus('success');
        setTimeout(() => setIntelConfigSaveStatus('idle'), 3000);
      } else {
        setIntelConfigSaveStatus('error');
      }
    } catch (error) {
      console.error('Save intelligence config error:', error);
      setIntelConfigSaveStatus('error');
    }
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
            <Settings className="w-5 h-5 text-amber-400" />
            Configuration
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Manage all site settings, rates, and feature toggles
          </p>
        </div>
        <button
          onClick={loadAllData}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {sections.map(section => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
              activeSection === section.id
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                : 'text-gray-400 hover:text-white hover:bg-gray-800 border border-transparent'
            }`}
          >
            {section.icon}
            {section.label}
          </button>
        ))}
      </div>

      {/* Contact Info Section */}
      {activeSection === 'contact' && (
        <section className="admin-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Contact Information</h3>
          <div className="space-y-4">
            {[
              { key: 'phone', label: 'Phone', icon: Phone, type: 'tel' },
              { key: 'email', label: 'Email', icon: Mail, type: 'email' },
              { key: 'business_hours', label: 'Business Hours', icon: Clock, type: 'text' }
            ].map(({ key, label, icon: Icon, type }) => {
              const isEditing = editingField === key;
              const value = config[key as keyof ConfigData];

              return (
                <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-gray-900/30 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-3 sm:w-40">
                    <Icon className="w-4 h-4 text-amber-400" />
                    <span className="text-gray-300 font-medium">{label}</span>
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    {isEditing ? (
                      <input
                        type={type}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        autoFocus
                        className="flex-1 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500"
                      />
                    ) : (
                      <span className="flex-1 text-white">{value || '-'}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => saveConfigField(key, editValue)}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingField(null)}
                          className="px-4 py-2 text-gray-400 hover:text-white text-sm"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingField(key);
                          setEditValue(value);
                        }}
                        className="px-4 py-2 text-amber-400 hover:text-amber-300 text-sm"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Business Rates Section */}
      {activeSection === 'rates' && (
        <section className="admin-card p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-white">Business Rates</h3>
            <p className="text-sm text-gray-400 mt-1">
              Per CLAUDE.md: Non-plan $175/hr, On-site $200/hr (2hr min), Emergency $250/hr
            </p>
          </div>

          {/* Hourly Rates */}
          <div>
            <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Hourly Rates
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { key: 'hourly_rate', label: 'Standard' },
                { key: 'remote_rate', label: 'Remote' },
                { key: 'onsite_rate', label: 'On-Site' },
                { key: 'emergency_rate', label: 'Emergency' }
              ].map(({ key, label }) => (
                <div key={key} className="p-3 bg-gray-900/30 rounded-lg border border-gray-700">
                  <label className="text-gray-400 text-xs">{label}</label>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-gray-500">$</span>
                    <input
                      type="number"
                      value={getRateValue(key as keyof BusinessRates)}
                      onChange={(e) => handleRateChange(key as keyof BusinessRates, e.target.value)}
                      className="flex-1 px-2 py-1 bg-gray-900 border border-gray-600 rounded text-white text-sm"
                    />
                    <span className="text-gray-500 text-xs">/hr</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Travel Fees */}
          <div>
            <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Car className="w-4 h-4" />
              Travel Fees
            </h4>
            <div className="grid grid-cols-3 gap-4">
              {[
                { key: 'travel_cape_cod', label: 'Cape Cod', desc: 'Local' },
                { key: 'travel_south_shore', label: 'South Shore', desc: 'Plymouth-Boston' },
                { key: 'travel_islands', label: 'Islands', desc: 'MV & Nantucket' }
              ].map(({ key, label, desc }) => (
                <div key={key} className="p-3 bg-gray-900/30 rounded-lg border border-gray-700">
                  <label className="text-gray-400 text-xs">{label}</label>
                  <p className="text-gray-600 text-xs">{desc}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-gray-500">$</span>
                    <input
                      type="number"
                      value={getRateValue(key as keyof BusinessRates)}
                      onChange={(e) => handleRateChange(key as keyof BusinessRates, e.target.value)}
                      className="flex-1 px-2 py-1 bg-gray-900 border border-gray-600 rounded text-white text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Support Tiers */}
          <div>
            <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Support Plan Tiers (% of install)
            </h4>
            <div className="grid grid-cols-3 gap-4">
              {[
                { key: 'support_tier_1_percent', label: 'Core', color: 'text-blue-400' },
                { key: 'support_tier_2_percent', label: 'Professional', color: 'text-amber-400' },
                { key: 'support_tier_3_percent', label: 'Premium', color: 'text-green-400' }
              ].map(({ key, label, color }) => (
                <div key={key} className="p-3 bg-gray-900/30 rounded-lg border border-gray-700">
                  <label className={`text-xs font-medium ${color}`}>{label}</label>
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="number"
                      value={getRateValue(key as keyof BusinessRates)}
                      onChange={(e) => handleRateChange(key as keyof BusinessRates, e.target.value)}
                      className="flex-1 px-2 py-1 bg-gray-900 border border-gray-600 rounded text-white text-sm"
                    />
                    <span className="text-gray-500 text-xs">%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center gap-4 pt-4 border-t border-gray-700">
            <button
              onClick={saveRates}
              disabled={ratesSaveStatus === 'saving' || Object.keys(editedRates).length === 0}
              className={`flex items-center gap-2 px-6 py-2 font-medium rounded-lg transition-colors ${
                Object.keys(editedRates).length > 0
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              {ratesSaveStatus === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {Object.keys(editedRates).length > 0 ? 'Save Changes' : 'No Changes'}
            </button>
            {ratesSaveStatus === 'success' && (
              <span className="text-green-400 text-sm flex items-center gap-1">
                <CheckCircle className="w-4 h-4" /> Saved!
              </span>
            )}
          </div>
        </section>
      )}

      {/* Feature Flags Section */}
      {activeSection === 'flags' && (
        <section className="space-y-6">
          {/* Tool Activation Flags */}
          <div className="admin-card p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Feature Activation</h3>
            <p className="text-gray-400 text-sm mb-4">
              Enable or disable features on the public website. Disabled features show a "Coming Soon" page if that option is enabled below.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { key: 'quote_builder_enabled', color: 'blue' },
                { key: 'menu_builder_enabled', color: 'green' },
                { key: 'client_portal_enabled', color: 'purple' },
                { key: 'rep_portal_enabled', color: 'amber' },
                { key: 'toast_hub_enabled', color: 'cyan' }
              ].map(({ key, color }) => {
                const flagConfig = FEATURE_FLAG_DESCRIPTIONS[key];
                const isEnabled = featureFlags[key as keyof FeatureFlags];
                return (
                  <div
                    key={key}
                    className={`p-4 rounded-lg border transition-all ${
                      isEnabled
                        ? `bg-${color}-500/10 border-${color}-500/30`
                        : 'bg-gray-900/30 border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            isEnabled ? 'bg-green-500' : 'bg-gray-500'
                          }`} />
                          <span className="text-white font-medium">{flagConfig?.name || key}</span>
                        </div>
                        <p className="text-gray-500 text-xs mt-1">{flagConfig?.description}</p>
                      </div>
                      <button
                        onClick={() => setShowFlagConfirm({ key, newValue: !isEnabled })}
                        disabled={pendingFlagToggle === key}
                        className="transition-transform hover:scale-110"
                      >
                        {pendingFlagToggle === key ? (
                          <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                        ) : isEnabled ? (
                          <ToggleRight className="w-10 h-10 text-green-500" />
                        ) : (
                          <ToggleLeft className="w-10 h-10 text-gray-500" />
                        )}
                      </button>
                    </div>
                    {/* Show prerequisites when flag is OFF */}
                    {!isEnabled && flagConfig?.prerequisites && flagConfig.prerequisites.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-700/50">
                        <p className="text-xs text-gray-500 mb-1">Prerequisites:</p>
                        <ul className="text-xs text-gray-400 space-y-0.5">
                          {flagConfig.prerequisites.map((p, i) => (
                            <li key={i} className="flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full bg-gray-600" />
                              {p}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Coming Soon Mode Flags */}
          <div className="admin-card p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Coming Soon Pages</h3>
            <p className="text-gray-400 text-sm mb-4">
              When a feature is disabled above, enabling "Coming Soon" shows a placeholder page instead of hiding the link entirely.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { key: 'quote_builder_coming_soon', label: 'Quote Builder', parentKey: 'quote_builder_enabled' },
                { key: 'menu_builder_coming_soon', label: 'Menu Builder', parentKey: 'menu_builder_enabled' },
                { key: 'client_portal_coming_soon', label: 'Client Portal', parentKey: 'client_portal_enabled' },
                { key: 'rep_portal_coming_soon', label: 'Rep Portal', parentKey: 'rep_portal_enabled' },
                { key: 'toast_hub_coming_soon', label: 'Toast Hub', parentKey: 'toast_hub_enabled' }
              ].map(({ key, label, parentKey }) => {
                const parentEnabled = featureFlags[parentKey as keyof FeatureFlags];
                return (
                  <div
                    key={key}
                    className={`p-4 rounded-lg border transition-all ${
                      parentEnabled
                        ? 'bg-gray-900/20 border-gray-800 opacity-50'
                        : featureFlags[key as keyof FeatureFlags]
                          ? 'bg-amber-500/10 border-amber-500/30'
                          : 'bg-gray-900/30 border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm">{label}</span>
                          {parentEnabled && (
                            <span className="px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded">Active</span>
                          )}
                        </div>
                        <p className="text-gray-600 text-xs mt-1">
                          {parentEnabled ? 'Feature is enabled' : 'Shows coming soon when disabled'}
                        </p>
                      </div>
                      <button
                        onClick={() => !parentEnabled && setShowFlagConfirm({ key, newValue: !featureFlags[key as keyof FeatureFlags] })}
                        disabled={pendingFlagToggle === key || parentEnabled}
                        className={parentEnabled ? 'opacity-50 cursor-not-allowed' : 'transition-transform hover:scale-110'}
                      >
                        {pendingFlagToggle === key ? (
                          <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                        ) : featureFlags[key as keyof FeatureFlags] ? (
                          <ToggleRight className="w-8 h-8 text-amber-400" />
                        ) : (
                          <ToggleLeft className="w-8 h-8 text-gray-500" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* System Mode Flags */}
          <div className="admin-card p-6">
            <h3 className="text-lg font-semibold text-white mb-2">System Modes</h3>
            <p className="text-gray-400 text-sm mb-4">
              Global system flags that affect the entire website.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: 'maintenance_mode', label: 'Maintenance Mode', desc: 'Disables all public features and shows maintenance page', danger: true }
              ].map(({ key, label, desc, danger }) => (
                <div
                  key={key}
                  className={`p-4 rounded-lg border ${
                    danger && featureFlags[key as keyof FeatureFlags]
                      ? 'bg-red-900/20 border-red-500/50'
                      : 'bg-gray-900/30 border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          featureFlags[key as keyof FeatureFlags]
                            ? 'bg-red-500 animate-pulse'
                            : 'bg-gray-500'
                        }`} />
                        <span className={featureFlags[key as keyof FeatureFlags] ? 'text-red-300' : 'text-white'}>
                          {label}
                        </span>
                      </div>
                      <p className="text-gray-500 text-xs mt-1">{desc}</p>
                    </div>
                    <button
                      onClick={() => setShowFlagConfirm({ key, newValue: !featureFlags[key as keyof FeatureFlags] })}
                      disabled={pendingFlagToggle === key}
                    >
                      {pendingFlagToggle === key ? (
                        <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                      ) : featureFlags[key as keyof FeatureFlags] ? (
                        <ToggleRight className="w-10 h-10 text-red-500" />
                      ) : (
                        <ToggleLeft className="w-10 h-10 text-gray-500" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* AI Models Section */}
      {activeSection === 'ai' && (
        <section className="space-y-6">
          {/* Menu Builder OCR */}
          <div className="admin-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Sparkles className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Menu Builder OCR</h3>
                <p className="text-gray-400 text-sm">AI model for extracting menu items from images</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Model Selection */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">AI Model</label>
                <select
                  value={menuOcrConfig.model}
                  onChange={(e) => setMenuOcrConfig(prev => ({ ...prev, model: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500"
                >
                  {AI_VISION_MODELS.map(model => (
                    <option key={model.id} value={model.id}>
                      {model.name} {model.recommended ? '(Recommended)' : ''} - {model.desc}
                    </option>
                  ))}
                </select>
              </div>

              {/* Max Tokens */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Max Tokens</label>
                <input
                  type="number"
                  value={menuOcrConfig.max_tokens}
                  onChange={(e) => setMenuOcrConfig(prev => ({ ...prev, max_tokens: parseInt(e.target.value) || 2048 }))}
                  min={256}
                  max={8192}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-xs text-gray-500 mt-1">Recommended: 2048. Higher values allow longer responses.</p>
              </div>

              {/* Custom Prompt */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Extraction Prompt</label>
                <textarea
                  value={menuOcrConfig.prompt}
                  onChange={(e) => setMenuOcrConfig(prev => ({ ...prev, prompt: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white resize-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Instructions for the AI to extract menu data..."
                />
                <p className="text-xs text-gray-500 mt-1">The prompt sent to the AI for menu extraction.</p>
              </div>
            </div>
          </div>

          {/* Quote Builder PDF OCR */}
          <div className="admin-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <FileText className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Quote Builder PDF OCR</h3>
                <p className="text-gray-400 text-sm">AI model for extracting hardware from Toast PDFs</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Model Selection */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">AI Model</label>
                <select
                  value={quoteOcrConfig.model}
                  onChange={(e) => setQuoteOcrConfig(prev => ({ ...prev, model: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500"
                >
                  {AI_VISION_MODELS.map(model => (
                    <option key={model.id} value={model.id}>
                      {model.name} - {model.desc}
                    </option>
                  ))}
                </select>
              </div>

              {/* Max Tokens */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Max Tokens</label>
                <input
                  type="number"
                  value={quoteOcrConfig.max_tokens}
                  onChange={(e) => setQuoteOcrConfig(prev => ({ ...prev, max_tokens: parseInt(e.target.value) || 2048 }))}
                  min={256}
                  max={8192}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-xs text-gray-500 mt-1">Recommended: 2048. Higher values allow longer responses.</p>
              </div>

              {/* Custom Prompt */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Extraction Prompt</label>
                <textarea
                  value={quoteOcrConfig.prompt}
                  onChange={(e) => setQuoteOcrConfig(prev => ({ ...prev, prompt: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white resize-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Instructions for the AI to extract hardware data from Toast PDFs..."
                />
                <p className="text-xs text-gray-500 mt-1">The prompt sent to the AI for PDF hardware extraction.</p>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="admin-card p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-400">
                <p>Changes will apply to new OCR jobs. Existing jobs are not affected.</p>
              </div>
              <div className="flex items-center gap-4">
                {aiConfigSaveStatus === 'success' && (
                  <span className="text-green-400 text-sm flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> Saved!
                  </span>
                )}
                {aiConfigSaveStatus === 'error' && (
                  <span className="text-red-400 text-sm flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> Error saving
                  </span>
                )}
                <button
                  onClick={saveAIConfigs}
                  disabled={aiConfigSaveStatus === 'saving'}
                  className="flex items-center gap-2 px-6 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors"
                >
                  {aiConfigSaveStatus === 'saving' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save AI Settings
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Intelligence Settings Section */}
      {activeSection === 'intelligence' && (
        <section className="space-y-6">
          {/* AI Provider */}
          <div className="admin-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Brain className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">AI Provider</h3>
                <p className="text-gray-400 text-sm">Configure the AI service for market intelligence</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">AI Provider</label>
                <select
                  value={intelligenceConfig.ai_provider}
                  onChange={(e) => setIntelligenceConfig(prev => ({ ...prev, ai_provider: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500"
                >
                  {AI_PROVIDERS.map(provider => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name} {provider.recommended ? '(Recommended)' : ''} - {provider.desc}
                    </option>
                  ))}
                </select>
              </div>

              {intelligenceConfig.ai_provider !== 'cloudflare' && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <p className="text-amber-400 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    API key required. Configure in API Settings section.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Lead Scoring & Automation */}
          <div className="admin-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Lead Scoring & Automation</h3>
                <p className="text-gray-400 text-sm">Configure automatic lead scoring and fact approval</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Lead Scoring Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-900/30 rounded-lg border border-gray-700">
                <div>
                  <p className="text-white font-medium">Lead Scoring</p>
                  <p className="text-gray-500 text-xs mt-1">Automatically score prospects based on fit criteria</p>
                </div>
                <button
                  onClick={() => setIntelligenceConfig(prev => ({ ...prev, lead_scoring_enabled: !prev.lead_scoring_enabled }))}
                  className="transition-transform hover:scale-110"
                >
                  {intelligenceConfig.lead_scoring_enabled ? (
                    <ToggleRight className="w-10 h-10 text-green-500" />
                  ) : (
                    <ToggleLeft className="w-10 h-10 text-gray-500" />
                  )}
                </button>
              </div>

              {/* Confidence Thresholds */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-900/30 rounded-lg border border-gray-700">
                  <label className="block text-sm text-gray-400 mb-2">Min Confidence Score</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={intelligenceConfig.min_confidence_score * 100}
                      onChange={(e) => setIntelligenceConfig(prev => ({ ...prev, min_confidence_score: parseInt(e.target.value) / 100 }))}
                      className="flex-1"
                    />
                    <span className="text-white font-medium w-12 text-right">
                      {Math.round(intelligenceConfig.min_confidence_score * 100)}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Facts below this threshold require manual review</p>
                </div>

                <div className="p-4 bg-gray-900/30 rounded-lg border border-gray-700">
                  <label className="block text-sm text-gray-400 mb-2">Auto-Approve Threshold</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={intelligenceConfig.auto_approve_threshold * 100}
                      onChange={(e) => setIntelligenceConfig(prev => ({ ...prev, auto_approve_threshold: parseInt(e.target.value) / 100 }))}
                      className="flex-1"
                    />
                    <span className="text-white font-medium w-12 text-right">
                      {Math.round(intelligenceConfig.auto_approve_threshold * 100)}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Facts above this are automatically approved</p>
                </div>
              </div>
            </div>
          </div>

          {/* Sync & Integrations */}
          <div className="admin-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Database className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Sync & Integrations</h3>
                <p className="text-gray-400 text-sm">Configure data synchronization and external integrations</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Auto Sync */}
              <div className="flex items-center justify-between p-4 bg-gray-900/30 rounded-lg border border-gray-700">
                <div>
                  <p className="text-white font-medium">Automatic Sync</p>
                  <p className="text-gray-500 text-xs mt-1">Automatically sync data on schedule</p>
                </div>
                <button
                  onClick={() => setIntelligenceConfig(prev => ({ ...prev, auto_sync_enabled: !prev.auto_sync_enabled }))}
                  className="transition-transform hover:scale-110"
                >
                  {intelligenceConfig.auto_sync_enabled ? (
                    <ToggleRight className="w-10 h-10 text-green-500" />
                  ) : (
                    <ToggleLeft className="w-10 h-10 text-gray-500" />
                  )}
                </button>
              </div>

              {intelligenceConfig.auto_sync_enabled && (
                <div className="p-4 bg-gray-900/30 rounded-lg border border-gray-700">
                  <label className="block text-sm text-gray-400 mb-2">Sync Schedule (Cron)</label>
                  <input
                    type="text"
                    value={intelligenceConfig.sync_schedule}
                    onChange={(e) => setIntelligenceConfig(prev => ({ ...prev, sync_schedule: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white font-mono text-sm focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-xs text-gray-600 mt-1">Default: 5 AM and 5 PM daily (0 5,17 * * *)</p>
                </div>
              )}

              {/* HubSpot Sync */}
              <div className="flex items-center justify-between p-4 bg-gray-900/30 rounded-lg border border-gray-700">
                <div>
                  <p className="text-white font-medium">HubSpot Sync</p>
                  <p className="text-gray-500 text-xs mt-1">Sync prospects with HubSpot CRM contacts</p>
                </div>
                <button
                  onClick={() => setIntelligenceConfig(prev => ({ ...prev, hubspot_sync_enabled: !prev.hubspot_sync_enabled }))}
                  className="transition-transform hover:scale-110"
                >
                  {intelligenceConfig.hubspot_sync_enabled ? (
                    <ToggleRight className="w-10 h-10 text-green-500" />
                  ) : (
                    <ToggleLeft className="w-10 h-10 text-gray-500" />
                  )}
                </button>
              </div>

              {/* Email Enrichment */}
              <div className="flex items-center justify-between p-4 bg-gray-900/30 rounded-lg border border-gray-700">
                <div>
                  <p className="text-white font-medium">Email Enrichment</p>
                  <p className="text-gray-500 text-xs mt-1">Automatically enrich contacts with email data</p>
                </div>
                <button
                  onClick={() => setIntelligenceConfig(prev => ({ ...prev, email_enrichment_enabled: !prev.email_enrichment_enabled }))}
                  className="transition-transform hover:scale-110"
                >
                  {intelligenceConfig.email_enrichment_enabled ? (
                    <ToggleRight className="w-10 h-10 text-green-500" />
                  ) : (
                    <ToggleLeft className="w-10 h-10 text-gray-500" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="admin-card p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-400">
                <p>Changes will apply to new intelligence operations.</p>
              </div>
              <div className="flex items-center gap-4">
                {intelConfigSaveStatus === 'success' && (
                  <span className="text-green-400 text-sm flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> Saved!
                  </span>
                )}
                {intelConfigSaveStatus === 'error' && (
                  <span className="text-red-400 text-sm flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> Error saving
                  </span>
                )}
                <button
                  onClick={saveIntelligenceConfig}
                  disabled={intelConfigSaveStatus === 'saving'}
                  className="flex items-center gap-2 px-6 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors"
                >
                  {intelConfigSaveStatus === 'saving' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Intelligence Settings
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* API Settings Section */}
      {activeSection === 'api' && (
        <section className="admin-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">API Settings</h3>
          <p className="text-gray-400 text-sm mb-4">
            Configure service providers for OCR, email, storage, and integrations.
          </p>
          <div className="space-y-3">
            {apiConfigs.map(config => (
              <div key={config.id} className="flex items-center justify-between p-4 bg-gray-900/30 rounded-lg border border-gray-700">
                <div className="flex items-center gap-3">
                  <Cpu className="w-5 h-5 text-amber-400" />
                  <div>
                    <p className="text-white font-medium">{config.display_name || config.service}</p>
                    <p className="text-gray-500 text-xs">Provider: {config.provider}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs ${
                    config.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {config.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <button className="text-gray-400 hover:text-white text-sm">Configure</button>
                </div>
              </div>
            ))}
            {apiConfigs.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Cpu className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>No API configurations found</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Site Content Section */}
      {activeSection === 'content' && (
        <section className="space-y-6">
          <div className="admin-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Site Content</h3>
                <p className="text-gray-400 text-sm">Edit text blocks displayed on the public website</p>
              </div>
              <button
                onClick={() => setShowAddContent(true)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                + Add Content
              </button>
            </div>

            {/* Page Selector for common pages */}
            <div className="flex gap-2 flex-wrap mb-4">
              {['home', 'services', 'about', 'contact', 'support-plans'].map(page => {
                const hasContent = contentGrouped[page];
                return (
                  <span
                    key={page}
                    className={`px-3 py-1 text-xs rounded-full capitalize ${
                      hasContent ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    {page.replace('-', ' ')}
                    {hasContent && ` (${Object.values(contentGrouped[page] || {}).flat().length})`}
                  </span>
                );
              })}
            </div>

            {/* Content List by Page */}
            {Object.keys(contentGrouped).length === 0 ? (
              <div className="text-center py-8 text-gray-500 bg-gray-900/30 rounded-lg border border-gray-700">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>No content blocks yet</p>
                <p className="text-xs mt-1">Add content blocks to edit text on your website</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(contentGrouped).map(([page, sections]) => (
                  <div key={page} className="border border-gray-700 rounded-lg overflow-hidden">
                    <div className="bg-gray-800/50 px-4 py-2 border-b border-gray-700">
                      <h4 className="text-white font-medium capitalize">{page.replace('-', ' ')} Page</h4>
                    </div>
                    <div className="divide-y divide-gray-700/50">
                      {Object.entries(sections).map(([section, items]) => (
                        <div key={section} className="p-4">
                          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{section}</p>
                          <div className="space-y-2">
                            {items.map(item => (
                              <div
                                key={item.id}
                                className="flex items-start justify-between p-3 bg-gray-900/30 rounded-lg group"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm text-amber-400 font-mono">{item.content_key}</p>
                                  <p className="text-white text-sm mt-1 truncate">
                                    {item.content_value || <span className="text-gray-500 italic">Empty</span>}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => setEditingContent(item)}
                                    className="px-3 py-1 text-xs text-amber-400 hover:bg-amber-500/20 rounded transition-colors"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => deleteSiteContent(item.id)}
                                    className="px-3 py-1 text-xs text-red-400 hover:bg-red-500/20 rounded transition-colors"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Add Common Content */}
          <div className="admin-card p-6">
            <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Add Common Content</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { page: 'home', section: 'hero', key: 'title' },
                { page: 'home', section: 'hero', key: 'subtitle' },
                { page: 'home', section: 'cta', key: 'text' },
                { page: 'services', section: 'header', key: 'title' },
                { page: 'about', section: 'header', key: 'title' },
                { page: 'contact', section: 'header', key: 'title' },
                { page: 'support-plans', section: 'header', key: 'title' },
                { page: 'support-plans', section: 'pricing', key: 'note' }
              ].map(({ page, section, key }) => {
                const exists = siteContent.some(c => c.page === page && c.section === section && c.content_key === key);
                return (
                  <button
                    key={`${page}-${section}-${key}`}
                    onClick={() => {
                      if (!exists) {
                        setNewContent({ page, section, content_key: key, content_value: '', content_type: 'text' });
                        setShowAddContent(true);
                      }
                    }}
                    disabled={exists}
                    className={`p-2 text-xs rounded border transition-colors ${
                      exists
                        ? 'border-gray-700 text-gray-500 cursor-not-allowed'
                        : 'border-gray-600 text-gray-400 hover:border-amber-500 hover:text-amber-400'
                    }`}
                  >
                    {page}/{section}/{key}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Add/Edit Content Modal */}
      {(showAddContent || editingContent) && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-lg w-full border border-gray-700">
            <div className="p-6 border-b border-gray-700">
              <h3 className="text-lg font-bold text-white">
                {editingContent ? 'Edit Content Block' : 'Add Content Block'}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Page</label>
                  <input
                    type="text"
                    value={editingContent?.page || newContent.page}
                    onChange={(e) => editingContent
                      ? setEditingContent({ ...editingContent, page: e.target.value })
                      : setNewContent({ ...newContent, page: e.target.value })}
                    placeholder="e.g., home"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Section</label>
                  <input
                    type="text"
                    value={editingContent?.section || newContent.section}
                    onChange={(e) => editingContent
                      ? setEditingContent({ ...editingContent, section: e.target.value })
                      : setNewContent({ ...newContent, section: e.target.value })}
                    placeholder="e.g., hero"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Content Key</label>
                <input
                  type="text"
                  value={editingContent?.content_key || newContent.content_key}
                  onChange={(e) => editingContent
                    ? setEditingContent({ ...editingContent, content_key: e.target.value })
                    : setNewContent({ ...newContent, content_key: e.target.value })}
                  placeholder="e.g., title, subtitle, body"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Content Value</label>
                <textarea
                  value={editingContent?.content_value || newContent.content_value}
                  onChange={(e) => editingContent
                    ? setEditingContent({ ...editingContent, content_value: e.target.value })
                    : setNewContent({ ...newContent, content_value: e.target.value })}
                  rows={4}
                  placeholder="Enter the content..."
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white resize-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Content Type</label>
                <select
                  value={editingContent?.content_type || newContent.content_type}
                  onChange={(e) => {
                    const val = e.target.value as 'text' | 'html' | 'markdown' | 'json';
                    editingContent
                      ? setEditingContent({ ...editingContent, content_type: val })
                      : setNewContent({ ...newContent, content_type: val });
                  }}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white"
                >
                  <option value="text">Plain Text</option>
                  <option value="html">HTML</option>
                  <option value="markdown">Markdown</option>
                  <option value="json">JSON</option>
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddContent(false);
                  setEditingContent(null);
                  setNewContent({ page: '', section: '', content_key: '', content_value: '', content_type: 'text' });
                }}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const data = editingContent || newContent;
                  saveSiteContent(data);
                }}
                disabled={contentSaveStatus === 'saving'}
                className="px-6 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                {contentSaveStatus === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Content
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flag Confirmation Modal */}
      {showFlagConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full border border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
              <h3 className="text-lg font-bold text-white">Confirm Change</h3>
            </div>
            <p className="text-gray-300 mb-6">
              {showFlagConfirm.newValue ? 'Enable' : 'Disable'}{' '}
              <span className="font-semibold text-white">
                {showFlagConfirm.key.replace(/_/g, ' ').replace(/enabled/g, '').trim()}
              </span>?
              {showFlagConfirm.key === 'maintenance_mode' && showFlagConfirm.newValue && (
                <span className="block mt-2 text-red-400 text-sm">
                  Warning: This will disable all public features.
                </span>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowFlagConfirm(null)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => toggleFeatureFlag(showFlagConfirm.key, showFlagConfirm.newValue)}
                className={`flex-1 px-4 py-2 rounded-lg font-semibold ${
                  showFlagConfirm.key === 'maintenance_mode' && showFlagConfirm.newValue
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-amber-500 hover:bg-amber-600 text-white'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigManager;
