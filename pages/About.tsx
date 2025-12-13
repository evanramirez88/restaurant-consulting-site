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
    <div className="bg-white">
      <div className="bg-brand-primary py-20 text-center">
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-white mb-4">Cape Cod's Restaurant Technology Consultant</h1>
        <p className="text-slate-300 text-lg max-w-2xl mx-auto">Toast POS expertise from someone who's worked every station in your kitchen.</p>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="prose prose-lg prose-slate mx-auto">
          <p className="lead text-xl text-slate-800 font-semibold mb-8">
            I didn't start in IT. I started in kitchens.
          </p>

          <p className="mb-6">
            I've worked every position in a restaurant—from dishwasher scrubbing pans at midnight to floor manager dealing with a Friday rush and a broken POS. I know what it's like when your KDS goes down an hour before the dinner push. I know the panic when your online ordering stops working on a Saturday night. I've lived it.
          </p>

          <p className="mb-6 font-bold text-brand-dark">
            That's why I do this work differently.
          </p>

          <p className="mb-6">
            When a typical IT vendor shows up, they see network configurations and hardware specs. When I show up, I see your operation. I know you can't shut down for 'standard maintenance windows.' I know you need someone who can explain technical problems in plain English while you're managing fifty other fires. I know the difference between 'fixed' and 'fixed right.'
          </p>

          <div className="my-10 border-l-4 border-brand-accent pl-6 py-2 italic text-slate-600 bg-slate-50">
            "I became the bridge. Someone who speaks fluent restaurant AND fluent tech."
          </div>

          <h2 className="font-serif text-2xl font-bold text-brand-dark mb-4">Why I Specialize in Toast POS</h2>
          <p className="mb-6">
            After years in restaurants, I specialized in Toast POS—not because it was trendy, but because I saw how much restaurants struggled with vendors who didn't understand their world. Toast POS installation and menu configuration require someone who understands both the technology and the operation.
          </p>

          <p className="mb-12">
            Now I work with independent restaurants and small groups across Cape Cod, South Shore, and SE Massachusetts. I handle <Link to="/services" className="text-brand-accent hover:underline">Toast POS installation</Link>, network setup, menu configuration, and operations consulting—and show up when things go sideways, evenings, weekends, whenever you need me.
          </p>

          <hr className="my-12 border-slate-200" />

          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-slate-200 rounded-full flex-shrink-0 overflow-hidden">
               <img src="https://images.unsplash.com/photo-1556157382-97eda2d62296?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80" alt={`${OWNER_NAME} - Toast POS Consultant Cape Cod`} className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="font-serif text-2xl font-bold text-brand-dark">{OWNER_NAME}</h2>
              <p className="text-slate-500">Owner &amp; Principal Consultant</p>
              <p className="text-brand-accent font-semibold text-sm">R&amp;G Consulting LLC</p>
            </div>
          </div>

        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-slate-50 py-16 border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="font-serif text-2xl md:text-3xl font-bold text-brand-dark mb-4">Ready to Work Together?</h2>
          <p className="text-slate-600 mb-8">
            Let's discuss your Toast POS installation, restaurant networking needs, or operational challenges.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              to="/contact"
              className="px-6 py-3 bg-brand-accent text-white rounded-lg font-bold hover:bg-orange-600 transition-colors"
            >
              Get in Touch
            </Link>
            <Link
              to="/services"
              className="px-6 py-3 bg-white border border-slate-300 text-brand-dark rounded-lg font-bold hover:bg-slate-50 transition-colors"
            >
              View Services
            </Link>
            <Link
              to="/schedule"
              className="px-6 py-3 bg-white border border-slate-300 text-brand-dark rounded-lg font-bold hover:bg-slate-50 transition-colors"
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