import React from 'react';
import { Link } from 'react-router-dom';
import { Check, ShieldCheck, Terminal, BookOpen, Clock, Activity } from 'lucide-react';

const Services: React.FC = () => {
  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      {/* Header */}
      <div className="bg-brand-primary py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="font-serif text-4xl font-bold text-white mb-4">Services</h1>
          <p className="text-slate-300 max-w-2xl mx-auto text-lg">
            Operational expertise meets technical precision. I build systems that survive the Friday night rush.
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
        
        <div className="mt-16 text-center">
          <div className="inline-block bg-brand-dark p-8 rounded-2xl shadow-xl">
             <h2 className="text-2xl font-bold text-white mb-4">Not sure what you need?</h2>
             <p className="text-slate-300 mb-6">Let's hop on a 15-minute discovery call. No sales pitch, just problem solving.</p>
             <Link to="/contact" className="inline-block bg-brand-accent text-white px-6 py-3 rounded-lg font-bold hover:bg-amber-600 transition-colors">
               Schedule Call
             </Link>
          </div>
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
  <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden flex flex-col md:flex-row">
    <div className="bg-slate-100 p-8 flex items-center justify-center md:w-1/4 border-r border-slate-200">
      <div className="text-center">
        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mx-auto mb-4">
          <Icon className="w-8 h-8 text-brand-dark" />
        </div>
        <div className="font-bold text-slate-400 uppercase tracking-widest text-xs">Core Service</div>
      </div>
    </div>
    <div className="p-8 md:w-3/4">
      <h3 className="font-serif text-2xl font-bold text-brand-dark mb-3">{title}</h3>
      <p className="text-slate-600 mb-6 leading-relaxed text-lg">{description}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {features.map((feature, idx) => (
          <div key={idx} className="flex items-start gap-3">
            <Check className="w-5 h-5 text-brand-accent flex-shrink-0 mt-0.5" />
            <span className="text-slate-700 text-sm font-medium">{feature}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default Services;