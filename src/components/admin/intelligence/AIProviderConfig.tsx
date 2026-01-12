import React, { useState } from 'react';
import {
  Settings, Plus, Trash2, Check, X, Loader2,
  AlertCircle, Sparkles, DollarSign, Zap, Eye
} from 'lucide-react';

interface AIProvider {
  id: string;
  name: string;
  provider_type: string;
  model_id: string;
  api_endpoint?: string;
  max_tokens: number;
  temperature: number;
  is_active: boolean;
  is_default: boolean;
  supports_vision: boolean;
  supports_function_calling: boolean;
  context_window: number;
  cost_per_1k_input: number;
  cost_per_1k_output: number;
  total_requests: number;
  total_tokens_used: number;
  total_cost: number;
}

interface AIProviderConfigProps {
  providers: AIProvider[];
  onUpdate: () => void;
}

const PROVIDER_TYPES = [
  { value: 'google', label: 'Google (Gemini)', color: 'blue' },
  { value: 'anthropic', label: 'Anthropic (Claude)', color: 'amber' },
  { value: 'openai', label: 'OpenAI (GPT)', color: 'green' },
  { value: 'cloudflare', label: 'Cloudflare AI', color: 'orange' },
  { value: 'local', label: 'Local (Ollama)', color: 'purple' },
  { value: 'custom', label: 'Custom API', color: 'gray' },
];

const AIProviderConfig: React.FC<AIProviderConfigProps> = ({ providers, onUpdate }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    provider_type: 'google',
    model_id: '',
    api_endpoint: '',
    max_tokens: 4096,
    temperature: 0.7,
    is_active: true,
    supports_vision: false,
    supports_function_calling: true,
    context_window: 128000,
    cost_per_1k_input: 0,
    cost_per_1k_output: 0,
  });

  const resetForm = () => {
    setFormData({
      name: '',
      provider_type: 'google',
      model_id: '',
      api_endpoint: '',
      max_tokens: 4096,
      temperature: 0.7,
      is_active: true,
      supports_vision: false,
      supports_function_calling: true,
      context_window: 128000,
      cost_per_1k_input: 0,
      cost_per_1k_output: 0,
    });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSetDefault = async (providerId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/intelligence/providers/${providerId}/default`, {
        method: 'POST'
      });
      const result = await response.json();
      if (result.success) {
        onUpdate();
      } else {
        setError(result.error || 'Failed to set default provider');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async (providerId: string, isActive: boolean) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/intelligence/providers/${providerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive })
      });
      const result = await response.json();
      if (result.success) {
        onUpdate();
      } else {
        setError(result.error || 'Failed to update provider');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.model_id) {
      setError('Name and Model ID are required');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const url = editingId
        ? `/api/admin/intelligence/providers/${editingId}`
        : '/api/admin/intelligence/providers';

      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();
      if (result.success) {
        resetForm();
        onUpdate();
      } else {
        setError(result.error || 'Failed to save provider');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setIsLoading(false);
    }
  };

  const getProviderTypeColor = (type: string) => {
    const provider = PROVIDER_TYPES.find(p => p.value === type);
    switch (provider?.color) {
      case 'blue': return 'bg-blue-500/20 text-blue-400';
      case 'amber': return 'bg-amber-500/20 text-amber-400';
      case 'green': return 'bg-green-500/20 text-green-400';
      case 'orange': return 'bg-orange-500/20 text-orange-400';
      case 'purple': return 'bg-purple-500/20 text-purple-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const formatCost = (cost: number) => {
    return cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400">
          <AlertCircle className="w-4 h-4" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Provider Cards */}
      <div className="grid gap-4">
        {providers.map((provider) => (
          <div
            key={provider.id}
            className={`bg-gray-800/50 rounded-xl border transition-colors ${
              provider.is_default
                ? 'border-amber-500/50 shadow-lg shadow-amber-500/10'
                : 'border-gray-700'
            }`}
          >
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  {/* Status Indicator */}
                  <div className={`w-3 h-3 rounded-full ${provider.is_active ? 'bg-green-400' : 'bg-gray-500'}`} />

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-medium text-white">{provider.name}</h3>
                      {provider.is_default && (
                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded text-xs ${getProviderTypeColor(provider.provider_type)}`}>
                        {PROVIDER_TYPES.find(p => p.value === provider.provider_type)?.label || provider.provider_type}
                      </span>
                      <span className="text-gray-500 text-sm">{provider.model_id}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {!provider.is_default && provider.is_active && (
                    <button
                      onClick={() => handleSetDefault(provider.id)}
                      disabled={isLoading}
                      className="px-3 py-1.5 text-sm text-amber-400 hover:bg-amber-500/10 rounded transition-colors"
                    >
                      Set Default
                    </button>
                  )}
                  <button
                    onClick={() => handleToggleActive(provider.id, provider.is_active)}
                    disabled={isLoading}
                    className={`px-3 py-1.5 text-sm rounded transition-colors ${
                      provider.is_active
                        ? 'text-red-400 hover:bg-red-500/10'
                        : 'text-green-400 hover:bg-green-500/10'
                    }`}
                  >
                    {provider.is_active ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-700">
                <div>
                  <div className="text-sm text-gray-500 flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    Requests
                  </div>
                  <div className="text-white font-medium">{formatNumber(provider.total_requests)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Tokens
                  </div>
                  <div className="text-white font-medium">{formatNumber(provider.total_tokens_used)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    Total Cost
                  </div>
                  <div className="text-white font-medium">{formatCost(provider.total_cost)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    Context
                  </div>
                  <div className="text-white font-medium">{formatNumber(provider.context_window)}</div>
                </div>
              </div>

              {/* Capabilities */}
              <div className="flex gap-2 mt-3">
                {provider.supports_vision && (
                  <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs rounded">Vision</span>
                )}
                {provider.supports_function_calling && (
                  <span className="px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded">Function Calling</span>
                )}
                <span className="px-2 py-0.5 bg-gray-500/10 text-gray-400 text-xs rounded">
                  In: {formatCost(provider.cost_per_1k_input)}/1K
                </span>
                <span className="px-2 py-0.5 bg-gray-500/10 text-gray-400 text-xs rounded">
                  Out: {formatCost(provider.cost_per_1k_output)}/1K
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add New Provider */}
      {!isAdding ? (
        <button
          onClick={() => setIsAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-600 rounded-xl text-gray-400 hover:border-amber-500/50 hover:text-amber-400 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add AI Provider
        </button>
      ) : (
        <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
          <h3 className="text-lg font-medium text-white mb-4">Add New Provider</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Display Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Gemini Flash"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Provider Type</label>
              <select
                value={formData.provider_type}
                onChange={(e) => setFormData({ ...formData, provider_type: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
              >
                {PROVIDER_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Model ID</label>
              <input
                type="text"
                value={formData.model_id}
                onChange={(e) => setFormData({ ...formData, model_id: e.target.value })}
                placeholder="e.g., gemini-2.5-flash-preview"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">API Endpoint (optional)</label>
              <input
                type="text"
                value={formData.api_endpoint}
                onChange={(e) => setFormData({ ...formData, api_endpoint: e.target.value })}
                placeholder="Custom endpoint URL"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Context Window</label>
              <input
                type="number"
                value={formData.context_window}
                onChange={(e) => setFormData({ ...formData, context_window: parseInt(e.target.value) || 0 })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Max Tokens</label>
              <input
                type="number"
                value={formData.max_tokens}
                onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) || 4096 })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Cost per 1K Input Tokens</label>
              <input
                type="number"
                step="0.0001"
                value={formData.cost_per_1k_input}
                onChange={(e) => setFormData({ ...formData, cost_per_1k_input: parseFloat(e.target.value) || 0 })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Cost per 1K Output Tokens</label>
              <input
                type="number"
                step="0.0001"
                value={formData.cost_per_1k_output}
                onChange={(e) => setFormData({ ...formData, cost_per_1k_output: parseFloat(e.target.value) || 0 })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
              />
            </div>
          </div>

          {/* Checkboxes */}
          <div className="flex gap-6 mt-4">
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <input
                type="checkbox"
                checked={formData.supports_vision}
                onChange={(e) => setFormData({ ...formData, supports_vision: e.target.checked })}
                className="rounded bg-gray-900 border-gray-700"
              />
              Supports Vision
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <input
                type="checkbox"
                checked={formData.supports_function_calling}
                onChange={(e) => setFormData({ ...formData, supports_function_calling: e.target.checked })}
                className="rounded bg-gray-900 border-gray-700"
              />
              Supports Function Calling
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded bg-gray-900 border-gray-700"
              />
              Active
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-6">
            <button
              onClick={resetForm}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save Provider
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIProviderConfig;
