import React, { useState, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X, Phone } from 'lucide-react';
import { NAVIGATION, COMPANY_NAME, PHONE_NUMBER, EMAIL_ADDRESS } from '../constants';
import { initScrollAnimations } from '../src/hooks/useScrollAnimation';

interface LayoutProps {
  children: React.ReactNode;
}

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
    <div className="min-h-screen flex flex-col bg-ink text-cream font-sans">
      {/* Floating Navigation */}
      <header
        className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ease-out ${
          isScrolled
            ? 'bg-coal/95 backdrop-blur-md border-b border-line shadow-lg'
            : 'bg-transparent border-b border-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between items-center py-4">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <span className="font-sans font-medium text-[14px] text-cream tracking-wide">
                Cape Cod Restaurant Consulting
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-8">
              {NAVIGATION.filter(item => item.name !== 'Quote Builder').map((item) => (
                <NavLink
                  key={item.name}
                  to={item.path}
                  className={({ isActive }) =>
                    `relative text-[14px] font-medium transition-colors duration-200 py-1 ${
                      isActive ? 'text-brass' : 'text-mist hover:text-cream'
                    } group`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {item.name}
                      {/* Brass underline - static for active, animated on hover */}
                      <span
                        className={`absolute bottom-0 left-0 h-[2px] bg-brass transition-all duration-300 ease-out ${
                          isActive ? 'w-full' : 'w-0 group-hover:w-full'
                        }`}
                      />
                    </>
                  )}
                </NavLink>
              ))}

              {/* Get Quote CTA Button */}
              <Link
                to="/quote"
                className="bg-mint text-ink px-5 py-2.5 rounded-md text-[14px] font-semibold transition-all duration-300 glow-pulse hover:scale-[1.02]"
              >
                Get Quote
              </Link>
            </nav>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden text-cream hover:text-brass p-2 transition-colors z-[110]"
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      {/* Full-screen Mobile Menu Overlay */}
      <div
        className={`fixed inset-0 z-[99] md:hidden transition-all duration-300 ease-out ${
          isMobileMenuOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Dark overlay background */}
        <div className="absolute inset-0 bg-ink/98 backdrop-blur-sm" />

        {/* Menu content */}
        <div className="relative h-full flex flex-col justify-center items-center px-6">
          <nav className="flex flex-col items-center gap-6">
            {NAVIGATION.filter(item => item.name !== 'Quote Builder').map((item, index) => (
              <NavLink
                key={item.name}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `relative text-2xl font-medium transition-all duration-300 py-2 ${
                    isActive ? 'text-brass' : 'text-cream'
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
                      <span className="absolute bottom-0 left-0 w-full h-[2px] bg-brass" />
                    )}
                  </>
                )}
              </NavLink>
            ))}

            {/* Mobile CTA Button */}
            <Link
              to="/quote"
              onClick={() => setIsMobileMenuOpen(false)}
              className="mt-8 bg-mint text-ink px-8 py-4 rounded-md text-lg font-semibold transition-all duration-300 glow-pulse"
              style={{
                transitionDelay: isMobileMenuOpen ? `${NAVIGATION.length * 50}ms` : '0ms',
                transform: isMobileMenuOpen ? 'translateY(0)' : 'translateY(20px)',
                opacity: isMobileMenuOpen ? 1 : 0,
              }}
            >
              Get Quote
            </Link>
          </nav>

          {/* Contact info at bottom */}
          <div
            className="absolute bottom-12 text-center text-mist text-sm"
            style={{
              transitionDelay: isMobileMenuOpen ? '400ms' : '0ms',
              transform: isMobileMenuOpen ? 'translateY(0)' : 'translateY(20px)',
              opacity: isMobileMenuOpen ? 1 : 0,
              transition: 'all 0.3s ease-out',
            }}
          >
            <a href={`tel:${PHONE_NUMBER}`} className="flex items-center justify-center gap-2 hover:text-cream transition-colors">
              <Phone size={16} />
              {PHONE_NUMBER}
            </a>
          </div>
        </div>
      </div>

      {/* Main Content - add top padding to account for fixed nav */}
      <main className="flex-grow pt-[72px]">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-slate border-t border-brass">
        {/* Main Footer Content */}
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12">
            {/* Column 1: Brand */}
            <div>
              <h3 className="font-serif text-cream text-lg font-semibold mb-3">{COMPANY_NAME}</h3>
              <p className="text-mist text-sm leading-relaxed mb-5">
                Bridging the gap between restaurant operations and technology. We speak both languages.
              </p>
            </div>

            {/* Column 2: Quick Links */}
            <div>
              <h4 className="text-cream font-semibold text-sm uppercase tracking-wider mb-4">Quick Links</h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <Link to="/services" className="text-mist hover:text-cream transition-colors duration-200">
                    Services
                  </Link>
                </li>
                <li>
                  <Link to="/quote" className="text-mist hover:text-brass transition-colors duration-200">
                    Quote Builder
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="text-mist hover:text-cream transition-colors duration-200">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 3: Contact Info */}
            <div>
              <h4 className="text-cream font-semibold text-sm uppercase tracking-wider mb-4">Contact</h4>
              <div className="space-y-2.5 text-sm text-mist">
                <a
                  href={`tel:${PHONE_NUMBER}`}
                  className="block hover:text-brass transition-colors duration-200"
                >
                  {PHONE_NUMBER}
                </a>
                <a
                  href={`mailto:${EMAIL_ADDRESS}`}
                  className="block hover:text-brass transition-colors duration-200"
                >
                  {EMAIL_ADDRESS}
                </a>
                <p className="pt-2 text-mist/80">
                  Cape Cod, South Shore &amp; Greater Boston
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-line/50">
          <div className="max-w-7xl mx-auto px-6 py-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs text-mist/70">
              <p>
                &copy; 2025 R&amp;G Consulting LLC | DBA Cape Cod Restaurant Consulting
              </p>
              <p className="text-mist/60">
                Serving Cape Cod, South Shore, and Greater Boston
              </p>
            </div>
            <p className="text-[11px] text-mist/40 mt-3">
              Built with ♥ and Claude Code
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
