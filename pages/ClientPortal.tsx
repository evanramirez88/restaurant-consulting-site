import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Ticket,
  FileText,
  GraduationCap,
  Monitor,
  ChevronRight,
  Clock,
  CheckCircle,
  AlertTriangle,
  Shield,
  Lock,
  Loader2
} from 'lucide-react';
import { useSEO } from '../src/components/SEO';

// ============================================
// COMING SOON FLAG - Set to false when ready to launch
// This is the local fallback. The API flag takes precedence.
// ============================================
const SHOW_COMING_SOON = true;

// ============================================
// DASHBOARD PREVIEW WIDGETS (for Coming Soon display)
// ============================================

interface WidgetCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  stats?: { label: string; value: string }[];
}

const WidgetCard: React.FC<WidgetCardProps> = ({ icon, title, description, stats }) => (
  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-amber-500/30 transition-all duration-300 group">
    <div className="flex items-start gap-4 mb-4">
      <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-400 group-hover:bg-amber-500/20 transition-colors">
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
        <p className="text-sm text-gray-400">{description}</p>
      </div>
    </div>
    {stats && (
      <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-700">
        {stats.map((stat, idx) => (
          <div key={idx} className="text-center">
            <div className="text-xl font-bold text-white">{stat.value}</div>
            <div className="text-xs text-gray-500">{stat.label}</div>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ============================================
// COMING SOON COMPONENT
// ============================================
const ComingSoonOverlay: React.FC = () => {
  return (
    <div className="bg-primary-dark min-h-screen relative hero-grain">
      {/* Header Section */}
      <div className="py-16 pt-8 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center animate-on-scroll">
          <div className="inline-flex items-center gap-3 mb-4">
            <Users className="w-12 h-12 text-amber-500" />
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">Client Portal</h1>
          </div>
          <div className="brass-line-draw short mb-6" />
          <p className="text-amber-400 text-xl sm:text-2xl font-semibold mb-4">
            Coming Soon
          </p>
          <p className="text-gray-400 max-w-2xl mx-auto text-base sm:text-lg">
            A dedicated space for our restaurant partners to manage projects, access support,
            view documentation, and track training progress - all in one place.
          </p>
        </div>
      </div>

      {/* Dashboard Preview Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Preview Label */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="h-px bg-gray-700 flex-1 max-w-[100px]" />
          <span className="text-sm text-gray-500 uppercase tracking-wider">Dashboard Preview</span>
          <div className="h-px bg-gray-700 flex-1 max-w-[100px]" />
        </div>

        {/* Widget Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12 animate-on-scroll">
          <WidgetCard
            icon={<Clock className="w-6 h-6" />}
            title="Project Status"
            description="Track your installation progress and milestones in real-time"
            stats={[
              { label: "Active Projects", value: "2" },
              { label: "Completion", value: "75%" }
            ]}
          />
          <WidgetCard
            icon={<Ticket className="w-6 h-6" />}
            title="Support Tickets"
            description="Submit and track support requests with priority handling"
            stats={[
              { label: "Open Tickets", value: "1" },
              { label: "Avg Response", value: "4h" }
            ]}
          />
          <WidgetCard
            icon={<FileText className="w-6 h-6" />}
            title="Documentation Hub"
            description="Access training guides, SOPs, and system documentation"
            stats={[
              { label: "Documents", value: "24" },
              { label: "Categories", value: "6" }
            ]}
          />
          <WidgetCard
            icon={<GraduationCap className="w-6 h-6" />}
            title="Training Materials"
            description="Video tutorials, quick-start guides, and certification tracks"
            stats={[
              { label: "Videos", value: "15" },
              { label: "Progress", value: "40%" }
            ]}
          />
          <WidgetCard
            icon={<Monitor className="w-6 h-6" />}
            title="Hardware Inventory"
            description="View your installed equipment and warranty information"
            stats={[
              { label: "Devices", value: "8" },
              { label: "Under Warranty", value: "8" }
            ]}
          />
          <WidgetCard
            icon={<Shield className="w-6 h-6" />}
            title="Support Plan"
            description="Manage your Toast Guardian subscription and benefits"
            stats={[
              { label: "Plan", value: "Pro" },
              { label: "Hours Left", value: "3.5" }
            ]}
          />
        </div>

        {/* Features Coming List */}
        <div className="bg-gray-800/30 border border-gray-700 rounded-2xl p-8 mb-12 animate-on-scroll">
          <h2 className="text-xl font-display font-bold text-white mb-6 text-center">
            Features In Development
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              "Secure client login with magic link option",
              "Real-time project status tracking",
              "Support ticket submission & history",
              "Document library with search",
              "Video training library",
              "Hardware inventory management",
              "Invoice & payment history",
              "Direct messaging with support team",
              "Scheduled maintenance notifications"
            ].map((feature, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <span className="text-gray-300 text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center animate-on-scroll">
          <div className="inline-block bg-gray-800/50 border border-gray-700 rounded-2xl p-8 shadow-xl">
            <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-amber-400" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">
              Already a Client?
            </h2>
            <p className="text-gray-400 mb-6 max-w-md">
              We're notifying existing clients as access becomes available.
              Contact us if you'd like to be among the first to access the portal.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/contact"
                className="inline-block px-6 py-3 rounded-lg font-semibold transition-all hover:opacity-90 shadow-md hover:opacity-90 text-sm sm:text-base"
                style={{ backgroundColor: '#ea580c', color: '#ffffff' }}
              >
                Request Early Access
              </Link>
              <Link
                to="/support-plans"
                className="inline-block px-6 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition-all shadow-md hover:opacity-90 text-sm sm:text-base"
              >
                View Support Plans
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Background Decoration */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 -right-64 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -left-64 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================
const ClientPortal: React.FC = () => {
  useSEO({
    title: 'Client Portal | Cape Cod Restaurant Consulting',
    description: 'Access your dedicated client portal to manage projects, submit support tickets, view documentation, and track training progress.',
    canonical: 'https://ccrestaurantconsulting.com/#/portal',
  });

  // Feature flag state
  const [featureFlagLoading, setFeatureFlagLoading] = useState(true);
  const [isFeatureEnabled, setIsFeatureEnabled] = useState(!SHOW_COMING_SOON);

  // Check feature flag from API on load
  // Admin users and demo mode (?demo=true) always have access
  useEffect(() => {
    const checkFeatureFlag = async () => {
      try {
        // Check if demo mode is enabled via URL parameter
        // Support both ?demo=true and #/path?demo=true (hash routing)
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
        const isDemoMode = urlParams.get('demo') === 'true' || hashParams.get('demo') === 'true';

        // Check if user is authenticated as admin
        let isAdmin = false;
        try {
          const authResponse = await fetch('/api/auth/verify', { credentials: 'include' });
          const authData = await authResponse.json();
          isAdmin = authData.authenticated === true;
        } catch {
          // Not authenticated, continue with feature flag check
        }

        // Admin and demo mode always have access
        if (isDemoMode || isAdmin) {
          setIsFeatureEnabled(true);
          setFeatureFlagLoading(false);
          return;
        }

        // Check feature flag for regular users
        const response = await fetch('/api/admin/feature-flags');
        const result = await response.json();
        if (result.success && result.data?.flags) {
          setIsFeatureEnabled(result.data.flags.client_portal_enabled === true);
        }
      } catch (error) {
        console.error('Failed to check feature flag:', error);
        // Fall back to local constant
        setIsFeatureEnabled(!SHOW_COMING_SOON);
      } finally {
        setFeatureFlagLoading(false);
      }
    };
    checkFeatureFlag();
  }, []);

  // Loading state while checking feature flag
  if (featureFlagLoading) {
    return (
      <div className="bg-primary-dark min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" aria-label="Loading" />
      </div>
    );
  }

  // Coming Soon overlay - shows when feature is disabled
  if (!isFeatureEnabled) {
    return <ComingSoonOverlay />;
  }

  // Future: Full portal landing page when feature is enabled
  return (
    <div className="bg-primary-dark min-h-screen">
      {/* This will be the full portal landing page in the future */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-display font-bold text-white mb-8">Client Portal</h1>
        {/* Portal content will go here */}
      </div>
    </div>
  );
};

export default ClientPortal;
