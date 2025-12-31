import React, { useState, useEffect } from 'react';
import {
  X, Save, Loader2, Briefcase, Mail, Phone, User, MapPin, Link2, AlertCircle
} from 'lucide-react';

interface Rep {
  id?: string;
  email: string;
  name: string;
  territory: string | null;
  slug: string | null;
  phone?: string;
  portal_enabled: boolean;
  status: 'active' | 'inactive' | 'pending';
  avatar_url: string | null;
  notes: string | null;
}

interface RepFormProps {
  rep?: Rep | null;
  onSave: (rep: Rep) => Promise<void>;
  onCancel: () => void;
}

const TERRITORIES = [
  'Cape Cod',
  'South Shore',
  'Boston Metro',
  'North Shore',
  'Western MA',
  'Rhode Island',
  'Connecticut',
  'National - Remote'
];

const RepForm: React.FC<RepFormProps> = ({ rep, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Rep>({
    email: '',
    name: '',
    territory: null,
    slug: null,
    phone: '',
    portal_enabled: false,
    status: 'pending',
    avatar_url: null,
    notes: null
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [customTerritory, setCustomTerritory] = useState('');

  const isEditing = !!rep?.id;

  useEffect(() => {
    if (rep) {
      setFormData(rep);
      if (rep.territory && !TERRITORIES.includes(rep.territory)) {
        setCustomTerritory(rep.territory);
      }
    }
  }, [rep]);

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  };

  const handleNameChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      name: value,
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

  const handleTerritoryChange = (value: string) => {
    if (value === 'custom') {
      setFormData(prev => ({ ...prev, territory: customTerritory || null }));
    } else {
      setFormData(prev => ({ ...prev, territory: value || null }));
      setCustomTerritory('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.email || !formData.name) {
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
      setError(err instanceof Error ? err.message : 'Failed to save rep');
    } finally {
      setIsSaving(false);
    }
  };

  const isCustomTerritory = formData.territory && !TERRITORIES.includes(formData.territory);

  return (
    <div className="admin-card">
      <div className="flex items-center justify-between p-6 border-b border-gray-700">
        <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-amber-400" />
          {isEditing ? 'Edit Rep' : 'Add New Rep'}
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
                Full Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="John Smith"
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
                placeholder="rep@example.com"
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

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <MapPin className="w-4 h-4 inline mr-2" />
                Territory
              </label>
              <select
                value={isCustomTerritory ? 'custom' : (formData.territory || '')}
                onChange={(e) => handleTerritoryChange(e.target.value)}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">Select territory...</option>
                {TERRITORIES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
                <option value="custom">Custom...</option>
              </select>
            </div>
          </div>

          {isCustomTerritory && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Custom Territory</label>
              <input
                type="text"
                value={customTerritory}
                onChange={(e) => {
                  setCustomTerritory(e.target.value);
                  setFormData(prev => ({ ...prev, territory: e.target.value || null }));
                }}
                placeholder="Enter custom territory"
                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          )}
        </div>

        {/* Status */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Status</h3>

          <div className="grid grid-cols-3 gap-3">
            {(['pending', 'active', 'inactive'] as const).map(status => (
              <button
                key={status}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, status }))}
                className={`p-3 rounded-lg border text-center transition-all ${
                  formData.status === status
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <span className={`font-medium capitalize ${
                  formData.status === status ? 'text-amber-400' : 'text-white'
                }`}>
                  {status}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Portal Settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Portal Settings</h3>

          <label className="flex items-center justify-between p-4 bg-gray-900/30 rounded-lg border border-gray-700 cursor-pointer hover:border-gray-600 transition-colors">
            <div>
              <span className="text-white font-medium">Enable Rep Portal</span>
              <p className="text-gray-400 text-sm">Allow rep to access their dashboard with clients</p>
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
              <span className="text-gray-500 text-sm">/rep/</span>
              <input
                type="text"
                value={formData.slug || ''}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="john-smith"
                className={`flex-1 px-4 py-2 bg-gray-900 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                  slugError ? 'border-red-500' : 'border-gray-600'
                }`}
              />
            </div>
            {slugError && <p className="text-red-400 text-xs mt-1">{slugError}</p>}
            <p className="text-gray-500 text-xs mt-1">URL-friendly identifier for this rep's portal</p>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Internal Notes</label>
          <textarea
            value={formData.notes || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value || null }))}
            placeholder="Any internal notes about this rep..."
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
                {isEditing ? 'Save Changes' : 'Create Rep'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RepForm;
