import React, { useState, useEffect } from 'react';
import {
  X, Save, Loader2, Building2, Mail, Phone, User, Globe, Shield,
  FolderOpen, Link2, AlertCircle
} from 'lucide-react';

interface Client {
  id?: string;
  email: string;
  name: string;
  company: string;
  slug: string | null;
  phone?: string;
  portal_enabled: boolean;
  support_plan_tier: string | null;
  support_plan_status: string | null;
  google_drive_folder_id: string | null;
  avatar_url: string | null;
  notes: string | null;
  timezone?: string;
}

interface ClientFormProps {
  client?: Client | null;
  onSave: (client: Client) => Promise<void>;
  onCancel: () => void;
}

const SUPPORT_TIERS = [
  { value: 'none', label: 'No Support Plan' },
  { value: 'essential', label: 'Essential', description: 'Email support, 48hr response' },
  { value: 'professional', label: 'Professional', description: 'Priority support, 24hr response' },
  { value: 'premium', label: 'Premium', description: 'Phone + priority, 4hr response' }
];

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'Pacific/Honolulu'
];

const ClientForm: React.FC<ClientFormProps> = ({ client, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Client>({
    email: '',
    name: '',
    company: '',
    slug: null,
    phone: '',
    portal_enabled: false,
    support_plan_tier: null,
    support_plan_status: null,
    google_drive_folder_id: null,
    avatar_url: null,
    notes: null,
    timezone: 'America/New_York'
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);

  const isEditing = !!client?.id;

  useEffect(() => {
    if (client) {
      setFormData(client);
    }
  }, [client]);

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  };

  const handleCompanyChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      company: value,
      slug: prev.slug || generateSlug(value)
    }));
  };

  const handleSlugChange = (value: string) => {
    const slug = generateSlug(value);
    setFormData(prev => ({ ...prev, slug }));

    if (slug && slug.length < 3) {
      setSlugError('Slug must be at least 3 characters');
    } else {
      setSlugError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.email || !formData.name || !formData.company) {
      setError('Please fill in all required fields');
      return;
    }

    if (formData.portal_enabled && (!formData.slug || formData.slug.length < 3)) {
      setError('A valid URL slug is required when portal is enabled');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save client');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="admin-card">
      <div className="flex items-center justify-between p-6 border-b border-gray-700">
        <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
          <Building2 className="w-5 h-5 text-amber-400" />
          {isEditing ? 'Edit Client' : 'Add New Client'}
        </h2>
        <button
          onClick={onCancel}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Basic Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Basic Information</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <User className="w-4 h-4 inline mr-2" />
                Contact Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="John Smith"
                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Building2 className="w-4 h-4 inline mr-2" />
                Company Name *
              </label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => handleCompanyChange(e.target.value)}
                placeholder="Seafood Shack"
                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Mail className="w-4 h-4 inline mr-2" />
                Email *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="owner@restaurant.com"
                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Phone className="w-4 h-4 inline mr-2" />
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="508-555-1234"
                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Portal Settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Portal Settings</h3>

          <label className="flex items-center justify-between p-4 bg-gray-900/30 rounded-lg border border-gray-700 cursor-pointer hover:border-gray-600 transition-colors">
            <div>
              <span className="text-white font-medium">Enable Client Portal</span>
              <p className="text-gray-400 text-sm">Allow client to access their portal dashboard</p>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={formData.portal_enabled}
                onChange={(e) => setFormData(prev => ({ ...prev, portal_enabled: e.target.checked }))}
                className="sr-only"
              />
              <div className={`w-12 h-7 rounded-full transition-colors ${formData.portal_enabled ? 'bg-green-500' : 'bg-gray-600'}`}>
                <div className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${formData.portal_enabled ? 'translate-x-5' : ''}`} />
              </div>
            </div>
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Link2 className="w-4 h-4 inline mr-2" />
              Portal URL Slug {formData.portal_enabled && '*'}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-sm">/portal/</span>
              <input
                type="text"
                value={formData.slug || ''}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="seafood-shack"
                className={`flex-1 px-4 py-2 bg-gray-900 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                  slugError ? 'border-red-500' : 'border-gray-600'
                }`}
              />
            </div>
            {slugError && <p className="text-red-400 text-xs mt-1">{slugError}</p>}
            <p className="text-gray-500 text-xs mt-1">URL-friendly identifier for this client's portal</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Timezone</label>
            <select
              value={formData.timezone || 'America/New_York'}
              onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {TIMEZONES.map(tz => (
                <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Support Plan */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Support Plan
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SUPPORT_TIERS.map(tier => (
              <button
                key={tier.value}
                type="button"
                onClick={() => setFormData(prev => ({
                  ...prev,
                  support_plan_tier: tier.value === 'none' ? null : tier.value,
                  support_plan_status: tier.value === 'none' ? null : 'active'
                }))}
                className={`p-3 rounded-lg border text-left transition-all ${
                  (formData.support_plan_tier || 'none') === tier.value
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <span className={`block font-medium ${
                  (formData.support_plan_tier || 'none') === tier.value ? 'text-amber-400' : 'text-white'
                }`}>
                  {tier.label}
                </span>
                {tier.description && (
                  <span className="text-gray-500 text-xs">{tier.description}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Google Drive */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <FolderOpen className="w-4 h-4" />
            Google Drive Integration
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Drive Folder ID</label>
            <input
              type="text"
              value={formData.google_drive_folder_id || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, google_drive_folder_id: e.target.value || null }))}
              placeholder="1abc123def456..."
              className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <p className="text-gray-500 text-xs mt-1">Client's dedicated Google Drive folder for file sharing</p>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Internal Notes</label>
          <textarea
            value={formData.notes || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value || null }))}
            placeholder="Any internal notes about this client..."
            rows={3}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-700">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isEditing ? 'Save Changes' : 'Create Client'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ClientForm;
