import React, { useState, useEffect, useRef } from 'react';
import {
  Upload, FileText, Building2, Sparkles, Loader2, CheckCircle,
  AlertCircle, X, File, FileSpreadsheet, FileType, Trash2
} from 'lucide-react';

interface Client {
  id: string;
  name: string;
  company: string;
}

interface AIProvider {
  id: string;
  name: string;
  is_active: boolean;
  is_default: boolean;
}

interface ExtractedFact {
  field: string;
  value: string;
  confidence: number;
  originalText: string;
}

interface UniversalDataImportProps {
  onImportComplete: () => void;
}

const UniversalDataImport: React.FC<UniversalDataImportProps> = ({ onImportComplete }) => {
  const [mode, setMode] = useState<'paste' | 'upload'>('paste');
  const [textInput, setTextInput] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedFacts, setExtractedFacts] = useState<ExtractedFact[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadClientsAndProviders();
  }, []);

  const loadClientsAndProviders = async () => {
    setIsLoading(true);
    try {
      const [clientsRes, providersRes] = await Promise.all([
        fetch('/api/admin/clients'),
        fetch('/api/admin/intelligence/providers')
      ]);

      const clientsData = await clientsRes.json();
      const providersData = await providersRes.json();

      if (clientsData.success) {
        setClients(clientsData.data || []);
      }
      if (providersData.success) {
        setProviders(providersData.providers || []);
        // Set default provider
        const defaultProvider = providersData.providers?.find((p: AIProvider) => p.is_default && p.is_active);
        if (defaultProvider) {
          setSelectedProviderId(defaultProvider.id);
        }
      }
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validExtensions = ['.txt', '.md', '.csv', '.pdf', '.xlsx', '.docx', '.json'];

    const validFiles = files.filter(file => {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      return validExtensions.includes(ext);
    });

    if (validFiles.length !== files.length) {
      setError('Some files were skipped. Supported formats: txt, md, csv, pdf, xlsx, docx, json');
    }

    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'csv':
      case 'xlsx':
        return <FileSpreadsheet className="w-5 h-5 text-green-400" />;
      case 'pdf':
        return <FileType className="w-5 h-5 text-red-400" />;
      default:
        return <FileText className="w-5 h-5 text-blue-400" />;
    }
  };

  const handleExtract = async () => {
    if (!selectedClientId) {
      setError('Please select a client');
      return;
    }

    if (mode === 'paste' && !textInput.trim()) {
      setError('Please enter some text to analyze');
      return;
    }

    if (mode === 'upload' && selectedFiles.length === 0) {
      setError('Please select at least one file');
      return;
    }

    setIsExtracting(true);
    setError(null);
    setExtractedFacts([]);

    try {
      if (mode === 'paste') {
        // Text extraction
        const response = await fetch('/api/admin/intelligence/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: textInput,
            client_id: selectedClientId,
            provider_id: selectedProviderId || undefined
          })
        });

        const result = await response.json();

        if (result.success) {
          setExtractedFacts(result.facts || []);
          if (result.facts?.length === 0) {
            setError('No facts could be extracted from the text');
          }
        } else {
          setError(result.error || 'Extraction failed');
        }
      } else {
        // File upload extraction
        const formData = new FormData();
        selectedFiles.forEach(file => formData.append('files', file));
        formData.append('client_id', selectedClientId);
        if (selectedProviderId) {
          formData.append('provider_id', selectedProviderId);
        }

        const response = await fetch('/api/admin/intelligence/import', {
          method: 'POST',
          body: formData
        });

        const result = await response.json();

        if (result.success) {
          setExtractedFacts(result.facts || []);
          setSuccess(`Imported ${result.facts_extracted || 0} facts from ${selectedFiles.length} file(s)`);
          setSelectedFiles([]);
        } else {
          setError(result.error || 'Import failed');
        }
      }
    } catch (err) {
      setError('Network error during extraction');
      console.error('Extraction error:', err);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSaveFacts = async () => {
    if (extractedFacts.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/intelligence/facts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: selectedClientId,
          facts: extractedFacts.map(f => ({
            field_name: f.field,
            field_value: f.value,
            original_text: f.originalText,
            confidence: f.confidence,
            source: mode === 'paste' ? 'import' : 'import',
            ai_provider_id: selectedProviderId || undefined
          }))
        })
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(`Saved ${result.facts_created || extractedFacts.length} facts for review`);
        setExtractedFacts([]);
        setTextInput('');
        onImportComplete();
      } else {
        setError(result.error || 'Failed to save facts');
      }
    } catch (err) {
      setError('Network error saving facts');
    } finally {
      setIsLoading(false);
    }
  };

  const formatFieldName = (field: string): string => {
    return field
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
      .trim();
  };

  return (
    <div className="space-y-6">
      {/* Mode Toggle */}
      <div className="flex gap-2 bg-gray-800/50 rounded-lg p-1 w-fit">
        <button
          onClick={() => setMode('paste')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
            mode === 'paste'
              ? 'bg-amber-500/20 text-amber-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          Paste Text
        </button>
        <button
          onClick={() => setMode('upload')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
            mode === 'upload'
              ? 'bg-amber-500/20 text-amber-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Upload className="w-4 h-4" />
          Upload Files
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2 text-green-400">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {success}
          <button onClick={() => setSuccess(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Configuration Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Client Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            <Building2 className="w-4 h-4 inline mr-1" />
            Target Client
          </label>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          >
            <option value="">Select a client...</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>
                {client.company || client.name}
              </option>
            ))}
          </select>
        </div>

        {/* AI Provider Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            <Sparkles className="w-4 h-4 inline mr-1" />
            AI Provider
          </label>
          <select
            value={selectedProviderId}
            onChange={(e) => setSelectedProviderId(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          >
            <option value="">Auto-select (default)</option>
            {providers.filter(p => p.is_active).map(provider => (
              <option key={provider.id} value={provider.id}>
                {provider.name} {provider.is_default ? '(Default)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Input Area */}
      {mode === 'paste' ? (
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Paste text containing client information
          </label>
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Paste any text here - emails, notes, website content, etc. The AI will extract relevant client facts automatically."
            className="w-full h-48 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
          />
          <div className="text-sm text-gray-500 mt-1">
            {textInput.length} characters
          </div>
        </div>
      ) : (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.md,.csv,.pdf,.xlsx,.docx,.json"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Drop Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-amber-500/50 transition-colors"
          >
            <Upload className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">
              Click to select files or drag & drop
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Supports: TXT, MD, CSV, PDF, XLSX, DOCX, JSON
            </p>
          </div>

          {/* Selected Files */}
          {selectedFiles.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="text-sm text-gray-400">{selectedFiles.length} file(s) selected</div>
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 bg-gray-800/50 rounded-lg px-4 py-3"
                >
                  {getFileIcon(file.name)}
                  <div className="flex-1 min-w-0">
                    <div className="text-white truncate">{file.name}</div>
                    <div className="text-sm text-gray-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Extract Button */}
      <button
        onClick={handleExtract}
        disabled={isExtracting || !selectedClientId}
        className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
      >
        {isExtracting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Extracting Facts...
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            Extract Facts with AI
          </>
        )}
      </button>

      {/* Extracted Facts Preview */}
      {extractedFacts.length > 0 && (
        <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
          <div className="bg-gray-900/50 px-6 py-4 border-b border-gray-700 flex items-center justify-between">
            <h3 className="font-medium text-white">
              Extracted {extractedFacts.length} Facts
            </h3>
            <button
              onClick={handleSaveFacts}
              disabled={isLoading}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Save for Review
            </button>
          </div>
          <div className="divide-y divide-gray-700 max-h-96 overflow-y-auto">
            {extractedFacts.map((fact, index) => (
              <div key={index} className="px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-amber-400 font-medium">
                      {formatFieldName(fact.field)}
                    </div>
                    <div className="text-white text-lg">{fact.value}</div>
                    {fact.originalText && (
                      <div className="text-sm text-gray-500 mt-1 italic">
                        "{fact.originalText}"
                      </div>
                    )}
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    fact.confidence >= 0.8
                      ? 'text-green-400 bg-green-400/10'
                      : fact.confidence >= 0.6
                      ? 'text-amber-400 bg-amber-400/10'
                      : 'text-red-400 bg-red-400/10'
                  }`}>
                    {Math.round(fact.confidence * 100)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UniversalDataImport;
