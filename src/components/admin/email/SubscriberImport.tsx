import React, { useState, useCallback, useRef } from 'react';
import {
  Upload, X, FileSpreadsheet, AlertCircle, Check, Loader2,
  ChevronDown, ChevronUp, RefreshCw, Tag, Trash2, Eye
} from 'lucide-react';

interface SubscriberImportProps {
  onClose: () => void;
  onImportComplete: () => void;
  availableTags: string[];
}

interface CSVRow {
  [key: string]: string;
}

interface ColumnMapping {
  email: string;
  first_name: string;
  last_name: string;
  company: string;
  phone: string;
  pos_system: string;
}

interface ValidationError {
  row: number;
  field: string;
  value: string;
  error: string;
}

interface ImportHistory {
  id: string;
  filename: string;
  total_rows: number;
  imported: number;
  errors: number;
  created_at: number;
}

const defaultColumnMapping: ColumnMapping = {
  email: '',
  first_name: '',
  last_name: '',
  company: '',
  phone: '',
  pos_system: ''
};

const SubscriberImport: React.FC<SubscriberImportProps> = ({
  onClose,
  onImportComplete,
  availableTags
}) => {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing' | 'complete'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>(defaultColumnMapping);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ imported: number; errors: number } | null>(null);
  const [importHistory, setImportHistory] = useState<ImportHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse CSV manually (simple implementation - handles most cases)
  const parseCSV = (text: string): { headers: string[]; data: CSVRow[] } => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return { headers: [], data: [] };

    // Parse header
    const headers = parseCSVLine(lines[0]);

    // Parse data rows
    const data: CSVRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row: CSVRow = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      data.push(row);
    }

    return { headers, data };
  };

  // Parse a single CSV line handling quotes
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());

    return result;
  };

  // Auto-detect column mappings
  const autoDetectMappings = (headers: string[]): ColumnMapping => {
    const mapping = { ...defaultColumnMapping };
    const lowerHeaders = headers.map(h => h.toLowerCase().replace(/[_\s-]/g, ''));

    headers.forEach((header, index) => {
      const lower = lowerHeaders[index];

      if (lower.includes('email') && !mapping.email) {
        mapping.email = header;
      } else if ((lower.includes('firstname') || lower === 'first' || lower === 'fname') && !mapping.first_name) {
        mapping.first_name = header;
      } else if ((lower.includes('lastname') || lower === 'last' || lower === 'lname') && !mapping.last_name) {
        mapping.last_name = header;
      } else if ((lower.includes('company') || lower.includes('business') || lower.includes('restaurant')) && !mapping.company) {
        mapping.company = header;
      } else if ((lower.includes('phone') || lower.includes('tel') || lower.includes('mobile')) && !mapping.phone) {
        mapping.phone = header;
      } else if ((lower.includes('pos') || lower.includes('system') || lower.includes('platform')) && !mapping.pos_system) {
        mapping.pos_system = header;
      }
    });

    return mapping;
  };

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'text/csv') {
      processFile(droppedFile);
    } else {
      setError('Please upload a CSV file');
    }
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv')) {
        processFile(selectedFile);
      } else {
        setError('Please upload a CSV file');
      }
    }
  }, []);

  // Process the uploaded file
  const processFile = async (file: File) => {
    setFile(file);

    try {
      const text = await file.text();
      const { headers, data } = parseCSV(text);

      if (headers.length === 0) {
        setError('Could not parse CSV file - no headers found');
        return;
      }

      setCsvHeaders(headers);
      setCsvData(data);

      // Auto-detect column mappings
      const detectedMapping = autoDetectMappings(headers);
      setColumnMapping(detectedMapping);

      setStep('mapping');
    } catch (err) {
      setError('Failed to parse CSV file');
    }
  };

  // Validate email format
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Validate data before import
  const validateData = (): ValidationError[] => {
    const errors: ValidationError[] = [];

    if (!columnMapping.email) {
      errors.push({
        row: 0,
        field: 'email',
        value: '',
        error: 'Email column is required'
      });
      return errors;
    }

    csvData.forEach((row, index) => {
      const email = row[columnMapping.email];

      if (!email || !email.trim()) {
        errors.push({
          row: index + 2, // +2 for 1-indexed + header row
          field: 'email',
          value: email || '(empty)',
          error: 'Email is required'
        });
      } else if (!isValidEmail(email.trim())) {
        errors.push({
          row: index + 2,
          field: 'email',
          value: email,
          error: 'Invalid email format'
        });
      }
    });

    return errors;
  };

  // Proceed to preview step
  const handleContinueToPreview = () => {
    const errors = validateData();
    setValidationErrors(errors);
    setStep('preview');
  };

  // Add tag to selection
  const addTag = (tag: string) => {
    if (tag && !selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
    }
    setNewTag('');
  };

  // Remove tag from selection
  const removeTag = (tag: string) => {
    setSelectedTags(selectedTags.filter(t => t !== tag));
  };

  // Perform the import
  const handleImport = async () => {
    if (!columnMapping.email) {
      setError('Email column mapping is required');
      return;
    }

    setIsImporting(true);
    setStep('importing');
    setImportProgress(0);

    try {
      // Prepare data for import
      const subscribers = csvData
        .filter((row, index) => {
          // Skip rows with validation errors
          const email = row[columnMapping.email];
          return email && email.trim() && isValidEmail(email.trim());
        })
        .map(row => ({
          email: row[columnMapping.email]?.trim().toLowerCase(),
          first_name: columnMapping.first_name ? row[columnMapping.first_name]?.trim() || null : null,
          last_name: columnMapping.last_name ? row[columnMapping.last_name]?.trim() || null : null,
          company: columnMapping.company ? row[columnMapping.company]?.trim() || null : null,
          phone: columnMapping.phone ? row[columnMapping.phone]?.trim() || null : null,
          pos_system: columnMapping.pos_system ? row[columnMapping.pos_system]?.trim() || null : null,
          tags: selectedTags
        }));

      // Import in batches
      const batchSize = 500;
      let imported = 0;
      let errors = 0;

      for (let i = 0; i < subscribers.length; i += batchSize) {
        const batch = subscribers.slice(i, i + batchSize);

        const response = await fetch('/api/admin/email/subscribers/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscribers: batch,
            filename: file?.name || 'import.csv'
          })
        });

        const result = await response.json();

        if (result.success) {
          imported += result.imported || batch.length;
          errors += result.errors || 0;
        } else {
          errors += batch.length;
        }

        setImportProgress(Math.round(((i + batch.length) / subscribers.length) * 100));
      }

      setImportResult({ imported, errors });
      setStep('complete');
    } catch (err) {
      setError('Import failed. Please try again.');
      setStep('preview');
    } finally {
      setIsImporting(false);
    }
  };

  // Reset and start over
  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setCsvHeaders([]);
    setCsvData([]);
    setColumnMapping(defaultColumnMapping);
    setValidationErrors([]);
    setSelectedTags([]);
    setImportResult(null);
    setError(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="admin-card w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6 text-amber-400" />
            <h2 className="text-xl font-semibold text-white">Import Subscribers</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Error Display */}
          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
              <button
                onClick={() => setError(null)}
                className="ml-auto p-1 text-red-400 hover:text-red-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-gray-600 hover:border-gray-500 hover:bg-gray-800/50'
                }`}
              >
                <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-amber-400' : 'text-gray-500'}`} />
                <p className="text-white font-medium mb-2">
                  Drop your CSV file here or click to browse
                </p>
                <p className="text-gray-400 text-sm">
                  Supports CSV files with email, name, company, phone, and POS system columns
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              <div className="bg-gray-800/50 rounded-lg p-4">
                <h4 className="text-white font-medium mb-2">CSV Format Tips</h4>
                <ul className="text-gray-400 text-sm space-y-1">
                  <li>- First row should contain column headers</li>
                  <li>- Email column is required</li>
                  <li>- Common column names will be auto-detected</li>
                  <li>- Duplicate emails will be skipped</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step 2: Column Mapping */}
          {step === 'mapping' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-medium">Map CSV Columns</h3>
                  <p className="text-gray-400 text-sm">
                    {file?.name} - {csvData.length.toLocaleString()} rows detected
                  </p>
                </div>
                <button
                  onClick={handleReset}
                  className="text-sm text-amber-400 hover:text-amber-300"
                >
                  Upload different file
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.entries(columnMapping).map(([field, value]) => (
                  <div key={field}>
                    <label className="block text-sm text-gray-400 mb-1 capitalize">
                      {field.replace('_', ' ')}
                      {field === 'email' && <span className="text-red-400 ml-1">*</span>}
                    </label>
                    <select
                      value={value}
                      onChange={(e) => setColumnMapping({ ...columnMapping, [field]: e.target.value })}
                      className={`w-full px-3 py-2 bg-gray-900 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                        field === 'email' && !value ? 'border-red-500' : 'border-gray-600'
                      }`}
                    >
                      <option value="">-- Select column --</option>
                      {csvHeaders.map(header => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Tag Assignment */}
              <div className="pt-4 border-t border-gray-700">
                <label className="block text-sm text-gray-400 mb-2">
                  <Tag className="w-4 h-4 inline mr-1" />
                  Apply tags to imported subscribers
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedTags.map(tag => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-400 text-sm rounded"
                    >
                      {tag}
                      <button onClick={() => removeTag(tag)} className="hover:text-amber-300">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add tag..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTag(newTag)}
                    className="flex-1 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    onClick={() => addTag(newTag)}
                    disabled={!newTag.trim()}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-lg transition-colors"
                  >
                    Add
                  </button>
                </div>
                {availableTags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {availableTags.slice(0, 8).map(tag => (
                      <button
                        key={tag}
                        onClick={() => addTag(tag)}
                        disabled={selectedTags.includes(tag)}
                        className="px-2 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 rounded"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-medium">Preview Import</h3>
                  <p className="text-gray-400 text-sm">
                    {csvData.length - validationErrors.length} valid rows ready to import
                  </p>
                </div>
                <button
                  onClick={() => setStep('mapping')}
                  className="text-sm text-amber-400 hover:text-amber-300"
                >
                  Back to mapping
                </button>
              </div>

              {/* Validation Errors */}
              {validationErrors.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-400 mb-3">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-medium">{validationErrors.length} row(s) have errors and will be skipped</span>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {validationErrors.slice(0, 10).map((err, i) => (
                      <p key={i} className="text-sm text-red-300">
                        Row {err.row}: {err.error} ({err.value})
                      </p>
                    ))}
                    {validationErrors.length > 10 && (
                      <p className="text-sm text-red-300">
                        ... and {validationErrors.length - 10} more errors
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Preview Table */}
              <div className="border border-gray-700 rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-800/50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs text-gray-400 uppercase">Email</th>
                        <th className="px-3 py-2 text-left text-xs text-gray-400 uppercase">Name</th>
                        <th className="px-3 py-2 text-left text-xs text-gray-400 uppercase">Company</th>
                        <th className="px-3 py-2 text-left text-xs text-gray-400 uppercase">POS System</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/50">
                      {csvData.slice(0, 10).map((row, i) => {
                        const hasError = validationErrors.some(e => e.row === i + 2);
                        return (
                          <tr key={i} className={hasError ? 'bg-red-500/10' : ''}>
                            <td className="px-3 py-2 text-white">
                              {columnMapping.email ? row[columnMapping.email] : '-'}
                            </td>
                            <td className="px-3 py-2 text-gray-300">
                              {columnMapping.first_name || columnMapping.last_name
                                ? `${row[columnMapping.first_name] || ''} ${row[columnMapping.last_name] || ''}`.trim() || '-'
                                : '-'}
                            </td>
                            <td className="px-3 py-2 text-gray-300">
                              {columnMapping.company ? row[columnMapping.company] || '-' : '-'}
                            </td>
                            <td className="px-3 py-2 text-gray-300">
                              {columnMapping.pos_system ? row[columnMapping.pos_system] || '-' : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {csvData.length > 10 && (
                  <div className="px-3 py-2 bg-gray-800/50 text-gray-400 text-sm text-center border-t border-gray-700">
                    Showing 10 of {csvData.length} rows
                  </div>
                )}
              </div>

              {/* Tags Summary */}
              {selectedTags.length > 0 && (
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <p className="text-gray-400 text-sm mb-2">Tags to apply:</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTags.map(tag => (
                      <span key={tag} className="px-2 py-1 bg-amber-500/20 text-amber-400 text-sm rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Importing */}
          {step === 'importing' && (
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 text-amber-400 animate-spin mx-auto mb-4" />
              <h3 className="text-white font-medium mb-2">Importing Subscribers...</h3>
              <p className="text-gray-400 text-sm mb-4">Please don't close this window</p>
              <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-amber-500 h-full transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
              <p className="text-gray-400 text-sm mt-2">{importProgress}% complete</p>
            </div>
          )}

          {/* Step 5: Complete */}
          {step === 'complete' && importResult && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-white font-medium text-xl mb-2">Import Complete</h3>
              <div className="flex items-center justify-center gap-6 mb-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-400">{importResult.imported}</p>
                  <p className="text-gray-400 text-sm">Imported</p>
                </div>
                {importResult.errors > 0 && (
                  <div className="text-center">
                    <p className="text-3xl font-bold text-red-400">{importResult.errors}</p>
                    <p className="text-gray-400 text-sm">Skipped</p>
                  </div>
                )}
              </div>
              <p className="text-gray-400 text-sm mb-6">
                {importResult.errors > 0
                  ? 'Some records were skipped due to duplicate emails or validation errors.'
                  : 'All records were imported successfully.'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-700 bg-gray-800/30">
          {step === 'upload' && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white"
            >
              Cancel
            </button>
          )}

          {step === 'mapping' && (
            <>
              <button
                onClick={handleReset}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                Back
              </button>
              <button
                onClick={handleContinueToPreview}
                disabled={!columnMapping.email}
                className="px-6 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 disabled:text-gray-400 text-white font-medium rounded-lg transition-colors"
              >
                Continue
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                onClick={() => setStep('mapping')}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={csvData.length - validationErrors.length === 0}
                className="px-6 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 disabled:text-gray-400 text-white font-medium rounded-lg transition-colors"
              >
                Import {csvData.length - validationErrors.length} Subscribers
              </button>
            </>
          )}

          {step === 'complete' && (
            <>
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white"
              >
                <RefreshCw className="w-4 h-4" />
                Import More
              </button>
              <button
                onClick={onImportComplete}
                className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubscriberImport;
