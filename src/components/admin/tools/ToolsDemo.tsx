import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
  Calculator, UtensilsCrossed, Building2, Briefcase, ExternalLink,
  Settings, ToggleLeft, ToggleRight, Loader2, Layers, ChevronDown, ChevronUp, Radio
} from 'lucide-react';
import ToastHubManager from '../toasthub/ToastHubManager';

// Lazy load BeaconDashboard to prevent issues during initial render
const BeaconDashboard = lazy(() => import('../beacon/BeaconDashboard'));

interface ToolsDemoProps {
  onOpenQuoteBuilder: () => void;
  onOpenMenuBuilder: () => void;
  onOpenToastAutomate: () => void;
  onOpenToastHub: () => void;
  onOpenClientPortalDemo: () => void;
  onOpenRepPortalDemo: () => void;
}

interface FeatureFlags {
  quote_builder_enabled: boolean;
  menu_builder_enabled: boolean;
  client_portal_enabled: boolean;
  rep_portal_enabled: boolean;
  toast_hub_enabled: boolean;
  toast_automate_enabled?: boolean;
  beacon_enabled?: boolean;
}

interface ToolConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  iconBgColor: string;
  buttonColor: string;
  buttonHoverColor: string;
  featureFlagKey: keyof FeatureFlags;
  features: string;
  output: string;
  onOpen: () => void;
  settingsPath?: string;
  hasFullSettings?: boolean; // If true, shows full management component in settings
  SettingsComponent?: React.ReactNode;
}

const ToolsDemo: React.FC<ToolsDemoProps> = ({
  onOpenQuoteBuilder,
  onOpenMenuBuilder,
  onOpenToastAutomate,
  onOpenToastHub,
  onOpenClientPortalDemo,
  onOpenRepPortalDemo
}) => {
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>({
    quote_builder_enabled: false,
    menu_builder_enabled: false,
    client_portal_enabled: false,
    rep_portal_enabled: false,
    toast_hub_enabled: false,
    toast_automate_enabled: false,
    beacon_enabled: false
  });
  const [loadingFlags, setLoadingFlags] = useState(true);
  const [togglingFlag, setTogglingFlag] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState<string | null>(null);

  // Fetch feature flags on mount
  useEffect(() => {
    fetchFeatureFlags();
  }, []);

  const fetchFeatureFlags = async () => {
    try {
      const response = await fetch('/api/admin/feature-flags');
      const data = await response.json();
      if (data.success && data.data?.flags) {
        setFeatureFlags(data.data.flags);
      }
    } catch (error) {
      console.error('Failed to fetch feature flags:', error);
    } finally {
      setLoadingFlags(false);
    }
  };

  const toggleFeatureFlag = async (key: keyof FeatureFlags) => {
    setTogglingFlag(key);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/feature-flags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          key,
          value: !featureFlags[key]
        })
      });
      const data = await response.json();
      if (data.success && data.data?.flags) {
        setFeatureFlags(data.data.flags);
      }
    } catch (error) {
      console.error('Failed to toggle feature flag:', error);
    } finally {
      setTogglingFlag(null);
    }
  };

  const tools: ToolConfig[] = [
    {
      id: 'quote-builder',
      name: 'Quote Builder',
      description: 'Generate Toast POS installation quotes with hardware selection, integrations, and support plans',
      icon: <Calculator className="w-7 h-7 text-blue-400" />,
      iconBgColor: 'bg-blue-500/20',
      buttonColor: 'bg-blue-500',
      buttonHoverColor: 'hover:bg-blue-600',
      featureFlagKey: 'quote_builder_enabled',
      features: 'Hardware, Integrations, Travel',
      output: 'PDF Quote, Email Summary',
      onOpen: onOpenQuoteBuilder,
      settingsPath: '/admin/settings/quote-builder'
    },
    {
      id: 'menu-builder',
      name: 'Menu Builder',
      description: 'AI-powered menu digitization with OCR processing and structured data export',
      icon: <UtensilsCrossed className="w-7 h-7 text-green-400" />,
      iconBgColor: 'bg-green-500/20',
      buttonColor: 'bg-green-500',
      buttonHoverColor: 'hover:bg-green-600',
      featureFlagKey: 'menu_builder_enabled',
      features: 'OCR, AI Parsing, Export',
      output: 'JSON, CSV, Toast Import',
      onOpen: onOpenMenuBuilder,
      settingsPath: '/admin/settings/menu-builder'
    },
    {
      id: 'toast-automate',
      name: 'Toast Back-office Automate',
      description: 'Configure automation rules for reporting, inventory, menu sync, and more',
      icon: <Settings className="w-7 h-7 text-amber-400" />,
      iconBgColor: 'bg-amber-500/20',
      buttonColor: 'bg-amber-500',
      buttonHoverColor: 'hover:bg-amber-600',
      featureFlagKey: 'toast_automate_enabled' as keyof FeatureFlags,
      features: 'Scheduling, Alerts, Sync',
      output: 'Reports, Inventory, Labor',
      onOpen: onOpenToastAutomate,
      settingsPath: '/admin/settings/toast-automate'
    },
    {
      id: 'toast-hub',
      name: 'Toast Hub',
      description: 'Centralized Toast management dashboard for multi-location oversight and analytics',
      icon: <Layers className="w-7 h-7 text-orange-400" />,
      iconBgColor: 'bg-orange-500/20',
      buttonColor: 'bg-orange-500',
      buttonHoverColor: 'hover:bg-orange-600',
      featureFlagKey: 'toast_hub_enabled',
      features: 'Multi-location, Analytics, Alerts',
      output: 'Dashboard, Reports, KPIs',
      onOpen: onOpenToastHub,
      settingsPath: '/admin/settings/toast-hub',
      hasFullSettings: true,
      SettingsComponent: <ToastHubManager />
    },
    {
      id: 'client-portal',
      name: 'Client Portal',
      description: 'Preview the client experience with project tracking, files, and support access',
      icon: <Building2 className="w-7 h-7 text-purple-400" />,
      iconBgColor: 'bg-purple-500/20',
      buttonColor: 'bg-purple-500',
      buttonHoverColor: 'hover:bg-purple-600',
      featureFlagKey: 'client_portal_enabled',
      features: 'Projects, Files, Support',
      output: 'Full Client Experience',
      onOpen: onOpenClientPortalDemo,
      settingsPath: '/admin/settings/client-portal'
    },
    {
      id: 'rep-portal',
      name: 'Rep Portal',
      description: 'Preview the sales rep experience with client overview and referral tracking',
      icon: <Briefcase className="w-7 h-7 text-cyan-400" />,
      iconBgColor: 'bg-cyan-500/20',
      buttonColor: 'bg-cyan-500',
      buttonHoverColor: 'hover:bg-cyan-600',
      featureFlagKey: 'rep_portal_enabled',
      features: 'Clients, Referrals, Commission',
      output: 'Full Rep Experience',
      onOpen: onOpenRepPortalDemo,
      settingsPath: '/admin/settings/rep-portal'
    },
    {
      id: 'beacon',
      name: 'Beacon Content Platform',
      description: 'Aggregate, curate, and publish Toast POS content from Reddit and other sources for SEO',
      icon: <Radio className="w-7 h-7 text-rose-400" />,
      iconBgColor: 'bg-rose-500/20',
      buttonColor: 'bg-rose-500',
      buttonHoverColor: 'hover:bg-rose-600',
      featureFlagKey: 'beacon_enabled' as keyof FeatureFlags,
      features: 'Reddit, AI Categorization, Curation',
      output: 'Blog Posts, Solutions, SEO Content',
      onOpen: () => {
        // Beacon opens inline in settings
        setSettingsOpen('beacon');
      },
      settingsPath: '/admin/settings/beacon',
      hasFullSettings: true,
      SettingsComponent: (
        <Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="w-6 h-6 text-amber-400 animate-spin" /></div>}>
          <BeaconDashboard />
        </Suspense>
      )
    }
  ];

  const ToolCard: React.FC<{ tool: ToolConfig }> = ({ tool }) => {
    const isEnabled = featureFlags[tool.featureFlagKey] ?? false;
    const isToggling = togglingFlag === tool.featureFlagKey;

    return (
      <div className="admin-card p-6">
        {/* Header with icon and toggle */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 ${tool.iconBgColor} rounded-xl flex items-center justify-center`}>
              {tool.icon}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white">{tool.name}</h3>
              <p className="text-gray-400 text-sm mt-1">{tool.description}</p>
            </div>
          </div>
        </div>

        {/* Features info */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Features</span>
            <span className="text-white">{tool.features}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Output</span>
            <span className="text-white">{tool.output}</span>
          </div>
        </div>

        {/* Feature Flag Toggle */}
        <div className="flex items-center justify-between py-3 px-4 bg-gray-800/50 rounded-lg mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Feature Enabled</span>
            {loadingFlags && <Loader2 className="w-3 h-3 text-gray-500 animate-spin" />}
          </div>
          <button
            onClick={() => toggleFeatureFlag(tool.featureFlagKey)}
            disabled={loadingFlags || isToggling}
            className="flex items-center gap-2 disabled:opacity-50"
          >
            {isToggling ? (
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            ) : isEnabled ? (
              <ToggleRight className="w-8 h-8 text-green-400" />
            ) : (
              <ToggleLeft className="w-8 h-8 text-gray-500" />
            )}
            <span className={`text-sm font-medium ${isEnabled ? 'text-green-400' : 'text-gray-500'}`}>
              {isEnabled ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={tool.onOpen}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 ${tool.buttonColor} ${tool.buttonHoverColor} text-white font-medium rounded-lg transition-colors`}
          >
            <ExternalLink className="w-4 h-4" />
            Open Tool
          </button>
          <button
            onClick={() => setSettingsOpen(settingsOpen === tool.id ? null : tool.id)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-gray-400 hover:text-white bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors"
            title="Tool Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Settings Panel (expandable) */}
        {settingsOpen === tool.id && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                {tool.name} Settings
              </h4>
              <button
                onClick={() => setSettingsOpen(null)}
                className="text-gray-500 hover:text-gray-300 text-sm"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>

            {/* Full Settings Component (if available) */}
            {tool.hasFullSettings && tool.SettingsComponent ? (
              <div className="bg-gray-800/30 rounded-lg p-4 max-h-[600px] overflow-y-auto">
                {tool.SettingsComponent}
              </div>
            ) : (
              /* Basic Settings */
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between py-2 px-3 bg-gray-800/30 rounded">
                  <span className="text-gray-400">Demo Mode</span>
                  <span className="text-gray-300">Enabled</span>
                </div>
                <div className="flex items-center justify-between py-2 px-3 bg-gray-800/30 rounded">
                  <span className="text-gray-400">API Integration</span>
                  <span className="text-green-400">Connected</span>
                </div>
                <div className="flex items-center justify-between py-2 px-3 bg-gray-800/30 rounded">
                  <span className="text-gray-400">Last Updated</span>
                  <span className="text-gray-300">--</span>
                </div>
                <a
                  href={`/#${tool.settingsPath}`}
                  className="block w-full text-center py-2 px-3 text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded transition-colors"
                >
                  Open Full Settings →
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-amber-400" />
          Platform Tools
        </h2>
        <p className="text-gray-400 text-sm mt-1">
          Manage and configure all platform tools. Toggle features on/off and adjust settings.
        </p>
      </div>

      {/* Tool Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {tools.map(tool => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>

      {/* Global Settings Info */}
      <div className="admin-card p-4">
        <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Global Tool Settings
        </h4>
        <p className="text-gray-400 text-sm mb-3">
          Feature flags control public access to each tool. Disabled tools show a "Coming Soon" page to visitors.
          Use the Config tab for advanced settings and API configurations.
        </p>
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <ToggleRight className="w-5 h-5 text-green-400" />
            <span className="text-gray-300">Tool is publicly accessible</span>
          </div>
          <div className="flex items-center gap-2">
            <ToggleLeft className="w-5 h-5 text-gray-500" />
            <span className="text-gray-300">Shows "Coming Soon"</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolsDemo;
