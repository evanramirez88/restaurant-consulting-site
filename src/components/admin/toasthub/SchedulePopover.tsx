import React, { useState } from 'react';
import { Calendar, Clock, X, Check, Loader2 } from 'lucide-react';

interface SchedulePopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (scheduledFor: number) => Promise<void>;
  currentSchedule?: number | null;
}

export default function SchedulePopover({
  isOpen,
  onClose,
  onSchedule,
  currentSchedule
}: SchedulePopoverProps) {
  const [date, setDate] = useState(() => {
    if (currentSchedule) {
      const d = new Date(currentSchedule * 1000);
      return d.toISOString().split('T')[0];
    }
    // Default to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });

  const [time, setTime] = useState(() => {
    if (currentSchedule) {
      const d = new Date(currentSchedule * 1000);
      return d.toTimeString().slice(0, 5);
    }
    return '09:00';
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSchedule = async () => {
    setError(null);

    // Combine date and time
    const scheduledDate = new Date(`${date}T${time}:00`);
    const scheduledFor = Math.floor(scheduledDate.getTime() / 1000);

    // Validate future date
    if (scheduledFor <= Math.floor(Date.now() / 1000)) {
      setError('Please select a future date and time');
      return;
    }

    setSaving(true);
    try {
      await onSchedule(scheduledFor);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to schedule');
    } finally {
      setSaving(false);
    }
  };

  // Quick schedule options
  const quickOptions = [
    { label: 'Tomorrow 9 AM', days: 1, hours: 9 },
    { label: 'In 3 days', days: 3, hours: 9 },
    { label: 'Next week', days: 7, hours: 9 },
    { label: 'In 2 weeks', days: 14, hours: 9 }
  ];

  const applyQuickOption = (days: number, hours: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(hours, 0, 0, 0);
    setDate(d.toISOString().split('T')[0]);
    setTime(`${String(hours).padStart(2, '0')}:00`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md p-6 m-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-400" />
            Schedule Publication
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Options */}
        <div className="mb-6">
          <p className="text-xs text-gray-400 mb-2">Quick Schedule</p>
          <div className="flex flex-wrap gap-2">
            {quickOptions.map((opt) => (
              <button
                key={opt.label}
                onClick={() => applyQuickOption(opt.days, opt.hours)}
                className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date/Time Inputs */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Time</label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="mb-6 p-3 bg-gray-900 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Will publish on:</p>
          <p className="text-white font-medium">
            {new Date(`${date}T${time}:00`).toLocaleString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            })}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSchedule}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            {saving ? 'Scheduling...' : 'Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}
