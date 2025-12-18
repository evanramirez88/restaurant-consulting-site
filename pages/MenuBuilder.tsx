import React from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, ArrowLeft } from 'lucide-react';
import { useSEO } from '../src/components/SEO';

const MenuBuilder: React.FC = () => {
  useSEO({
    title: 'Menu Builder (Coming Soon) | Cape Cod Consulting',
    description: 'AI-powered menu migration tool for Toast POS. Convert your existing menu data from any POS system into Toast-ready format. Coming soon!',
    canonical: 'https://ccrestaurantconsulting.com/#/menu-builder',
  });

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center max-w-xl px-6">
        <div className="text-amber-400 text-6xl mb-6">
          <ClipboardList className="w-16 h-16 mx-auto" />
        </div>
        <h1 className="text-4xl font-serif text-white mb-4">Menu Builder</h1>
        <p className="text-xl text-amber-400 mb-6">Coming Soon</p>
        <p className="text-gray-400 mb-8">
          Migrate Your Menu to Toast — Intelligently. Converting from another POS?
          We're building an AI-powered tool that transforms your existing menu data
          into Toast-ready format.
        </p>
        <p className="text-sm text-gray-500 mb-8">
          Be the first to know when Menu Builder launches.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={18} />
          Back to Home
        </Link>
      </div>
    </div>
  );
};

export default MenuBuilder;
