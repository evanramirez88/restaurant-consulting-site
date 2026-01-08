import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  MonitorCheck,
  Wifi,
  ClipboardList,
  PhoneCall,
  CheckCircle2,
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
      <section className="relative min-h-screen flex flex-col items-center justify-start pt-32 overflow-hidden bg-primary-dark grain-overlay">
        {/* Parallax decorative elements - hidden on mobile to prevent overflow */}
        <div
          className="parallax-element parallax-orb hidden sm:block w-[300px] h-[300px] md:w-[400px] md:h-[400px] lg:w-[600px] lg:h-[600px] -top-[100px] md:-top-[150px] lg:-top-[200px] -right-[100px] md:-right-[150px] lg:-right-[200px]"
          style={{ transform: `translateY(${parallaxOffset * 0.5}px)` }}
        />
        <div
          className="parallax-element parallax-orb hidden sm:block w-[200px] h-[200px] md:w-[300px] md:h-[300px] lg:w-[400px] lg:h-[400px] bottom-[10%] -left-[50px] md:-left-[75px] lg:-left-[100px]"
          style={{ transform: `translateY(${parallaxOffset * 0.3}px)` }}
        />

        {/* Main content container */}
        <div className="relative z-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
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
              className="inline-flex items-center justify-center px-8 py-4 rounded-lg font-semibold text-lg transition-all shadow-lg hover:opacity-90"
              style={{ backgroundColor: '#ea580c', color: '#ffffff' }}
            >
              Get a Quote in 2 Minutes
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
            <Link
              to="/schedule"
              className="inline-flex items-center justify-center px-8 py-4 rounded-lg font-semibold text-lg transition-all border-2 hover:bg-white hover:text-gray-900"
              style={{ backgroundColor: 'transparent', color: '#ffffff', borderColor: '#ffffff' }}
            >
              Book a Free 15-Min Call
            </Link>
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-wrap justify-center gap-6 md:gap-10 text-gray-400 text-sm hero-fade-in hero-fade-in-delay-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-500" />
              <span>25+ Cape Cod & New England Restaurants Served</span>
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
                Your Last IT Guy Made You Explain What "86'd" Means. We Won't.
              </h2>

              <div className="space-y-6">
                <FeatureRow
                  title="Kitchen-Tested Expertise"
                  desc="We've expedited, bartended, and managed—so we build systems that survive a 300-cover night, not just a demo."
                />
                <FeatureRow
                  title="Your Schedule, Not Ours"
                  desc="Need to meet after close? No problem. 60% of our consultations happen evenings and weekends."
                />
                <FeatureRow
                  title="Transparent Pricing, Fast"
                  desc="Get an accurate quote in minutes with our algorithmic pricing tool—no sales calls, no surprises."
                />
              </div>

              <div className="mt-8">
                <Link to="/about" className="text-amber-600 font-bold hover:text-orange-600 transition-colors inline-flex items-center">
                  Read Our Story <ArrowRight className="ml-2 w-4 h-4" />
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
              From Setup to Service—We've Got You Covered
            </h2>
            <div className="brass-line-draw short mb-6" />
            <p className="text-gray-600 text-lg">
              Tech that works is table stakes. We deliver systems that make your team faster, your tickets cleaner, and your margins healthier.
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
              description="Printer died mid-rush? Network down on a Saturday? We answer nights and weekends—period."
              link="/contact"
            />
          </div>
        </div>
      </section>

      {/* Client Success Stories Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 animate-on-scroll">
            <span className="text-amber-600 font-bold uppercase tracking-widest text-sm block mb-3">
              REAL RESULTS
            </span>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Recent Client Success Stories
            </h2>
            <div className="brass-line-draw short mb-6" />
            <p className="text-gray-600 text-lg">
              From emergency recoveries to complex multi-location deployments—real projects, real outcomes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-on-scroll">
            {/* Case Study A: Emergency Recovery */}
            <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-6 hover:shadow-xl transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Emergency Recovery</span>
                  <h3 className="font-display text-xl font-bold text-gray-900 mt-2">Seafood Restaurant — Network Failure</h3>
                </div>
              </div>
              <div className="space-y-3 text-sm text-gray-600">
                <div>
                  <span className="font-semibold text-gray-900">POS Transition:</span> Toast → Toast (restored/stabilized)
                </div>
                <div>
                  <span className="font-semibold text-gray-900">Crisis:</span> Complete network failure at noon, day before July 4th weekend
                </div>
                <div>
                  <span className="font-semibold text-gray-900">Response:</span> On-site within the hour, operational by 5 PM
                </div>
                <div>
                  <span className="font-semibold text-gray-900">Outcome:</span> Saved their busiest weekend of the year—zero downtime during peak season
                </div>
              </div>
            </div>

            {/* Case Study B: Ground-Up Implementation */}
            <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-6 hover:shadow-xl transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Full Deployment</span>
                  <h3 className="font-display text-xl font-bold text-gray-900 mt-2">Historic Diner — West Chatham</h3>
                </div>
              </div>
              <div className="space-y-3 text-sm text-gray-600">
                <div>
                  <span className="font-semibold text-gray-900">POS Transition:</span> Manual/Cash Register → Toast
                </div>
                <div>
                  <span className="font-semibold text-gray-900">Challenge:</span> Cash register + handwritten tickets to modern POS system
                </div>
                <div>
                  <span className="font-semibold text-gray-900">Scope:</span> Complete Toast deployment + operational workflow redesign + staff training
                </div>
                <div>
                  <span className="font-semibold text-gray-900">Outcome:</span> Seamless transition from analog to digital—staff confident on day one
                </div>
              </div>
            </div>

            {/* Case Study C: Complex Menu Engineering */}
            <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-6 hover:shadow-xl transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Menu Architecture</span>
                  <h3 className="font-display text-xl font-bold text-gray-900 mt-2">Pizza & Ice Cream Shop — Westport</h3>
                </div>
              </div>
              <div className="space-y-3 text-sm text-gray-600">
                <div>
                  <span className="font-semibold text-gray-900">POS Transition:</span> Legacy System → Toast
                </div>
                <div>
                  <span className="font-semibold text-gray-900">Challenge:</span> Pizza modifiers, ice cream combinations, complex sizing/pricing logic
                </div>
                <div>
                  <span className="font-semibold text-gray-900">Scope:</span> Advanced menu architecture with nested modifiers and dynamic pricing
                </div>
                <div>
                  <span className="font-semibold text-gray-900">Outcome:</span> First recurring service agreement—now handling all their menu updates
                </div>
              </div>
            </div>

            {/* Case Study D: Multi-Location Portfolio */}
            <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-6 hover:shadow-xl transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Multi-Location</span>
                  <h3 className="font-display text-xl font-bold text-gray-900 mt-2">Restaurant Group — 3 Concepts</h3>
                </div>
              </div>
              <div className="space-y-3 text-sm text-gray-600">
                <div>
                  <span className="font-semibold text-gray-900">POS Transition:</span> Various Systems → Toast (unified platform)
                </div>
                <div>
                  <span className="font-semibold text-gray-900">Concepts:</span> QSR burger shack, full-service tiki bar, and food truck
                </div>
                <div>
                  <span className="font-semibold text-gray-900">Scope:</span> Three different service models unified on Toast ecosystem
                </div>
                <div>
                  <span className="font-semibold text-gray-900">Outcome:</span> Concept-specific configurations with consolidated reporting—owner sees everything
                </div>
              </div>
            </div>

            {/* Case Study E: Retail Hybrid */}
            <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-6 hover:shadow-xl transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Retail + Food Service</span>
                  <h3 className="font-display text-xl font-bold text-gray-900 mt-2">Market & Café — Sandwich</h3>
                </div>
              </div>
              <div className="space-y-3 text-sm text-gray-600">
                <div>
                  <span className="font-semibold text-gray-900">POS Transition:</span> Legacy System → Toast Retail + Toast
                </div>
                <div>
                  <span className="font-semibold text-gray-900">Challenge:</span> Grocery retail + deli/cafe operations on single system
                </div>
                <div>
                  <span className="font-semibold text-gray-900">Scope:</span> Dual-mode Toast configuration for retail and restaurant workflows
                </div>
                <div>
                  <span className="font-semibold text-gray-900">Outcome:</span> One platform handling both retail inventory and made-to-order cafe items
                </div>
              </div>
            </div>

            {/* POS Conversions Info Card */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl p-6 hover:shadow-xl transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">Platform Expertise</span>
                  <h3 className="font-display text-xl font-bold text-gray-900 mt-2">POS Conversions We Support</h3>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-600" />
                  <span className="font-semibold text-gray-900">Square → Toast</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-600" />
                  <span className="font-semibold text-gray-900">Clover → Toast</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-600" />
                  <span className="font-semibold text-gray-900">Lightspeed → Toast</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-600" />
                  <span className="font-semibold text-gray-900">Legacy/Manual → Toast</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-600" />
                  <span className="font-semibold text-gray-900">Upserve: Supported</span>
                </div>
                <p className="text-xs text-gray-600 mt-4 italic">
                  Platform-agnostic consulting—I'll tell you when switching isn't the right move.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Client Trust Bar */}
      <section className="section-dark-grain py-12 text-center border-y border-gray-800">
        <div className="max-w-7xl mx-auto px-4 animate-on-scroll">
          <p className="text-gray-400 text-sm font-semibold uppercase tracking-widest mb-8">
            Serving Independent Restaurants from Provincetown to Providence
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 opacity-70 hover:opacity-100 transition-all duration-500">
            <div className="text-white font-display text-xl font-bold flex items-center justify-center">Emergency Recovery</div>
            <div className="text-white font-display text-xl font-bold flex items-center justify-center">POS Conversions</div>
            <div className="text-white font-display text-xl font-bold flex items-center justify-center">Complex Menus</div>
            <div className="text-white font-display text-xl font-bold flex items-center justify-center">Multi-Location</div>
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
              className="px-8 py-4 rounded-lg font-semibold text-lg transition-all shadow-lg hover:opacity-90"
              style={{ backgroundColor: '#ea580c', color: '#ffffff' }}
            >
              Get Your Free Quote
            </Link>
            <a
              href="tel:5082474936"
              className="px-8 py-4 rounded-lg font-semibold text-lg transition-all shadow-lg flex items-center justify-center gap-2 hover:opacity-90"
              style={{ backgroundColor: '#ea580c', color: '#ffffff' }}
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
