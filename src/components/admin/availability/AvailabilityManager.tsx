import React, { useState, useEffect } from 'react';
import {
  Calendar, Clock, MapPin, Save, Loader2, RefreshCw, Plus, Trash2,
  ChevronDown, ChevronUp, CheckCircle, AlertCircle, Link2, Phone, Mail,
  CalendarClock, Eye, EyeOff, GripVertical
} from 'lucide-react';

interface AvailabilitySchedule {
  id: string;
  title: string | null;
  status: 'available' | 'busy' | 'offline' | 'by_appointment';
  location_type: 'remote' | 'onsite' | 'both';
  town: string | null;
  address: string | null;
  walk_ins_accepted: boolean;
  scheduling_available: boolean;
  scheduling_link: string | null;
  scheduling_link_type: 'email' | 'phone' | 'acuity' | 'google' | 'calendly' | 'custom' | null;
  availability_start: number | null;
  availability_end: number | null;
  display_start: number | null;
  display_end: number | null;
  custom_message: string | null;
  priority: number;
  is_active: boolean;
}

interface CurrentAvailability {
  status: 'available' | 'busy' | 'offline';
  locationType: 'remote' | 'onsite' | 'both';
  town: string | null;
  address: string | null;
  walkInsAccepted: boolean;
  schedulingAvailable: boolean;
  customMessage: string | null;
  updatedAt: number | null;
}

const CAPE_COD_TOWNS = [
  'Provincetown', 'Wellfleet', 'Eastham', 'Orleans', 'Brewster',
  'Dennis', 'Yarmouth', 'Hyannis', 'Barnstable', 'Mashpee',
  'Falmouth', 'Sandwich', 'Bourne', 'Wareham'
];

const SCHEDULING_LINK_TYPES = [
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'phone', label: 'Phone', icon: Phone },
  { value: 'acuity', label: 'Acuity', icon: CalendarClock },
  { value: 'google', label: 'Google Calendar', icon: Calendar },
  { value: 'calendly', label: 'Calendly', icon: CalendarClock },
  { value: 'custom', label: 'Custom URL', icon: Link2 }
];

const AvailabilityManager: React.FC = () => {
  // Current status (quick toggle)
  const [currentStatus, setCurrentStatus] = useState<CurrentAvailability>({
    status: 'offline',
    locationType: 'remote',
    town: null,
    address: null,
    walkInsAccepted: false,
    schedulingAvailable: true,
    customMessage: null,
    updatedAt: null
  });

  // Scheduled availability entries
  const [schedules, setSchedules] = useState<AvailabilitySchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');

  // Form state for new/edit schedule
  const [editingSchedule, setEditingSchedule] = useState<AvailabilitySchedule | null>(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load current availability
      const currentResponse = await fetch('/api/availability');
      const currentResult = await currentResponse.json();
      if (currentResult.success && currentResult.data) {
        setCurrentStatus(currentResult.data);
      }

      // Load scheduled availability
      const schedulesResponse = await fetch('/api/admin/availability/schedules');
      const schedulesResult = await schedulesResponse.json();
      if (schedulesResult.success) {
        setSchedules(schedulesResult.data || []);
      }
    } catch (error) {
      console.error('Failed to load availability:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveCurrentStatus = async () => {
    setSaveStatus('saving');
    try {
      const response = await fetch('/api/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentStatus)
      });
      const result = await response.json();
      if (result.success) {
        setCurrentStatus(result.data);
        setSaveStatus('success');
        setSaveMessage('Status updated!');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      setSaveStatus('error');
      setSaveMessage('Failed to save');
    }
  };

  const saveSchedule = async (schedule: AvailabilitySchedule) => {
    try {
      const isNew = !schedule.id || schedule.id.startsWith('new-');
      const response = await fetch(
        isNew
          ? '/api/admin/availability/schedules'
          : `/api/admin/availability/schedules/${schedule.id}`,
        {
          method: isNew ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(schedule)
        }
      );
      const result = await response.json();
      if (result.success) {
        await loadData();
        setShowScheduleForm(false);
        setEditingSchedule(null);
      }
    } catch (error) {
      console.error('Failed to save schedule:', error);
    }
  };

  const deleteSchedule = async (id: string) => {
    if (!confirm('Delete this scheduled availability?')) return;
    try {
      await fetch(`/api/admin/availability/schedules/${id}`, {
        method: 'DELETE'
      });
      setSchedules(prev => prev.filter(s => s.id !== id));
    } catch (error) {
      console.error('Failed to delete schedule:', error);
    }
  };

  const formatDateTime = (timestamp: number | null) => {
    if (!timestamp) return 'Not set';
    return new Date(timestamp * 1000).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const createNewSchedule = (): AvailabilitySchedule => ({
    id: `new-${Date.now()}`,
    title: '',
    status: 'available',
    location_type: 'remote',
    town: null,
    address: null,
    walk_ins_accepted: false,
    scheduling_available: true,
    scheduling_link: null,
    scheduling_link_type: null,
    availability_start: null,
    availability_end: null,
    display_start: null,
    display_end: null,
    custom_message: null,
    priority: 0,
    is_active: true
  });

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
            <Calendar className="w-5 h-5 text-amber-400" />
            Availability Manager
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Control your current status and schedule future availability
          </p>
        </div>
        <button
          onClick={loadData}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Current Status Card (Quick Toggle) */}
      <section className="admin-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${
            currentStatus.status === 'available' ? 'bg-green-500' :
            currentStatus.status === 'busy' ? 'bg-yellow-500' : 'bg-gray-500'
          }`} />
          Current Status
        </h3>

        {/* Status Selector */}
        <div className="grid grid-cols-3 gap-2 p-1 bg-gray-900/50 rounded-xl mb-4">
          {(['available', 'busy', 'offline'] as const).map((status) => {
            const isActive = currentStatus.status === status;
            const colors = {
              available: 'bg-green-500 text-white',
              busy: 'bg-yellow-500 text-gray-900',
              offline: 'bg-gray-600 text-white'
            };
            return (
              <button
                key={status}
                onClick={() => setCurrentStatus(prev => ({ ...prev, status }))}
                className={`py-3 px-4 rounded-lg font-medium text-sm transition-all capitalize ${
                  isActive ? colors[status] : 'text-gray-400 hover:text-white'
                }`}
              >
                {status}
              </button>
            );
          })}
        </div>

        {/* Location Type */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {(['remote', 'onsite', 'both'] as const).map((type) => {
            const isActive = currentStatus.locationType === type;
            const labels = { remote: 'Remote Only', onsite: 'On-Site', both: 'Both' };
            return (
              <button
                key={type}
                onClick={() => setCurrentStatus(prev => ({ ...prev, locationType: type }))}
                className={`py-2 px-3 rounded-lg text-sm transition-all border ${
                  isActive
                    ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                {labels[type]}
              </button>
            );
          })}
        </div>

        {/* Town (if onsite/both) */}
        {(currentStatus.locationType === 'onsite' || currentStatus.locationType === 'both') && (
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Location</label>
            <select
              value={currentStatus.town || ''}
              onChange={(e) => setCurrentStatus(prev => ({ ...prev, town: e.target.value || null }))}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Select location...</option>
              {CAPE_COD_TOWNS.map(town => (
                <option key={town} value={town}>{town}</option>
              ))}
            </select>
          </div>
        )}

        {/* Quick Message */}
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-2">
            Quick Message <span className="text-gray-600">({(currentStatus.customMessage || '').length}/200)</span>
          </label>
          <textarea
            value={currentStatus.customMessage || ''}
            onChange={(e) => {
              if (e.target.value.length <= 200) {
                setCurrentStatus(prev => ({ ...prev, customMessage: e.target.value || null }));
              }
            }}
            placeholder="e.g., 'Available for emergency support tonight!'"
            rows={2}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-amber-500 resize-none"
          />
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-4">
          <button
            onClick={saveCurrentStatus}
            disabled={saveStatus === 'saving'}
            className="flex items-center gap-2 px-6 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors"
          >
            {saveStatus === 'saving' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Update Status
          </button>
          {saveStatus === 'success' && (
            <span className="text-green-400 text-sm flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              {saveMessage}
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-red-400 text-sm flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {saveMessage}
            </span>
          )}
        </div>
      </section>

      {/* Scheduled Availability */}
      <section className="admin-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-amber-400" />
            Scheduled Availability
          </h3>
          <button
            onClick={() => {
              setEditingSchedule(createNewSchedule());
              setShowScheduleForm(true);
            }}
            className="flex items-center gap-2 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Schedule
          </button>
        </div>

        <p className="text-gray-400 text-sm mb-4">
          Schedule availability windows in advance. Higher priority schedules display first when multiple are active.
        </p>

        {/* Schedule List */}
        {schedules.length === 0 ? (
          <div className="text-center py-8 bg-gray-900/30 rounded-lg border border-gray-700">
            <Calendar className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No scheduled availability</p>
            <p className="text-gray-500 text-sm">Add a schedule to plan ahead</p>
          </div>
        ) : (
          <div className="space-y-3">
            {schedules.map((schedule) => (
              <div
                key={schedule.id}
                className={`p-4 rounded-lg border transition-all ${
                  schedule.is_active
                    ? 'bg-gray-900/30 border-gray-700'
                    : 'bg-gray-900/10 border-gray-800 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <GripVertical className="w-4 h-4 text-gray-600 cursor-grab" />
                    <div className={`w-3 h-3 rounded-full ${
                      schedule.status === 'available' ? 'bg-green-500' :
                      schedule.status === 'busy' ? 'bg-yellow-500' :
                      schedule.status === 'by_appointment' ? 'bg-blue-500' : 'bg-gray-500'
                    }`} />
                    <div>
                      <p className="text-white font-medium">
                        {schedule.title || `${schedule.status.charAt(0).toUpperCase() + schedule.status.slice(1)} - ${schedule.location_type}`}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDateTime(schedule.availability_start)} - {formatDateTime(schedule.availability_end)}
                        </span>
                        {schedule.town && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {schedule.town}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
                      Priority: {schedule.priority}
                    </span>
                    <button
                      onClick={() => {
                        setEditingSchedule(schedule);
                        setShowScheduleForm(true);
                      }}
                      className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteSchedule(schedule.id)}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {schedule.custom_message && (
                  <p className="text-gray-400 text-sm mt-2 pl-10">"{schedule.custom_message}"</p>
                )}

                {/* Display Window Info */}
                {(schedule.display_start || schedule.display_end) && (
                  <div className="flex items-center gap-2 mt-2 pl-10 text-xs text-gray-500">
                    <Eye className="w-3 h-3" />
                    <span>
                      Shows: {formatDateTime(schedule.display_start)} - {formatDateTime(schedule.display_end)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Schedule Form Modal */}
      {showScheduleForm && editingSchedule && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
            <div className="p-6 border-b border-gray-700">
              <h3 className="text-lg font-bold text-white">
                {editingSchedule.id.startsWith('new-') ? 'Add Schedule' : 'Edit Schedule'}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Title (optional)</label>
                <input
                  type="text"
                  value={editingSchedule.title || ''}
                  onChange={(e) => setEditingSchedule(prev => prev ? { ...prev, title: e.target.value || null } : null)}
                  placeholder="e.g., Cape Cod Week"
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Status</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['available', 'busy', 'by_appointment', 'offline'] as const).map(status => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setEditingSchedule(prev => prev ? { ...prev, status } : null)}
                      className={`py-2 px-3 rounded-lg text-sm transition-all border capitalize ${
                        editingSchedule.status === status
                          ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                          : 'border-gray-700 text-gray-400'
                      }`}
                    >
                      {status.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Availability Window */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Available From</label>
                  <input
                    type="datetime-local"
                    value={editingSchedule.availability_start
                      ? new Date(editingSchedule.availability_start * 1000).toISOString().slice(0, 16)
                      : ''}
                    onChange={(e) => setEditingSchedule(prev => prev ? {
                      ...prev,
                      availability_start: e.target.value ? Math.floor(new Date(e.target.value).getTime() / 1000) : null
                    } : null)}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Available Until</label>
                  <input
                    type="datetime-local"
                    value={editingSchedule.availability_end
                      ? new Date(editingSchedule.availability_end * 1000).toISOString().slice(0, 16)
                      : ''}
                    onChange={(e) => setEditingSchedule(prev => prev ? {
                      ...prev,
                      availability_end: e.target.value ? Math.floor(new Date(e.target.value).getTime() / 1000) : null
                    } : null)}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white"
                  />
                </div>
              </div>

              {/* Display Window */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Display From (when visible on site)</label>
                  <input
                    type="datetime-local"
                    value={editingSchedule.display_start
                      ? new Date(editingSchedule.display_start * 1000).toISOString().slice(0, 16)
                      : ''}
                    onChange={(e) => setEditingSchedule(prev => prev ? {
                      ...prev,
                      display_start: e.target.value ? Math.floor(new Date(e.target.value).getTime() / 1000) : null
                    } : null)}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Display Until</label>
                  <input
                    type="datetime-local"
                    value={editingSchedule.display_end
                      ? new Date(editingSchedule.display_end * 1000).toISOString().slice(0, 16)
                      : ''}
                    onChange={(e) => setEditingSchedule(prev => prev ? {
                      ...prev,
                      display_end: e.target.value ? Math.floor(new Date(e.target.value).getTime() / 1000) : null
                    } : null)}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white"
                  />
                </div>
              </div>

              {/* Scheduling Link */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Scheduling Link Type</label>
                <select
                  value={editingSchedule.scheduling_link_type || ''}
                  onChange={(e) => setEditingSchedule(prev => prev ? {
                    ...prev,
                    scheduling_link_type: e.target.value as any || null
                  } : null)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white"
                >
                  <option value="">None</option>
                  {SCHEDULING_LINK_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              {editingSchedule.scheduling_link_type && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    {editingSchedule.scheduling_link_type === 'email' ? 'Email Address' :
                     editingSchedule.scheduling_link_type === 'phone' ? 'Phone Number' : 'Scheduling URL'}
                  </label>
                  <input
                    type={editingSchedule.scheduling_link_type === 'email' ? 'email' :
                          editingSchedule.scheduling_link_type === 'phone' ? 'tel' : 'url'}
                    value={editingSchedule.scheduling_link || ''}
                    onChange={(e) => setEditingSchedule(prev => prev ? {
                      ...prev,
                      scheduling_link: e.target.value || null
                    } : null)}
                    placeholder={
                      editingSchedule.scheduling_link_type === 'email' ? 'schedule@example.com' :
                      editingSchedule.scheduling_link_type === 'phone' ? '508-555-1234' :
                      'https://calendly.com/...'
                    }
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white"
                  />
                </div>
              )}

              {/* Priority */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Priority (higher = shows first)</label>
                <input
                  type="number"
                  value={editingSchedule.priority}
                  onChange={(e) => setEditingSchedule(prev => prev ? {
                    ...prev,
                    priority: parseInt(e.target.value) || 0
                  } : null)}
                  className="w-32 px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white"
                  min="0"
                  max="100"
                />
              </div>

              {/* Custom Message */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Custom Message</label>
                <textarea
                  value={editingSchedule.custom_message || ''}
                  onChange={(e) => setEditingSchedule(prev => prev ? {
                    ...prev,
                    custom_message: e.target.value || null
                  } : null)}
                  rows={2}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white resize-none"
                />
              </div>

              {/* Active Toggle */}
              <label className="flex items-center justify-between p-4 bg-gray-900/30 rounded-lg border border-gray-700 cursor-pointer">
                <span className="text-white">Active</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={editingSchedule.is_active}
                    onChange={(e) => setEditingSchedule(prev => prev ? {
                      ...prev,
                      is_active: e.target.checked
                    } : null)}
                    className="sr-only"
                  />
                  <div className={`w-12 h-7 rounded-full transition-colors ${editingSchedule.is_active ? 'bg-green-500' : 'bg-gray-600'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full transition-transform ${editingSchedule.is_active ? 'translate-x-5' : ''}`} />
                  </div>
                </div>
              </label>
            </div>

            <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowScheduleForm(false);
                  setEditingSchedule(null);
                }}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => editingSchedule && saveSchedule(editingSchedule)}
                className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
              >
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AvailabilityManager;
