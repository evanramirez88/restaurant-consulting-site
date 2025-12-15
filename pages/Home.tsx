import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  MonitorCheck,
  Wifi,
  ClipboardList,
  PhoneCall,
  CheckCircle2,
  ChevronDown,
  Monitor,
  Users,
  ChefHat,
  Wine,
  FileText
} from 'lucide-react';
import ServiceCard from '../src/components/ServiceCard';
import FeatureRow from '../src/components/FeatureRow';
import { useSEO } from '../src/components/SEO';

const Home: React.FC = () => {
  useSEO({
    title: 'Toast POS Consultant Cape Cod | R&G Consulting LLC',
    description: 'Expert Toast POS installation, menu configuration, and restaurant networking in Cape Cod, MA. Get your free quote today! Call (508) 247-4936.',
    canonical: 'https://ccrestaurantconsulting.com/',
  });

  return (
    <div className="flex flex-col">
      {/* Hero Section - Full viewport with animated gradient */}
      <section className="relative h-screen min-h-[600px] flex flex-col items-center justify-center overflow-hidden hero-animated-gradient hero-grain -mt-[72px]">
        {/* Brass horizontal line - draws across on load */}
        <div className="absolute top-1/3 left-0 right-0 z-10">
          <div className="brass-draw-line mx-auto max-w-4xl" />
        </div>

        {/* Main content container */}
        <div className="relative z-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Main headline */}
          <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-bold text-cream leading-tight mb-6 hero-fade-in hero-fade-in-delay-1">
            Restaurant Technology.
            <br />
            <span className="text-cream">Expertly Implemented.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-mist mb-10 font-normal tracking-wide hero-fade-in hero-fade-in-delay-2">
            Toast POS &bull; Networking &bull; Operations Consulting
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center hero-fade-in hero-fade-in-delay-3">
            <Link
              to="/quote"
              className="inline-flex items-center justify-center px-8 py-4 bg-mint text-ink rounded-lg font-bold text-lg hover:bg-mint/90 transition-all shadow-lg glow-mint"
            >
              Build Your Quote
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
            <Link
              to="/schedule"
              className="inline-flex items-center justify-center px-8 py-4 bg-transparent text-cream border border-brass rounded-lg font-bold text-lg hover:bg-brass/10 hover:text-brass transition-all"
            >
              Schedule Consultation
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 hero-fade-in hero-fade-in-delay-4">
          <span className="text-mist text-sm font-medium tracking-wide">Scroll to explore</span>
          <ChevronDown className="w-5 h-5 text-mist scroll-indicator" />
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-20 bg-coal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-cream mb-4">Toast POS Installation &amp; Restaurant Technology Services</h2>
            <p className="text-mist text-lg">
              From POS installation to restaurant networking, we deliver operational solutions—not just IT support. <Link to="/services" className="text-bay hover:text-brass transition-colors">View all services</Link>.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <ServiceCard
              icon={MonitorCheck}
              title="Toast POS Installation"
              description="Full hardware deployment, menu configuration, and staff training. We're online before the dinner rush."
              link="/services"
            />
            <ServiceCard
              icon={Wifi}
              title="Restaurant Networking"
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
              title="Emergency POS Support"
              description="The 'Restaurant 911'. Tech, staffing, or crisis management available nights and weekends."
              link="/contact"
            />
          </div>
        </div>
      </section>

      {/* Comprehensive Services Grid */}
      <section className="py-20 bg-ink">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-cream mb-4">
              Comprehensive Restaurant Solutions
            </h2>
            <p className="text-mist text-lg">
              From technology to training, we've got you covered.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Toast POS Services */}
            <Link
              to="/services"
              className="group relative bg-coal p-6 rounded-r-lg border-l-4 border-t-4 border-l-brass border-t-transparent transition-all duration-300 hover:-translate-y-2 hover:shadow-xl hover:shadow-brass/20 hover:border-t-brass"
            >
              <Monitor className="w-8 h-8 text-brass mb-4 transition-transform duration-300 group-hover:scale-110" />
              <h3 className="font-serif text-xl font-bold text-cream mb-2">Toast POS Services</h3>
              <p className="text-mist text-sm leading-relaxed">
                Complete installation, configuration, and staff training for your restaurant's point-of-sale system.
              </p>
            </Link>

            {/* Networking & IT */}
            <Link
              to="/services"
              className="group relative bg-coal p-6 rounded-r-lg border-l-4 border-t-4 border-l-brass border-t-transparent transition-all duration-300 hover:-translate-y-2 hover:shadow-xl hover:shadow-brass/20 hover:border-t-brass"
            >
              <Wifi className="w-8 h-8 text-brass mb-4 transition-transform duration-300 group-hover:scale-110" />
              <h3 className="font-serif text-xl font-bold text-cream mb-2">Networking & IT</h3>
              <p className="text-mist text-sm leading-relaxed">
                Enterprise-grade WiFi, network infrastructure, and IT solutions built for high-volume hospitality.
              </p>
            </Link>

            {/* Front of House Operations */}
            <Link
              to="/services"
              className="group relative bg-coal p-6 rounded-r-lg border-l-4 border-t-4 border-l-brass border-t-transparent transition-all duration-300 hover:-translate-y-2 hover:shadow-xl hover:shadow-brass/20 hover:border-t-brass"
            >
              <Users className="w-8 h-8 text-brass mb-4 transition-transform duration-300 group-hover:scale-110" />
              <h3 className="font-serif text-xl font-bold text-cream mb-2">Front of House Operations</h3>
              <p className="text-mist text-sm leading-relaxed">
                Service flow optimization, table management, and guest experience enhancement strategies.
              </p>
            </Link>

            {/* Kitchen & Back of House */}
            <Link
              to="/services"
              className="group relative bg-coal p-6 rounded-r-lg border-l-4 border-t-4 border-l-brass border-t-transparent transition-all duration-300 hover:-translate-y-2 hover:shadow-xl hover:shadow-brass/20 hover:border-t-brass"
            >
              <ChefHat className="w-8 h-8 text-brass mb-4 transition-transform duration-300 group-hover:scale-110" />
              <h3 className="font-serif text-xl font-bold text-cream mb-2">Kitchen & Back of House</h3>
              <p className="text-mist text-sm leading-relaxed">
                Line efficiency, prep workflows, and kitchen display system setup for seamless BOH operations.
              </p>
            </Link>

            {/* Bar Programs */}
            <Link
              to="/services"
              className="group relative bg-coal p-6 rounded-r-lg border-l-4 border-t-4 border-l-brass border-t-transparent transition-all duration-300 hover:-translate-y-2 hover:shadow-xl hover:shadow-brass/20 hover:border-t-brass"
            >
              <Wine className="w-8 h-8 text-brass mb-4 transition-transform duration-300 group-hover:scale-110" />
              <h3 className="font-serif text-xl font-bold text-cream mb-2">Bar Programs</h3>
              <p className="text-mist text-sm leading-relaxed">
                Beverage menu development, inventory control, and bar workflow optimization for profitability.
              </p>
            </Link>

            {/* Admin & SOPs */}
            <Link
              to="/services"
              className="group relative bg-coal p-6 rounded-r-lg border-l-4 border-t-4 border-l-brass border-t-transparent transition-all duration-300 hover:-translate-y-2 hover:shadow-xl hover:shadow-brass/20 hover:border-t-brass"
            >
              <FileText className="w-8 h-8 text-brass mb-4 transition-transform duration-300 group-hover:scale-110" />
              <h3 className="font-serif text-xl font-bold text-cream mb-2">Admin & SOPs</h3>
              <p className="text-mist text-sm leading-relaxed">
                Standard operating procedures, documentation systems, and administrative workflow design.
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* Value Prop / Split Section */}
      <section className="bg-slate py-20 border-y border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="lg:w-1/2">
              <img
                src="https://images.unsplash.com/photo-1590846406792-0adc7f938f1d?ixlib=rb-4.0.3&auto=format&fit=crop&w=985&q=80"
                alt="Restaurant kitchen workflow during service - POS consultant understands operations"
                className="rounded-2xl shadow-2xl border border-line"
              />
            </div>
            <div className="lg:w-1/2">
              <span className="text-brass font-bold uppercase tracking-wider mb-2 text-sm block brass-line-static">Why Choose R&amp;G Consulting</span>
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-cream mb-6">
                Restaurant Technology Consulting From Someone Who's Worked the Line
              </h2>
              <div className="space-y-6">
                <FeatureRow
                  title="Restaurant-Native Expertise"
                  desc="I speak '86', 'on the fly', and 'in the weeds'. No translation needed for your Toast POS setup."
                />
                <FeatureRow
                  title="After-Hours Availability"
                  desc="60% of my meetings happen in the evening because that's when you're available."
                />
                <FeatureRow
                  title="Transparent Quoting"
                  desc="My algorithmic quoting system gives you accurate POS installation numbers in minutes."
                />
              </div>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link to="/about" className="text-brass font-bold hover:text-mint transition-colors inline-flex items-center brass-line">
                  About the Consultant <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
                <Link to="/contact" className="text-mist font-bold hover:text-brass transition-colors inline-flex items-center">
                  Get in Touch <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Bar */}
      <section className="bg-ink py-12 text-center border-y border-line">
        <div className="max-w-7xl mx-auto px-4">
           <p className="text-mist text-sm font-semibold uppercase tracking-widest mb-8">Trusted by Independent Restaurant Owners Across Cape Cod &amp; SE Massachusetts</p>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-8 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
             <div className="text-cream font-serif text-2xl font-bold flex items-center justify-center">The Portside</div>
             <div className="text-cream font-serif text-2xl font-bold flex items-center justify-center">Salt &amp; Vine</div>
             <div className="text-cream font-serif text-2xl font-bold flex items-center justify-center">Harbor Grill</div>
             <div className="text-cream font-serif text-2xl font-bold flex items-center justify-center">Main St. Tavern</div>
           </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-slate via-coal to-ink relative overflow-hidden grain-overlay">
        <div className="absolute inset-0 bg-brass/5"></div>
        <div className="relative z-10 max-w-4xl mx-auto text-center px-4">
          <h2 className="font-serif text-3xl md:text-5xl font-bold text-cream mb-6">Ready for Professional POS Installation in Cape Cod?</h2>
          <p className="text-mist text-lg mb-8 max-w-2xl mx-auto">
            Stop waiting on hold with support lines. Get a Toast POS specialist who understands your restaurant. <Link to="/contact" className="text-bay underline hover:text-brass transition-colors">Contact us today</Link>.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              to="/quote"
              className="px-8 py-4 bg-mint text-ink rounded-lg font-bold text-lg hover:bg-mint/90 transition-colors shadow-lg glow-mint"
            >
              Build Your Quote
            </Link>
            <a
              href="tel:5082474936"
              className="px-8 py-4 bg-coal text-cream border border-line rounded-lg font-bold text-lg hover:border-brass hover:text-brass transition-colors shadow-lg flex items-center justify-center gap-2"
            >
              <PhoneCall size={20} /> Call (508) 247-4936
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
