import React, { useState, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X, Phone, UtensilsCrossed } from 'lucide-react';
import { NAVIGATION, COMPANY_NAME, PHONE_NUMBER, EMAIL_ADDRESS } from '../constants';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();

  // Handle scroll behavior for floating nav
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check initial position

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
              <div
                className={`p-2 rounded-lg transition-all duration-300 ${
                  isScrolled
                    ? 'bg-slate border border-line group-hover:bg-brass group-hover:border-brass'
                    : 'bg-cream/10 border border-cream/20 group-hover:bg-brass group-hover:border-brass'
                }`}
              >
                <UtensilsCrossed className="text-cream h-5 w-5 group-hover:text-ink transition-colors" />
              </div>
              <div className="flex flex-col">
                <span className="font-sans font-semibold text-sm text-cream leading-tight tracking-tight">
                  Cape Cod Restaurant
                </span>
                <span className="font-sans font-medium text-xs text-brass leading-tight">
                  Consulting
                </span>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-8">
              {NAVIGATION.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.path}
                  className={({ isActive }) =>
                    `nav-link relative text-sm font-medium transition-colors duration-200 ${
                      isActive ? 'text-brass nav-link-active' : 'text-cream/80 hover:text-cream'
                    }`
                  }
                >
                  {item.name}
                </NavLink>
              ))}
              <Link
                to="/quote"
                className="ml-4 bg-mint text-ink px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-mint/90 transition-all duration-200 shadow-lg glow-mint"
              >
                Get Quote
              </Link>
            </nav>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden relative z-[110] p-2 text-cream hover:text-brass transition-colors"
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      {/* Full-Screen Mobile Menu Overlay */}
      <div
        className={`fixed inset-0 z-[99] md:hidden transition-all duration-300 ease-out ${
          isMobileMenuOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Dark overlay background */}
        <div
          className="absolute inset-0 bg-ink/98 backdrop-blur-lg"
          onClick={() => setIsMobileMenuOpen(false)}
        />

        {/* Menu content */}
        <div
          className={`relative h-full flex flex-col pt-24 px-8 transition-transform duration-300 ease-out ${
            isMobileMenuOpen ? 'translate-y-0' : '-translate-y-8'
          }`}
        >
          {/* Navigation Links */}
          <nav className="flex-1 flex flex-col gap-2">
            {NAVIGATION.map((item, index) => (
              <NavLink
                key={item.name}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `mobile-nav-link text-3xl font-serif font-bold py-4 border-b border-line/50 transition-all duration-200 ${
                    isActive ? 'text-brass' : 'text-cream hover:text-brass'
                  }`
                }
                style={{ transitionDelay: `${index * 50}ms` }}
              >
                {item.name}
              </NavLink>
            ))}

            {/* CTA Button */}
            <div className="mt-8">
              <Link
                to="/quote"
                onClick={() => setIsMobileMenuOpen(false)}
                className="inline-flex items-center justify-center w-full bg-mint text-ink px-8 py-4 rounded-lg text-lg font-bold hover:bg-mint/90 transition-all glow-mint"
              >
                Get Your Free Quote
              </Link>
            </div>
          </nav>

          {/* Contact Info at Bottom */}
          <div className="py-8 border-t border-line/50">
            <div className="flex flex-col gap-4">
              <a
                href={`tel:${PHONE_NUMBER}`}
                className="flex items-center gap-3 text-cream hover:text-brass transition-colors"
              >
                <Phone size={20} />
                <span className="text-lg font-medium">{PHONE_NUMBER}</span>
              </a>
              <p className="text-sm text-mist">
                Emergency Support Available 24/7
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Spacer for fixed header */}
      <div className="h-[72px]" />

      {/* Main Content */}
      <main className="flex-grow">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-coal text-mist py-12 border-t border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-1">
            <h3 className="font-serif text-cream text-lg font-bold mb-4">{COMPANY_NAME}</h3>
            <p className="text-sm leading-relaxed mb-4">
              Bridging the gap between restaurant operations and technology.
              We speak both languages.
            </p>
            <div className="text-sm">
              <p>Cape Cod, MA</p>
              <p>Serving New England & Remote</p>
            </div>
          </div>

          <div>
            <h4 className="text-cream font-semibold mb-4">Services</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/services" className="hover:text-brass transition-colors">Toast POS Installation</Link></li>
              <li><Link to="/services" className="hover:text-brass transition-colors">Network & IT Support</Link></li>
              <li><Link to="/services" className="hover:text-brass transition-colors">Menu Costing & Engineering</Link></li>
              <li><Link to="/services" className="hover:text-brass transition-colors">Emergency Support</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-cream font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/about" className="hover:text-brass transition-colors">About Evan</Link></li>
              <li><Link to="/quote" className="hover:text-brass transition-colors">Quote Builder</Link></li>
              <li><Link to="/contact" className="hover:text-brass transition-colors">Contact</Link></li>
              <li><span className="text-line cursor-not-allowed">Partner Login</span></li>
            </ul>
          </div>

          <div>
            <h4 className="text-cream font-semibold mb-4">Contact</h4>
            <div className="space-y-3 text-sm">
              <a href={`tel:${PHONE_NUMBER}`} className="block hover:text-cream transition-colors">{PHONE_NUMBER}</a>
              <a href={`mailto:${EMAIL_ADDRESS}`} className="block hover:text-cream transition-colors">{EMAIL_ADDRESS}</a>
              <p className="text-mist/60 text-xs mt-4">
                &copy; {new Date().getFullYear()} R&G Consulting LLC.<br/>All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
