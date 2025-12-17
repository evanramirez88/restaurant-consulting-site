import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { UtensilsCrossed, Monitor, ArrowLeft } from 'lucide-react';
import { useSEO } from '../src/components/SEO';

const MenuBuilder: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useSEO({
    title: 'Menu Builder (Coming Soon) | Cape Cod Consulting',
    description: 'AI-powered menu migration tool for Toast POS. Convert your existing menu data from any POS system into Toast-ready format. Coming soon!',
    canonical: 'https://ccrestaurantconsulting.com/#/menu-builder',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call / store email
    // In production, this would call your contact API or a dedicated waitlist endpoint
    await new Promise(resolve => setTimeout(resolve, 500));

    setSubmitted(true);
    setIsSubmitting(false);
  };

  return (
    <div className="bg-grove-dark min-h-screen flex items-center justify-center relative hero-grain">
      {/* Full page centered content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center relative z-10">

        {/* Animated Icon */}
        <div className="hero-fade-in mb-8">
          <div className="inline-flex items-center justify-center">
            <div className="relative">
              {/* Pulsing background */}
              <div className="absolute inset-0 bg-grove/20 rounded-2xl icon-pulse"></div>
              {/* Icon container with morphing effect */}
              <div className="relative p-6 bg-grove/10 rounded-2xl border border-grove-mist/30 icon-morph">
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <UtensilsCrossed
                    size={40}
                    className="text-grove-mist absolute icon-fade-out"
                  />
                  <Monitor
                    size={40}
                    className="text-grove-mist absolute icon-fade-in"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Headline */}
        <h1 className="hero-fade-in hero-fade-in-delay-1 font-serif text-5xl md:text-6xl font-bold text-terracotta mb-4">
          Menu Builder
        </h1>

        {/* Subheadline with grove underline */}
        <div className="hero-fade-in hero-fade-in-delay-1 mb-10">
          <p className="text-2xl md:text-3xl text-parchment font-serif mb-3">
            Coming Soon
          </p>
          <div className="brass-underline mx-auto"></div>
        </div>

        {/* Body Copy - exact text as specified */}
        <div className="hero-fade-in hero-fade-in-delay-2 mb-12 text-left max-w-xl mx-auto">
          <p className="text-xl text-parchment font-semibold mb-4">
            Migrate Your Menu to Toast — Intelligently
          </p>
          <p className="text-grove-mist leading-relaxed mb-4">
            Converting from another POS? We're building an AI-powered tool that transforms
            your existing menu data into Toast-ready format. Upload exports, images, or
            PDFs — get a complete menu structure ready for implementation.
          </p>
          <p className="text-grove-mist italic">
            Currently in development.
          </p>
        </div>

        {/* Email Capture Form */}
        <div className="hero-fade-in hero-fade-in-delay-3 mb-12">
          {!submitted ? (
            <form onSubmit={handleSubmit} className="max-w-md mx-auto">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="flex-1 px-5 py-4 rounded-lg bg-linen border border-sand text-ink placeholder-ink-light focus:outline-none focus:ring-2 focus:ring-grove focus:border-transparent transition-all"
                  required
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-4 bg-terracotta text-parchment rounded-lg font-semibold hover:bg-terracotta-dark transition-all glow-terracotta disabled:opacity-70 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isSubmitting ? 'Joining...' : 'Join the Waitlist'}
                </button>
              </div>
            </form>
          ) : (
            <div className="max-w-md mx-auto p-6 bg-grove/50 rounded-lg border border-grove-mist/30">
              <p className="text-parchment font-medium">
                Thanks! We'll notify you when Menu Builder launches.
              </p>
            </div>
          )}
        </div>

        {/* Back to Home Link */}
        <div className="hero-fade-in hero-fade-in-delay-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-grove-mist hover:text-parchment transition-colors"
          >
            <ArrowLeft size={18} />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default MenuBuilder;
