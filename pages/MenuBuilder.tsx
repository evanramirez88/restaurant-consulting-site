import React, { useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
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
  Layers
} from 'lucide-react';
import { useSEO } from '../src/components/SEO';

// ============================================================
// FEATURE FLAG - Set to false to reveal the full tool
// ============================================================
const SHOW_COMING_SOON = true;

// Acuity Scheduling URL
const ACUITY_URL = 'https://app.acuityscheduling.com/schedule.php?owner=34242148';

// ============================================================
// TYPE DEFINITIONS
// ============================================================
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

type OCRStatus = 'idle' | 'uploading' | 'processing' | 'parsing' | 'complete' | 'error';

// ============================================================
// COMING SOON COMPONENT
// ============================================================
const ComingSoonOverlay: React.FC = () => {
  return (
    <div className="bg-primary-dark min-h-screen flex items-center justify-center relative hero-grain">
      {/* Full page centered content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center relative z-10">

        {/* Animated Preview Mockup */}
        <div className="hero-fade-in mb-12">
          <div className="menu-preview-container">
            {/* Floating animated mockup showing menu parsing */}
            <div className="menu-preview-mockup">
              {/* Left side - "document" being scanned */}
              <div className="menu-document">
                <div className="doc-line doc-line-1"></div>
                <div className="doc-line doc-line-2"></div>
                <div className="doc-line doc-line-3"></div>
                <div className="doc-line doc-line-4"></div>
                <div className="doc-line doc-line-5"></div>
                {/* Scanning animation */}
                <div className="scan-line"></div>
              </div>

              {/* Arrow showing transformation */}
              <div className="transform-arrow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>

              {/* Right side - parsed menu items */}
              <div className="parsed-items">
                <div className="parsed-item parsed-item-1">
                  <div className="item-icon"></div>
                  <div className="item-details">
                    <div className="item-name"></div>
                    <div className="item-price"></div>
                  </div>
                </div>
                <div className="parsed-item parsed-item-2">
                  <div className="item-icon"></div>
                  <div className="item-details">
                    <div className="item-name"></div>
                    <div className="item-price"></div>
                  </div>
                </div>
                <div className="parsed-item parsed-item-3">
                  <div className="item-icon"></div>
                  <div className="item-details">
                    <div className="item-name"></div>
                    <div className="item-price"></div>
                  </div>
                </div>
              </div>

              {/* Status indicator */}
              <div className="preview-status-badge">
                <div className="status-dot"></div>
                <span>Processing</span>
              </div>
            </div>
          </div>
        </div>

        {/* Headline */}
        <h1 className="hero-fade-in hero-fade-in-delay-1 font-display text-5xl md:text-6xl font-bold text-amber-400 mb-4">
          Menu Builder
        </h1>

        {/* Subheadline */}
        <div className="hero-fade-in hero-fade-in-delay-1 mb-10">
          <p className="text-2xl md:text-3xl text-white font-display mb-3">
            AI-Powered Menu Migration
          </p>
          <div className="brass-underline mx-auto"></div>
        </div>

        {/* Body Copy */}
        <div className="hero-fade-in hero-fade-in-delay-2 mb-12 max-w-2xl mx-auto">
          <p className="text-lg text-gray-300 leading-relaxed mb-6">
            Transform your existing menus into Toast-ready configurations in minutes.
            Upload PDFs, photos, or scanned documents and let our AI extract every item,
            modifier, and price automatically.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-gray-400 mt-8">
            <div className="flex items-center justify-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              <span>PDF &amp; Image Support</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>Smart Categorization</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Download className="w-4 h-4 text-amber-400" />
              <span>Toast-Ready Export</span>
            </div>
          </div>
        </div>

        {/* CTAs */}
        <div className="hero-fade-in hero-fade-in-delay-3 flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <a
            href={ACUITY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg font-semibold transition-all glow-pulse shadow-lg btn-hover"
            style={{ backgroundColor: '#ea580c', color: '#ffffff' }}
          >
            <Calendar size={20} />
            Schedule a Menu Consultation
          </a>
          <Link
            to="/contact"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg font-semibold transition-all btn-hover cta-secondary-dark"
          >
            Get Notified at Launch
          </Link>
        </div>

        {/* Back to Home Link */}
        <div className="hero-fade-in hero-fade-in-delay-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
            Back to Home
          </Link>
        </div>
      </div>

      {/* Inline styles for the preview mockup */}
      <style>{`
        .menu-preview-container {
          display: flex;
          justify-content: center;
          perspective: 1000px;
        }

        .menu-preview-mockup {
          position: relative;
          width: 360px;
          height: 200px;
          background: linear-gradient(135deg, #1e293b, #0f172a);
          border: 1px solid #374151;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
          animation: menu-float 6s ease-in-out infinite;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 20px;
        }

        @keyframes menu-float {
          0%, 100% {
            transform: translateY(0) rotateX(5deg) rotateY(-3deg);
          }
          50% {
            transform: translateY(-12px) rotateX(5deg) rotateY(-3deg);
          }
        }

        .menu-document {
          width: 80px;
          height: 110px;
          background: #f8fafc;
          border-radius: 4px;
          padding: 10px;
          position: relative;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .doc-line {
          height: 6px;
          background: #e5e7eb;
          border-radius: 2px;
          margin-bottom: 6px;
        }

        .doc-line-1 { width: 100%; }
        .doc-line-2 { width: 80%; }
        .doc-line-3 { width: 90%; }
        .doc-line-4 { width: 70%; }
        .doc-line-5 { width: 85%; }

        .scan-line {
          position: absolute;
          left: 0;
          width: 100%;
          height: 2px;
          background: linear-gradient(90deg, transparent, #f59e0b, transparent);
          animation: scan 2s ease-in-out infinite;
        }

        @keyframes scan {
          0%, 100% {
            top: 10px;
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            top: calc(100% - 10px);
            opacity: 0;
          }
        }

        .transform-arrow {
          width: 32px;
          height: 32px;
          color: #f59e0b;
          animation: arrow-pulse 2s ease-in-out infinite;
        }

        @keyframes arrow-pulse {
          0%, 100% {
            transform: translateX(0);
            opacity: 0.5;
          }
          50% {
            transform: translateX(4px);
            opacity: 1;
          }
        }

        .parsed-items {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .parsed-item {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-radius: 6px;
          padding: 8px 12px;
          animation: item-appear 2s ease-in-out infinite;
        }

        .parsed-item-1 { animation-delay: 0.3s; }
        .parsed-item-2 { animation-delay: 0.6s; }
        .parsed-item-3 { animation-delay: 0.9s; }

        @keyframes item-appear {
          0%, 30% {
            opacity: 0.3;
            transform: translateX(-5px);
          }
          50%, 80% {
            opacity: 1;
            transform: translateX(0);
          }
          100% {
            opacity: 0.3;
            transform: translateX(-5px);
          }
        }

        .item-icon {
          width: 20px;
          height: 20px;
          background: linear-gradient(135deg, #ea580c, #f59e0b);
          border-radius: 4px;
        }

        .item-details {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .item-name {
          width: 60px;
          height: 6px;
          background: #9ca3af;
          border-radius: 2px;
        }

        .item-price {
          width: 30px;
          height: 5px;
          background: #f59e0b;
          border-radius: 2px;
        }

        .preview-status-badge {
          position: absolute;
          bottom: 10px;
          right: 10px;
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(0, 0, 0, 0.6);
          border: 1px solid #374151;
          border-radius: 20px;
          padding: 4px 10px;
          font-size: 10px;
          color: #9ca3af;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          background: #f59e0b;
          border-radius: 50%;
          animation: dot-pulse 1s ease-in-out infinite;
        }

        @keyframes dot-pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.4;
          }
        }

        @media (min-width: 640px) {
          .menu-preview-mockup {
            width: 440px;
            height: 220px;
            gap: 24px;
          }

          .menu-document {
            width: 100px;
            height: 130px;
          }

          .parsed-item {
            padding: 10px 14px;
          }

          .item-name {
            width: 80px;
          }
        }
      `}</style>
    </div>
  );
};

// ============================================================
// MENU BUILDER TOOL COMPONENT (Hidden behind Coming Soon)
// ============================================================
const MenuBuilderTool: React.FC = () => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [ocrStatus, setOcrStatus] = useState<OCRStatus>('idle');
  const [parsedMenu, setParsedMenu] = useState<ParsedMenu | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate mock parsed data (simulated)
  const generateMockParsedData = (): ParsedMenu => {
    return {
      categories: ['Appetizers', 'Entrees', 'Desserts', 'Beverages'],
      modifierGroups: ['Protein Add-Ons', 'Sauce Options', 'Side Choices', 'Temperature'],
      items: [
        {
          id: '1',
          name: 'Crispy Calamari',
          description: 'Lightly breaded and fried, served with marinara',
          price: '14.99',
          category: 'Appetizers',
          modifiers: ['Sauce Options']
        },
        {
          id: '2',
          name: 'Grilled Salmon',
          description: 'Atlantic salmon with lemon herb butter',
          price: '28.99',
          category: 'Entrees',
          modifiers: ['Side Choices', 'Temperature']
        },
        {
          id: '3',
          name: 'Caesar Salad',
          description: 'Romaine, parmesan, croutons, house caesar',
          price: '12.99',
          category: 'Appetizers',
          modifiers: ['Protein Add-Ons']
        },
        {
          id: '4',
          name: 'NY Strip Steak',
          description: '12oz prime cut with compound butter',
          price: '42.99',
          category: 'Entrees',
          modifiers: ['Side Choices', 'Temperature']
        },
        {
          id: '5',
          name: 'Tiramisu',
          description: 'Classic Italian coffee-soaked dessert',
          price: '9.99',
          category: 'Desserts',
          modifiers: []
        },
        {
          id: '6',
          name: 'Craft Lemonade',
          description: 'House-made with fresh lemons',
          price: '4.99',
          category: 'Beverages',
          modifiers: []
        }
      ]
    };
  };

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
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    const newFiles: UploadedFile[] = [];

    files.forEach(file => {
      if (validTypes.includes(file.type)) {
        const uploadedFile: UploadedFile = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          type: file.type,
          size: file.size
        };

        // Create preview for images
        if (file.type.startsWith('image/')) {
          uploadedFile.preview = URL.createObjectURL(file);
        }

        newFiles.push(uploadedFile);
      }
    });

    if (newFiles.length > 0) {
      setUploadedFiles(prev => [...prev, ...newFiles]);
    } else if (files.length > 0) {
      setErrorMessage('Please upload PDF or image files (JPG, PNG, WebP)');
    }
  };

  // Remove file
  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
    if (selectedFile?.id === id) {
      setSelectedFile(null);
    }
  };

  // Simulate OCR processing
  const startProcessing = () => {
    if (uploadedFiles.length === 0) return;

    setOcrStatus('uploading');
    setErrorMessage(null);

    // Simulate upload delay
    setTimeout(() => {
      setOcrStatus('processing');

      // Simulate OCR processing delay
      setTimeout(() => {
        setOcrStatus('parsing');

        // Simulate AI parsing delay
        setTimeout(() => {
          setParsedMenu(generateMockParsedData());
          setOcrStatus('complete');
        }, 2000);
      }, 2500);
    }, 1500);
  };

  // Export functions
  const exportAsJSON = () => {
    if (!parsedMenu) return;

    const dataStr = JSON.stringify(parsedMenu, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'menu-export.json';
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
    link.download = 'menu-export-toast.csv';
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
      case 'complete':
        return { text: 'Processing complete!', color: 'text-green-400' };
      case 'error':
        return { text: 'Processing failed', color: 'text-red-400' };
      default:
        return { text: 'Ready to process', color: 'text-gray-400' };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="bg-white min-h-screen pb-20">
      {/* Header */}
      <div className="bg-primary-dark py-16 pt-8 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center animate-on-scroll">
          <h1 className="font-display text-4xl font-bold text-white mb-4">Menu Builder</h1>
          <div className="brass-line-draw short mb-6" />
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Upload your existing menu and let AI extract items, prices, and modifiers into Toast-ready format.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Left Column - Upload & Preview */}
          <div className="space-y-6">
            {/* Upload Area */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 border-l-4 border-l-amber-500 overflow-hidden animate-on-scroll">
              <div className="p-6">
                <h2 className="font-display text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-amber-500" />
                  Upload Menu
                </h2>

                {/* Drag and Drop Zone */}
                <div
                  className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer ${
                    isDragging
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-gray-300 hover:border-amber-400 hover:bg-gray-50'
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
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={handleFileSelect}
                  />

                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                      <Upload className="w-8 h-8 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-gray-700 font-medium">
                        Drag and drop your menu files
                      </p>
                      <p className="text-gray-500 text-sm mt-1">
                        or click to browse
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400 mt-2">
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
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {errorMessage}
                  </div>
                )}

                {/* Uploaded Files List */}
                {uploadedFiles.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                      Uploaded Files ({uploadedFiles.length})
                    </h3>
                    {uploadedFiles.map(file => (
                      <div
                        key={file.id}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
                          selectedFile?.id === file.id
                            ? 'border-amber-500 bg-amber-50'
                            : 'border-gray-200 hover:border-gray-300'
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
                            <p className="text-sm font-medium text-gray-700 truncate max-w-[200px]">
                              {file.name}
                            </p>
                            <p className="text-xs text-gray-400">
                              {(file.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeFile(file.id); }}
                          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                        >
                          <X className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Preview Panel */}
            {selectedFile?.preview && (
              <div className="bg-white rounded-xl shadow-md border border-gray-200 border-l-4 border-l-amber-500 overflow-hidden animate-on-scroll">
                <div className="p-6">
                  <h2 className="font-display text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Eye className="w-5 h-5 text-amber-500" />
                    Preview
                  </h2>
                  <div className="rounded-lg overflow-hidden border border-gray-200">
                    <img
                      src={selectedFile.preview}
                      alt="Menu preview"
                      className="w-full h-auto max-h-[400px] object-contain bg-gray-50"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* OCR Status & Process Button */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 border-l-4 border-l-amber-500 overflow-hidden animate-on-scroll">
              <div className="p-6">
                <h2 className="font-display text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Loader2 className={`w-5 h-5 ${ocrStatus !== 'idle' && ocrStatus !== 'complete' ? 'animate-spin text-amber-500' : 'text-gray-400'}`} />
                  Processing Status
                </h2>

                {/* Status Indicator */}
                <div className="flex items-center gap-3 mb-6">
                  <div className={`w-3 h-3 rounded-full ${
                    ocrStatus === 'complete' ? 'bg-green-400' :
                    ocrStatus === 'error' ? 'bg-red-400' :
                    ocrStatus === 'idle' ? 'bg-gray-300' : 'bg-amber-400 animate-pulse'
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
                          isActive ? 'bg-amber-500 text-white' :
                          'bg-gray-200 text-gray-400'
                        }`}>
                          {isComplete ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                        </div>
                        <span className={`text-sm ${
                          isComplete || isActive ? 'text-gray-700 font-medium' : 'text-gray-400'
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
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-orange-600 text-white hover:bg-orange-700 glow-pulse shadow-lg'
                  }`}
                >
                  {ocrStatus === 'idle' || ocrStatus === 'complete' || ocrStatus === 'error'
                    ? 'Start Processing'
                    : 'Processing...'
                  }
                </button>
              </div>
            </div>
          </div>

          {/* Right Column - Parsed Results & Export */}
          <div className="space-y-6">
            {/* Parsed Menu Items */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 border-l-4 border-l-amber-500 overflow-hidden animate-on-scroll">
              <div className="p-6">
                <h2 className="font-display text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Utensils className="w-5 h-5 text-amber-500" />
                  Parsed Menu Items
                </h2>

                {!parsedMenu ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Utensils className="w-8 h-8 text-gray-300" />
                    </div>
                    <p className="text-gray-500">
                      Upload and process a menu to see extracted items
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-3 gap-3 mb-6">
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-gray-900">{parsedMenu.items.length}</div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider">Items</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-gray-900">{parsedMenu.categories.length}</div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider">Categories</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-gray-900">{parsedMenu.modifierGroups.length}</div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider">Modifier Groups</div>
                      </div>
                    </div>

                    {/* Items Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2 px-3 font-semibold text-gray-600">Item</th>
                            <th className="text-left py-2 px-3 font-semibold text-gray-600">Category</th>
                            <th className="text-right py-2 px-3 font-semibold text-gray-600">Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedMenu.items.map(item => (
                            <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-3 px-3">
                                <div className="font-medium text-gray-900">{item.name}</div>
                                <div className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">
                                  {item.description}
                                </div>
                                {item.modifiers.length > 0 && (
                                  <div className="flex gap-1 mt-1">
                                    {item.modifiers.map(mod => (
                                      <span key={mod} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                                        <Tag className="w-2 h-2" />
                                        {mod}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3">
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg">
                                  <Layers className="w-3 h-3" />
                                  {item.category}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right">
                                <span className="inline-flex items-center gap-1 font-semibold text-gray-900">
                                  <DollarSign className="w-3 h-3 text-green-600" />
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
            </div>

            {/* Export Options */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 border-l-4 border-l-amber-500 overflow-hidden animate-on-scroll">
              <div className="p-6">
                <h2 className="font-display text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Download className="w-5 h-5 text-amber-500" />
                  Export Options
                </h2>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={exportAsJSON}
                    disabled={!parsedMenu}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                      parsedMenu
                        ? 'border-gray-200 hover:border-amber-400 hover:bg-amber-50 cursor-pointer'
                        : 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-50'
                    }`}
                  >
                    <FileJson className={`w-8 h-8 ${parsedMenu ? 'text-amber-500' : 'text-gray-300'}`} />
                    <span className="font-semibold text-gray-700">Export JSON</span>
                    <span className="text-xs text-gray-500">Full data structure</span>
                  </button>

                  <button
                    onClick={exportAsCSV}
                    disabled={!parsedMenu}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                      parsedMenu
                        ? 'border-gray-200 hover:border-amber-400 hover:bg-amber-50 cursor-pointer'
                        : 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-50'
                    }`}
                  >
                    <FileSpreadsheet className={`w-8 h-8 ${parsedMenu ? 'text-green-500' : 'text-gray-300'}`} />
                    <span className="font-semibold text-gray-700">Export CSV</span>
                    <span className="text-xs text-gray-500">Toast import ready</span>
                  </button>
                </div>

                {parsedMenu && (
                  <p className="text-xs text-gray-500 mt-4 text-center">
                    CSV export is formatted for direct Toast POS import
                  </p>
                )}
              </div>
            </div>

            {/* Help Card */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 animate-on-scroll">
              <h3 className="font-semibold text-gray-900 mb-3">Need Help?</h3>
              <p className="text-sm text-gray-600 mb-4">
                Menu migration can be complex. We're here to help with modifier groups,
                pricing tiers, and Toast configuration.
              </p>
              <Link
                to="/schedule"
                className="inline-flex items-center gap-2 text-amber-600 hover:text-amber-700 font-semibold text-sm transition-colors"
              >
                <Calendar className="w-4 h-4" />
                Schedule a Free Consultation
              </Link>
            </div>
          </div>
        </div>

        {/* Back to Home */}
        <div className="mt-12 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft size={18} />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// MAIN COMPONENT
// ============================================================
const MenuBuilder: React.FC = () => {
  useSEO({
    title: 'Menu Builder (Coming Soon) | Cape Cod Consulting',
    description: 'AI-powered menu migration tool for Toast POS. Convert your existing menu data from any POS system into Toast-ready format. Coming soon!',
    canonical: 'https://ccrestaurantconsulting.com/#/menu-builder',
  });

  // Show Coming Soon overlay or the actual tool based on feature flag
  if (SHOW_COMING_SOON) {
    return <ComingSoonOverlay />;
  }

  return <MenuBuilderTool />;
};

export default MenuBuilder;
