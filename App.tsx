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
        {/* Admin routes (no layout wrapper) */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminDashboard />} />

        {/* Public routes with layout */}
        <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
        <Route path="/about" element={<PublicLayout><About /></PublicLayout>} />
        <Route path="/services" element={<PublicLayout><Services /></PublicLayout>} />
        <Route path="/contact" element={<PublicLayout><Contact /></PublicLayout>} />
        <Route path="/quote" element={<PublicLayout><QuoteTeaser /></PublicLayout>} />
        <Route path="/quote-builder" element={<PublicLayout><QuoteBuilder /></PublicLayout>} />
        <Route path="/menu-builder" element={<PublicLayout><MenuBuilder /></PublicLayout>} />
        <Route path="/schedule" element={<PublicLayout><Schedule /></PublicLayout>} />
        <Route path="/support-plans" element={<PublicLayout><SupportPlans /></PublicLayout>} />
      </Routes>
    </HashRouter>
  );
};

export default App;