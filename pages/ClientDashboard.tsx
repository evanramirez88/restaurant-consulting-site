import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Loader2,
  LogOut,
  Ticket,
  FileText,
  GraduationCap,
  Monitor,
  Clock,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  Plus,
  Bell,
  User,
  Shield,
  UtensilsCrossed,
  Settings,
  BarChart3,
  MessageSquare
} from 'lucide-react';
import { useSEO } from '../src/components/SEO';

// ============================================
// COMING SOON FLAG - Set to false when ready to launch
// Admin users and demo mode (?demo=true) bypass this flag
// ============================================
const SHOW_COMING_SOON_DEFAULT = true;

// ============================================
// TYPE DEFINITIONS
// ============================================
interface ClientData {
  name: string;
  company: string;
  email: string;
  plan: string;
  hoursRemaining: number;
}

interface Project {
  id: string;
  name: string;
  status: 'pending' | 'in-progress' | 'completed';
  progress: number;
  dueDate: string;
}

interface SupportTicket {
  id: string;
  subject: string;
  status: 'open' | 'in-progress' | 'resolved';
  priority: 'low' | 'medium' | 'high';
  lastUpdate: string;
}

interface Activity {
  id: string;
  type: 'ticket' | 'document' | 'training' | 'project';
  message: string;
  timestamp: string;
}

// ============================================
// SAMPLE DATA (for preview)
// ============================================
const SAMPLE_CLIENT: ClientData = {
  name: 'John Doe',
  company: 'The Lobster Pot',
  email: 'john@lobsterpot.com',
  plan: 'Professional',
  hoursRemaining: 3.5
};

const SAMPLE_PROJECTS: Project[] = [
  { id: '1', name: 'Toast POS Installation', status: 'in-progress', progress: 75, dueDate: 'Jan 15, 2025' },
  { id: '2', name: 'Menu Digitization', status: 'pending', progress: 0, dueDate: 'Jan 22, 2025' }
];

const SAMPLE_TICKETS: SupportTicket[] = [
  { id: 'TKT-001', subject: 'Kitchen printer not connecting', status: 'in-progress', priority: 'high', lastUpdate: '2 hours ago' },
  { id: 'TKT-002', subject: 'Staff training request', status: 'open', priority: 'medium', lastUpdate: '1 day ago' }
];

const SAMPLE_ACTIVITIES: Activity[] = [
  { id: '1', type: 'ticket', message: 'Ticket TKT-001 updated: Technician en route', timestamp: '2 hours ago' },
  { id: '2', type: 'document', message: 'New document added: Toast Quick Start Guide', timestamp: '5 hours ago' },
  { id: '3', type: 'training', message: 'Training video watched: Menu Management Basics', timestamp: '1 day ago' },
  { id: '4', type: 'project', message: 'Project milestone completed: Hardware Installation', timestamp: '2 days ago' }
];

// ============================================
// COMING SOON COMPONENT
// ============================================
const ComingSoonOverlay: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-dark to-gray-900 relative">
      {/* Blurred dashboard preview behind */}
      <div className="filter blur-sm opacity-30 pointer-events-none">
        <DashboardContent client={SAMPLE_CLIENT} isPreview />
      </div>

      {/* Coming Soon Overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-primary-dark/80 backdrop-blur-sm">
        <div className="text-center px-6 max-w-lg">
          <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <BarChart3 className="w-10 h-10 text-amber-400" />
          </div>
          <h2 className="text-3xl font-display font-bold text-white mb-4">
            Dashboard Coming Soon
          </h2>
          <p className="text-gray-400 mb-8 text-lg">
            We're building a comprehensive client dashboard to give you full visibility
            into your projects, support requests, and training progress.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/portal"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all shadow-md hover:opacity-90"
              style={{ backgroundColor: '#ea580c', color: '#ffffff' }}
            >
              View Portal Overview
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition-all"
            >
              Contact Support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// DASHBOARD CONTENT COMPONENT
// ============================================
interface DashboardContentProps {
  client: ClientData;
  isPreview?: boolean;
}

const DashboardContent: React.FC<DashboardContentProps> = ({ client, isPreview = false }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (isPreview) return;
    try {
      await fetch('/api/client/auth/logout', { method: 'POST' });
      navigate('/portal/login');
    } catch (error) {
      navigate('/portal/login');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'resolved':
        return 'text-green-400 bg-green-400/10';
      case 'in-progress':
        return 'text-amber-400 bg-amber-400/10';
      case 'open':
      case 'pending':
        return 'text-blue-400 bg-blue-400/10';
      default:
        return 'text-gray-400 bg-gray-400/10';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-400';
      case 'medium':
        return 'text-amber-400';
      default:
        return 'text-gray-400';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'ticket':
        return <Ticket className="w-4 h-4" />;
      case 'document':
        return <FileText className="w-4 h-4" />;
      case 'training':
        return <GraduationCap className="w-4 h-4" />;
      case 'project':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-dark to-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/portal" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center border border-gray-700">
                <UtensilsCrossed className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h1 className="font-display font-bold text-white text-lg">Client Dashboard</h1>
                <p className="text-xs text-gray-400">{client.company}</p>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {/* Notifications */}
            <button className="relative p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full" />
            </button>

            {/* User Menu */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-white">{client.name}</p>
                <p className="text-xs text-gray-400">{client.plan} Plan</p>
              </div>
              <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-amber-400" />
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors min-h-[44px]"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Welcome Section */}
        <section className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-display font-bold text-white mb-2">
                Welcome back, {client.name.split(' ')[0]}!
              </h2>
              <p className="text-gray-400">
                Here's an overview of your restaurant tech status.
              </p>
            </div>
            <button className="inline-flex items-center gap-2 px-5 py-3 rounded-lg font-semibold transition-all hover:opacity-90"
              style={{ backgroundColor: '#ea580c', color: '#ffffff' }}
            >
              <Plus className="w-5 h-5" />
              New Support Request
            </button>
          </div>
        </section>

        {/* Quick Stats */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Ticket className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-sm text-gray-400">Open Tickets</span>
            </div>
            <p className="text-3xl font-bold text-white">2</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-sm text-gray-400">Documents</span>
            </div>
            <p className="text-3xl font-bold text-white">24</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-sm text-gray-400">Training</span>
            </div>
            <p className="text-3xl font-bold text-white">40%</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-amber-400" />
              </div>
              <span className="text-sm text-gray-400">Support Hours</span>
            </div>
            <p className="text-3xl font-bold text-white">{client.hoursRemaining}h</p>
          </div>
        </section>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Active Projects */}
          <section className="lg:col-span-2 bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Active Projects</h3>
              <button className="text-sm text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1">
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="divide-y divide-gray-700">
              {SAMPLE_PROJECTS.map((project) => (
                <div key={project.id} className="px-6 py-4 hover:bg-gray-800/30 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-white">{project.name}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                      {project.status.replace('-', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all"
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm text-gray-400">{project.progress}%</span>
                    <span className="text-xs text-gray-500">Due {project.dueDate}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Recent Activity */}
          <section className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
            </div>
            <div className="divide-y divide-gray-700">
              {SAMPLE_ACTIVITIES.map((activity) => (
                <div key={activity.id} className="px-6 py-4 hover:bg-gray-800/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-amber-400 flex-shrink-0">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-300 line-clamp-2">{activity.message}</p>
                      <p className="text-xs text-gray-500 mt-1">{activity.timestamp}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Support Tickets */}
        <section className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Support Tickets</h3>
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" />
              New Ticket
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700 text-left">
                  <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Ticket ID</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Priority</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Last Update</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {SAMPLE_TICKETS.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-amber-400">{ticket.id}</td>
                    <td className="px-6 py-4 text-sm text-white">{ticket.subject}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                        {ticket.status.replace('-', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-medium capitalize ${getPriorityColor(ticket.priority)}`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">{ticket.lastUpdate}</td>
                    <td className="px-6 py-4">
                      <button className="text-gray-400 hover:text-white transition-colors">
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Quick Links */}
        <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to="#"
            className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-amber-500/30 transition-all group"
          >
            <FileText className="w-8 h-8 text-amber-400 mb-3 group-hover:scale-110 transition-transform" />
            <h4 className="font-semibold text-white mb-1">Documentation</h4>
            <p className="text-sm text-gray-400">Access guides and SOPs</p>
          </Link>
          <Link
            to="#"
            className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-amber-500/30 transition-all group"
          >
            <GraduationCap className="w-8 h-8 text-amber-400 mb-3 group-hover:scale-110 transition-transform" />
            <h4 className="font-semibold text-white mb-1">Training</h4>
            <p className="text-sm text-gray-400">Video tutorials & courses</p>
          </Link>
          <Link
            to="#"
            className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-amber-500/30 transition-all group"
          >
            <Monitor className="w-8 h-8 text-amber-400 mb-3 group-hover:scale-110 transition-transform" />
            <h4 className="font-semibold text-white mb-1">Hardware</h4>
            <p className="text-sm text-gray-400">View your equipment</p>
          </Link>
          <Link
            to="#"
            className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-amber-500/30 transition-all group"
          >
            <MessageSquare className="w-8 h-8 text-amber-400 mb-3 group-hover:scale-110 transition-transform" />
            <h4 className="font-semibold text-white mb-1">Contact Support</h4>
            <p className="text-sm text-gray-400">Get help from our team</p>
          </Link>
        </section>

        {/* Footer */}
        <footer className="text-center text-gray-500 text-sm py-4">
          <p>Cape Cod Restaurant Consulting Client Portal</p>
        </footer>
      </main>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================
const ClientDashboard: React.FC = () => {
  useSEO({
    title: 'Dashboard | Client Portal | Cape Cod Restaurant Consulting',
    description: 'Access your client dashboard to manage projects, view support tickets, and track training progress.',
  });

  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [client, setClient] = useState<ClientData | null>(null);
  const [showComingSoon, setShowComingSoon] = useState(SHOW_COMING_SOON_DEFAULT);
  const [accessCheckDone, setAccessCheckDone] = useState(false);

  // Check if demo mode or admin - bypass coming soon
  useEffect(() => {
    const checkAccess = async () => {
      // Support both ?demo=true and #/path?demo=true (hash routing)
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
      const isDemoMode = urlParams.get('demo') === 'true' || hashParams.get('demo') === 'true';

      let isAdmin = false;
      try {
        const authResponse = await fetch('/api/auth/verify', { credentials: 'include' });
        const authData = await authResponse.json();
        isAdmin = authData.authenticated === true;
      } catch {
        // Not admin
      }

      if (isDemoMode || isAdmin) {
        setShowComingSoon(false);
      }
      setAccessCheckDone(true);
    };
    checkAccess();
  }, []);

  // Check authentication
  useEffect(() => {
    if (!accessCheckDone) return;

    if (showComingSoon) {
      setIsLoading(false);
      return;
    }

    const checkAuth = async () => {
      try {
        const response = await fetch('/api/client/auth/verify');
        const data = await response.json();

        if (!data.authenticated) {
          navigate('/portal/login');
          return;
        }

        setIsAuthenticated(true);
        setClient(data.client);
      } catch (error) {
        navigate('/portal/login');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [navigate, accessCheckDone, showComingSoon]);

  // Show loading while checking access
  if (!accessCheckDone) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-dark to-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  // Show Coming Soon overlay
  if (showComingSoon) {
    return <ComingSoonOverlay />;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-dark to-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !client) {
    return null;
  }

  return <DashboardContent client={client} />;
};

export default ClientDashboard;
