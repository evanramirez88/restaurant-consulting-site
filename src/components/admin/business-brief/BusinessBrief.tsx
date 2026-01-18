import React, { useState } from 'react';
import {
  LayoutDashboard, Activity, Target, Brain, FileBarChart, MessageSquare,
  TrendingUp
} from 'lucide-react';
import BusinessBriefDashboard from './BusinessBriefDashboard';
import BusinessBriefPulse from './BusinessBriefPulse';

type SubTabType = 'dashboard' | 'pulse' | 'strategy' | 'intelligence' | 'reports' | 'ai';

interface SubTab {
  id: SubTabType;
  label: string;
  icon: React.ReactNode;
  available: boolean;
  description?: string;
}

export default function BusinessBrief() {
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>('dashboard');

  const subTabs: SubTab[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
      available: true,
      description: 'Executive summary & daily brief'
    },
    {
      id: 'pulse',
      label: 'Pulse',
      icon: <Activity className="w-4 h-4" />,
      available: true,
      description: 'Real-time business health'
    },
    {
      id: 'strategy',
      label: 'Strategy',
      icon: <Target className="w-4 h-4" />,
      available: false,
      description: 'Goals & planning (Coming Soon)'
    },
    {
      id: 'intelligence',
      label: 'Intelligence',
      icon: <Brain className="w-4 h-4" />,
      available: false,
      description: 'Deep analysis (Coming Soon)'
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: <FileBarChart className="w-4 h-4" />,
      available: false,
      description: 'Generated reports (Coming Soon)'
    },
    {
      id: 'ai',
      label: 'AI Console',
      icon: <MessageSquare className="w-4 h-4" />,
      available: false,
      description: 'Claude integration (Coming Soon)'
    }
  ];

  return (
    <div className="space-y-4">
      {/* Sub-Tab Navigation */}
      <div className="admin-card p-2">
        <div className="flex flex-wrap gap-1">
          {subTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => tab.available && setActiveSubTab(tab.id)}
              disabled={!tab.available}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
                transition-all duration-200
                ${activeSubTab === tab.id
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                  : tab.available
                    ? 'text-gray-400 hover:text-white hover:bg-gray-800'
                    : 'text-gray-600 cursor-not-allowed'
                }
              `}
              title={tab.description}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              {!tab.available && (
                <span className="hidden lg:inline text-xs text-gray-600 ml-1">(Soon)</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-Tab Content */}
      <div>
        {activeSubTab === 'dashboard' && <BusinessBriefDashboard />}
        {activeSubTab === 'pulse' && <BusinessBriefPulse />}

        {/* Coming Soon placeholders */}
        {activeSubTab === 'strategy' && (
          <ComingSoonPlaceholder
            title="Strategy"
            description="Goal tracking, support plan mix visualization, Lane A/B strategy dashboards, and scenario planning."
            icon={<Target className="w-12 h-12" />}
          />
        )}
        {activeSubTab === 'intelligence' && (
          <ComingSoonPlaceholder
            title="Intelligence"
            description="Lead intelligence, client health scoring, Core 4 agent feed, and Beacon content insights."
            icon={<Brain className="w-12 h-12" />}
          />
        )}
        {activeSubTab === 'reports' && (
          <ComingSoonPlaceholder
            title="Reports"
            description="Pre-built and custom reports with automated scheduling and delivery options."
            icon={<FileBarChart className="w-12 h-12" />}
          />
        )}
        {activeSubTab === 'ai' && (
          <ComingSoonPlaceholder
            title="AI Console"
            description="Direct interaction with Claude for business analysis, insights, and assistance."
            icon={<MessageSquare className="w-12 h-12" />}
          />
        )}
      </div>
    </div>
  );
}

interface ComingSoonProps {
  title: string;
  description: string;
  icon: React.ReactNode;
}

function ComingSoonPlaceholder({ title, description, icon }: ComingSoonProps) {
  return (
    <div className="admin-card p-12 text-center">
      <div className="text-gray-600 mb-4 flex justify-center">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400 max-w-md mx-auto mb-6">{description}</p>
      <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-400 rounded-lg">
        <TrendingUp className="w-4 h-4" />
        <span>Phase 3-5 Implementation</span>
      </div>
    </div>
  );
}
