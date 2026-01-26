import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Settings,
  Zap,
  Clock,
  FileText,
  Mail,
  Bell,
  BarChart3,
  Package,
  Users,
  DollarSign,
  RefreshCw,
  Play,
  Pause,
  Plus,
  Trash2,
  Edit3,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Save,
  Calendar,
  Utensils
} from 'lucide-react';
import { useSEO } from '../src/components/SEO';

// ============================================================
// FEATURE FLAG - Set to false to reveal the full tool
// This is the local fallback. The API flag takes precedence.
// ============================================================
const SHOW_COMING_SOON = true;

// ============================================================
// TYPE DEFINITIONS
// ============================================================
interface AutomationRule {
  id: string;
  name: string;
  description: string;
  category: 'reporting' | 'inventory' | 'menu' | 'labor' | 'pricing' | 'integration';
  trigger: TriggerConfig;
  actions: ActionConfig[];
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
  runCount: number;
}

interface TriggerConfig {
  type: 'schedule' | 'event' | 'threshold';
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
  };
  event?: {
    name: string;
    conditions: Record<string, unknown>;
  };
  threshold?: {
    metric: string;
    operator: 'gt' | 'lt' | 'eq';
    value: number;
  };
}

interface ActionConfig {
  type: 'email' | 'webhook' | 'update' | 'notification' | 'export';
  config: Record<string, unknown>;
}

interface CategoryInfo {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

// ============================================================
// CATEGORY DEFINITIONS
// ============================================================
const CATEGORIES: CategoryInfo[] = [
  {
    id: 'reporting',
    label: 'Reporting',
    icon: <BarChart3 className="w-5 h-5" />,
    color: 'blue',
    description: 'Automated report generation and delivery'
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: <Package className="w-5 h-5" />,
    color: 'green',
    description: 'Stock level monitoring and alerts'
  },
  {
    id: 'menu',
    label: 'Menu Sync',
    icon: <Utensils className="w-5 h-5" />,
    color: 'amber',
    description: 'Multi-location menu synchronization'
  },
  {
    id: 'labor',
    label: 'Labor',
    icon: <Users className="w-5 h-5" />,
    color: 'purple',
    description: 'Scheduling and labor cost automation'
  },
  {
    id: 'pricing',
    label: 'Pricing',
    icon: <DollarSign className="w-5 h-5" />,
    color: 'emerald',
    description: 'Dynamic pricing and update rules'
  },
  {
    id: 'integration',
    label: 'Integrations',
    icon: <RefreshCw className="w-5 h-5" />,
    color: 'cyan',
    description: 'Third-party sync and data flows'
  }
];

// Helper to get auth token from cookie
const getAuthToken = (): string | null => {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'ccrc_admin_token') {
      return value;
    }
  }
  return null;
};

// ============================================================
// COMING SOON COMPONENT
// ============================================================
const ComingSoonOverlay: React.FC = () => {
  return (
    <div className="bg-primary-dark min-h-screen flex items-center justify-center relative hero-grain">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center relative z-10">
        {/* Animated Preview */}
        <div className="hero-fade-in mb-12">
          <div className="relative inline-block">
            <div className="w-32 h-32 bg-amber-500/20 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/30">
              <Zap className="w-16 h-16 text-amber-400" />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center animate-pulse">
              <Settings className="w-4 h-4 text-white animate-spin" style={{ animationDuration: '3s' }} />
            </div>
          </div>
        </div>

        {/* Headline */}
        <h1 className="hero-fade-in hero-fade-in-delay-1 font-display text-5xl md:text-6xl font-bold text-amber-400 mb-4">
          Toast Auto-Back-Office
        </h1>

        {/* Subheadline */}
        <div className="hero-fade-in hero-fade-in-delay-1 mb-10">
          <p className="text-2xl md:text-3xl text-white font-display mb-3">
            Intelligent Browser Automation for Toast POS
          </p>
          <div className="brass-underline mx-auto"></div>
        </div>

        {/* Body Copy */}
        <div className="hero-fade-in hero-fade-in-delay-2 mb-12 max-w-2xl mx-auto">
          <p className="text-lg text-gray-300 leading-relaxed mb-6">
            Toast ABO uses intelligent browser automation to handle the tedious back-office work for you.
            From menu builds and configuration to ongoing maintenance and audits—our system works directly
            in the Toast portal, performing data entry and updates as if a human operator was at the keyboard.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-gray-400 mt-8">
            <div className="flex items-center justify-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Scheduled Tasks</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Bell className="w-4 h-4 text-amber-400" />
              <span>Smart Alerts</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 text-amber-400" />
              <span>Multi-location Sync</span>
            </div>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="hero-fade-in hero-fade-in-delay-3 grid grid-cols-2 md:grid-cols-3 gap-4 mb-12 max-w-3xl mx-auto">
          {CATEGORIES.map((cat) => (
            <div
              key={cat.id}
              className="p-4 bg-gray-800/50 border border-gray-700 rounded-xl hover:border-amber-500/30 transition-colors"
            >
              <div className="text-amber-400 mb-2">{cat.icon}</div>
              <p className="text-white font-medium text-sm">{cat.label}</p>
              <p className="text-gray-500 text-xs mt-1">{cat.description}</p>
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="hero-fade-in hero-fade-in-delay-4 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/contact"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg font-semibold transition-all hover:scale-105 shadow-lg"
            style={{ backgroundColor: '#ea580c', color: '#ffffff' }}
          >
            <Calendar className="w-5 h-5" />
            Schedule Consultation
          </Link>
          <Link
            to="/support-plans"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition-all shadow-lg"
          >
            Learn About Restaurant Guardian
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>

        {/* Back link */}
        <div className="hero-fade-in hero-fade-in-delay-4 mt-12">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// AUTOMATION RULE CARD COMPONENT
// ============================================================
const RuleCard: React.FC<{
  rule: AutomationRule;
  onToggle: (id: string) => void;
  onEdit: (rule: AutomationRule) => void;
  onDelete: (id: string) => void;
}> = ({ rule, onToggle, onEdit, onDelete }) => {
  const category = CATEGORIES.find(c => c.id === rule.category);

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getCategoryColorClass = (cat?: CategoryInfo) => {
    if (!cat) return 'bg-gray-500/20 text-gray-400';
    const colors: Record<string, string> = {
      blue: 'bg-blue-500/20 text-blue-400',
      green: 'bg-green-500/20 text-green-400',
      amber: 'bg-amber-500/20 text-amber-400',
      purple: 'bg-purple-500/20 text-purple-400',
      emerald: 'bg-emerald-500/20 text-emerald-400',
      cyan: 'bg-cyan-500/20 text-cyan-400'
    };
    return colors[cat.color] || 'bg-gray-500/20 text-gray-400';
  };

  return (
    <div className={`bg-gray-800/50 border rounded-xl p-5 transition-all ${
      rule.enabled ? 'border-gray-700 hover:border-amber-500/30' : 'border-gray-800 opacity-60'
    }`}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getCategoryColorClass(category)}`}>
            {category?.icon}
          </div>
          <div>
            <h3 className="font-semibold text-white">{rule.name}</h3>
            <p className="text-sm text-gray-400">{rule.description}</p>
          </div>
        </div>
        <button
          onClick={() => onToggle(rule.id)}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            rule.enabled ? 'bg-green-500' : 'bg-gray-600'
          }`}
        >
          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
            rule.enabled ? 'left-7' : 'left-1'
          }`} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4 text-xs">
        <span className={`px-2 py-1 rounded ${getCategoryColorClass(category)}`}>
          {category?.label}
        </span>
        <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded capitalize">
          {rule.trigger.type}
        </span>
        <span className="text-gray-500">
          {rule.runCount} runs
        </span>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-700">
        <div className="flex items-center gap-4">
          <span>Last: {formatTime(rule.lastRun)}</span>
          {rule.nextRun && rule.enabled && (
            <span>Next: {formatTime(rule.nextRun)}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(rule)}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(rule.id)}
            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// MAIN COMPONENT
// ============================================================
const ToastAutomate: React.FC = () => {
  useSEO({
    title: 'Toast Auto-Back-Office (Toast ABO) | Cape Cod Restaurant Consulting',
    description: 'Intelligent browser automation for Toast POS back-office operations. Menu builds, configuration, maintenance, and audits handled automatically.',
    canonical: 'https://ccrestaurantconsulting.com/#/toast-automate',
  });

  const [featureFlagLoading, setFeatureFlagLoading] = useState(true);
  const [isFeatureEnabled, setIsFeatureEnabled] = useState(!SHOW_COMING_SOON);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Check feature flag
  useEffect(() => {
    const checkFeatureFlag = async () => {
      try {
        // Check for demo mode
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
        const isDemoMode = urlParams.get('demo') === 'true' || hashParams.get('demo') === 'true';

        // Check if user is authenticated as admin
        let isAdmin = false;
        try {
          const authResponse = await fetch('/api/auth/verify', { credentials: 'include' });
          const authData = await authResponse.json();
          isAdmin = authData.authenticated === true;
        } catch {
          // Not authenticated
        }

        if (isDemoMode || isAdmin) {
          setIsFeatureEnabled(true);
          setFeatureFlagLoading(false);
          return;
        }

        // Check feature flag for regular users
        const response = await fetch('/api/admin/feature-flags');
        const result = await response.json();
        if (result.success && result.data?.flags) {
          setIsFeatureEnabled(result.data.flags.toast_automate_enabled === true);
        }
      } catch (error) {
        console.error('Failed to check feature flag:', error);
        setIsFeatureEnabled(!SHOW_COMING_SOON);
      } finally {
        setFeatureFlagLoading(false);
      }
    };
    checkFeatureFlag();
  }, []);

  // Fetch rules from API when feature is enabled
  useEffect(() => {
    if (!isFeatureEnabled || featureFlagLoading) return;

    const fetchRules = async () => {
      setRulesLoading(true);
      setRulesError(null);

      try {
        const response = await fetch('/api/automation/rules', {
          credentials: 'include'
        });
        const result = await response.json();

        if (result.success) {
          // Transform API response to match UI format
          const transformedRules = (result.data || []).map((rule: any) => ({
            id: rule.id,
            name: rule.name,
            description: rule.description,
            category: rule.category as AutomationRule['category'],
            trigger: rule.trigger,
            actions: rule.actions,
            enabled: rule.enabled,
            lastRun: rule.lastRun,
            nextRun: rule.nextRun,
            runCount: rule.runCount || 0
          }));
          setRules(transformedRules);
        } else {
          setRulesError(result.error || 'Failed to load rules');
        }
      } catch (error) {
        console.error('Failed to fetch rules:', error);
        setRulesError('Failed to connect to server');
      } finally {
        setRulesLoading(false);
      }
    };

    fetchRules();
  }, [isFeatureEnabled, featureFlagLoading]);

  const toggleRule = async (id: string) => {
    const rule = rules.find(r => r.id === id);
    if (!rule) return;

    // Optimistic update
    setRules(prev => prev.map(r =>
      r.id === id ? { ...r, enabled: !r.enabled } : r
    ));

    try {
      const response = await fetch(`/api/automation/rules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled: !rule.enabled })
      });

      const result = await response.json();
      if (!result.success) {
        // Revert on failure
        setRules(prev => prev.map(r =>
          r.id === id ? { ...r, enabled: rule.enabled } : r
        ));
        console.error('Failed to toggle rule:', result.error);
      }
    } catch (error) {
      // Revert on error
      setRules(prev => prev.map(r =>
        r.id === id ? { ...r, enabled: rule.enabled } : r
      ));
      console.error('Failed to toggle rule:', error);
    }
  };

  const deleteRule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    // Optimistic update
    const deletedRule = rules.find(r => r.id === id);
    setRules(prev => prev.filter(r => r.id !== id));

    try {
      const response = await fetch(`/api/automation/rules/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const result = await response.json();
      if (!result.success) {
        // Revert on failure
        if (deletedRule) {
          setRules(prev => [...prev, deletedRule]);
        }
        console.error('Failed to delete rule:', result.error);
      }
    } catch (error) {
      // Revert on error
      if (deletedRule) {
        setRules(prev => [...prev, deletedRule]);
      }
      console.error('Failed to delete rule:', error);
    }
  };

  const editRule = (rule: AutomationRule) => {
    console.log('Edit rule:', rule);
    // Would open edit modal in full implementation
  };

  const filteredRules = selectedCategory
    ? rules.filter(r => r.category === selectedCategory)
    : rules;

  // Loading state
  if (featureFlagLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" aria-label="Loading" />
      </div>
    );
  }

  // Coming Soon overlay
  if (!isFeatureEnabled) {
    return <ComingSoonOverlay />;
  }

  // Main tool interface
  return (
    <div className="bg-slate-900 min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-700 bg-slate-900/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-display font-bold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                Toast Auto-Back-Office
              </h1>
              <p className="text-sm text-gray-400">Browser automation for Toast POS configuration</p>
            </div>
          </div>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Rule
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <Zap className="w-4 h-4" />
              Total Rules
            </div>
            <p className="text-2xl font-bold text-white">{rules.length}</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <Play className="w-4 h-4 text-green-400" />
              Active
            </div>
            <p className="text-2xl font-bold text-green-400">
              {rules.filter(r => r.enabled).length}
            </p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <Pause className="w-4 h-4 text-gray-400" />
              Paused
            </div>
            <p className="text-2xl font-bold text-gray-400">
              {rules.filter(r => !r.enabled).length}
            </p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <CheckCircle className="w-4 h-4 text-blue-400" />
              Total Runs
            </div>
            <p className="text-2xl font-bold text-blue-400">
              {rules.reduce((sum, r) => sum + r.runCount, 0)}
            </p>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedCategory === null
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
            }`}
          >
            All Categories
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                  : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
              }`}
            >
              {cat.icon}
              {cat.label}
            </button>
          ))}
        </div>

        {/* Rules Grid */}
        {rulesLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            <span className="ml-3 text-gray-400">Loading rules...</span>
          </div>
        ) : rulesError ? (
          <div className="col-span-2 text-center py-12 text-gray-500">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-400 opacity-75" />
            <p className="text-red-400">{rulesError}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 text-amber-400 hover:text-amber-300"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {filteredRules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                onToggle={toggleRule}
                onEdit={editRule}
                onDelete={deleteRule}
              />
            ))}
            {filteredRules.length === 0 && (
              <div className="col-span-2 text-center py-12 text-gray-500">
                <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No automation rules found</p>
                <button
                  onClick={() => setIsCreating(true)}
                  className="mt-4 text-amber-400 hover:text-amber-300"
                >
                  Create your first rule
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default ToastAutomate;
