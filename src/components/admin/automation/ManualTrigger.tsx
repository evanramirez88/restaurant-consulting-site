import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Loader2,
  Building2,
  FileText,
  Calendar,
  AlertCircle,
  Upload,
  ChevronDown,
  Zap,
  UtensilsCrossed,
  Settings,
  Users,
  DollarSign,
  BarChart3
} from 'lucide-react';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface Client {
  id: string;
  name: string;
  company: string;
  hasCredentials?: boolean;
}

interface ManualTriggerProps {
  onClose: () => void;
  onJobCreated: () => void;
}

const JOB_TYPES = [
  {
    id: 'menu_upload',
    label: 'Menu Upload',
    description: 'Upload menu items from Menu Builder to Toast',
    icon: UtensilsCrossed,
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    requiresInput: true,
    inputType: 'menu'
  },
  {
    id: 'kds_config',
    label: 'KDS Configuration',
    description: 'Configure Kitchen Display System routing',
    icon: Settings,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    requiresInput: false
  },
  {
    id: 'printer_setup',
    label: 'Printer Setup',
    description: 'Set up printer stations and routing',
    icon: FileText,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    requiresInput: false
  },
  {
    id: 'employee_setup',
    label: 'Employee Setup',
    description: 'Create employee profiles and permissions',
    icon: Users,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    requiresInput: true,
    inputType: 'employees'
  },
  {
    id: 'tax_config',
    label: 'Tax Configuration',
    description: 'Configure tax rules and rates',
    icon: DollarSign,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    requiresInput: false
  },
  {
    id: 'health_check',
    label: 'Health Check',
    description: 'Verify Toast configuration is correct',
    icon: BarChart3,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    requiresInput: false
  },
  {
    id: 'full_setup',
    label: 'Full Setup',
    description: 'Complete restaurant configuration',
    icon: Zap,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    requiresInput: true,
    inputType: 'config'
  }
];

// ============================================
// COMPONENT
// ============================================

const ManualTrigger: React.FC<ManualTriggerProps> = ({ onClose, onJobCreated }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedJobType, setSelectedJobType] = useState<string>('');
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [inputFile, setInputFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch clients
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await fetch('/api/admin/clients');
        const result = await response.json();
        if (result.success) {
          setClients(result.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch clients:', err);
      } finally {
        setIsLoadingClients(false);
      }
    };
    fetchClients();
  }, []);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedClient) {
      setError('Please select a client');
      return;
    }

    if (!selectedJobType) {
      setError('Please select a job type');
      return;
    }

    setIsLoading(true);

    try {
      const payload: Record<string, unknown> = {
        clientId: selectedClient,
        jobType: selectedJobType,
        notes: notes || undefined,
        scheduledAt: scheduledAt || undefined
      };

      // Handle file input if needed
      if (inputFile) {
        // For now, we'd upload to R2 and include the key
        // This is a simplified version
        payload.input = { fileName: inputFile.name };
      }

      const response = await fetch('/api/automation/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.success) {
        onJobCreated();
      } else {
        setError(result.error || 'Failed to create job');
      }
    } catch (err) {
      console.error('Failed to create job:', err);
      setError('Failed to create automation job');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedJobConfig = JOB_TYPES.find(j => j.id === selectedJobType);
  const selectedClientData = clients.find(c => c.id === selectedClient);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
              <Play className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">New Automation Job</h2>
              <p className="text-sm text-gray-400">Configure and trigger a Toast automation task</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Client Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select Client
            </label>
            {isLoadingClients ? (
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading clients...
              </div>
            ) : (
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500 appearance-none cursor-pointer"
                >
                  <option value="">Choose a client...</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.company || client.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              </div>
            )}
            {selectedClientData && !selectedClientData.hasCredentials && (
              <p className="mt-2 text-sm text-yellow-400 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                This client doesn't have Toast credentials configured
              </p>
            )}
          </div>

          {/* Job Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Job Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {JOB_TYPES.map(jobType => {
                const Icon = jobType.icon;
                const isSelected = selectedJobType === jobType.id;
                return (
                  <button
                    key={jobType.id}
                    type="button"
                    onClick={() => setSelectedJobType(jobType.id)}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-all text-left ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${jobType.bgColor}`}>
                      <Icon className={`w-4 h-4 ${jobType.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium ${isSelected ? 'text-amber-400' : 'text-white'}`}>
                        {jobType.label}
                      </p>
                      <p className="text-xs text-gray-500 line-clamp-2">{jobType.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Input File (if required) */}
          {selectedJobConfig?.requiresInput && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Input Data
              </label>
              <div
                className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center hover:border-gray-500 transition-colors cursor-pointer"
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <input
                  id="file-input"
                  type="file"
                  accept=".json,.csv"
                  className="hidden"
                  onChange={(e) => setInputFile(e.target.files?.[0] || null)}
                />
                {inputFile ? (
                  <div className="flex items-center justify-center gap-2 text-green-400">
                    <FileText className="w-5 h-5" />
                    <span>{inputFile.name}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInputFile(null);
                      }}
                      className="p-1 hover:bg-gray-700 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                    <p className="text-gray-400">
                      {selectedJobConfig.inputType === 'menu'
                        ? 'Upload menu JSON from Menu Builder'
                        : 'Upload configuration file'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">JSON or CSV format</p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Schedule (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Schedule (Optional)
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Leave empty to run immediately
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this job..."
              rows={3}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !selectedClient || !selectedJobType}
            className="flex items-center gap-2 px-6 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                {scheduledAt ? 'Schedule Job' : 'Start Job'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManualTrigger;
