import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MonitorCheck, Wifi, ClipboardList, PhoneCall, CheckCircle2 } from 'lucide-react';
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
      {/* Hero Section */}
      <section className="relative bg-ink min-h-[600px] flex items-center overflow-hidden grain-overlay">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1556742049-0cfed4f7a07d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80"
            alt="Toast POS terminal installation in restaurant kitchen"
            className="w-full h-full object-cover opacity-15"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/95 to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-16">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brass/10 text-brass border border-brass/20 text-sm font-semibold mb-6">
              <span className="w-2 h-2 rounded-full bg-brass animate-pulse"></span>
              Toast POS Consultant in Cape Cod
            </div>
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold text-cream leading-tight mb-6">
              Cape Cod's Trusted <span className="text-brass">Toast POS Consultant</span> &amp; Restaurant Tech Expert
            </h1>
            <p className="text-lg text-mist mb-8 leading-relaxed">
              Toast POS installation, networking, and operational consulting from someone who's worked every station in your kitchen. I don't just fix wires; I fix workflows.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/quote"
                className="inline-flex items-center justify-center px-8 py-4 bg-mint text-ink rounded-lg font-bold text-lg hover:bg-mint/90 transition-all shadow-lg glow-mint"
              >
                Get Your Free Quote
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
              <Link
                to="/schedule"
                className="inline-flex items-center justify-center px-8 py-4 bg-cream/10 text-cream border border-line rounded-lg font-bold text-lg hover:bg-cream/20 hover:border-brass transition-all backdrop-blur-sm"
              >
                Schedule Discovery Call
              </Link>
            </div>

            {/* Quick Trust Indicators */}
            <div className="mt-12 flex flex-wrap gap-x-8 gap-y-4 text-mist text-sm font-medium">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="text-mint w-4 h-4" />
                <span>50+ Restaurants Served</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="text-mint w-4 h-4" />
                <span>Toast Certified Partner</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="text-mint w-4 h-4" />
                <span>Same-Day Invoicing</span>
              </div>
            </div>
          </div>
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
