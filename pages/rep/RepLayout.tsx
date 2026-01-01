import React from 'react';
import { Link, useLocation, useNavigate, Outlet, useParams } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Gift,
  MessageSquare,
  LogOut,
  Briefcase,
  ChevronRight
} from 'lucide-react';

interface RepInfo {
  id: string;
  name: string;
  email: string;
  territory: string | null;
  avatar_url: string | null;
  slug: string;
}

interface RepLayoutProps {
  rep?: RepInfo | null;
  isLoading?: boolean;
}

const RepLayout: React.FC<RepLayoutProps> = ({ rep, isLoading = false }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();

  const navItems = [
    { path: `/rep/${slug}/dashboard`, label: 'Dashboard', icon: LayoutDashboard },
    { path: `/rep/${slug}/clients`, label: 'My Clients', icon: Users },
    { path: `/rep/${slug}/referrals`, label: 'Referrals', icon: Gift },
    { path: `/rep/${slug}/messages`, label: 'Messages', icon: MessageSquare },
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    try {
      await fetch(`/api/rep/${slug}/auth/logout`, { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    }
    navigate(`/rep/${slug}/login`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-dark to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-dark to-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={`/rep/${slug}/dashboard`} className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center border border-green-500/30">
                <Briefcase className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h1 className="font-display font-bold text-white text-lg">Rep Portal</h1>
                <p className="text-xs text-gray-400">{rep?.territory || 'Sales Representative'}</p>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {/* Rep Info */}
            <div className="hidden sm:flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-white">{rep?.name || 'Loading...'}</p>
                <p className="text-xs text-gray-400">{rep?.email || ''}</p>
              </div>
              <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center overflow-hidden">
                {rep?.avatar_url ? (
                  <img src={rep.avatar_url} alt={rep.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-green-400 font-semibold">
                    {rep?.name?.charAt(0) || 'R'}
                  </span>
                )}
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors min-h-[44px]"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-gray-900/80 border-b border-gray-800 overflow-x-auto" aria-label="Rep navigation">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 py-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all whitespace-nowrap min-h-[44px] ${
                    isActive(item.path)
                      ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                  aria-current={isActive(item.path) ? 'page' : undefined}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 py-3">
        <nav className="flex items-center gap-2 text-sm text-gray-500" aria-label="Breadcrumb">
          <Link to={`/rep/${slug}/dashboard`} className="hover:text-gray-300 transition-colors">
            Rep Portal
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-gray-300">
            {navItems.find(item => isActive(item.path))?.label || 'Dashboard'}
          </span>
        </nav>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 pb-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="text-center text-gray-500 text-sm py-4">
        <p>Cape Cod Restaurant Consulting - Rep Portal</p>
      </footer>
    </div>
  );
};

export default RepLayout;
