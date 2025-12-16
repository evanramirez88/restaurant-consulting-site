import React from 'react';
import { Link } from 'react-router-dom';
import { OWNER_NAME } from '../constants';
import { useSEO } from '../src/components/SEO';

const About: React.FC = () => {
  useSEO({
    title: 'About Our Toast POS Consultant | Cape Cod Restaurant Tech',
    description: 'Meet Evan Ramirez, Cape Cod\'s trusted Toast POS consultant with real restaurant experience. From dishwasher to tech expert. Call (508) 247-4936.',
    canonical: 'https://ccrestaurantconsulting.com/#/about',
  });

  return (
    <div className="bg-ink">
      {/* Header - extends behind transparent nav */}
      <div className="bg-coal py-20 pt-28 text-center border-b border-line -mt-[72px]">
        <div className="animate-on-scroll">
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-cream mb-4">Cape Cod's Restaurant Technology Consultant</h1>
          <div className="brass-line-draw short mb-6" />
          <p className="text-mist text-lg max-w-2xl mx-auto px-4">Toast POS expertise from someone who's worked every station in your kitchen.</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="prose prose-lg prose-invert mx-auto animate-on-scroll">
          <p className="lead text-xl text-cream font-semibold mb-8">
            I didn't start in IT. I started in kitchens.
          </p>

          <p className="mb-6 text-mist">
            I've worked every position in a restaurant—from dishwasher scrubbing pans at midnight to floor manager dealing with a Friday rush and a broken POS. I know what it's like when your KDS goes down an hour before the dinner push. I know the panic when your online ordering stops working on a Saturday night. I've lived it.
          </p>

          <p className="mb-6 font-bold text-cream">
            That's why I do this work differently.
          </p>

          <p className="mb-6 text-mist">
            When a typical IT vendor shows up, they see network configurations and hardware specs. When I show up, I see your operation. I know you can't shut down for 'standard maintenance windows.' I know you need someone who can explain technical problems in plain English while you're managing fifty other fires. I know the difference between 'fixed' and 'fixed right.'
          </p>

          <div className="my-10 border-l-4 border-brass pl-6 py-2 italic text-mist bg-slate/50 rounded-r-lg">
            "I became the bridge. Someone who speaks fluent restaurant AND fluent tech."
          </div>

          <h2 className="font-serif text-2xl font-bold text-cream mb-4">Why I Specialize in Toast POS</h2>
          <p className="mb-6 text-mist">
            After years in restaurants, I specialized in Toast POS—not because it was trendy, but because I saw how much restaurants struggled with vendors who didn't understand their world. Toast POS installation and menu configuration require someone who understands both the technology and the operation.
          </p>

          <p className="mb-12 text-mist">
            Now I work with independent restaurants and small groups across Cape Cod, South Shore, and SE Massachusetts. I handle <Link to="/services" className="text-bay hover:text-brass transition-colors">Toast POS installation</Link>, network setup, menu configuration, and operations consulting—and show up when things go sideways, evenings, weekends, whenever you need me.
          </p>

          <hr className="my-12 border-line" />

          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-slate rounded-full flex-shrink-0 overflow-hidden border border-line">
               <img src="https://images.unsplash.com/photo-1556157382-97eda2d62296?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80" alt={`${OWNER_NAME} - Toast POS Consultant Cape Cod`} className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="font-serif text-2xl font-bold text-cream">{OWNER_NAME}</h2>
              <p className="text-mist">Owner &amp; Principal Consultant</p>
              <p className="text-brass font-semibold text-sm">R&amp;G Consulting LLC</p>
            </div>
          </div>

        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-slate py-16 border-t border-line">
        <div className="max-w-4xl mx-auto px-4 text-center animate-on-scroll">
          <h2 className="font-serif text-2xl md:text-3xl font-bold text-cream mb-4">Ready to Work Together?</h2>
          <div className="brass-line-draw short mb-6" />
          <p className="text-mist mb-8">
            Let's discuss your Toast POS installation, restaurant networking needs, or operational challenges.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              to="/contact"
              className="px-6 py-3 bg-mint text-ink rounded-lg font-bold hover:bg-mint/90 transition-colors glow-pulse"
            >
              Get in Touch
            </Link>
            <Link
              to="/services"
              className="px-6 py-3 bg-coal border border-line text-cream rounded-lg font-bold hover:border-brass hover:text-brass transition-colors"
            >
              View Services
            </Link>
            <Link
              to="/schedule"
              className="px-6 py-3 bg-coal border border-line text-cream rounded-lg font-bold hover:border-brass hover:text-brass transition-colors"
            >
              Schedule a Call
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
