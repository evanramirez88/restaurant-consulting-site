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
            Your POS Crashed Mid-Rush.
            <br />
            <span className="text-amber-400 italic">Never Again.</span>
          </h1>

          {/* Description */}
          <p className="text-lg md:text-xl text-gray-300 mb-8 max-w-3xl mx-auto hero-fade-in hero-fade-in-delay-2">
            Toast POS installation, bulletproof networking, and operational consulting from someone who's worked the line, run the pass, and closed out the registers. When your tech goes down during a 200-cover Saturday, you need someone who's been there—not a call center.
          </p>

          {/* Pain points solved */}
          <div className="flex flex-wrap justify-center gap-4 mb-10 text-sm text-gray-300 hero-fade-in hero-fade-in-delay-2">
            <span className="bg-white/10 px-4 py-2 rounded-full">✓ Zero-downtime installations</span>
            <span className="bg-white/10 px-4 py-2 rounded-full">✓ After-hours support</span>
            <span className="bg-white/10 px-4 py-2 rounded-full">✓ Menu built your way</span>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12 hero-fade-in hero-fade-in-delay-3">
            <Link
              to="/quote"
              className="inline-flex items-center justify-center px-8 py-4 rounded-lg font-semibold text-lg transition-all shadow-lg glow-pulse btn-hover bg-orange-600 text-white hover:bg-orange-700"
            >
              Get a Quote in 2 Minutes
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
            <Link
              to="/schedule"
              className="inline-flex items-center justify-center px-8 py-4 rounded-lg font-semibold text-lg transition-all btn-hover border-2 border-white text-white hover:bg-white hover:text-primary-dark"
            >
              Book a Free 15-Min Call
            </Link>
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-wrap justify-center gap-6 md:gap-10 text-gray-400 text-sm hero-fade-in hero-fade-in-delay-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-500" />
              <span>50+ Restaurants Launched</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-500" />
              <span>10+ Years in Hospitality</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-500" />
              <span>Response Within 2 Hours</span>
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
                THE R&amp;G DIFFERENCE
              </span>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-8 leading-tight">
                Your Last IT Guy Made You Explain What "86'd" Means. I Won't.
              </h2>

              <div className="space-y-6">
                <FeatureRow
                  title="Kitchen-Tested Expertise"
                  desc="I've expedited, bartended, and managed—so I build systems that survive a 300-cover night, not just a demo."
                />
                <FeatureRow
                  title="Your Schedule, Not Mine"
                  desc="Need to meet after close? No problem. 60% of my consultations happen evenings and weekends."
                />
                <FeatureRow
                  title="Transparent Pricing, Fast"
                  desc="Get an accurate quote in minutes with my algorithmic pricing tool—no sales calls, no surprises."
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
              From Setup to Service—I've Got You Covered
            </h2>
            <div className="brass-line-draw short mb-6" />
            <p className="text-gray-600 text-lg">
              Tech that works is table stakes. I deliver systems that make your team faster, your tickets cleaner, and your margins healthier.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 animate-on-scroll">
            <ServiceCard
              icon={MonitorCheck}
              title="Toast POS Installation"
              description="Hardware, menus, modifiers, and staff trained—all before your next service. No downtime, no chaos."
              link="/services"
            />
            <ServiceCard
              icon={Wifi}
              title="Networking & IT"
              description="Dual-WAN failover, guest WiFi isolation, and enterprise-grade coverage that handles peak volume."
              link="/services"
            />
            <ServiceCard
              icon={ClipboardList}
              title="Operations Consulting"
              description="Ticket routing that makes sense, station setups that flow, and SOPs that stick. Protect your margins."
              link="/services"
            />
            <ServiceCard
              icon={PhoneCall}
              title="Emergency Support"
              description="Printer died mid-rush? Network down on a Saturday? I answer nights and weekends—period."
              link="/contact"
            />
          </div>
        </div>
      </section>

      {/* Client Trust Bar */}
      <section className="section-dark-grain py-12 text-center border-y border-gray-800">
        <div className="max-w-7xl mx-auto px-4 animate-on-scroll">
          <p className="text-gray-400 text-sm font-semibold uppercase tracking-widest mb-8">
            Trusted by Independent Restaurants from Provincetown to Providence
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
            Stop Losing Sales to Broken Tech
          </h2>
          <div className="brass-line-draw short mb-6" />
          <p className="text-gray-300 text-lg mb-10 max-w-2xl mx-auto">
            Every crashed terminal, slow ticket, and network hiccup costs you money. Let's fix it—before your next rush, not during it.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              to="/quote"
              className="px-8 py-4 rounded-lg font-semibold text-lg transition-all shadow-lg btn-hover border-2 border-white text-white hover:bg-white hover:text-primary-dark"
            >
              Get Your Free Quote
            </Link>
            <a
              href="tel:5082474936"
              className="px-8 py-4 rounded-lg font-semibold text-lg transition-all shadow-lg flex items-center justify-center gap-2 btn-hover bg-orange-600 text-white hover:bg-orange-700"
            >
              <Phone size={20} /> Call Now: (508) 247-4936
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
