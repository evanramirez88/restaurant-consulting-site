import React from 'react';
import { Link } from 'react-router-dom';
import { Check, ShieldCheck, Terminal, BookOpen, Clock, Activity } from 'lucide-react';
import { useSEO } from '../src/components/SEO';

const Services: React.FC = () => {
  useSEO({
    title: 'Toast POS Installation & Restaurant Services | Cape Cod',
    description: 'Professional Toast POS installation, menu configuration, restaurant networking, and operations consulting in Cape Cod & SE Massachusetts. Get a free quote!',
    canonical: 'https://ccrestaurantconsulting.com/#/services',
  });

  return (
    <div className="bg-white min-h-screen pb-20">
      {/* Header */}
      <div className="bg-primary-dark py-16 pt-8 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center animate-on-scroll">
          <h1 className="font-display text-4xl font-bold text-white mb-4">Toast POS Installation &amp; Restaurant Technology Services</h1>
          <div className="brass-line-draw short mb-6" />
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Professional POS installation, menu configuration, and restaurant networking in Cape Cod. Systems built to survive the Friday night rush.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8">
        <div className="space-y-12">

          {/* Service 1 */}
          <ServiceSection
            title="Toast POS Installation & Configuration"
            icon={Terminal}
            description="Don't trust your install to a generic IT contractor. I configure your menu, modifiers, and hardware specifically for your kitchen's workflow."
            features={[
              "Hardware deployment (Terminals, KDS, Printers)",
              "Menu engineering and modifier group optimization",
              "Staff training (FOH & BOH specific sessions)",
              "Go-live support (I stay for the first service)"
            ]}
          />

          {/* Service 2 */}
          <ServiceSection
            title="Restaurant Networking & IT"
            icon={Activity}
            description="If your internet drops, you can't print tickets. I build redundant, commercial-grade networks designed to handle heavy guest wifi traffic without compromising your POS."
            features={[
              "Ubiquiti/Cisco/Meraki configuration",
              "LTE Failover setup (never lose a credit card auth)",
              "Separate Guest/Staff/POS VLANs",
              "Structured cabling & cable management"
            ]}
          />

          {/* Service 3 */}
          <ServiceSection
            title="Operational Consulting"
            icon={BookOpen}
            description="The best POS in the world won't fix a bad line setup. I analyze your FOH and BOH operations to reduce ticket times and increase table turns."
            features={[
              "Ticket routing analysis",
              "Server station optimization",
              "Bar inventory workflow",
              "Standard Operating Procedures (SOPs) development"
            ]}
          />

           {/* Service 4 */}
           <ServiceSection
            title="Emergency Support"
            icon={ShieldCheck}
            description="The 'Restaurant 911'. When things break at 8 PM on a Friday, you need someone who picks up the phone and fixes it immediately."
            features={[
              "24/7 On-call availability (retainer based)",
              "Remote diagnostics & repair",
              "Emergency hardware replacement",
              "Crisis management"
            ]}
          />

        </div>

        <div className="mt-16 text-center animate-on-scroll">
          <div className="inline-block bg-gray-50 p-8 rounded-2xl shadow-xl border border-gray-200 border-l-4 border-l-amber-500 card-hover-glow">
             <h2 className="text-2xl font-bold text-gray-900 mb-4">Need a Custom POS Solution?</h2>
             <div className="brass-line-draw short mb-4" />
             <p className="text-gray-600 mb-6">Let's hop on a 15-minute discovery call. No sales pitch, just problem solving for your restaurant.</p>
             <div className="flex flex-col sm:flex-row gap-4 justify-center">
               <Link
                 to="/schedule"
                 className="inline-block px-6 py-3 rounded-lg font-semibold transition-all glow-pulse shadow-md btn-hover"
                 style={{ backgroundColor: '#ea580c', color: '#ffffff' }}
               >
                 Schedule a Call
               </Link>
               <Link
                 to="/quote"
                 className="inline-block px-6 py-3 rounded-lg font-semibold transition-all shadow-md btn-hover"
                 style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
               >
                 Build Your Quote
               </Link>
             </div>
          </div>
        </div>

        {/* Service Area Info */}
        <div className="mt-12 text-center">
          <p className="text-gray-600">
            Serving restaurants in <strong className="text-gray-900">Cape Cod</strong>, <strong className="text-gray-900">South Shore</strong>, and <strong className="text-gray-900">Southeastern Massachusetts</strong>.{' '}
            <Link to="/contact" className="text-amber-500 hover:underline transition-colors">Contact us</Link> to discuss your project.
          </p>
        </div>
      </div>
    </div>
  );
};

const ServiceSection: React.FC<{
  title: string,
  description: string,
  features: string[],
  icon: React.ElementType
}> = ({ title, description, features, icon: Icon }) => (
  <div className="bg-white rounded-xl shadow-md border border-gray-200 border-l-4 border-l-amber-500 overflow-hidden flex flex-col md:flex-row animate-on-scroll card-hover-glow">
    <div className="bg-gray-50 p-8 flex items-center justify-center md:w-1/4 border-r border-gray-200">
      <div className="text-center">
        <div className="w-16 h-16 bg-primary-dark rounded-full flex items-center justify-center shadow-sm mx-auto mb-4">
          <Icon className="w-8 h-8 text-white" />
        </div>
        <div className="font-bold text-gray-500 uppercase tracking-widest text-xs">Core Service</div>
      </div>
    </div>
    <div className="p-8 md:w-3/4">
      <h2 className="font-display text-2xl font-bold text-gray-900 mb-3">{title}</h2>
      <p className="text-gray-600 mb-6 leading-relaxed text-lg">{description}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {features.map((feature, idx) => (
          <div key={idx} className="flex items-start gap-3">
            <Check className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <span className="text-gray-700 text-sm font-medium">{feature}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default Services;
