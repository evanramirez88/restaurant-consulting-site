import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Loader2,
  AlertTriangle,
  FileText,
  Calendar,
  Clock,
  CheckCircle,
  Circle,
  ChevronDown,
  ChevronUp,
  User,
  MessageSquare
} from 'lucide-react';
import { useSEO } from '../../src/components/SEO';

// ============================================
// TYPE DEFINITIONS
// ============================================
interface Project {
  id: string;
  name: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'on_hold';
  progress_percentage: number;
  start_date: string | null;
  due_date: string | null;
  milestone_json: string | null;
  timeline_json: string | null;
  created_at: number;
  updated_at: number;
}

interface Milestone {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed';
  due_date?: string;
  completed_at?: number;
}

// ============================================
// PORTAL PROJECTS PAGE
// ============================================
const PortalProjects: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  useSEO({
    title: 'Projects | Client Portal',
    description: 'View and track your project progress.',
  });

  // Load projects
  useEffect(() => {
    const loadProjects = async () => {
      if (!slug) return;

      try {
        const response = await fetch(`/api/portal/${slug}/projects`);
        const data = await response.json();

        if (data.success) {
          setProjects(data.data || []);
        } else {
          setError(data.error || 'Failed to load projects');
        }
      } catch (err) {
        console.error('Projects load error:', err);
        setError('Failed to load projects');
      } finally {
        setIsLoading(false);
      }
    };

    loadProjects();
  }, [slug]);

  // Utility functions
  const formatDate = (timestamp: number | string | null) => {
    if (!timestamp) return 'N/A';
    const date = typeof timestamp === 'number'
      ? new Date(timestamp * 1000)
      : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-400 bg-green-400/10 border-green-400/30';
      case 'in_progress':
        return 'text-amber-400 bg-amber-400/10 border-amber-400/30';
      case 'pending':
        return 'text-blue-400 bg-blue-400/10 border-blue-400/30';
      case 'on_hold':
        return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
      default:
        return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'in_progress':
        return <Clock className="w-4 h-4" />;
      default:
        return <Circle className="w-4 h-4" />;
    }
  };

  const parseMilestones = (milestoneJson: string | null): Milestone[] => {
    if (!milestoneJson) return [];
    try {
      return JSON.parse(milestoneJson);
    } catch {
      return [];
    }
  };

  // Filter projects
  const filteredProjects = projects.filter(project => {
    if (filter === 'all') return true;
    if (filter === 'active') return project.status === 'in_progress' || project.status === 'pending';
    if (filter === 'completed') return project.status === 'completed';
    return true;
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Error Loading Projects</h2>
        <p className="text-gray-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Projects</h1>
          <p className="text-gray-400">Track your project progress and milestones</p>
        </div>

        {/* Filter Tabs */}
        <div className="flex bg-gray-800/50 rounded-lg p-1">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-amber-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            All ({projects.length})
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === 'active'
                ? 'bg-amber-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === 'completed'
                ? 'bg-amber-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Completed
          </button>
        </div>
      </div>

      {/* Projects List */}
      {filteredProjects.length === 0 ? (
        <div className="admin-card p-12 text-center">
          <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Projects Found</h3>
          <p className="text-gray-400">
            {filter === 'all'
              ? 'Your projects will appear here once they are created.'
              : `No ${filter} projects at this time.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProjects.map((project) => {
            const isExpanded = expandedProject === project.id;
            const milestones = parseMilestones(project.milestone_json);
            const completedMilestones = milestones.filter(m => m.status === 'completed').length;

            return (
              <div
                key={project.id}
                className="admin-card overflow-hidden"
              >
                {/* Project Header */}
                <button
                  onClick={() => setExpandedProject(isExpanded ? null : project.id)}
                  className="w-full px-6 py-5 text-left hover:bg-gray-800/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-white truncate">{project.name}</h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(project.status)}`}>
                          {getStatusIcon(project.status)}
                          {project.status.replace('_', ' ')}
                        </span>
                      </div>

                      {project.description && (
                        <p className="text-gray-400 text-sm line-clamp-2 mb-3">{project.description}</p>
                      )}

                      {/* Progress Bar */}
                      <div className="flex items-center gap-4">
                        <div className="flex-1 max-w-md">
                          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                              style={{ width: `${project.progress_percentage}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-sm font-medium text-white">{project.progress_percentage}%</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Date Info */}
                      <div className="hidden sm:flex flex-col items-end text-sm">
                        {project.due_date && (
                          <div className="flex items-center gap-1 text-gray-400">
                            <Calendar className="w-3 h-3" />
                            <span>Due {formatDate(project.due_date)}</span>
                          </div>
                        )}
                        {milestones.length > 0 && (
                          <div className="text-gray-500 mt-1">
                            {completedMilestones}/{milestones.length} milestones
                          </div>
                        )}
                      </div>

                      {/* Expand Button */}
                      <div className="text-gray-400">
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </div>
                    </div>
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-gray-700 px-6 py-5 bg-gray-900/30">
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Project Details */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                          Project Details
                        </h4>
                        <dl className="space-y-3">
                          <div className="flex justify-between">
                            <dt className="text-gray-400">Status</dt>
                            <dd className="text-white capitalize">{project.status.replace('_', ' ')}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-400">Progress</dt>
                            <dd className="text-white">{project.progress_percentage}%</dd>
                          </div>
                          {project.start_date && (
                            <div className="flex justify-between">
                              <dt className="text-gray-400">Start Date</dt>
                              <dd className="text-white">{formatDate(project.start_date)}</dd>
                            </div>
                          )}
                          {project.due_date && (
                            <div className="flex justify-between">
                              <dt className="text-gray-400">Due Date</dt>
                              <dd className="text-white">{formatDate(project.due_date)}</dd>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <dt className="text-gray-400">Last Updated</dt>
                            <dd className="text-white">{formatDate(project.updated_at)}</dd>
                          </div>
                        </dl>
                      </div>

                      {/* Milestones */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                          Milestones
                        </h4>
                        {milestones.length === 0 ? (
                          <p className="text-gray-500 text-sm">No milestones defined</p>
                        ) : (
                          <div className="space-y-2">
                            {milestones.map((milestone, index) => (
                              <div
                                key={milestone.id || index}
                                className="flex items-start gap-3 p-3 rounded-lg bg-gray-800/50"
                              >
                                <div className={`mt-0.5 ${
                                  milestone.status === 'completed'
                                    ? 'text-green-400'
                                    : milestone.status === 'in_progress'
                                      ? 'text-amber-400'
                                      : 'text-gray-500'
                                }`}>
                                  {milestone.status === 'completed' ? (
                                    <CheckCircle className="w-5 h-5" />
                                  ) : milestone.status === 'in_progress' ? (
                                    <Clock className="w-5 h-5" />
                                  ) : (
                                    <Circle className="w-5 h-5" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <p className={`text-sm font-medium ${
                                    milestone.status === 'completed'
                                      ? 'text-gray-400 line-through'
                                      : 'text-white'
                                  }`}>
                                    {milestone.title}
                                  </p>
                                  {milestone.description && (
                                    <p className="text-xs text-gray-500 mt-0.5">{milestone.description}</p>
                                  )}
                                  {milestone.due_date && (
                                    <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {milestone.due_date}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Project Actions */}
                    <div className="flex flex-wrap gap-3 mt-6 pt-4 border-t border-gray-700">
                      <button className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors">
                        <MessageSquare className="w-4 h-4" />
                        Message About Project
                      </button>
                      <button className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors">
                        <User className="w-4 h-4" />
                        View Team
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PortalProjects;
