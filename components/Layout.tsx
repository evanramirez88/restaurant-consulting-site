import React, { useState, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X, Phone, UtensilsCrossed } from 'lucide-react';
import { NAVIGATION, COMPANY_NAME, PHONE_NUMBER, EMAIL_ADDRESS } from '../constants';
import { initScrollAnimations } from '../src/hooks/useScrollAnimation';
import AvailabilityIndicator from '../src/components/AvailabilityIndicator';

interface LayoutProps {
  children: React.ReactNode;
}

// Navigation items for the main nav - ORDERED for user flow
// Note: Support Plans merged into Services, Contact merged into About
const NAV_ITEMS = [
  { name: 'Home', path: '/' },
  { name: 'Services & Support Plans', path: '/services' },
  { name: 'Toast Hub', path: '/toast-hub' },
  { name: 'Menu Builder', path: '/menu-builder' },
  { name: 'Quote Builder', path: '/quote' },
  { name: 'About & Contact', path: '/about' },
];

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();

  // Detect scroll for nav background transition
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  // Initialize scroll-triggered animations on route change
  useEffect(() => {
    // Small delay to ensure DOM is ready after route change
    const timeoutId = setTimeout(() => {
      initScrollAnimations();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-800 font-sans">
      {/* ===== TOP UTILITY BAR ===== */}
      <div className="bg-primary-dark py-2 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          {/* Left side */}
          <span className="text-sm text-gray-400 hidden sm:block">
            Serving Cape Cod &amp; New England
          </span>

          {/* Right side */}
          <div className="flex items-center gap-3 text-sm ml-auto sm:ml-0">
            <span className="text-amber-400 hidden md:inline">Toast Support Available</span>
            <span className="text-gray-500 hidden md:inline">•</span>
            <a href={`tel:${PHONE_NUMBER}`} className="text-white hover:text-amber-400 transition-colors flex items-center gap-1.5">
              <Phone size={14} />
              {PHONE_NUMBER}
            </a>
          </div>
        </div>
      </div>

      {/* ===== MAIN NAVIGATION BAR ===== */}
      <header
        className={`sticky top-0 z-[100] transition-all duration-300 ease-out bg-white ${
          isScrolled ? 'shadow-md' : 'shadow-sm'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between items-center py-4">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="flex items-center justify-center w-10 h-10 bg-primary-dark rounded-lg">
                <UtensilsCrossed className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex flex-col">
                <span className="font-display font-bold text-lg text-primary-dark leading-tight">
                  R&amp;G Consulting
                </span>
                <span className="text-[10px] font-semibold tracking-[0.2em] text-gray-500 uppercase">
                  Cape Cod
                </span>
              </div>
            </Link>

            {/* Desktop Navigation - Center */}
            <nav className="hidden lg:flex items-center gap-8">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.path}
                  className={({ isActive }) =>
                    `relative text-[15px] font-medium transition-colors duration-200 py-2 ${
                      isActive ? 'text-primary-dark' : 'text-gray-600 hover:text-amber-500'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {item.name}
                      {/* Amber underline for active state */}
                      <span
                        className={`absolute bottom-0 left-0 h-[2px] bg-amber-500 transition-all duration-300 ease-out ${
                          isActive ? 'w-full' : 'w-0 group-hover:w-full'
                        }`}
                      />
                    </>
                  )}
                </NavLink>
              ))}
            </nav>

            {/* Right side - Availability Manager (always visible) */}
            <div className="hidden lg:flex items-center">
              <AvailabilityIndicator />
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden text-primary-dark hover:text-amber-500 p-2 transition-colors z-[110]"
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      {/* Full-screen Mobile Menu Overlay */}
      <div
        className={`fixed inset-0 z-[99] lg:hidden transition-all duration-300 ease-out ${
          isMobileMenuOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Dark overlay background */}
        <div className="absolute inset-0 bg-primary-dark/98 backdrop-blur-sm" />

        {/* Menu content */}
        <div className="relative h-full flex flex-col justify-center items-center px-6">
          <nav className="flex flex-col items-center gap-6">
            {NAV_ITEMS.map((item, index) => (
              <NavLink
                key={item.name}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `relative text-2xl font-medium transition-all duration-300 py-2 ${
                    isActive ? 'text-white' : 'text-gray-400 hover:text-white'
                  }`
                }
                style={{
                  transitionDelay: isMobileMenuOpen ? `${index * 50}ms` : '0ms',
                  transform: isMobileMenuOpen ? 'translateY(0)' : 'translateY(20px)',
                  opacity: isMobileMenuOpen ? 1 : 0,
                }}
              >
                {({ isActive }) => (
                  <>
                    {item.name}
                    {isActive && (
                      <span className="absolute bottom-0 left-0 w-full h-[2px] bg-amber-500" />
                    )}
                  </>
                )}
              </NavLink>
            ))}

            {/* Mobile Availability Indicator */}
            <div
              className="mt-8"
              style={{
                transitionDelay: isMobileMenuOpen ? `${NAV_ITEMS.length * 50}ms` : '0ms',
                transform: isMobileMenuOpen ? 'translateY(0)' : 'translateY(20px)',
                opacity: isMobileMenuOpen ? 1 : 0,
                transition: 'all 0.3s ease-out',
              }}
            >
              <AvailabilityIndicator />
            </div>
          </nav>

          {/* Contact info at bottom */}
          <div
            className="absolute bottom-12 text-center text-gray-400 text-sm"
            style={{
              transitionDelay: isMobileMenuOpen ? '400ms' : '0ms',
              transform: isMobileMenuOpen ? 'translateY(0)' : 'translateY(20px)',
              opacity: isMobileMenuOpen ? 1 : 0,
              transition: 'all 0.3s ease-out',
            }}
          >
            <a href={`tel:${PHONE_NUMBER}`} className="flex items-center justify-center gap-2 hover:text-white transition-colors">
              <Phone size={16} />
              {PHONE_NUMBER}
            </a>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-grow">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-primary-dark border-t border-gray-800 footer-pattern">
        {/* Main Footer Content */}
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12">
            {/* Column 1: Brand */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center w-10 h-10 bg-gray-800 rounded-lg">
                  <UtensilsCrossed className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-display text-white text-lg font-semibold">R&amp;G Consulting</h3>
                  <span className="text-[10px] font-semibold tracking-[0.2em] text-gray-500 uppercase">Cape Cod</span>
                </div>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed mb-3">
                Bridging the gap between restaurant operations and technology. We speak both languages.
              </p>
              <p className="text-gray-500 text-sm">
                Cape Cod, MA | Serving New England &amp; Remote
              </p>
            </div>

            {/* Column 2: Quick Links */}
            <div>
              <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">Quick Links</h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <Link to="/services" className="text-gray-400 hover:text-amber-400 transition-colors duration-200">
                    Services & Support Plans
                  </Link>
                </li>
                <li>
                  <Link to="/toast-hub" className="text-gray-400 hover:text-amber-400 transition-colors duration-200">
                    Toast Hub
                  </Link>
                </li>
                <li>
                  <Link to="/menu-builder" className="text-gray-400 hover:text-amber-400 transition-colors duration-200">
                    Menu Builder
                  </Link>
                </li>
                <li>
                  <Link to="/quote" className="text-gray-400 hover:text-amber-400 transition-colors duration-200">
                    Quote Builder
                  </Link>
                </li>
                <li>
                  <Link to="/about" className="text-gray-400 hover:text-amber-400 transition-colors duration-200">
                    About & Contact
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 3: Contact Info */}
            <div>
              <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">Contact</h4>
              <div className="space-y-2.5 text-sm text-gray-400">
                <a
                  href={`tel:${PHONE_NUMBER}`}
                  className="block hover:text-amber-400 transition-colors duration-200"
                >
                  {PHONE_NUMBER}
                </a>
                <a
                  href={`mailto:${EMAIL_ADDRESS}`}
                  className="block hover:text-amber-400 transition-colors duration-200"
                >
                  {EMAIL_ADDRESS}
                </a>
                <p className="text-gray-500 mt-4">
                  <span className="text-amber-400">Emergency Support:</span> Available 24/7
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800">
          <div className="max-w-7xl mx-auto px-6 py-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs text-gray-500">
              <p>
                &copy; 2026 R&amp;G Consulting LLC | DBA Cape Cod Restaurant Consulting
              </p>
              <div className="flex items-center gap-4">
                <Link to="/legal" className="hover:text-amber-400 transition-colors">
                  Terms &amp; Privacy
                </Link>
                <span className="text-gray-700">|</span>
                <span className="text-gray-600">Serving New England &amp; Remote</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
