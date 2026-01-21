import React, { Suspense, lazy, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home'; // Keep Home eager for fast initial load

// Lazy load all other pages for code splitting
const About = lazy(() => import('./pages/About'));
const Services = lazy(() => import('./pages/Services'));
const QuoteTeaser = lazy(() => import('./pages/QuoteTeaser'));
const QuoteBuilder = lazy(() => import('./pages/QuoteBuilder'));
const MenuBuilder = lazy(() => import('./pages/MenuBuilder'));
const ToastAutomate = lazy(() => import('./pages/ToastAutomate'));
const Schedule = lazy(() => import('./pages/Schedule'));
const LocalNetworking = lazy(() => import('./pages/LocalNetworking'));
const ToastHub = lazy(() => import('./pages/ToastHub'));
const ToastHubPost = lazy(() => import('./pages/ToastHubPost'));
const Legal = lazy(() => import('./pages/Legal'));

// Admin pages (lazy - only loaded when visiting admin routes)
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

// Legacy Client Portal (lazy)
const ClientPortal = lazy(() => import('./pages/ClientPortal'));
const ClientLogin = lazy(() => import('./pages/ClientLogin'));
const ClientDashboard = lazy(() => import('./pages/ClientDashboard'));

// Slug-based Client Portal Components (lazy)
const PortalLayout = lazy(() => import('./pages/portal/PortalLayout'));
const PortalLanding = lazy(() => import('./pages/portal/PortalLanding'));
const PortalLogin = lazy(() => import('./pages/portal/PortalLogin'));
const PortalDashboard = lazy(() => import('./pages/portal/PortalDashboard'));
const PortalProjects = lazy(() => import('./pages/portal/PortalProjects'));
const PortalTickets = lazy(() => import('./pages/portal/PortalTickets'));
const PortalNotifications = lazy(() => import('./pages/portal/PortalNotifications'));
const PortalFiles = lazy(() => import('./pages/portal/PortalFiles'));
const PortalMessages = lazy(() => import('./pages/portal/PortalMessages'));
const PortalBilling = lazy(() => import('./pages/portal/PortalBilling'));

// Slug-based Rep Portal Components (lazy)
const RepLogin = lazy(() => import('./pages/rep/RepLogin'));
const RepDashboard = lazy(() => import('./pages/rep/RepDashboard'));
const RepClients = lazy(() => import('./pages/rep/RepClients'));
const RepClientDetail = lazy(() => import('./pages/rep/RepClientDetail'));
const RepLeads = lazy(() => import('./pages/rep/RepLeads'));
const RepQuotes = lazy(() => import('./pages/rep/RepQuotes'));
const RepQuoteBuilder = lazy(() => import('./pages/rep/RepQuoteBuilder'));
const RepMenuBuilder = lazy(() => import('./pages/rep/RepMenuBuilder'));
const RepTickets = lazy(() => import('./pages/rep/RepTickets'));
const RepIntelSubmission = lazy(() => import('./pages/rep/RepIntelSubmission'));
const RepReferrals = lazy(() => import('./pages/rep/RepReferrals'));
const RepMessages = lazy(() => import('./pages/rep/RepMessages'));

// Protected route components (eager - small)
import ProtectedRoute from './src/components/ProtectedRoute';
import ClientProtectedRoute from './src/components/ClientProtectedRoute';
import RepProtectedRoute from './src/components/RepProtectedRoute';

// Loading spinner for lazy components
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-white">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-600 font-medium">Loading...</p>
    </div>
  </div>
);

// Manual ScrollRestoration component for HashRouter
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

// Layout wrapper for public pages
const PublicLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Layout>{children}</Layout>
);

// Portal layout wrapper with suspense
const PortalLayoutWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<PageLoader />}>
    <PortalLayout>{children}</PortalLayout>
  </Suspense>
);

const App: React.FC = () => {
  return (
    <HashRouter>
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Admin routes (protected) */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={
            <ProtectedRoute redirectTo="/admin/login">
              <AdminDashboard />
            </ProtectedRoute>
          } />

          {/* Legacy Client Portal routes (keep for backwards compatibility) */}
          <Route path="/portal" element={<PublicLayout><ClientPortal /></PublicLayout>} />
          <Route path="/portal/login" element={<ClientLogin />} />
          <Route path="/portal/dashboard" element={
            <ClientProtectedRoute redirectTo="/portal/login">
              <ClientDashboard />
            </ClientProtectedRoute>
          } />

          {/* Slug-based Client Portal routes */}
          <Route path="/portal/:slug" element={<PortalLanding />} />
          <Route path="/portal/:slug/login" element={<PortalLogin />} />
          <Route path="/portal/:slug/dashboard" element={
            <PortalLayoutWrapper>
              <PortalDashboard />
            </PortalLayoutWrapper>
          } />
          <Route path="/portal/:slug/projects" element={
            <PortalLayoutWrapper>
              <PortalProjects />
            </PortalLayoutWrapper>
          } />
          <Route path="/portal/:slug/tickets" element={
            <PortalLayoutWrapper>
              <PortalTickets />
            </PortalLayoutWrapper>
          } />
          <Route path="/portal/:slug/notifications" element={
            <PortalLayoutWrapper>
              <PortalNotifications />
            </PortalLayoutWrapper>
          } />
          <Route path="/portal/:slug/files" element={
            <PortalLayoutWrapper>
              <PortalFiles />
            </PortalLayoutWrapper>
          } />
          <Route path="/portal/:slug/messages" element={
            <PortalLayoutWrapper>
              <PortalMessages />
            </PortalLayoutWrapper>
          } />
          <Route path="/portal/:slug/billing" element={
            <PortalLayoutWrapper>
              <PortalBilling />
            </PortalLayoutWrapper>
          } />

          {/* Slug-based Rep Portal routes */}
          <Route path="/rep/:slug" element={<RepLogin />} />
          <Route path="/rep/:slug/login" element={<RepLogin />} />
          <Route path="/rep/:slug/dashboard" element={
            <RepProtectedRoute>
              <RepDashboard />
            </RepProtectedRoute>
          } />
          <Route path="/rep/:slug/clients" element={
            <RepProtectedRoute>
              <RepClients />
            </RepProtectedRoute>
          } />
          <Route path="/rep/:slug/clients/:clientId" element={
            <RepProtectedRoute>
              <RepClientDetail />
            </RepProtectedRoute>
          } />
          <Route path="/rep/:slug/clients/:clientId/quote" element={
            <RepProtectedRoute>
              <RepQuoteBuilder />
            </RepProtectedRoute>
          } />
          <Route path="/rep/:slug/clients/:clientId/menu" element={
            <RepProtectedRoute>
              <RepMenuBuilder />
            </RepProtectedRoute>
          } />
          <Route path="/rep/:slug/leads" element={
            <RepProtectedRoute>
              <RepLeads />
            </RepProtectedRoute>
          } />
          <Route path="/rep/:slug/quotes" element={
            <RepProtectedRoute>
              <RepQuotes />
            </RepProtectedRoute>
          } />
          <Route path="/rep/:slug/tickets" element={
            <RepProtectedRoute>
              <RepTickets />
            </RepProtectedRoute>
          } />
          <Route path="/rep/:slug/intel" element={
            <RepProtectedRoute>
              <RepIntelSubmission />
            </RepProtectedRoute>
          } />
          <Route path="/rep/:slug/referrals" element={
            <RepProtectedRoute>
              <RepReferrals />
            </RepProtectedRoute>
          } />
          <Route path="/rep/:slug/messages" element={
            <RepProtectedRoute>
              <RepMessages />
            </RepProtectedRoute>
          } />

          {/* Public routes with layout */}
          <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
          <Route path="/about" element={<PublicLayout><About /></PublicLayout>} />
          <Route path="/services" element={<PublicLayout><Services /></PublicLayout>} />
          <Route path="/quote" element={<PublicLayout><QuoteTeaser /></PublicLayout>} />
          <Route path="/quote-builder" element={<QuoteBuilder />} />
          <Route path="/menu-builder" element={<PublicLayout><MenuBuilder /></PublicLayout>} />
          <Route path="/toast-automate" element={<PublicLayout><ToastAutomate /></PublicLayout>} />
          <Route path="/schedule" element={<PublicLayout><Schedule /></PublicLayout>} />
          <Route path="/local-networking" element={<PublicLayout><LocalNetworking /></PublicLayout>} />
          <Route path="/toast-hub" element={<PublicLayout><ToastHub /></PublicLayout>} />
          <Route path="/toast-hub/:slug" element={<PublicLayout><ToastHubPost /></PublicLayout>} />
          <Route path="/legal" element={<PublicLayout><Legal /></PublicLayout>} />
          <Route path="/terms" element={<Navigate to="/legal#terms" replace />} />
          <Route path="/privacy" element={<Navigate to="/legal#privacy" replace />} />

          {/* Redirects for merged pages */}
          <Route path="/support-plans" element={<Navigate to="/services" replace />} />
          <Route path="/contact" element={<Navigate to="/about#contact" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
};

export default App;
