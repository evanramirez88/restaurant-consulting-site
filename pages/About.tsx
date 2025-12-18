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
      {/* Hero Section */}
      <div className="bg-primary-dark py-20 pt-12 text-center border-b border-gray-800">
        <div className="animate-on-scroll">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">The Face Behind the Tech</h1>
          <div className="brass-line-draw short mb-6" />
          <p className="text-gray-400 text-lg max-w-2xl mx-auto px-4 italic">It's not about the wires. It's about the service.</p>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="prose prose-lg mx-auto animate-on-scroll">
          <p className="lead text-xl text-gray-900 font-bold mb-8">
            I didn't start in IT. I started in kitchens.
          </p>

          <p className="mb-6 text-gray-600">
            I've worked every position in a restaurant—from dishwasher scrubbing pans at midnight to floor manager dealing with a Friday rush and a broken POS. I know what it's like when your KDS goes down an hour before the dinner push. I know the panic when your online ordering stops working on a Saturday night. I've lived it.
          </p>

          <p className="mb-6 font-bold text-gray-900">
            That's why I do this work differently.
          </p>

          <p className="mb-6 text-gray-600">
            When a typical IT vendor shows up, they see network configurations and hardware specs. When I show up, I see your operation. I know you can't shut down for 'standard maintenance windows.' I know you need someone who can explain technical problems in plain English while you're managing fifty other fires. I know the difference between 'fixed' and 'fixed right.'
          </p>

          <div className="my-10 border-l-4 border-amber-500 pl-6 py-4 italic text-gray-700 bg-gray-50 rounded-r-lg">
            "I became the bridge. Someone who speaks fluent restaurant AND fluent tech."
          </div>

          <p className="mb-6 text-gray-600">
            After years in restaurants, I specialized in Toast POS—not because it was trendy, but because I saw how much restaurants struggled with vendors who didn't understand their world.
          </p>

          <p className="mb-12 text-gray-600">
            Now I work with independent restaurants and small groups across New England. I install systems, fix networks, optimize operations, and show up when things go sideways—evenings, weekends, whenever you need me. Because I remember what it was like to be on your side of the phone at 11 PM on a Friday.
          </p>

          <hr className="my-12 border-gray-200" />

          {/* Author Card */}
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex-shrink-0 overflow-hidden border border-gray-200">
               <img src="https://images.unsplash.com/photo-1556157382-97eda2d62296?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80" alt={`${OWNER_NAME} - Toast POS Consultant Cape Cod`} className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-gray-900">{OWNER_NAME}</h2>
              <p className="text-gray-600">Owner &amp; Principal Consultant</p>
              <p className="text-amber-500 font-semibold text-sm">R&amp;G Consulting LLC</p>
            </div>
          </div>

        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gray-50 py-16 border-t border-gray-200">
        <div className="max-w-4xl mx-auto px-4 text-center animate-on-scroll">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-gray-900 mb-4">Ready to Work Together?</h2>
          <div className="brass-line-draw short mb-6" />
          <p className="text-gray-600 mb-8">
            Let's discuss your Toast POS installation, restaurant networking needs, or operational challenges.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              to="/contact"
              className="px-6 py-3 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 transition-colors glow-pulse"
            >
              Get in Touch
            </Link>
            <Link
              to="/services"
              className="px-6 py-3 bg-white text-primary-dark border-2 border-primary-dark rounded-lg font-bold hover:bg-primary-dark hover:text-white transition-all shadow-sm"
            >
              View Services
            </Link>
            <Link
              to="/schedule"
              className="px-6 py-3 bg-white text-primary-dark border-2 border-primary-dark rounded-lg font-bold hover:bg-primary-dark hover:text-white transition-all shadow-sm"
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
