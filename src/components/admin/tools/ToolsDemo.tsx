import React, { useState } from 'react';
import {
  Calculator, UtensilsCrossed, Building2, Briefcase, ExternalLink,
  AlertTriangle, PlayCircle, X, Maximize2, Minimize2, RefreshCw
} from 'lucide-react';

interface ToolsDemoProps {
  onOpenQuoteBuilder: () => void;
  onOpenMenuBuilder: () => void;
  onOpenClientPortalDemo: () => void;
  onOpenRepPortalDemo: () => void;
}

type EmbeddedPreview = 'quote' | 'menu' | 'client' | 'rep' | null;

const ToolsDemo: React.FC<ToolsDemoProps> = ({
  onOpenQuoteBuilder,
  onOpenMenuBuilder,
  onOpenClientPortalDemo,
  onOpenRepPortalDemo
}) => {
  const [embeddedPreview, setEmbeddedPreview] = useState<EmbeddedPreview>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  const previewUrls: Record<Exclude<EmbeddedPreview, null>, string> = {
    quote: '/#/quote-builder?demo=true',
    menu: '/#/menu-builder?demo=true',
    client: '/#/portal/demo-seafood-shack/dashboard?demo=true',
    rep: '/#/rep/demo-rep/dashboard?demo=true'
  };

  const previewTitles: Record<Exclude<EmbeddedPreview, null>, string> = {
    quote: 'Quote Builder Demo',
    menu: 'Menu Builder Demo',
    client: 'Client Portal Demo',
    rep: 'Rep Portal Demo'
  };

  const refreshPreview = () => setIframeKey(prev => prev + 1);

  return (
    <div className="space-y-6">
      {/* Embedded Preview Modal */}
      {embeddedPreview && (
        <div className={`fixed z-50 ${
          isFullscreen
            ? 'inset-0'
            : 'inset-4 lg:inset-8'
        } bg-gray-900 border border-gray-700 rounded-xl shadow-2xl flex flex-col`}>
          {/* Preview Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800/80">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <span className="text-white font-medium">
                {previewTitles[embeddedPreview]}
              </span>
              <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded">
                Demo Mode
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={refreshPreview}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <a
                href={previewUrls[embeddedPreview]}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                title="Open in New Tab"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              <button
                onClick={() => {
                  setEmbeddedPreview(null);
                  setIsFullscreen(false);
                }}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          {/* Preview Iframe */}
          <div className="flex-1 bg-white">
            <iframe
              key={iframeKey}
              src={previewUrls[embeddedPreview]}
              className="w-full h-full border-0"
              title={previewTitles[embeddedPreview]}
            />
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
          <PlayCircle className="w-5 h-5 text-amber-400" />
          Demo Tools
        </h2>
        <p className="text-gray-400 text-sm mt-1">
          Test all tools in demo mode - preview inline or open in new window
        </p>
      </div>

      {/* Demo Mode Warning */}
      <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-amber-400 font-medium">Demo Mode Active</p>
          <p className="text-amber-400/80 text-sm">
            All tools below run in demonstration mode. Changes and results are not saved to production data.
          </p>
        </div>
      </div>

      {/* Tool Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quote Builder */}
        <div className="admin-card p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-14 h-14 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <Calculator className="w-7 h-7 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white">Quote Builder</h3>
              <p className="text-gray-400 text-sm">
                Generate Toast POS installation quotes with hardware selection, integrations, and support plans
              </p>
            </div>
          </div>

          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Features</span>
              <span className="text-white">Hardware, Integrations, Travel</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Output</span>
              <span className="text-white">PDF Quote, Email Summary</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setEmbeddedPreview('quote')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
            >
              <PlayCircle className="w-4 h-4" />
              Preview Inline
            </button>
            <button
              onClick={onOpenQuoteBuilder}
              className="flex items-center justify-center gap-2 px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Open in New Tab"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Menu Builder */}
        <div className="admin-card p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-14 h-14 bg-green-500/20 rounded-xl flex items-center justify-center">
              <UtensilsCrossed className="w-7 h-7 text-green-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white">Menu Builder</h3>
              <p className="text-gray-400 text-sm">
                AI-powered menu digitization with OCR processing and structured data export
              </p>
            </div>
          </div>

          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Features</span>
              <span className="text-white">OCR, AI Parsing, Export</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Output</span>
              <span className="text-white">JSON, CSV, Toast Import</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setEmbeddedPreview('menu')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
            >
              <PlayCircle className="w-4 h-4" />
              Preview Inline
            </button>
            <button
              onClick={onOpenMenuBuilder}
              className="flex items-center justify-center gap-2 px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Open in New Tab"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Client Portal Demo */}
        <div className="admin-card p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-14 h-14 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <Building2 className="w-7 h-7 text-purple-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white">Client Portal</h3>
              <p className="text-gray-400 text-sm">
                Preview the client experience with project tracking, files, and support access
              </p>
            </div>
          </div>

          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Demo Client</span>
              <span className="text-white">Demo Seafood Shack</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">View Mode</span>
              <span className="text-white">Full Client Experience</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setEmbeddedPreview('client')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition-colors"
            >
              <PlayCircle className="w-4 h-4" />
              Preview Inline
            </button>
            <button
              onClick={onOpenClientPortalDemo}
              className="flex items-center justify-center gap-2 px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Open in New Tab"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Rep Portal Demo */}
        <div className="admin-card p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-14 h-14 bg-amber-500/20 rounded-xl flex items-center justify-center">
              <Briefcase className="w-7 h-7 text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white">Rep Portal</h3>
              <p className="text-gray-400 text-sm">
                Preview the sales rep experience with client overview and referral tracking
              </p>
            </div>
          </div>

          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Demo Rep</span>
              <span className="text-white">Demo Sales Rep</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">View Mode</span>
              <span className="text-white">Full Rep Experience</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setEmbeddedPreview('rep')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
            >
              <PlayCircle className="w-4 h-4" />
              Preview Inline
            </button>
            <button
              onClick={onOpenRepPortalDemo}
              className="flex items-center justify-center gap-2 px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Open in New Tab"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div className="admin-card p-4">
        <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Demo Settings</h4>
        <p className="text-gray-400 text-sm">
          Demo mode uses pre-configured test data. To change the demo client or rep, update the
          demo_settings table or configure via the Config tab.
        </p>
      </div>
    </div>
  );
};

export default ToolsDemo;
