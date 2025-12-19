import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, LogOut, Save, CheckCircle, AlertCircle, ChevronDown, ChevronUp,
  MapPin, Clock, Phone, Mail, DollarSign, UtensilsCrossed, RefreshCw
} from 'lucide-react';
import { useSEO } from '../src/components/SEO';

// Cape Cod towns for dropdown
const CAPE_COD_TOWNS = [
  'Provincetown', 'Wellfleet', 'Eastham', 'Orleans', 'Brewster',
  'Dennis', 'Yarmouth', 'Hyannis', 'Barnstable', 'Mashpee',
  'Falmouth', 'Sandwich', 'Bourne', 'Wareham'
];

type AvailabilityStatus = 'available' | 'busy' | 'offline';
type LocationType = 'remote' | 'onsite' | 'both';

interface AvailabilityData {
  status: AvailabilityStatus;
  locationType: LocationType;
  town: string | null;
  address: string | null;
  walkInsAccepted: boolean;
  schedulingAvailable: boolean;
  customMessage: string | null;
  updatedAt: number | null;
}

interface ConfigData {
  phone: string;
  email: string;
  hourly_rate_remote: string;
  hourly_rate_onsite: string;
  business_hours: string;
}

interface SaveStatus {
  type: 'idle' | 'saving' | 'success' | 'error';
  message: string;
}

const AdminDashboard: React.FC = () => {
  useSEO({
    title: 'Admin Dashboard | Cape Cod Restaurant Consulting',
    description: 'Manage availability and site settings.',
  });

  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Availability state
  const [availability, setAvailability] = useState<AvailabilityData>({
    status: 'offline',
    locationType: 'remote',
    town: null,
    address: null,
    walkInsAccepted: false,
    schedulingAvailable: true,
    customMessage: null,
    updatedAt: null
  });
  const [customTown, setCustomTown] = useState('');
  const [availabilitySaveStatus, setAvailabilitySaveStatus] = useState<SaveStatus>({
    type: 'idle',
    message: ''
  });

  // Config state
  const [config, setConfig] = useState<ConfigData>({
    phone: '',
    email: '',
    hourly_rate_remote: '',
    hourly_rate_onsite: '',
    business_hours: ''
  });
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [configSaveStatus, setConfigSaveStatus] = useState<{ [key: string]: SaveStatus }>({});
  const [settingsExpanded, setSettingsExpanded] = useState(false);

  // Check authentication and load data
  useEffect(() => {
    const init = async () => {
      try {
        const authResponse = await fetch('/api/auth/verify');
        const authData = await authResponse.json();

        if (!authData.authenticated) {
          navigate('/admin/login');
          return;
        }

        setIsAuthenticated(true);
        await Promise.all([loadAvailability(), loadConfig()]);
      } catch (error) {
        console.error('Init error:', error);
        navigate('/admin/login');
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [navigate]);

  const loadAvailability = async () => {
    try {
      const response = await fetch('/api/availability');
      const result = await response.json();
      if (result.success && result.data) {
        setAvailability(result.data);
        // Check if town is custom
        if (result.data.town && !CAPE_COD_TOWNS.includes(result.data.town)) {
          setCustomTown(result.data.town);
        }
      }
    } catch (error) {
      console.error('Load availability error:', error);
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

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      navigate('/admin/login');
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/admin/login');
    }
  };

  const saveAvailability = async () => {
    setAvailabilitySaveStatus({ type: 'saving', message: '' });

    try {
      // Determine final town value
      let finalTown = availability.town;
      if (availability.town === 'custom') {
        finalTown = customTown || null;
      }

      const response = await fetch('/api/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...availability,
          town: finalTown
        })
      });

      const result = await response.json();

      if (result.success) {
        setAvailability(result.data);
        setAvailabilitySaveStatus({
          type: 'success',
          message: 'Availability updated!'
        });
        setTimeout(() => {
          setAvailabilitySaveStatus({ type: 'idle', message: '' });
        }, 3000);
      } else {
        throw new Error(result.error || 'Failed to save');
      }
    } catch (error) {
      console.error('Save availability error:', error);
      setAvailabilitySaveStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to save'
      });
    }
  };

  const saveConfigField = async (key: string, value: string) => {
    setConfigSaveStatus(prev => ({
      ...prev,
      [key]: { type: 'saving', message: '' }
    }));

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
        setConfigSaveStatus(prev => ({
          ...prev,
          [key]: { type: 'success', message: 'Saved!' }
        }));
        setTimeout(() => {
          setConfigSaveStatus(prev => ({
            ...prev,
            [key]: { type: 'idle', message: '' }
          }));
        }, 2000);
      } else {
        throw new Error(result.error || 'Failed to save');
      }
    } catch (error) {
      console.error('Save config error:', error);
      setConfigSaveStatus(prev => ({
        ...prev,
        [key]: {
          type: 'error',
          message: error instanceof Error ? error.message : 'Failed to save'
        }
      }));
    }
  };

  const startEditing = (key: string, value: string) => {
    setEditingField(key);
    setEditValue(value);
  };

  const cancelEditing = () => {
    setEditingField(null);
    setEditValue('');
  };

  const formatTimeAgo = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-dark to-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const showLocationFields = availability.locationType === 'onsite' || availability.locationType === 'both';

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-dark to-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center border border-gray-700">
              <UtensilsCrossed className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="font-display font-bold text-white text-lg">Admin Dashboard</h1>
              <p className="text-xs text-gray-400">R&G Consulting</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors min-h-[44px]"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Availability Status Section */}
        <section className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-display font-bold text-white">Availability Status</h2>
            <button
              onClick={loadAvailability}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Status Segmented Control */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">Current Status</label>
            <div className="grid grid-cols-3 gap-2 p-1 bg-gray-900/50 rounded-xl">
              {(['available', 'busy', 'offline'] as AvailabilityStatus[]).map((status) => {
                const isActive = availability.status === status;
                const colors = {
                  available: 'bg-green-500 text-white shadow-green-500/30',
                  busy: 'bg-yellow-500 text-gray-900 shadow-yellow-500/30',
                  offline: 'bg-gray-600 text-white shadow-gray-600/30'
                };
                return (
                  <button
                    key={status}
                    onClick={() => setAvailability(prev => ({ ...prev, status }))}
                    className={`py-3 px-4 rounded-lg font-semibold text-sm capitalize transition-all min-h-[48px] ${
                      isActive
                        ? `${colors[status]} shadow-lg`
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    {status}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Location Type */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">Location Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['remote', 'onsite', 'both'] as LocationType[]).map((type) => {
                const isActive = availability.locationType === type;
                const labels = { remote: 'Remote Only', onsite: 'On-Site', both: 'Both' };
                return (
                  <button
                    key={type}
                    onClick={() => setAvailability(prev => ({ ...prev, locationType: type }))}
                    className={`py-3 px-4 rounded-lg font-medium text-sm transition-all min-h-[48px] border ${
                      isActive
                        ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                        : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white'
                    }`}
                  >
                    {labels[type]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Town & Address (conditional) */}
          {showLocationFields && (
            <div className="space-y-4 mb-6 p-4 bg-gray-900/30 rounded-lg border border-gray-700">
              <div className="flex items-center gap-2 text-amber-400 mb-2">
                <MapPin className="w-4 h-4" />
                <span className="text-sm font-medium">Location Details</span>
              </div>

              {/* Town Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Town</label>
                <select
                  value={CAPE_COD_TOWNS.includes(availability.town || '') ? availability.town || '' : (availability.town ? 'custom' : '')}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'custom') {
                      setAvailability(prev => ({ ...prev, town: 'custom' }));
                    } else {
                      setAvailability(prev => ({ ...prev, town: value || null }));
                      setCustomTown('');
                    }
                  }}
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent min-h-[48px]"
                >
                  <option value="">Select a town...</option>
                  {CAPE_COD_TOWNS.map((town) => (
                    <option key={town} value={town}>{town}</option>
                  ))}
                  <option value="custom">Custom...</option>
                </select>
              </div>

              {/* Custom Town Input */}
              {(availability.town === 'custom' || (availability.town && !CAPE_COD_TOWNS.includes(availability.town))) && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Custom Town</label>
                  <input
                    type="text"
                    value={customTown}
                    onChange={(e) => setCustomTown(e.target.value)}
                    placeholder="Enter town name"
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent min-h-[48px]"
                  />
                </div>
              )}

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Address <span className="text-gray-500">(for walk-in directions)</span>
                </label>
                <input
                  type="text"
                  value={availability.address || ''}
                  onChange={(e) => setAvailability(prev => ({ ...prev, address: e.target.value || null }))}
                  placeholder="123 Main St"
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent min-h-[48px]"
                />
              </div>
            </div>
          )}

          {/* Toggle Switches */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {/* Walk-ins Accepted */}
            <label className="flex items-center justify-between p-4 bg-gray-900/30 rounded-lg border border-gray-700 cursor-pointer hover:border-gray-600 transition-colors min-h-[60px]">
              <span className="text-gray-300 font-medium">Walk-ins Accepted</span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={availability.walkInsAccepted}
                  onChange={(e) => setAvailability(prev => ({ ...prev, walkInsAccepted: e.target.checked }))}
                  className="sr-only"
                />
                <div className={`w-12 h-7 rounded-full transition-colors ${availability.walkInsAccepted ? 'bg-green-500' : 'bg-gray-600'}`}>
                  <div className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${availability.walkInsAccepted ? 'translate-x-5' : ''}`} />
                </div>
              </div>
            </label>

            {/* Scheduling Available */}
            <label className="flex items-center justify-between p-4 bg-gray-900/30 rounded-lg border border-gray-700 cursor-pointer hover:border-gray-600 transition-colors min-h-[60px]">
              <span className="text-gray-300 font-medium">Scheduling Available</span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={availability.schedulingAvailable}
                  onChange={(e) => setAvailability(prev => ({ ...prev, schedulingAvailable: e.target.checked }))}
                  className="sr-only"
                />
                <div className={`w-12 h-7 rounded-full transition-colors ${availability.schedulingAvailable ? 'bg-green-500' : 'bg-gray-600'}`}>
                  <div className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${availability.schedulingAvailable ? 'translate-x-5' : ''}`} />
                </div>
              </div>
            </label>
          </div>

          {/* Custom Message */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Quick Message <span className="text-gray-500">({(availability.customMessage || '').length}/200)</span>
            </label>
            <textarea
              value={availability.customMessage || ''}
              onChange={(e) => {
                if (e.target.value.length <= 200) {
                  setAvailability(prev => ({ ...prev, customMessage: e.target.value || null }));
                }
              }}
              placeholder="e.g., 'Available for emergency support tonight!'"
              rows={3}
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Save Button & Status */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <button
              onClick={saveAvailability}
              disabled={availabilitySaveStatus.type === 'saving'}
              className="flex-1 sm:flex-none px-6 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 min-h-[48px]"
            >
              {availabilitySaveStatus.type === 'saving' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Update Status</span>
                </>
              )}
            </button>

            {availabilitySaveStatus.type === 'success' && (
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm">{availabilitySaveStatus.message}</span>
              </div>
            )}

            {availabilitySaveStatus.type === 'error' && (
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">{availabilitySaveStatus.message}</span>
              </div>
            )}
          </div>

          {/* Last Updated */}
          <p className="text-xs text-gray-500 mt-4">
            Last updated: {formatTimeAgo(availability.updatedAt)}
          </p>
        </section>

        {/* Site Settings Section (Collapsible) */}
        <section className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
          <button
            onClick={() => setSettingsExpanded(!settingsExpanded)}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-800/30 transition-colors"
          >
            <h2 className="text-xl font-display font-bold text-white">Site Settings</h2>
            {settingsExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {settingsExpanded && (
            <div className="px-6 pb-6 space-y-4">
              {/* Config Fields */}
              {[
                { key: 'phone', label: 'Phone', icon: Phone, type: 'tel' },
                { key: 'email', label: 'Email', icon: Mail, type: 'email' },
                { key: 'hourly_rate_remote', label: 'Remote Rate', icon: DollarSign, type: 'number', prefix: '$', suffix: '/hr' },
                { key: 'hourly_rate_onsite', label: 'On-Site Rate', icon: DollarSign, type: 'number', prefix: '$', suffix: '/hr' },
                { key: 'business_hours', label: 'Business Hours', icon: Clock, type: 'text' }
              ].map(({ key, label, icon: Icon, type, prefix, suffix }) => {
                const isEditing = editingField === key;
                const status = configSaveStatus[key];
                const value = config[key as keyof ConfigData];

                return (
                  <div
                    key={key}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-gray-900/30 rounded-lg border border-gray-700"
                  >
                    <div className="flex items-center gap-3 sm:w-40">
                      <Icon className="w-4 h-4 text-amber-400" />
                      <span className="text-gray-300 font-medium">{label}</span>
                    </div>

                    <div className="flex-1 flex items-center gap-2">
                      {isEditing ? (
                        <>
                          {prefix && <span className="text-gray-400">{prefix}</span>}
                          <input
                            type={type}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            autoFocus
                            className="flex-1 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent min-h-[44px]"
                          />
                          {suffix && <span className="text-gray-400">{suffix}</span>}
                        </>
                      ) : (
                        <span className="flex-1 text-white">
                          {prefix}{value}{suffix}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveConfigField(key, editValue)}
                            disabled={status?.type === 'saving'}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors min-h-[44px]"
                          >
                            {status?.type === 'saving' ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              'Save'
                            )}
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 text-sm font-medium rounded-lg transition-colors min-h-[44px]"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startEditing(key, value)}
                          className="px-4 py-2 text-amber-400 hover:text-amber-300 hover:bg-gray-700 text-sm font-medium rounded-lg transition-colors min-h-[44px]"
                        >
                          Edit
                        </button>
                      )}

                      {status?.type === 'success' && (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      )}
                      {status?.type === 'error' && (
                        <span className="text-xs text-red-400">{status.message}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="text-center text-gray-500 text-sm py-4">
          <p>Cape Cod Restaurant Consulting Admin</p>
        </footer>
      </main>
    </div>
  );
};

export default AdminDashboard;
