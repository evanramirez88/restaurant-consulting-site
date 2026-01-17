import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Loader2,
  ArrowLeft,
  Building2,
  Save,
  Send,
  FileText,
  AlertTriangle,
  CheckCircle,
  X,
  Info
} from 'lucide-react';
import { useSEO } from '../../src/components/SEO';

interface ClientInfo {
  id: string;
  name: string;
  company: string;
  email: string;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  can_quote: boolean;
}

// Quote state matches QuoteBuilder localStorage format
interface QuoteLocation {
  id: string;
  name: string;
  address: string;
  travel: {
    zone: string;
    serviceMode: string;
    islandVehicle: boolean;
    lodging: boolean;
    remote: boolean;
  };
  subscriptionPct: number;
  integrationIds: string[];
  floors: Array<{
    id: string;
    name: string;
    stations: Array<{
      id: string;
      name: string;
      type: string;
      hardware: Array<{ hid: string }>;
    }>;
  }>;
}

const LS_KEY = 'ccrc_quote_v3';

const RepQuoteBuilder: React.FC = () => {
  const { slug, clientId } = useParams<{ slug: string; clientId: string }>();
  const navigate = useNavigate();

  useSEO({
    title: 'Create Quote | Rep Portal | Cape Cod Restaurant Consulting',
    description: 'Create a custom quote for your client.',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [quoteName, setQuoteName] = useState('');
  const [quoteNotes, setQuoteNotes] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [quoteBuilderOpened, setQuoteBuilderOpened] = useState(false);

  useEffect(() => {
    const loadClient = async () => {
      try {
        // Check for demo mode
        const isDemoMode = slug?.startsWith('demo-');

        // Load client details
        const clientRes = await fetch(`/api/rep/${slug}/clients/${clientId}`);
        const clientData = await clientRes.json();

        if (!clientData.success) {
          setError(clientData.error || 'Failed to load client');
          setIsLoading(false);
          return;
        }

        setClient(clientData.data);

        // Check permission
        if (!clientData.data.can_quote) {
          setError('You do not have permission to create quotes for this client.');
        }

        // Pre-fill quote name
        setQuoteName(`Quote for ${clientData.data.company}`);
      } catch (err) {
        console.error('Load error:', err);
        setError('Failed to load client details');
      } finally {
        setIsLoading(false);
      }
    };

    loadClient();
  }, [slug, clientId]);

  const getQuoteDataFromLocalStorage = useCallback(() => {
    try {
      const locationsStr = localStorage.getItem(`${LS_KEY}:locations`);
      const supportTierStr = localStorage.getItem(`${LS_KEY}:supportTier`);
      const supportPeriodStr = localStorage.getItem(`${LS_KEY}:supportPeriod`);

      return {
        locations: locationsStr ? JSON.parse(locationsStr) : [],
        supportTier: supportTierStr ? JSON.parse(supportTierStr) : 0,
        supportPeriod: supportPeriodStr ? JSON.parse(supportPeriodStr) : 'monthly'
      };
    } catch (e) {
      console.error('Failed to read quote data:', e);
      return null;
    }
  }, []);

  const calculateTotals = useCallback(async (quoteData: ReturnType<typeof getQuoteDataFromLocalStorage>) => {
    if (!quoteData || !quoteData.locations.length) return { installCost: 0, monthlyCost: 0 };

    try {
      const response = await fetch('/api/quote/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quoteData)
      });
      const result = await response.json();
      if (result.success) {
        return {
          installCost: result.estimate?.installCost || 0,
          monthlyCost: result.estimate?.supportMonthly || 0
        };
      }
    } catch (e) {
      console.error('Calculate error:', e);
    }
    return { installCost: 0, monthlyCost: 0 };
  }, []);

  const handleOpenQuoteBuilder = () => {
    // Pre-fill location address if available
    if (client) {
      const locations = getQuoteDataFromLocalStorage()?.locations || [];
      if (locations.length > 0 && !locations[0].address && client.address_line1) {
        const address = [client.address_line1, client.city, client.state].filter(Boolean).join(', ');
        locations[0].address = address;
        locations[0].name = client.company;
        localStorage.setItem(`${LS_KEY}:locations`, JSON.stringify(locations));
      }
    }
    setQuoteBuilderOpened(true);
    // Open quote builder in same tab (they can use back button)
    window.location.href = '/#/quote?demo=true';
  };

  const handleSaveDraft = async () => {
    if (!client) return;

    const quoteData = getQuoteDataFromLocalStorage();
    if (!quoteData || !quoteData.locations.length) {
      setSaveStatus({ type: 'error', message: 'No quote data found. Please build a quote first.' });
      return;
    }

    setIsSaving(true);
    setSaveStatus({ type: null, message: '' });

    try {
      const totals = await calculateTotals(quoteData);

      const response = await fetch(`/api/rep/${slug}/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          client_id: clientId,
          quote_data_json: JSON.stringify(quoteData),
          quote_name: quoteName || `Quote for ${client.company}`,
          total_install_cost: totals.installCost,
          total_monthly_cost: totals.monthlyCost,
          location_count: quoteData.locations.length,
          notes: quoteNotes,
          status: 'draft'
        })
      });

      const result = await response.json();

      if (result.success) {
        setSaveStatus({ type: 'success', message: 'Quote saved as draft!' });
        setShowSaveModal(false);
        // Navigate to quote detail or quotes list
        setTimeout(() => {
          navigate(`/rep/${slug}/clients/${clientId}`);
        }, 1500);
      } else {
        setSaveStatus({ type: 'error', message: result.error || 'Failed to save quote' });
      }
    } catch (err) {
      console.error('Save error:', err);
      setSaveStatus({ type: 'error', message: 'Failed to save quote' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendToClient = async () => {
    if (!client) return;

    const quoteData = getQuoteDataFromLocalStorage();
    if (!quoteData || !quoteData.locations.length) {
      setSaveStatus({ type: 'error', message: 'No quote data found. Please build a quote first.' });
      return;
    }

    setIsSending(true);
    setSaveStatus({ type: null, message: '' });

    try {
      const totals = await calculateTotals(quoteData);

      const response = await fetch(`/api/rep/${slug}/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          client_id: clientId,
          quote_data_json: JSON.stringify(quoteData),
          quote_name: quoteName || `Quote for ${client.company}`,
          total_install_cost: totals.installCost,
          total_monthly_cost: totals.monthlyCost,
          location_count: quoteData.locations.length,
          notes: quoteNotes,
          status: 'sent',
          send_email: true
        })
      });

      const result = await response.json();

      if (result.success) {
        setSaveStatus({ type: 'success', message: 'Quote sent to client!' });
        setShowSendModal(false);
        setTimeout(() => {
          navigate(`/rep/${slug}/clients/${clientId}`);
        }, 1500);
      } else {
        setSaveStatus({ type: 'error', message: result.error || 'Failed to send quote' });
      }
    } catch (err) {
      console.error('Send error:', err);
      setSaveStatus({ type: 'error', message: 'Failed to send quote' });
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-dark to-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-400 animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-dark to-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Cannot Create Quote</h2>
          <p className="text-gray-400 mb-4">{error || 'Client not found'}</p>
          <Link
            to={`/rep/${slug}/clients/${clientId}`}
            className="text-green-400 hover:text-green-300 flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Client
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-dark to-gray-900">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                to={`/rep/${slug}/clients/${clientId}`}
                className="text-gray-400 hover:text-green-400 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-white">Create Quote</h1>
                  <p className="text-sm text-gray-400">for {client.company}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSaveModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                <Save className="w-4 h-4" />
                Save Draft
              </button>
              <button
                onClick={() => setShowSendModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
              >
                <Send className="w-4 h-4" />
                Send to Client
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Client Info Card */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
              <Building2 className="w-6 h-6 text-gray-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-white mb-1">{client.company}</h2>
              <p className="text-gray-400">{client.name}</p>
              {client.address_line1 && (
                <p className="text-gray-500 text-sm mt-2">
                  {[client.address_line1, client.city, client.state].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Quote Builder Access */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-8 text-center">
          <FileText className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Build Your Quote</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Use our interactive Quote Builder to design a custom POS installation quote
            for {client.company}.
          </p>

          <button
            onClick={handleOpenQuoteBuilder}
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors font-medium text-lg"
          >
            <FileText className="w-5 h-5" />
            Open Quote Builder
          </button>

          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-left">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-300">
                <p className="font-medium text-blue-400 mb-1">How it works:</p>
                <ol className="list-decimal list-inside space-y-1 text-gray-400">
                  <li>Click "Open Quote Builder" to design the quote</li>
                  <li>Add stations, hardware, and integrations</li>
                  <li>Come back here and click "Save Draft" or "Send to Client"</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* Status Message */}
        {saveStatus.type && (
          <div className={`mt-6 p-4 rounded-lg flex items-center gap-3 ${
            saveStatus.type === 'success'
              ? 'bg-green-500/10 border border-green-500/30 text-green-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}>
            {saveStatus.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
            {saveStatus.message}
          </div>
        )}
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Save Quote Draft</h3>
              <button
                onClick={() => setShowSaveModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Quote Name
                </label>
                <input
                  type="text"
                  value={quoteName}
                  onChange={(e) => setQuoteName(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g., Initial Setup Quote"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={quoteNotes}
                  onChange={(e) => setQuoteNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  placeholder="Any notes about this quote..."
                />
              </div>

              {saveStatus.type && (
                <div className={`p-3 rounded-lg text-sm ${
                  saveStatus.type === 'success'
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-red-500/10 text-red-400'
                }`}>
                  {saveStatus.message}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDraft}
                disabled={isSaving}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Draft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Send Quote to Client</h3>
              <button
                onClick={() => setShowSendModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-sm text-gray-300">
                  This will send an email to <span className="text-white font-medium">{client.email}</span> with
                  a link to view this quote.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Quote Name
                </label>
                <input
                  type="text"
                  value={quoteName}
                  onChange={(e) => setQuoteName(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g., Initial Setup Quote"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Notes for Client (optional)
                </label>
                <textarea
                  value={quoteNotes}
                  onChange={(e) => setQuoteNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  placeholder="Message to include with the quote..."
                />
              </div>

              {saveStatus.type && (
                <div className={`p-3 rounded-lg text-sm ${
                  saveStatus.type === 'success'
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-red-500/10 text-red-400'
                }`}>
                  {saveStatus.message}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSendModal(false)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendToClient}
                disabled={isSending}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send Quote
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RepQuoteBuilder;
