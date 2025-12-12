import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MonitorCheck, Wifi, ClipboardList, PhoneCall, CheckCircle2 } from 'lucide-react';
import ServiceCard from '../src/components/ServiceCard';
import FeatureRow from '../src/components/FeatureRow';

const Home: React.FC = () => {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative bg-brand-dark min-h-[600px] flex items-center overflow-hidden">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1556742049-0cfed4f7a07d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80" 
            alt="Restaurant POS System" 
            className="w-full h-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-brand-dark via-brand-dark/90 to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-16">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-accent/10 text-brand-accent border border-brand-accent/20 text-sm font-semibold mb-6">
              <span className="w-2 h-2 rounded-full bg-brand-accent animate-pulse"></span>
              Available for New Projects
            </div>
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              Restaurant Tech That Actually <span className="text-brand-accent">Understands Restaurants</span>.
            </h1>
            <p className="text-lg text-slate-300 mb-8 leading-relaxed">
              Toast POS installation, networking, and operational consulting from someone who's worked every station in your kitchen. I don't just fix wires; I fix workflows.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link 
                to="/quote" 
                className="inline-flex items-center justify-center px-8 py-4 bg-brand-accent text-white rounded-lg font-bold text-lg hover:bg-orange-600 transition-all shadow-lg hover:shadow-orange-900/20"
              >
                Get Your Free Quote
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
              <Link
                to="/schedule"
                className="inline-flex items-center justify-center px-8 py-4 bg-white/10 text-white border border-white/20 rounded-lg font-bold text-lg hover:bg-white/20 transition-all backdrop-blur-sm"
              >
                Schedule Discovery Call
              </Link>
            </div>
            
            {/* Quick Trust Indicators */}
            <div className="mt-12 flex flex-wrap gap-x-8 gap-y-4 text-slate-400 text-sm font-medium">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="text-brand-accent w-4 h-4" />
                <span>50+ Restaurants Served</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="text-brand-accent w-4 h-4" />
                <span>Toast Certified Partner</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="text-brand-accent w-4 h-4" />
                <span>Same-Day Invoicing</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-brand-dark mb-4">Not Just IT Support. Operational Solutions.</h2>
            <p className="text-slate-600 text-lg">
              Most vendors stop at the router. I start there and work my way to the line cook's ticket rail.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <ServiceCard 
              icon={MonitorCheck}
              title="Toast POS Installation"
              description="Full hardware deployment, menu programming, and staff training. We're online before the dinner rush."
            />
            <ServiceCard 
              icon={Wifi}
              title="Networking & IT"
              description="Enterprise-grade wifi and failover systems designed for high-volume hospitality environments."
            />
            <ServiceCard 
              icon={ClipboardList}
              title="Operations Consulting"
              description="Menu engineering, BOH workflow optimization, and SOP development to protect your margins."
            />
            <ServiceCard 
              icon={PhoneCall}
              title="Emergency Support"
              description="The 'Restaurant 911'. Tech, staffing, or crisis management available nights and weekends."
            />
          </div>
        </div>
      </section>

      {/* Value Prop / Split Section */}
      <section className="bg-slate-50 py-20 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="lg:w-1/2">
              <img 
                src="https://images.unsplash.com/photo-1590846406792-0adc7f938f1d?ixlib=rb-4.0.3&auto=format&fit=crop&w=985&q=80" 
                alt="Busy Restaurant Kitchen" 
                className="rounded-2xl shadow-2xl"
              />
            </div>
            <div className="lg:w-1/2">
              <h3 className="text-brand-accent font-bold uppercase tracking-wider mb-2 text-sm">Why Choose R&G</h3>
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-brand-dark mb-6">
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
                <Link to="/about" className="text-brand-accent font-bold hover:text-brand-dark transition-colors inline-flex items-center">
                  Read My Story <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Bar */}
      <section className="bg-brand-dark py-12 text-center">
        <div className="max-w-7xl mx-auto px-4">
           <h4 className="text-slate-400 text-sm font-semibold uppercase tracking-widest mb-8">Trusted by Independent Owners Across New England</h4>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-8 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
             {/* Placeholders for logos */}
             <div className="text-white font-serif text-2xl font-bold flex items-center justify-center">The Portside</div>
             <div className="text-white font-serif text-2xl font-bold flex items-center justify-center">Salt & Vine</div>
             <div className="text-white font-serif text-2xl font-bold flex items-center justify-center">Harbor Grill</div>
             <div className="text-white font-serif text-2xl font-bold flex items-center justify-center">Main St. Tavern</div>
           </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-24 bg-brand-accent relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative z-10 max-w-4xl mx-auto text-center px-4">
          <h2 className="font-serif text-3xl md:text-5xl font-bold text-white mb-6">Ready to fix your restaurant tech?</h2>
          <p className="text-orange-100 text-lg mb-8 max-w-2xl mx-auto">
            Stop waiting on hold with support lines. Get a specialist who knows your business.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link 
              to="/quote" 
              className="px-8 py-4 bg-white text-brand-accent rounded-lg font-bold text-lg hover:bg-slate-100 transition-colors shadow-lg"
            >
              Build Your Quote
            </Link>
             <a
              href="tel:5082474936"
              className="px-8 py-4 bg-brand-dark text-white rounded-lg font-bold text-lg hover:bg-slate-800 transition-colors shadow-lg flex items-center justify-center gap-2"
            >
              <PhoneCall size={20} /> Call Now
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
