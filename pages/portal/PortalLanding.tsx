import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  UtensilsCrossed,
  Loader2,
  AlertCircle,
  ArrowRight,
  Shield,
  Clock,
  FileText,
  MessageSquare
} from 'lucide-react';
import { useSEO } from '../../src/components/SEO';

// ============================================
// TYPE DEFINITIONS
// ============================================
interface ClientInfo {
  id: string;
  name: string;
  company: string;
  email: string;
  slug: string;
  avatar_url: string | null;
  support_plan_tier: string | null;
  portal_enabled: boolean;
}

// ============================================
// PORTAL LANDING PAGE
// ============================================
const PortalLanding: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useSEO({
    title: clientInfo ? `${clientInfo.company} Portal | Cape Cod Restaurant Consulting` : 'Client Portal',
    description: 'Access your dedicated client portal.',
  });

  // Load client info by slug
  useEffect(() => {
    const loadClientInfo = async () => {
      if (!slug) {
        setError('Invalid portal URL');
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/portal/${slug}/info`);
        const data = await response.json();

        if (!data.success) {
          setError(data.error || 'Portal not found');
          setIsLoading(false);
          return;
        }

        if (!data.data.portal_enabled) {
          setError('This client portal is not currently active.');
          setIsLoading(false);
          return;
        }

        setClientInfo(data.data);

        // Check if user is already authenticated
        const authResponse = await fetch('/api/client/auth/verify', {
          credentials: 'include'
        });

        if (authResponse.ok) {
          const authData = await authResponse.json();
          if (authData.authenticated && authData.clientId === data.data.id) {
            // Already logged in, redirect to dashboard
            navigate(`/portal/${slug}/dashboard`);
            return;
          }
        }
      } catch (err) {
        console.error('Portal load error:', err);
        setError('Failed to load portal information');
      } finally {
        setIsLoading(false);
      }
    };

    loadClientInfo();
  }, [slug, navigate]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-dark to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading portal...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !clientInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-dark to-gray-900 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-2xl font-display font-bold text-white mb-3">Portal Not Found</h2>
          <p className="text-gray-400 mb-6">
            {error || 'The portal you are looking for does not exist or is not currently active.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/portal"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600 transition-colors"
            >
              Go to Main Portal
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition-colors"
            >
              Contact Support
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-dark to-gray-900">
      {/* Header */}
      <header className="py-6 border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center border border-gray-700">
              <UtensilsCrossed className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <span className="text-xs text-gray-400 uppercase tracking-wider">Client Portal</span>
              <h1 className="font-display font-bold text-white text-lg">{clientInfo.company}</h1>
            </div>
          </div>
          <Link
            to="/"
            className="text-sm text-gray-400 hover:text-amber-400 transition-colors"
          >
            R&G Consulting
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Welcome Card */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-8 md:p-12 text-center mb-8">
          {clientInfo.avatar_url ? (
            <img
              src={clientInfo.avatar_url}
              alt={clientInfo.company}
              className="w-20 h-20 rounded-full mx-auto mb-6 border-2 border-amber-500/30"
            />
          ) : (
            <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <UtensilsCrossed className="w-10 h-10 text-amber-400" />
            </div>
          )}

          <h2 className="text-3xl font-display font-bold text-white mb-3">
            Welcome to Your Portal
          </h2>
          <p className="text-gray-400 text-lg mb-8 max-w-lg mx-auto">
            Access your projects, support tickets, documents, and billing information
            all in one secure place.
          </p>

          <Link
            to={`/portal/${slug}/login`}
            className="inline-flex items-center gap-2 px-8 py-4 bg-amber-500 text-white rounded-lg font-semibold text-lg hover:bg-amber-600 transition-colors shadow-lg glow-pulse"
          >
            Sign In to Your Portal
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>

        {/* Features Grid */}
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
            <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center mb-4">
              <Clock className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Project Tracking</h3>
            <p className="text-gray-400 text-sm">
              View real-time status updates on your installations, training, and ongoing projects.
            </p>
          </div>

          <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
            <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center mb-4">
              <MessageSquare className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Direct Messaging</h3>
            <p className="text-gray-400 text-sm">
              Communicate directly with your support team and track all conversations.
            </p>
          </div>

          <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
            <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center mb-4">
              <FileText className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Document Library</h3>
            <p className="text-gray-400 text-sm">
              Access training materials, SOPs, contracts, and other important documents.
            </p>
          </div>

          <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
            <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Support Management</h3>
            <p className="text-gray-400 text-sm">
              View your support plan, track hours, and manage billing information.
            </p>
          </div>
        </div>

        {/* Support Plan Badge */}
        {clientInfo.support_plan_tier && (
          <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-6 text-center">
            <p className="text-sm text-amber-400 uppercase tracking-wider mb-1">Your Support Plan</p>
            <p className="text-2xl font-display font-bold text-white capitalize">
              {clientInfo.support_plan_tier} Plan
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-6 mt-auto">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>Cape Cod Restaurant Consulting - Secure Client Portal</p>
          <p className="mt-2">
            <Link to="/contact" className="text-amber-400 hover:text-amber-300 transition-colors">
              Need help? Contact Support
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default PortalLanding;
