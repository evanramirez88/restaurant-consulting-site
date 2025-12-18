import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  MonitorCheck,
  Wifi,
  ClipboardList,
  PhoneCall,
  CheckCircle2,
  ChevronDown,
  Phone
} from 'lucide-react';
import ServiceCard from '../src/components/ServiceCard';
import FeatureRow from '../src/components/FeatureRow';
import { useSEO } from '../src/components/SEO';

const Home: React.FC = () => {
  const [parallaxOffset, setParallaxOffset] = useState(0);

  useSEO({
    title: 'Toast POS Consultant Cape Cod | R&G Consulting LLC',
    description: 'Expert Toast POS installation, menu configuration, and restaurant networking in Cape Cod, MA. Get your free quote today! Call (508) 247-4936.',
    canonical: 'https://ccrestaurantconsulting.com/',
  });

  // Parallax effect for hero section
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const handleScroll = () => {
      const scrolled = window.scrollY;
      if (scrolled < window.innerHeight) {
        setParallaxOffset(scrolled * 0.3);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="flex flex-col">
      {/* Hero Section - Full viewport */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-primary-dark grain-overlay">
        {/* Parallax decorative elements */}
        <div
          className="parallax-element parallax-orb w-[600px] h-[600px] -top-[200px] -right-[200px]"
          style={{ transform: `translateY(${parallaxOffset * 0.5}px)` }}
        />
        <div
          className="parallax-element parallax-orb w-[400px] h-[400px] bottom-[10%] -left-[100px]"
          style={{ transform: `translateY(${parallaxOffset * 0.3}px)` }}
        />

        {/* Main content container */}
        <div className="relative z-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Availability Badge */}
          <div className="hero-fade-in hero-fade-in-delay-1 mb-8">
            <span className="inline-flex items-center gap-2 bg-teal-600/90 text-white text-sm font-medium px-4 py-2 rounded-full">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              Available for New Projects
            </span>
          </div>

          {/* Main headline */}
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6 hero-fade-in hero-fade-in-delay-1">
            Restaurant Tech That Actually
            <br />
            <span className="text-amber-400 italic">Understands Restaurants.</span>
          </h1>

          {/* Description */}
          <p className="text-lg md:text-xl text-gray-300 mb-10 max-w-3xl mx-auto hero-fade-in hero-fade-in-delay-2">
            Toast POS installation, networking, and operational consulting from someone who's worked every station in your kitchen. I don't just fix wires; I fix workflows.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12 hero-fade-in hero-fade-in-delay-3">
            <Link
              to="/quote"
              className="inline-flex items-center justify-center px-8 py-4 rounded-lg font-semibold text-lg transition-all shadow-lg glow-pulse btn-hover bg-orange-600 text-white hover:bg-orange-700"
            >
              Get Your Free Quote
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
            <Link
              to="/schedule"
              className="inline-flex items-center justify-center px-8 py-4 rounded-lg font-semibold text-lg transition-all btn-hover border-2 border-white text-white hover:bg-white hover:text-primary-dark"
            >
              Schedule Discovery Call
            </Link>
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-wrap justify-center gap-6 md:gap-10 text-gray-400 text-sm hero-fade-in hero-fade-in-delay-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-gray-500" />
              <span>50+ Restaurants Served</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-gray-500" />
              <span>Toast Certified Partner</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-gray-500" />
              <span>Same-Day Invoicing</span>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 hero-fade-in hero-fade-in-delay-4">
          <span className="text-gray-400 text-sm font-medium tracking-wide">Scroll to explore</span>
          <ChevronDown className="w-5 h-5 text-gray-400 scroll-indicator" />
        </div>
      </section>

      {/* Why Choose R&G Section - Two columns */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            {/* Image Left */}
            <div className="lg:w-1/2 animate-on-scroll slide-left">
              <img
                src="https://images.unsplash.com/photo-1590846406792-0adc7f938f1d?ixlib=rb-4.0.3&auto=format&fit=crop&w=985&q=80"
                alt="Restaurant kitchen workflow during service - POS consultant understands operations"
                className="rounded-2xl shadow-2xl border border-gray-200"
              />
            </div>

            {/* Content Right */}
            <div className="lg:w-1/2 animate-on-scroll slide-right">
              <span className="text-amber-600 font-bold uppercase tracking-widest text-sm block mb-3">
                WHY CHOOSE R&amp;G
              </span>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-8 leading-tight">
                Most IT Guys Have Never Worked a Friday Night Rush. I Have.
              </h2>

              <div className="space-y-6">
                <FeatureRow
                  title="Restaurant-Native"
                  desc="I speak '86', 'on the fly', and 'in the weeds'. No translation needed."
                />
                <FeatureRow
                  title="After-Hours Availability"
                  desc="60% of my meetings happen in the evening because that's when you're available."
                />
                <FeatureRow
                  title="Proprietary Costing"
                  desc="My algorithmic quoting system gives you accurate numbers in minutes, not days."
                />
              </div>

              <div className="mt-8">
                <Link to="/about" className="text-amber-600 font-bold hover:text-orange-600 transition-colors inline-flex items-center">
                  Read My Story <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Overview Section */}
      <section className="py-20 section-light-gradient">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 animate-on-scroll">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Not Just IT Support. Operational Solutions.
            </h2>
            <div className="brass-line-draw short mb-6" />
            <p className="text-gray-600 text-lg">
              Most vendors stop at the router. I start there and work my way to the line cook's ticket rail.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 animate-on-scroll">
            <ServiceCard
              icon={MonitorCheck}
              title="Toast POS Installation"
              description="Full hardware deployment, menu configuration, and staff training. We're online before the dinner rush."
              link="/services"
            />
            <ServiceCard
              icon={Wifi}
              title="Networking & IT"
              description="Enterprise-grade WiFi and failover systems designed for high-volume hospitality environments."
              link="/services"
            />
            <ServiceCard
              icon={ClipboardList}
              title="Operations Consulting"
              description="Menu engineering, BOH workflow optimization, and SOP development to protect your margins."
              link="/services"
            />
            <ServiceCard
              icon={PhoneCall}
              title="Emergency Support"
              description="The 'Restaurant 911'. Tech, staffing, or crisis management available nights and weekends."
              link="/contact"
            />
          </div>
        </div>
      </section>

      {/* Client Trust Bar */}
      <section className="section-dark-grain py-12 text-center border-y border-gray-800">
        <div className="max-w-7xl mx-auto px-4 animate-on-scroll">
          <p className="text-gray-400 text-sm font-semibold uppercase tracking-widest mb-8">
            Trusted by Independent Restaurant Owners Across Cape Cod &amp; SE Massachusetts
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 opacity-70 hover:opacity-100 transition-all duration-500">
            <div className="text-white font-display text-2xl font-bold flex items-center justify-center">The Portside</div>
            <div className="text-white font-display text-2xl font-bold flex items-center justify-center">Salt &amp; Vine</div>
            <div className="text-white font-display text-2xl font-bold flex items-center justify-center">Harbor Grill</div>
            <div className="text-white font-display text-2xl font-bold flex items-center justify-center">Main St. Tavern</div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-primary-dark relative overflow-hidden grain-overlay">
        <div className="absolute inset-0 bg-white/5"></div>
        <div className="relative z-10 max-w-4xl mx-auto text-center px-4 animate-on-scroll">
          <h2 className="font-display text-3xl md:text-5xl font-bold text-white mb-6">
            Ready to fix your restaurant tech?
          </h2>
          <div className="brass-line-draw short mb-6" />
          <p className="text-gray-300 text-lg mb-10 max-w-2xl mx-auto">
            Stop waiting on hold with support lines. Get a specialist who knows your business.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              to="/quote"
              className="px-8 py-4 rounded-lg font-semibold text-lg transition-all shadow-lg btn-hover border-2 border-white text-white hover:bg-white hover:text-primary-dark"
            >
              Build Your Quote
            </Link>
            <a
              href="tel:5082474936"
              className="px-8 py-4 rounded-lg font-semibold text-lg transition-all shadow-lg flex items-center justify-center gap-2 btn-hover bg-orange-600 text-white hover:bg-orange-700"
            >
              <Phone size={20} /> Call (508) 247-4936
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
