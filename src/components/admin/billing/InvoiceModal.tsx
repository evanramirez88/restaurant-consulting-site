import React, { useState, useEffect } from 'react';
import {
  X, FileText, Plus, Trash2, Loader2, Send, DollarSign,
  Calendar, Building2, CheckCircle, AlertCircle
} from 'lucide-react';

interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  amount: number;
}

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedClientId?: string;
  onSuccess?: (invoice: any) => void;
}

const InvoiceModal: React.FC<InvoiceModalProps> = ({
  isOpen,
  onClose,
  preselectedClientId,
  onSuccess
}) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ number: string; url: string } | null>(null);

  // Form state
  const [selectedClientId, setSelectedClientId] = useState(preselectedClientId || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    // Default to 30 days from now
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().split('T')[0];
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), description: '', quantity: 1, amount: 0 }
  ]);

  // Load clients on mount
  useEffect(() => {
    if (isOpen) {
      loadClients();
      if (preselectedClientId) {
        setSelectedClientId(preselectedClientId);
      }
    }
  }, [isOpen, preselectedClientId]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedClientId(preselectedClientId || '');
      setTitle('');
      setDescription('');
      setLineItems([{ id: crypto.randomUUID(), description: '', quantity: 1, amount: 0 }]);
      setError(null);
      setSuccess(null);
      setDueDate(() => {
        const date = new Date();
        date.setDate(date.getDate() + 30);
        return date.toISOString().split('T')[0];
      });
    }
  }, [isOpen, preselectedClientId]);

  const loadClients = async () => {
    setIsLoadingClients(true);
    try {
      const response = await fetch('/api/admin/clients');
      const result = await response.json();
      if (result.success) {
        setClients(result.data || []);
      }
    } catch (err) {
      console.error('Failed to load clients:', err);
    } finally {
      setIsLoadingClients(false);
    }
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: crypto.randomUUID(), description: '', quantity: 1, amount: 0 }
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems(lineItems.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const calculateTotal = () => {
    return lineItems.reduce((sum, item) => sum + (item.amount * item.quantity), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!selectedClientId) {
      setError('Please select a client');
      return;
    }

    const validLineItems = lineItems.filter(item =>
      item.description.trim() && item.amount > 0
    );

    if (validLineItems.length === 0) {
      setError('Please add at least one line item with a description and amount');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/billing/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: selectedClientId,
          title: title || 'Invoice from Cape Cod Restaurant Consulting',
          description,
          due_date: dueDate,
          line_items: validLineItems.map(item => ({
            name: item.description,
            description: item.description,
            quantity: item.quantity,
            amount: item.amount
          })),
          auto_publish: true,
          delivery_method: 'EMAIL'
        })
      });

      const result = await response.json();

      if (result.success) {
        setSuccess({
          number: result.data.number,
          url: result.data.public_url
        });
        onSuccess?.(result.data);
      } else {
        setError(result.error || 'Failed to create invoice');
      }
    } catch (err) {
      console.error('Invoice creation error:', err);
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedClient = clients.find(c => c.id === selectedClientId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full sm:max-w-lg max-h-[90vh] bg-gray-900 rounded-t-2xl sm:rounded-2xl border border-gray-700 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Create Invoice</h2>
              <p className="text-xs text-gray-400">Send via Square</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {success ? (
            // Success State
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Invoice Created!</h3>
              <p className="text-gray-400 mb-4">
                Invoice #{success.number} has been sent to {selectedClient?.email}
              </p>
              {success.url && (
                <a
                  href={success.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  View Invoice
                </a>
              )}
              <button
                onClick={onClose}
                className="block w-full mt-4 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors min-h-[48px]"
              >
                Done
              </button>
            </div>
          ) : (
            // Form
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error Display */}
              {error && (
                <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              )}

              {/* Client Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Client *
                </label>
                {isLoadingClients ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                  </div>
                ) : (
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[48px] text-base"
                    required
                  >
                    <option value="">Select a client...</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.company || client.name} ({client.email})
                      </option>
                    ))}
                  </select>
                )}
                {selectedClient && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-400">
                    <Building2 className="w-4 h-4" />
                    <span>{selectedClient.company || selectedClient.name}</span>
                    <span className="text-gray-600">|</span>
                    <span>{selectedClient.email}</span>
                  </div>
                )}
              </div>

              {/* Invoice Title */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Invoice Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Invoice from Cape Cod Restaurant Consulting"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[48px] text-base"
                />
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Due Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[48px] text-base"
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-300">
                    Line Items *
                  </label>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg transition-colors min-h-[36px]"
                  >
                    <Plus className="w-4 h-4" />
                    Add Item
                  </button>
                </div>

                <div className="space-y-3">
                  {lineItems.map((item, index) => (
                    <div
                      key={item.id}
                      className="p-3 bg-gray-800/50 border border-gray-700 rounded-lg space-y-3"
                    >
                      {/* Description - Full width */}
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                        placeholder="Service description..."
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[48px] text-base"
                      />

                      {/* Quantity and Amount Row */}
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="block text-xs text-gray-400 mb-1">Qty</label>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                            min="1"
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[48px] text-base"
                          />
                        </div>
                        <div className="flex-[2]">
                          <label className="block text-xs text-gray-400 mb-1">Amount ($)</label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="number"
                              value={item.amount || ''}
                              onChange={(e) => updateLineItem(item.id, 'amount', parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              min="0"
                              step="0.01"
                              className="w-full pl-8 pr-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[48px] text-base"
                            />
                          </div>
                        </div>
                        {lineItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLineItem(item.id)}
                            className="self-end p-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all active:scale-95 min-h-[48px] min-w-[48px] flex items-center justify-center"
                            aria-label="Remove line item"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>

                      {/* Line Total */}
                      <div className="text-right text-sm text-gray-400">
                        Subtotal: <span className="text-white font-medium">${(item.amount * item.quantity).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Description/Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Additional notes or payment terms..."
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-base resize-none"
                />
              </div>

              {/* Total */}
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-amber-300 font-medium">Invoice Total</span>
                  <span className="text-2xl font-bold text-white">
                    ${calculateTotal().toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || isLoadingClients}
                className="w-full flex items-center justify-center gap-2 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors min-h-[56px] text-lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating Invoice...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Create & Send Invoice
                  </>
                )}
              </button>

              <p className="text-xs text-gray-500 text-center">
                Invoice will be sent to the client via email through Square
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvoiceModal;
