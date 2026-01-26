import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, LogOut, UtensilsCrossed, LayoutDashboard,
  Wrench, Settings, Users, Ticket, Mail, Brain, Contact, FileText,
  Building2, Briefcase
} from 'lucide-react';
import { useSEO } from '../src/components/SEO';
import { InvoiceModal } from '../src/components/admin/billing';

// Admin Components
import AdminOverview from '../src/components/admin/AdminOverview';
import ClientList from '../src/components/admin/clients/ClientList';
import ClientForm from '../src/components/admin/clients/ClientForm';
import ClientProfile360 from '../src/components/admin/clients/ClientProfile360';
import RepList from '../src/components/admin/reps/RepList';
import RepForm from '../src/components/admin/reps/RepForm';
import ToolsDemo from '../src/components/admin/tools/ToolsDemo';
import AvailabilityManager from '../src/components/admin/availability/AvailabilityManager';
import ConfigManager from '../src/components/admin/config/ConfigManager';
import PortalManagement from '../src/components/admin/portals/PortalManagement';
import TicketingDashboard from '../src/components/admin/tickets/TicketingDashboard';
import { ClientIntelligenceTab } from '../src/components/admin/intelligence';
import {
  EmailCampaigns,
  EmailSubscribers,
  EmailAnalytics,
  SegmentBuilder,
  ABTestingPanel,
  EnrollmentWizard,
  ErrorRecovery,
  SendTimeOptimizer,
  EmailResponses
} from '../src/components/admin/email';
import { LeadsList } from '../src/components/admin/leads';
import { BusinessBrief } from '../src/components/admin/business-brief';
import { BarChart3, Filter, FlaskConical, UserPlus, AlertTriangle, Clock, TrendingUp, MessageSquare } from 'lucide-react';

type TabType = 'overview' | 'brief' | 'portals' | 'contacts' | 'tickets' | 'email' | 'intelligence' | 'tools' | 'config';
type ClientView = 'list' | 'form' | 'detail' | 'profile360';
type RepView = 'list' | 'form' | 'detail';
type ContactSubTab = 'clients' | 'reps' | 'leads';
type EmailSubTab = 'campaigns' | 'subscribers' | 'segments' | 'analytics' | 'ab-testing' | 'enrollment' | 'errors' | 'schedule' | 'responses';

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
  const [tabLoading, setTabLoading] = useState(false);

  // Tab transition handler
  const handleTabChange = (newTab: TabType) => {
    if (newTab === activeTab) return;
    setTabLoading(true);
    setActiveTab(newTab);
    // Reset sub-views when changing tabs
    if (newTab === 'contacts') {
      setClientView('list');
      setRepView('list');
    }
    // Brief loading state for smooth transition
    setTimeout(() => setTabLoading(false), 150);
  };

  // Client state
  const [clientView, setClientView] = useState<ClientView>('list');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientCount, setClientCount] = useState(0);

  // Rep state
  const [repView, setRepView] = useState<RepView>('list');
  const [selectedRep, setSelectedRep] = useState<Rep | null>(null);
  const [repCount, setRepCount] = useState(0);

  // Email sub-tab state
  const [emailSubTab, setEmailSubTab] = useState<EmailSubTab>('campaigns');

  // Contacts sub-tab state
  const [contactSubTab, setContactSubTab] = useState<ContactSubTab>('clients');

  // Invoice modal state
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceClientId, setInvoiceClientId] = useState<string | undefined>(undefined);

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
    setClientView('profile360');
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

  const handleOpenToastHub = () => {
    window.open('/#/toast-hub?demo=true', '_blank');
  };

  // Invoice handlers
  const handleCreateInvoice = (clientId?: string) => {
    setInvoiceClientId(clientId);
    setInvoiceModalOpen(true);
  };

  const handleInvoiceSuccess = (invoice: any) => {
    console.log('Invoice created:', invoice);
    // Could add toast notification here
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
    { id: 'brief', label: 'Business Brief', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'portals', label: 'Portals', icon: <Users className="w-4 h-4" /> },
    { id: 'contacts', label: 'Contacts', icon: <Contact className="w-4 h-4" /> },
    { id: 'tickets', label: 'Tickets', icon: <Ticket className="w-4 h-4" /> },
    { id: 'email', label: 'Email', icon: <Mail className="w-4 h-4" /> },
    { id: 'intelligence', label: 'Intel', icon: <Brain className="w-4 h-4" /> },
    { id: 'tools', label: 'Tools', icon: <Wrench className="w-4 h-4" /> },
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
                onClick={() => handleTabChange(tab.id)}
                disabled={tabLoading}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all whitespace-nowrap min-h-[44px] ${
                  activeTab === tab.id
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                } ${tabLoading ? 'opacity-70 cursor-wait' : ''}`}
                aria-current={activeTab === tab.id ? 'page' : undefined}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className={`max-w-6xl mx-auto px-4 py-6 space-y-6 transition-opacity duration-150 ${tabLoading ? 'opacity-50' : 'opacity-100'}`}>
        {/* Tab Loading Indicator */}
        {tabLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
          </div>
        )}

        {/* Overview Tab */}
        {!tabLoading && activeTab === 'overview' && (
          <AdminOverview
            availability={availability}
            clientCount={clientCount}
            repCount={repCount}
            onNavigateToTab={(tab) => handleTabChange(tab as TabType)}
            formatTimeAgo={formatTimeAgo}
          />
        )}

        {/* Business Brief Tab */}
        {!tabLoading && activeTab === 'brief' && (
          <BusinessBrief />
        )}

        {/* Portals Tab */}
        {!tabLoading && activeTab === 'portals' && (
          <PortalManagement />
        )}

        {/* Contacts Tab */}
        {!tabLoading && activeTab === 'contacts' && (
          <>
            {/* Contacts Sub-tabs */}
            <div className="flex gap-2 mb-6 border-b border-gray-700 pb-2 overflow-x-auto">
              <button
                onClick={() => {
                  setContactSubTab('clients');
                  setClientView('list');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors whitespace-nowrap ${
                  contactSubTab === 'clients'
                    ? 'bg-purple-500/20 text-purple-400 border-b-2 border-purple-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Building2 className="w-4 h-4" />
                Clients
                {clientCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded">
                    {clientCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  setContactSubTab('reps');
                  setRepView('list');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors whitespace-nowrap ${
                  contactSubTab === 'reps'
                    ? 'bg-cyan-500/20 text-cyan-400 border-b-2 border-cyan-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Briefcase className="w-4 h-4" />
                Reps
                {repCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 text-xs rounded">
                    {repCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setContactSubTab('leads')}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors whitespace-nowrap ${
                  contactSubTab === 'leads'
                    ? 'bg-amber-500/20 text-amber-400 border-b-2 border-amber-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                Leads
              </button>
            </div>

            {/* Clients Sub-tab Content */}
            {contactSubTab === 'clients' && (
              <>
                {clientView === 'list' && (
                  <ClientList
                    onSelectClient={handleSelectClient}
                    onCreateClient={handleCreateClient}
                    onCreateInvoice={handleCreateInvoice}
                  />
                )}
                {clientView === 'profile360' && selectedClient?.id && (
                  <ClientProfile360
                    clientId={selectedClient.id}
                    onBack={() => {
                      setClientView('list');
                      setSelectedClient(null);
                    }}
                    onEditClient={(client) => {
                      setSelectedClient(client);
                      setClientView('form');
                    }}
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

            {/* Reps Sub-tab Content */}
            {contactSubTab === 'reps' && (
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

            {/* Leads Sub-tab Content */}
            {contactSubTab === 'leads' && (
              <LeadsList />
            )}
          </>
        )}

        {/* Tickets Tab */}
        {!tabLoading && activeTab === 'tickets' && (
          <TicketingDashboard />
        )}

        {/* Email Tab */}
        {!tabLoading && activeTab === 'email' && (
          <>
            {/* Email Sub-tabs */}
            <div className="flex gap-2 mb-6 border-b border-gray-700 pb-2 overflow-x-auto">
              <button
                onClick={() => setEmailSubTab('campaigns')}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors whitespace-nowrap ${
                  emailSubTab === 'campaigns'
                    ? 'bg-gray-800 text-amber-400 border-b-2 border-amber-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Mail className="w-4 h-4" />
                Campaigns
              </button>
              <button
                onClick={() => setEmailSubTab('subscribers')}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors whitespace-nowrap ${
                  emailSubTab === 'subscribers'
                    ? 'bg-gray-800 text-amber-400 border-b-2 border-amber-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                Subscribers
              </button>
              <button
                onClick={() => setEmailSubTab('segments')}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors whitespace-nowrap ${
                  emailSubTab === 'segments'
                    ? 'bg-gray-800 text-amber-400 border-b-2 border-amber-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Filter className="w-4 h-4" />
                Segments
              </button>
              <button
                onClick={() => setEmailSubTab('analytics')}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors whitespace-nowrap ${
                  emailSubTab === 'analytics'
                    ? 'bg-gray-800 text-amber-400 border-b-2 border-amber-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Analytics
              </button>
              <button
                onClick={() => setEmailSubTab('ab-testing')}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors whitespace-nowrap ${
                  emailSubTab === 'ab-testing'
                    ? 'bg-gray-800 text-amber-400 border-b-2 border-amber-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <FlaskConical className="w-4 h-4" />
                A/B Tests
              </button>
              <button
                onClick={() => setEmailSubTab('enrollment')}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors whitespace-nowrap ${
                  emailSubTab === 'enrollment'
                    ? 'bg-gray-800 text-amber-400 border-b-2 border-amber-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                Enrollment
              </button>
              <button
                onClick={() => setEmailSubTab('errors')}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors whitespace-nowrap ${
                  emailSubTab === 'errors'
                    ? 'bg-gray-800 text-amber-400 border-b-2 border-amber-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                Errors
              </button>
              <button
                onClick={() => setEmailSubTab('schedule')}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors whitespace-nowrap ${
                  emailSubTab === 'schedule'
                    ? 'bg-gray-800 text-amber-400 border-b-2 border-amber-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Clock className="w-4 h-4" />
                Schedule
              </button>
              <button
                onClick={() => setEmailSubTab('responses')}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors whitespace-nowrap ${
                  emailSubTab === 'responses'
                    ? 'bg-gray-800 text-amber-400 border-b-2 border-amber-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                Responses
              </button>
            </div>

            {emailSubTab === 'campaigns' && <EmailCampaigns />}
            {emailSubTab === 'subscribers' && <EmailSubscribers />}
            {emailSubTab === 'segments' && <SegmentBuilder />}
            {emailSubTab === 'analytics' && <EmailAnalytics />}
            {emailSubTab === 'ab-testing' && <ABTestingPanel />}
            {emailSubTab === 'enrollment' && <EnrollmentWizard />}
            {emailSubTab === 'errors' && <ErrorRecovery />}
            {emailSubTab === 'schedule' && <SendTimeOptimizer />}
            {emailSubTab === 'responses' && <EmailResponses />}
          </>
        )}

        {/* Intelligence Tab */}
        {!tabLoading && activeTab === 'intelligence' && (
          <ClientIntelligenceTab />
        )}

        {/* Tools Tab */}
        {!tabLoading && activeTab === 'tools' && (
          <ToolsDemo
            onOpenQuoteBuilder={handleOpenQuoteBuilder}
            onOpenMenuBuilder={handleOpenMenuBuilder}
            onOpenToastAutomate={handleOpenToastAutomate}
            onOpenToastHub={handleOpenToastHub}
            onOpenClientPortalDemo={handleOpenClientPortalDemo}
            onOpenRepPortalDemo={handleOpenRepPortalDemo}
          />
        )}


        {/* Config Tab */}
        {!tabLoading && activeTab === 'config' && (
          <ConfigManager />
        )}

        {/* Footer */}
        <footer className="text-center text-gray-500 text-sm py-4">
          <p>Cape Cod Restaurant Consulting Admin v2.0</p>
        </footer>
      </main>

      {/* Invoice Modal */}
      <InvoiceModal
        isOpen={invoiceModalOpen}
        onClose={() => {
          setInvoiceModalOpen(false);
          setInvoiceClientId(undefined);
        }}
        preselectedClientId={invoiceClientId}
        onSuccess={handleInvoiceSuccess}
      />
    </div>
  );
};

export default AdminDashboard;
