import React, { useState, useEffect } from 'react';
import {
  X, Save, Loader2, Building2, Mail, Phone, User, Globe, Shield,
  FolderOpen, Link2, AlertCircle, Users, Briefcase, Plus, Trash2
} from 'lucide-react';

interface Rep {
  id: string;
  name: string;
  email: string;
  territory: string | null;
  slug: string | null;
  status: 'active' | 'inactive' | 'pending';
}

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
  // Intelligence fields (NOT synced to client portal)
  intel_profile: string | null;
  intel_notes: string | null;
  tags: string | null;
  local_folder_path: string | null;
}

interface ClientFormProps {
  client?: Client | null;
  onSave: (client: Client) => Promise<void>;
  onCancel: () => void;
}

// MUST match website pricing in pages/Services.tsx
const SUPPORT_TIERS = [
  { value: 'none', label: 'No Support Plan' },
  { value: 'core', label: 'Core ($350/mo)', description: '1.5hr/mo, 24-48hr response' },
  { value: 'professional', label: 'Professional ($500/mo)', description: '3hr/mo, 4-hour SLA' },
  { value: 'premium', label: 'Premium ($800/mo)', description: '5hr/mo, 2-hour SLA' }
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
    timezone: 'America/New_York',
    // Intel fields
    intel_profile: null,
    intel_notes: null,
    tags: null,
    local_folder_path: null
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);

  // Rep Assignment state
  const [allReps, setAllReps] = useState<Rep[]>([]);
  const [assignedRepIds, setAssignedRepIds] = useState<string[]>([]);
  const [isLoadingReps, setIsLoadingReps] = useState(false);

  const isEditing = !!client?.id;

  useEffect(() => {
    if (client) {
      setFormData(client);
    }
    loadReps();
    if (client?.id) {
      loadAssignedReps(client.id);
    }
  }, [client]);

  const loadReps = async () => {
    setIsLoadingReps(true);
    try {
      const response = await fetch('/api/admin/reps');
      const result = await response.json();
      if (result.success) {
        setAllReps(result.data || []);
      }
    } catch (err) {
      console.error('Failed to load reps:', err);
    } finally {
      setIsLoadingReps(false);
    }
  };

  const loadAssignedReps = async (clientId: string) => {
    try {
      const response = await fetch(`/api/admin/clients/${clientId}/reps`);
      const result = await response.json();
      if (result.success) {
        setAssignedRepIds(result.data?.map((r: Rep) => r.id) || []);
      }
    } catch (err) {
      console.error('Failed to load assigned reps:', err);
    }
  };

  const assignRep = async (repId: string) => {
    if (!client?.id) {
      setAssignedRepIds(prev => [...prev, repId]);
      return;
    }
    try {
      await fetch(`/api/admin/clients/${client.id}/reps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rep_id: repId })
      });
      setAssignedRepIds(prev => [...prev, repId]);
    } catch (err) {
      console.error('Failed to assign rep:', err);
    }
  };

  const unassignRep = async (repId: string) => {
    if (!client?.id) {
      setAssignedRepIds(prev => prev.filter(id => id !== repId));
      return;
    }
    try {
      await fetch(`/api/admin/clients/${client.id}/reps/${repId}`, {
        method: 'DELETE'
      });
      setAssignedRepIds(prev => prev.filter(id => id !== repId));
    } catch (err) {
      console.error('Failed to unassign rep:', err);
    }
  };

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
                className={`flex-1 px-4 py-2 bg-gray-900 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 ${slugError ? 'border-red-500' : 'border-gray-600'
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
                className={`p-3 rounded-lg border text-left transition-all ${(formData.support_plan_tier || 'none') === tier.value
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                  }`}
              >
                <span className={`block font-medium ${(formData.support_plan_tier || 'none') === tier.value ? 'text-amber-400' : 'text-white'
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

        {/* Client Intelligence - ADMIN ONLY, NOT synced to portal */}
        <div className="space-y-4 p-4 bg-purple-900/10 border border-purple-500/20 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
            <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider">
              Client Intelligence (Private)
            </h3>
          </div>
          <p className="text-xs text-gray-500">
            This data is for internal use only and is NOT visible in the client portal.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Intel Profile</label>
            <textarea
              value={formData.intel_profile || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, intel_profile: e.target.value || null }))}
              placeholder="Research findings, competitive intel, key insights..."
              rows={4}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Intel Notes</label>
            <textarea
              value={formData.intel_notes || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, intel_notes: e.target.value || null }))}
              placeholder="Private notes, strategy, follow-up actions..."
              rows={3}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Tags</label>
            <input
              type="text"
              value={formData.tags || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value || null }))}
              placeholder="toast-user, cape-cod, high-priority, ..."
              className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-gray-500 text-xs mt-1">Comma-separated tags for filtering and categorization</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Local Folder Path</label>
            <input
              type="text"
              value={formData.local_folder_path || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, local_folder_path: e.target.value || null }))}
              placeholder="S:\rg_platform\clients\client-slug"
              className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-gray-500 text-xs mt-1">Path to client folder on Seagate drive</p>
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

        {/* Rep Assignment */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            Assigned Sales Reps
          </h3>

          {/* Assigned Reps */}
          {assignedRepIds.length > 0 ? (
            <div className="space-y-2">
              {assignedRepIds.map(repId => {
                const rep = allReps.find(r => r.id === repId);
                if (!rep) return null;
                return (
                  <div
                    key={repId}
                    className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border border-gray-700"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                        <Briefcase className="w-4 h-4 text-green-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">{rep.name}</p>
                        <p className="text-gray-500 text-xs">{rep.territory || rep.email}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => unassignRep(repId)}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Remove rep"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4 bg-gray-900/30 rounded-lg border border-gray-700 border-dashed">
              <Users className="w-6 h-6 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No reps assigned</p>
            </div>
          )}

          {/* Add Rep Dropdown */}
          {allReps.filter(r => !assignedRepIds.includes(r.id) && r.status === 'active').length > 0 && (
            <div>
              <label className="block text-sm text-gray-400 mb-2">Add Rep</label>
              <div className="flex gap-2">
                <select
                  id="rep-select"
                  defaultValue=""
                  className="flex-1 px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="" disabled>Select a rep to assign...</option>
                  {allReps
                    .filter(r => !assignedRepIds.includes(r.id) && r.status === 'active')
                    .map(rep => (
                      <option key={rep.id} value={rep.id}>
                        {rep.name} {rep.territory ? `(${rep.territory})` : ''}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const select = document.getElementById('rep-select') as HTMLSelectElement;
                    if (select.value) {
                      assignRep(select.value);
                      select.value = '';
                    }
                  }}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Assign
                </button>
              </div>
            </div>
          )}

          {isLoadingReps && (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
            </div>
          )}
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
