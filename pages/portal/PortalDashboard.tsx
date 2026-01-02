import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Loader2,
  Clock,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  Plus,
  FileText,
  MessageSquare,
  Shield,
  Calendar,
  Ticket,
  FolderOpen
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
  support_plan_tier: string | null;
  support_plan_status: string | null;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'on_hold';
  progress_percentage: number;
  due_date: string | null;
  created_at: number;
}

interface Ticket {
  id: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  created_at: number;
  updated_at: number;
}

interface Activity {
  id: string;
  type: 'project' | 'ticket' | 'file' | 'message';
  title: string;
  description: string;
  timestamp: number;
}

interface DashboardData {
  client: ClientInfo;
  projects: Project[];
  tickets: Ticket[];
  recentActivity: Activity[];
  stats: {
    activeProjects: number;
    openTickets: number;
    filesCount: number;
    unreadMessages: number;
    supportHoursRemaining: number | null;
  };
}

// ============================================
// PORTAL DASHBOARD PAGE
// ============================================
const PortalDashboard: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useSEO({
    title: data ? `Dashboard | ${data.client.company} Portal` : 'Dashboard',
    description: 'View your projects, tickets, and activity.',
  });

  // Load dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      if (!slug) return;

      try {
        // Load client info
        const infoResponse = await fetch(`/api/portal/${slug}/info`);
        const infoData = await infoResponse.json();

        if (!infoData.success) {
          setError(infoData.error || 'Failed to load client info');
          setIsLoading(false);
          return;
        }

        // Load projects
        const projectsResponse = await fetch(`/api/portal/${slug}/projects`);
        const projectsData = await projectsResponse.json();

        // Load messages/tickets (placeholder)
        const messagesResponse = await fetch(`/api/portal/${slug}/messages`);
        const messagesData = await messagesResponse.json();

        // Construct dashboard data
        const dashboardData: DashboardData = {
          client: infoData.data,
          projects: projectsData.success ? projectsData.data : [],
          tickets: [], // Tickets from messages/threads
          recentActivity: [], // Combine recent items
          stats: {
            activeProjects: projectsData.success ? projectsData.data.filter((p: Project) => p.status === 'in_progress').length : 0,
            openTickets: messagesData.success ? messagesData.data.filter((m: any) => m.status === 'open').length : 0,
            filesCount: 0, // Would come from files API
            unreadMessages: messagesData.success ? messagesData.data.filter((m: any) => !m.read_at).length : 0,
            supportHoursRemaining: null, // Would come from billing
          }
        };

        // Build recent activity from projects and messages
        const activities: Activity[] = [];

        if (projectsData.success) {
          projectsData.data.slice(0, 3).forEach((project: Project) => {
            activities.push({
              id: `project-${project.id}`,
              type: 'project',
              title: project.name,
              description: `Status: ${project.status.replace('_', ' ')}`,
              timestamp: project.created_at
            });
          });
        }

        if (messagesData.success) {
          messagesData.data.slice(0, 3).forEach((msg: any) => {
            activities.push({
              id: `message-${msg.id}`,
              type: 'message',
              title: msg.subject || 'Message',
              description: msg.body?.substring(0, 100) || '',
              timestamp: msg.created_at
            });
          });
        }

        dashboardData.recentActivity = activities.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);

        setData(dashboardData);
      } catch (err) {
        console.error('Dashboard load error:', err);
        setError('Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, [slug]);

  // Utility functions
  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() / 1000) - timestamp);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'resolved':
      case 'closed':
        return 'text-green-400 bg-green-400/10';
      case 'in_progress':
        return 'text-amber-400 bg-amber-400/10';
      case 'pending':
      case 'open':
        return 'text-blue-400 bg-blue-400/10';
      case 'on_hold':
        return 'text-gray-400 bg-gray-400/10';
      default:
        return 'text-gray-400 bg-gray-400/10';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'project':
        return <FileText className="w-4 h-4" />;
      case 'ticket':
        return <Ticket className="w-4 h-4" />;
      case 'file':
        return <FolderOpen className="w-4 h-4" />;
      case 'message':
        return <MessageSquare className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Error Loading Dashboard</h2>
        <p className="text-gray-400">{error || 'Something went wrong'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <section className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-white mb-2">
              Welcome back, {data.client.name.split(' ')[0]}!
            </h1>
            <p className="text-gray-400">
              Here's an overview of your projects and recent activity.
            </p>
          </div>
          <Link
            to={`/portal/${slug}/messages`}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg font-semibold transition-all hover:opacity-90 bg-amber-500 text-white hover:bg-amber-600"
          >
            <Plus className="w-5 h-5" />
            New Message
          </Link>
        </div>
      </section>

      {/* Quick Stats */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to={`/portal/${slug}/projects`}
          className="admin-card p-5 hover:border-amber-500/30 transition-colors group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-sm text-gray-400">Active Projects</span>
          </div>
          <p className="text-3xl font-bold text-white">{data.stats.activeProjects}</p>
        </Link>

        <Link
          to={`/portal/${slug}/messages`}
          className="admin-card p-5 hover:border-amber-500/30 transition-colors group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
              <Ticket className="w-5 h-5 text-amber-400" />
            </div>
            <span className="text-sm text-gray-400">Open Tickets</span>
          </div>
          <p className="text-3xl font-bold text-white">{data.stats.openTickets}</p>
        </Link>

        <Link
          to={`/portal/${slug}/files`}
          className="admin-card p-5 hover:border-amber-500/30 transition-colors group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
              <FolderOpen className="w-5 h-5 text-green-400" />
            </div>
            <span className="text-sm text-gray-400">Documents</span>
          </div>
          <p className="text-3xl font-bold text-white">{data.stats.filesCount}</p>
        </Link>

        <Link
          to={`/portal/${slug}/messages`}
          className="admin-card p-5 hover:border-amber-500/30 transition-colors group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
              <MessageSquare className="w-5 h-5 text-purple-400" />
            </div>
            <span className="text-sm text-gray-400">Unread Messages</span>
          </div>
          <p className="text-3xl font-bold text-white">{data.stats.unreadMessages}</p>
        </Link>
      </section>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Active Projects */}
        <section className="lg:col-span-2 admin-card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Active Projects</h2>
            <Link
              to={`/portal/${slug}/projects`}
              className="text-sm text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1"
            >
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {data.projects.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No active projects</p>
              <p className="text-gray-500 text-sm mt-1">Projects will appear here once started</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {data.projects.slice(0, 3).map((project) => (
                <Link
                  key={project.id}
                  to={`/portal/${slug}/projects`}
                  className="block px-6 py-4 hover:bg-gray-800/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-white">{project.name}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                      {project.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all"
                          style={{ width: `${project.progress_percentage}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm text-gray-400">{project.progress_percentage}%</span>
                    {project.due_date && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Due {project.due_date}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Recent Activity */}
        <section className="admin-card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
          </div>

          {data.recentActivity.length === 0 ? (
            <div className="p-8 text-center">
              <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No recent activity</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {data.recentActivity.map((activity) => (
                <div key={activity.id} className="px-6 py-4 hover:bg-gray-800/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-amber-400 flex-shrink-0">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{activity.title}</p>
                      <p className="text-xs text-gray-500 truncate">{activity.description}</p>
                      <p className="text-xs text-gray-600 mt-1">{formatTimeAgo(activity.timestamp)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Support Plan Card */}
      {data.client.support_plan_tier && (
        <section className="admin-card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white capitalize">{data.client.support_plan_tier} Support Plan</h3>
                <p className="text-sm text-gray-400">
                  Status: <span className={data.client.support_plan_status === 'active' ? 'text-green-400' : 'text-gray-400'}>
                    {data.client.support_plan_status || 'N/A'}
                  </span>
                </p>
              </div>
            </div>
            <Link
              to={`/portal/${slug}/billing`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              View Plan Details
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      )}

      {/* Quick Links */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to={`/portal/${slug}/files`}
          className="admin-card p-5 hover:border-amber-500/30 transition-all group"
        >
          <FolderOpen className="w-8 h-8 text-amber-400 mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="font-semibold text-white mb-1">Documents</h3>
          <p className="text-sm text-gray-400">Access training guides and SOPs</p>
        </Link>

        <Link
          to={`/portal/${slug}/messages`}
          className="admin-card p-5 hover:border-amber-500/30 transition-all group"
        >
          <MessageSquare className="w-8 h-8 text-amber-400 mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="font-semibold text-white mb-1">Messages</h3>
          <p className="text-sm text-gray-400">Contact your support team</p>
        </Link>

        <Link
          to={`/portal/${slug}/projects`}
          className="admin-card p-5 hover:border-amber-500/30 transition-all group"
        >
          <FileText className="w-8 h-8 text-amber-400 mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="font-semibold text-white mb-1">Projects</h3>
          <p className="text-sm text-gray-400">Track project progress</p>
        </Link>

        <Link
          to={`/portal/${slug}/billing`}
          className="admin-card p-5 hover:border-amber-500/30 transition-all group"
        >
          <Shield className="w-8 h-8 text-amber-400 mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="font-semibold text-white mb-1">Billing</h3>
          <p className="text-sm text-gray-400">View invoices and support plan</p>
        </Link>
      </section>
    </div>
  );
};

export default PortalDashboard;
