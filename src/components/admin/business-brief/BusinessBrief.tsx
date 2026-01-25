import React, { useState } from 'react';
import {
  LayoutDashboard, Activity, Target, Brain, FileBarChart, MessageSquare, Database, TrendingUp
} from 'lucide-react';
import BusinessBriefDashboard from './BusinessBriefDashboard';
import BusinessBriefPulse from './BusinessBriefPulse';
import BusinessBriefStrategy from './BusinessBriefStrategy';
import BusinessBriefIntelligence from './BusinessBriefIntelligence';
import BusinessBriefReports from './BusinessBriefReports';
import BusinessBriefAIConsole from './ai-console';
import BusinessBriefDataContext from './BusinessBriefDataContext';
import BusinessBriefMetrics from './BusinessBriefMetrics';

type SubTabType = 'dashboard' | 'pulse' | 'strategy' | 'intelligence' | 'metrics' | 'reports' | 'ai' | 'data-context';

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
      available: true,
      description: 'Goals, planning & scenarios'
    },
    {
      id: 'intelligence',
      label: 'Intelligence',
      icon: <Brain className="w-4 h-4" />,
      available: true,
      description: 'Deep analysis & insights'
    },
    {
      id: 'metrics',
      label: 'Metrics',
      icon: <TrendingUp className="w-4 h-4" />,
      available: true,
      description: 'Business metrics trending & snapshots'
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: <FileBarChart className="w-4 h-4" />,
      available: true,
      description: 'Generate and schedule business reports'
    },
    {
      id: 'ai',
      label: 'AI Console',
      icon: <MessageSquare className="w-4 h-4" />,
      available: true,
      description: 'AI-powered business insights and analysis'
    },
    {
      id: 'data-context',
      label: 'Data Context',
      icon: <Database className="w-4 h-4" />,
      available: true,
      description: 'Google Calendar, Drive & Gmail sync data'
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
        {activeSubTab === 'strategy' && <BusinessBriefStrategy />}
        {activeSubTab === 'intelligence' && <BusinessBriefIntelligence />}
        {activeSubTab === 'metrics' && <BusinessBriefMetrics />}
        {activeSubTab === 'reports' && <BusinessBriefReports />}
        {activeSubTab === 'ai' && <BusinessBriefAIConsole />}
        {activeSubTab === 'data-context' && <BusinessBriefDataContext />}
      </div>
    </div>
  );
}
