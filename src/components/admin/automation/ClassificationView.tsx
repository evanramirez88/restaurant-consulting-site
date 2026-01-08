import React, { useState, useEffect } from 'react';
import {
  Building2,
  Coffee,
  Wine,
  UtensilsCrossed,
  Clock,
  Users,
  Truck,
  MapPin,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Check,
  AlertCircle,
  Sparkles,
  Settings,
  Edit,
  Save,
  X
} from 'lucide-react';

interface Classification {
  id: string;
  client_id: string;
  client_name: string;
  client_company: string;
  restaurant_id?: string;

  service_style: string;
  establishment_type: string;
  beverage_focus: string;
  cuisine_types: string[];
  hours_pattern: string;
  volume_level: string;
  price_point: string;

  has_bar: boolean;
  has_patio: boolean;
  has_delivery: boolean;
  has_takeout: boolean;
  has_reservations: boolean;

  classification_confidence: number;
  data_sources: string[];
  ai_model_used: string;

  config_template_id: string;
  template_name: string;

  is_manual_override: boolean;
  created_at: number;
  updated_at: number;
}

interface Template {
  id: string;
  name: string;
  description: string;
  modifier_rule_count: number;
}

interface Props {
  clientId?: string;
  onClassificationComplete?: (classification: Classification) => void;
}

const SERVICE_STYLES = [
  { value: 'counter', label: 'Counter Service', icon: Coffee },
  { value: 'full_service', label: 'Full Service', icon: UtensilsCrossed },
  { value: 'hybrid', label: 'Hybrid', icon: Users },
  { value: 'quick_service', label: 'Quick Service', icon: Clock }
];

const ESTABLISHMENT_TYPES = [
  { value: 'cafe', label: 'Cafe' },
  { value: 'coffee_shop', label: 'Coffee Shop' },
  { value: 'bar', label: 'Bar' },
  { value: 'cocktail_bar', label: 'Cocktail Bar' },
  { value: 'wine_bar', label: 'Wine Bar' },
  { value: 'brewery', label: 'Brewery' },
  { value: 'nightclub', label: 'Nightclub' },
  { value: 'fine_dining', label: 'Fine Dining' },
  { value: 'casual_dining', label: 'Casual Dining' },
  { value: 'fast_casual', label: 'Fast Casual' },
  { value: 'quick_service', label: 'Quick Service' },
  { value: 'food_truck', label: 'Food Truck' },
  { value: 'pizzeria', label: 'Pizzeria' },
  { value: 'deli', label: 'Deli' },
  { value: 'bakery', label: 'Bakery' }
];

const BEVERAGE_FOCUS = [
  { value: 'coffee', label: 'Coffee', icon: Coffee },
  { value: 'cocktail', label: 'Cocktails', icon: Wine },
  { value: 'wine', label: 'Wine', icon: Wine },
  { value: 'beer', label: 'Beer', icon: Wine },
  { value: 'mixed', label: 'Mixed', icon: Wine },
  { value: 'non_alcoholic', label: 'Non-Alcoholic', icon: Coffee },
  { value: 'none', label: 'None', icon: UtensilsCrossed }
];

export default function ClassificationView({ clientId, onClassificationComplete }: Props) {
  const [classification, setClassification] = useState<Classification | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [classifying, setClassifying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state for classification input
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [userInputs, setUserInputs] = useState({
    service_style: '',
    establishment_type: '',
    beverage_focus: ''
  });

  // Expanded sections
  const [expandedSections, setExpandedSections] = useState({
    details: true,
    features: true,
    template: true
  });

  useEffect(() => {
    loadData();
  }, [clientId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load templates
      const templatesRes = await fetch('/api/admin/automation/templates');
      const templatesData = await templatesRes.json();
      if (templatesData.success) {
        setTemplates(templatesData.data);
      }

      // Load existing classification if clientId provided
      if (clientId) {
        const classRes = await fetch(`/api/admin/automation/classifications?client_id=${clientId}`);
        const classData = await classRes.json();
        if (classData.success && classData.data) {
          setClassification(classData.data);
        }
      }
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const runClassification = async () => {
    if (!clientId) return;

    setClassifying(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/automation/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          data_sources: {
            website_url: websiteUrl || undefined,
            user_input: Object.values(userInputs).some(v => v) ? userInputs : undefined
          }
        })
      });

      const data = await res.json();
      if (data.success) {
        setClassification(data.data.classification);
        onClassificationComplete?.(data.data.classification);
      } else {
        setError(data.error || 'Classification failed');
      }
    } catch (err) {
      setError('Failed to run classification');
    } finally {
      setClassifying(false);
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-400';
    if (confidence >= 60) return 'text-yellow-400';
    return 'text-orange-400';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
        <span className="ml-2 text-slate-400">Loading classification...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-600/20 rounded-lg">
            <Sparkles className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Restaurant Classification</h3>
            <p className="text-sm text-slate-400">AI-powered configuration recommendations</p>
          </div>
        </div>

        {classification && (
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${getConfidenceColor(classification.classification_confidence)}`}>
              {classification.classification_confidence}% confidence
            </span>
            <button
              onClick={() => setEditing(!editing)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"
            >
              {editing ? <X className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-700/50 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span className="text-red-300 text-sm">{error}</span>
        </div>
      )}

      {/* Classification Input (if no classification exists) */}
      {!classification && clientId && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-4">
          <h4 className="text-white font-medium">Run Classification</h4>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Website URL (optional)</label>
            <input
              type="url"
              placeholder="https://example.com"
              value={websiteUrl}
              onChange={e => setWebsiteUrl(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Service Style</label>
              <select
                value={userInputs.service_style}
                onChange={e => setUserInputs(prev => ({ ...prev, service_style: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="">Auto-detect</option>
                {SERVICE_STYLES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Establishment Type</label>
              <select
                value={userInputs.establishment_type}
                onChange={e => setUserInputs(prev => ({ ...prev, establishment_type: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="">Auto-detect</option>
                {ESTABLISHMENT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Beverage Focus</label>
              <select
                value={userInputs.beverage_focus}
                onChange={e => setUserInputs(prev => ({ ...prev, beverage_focus: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="">Auto-detect</option>
                {BEVERAGE_FOCUS.map(b => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={runClassification}
            disabled={classifying}
            className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {classifying ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Run AI Classification
              </>
            )}
          </button>
        </div>
      )}

      {/* Classification Results */}
      {classification && (
        <div className="space-y-4">
          {/* Primary Classification */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('details')}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-700/50"
            >
              <span className="text-white font-medium">Classification Details</span>
              {expandedSections.details ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </button>

            {expandedSections.details && (
              <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-slate-500 uppercase">Service Style</label>
                  <p className="text-white font-medium capitalize">{classification.service_style?.replace('_', ' ')}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase">Establishment Type</label>
                  <p className="text-white font-medium capitalize">{classification.establishment_type?.replace('_', ' ')}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase">Beverage Focus</label>
                  <p className="text-white font-medium capitalize">{classification.beverage_focus?.replace('_', ' ')}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase">Hours Pattern</label>
                  <p className="text-white font-medium capitalize">{classification.hours_pattern?.replace('_', ' ')}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase">Volume Level</label>
                  <p className="text-white font-medium capitalize">{classification.volume_level}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase">Price Point</label>
                  <p className="text-white font-medium capitalize">{classification.price_point?.replace('_', ' ')}</p>
                </div>
              </div>
            )}
          </div>

          {/* Features */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('features')}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-700/50"
            >
              <span className="text-white font-medium">Features & Amenities</span>
              {expandedSections.features ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </button>

            {expandedSections.features && (
              <div className="px-4 pb-4 flex flex-wrap gap-2">
                <FeatureBadge label="Bar" active={classification.has_bar} icon={Wine} />
                <FeatureBadge label="Patio" active={classification.has_patio} icon={MapPin} />
                <FeatureBadge label="Delivery" active={classification.has_delivery} icon={Truck} />
                <FeatureBadge label="Takeout" active={classification.has_takeout} icon={Building2} />
                <FeatureBadge label="Reservations" active={classification.has_reservations} icon={Clock} />
              </div>
            )}
          </div>

          {/* Configuration Template */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('template')}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-700/50"
            >
              <span className="text-white font-medium">Configuration Template</span>
              {expandedSections.template ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </button>

            {expandedSections.template && (
              <div className="px-4 pb-4">
                {classification.template_name ? (
                  <div className="flex items-center gap-3 p-3 bg-purple-900/30 border border-purple-700/50 rounded-lg">
                    <Settings className="w-5 h-5 text-purple-400" />
                    <div>
                      <p className="text-white font-medium">{classification.template_name}</p>
                      <p className="text-slate-400 text-sm">
                        Recommended configuration based on classification
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm">No matching template found</p>
                )}

                {/* Data sources */}
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-xs text-slate-500">Data sources:</span>
                  {classification.data_sources?.map(source => (
                    <span key={source} className="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded">
                      {source}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Reclassify Button */}
          <button
            onClick={runClassification}
            disabled={classifying}
            className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${classifying ? 'animate-spin' : ''}`} />
            Re-run Classification
          </button>
        </div>
      )}
    </div>
  );
}

function FeatureBadge({ label, active, icon: Icon }: { label: string; active: boolean; icon: any }) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ${
      active
        ? 'bg-green-900/30 border border-green-700/50 text-green-300'
        : 'bg-slate-700/50 border border-slate-600 text-slate-500'
    }`}>
      {active ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
      {label}
    </div>
  );
}
