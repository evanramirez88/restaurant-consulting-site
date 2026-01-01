import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import About from './pages/About';
import Services from './pages/Services';
import Contact from './pages/Contact';
import QuoteTeaser from './pages/QuoteTeaser';
import QuoteBuilder from './pages/QuoteBuilder';
import MenuBuilder from './pages/MenuBuilder';
import Schedule from './pages/Schedule';
import SupportPlans from './pages/SupportPlans';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import ClientPortal from './pages/ClientPortal';
import ClientLogin from './pages/ClientLogin';
import ClientDashboard from './pages/ClientDashboard';
import ProtectedRoute from './src/components/ProtectedRoute';
import ClientProtectedRoute from './src/components/ClientProtectedRoute';
import RepProtectedRoute from './src/components/RepProtectedRoute';

// Slug-based Client Portal Components
import PortalLayout from './pages/portal/PortalLayout';
import PortalLanding from './pages/portal/PortalLanding';
import PortalLogin from './pages/portal/PortalLogin';
import PortalDashboard from './pages/portal/PortalDashboard';
import PortalProjects from './pages/portal/PortalProjects';
import PortalFiles from './pages/portal/PortalFiles';
import PortalMessages from './pages/portal/PortalMessages';
import PortalBilling from './pages/portal/PortalBilling';

// Slug-based Rep Portal Components
import RepLogin from './pages/rep/RepLogin';
import RepDashboard from './pages/rep/RepDashboard';
import RepClients from './pages/rep/RepClients';
import RepReferrals from './pages/rep/RepReferrals';
import RepMessages from './pages/rep/RepMessages';

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

const App: React.FC = () => {
  return (
    <HashRouter>
      <ScrollToTop />
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
          <PortalLayout>
            <PortalDashboard />
          </PortalLayout>
        } />
        <Route path="/portal/:slug/projects" element={
          <PortalLayout>
            <PortalProjects />
          </PortalLayout>
        } />
        <Route path="/portal/:slug/files" element={
          <PortalLayout>
            <PortalFiles />
          </PortalLayout>
        } />
        <Route path="/portal/:slug/messages" element={
          <PortalLayout>
            <PortalMessages />
          </PortalLayout>
        } />
        <Route path="/portal/:slug/billing" element={
          <PortalLayout>
            <PortalBilling />
          </PortalLayout>
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
        <Route path="/support-plans" element={<PublicLayout><SupportPlans /></PublicLayout>} />
        <Route path="/contact" element={<PublicLayout><Contact /></PublicLayout>} />
        <Route path="/quote" element={<PublicLayout><QuoteTeaser /></PublicLayout>} />
        <Route path="/quote-builder" element={<PublicLayout><QuoteBuilder /></PublicLayout>} />
        <Route path="/menu-builder" element={<PublicLayout><MenuBuilder /></PublicLayout>} />
        <Route path="/schedule" element={<PublicLayout><Schedule /></PublicLayout>} />
      </Routes>
    </HashRouter>
  );
};

export default App;