import React from 'react';
import {
  Calculator, UtensilsCrossed, Building2, Briefcase, ExternalLink,
  AlertTriangle, PlayCircle
} from 'lucide-react';

interface ToolsDemoProps {
  onOpenQuoteBuilder: () => void;
  onOpenMenuBuilder: () => void;
  onOpenClientPortalDemo: () => void;
  onOpenRepPortalDemo: () => void;
}

const ToolsDemo: React.FC<ToolsDemoProps> = ({
  onOpenQuoteBuilder,
  onOpenMenuBuilder,
  onOpenClientPortalDemo,
  onOpenRepPortalDemo
}) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
          <PlayCircle className="w-5 h-5 text-amber-400" />
          Demo Tools
        </h2>
        <p className="text-gray-400 text-sm mt-1">
          Test all tools in demo mode - no data is saved to real clients
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

          <div className="flex gap-3">
            <button
              onClick={onOpenQuoteBuilder}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
            >
              <PlayCircle className="w-4 h-4" />
              Launch Demo
            </button>
            <a
              href="/#/quote-builder"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
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

          <div className="flex gap-3">
            <button
              onClick={onOpenMenuBuilder}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
            >
              <PlayCircle className="w-4 h-4" />
              Launch Demo
            </button>
            <a
              href="/#/menu-builder"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
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

          <button
            onClick={onOpenClientPortalDemo}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition-colors"
          >
            <PlayCircle className="w-4 h-4" />
            Preview as Client
          </button>
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

          <button
            onClick={onOpenRepPortalDemo}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
          >
            <PlayCircle className="w-4 h-4" />
            Preview as Rep
          </button>
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
