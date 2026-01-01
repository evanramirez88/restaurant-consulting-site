import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  UtensilsCrossed,
  LayoutDashboard,
  FolderOpen,
  MessageSquare,
  FileText,
  CreditCard,
  LogOut,
  Menu,
  X,
  Bell,
  User,
  ChevronRight,
  Loader2
} from 'lucide-react';

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
  support_plan_status: string | null;
}

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
}

interface PortalLayoutProps {
  children: React.ReactNode;
}

// ============================================
// PORTAL LAYOUT COMPONENT
// ============================================
const PortalLayout: React.FC<PortalLayoutProps> = ({ children }) => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Navigation items
  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', path: `/portal/${slug}/dashboard`, icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'projects', label: 'Projects', path: `/portal/${slug}/projects`, icon: <FileText className="w-5 h-5" /> },
    { id: 'files', label: 'Files', path: `/portal/${slug}/files`, icon: <FolderOpen className="w-5 h-5" /> },
    { id: 'messages', label: 'Messages', path: `/portal/${slug}/messages`, icon: <MessageSquare className="w-5 h-5" /> },
    { id: 'billing', label: 'Billing & Support', path: `/portal/${slug}/billing`, icon: <CreditCard className="w-5 h-5" /> },
  ];

  // Check authentication and load client info
  useEffect(() => {
    const checkAuth = async () => {
      if (!slug) {
        setError('Invalid portal URL');
        setIsLoading(false);
        return;
      }

      try {
        // Verify client authentication
        const authResponse = await fetch('/api/client/auth/verify', {
          credentials: 'include'
        });

        if (!authResponse.ok) {
          navigate(`/portal/${slug}/login`);
          return;
        }

        const authData = await authResponse.json();
        if (!authData.authenticated) {
          navigate(`/portal/${slug}/login`);
          return;
        }

        // Load client info by slug
        const clientResponse = await fetch(`/api/portal/${slug}/info`);
        const clientData = await clientResponse.json();

        if (!clientData.success) {
          setError(clientData.error || 'Client not found');
          setIsLoading(false);
          return;
        }

        // Verify the authenticated client matches this portal
        if (authData.clientId !== clientData.data.id) {
          navigate(`/portal/${slug}/login`);
          return;
        }

        setClientInfo(clientData.data);
        setIsAuthenticated(true);
      } catch (err) {
        console.error('Portal auth error:', err);
        navigate(`/portal/${slug}/login`);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [slug, navigate]);

  // Handle logout
  const handleLogout = async () => {
    try {
      await fetch('/api/client/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (err) {
      console.error('Logout error:', err);
    }
    navigate(`/portal/${slug}/login`);
  };

  // Get active nav item
  const getActiveNavItem = () => {
    const path = location.pathname;
    return navItems.find(item => path.includes(item.id))?.id || 'dashboard';
  };

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
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-dark to-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Portal Error</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <Link
            to="/portal"
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
          >
            Return to Portal
          </Link>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !clientInfo) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-dark to-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Company */}
            <div className="flex items-center gap-4">
              <Link to={`/portal/${slug}/dashboard`} className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center border border-gray-700">
                  <UtensilsCrossed className="w-5 h-5 text-amber-400" />
                </div>
                <div className="hidden sm:block">
                  <h1 className="font-display font-bold text-white text-lg leading-tight">
                    {clientInfo.company}
                  </h1>
                  <p className="text-xs text-gray-400">Client Portal</p>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.id}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    getActiveNavItem() === item.id
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>

            {/* Right side actions */}
            <div className="flex items-center gap-3">
              {/* Notifications */}
              <button className="relative p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full" />
              </button>

              {/* User menu (desktop) */}
              <div className="hidden md:flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-white">{clientInfo.name}</p>
                  {clientInfo.support_plan_tier && (
                    <p className="text-xs text-gray-400 capitalize">{clientInfo.support_plan_tier} Plan</p>
                  )}
                </div>
                <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
                  {clientInfo.avatar_url ? (
                    <img
                      src={clientInfo.avatar_url}
                      alt={clientInfo.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <User className="w-5 h-5 text-amber-400" />
                  )}
                </div>
              </div>

              {/* Logout button (desktop) */}
              <button
                onClick={handleLogout}
                className="hidden md:flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden lg:inline">Logout</span>
              </button>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-800 bg-gray-900/95 backdrop-blur-sm">
            <nav className="max-w-7xl mx-auto px-4 py-4 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.id}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    getActiveNavItem() === item.id
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </Link>
              ))}

              {/* Mobile user info */}
              <div className="pt-4 mt-4 border-t border-gray-800">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{clientInfo.name}</p>
                    <p className="text-xs text-gray-400">{clientInfo.email}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-3 text-red-400 hover:text-red-300 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <p>Cape Cod Restaurant Consulting - Client Portal</p>
            <div className="flex items-center gap-4">
              <Link to="/contact" className="hover:text-amber-400 transition-colors">
                Contact Support
              </Link>
              <span className="text-gray-700">|</span>
              <Link to="/support-plans" className="hover:text-amber-400 transition-colors">
                Support Plans
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PortalLayout;
