import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, LogOut, UtensilsCrossed, LayoutDashboard, Building2, Briefcase,
  Wrench, FileText, Calendar, Settings, Users, Ticket, Mail
} from 'lucide-react';
import { useSEO } from '../src/components/SEO';

// Admin Components
import AdminOverview from '../src/components/admin/AdminOverview';
import ClientList from '../src/components/admin/clients/ClientList';
import ClientForm from '../src/components/admin/clients/ClientForm';
import RepList from '../src/components/admin/reps/RepList';
import RepForm from '../src/components/admin/reps/RepForm';
import ToolsDemo from '../src/components/admin/tools/ToolsDemo';
import ToastHubManager from '../src/components/admin/toasthub/ToastHubManager';
import AvailabilityManager from '../src/components/admin/availability/AvailabilityManager';
import ConfigManager from '../src/components/admin/config/ConfigManager';
import PortalManagement from '../src/components/admin/portals/PortalManagement';
import TicketingDashboard from '../src/components/admin/tickets/TicketingDashboard';
import { EmailCampaigns, EmailSubscribers } from '../src/components/admin/email';

type TabType = 'overview' | 'portals' | 'clients' | 'reps' | 'tickets' | 'email' | 'tools' | 'toasthub' | 'availability' | 'config';
type ClientView = 'list' | 'form' | 'detail';
type RepView = 'list' | 'form' | 'detail';

interface Client {
  id?: string;
  email: string;
  name: string;
  company: string;
  slug: string | null;
  phone?: string;
  portal_enabled: boolean;
  support_plan_tier: string | null;
  support_plan_status: string | null;
  google_drive_folder_id: string | null;
  avatar_url: string | null;
  notes: string | null;
  timezone?: string;
}

interface Rep {
  id?: string;
  email: string;
  name: string;
  territory: string | null;
  slug: string | null;
  phone?: string;
  portal_enabled: boolean;
  status: 'active' | 'inactive' | 'pending';
  avatar_url: string | null;
  notes: string | null;
}


const AdminDashboard: React.FC = () => {
  useSEO({
    title: 'Admin Dashboard | Cape Cod Restaurant Consulting',
    description: 'Manage clients, reps, availability and site settings.',
  });

  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Client state
  const [clientView, setClientView] = useState<ClientView>('list');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientCount, setClientCount] = useState(0);

  // Rep state
  const [repView, setRepView] = useState<RepView>('list');
  const [selectedRep, setSelectedRep] = useState<Rep | null>(null);
  const [repCount, setRepCount] = useState(0);

  // Availability state (for overview)
  const [availability, setAvailability] = useState({
    status: 'offline' as const,
    locationType: 'remote' as const,
    town: null as string | null
  });

  // Check authentication
  useEffect(() => {
    const init = async () => {
      try {
        const authResponse = await fetch('/api/auth/verify');
        const authData = await authResponse.json();

        if (!authData.authenticated) {
          navigate('/admin/login');
          return;
        }

        setIsAuthenticated(true);
        await loadInitialData();
      } catch (error) {
        console.error('Init error:', error);
        navigate('/admin/login');
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [navigate]);

  const loadInitialData = async () => {
    try {
      // Load availability for overview
      const availResponse = await fetch('/api/availability');
      const availResult = await availResponse.json();
      if (availResult.success && availResult.data) {
        setAvailability({
          status: availResult.data.status,
          locationType: availResult.data.locationType,
          town: availResult.data.town
        });
      }

      // Load counts for overview
      const [clientsRes, repsRes] = await Promise.all([
        fetch('/api/admin/clients'),
        fetch('/api/admin/reps')
      ]);

      const clientsData = await clientsRes.json();
      const repsData = await repsRes.json();

      if (clientsData.success) setClientCount(clientsData.data?.length || 0);
      if (repsData.success) setRepCount(repsData.data?.length || 0);
    } catch (error) {
      console.error('Load initial data error:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      navigate('/admin/login');
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/admin/login');
    }
  };

  const formatTimeAgo = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  };

  // Client handlers
  const handleSelectClient = (client: any) => {
    setSelectedClient(client);
    setClientView('form');
  };

  const handleCreateClient = () => {
    setSelectedClient(null);
    setClientView('form');
  };

  const handleSaveClient = async (client: Client) => {
    const isNew = !client.id;
    const response = await fetch(
      isNew ? '/api/admin/clients' : `/api/admin/clients/${client.id}`,
      {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(client)
      }
    );

    const result = await response.json();
    if (result.success) {
      setClientView('list');
      setSelectedClient(null);
      loadInitialData();
    } else {
      throw new Error(result.error || 'Failed to save client');
    }
  };

  // Rep handlers
  const handleSelectRep = (rep: any) => {
    setSelectedRep(rep);
    setRepView('form');
  };

  const handleCreateRep = () => {
    setSelectedRep(null);
    setRepView('form');
  };

  const handleSaveRep = async (rep: Rep) => {
    const isNew = !rep.id;
    const response = await fetch(
      isNew ? '/api/admin/reps' : `/api/admin/reps/${rep.id}`,
      {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rep)
      }
    );

    const result = await response.json();
    if (result.success) {
      setRepView('list');
      setSelectedRep(null);
      loadInitialData();
    } else {
      throw new Error(result.error || 'Failed to save rep');
    }
  };

  // Tool demo handlers
  const handleOpenQuoteBuilder = () => {
    window.open('/#/quote-builder?demo=true', '_blank');
  };

  const handleOpenMenuBuilder = () => {
    window.open('/#/menu-builder?demo=true', '_blank');
  };

  const handleOpenToastAutomate = () => {
    window.open('/#/toast-automate?demo=true', '_blank');
  };

  const handleOpenClientPortalDemo = () => {
    window.open('/#/portal/demo-seafood-shack/dashboard?demo=true', '_blank');
  };

  const handleOpenRepPortalDemo = () => {
    window.open('/#/rep/demo-rep/dashboard?demo=true', '_blank');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-dark to-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'portals', label: 'Portals', icon: <Users className="w-4 h-4" /> },
    { id: 'clients', label: 'Clients', icon: <Building2 className="w-4 h-4" /> },
    { id: 'reps', label: 'Reps', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'tickets', label: 'Tickets', icon: <Ticket className="w-4 h-4" /> },
    { id: 'email', label: 'Email', icon: <Mail className="w-4 h-4" /> },
    { id: 'tools', label: 'Tools', icon: <Wrench className="w-4 h-4" /> },
    { id: 'toasthub', label: 'Toast Hub', icon: <FileText className="w-4 h-4" /> },
    { id: 'availability', label: 'Availability', icon: <Calendar className="w-4 h-4" /> },
    { id: 'config', label: 'Config', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-dark to-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center border border-gray-700">
              <UtensilsCrossed className="w-5 h-5 text-amber-400" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-display font-bold text-white text-lg">Admin Dashboard</h1>
              <p className="text-xs text-gray-400">R&G Consulting</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors min-h-[44px]"
            aria-label="Logout"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="bg-gray-900/80 border-b border-gray-800 overflow-x-auto admin-scrollbar" aria-label="Admin navigation">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1 py-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  // Reset sub-views when changing tabs
                  if (tab.id === 'clients') setClientView('list');
                  if (tab.id === 'reps') setRepView('list');
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all whitespace-nowrap min-h-[44px] ${
                  activeTab === tab.id
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
                aria-current={activeTab === tab.id ? 'page' : undefined}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <AdminOverview
            availability={availability}
            clientCount={clientCount}
            repCount={repCount}
            onNavigateToTab={(tab) => setActiveTab(tab as TabType)}
            formatTimeAgo={formatTimeAgo}
          />
        )}

        {/* Portals Tab */}
        {activeTab === 'portals' && (
          <PortalManagement />
        )}

        {/* Clients Tab */}
        {activeTab === 'clients' && (
          <>
            {clientView === 'list' && (
              <ClientList
                onSelectClient={handleSelectClient}
                onCreateClient={handleCreateClient}
              />
            )}
            {clientView === 'form' && (
              <ClientForm
                client={selectedClient}
                onSave={handleSaveClient}
                onCancel={() => {
                  setClientView('list');
                  setSelectedClient(null);
                }}
              />
            )}
          </>
        )}

        {/* Reps Tab */}
        {activeTab === 'reps' && (
          <>
            {repView === 'list' && (
              <RepList
                onSelectRep={handleSelectRep}
                onCreateRep={handleCreateRep}
              />
            )}
            {repView === 'form' && (
              <RepForm
                rep={selectedRep}
                onSave={handleSaveRep}
                onCancel={() => {
                  setRepView('list');
                  setSelectedRep(null);
                }}
              />
            )}
          </>
        )}

        {/* Tickets Tab */}
        {activeTab === 'tickets' && (
          <TicketingDashboard />
        )}

        {/* Email Campaigns Tab */}
        {activeTab === 'email' && (
          <EmailCampaigns />
        )}

        {/* Tools Tab */}
        {activeTab === 'tools' && (
          <ToolsDemo
            onOpenQuoteBuilder={handleOpenQuoteBuilder}
            onOpenMenuBuilder={handleOpenMenuBuilder}
            onOpenToastAutomate={handleOpenToastAutomate}
            onOpenClientPortalDemo={handleOpenClientPortalDemo}
            onOpenRepPortalDemo={handleOpenRepPortalDemo}
          />
        )}

        {/* Toast Hub Tab */}
        {activeTab === 'toasthub' && (
          <ToastHubManager />
        )}

        {/* Availability Tab */}
        {activeTab === 'availability' && (
          <AvailabilityManager />
        )}

        {/* Config Tab */}
        {activeTab === 'config' && (
          <ConfigManager />
        )}

        {/* Footer */}
        <footer className="text-center text-gray-500 text-sm py-4">
          <p>Cape Cod Restaurant Consulting Admin v2.0</p>
        </footer>
      </main>
    </div>
  );
};

export default AdminDashboard;
