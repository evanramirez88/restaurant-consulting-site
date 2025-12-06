import React from 'react';
import { OWNER_NAME } from '../constants';

const About: React.FC = () => {
  return (
    <div className="bg-white">
      <div className="bg-brand-primary py-20 text-center">
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-white mb-4">The Face Behind the Tech</h1>
        <p className="text-slate-300 text-lg max-w-2xl mx-auto">It's not about the wires. It's about the service.</p>
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

          <p className="mb-6">
            After years in restaurants, I specialized in Toast POS—not because it was trendy, but because I saw how much restaurants struggled with vendors who didn't understand their world. 
          </p>

          <p className="mb-12">
            Now I work with independent restaurants and small groups across New England. I install systems, fix networks, optimize operations, and show up when things go sideways—evenings, weekends, whenever you need me. Because I remember what it was like to be on your side of the phone at 11 PM on a Friday.
          </p>

          <hr className="my-12 border-slate-200" />

          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-slate-200 rounded-full flex-shrink-0 overflow-hidden">
               {/* Placeholder for Evan's photo */}
               <img src="https://images.unsplash.com/photo-1556157382-97eda2d62296?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80" alt={OWNER_NAME} className="w-full h-full object-cover" />
            </div>
            <div>
              <h3 className="font-serif text-2xl font-bold text-brand-dark">{OWNER_NAME}</h3>
              <p className="text-slate-500">Owner & Principal Consultant</p>
              <p className="text-brand-accent font-semibold text-sm">R&G Consulting LLC</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default About;