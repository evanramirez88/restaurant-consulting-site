import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  FileText,
  Image,
  X,
  CheckCircle2,
  Loader2,
  Download,
  FileJson,
  FileSpreadsheet,
  Eye,
  AlertCircle,
  Utensils,
  DollarSign,
  Tag,
  Layers,
  Zap,
  Save,
  Building2
} from 'lucide-react';
import { useSEO } from '../../src/components/SEO';
import RepLayout from './RepLayout';
import DeployToToastModal from '../../src/components/admin/automation/DeployToToastModal';
import { extractText, getDocumentProxy } from 'unpdf';

// ============================================================
// TYPE DEFINITIONS
// ============================================================
interface RepInfo {
  id: string;
  name: string;
  email: string;
  territory: string | null;
  avatar_url: string | null;
  slug: string;
}

interface ClientInfo {
  id: string;
  name: string;
  company: string;
  email: string;
  can_menu_build: boolean;
}

interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  preview?: string;
}

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: string;
  category: string;
  modifiers: string[];
}

interface ParsedMenu {
  items: MenuItem[];
  categories: string[];
  modifierGroups: string[];
}

interface ExistingMenuJob {
  id: string;
  status: string;
  parsed_menu_json: string | null;
  created_at: number;
  updated_at: number;
}

type OCRStatus = 'idle' | 'uploading' | 'processing' | 'parsing' | 'complete' | 'error' | 'saving';

// ============================================================
// MAIN COMPONENT
// ============================================================
const RepMenuBuilder: React.FC = () => {
  const { slug, clientId } = useParams<{ slug: string; clientId: string }>();
  const navigate = useNavigate();

  useSEO({
    title: 'Menu Builder | Rep Portal | Cape Cod Restaurant Consulting',
    description: 'Build and manage menus for your clients.',
  });

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [rep, setRep] = useState<RepInfo | null>(null);
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [existingMenu, setExistingMenu] = useState<ExistingMenuJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Menu builder state
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [ocrStatus, setOcrStatus] = useState<OCRStatus>('idle');
  const [parsedMenu, setParsedMenu] = useState<ParsedMenu | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actualFiles, setActualFiles] = useState<File[]>([]);
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load rep, client, and existing menu data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Check for demo mode
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
        const isDemoMode = urlParams.get('demo') === 'true' || hashParams.get('demo') === 'true' || slug?.startsWith('demo-');

        // Check if user is authenticated as admin
        let isAdmin = false;
        try {
          const adminResponse = await fetch('/api/auth/verify', { credentials: 'include' });
          const adminData = await adminResponse.json();
          isAdmin = adminData.authenticated === true;
        } catch {
          // Not an admin
        }

        // Verify rep auth if not in demo mode and not admin
        if (!isDemoMode && !isAdmin) {
          const authRes = await fetch(`/api/rep/${slug}/auth/verify`);
          const authData = await authRes.json();

          if (!authData.authenticated) {
            navigate(`/rep/${slug}/login`);
            return;
          }
        }

        // Load rep info
        const repRes = await fetch(`/api/rep/${slug}/info`);
        const repData = await repRes.json();

        if (!repData.success) {
          setError('Failed to load rep information');
          setIsLoading(false);
          return;
        }

        setRep(repData.data);

        // Load client details with permissions
        const clientRes = await fetch(`/api/rep/${slug}/clients/${clientId}`);
        const clientData = await clientRes.json();

        if (!clientData.success) {
          setError(clientData.error || 'Failed to load client');
          setIsLoading(false);
          return;
        }

        setClient(clientData.data);

        // Check menu build permission
        if (!clientData.data.can_menu_build) {
          setError('You do not have permission to use Menu Builder for this client. Contact admin to enable Menu Builder access.');
          setIsLoading(false);
          return;
        }

        // Load existing menu for this client
        try {
          const menuRes = await fetch(`/api/rep/${slug}/clients/${clientId}/menu`);
          const menuData = await menuRes.json();

          if (menuData.success && menuData.data) {
            setExistingMenu(menuData.data);
            // If there's a parsed menu, load it
            if (menuData.data.parsed_menu_json) {
              try {
                const parsed = JSON.parse(menuData.data.parsed_menu_json);
                setParsedMenu(parsed);
                setOcrStatus('complete');
              } catch (e) {
                console.error('Failed to parse existing menu JSON:', e);
              }
            }
          }
        } catch (e) {
          // No existing menu, that's fine
          console.log('No existing menu found');
        }
      } catch (err) {
        console.error('Load error:', err);
        setError('Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [slug, clientId, navigate]);

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setErrorMessage(null);

    const files: File[] = Array.from(e.dataTransfer.files);
    processFiles(files);
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    const files: File[] = e.target.files ? Array.from(e.target.files) : [];
    processFiles(files);
  }, []);

  // Process uploaded files
  const processFiles = (files: File[]) => {
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    const newFiles: UploadedFile[] = [];
    const newActualFiles: File[] = [];

    files.forEach(file => {
      if (validTypes.includes(file.type)) {
        const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const uploadedFile: UploadedFile = {
          id: fileId,
          name: file.name,
          type: file.type,
          size: file.size
        };

        if (file.type.startsWith('image/')) {
          uploadedFile.preview = URL.createObjectURL(file);
        }

        newFiles.push(uploadedFile);
        newActualFiles.push(file);
      }
    });

    if (newFiles.length > 0) {
      setUploadedFiles(prev => [...prev, ...newFiles]);
      setActualFiles(prev => [...prev, ...newActualFiles]);
    } else if (files.length > 0) {
      setErrorMessage('Please upload PDF or image files (JPG, PNG, WebP, HEIC)');
    }
  };

  // Remove file
  const removeFile = (id: string) => {
    const fileIndex = uploadedFiles.findIndex(f => f.id === id);
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
    if (fileIndex !== -1) {
      setActualFiles(prev => prev.filter((_, i) => i !== fileIndex));
    }
    if (selectedFile?.id === id) {
      setSelectedFile(null);
    }
  };

  // Process a PDF file using client-side text extraction
  const processPdfFile = async (file: File): Promise<ParsedMenu | null> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
      const result = await extractText(pdf, { mergePages: true });

      const { totalPages, text: fullText } = result;

      if (!fullText || fullText.trim().length === 0) {
        throw new Error('No text could be extracted from the PDF.');
      }

      const parseResponse = await fetch('/api/menu/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: fullText,
          totalPages,
          fileName: file.name
        })
      });

      const parseResult = await parseResponse.json();

      if (!parseResult.success) {
        throw new Error(parseResult.error || 'Text parsing failed');
      }

      return parseResult.parsedMenu;
    } catch (error) {
      console.error('PDF processing error:', error);
      throw error;
    }
  };

  // Process an image file using server-side OCR
  const processImageFile = async (file: File): Promise<ParsedMenu | null> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', rep?.name || 'Rep');
    formData.append('email', rep?.email || '');
    formData.append('restaurantName', client?.company || '');

    const uploadResponse = await fetch('/api/menu/upload', {
      method: 'POST',
      body: formData
    });

    const uploadResult = await uploadResponse.json();

    if (!uploadResult.success) {
      throw new Error(uploadResult.error || 'Upload failed');
    }

    const jobId = uploadResult.jobId;

    // Trigger OCR processing
    const processResponse = await fetch('/api/menu/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId })
    });

    const processResult = await processResponse.json();

    if (!processResult.success) {
      throw new Error(processResult.error || 'Processing failed');
    }

    if (processResult.parsedMenu) {
      return processResult.parsedMenu;
    }

    // Poll for status if processing is async
    const pollForResult = async (maxAttempts = 30): Promise<ParsedMenu | null> => {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const statusResponse = await fetch(`/api/menu/status?jobId=${jobId}`);
        const statusResult = await statusResponse.json();

        if (statusResult.success) {
          if (statusResult.job.status === 'completed') {
            return statusResult.job.parsedMenu;
          } else if (statusResult.job.status === 'failed') {
            throw new Error(statusResult.job.error || 'Processing failed');
          }
        }
      }
      throw new Error('Processing timed out');
    };

    return pollForResult();
  };

  // Process a single file
  const processFile = async (file: File): Promise<ParsedMenu | null> => {
    if (file.type === 'application/pdf') {
      return processPdfFile(file);
    } else {
      return processImageFile(file);
    }
  };

  // Merge multiple parsed menus into one
  const mergeMenus = (menus: ParsedMenu[]): ParsedMenu => {
    const allItems: MenuItem[] = [];
    const allCategories = new Set<string>();
    const allModifierGroups = new Set<string>();

    menus.forEach((menu, menuIndex) => {
      menu.items.forEach((item, itemIndex) => {
        allItems.push({
          ...item,
          id: `item_${menuIndex + 1}_${itemIndex + 1}`
        });
      });
      menu.categories.forEach(c => allCategories.add(c));
      menu.modifierGroups.forEach(m => allModifierGroups.add(m));
    });

    return {
      items: allItems,
      categories: Array.from(allCategories),
      modifierGroups: Array.from(allModifierGroups)
    };
  };

  // Start processing
  const startProcessing = async () => {
    if (uploadedFiles.length === 0 || actualFiles.length === 0) return;

    setOcrStatus('uploading');
    setErrorMessage(null);

    try {
      const allParsedMenus: ParsedMenu[] = [];

      for (let i = 0; i < actualFiles.length; i++) {
        const file = actualFiles[i];

        if (i === 0) {
          setOcrStatus('uploading');
        }

        setOcrStatus('processing');
        const result = await processFile(file);

        if (result) {
          allParsedMenus.push(result);
        }
      }

      setOcrStatus('parsing');
      await new Promise(resolve => setTimeout(resolve, 500));

      if (allParsedMenus.length > 0) {
        const mergedMenu = allParsedMenus.length === 1
          ? allParsedMenus[0]
          : mergeMenus(allParsedMenus);
        setParsedMenu(mergedMenu);
        setOcrStatus('complete');
      } else {
        throw new Error('No menu data extracted');
      }
    } catch (error) {
      console.error('Processing error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Processing failed');
      setOcrStatus('error');
    }
  };

  // Save menu to client record
  const saveMenuToClient = async () => {
    if (!parsedMenu || !client) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const response = await fetch(`/api/rep/${slug}/clients/${clientId}/menu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parsed_menu_json: JSON.stringify(parsedMenu),
          rep_id: rep?.id
        })
      });

      const result = await response.json();

      if (result.success) {
        setSaveSuccess(true);
        setExistingMenu(result.data);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        throw new Error(result.error || 'Failed to save menu');
      }
    } catch (error) {
      console.error('Save error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save menu');
    } finally {
      setIsSaving(false);
    }
  };

  // Export functions
  const exportAsJSON = () => {
    if (!parsedMenu) return;

    const dataStr = JSON.stringify(parsedMenu, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${client?.company || 'menu'}-export.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportAsCSV = () => {
    if (!parsedMenu) return;

    const headers = ['Name', 'Description', 'Price', 'Category', 'Modifiers'];
    const rows = parsedMenu.items.map(item => [
      item.name,
      item.description,
      item.price,
      item.category,
      item.modifiers.join('; ')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${client?.company || 'menu'}-export-toast.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Get status display info
  const getStatusInfo = () => {
    switch (ocrStatus) {
      case 'uploading':
        return { text: 'Uploading files...', color: 'text-amber-400' };
      case 'processing':
        return { text: 'Running OCR extraction...', color: 'text-amber-400' };
      case 'parsing':
        return { text: 'AI parsing menu structure...', color: 'text-amber-400' };
      case 'saving':
        return { text: 'Saving menu...', color: 'text-amber-400' };
      case 'complete':
        return { text: 'Processing complete!', color: 'text-green-400' };
      case 'error':
        return { text: 'Processing failed', color: 'text-red-400' };
      default:
        return { text: 'Ready to process', color: 'text-gray-400' };
    }
  };

  const statusInfo = getStatusInfo();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-dark to-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-400 animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-dark to-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <Link
            to={`/rep/${slug}/clients/${clientId}`}
            className="inline-flex items-center gap-2 text-green-400 hover:text-green-300"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Client
          </Link>
        </div>
      </div>
    );
  }

  return (
    <RepLayout rep={rep}>
      <div className="space-y-6">
        {/* Back Link */}
        <Link
          to={`/rep/${slug}/clients/${clientId}`}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-green-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {client?.company || 'Client'}
        </Link>

        {/* Header */}
        <div className="admin-card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-500/20 rounded-lg flex items-center justify-center">
                <Utensils className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold text-white">
                  Menu Builder
                </h1>
                <div className="flex items-center gap-2 text-gray-400 mt-1">
                  <Building2 className="w-4 h-4" />
                  <span>{client?.company}</span>
                </div>
              </div>
            </div>

            {existingMenu && (
              <div className="text-sm text-gray-400">
                Last updated: {new Date(existingMenu.updated_at * 1000).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Upload & Preview */}
          <div className="space-y-6">
            {/* Upload Area */}
            <div className="admin-card p-6">
              <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5 text-green-400" />
                Upload Menu
              </h2>

              {/* Drag and Drop Zone */}
              <div
                className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer ${
                  isDragging
                    ? 'border-green-500 bg-green-500/10'
                    : 'border-gray-600 hover:border-green-400 hover:bg-gray-800/50'
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif"
                  onChange={handleFileSelect}
                />

                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center">
                    <Upload className="w-8 h-8 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">
                      Drag and drop your menu files
                    </p>
                    <p className="text-gray-500 text-sm mt-1">
                      or click to browse
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" /> PDF
                    </span>
                    <span className="flex items-center gap-1">
                      <Image className="w-3 h-3" /> JPG, PNG, WebP
                    </span>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {errorMessage}
                </div>
              )}

              {/* Uploaded Files List */}
              {uploadedFiles.length > 0 && (
                <div className="mt-6 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                    Uploaded Files ({uploadedFiles.length})
                  </h3>
                  {uploadedFiles.map(file => (
                    <div
                      key={file.id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
                        selectedFile?.id === file.id
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                      onClick={() => setSelectedFile(file)}
                    >
                      <div className="flex items-center gap-3">
                        {file.type.startsWith('image/') ? (
                          <Image className="w-5 h-5 text-gray-400" />
                        ) : (
                          <FileText className="w-5 h-5 text-gray-400" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-white truncate max-w-[200px]">
                            {file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(file.id); }}
                        className="p-1 hover:bg-gray-700 rounded-full transition-colors"
                      >
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Preview Panel */}
            {selectedFile?.preview && (
              <div className="admin-card p-6">
                <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-green-400" />
                  Preview
                </h2>
                <div className="rounded-lg overflow-hidden border border-gray-700">
                  <img
                    src={selectedFile.preview}
                    alt="Menu preview"
                    className="w-full h-auto max-h-[400px] object-contain bg-gray-800"
                  />
                </div>
              </div>
            )}

            {/* OCR Status & Process Button */}
            <div className="admin-card p-6">
              <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Loader2 className={`w-5 h-5 ${ocrStatus !== 'idle' && ocrStatus !== 'complete' ? 'animate-spin text-green-400' : 'text-gray-400'}`} />
                Processing Status
              </h2>

              {/* Status Indicator */}
              <div className="flex items-center gap-3 mb-6">
                <div className={`w-3 h-3 rounded-full ${
                  ocrStatus === 'complete' ? 'bg-green-400' :
                  ocrStatus === 'error' ? 'bg-red-400' :
                  ocrStatus === 'idle' ? 'bg-gray-500' : 'bg-green-400 animate-pulse'
                }`} />
                <span className={`font-medium ${statusInfo.color}`}>
                  {statusInfo.text}
                </span>
              </div>

              {/* Progress Steps */}
              <div className="space-y-3 mb-6">
                {[
                  { step: 'uploading', label: 'Upload files' },
                  { step: 'processing', label: 'OCR extraction' },
                  { step: 'parsing', label: 'AI parsing' },
                  { step: 'complete', label: 'Complete' }
                ].map((item, idx) => {
                  const steps = ['uploading', 'processing', 'parsing', 'complete'];
                  const currentIdx = steps.indexOf(ocrStatus);
                  const itemIdx = steps.indexOf(item.step);
                  const isActive = ocrStatus === item.step;
                  const isComplete = currentIdx > itemIdx || ocrStatus === 'complete';

                  return (
                    <div key={item.step} className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isComplete ? 'bg-green-500 text-white' :
                        isActive ? 'bg-green-500 text-white' :
                        'bg-gray-700 text-gray-400'
                      }`}>
                        {isComplete ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                      </div>
                      <span className={`text-sm ${
                        isComplete || isActive ? 'text-white font-medium' : 'text-gray-500'
                      }`}>
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Process Button */}
              <button
                onClick={startProcessing}
                disabled={uploadedFiles.length === 0 || (ocrStatus !== 'idle' && ocrStatus !== 'complete' && ocrStatus !== 'error')}
                className={`w-full py-3 px-6 rounded-lg font-semibold transition-all ${
                  uploadedFiles.length === 0 || (ocrStatus !== 'idle' && ocrStatus !== 'complete' && ocrStatus !== 'error')
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-500'
                }`}
              >
                {ocrStatus === 'idle' || ocrStatus === 'complete' || ocrStatus === 'error'
                  ? 'Start Processing'
                  : 'Processing...'
                }
              </button>
            </div>
          </div>

          {/* Right Column - Parsed Results & Export */}
          <div className="space-y-6">
            {/* Parsed Menu Items */}
            <div className="admin-card p-6">
              <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Utensils className="w-5 h-5 text-green-400" />
                Parsed Menu Items
              </h2>

              {!parsedMenu ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Utensils className="w-8 h-8 text-gray-500" />
                  </div>
                  <p className="text-gray-500">
                    Upload and process a menu to see extracted items
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-white">{parsedMenu.items.length}</div>
                      <div className="text-xs text-gray-500 uppercase tracking-wider">Items</div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-white">{parsedMenu.categories.length}</div>
                      <div className="text-xs text-gray-500 uppercase tracking-wider">Categories</div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-white">{parsedMenu.modifierGroups.length}</div>
                      <div className="text-xs text-gray-500 uppercase tracking-wider">Modifiers</div>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-gray-800">
                        <tr className="border-b border-gray-700">
                          <th className="text-left py-2 px-3 font-semibold text-gray-400">Item</th>
                          <th className="text-left py-2 px-3 font-semibold text-gray-400">Category</th>
                          <th className="text-right py-2 px-3 font-semibold text-gray-400">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedMenu.items.map(item => (
                          <tr key={item.id} className="border-b border-gray-700/50 hover:bg-gray-800/50">
                            <td className="py-3 px-3">
                              <div className="font-medium text-white">{item.name}</div>
                              <div className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">
                                {item.description}
                              </div>
                              {item.modifiers.length > 0 && (
                                <div className="flex gap-1 mt-1 flex-wrap">
                                  {item.modifiers.map(mod => (
                                    <span key={mod} className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded-full">
                                      <Tag className="w-2 h-2" />
                                      {mod}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded-lg">
                                <Layers className="w-3 h-3" />
                                {item.category}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <span className="inline-flex items-center gap-1 font-semibold text-green-400">
                                <DollarSign className="w-3 h-3" />
                                {item.price}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Export & Save Options */}
            <div className="admin-card p-6">
              <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Download className="w-5 h-5 text-green-400" />
                Actions
              </h2>

              {/* Save to Client Button */}
              <button
                onClick={saveMenuToClient}
                disabled={!parsedMenu || isSaving}
                className={`w-full flex items-center justify-center gap-2 py-3 px-6 rounded-lg font-semibold transition-all mb-4 ${
                  parsedMenu && !isSaving
                    ? 'bg-green-600 hover:bg-green-500 text-white'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : saveSuccess ? (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Saved!
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Menu to Client
                  </>
                )}
              </button>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <button
                  onClick={exportAsJSON}
                  disabled={!parsedMenu}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                    parsedMenu
                      ? 'border-gray-700 hover:border-green-500 hover:bg-green-500/10 cursor-pointer'
                      : 'border-gray-700 bg-gray-800/50 cursor-not-allowed opacity-50'
                  }`}
                >
                  <FileJson className={`w-8 h-8 ${parsedMenu ? 'text-green-400' : 'text-gray-600'}`} />
                  <span className="font-semibold text-white">Export JSON</span>
                  <span className="text-xs text-gray-500">Full data structure</span>
                </button>

                <button
                  onClick={exportAsCSV}
                  disabled={!parsedMenu}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                    parsedMenu
                      ? 'border-gray-700 hover:border-green-500 hover:bg-green-500/10 cursor-pointer'
                      : 'border-gray-700 bg-gray-800/50 cursor-not-allowed opacity-50'
                  }`}
                >
                  <FileSpreadsheet className={`w-8 h-8 ${parsedMenu ? 'text-blue-400' : 'text-gray-600'}`} />
                  <span className="font-semibold text-white">Export CSV</span>
                  <span className="text-xs text-gray-500">Toast import ready</span>
                </button>
              </div>

              {/* Deploy to Toast Button */}
              <button
                onClick={() => setIsDeployModalOpen(true)}
                disabled={!parsedMenu}
                className={`w-full flex items-center justify-center gap-2 py-3 px-6 rounded-lg font-semibold transition-all ${
                  parsedMenu
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Zap className="w-5 h-5" />
                Deploy to Toast
              </button>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Auto-apply modifier rules and deploy directly to Toast back-office
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Deploy to Toast Modal */}
      {parsedMenu && (
        <DeployToToastModal
          isOpen={isDeployModalOpen}
          onClose={() => setIsDeployModalOpen(false)}
          parsedMenu={parsedMenu}
        />
      )}
    </RepLayout>
  );
};

export default RepMenuBuilder;
