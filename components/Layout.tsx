import React, { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X, Phone, UtensilsCrossed } from 'lucide-react';
import { NAVIGATION, COMPANY_NAME, PHONE_NUMBER, EMAIL_ADDRESS } from '../constants';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Helper for NavLink classes
  const getNavLinkClass = ({ isActive }: { isActive: boolean }) => 
    `text-sm font-medium transition-colors hover:text-brand-accent ${
      isActive ? 'text-brand-accent' : 'text-slate-600'
    }`;

  const getMobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `block px-3 py-3 rounded-md text-base font-medium ${
      isActive
        ? 'bg-slate-50 text-brand-accent'
        : 'text-slate-600 hover:text-brand-dark hover:bg-slate-50'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      {/* Top Bar */}
      <div className="bg-brand-dark text-slate-300 py-2 px-4 text-xs md:text-sm border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <span>Serving Cape Cod & New England</span>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline text-brand-accent">Emergency Support Available 24/7</span>
            <a href={`tel:${PHONE_NUMBER}`} className="hover:text-white flex items-center gap-1 font-semibold">
              <Phone size={14} /> {PHONE_NUMBER}
            </a>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <div className="bg-brand-dark p-2 rounded-lg group-hover:bg-brand-accent transition-colors">
                <UtensilsCrossed className="text-white h-6 w-6" />
              </div>
              <div className="flex flex-col">
                <span className="font-serif font-bold text-xl leading-none text-brand-dark">R&G Consulting</span>
                <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">Cape Cod</span>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex space-x-8 items-center">
              {NAVIGATION.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.path}
                  className={getNavLinkClass}
                >
                  {item.name}
                </NavLink>
              ))}
              <Link
                to="/quote"
                className="bg-brand-dark text-white px-5 py-2.5 rounded-md text-sm font-semibold hover:bg-brand-accent transition-all shadow-md"
              >
                Get Quote
              </Link>
            </nav>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="text-slate-600 hover:text-brand-dark p-2"
              >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-200 shadow-lg absolute w-full">
            <div className="px-4 pt-2 pb-6 space-y-2">
              {NAVIGATION.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.path}
                  className={getMobileNavLinkClass}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.name}
                </NavLink>
              ))}
              <div className="pt-4">
                <Link
                  to="/quote"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block w-full text-center bg-brand-dark text-white px-5 py-3 rounded-md font-semibold hover:bg-brand-accent"
                >
                  Get Instant Quote
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-grow">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-brand-dark text-slate-400 py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-1">
            <h3 className="font-serif text-white text-lg font-bold mb-4">{COMPANY_NAME}</h3>
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
            <h4 className="text-white font-semibold mb-4">Services</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/services" className="hover:text-brand-accent transition-colors">Toast POS Installation</Link></li>
              <li><Link to="/services" className="hover:text-brand-accent transition-colors">Network & IT Support</Link></li>
              <li><Link to="/services" className="hover:text-brand-accent transition-colors">Menu Costing & Engineering</Link></li>
              <li><Link to="/services" className="hover:text-brand-accent transition-colors">Emergency Support</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/about" className="hover:text-brand-accent transition-colors">About Evan</Link></li>
              <li><Link to="/quote" className="hover:text-brand-accent transition-colors">Quote Builder</Link></li>
              <li><Link to="/contact" className="hover:text-brand-accent transition-colors">Contact</Link></li>
              <li><span className="text-slate-600 cursor-not-allowed">Partner Login</span></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Contact</h4>
            <div className="space-y-3 text-sm">
              <a href={`tel:${PHONE_NUMBER}`} className="block hover:text-white transition-colors">{PHONE_NUMBER}</a>
              <a href={`mailto:${EMAIL_ADDRESS}`} className="block hover:text-white transition-colors">{EMAIL_ADDRESS}</a>
              <p className="text-slate-500 text-xs mt-4">
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