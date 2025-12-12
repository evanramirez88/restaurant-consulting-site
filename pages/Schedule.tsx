import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, CheckCircle2, Phone } from 'lucide-react';
import { PHONE_NUMBER } from '../constants';

// Acuity Scheduling configuration
const ACUITY_OWNER_ID = '34242148';
const ACUITY_EMBED_URL = `https://app.acuityscheduling.com/schedule.php?owner=${ACUITY_OWNER_ID}`;

const Schedule: React.FC = () => {
  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Hero Section */}
      <div className="bg-brand-dark py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-accent/10 text-brand-accent border border-brand-accent/20 text-sm font-semibold mb-6">
            <Calendar className="w-4 h-4" />
            Book Online 24/7
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-white mb-4">
            Schedule a <span className="text-brand-accent">Consultation</span>
          </h1>
          <p className="text-slate-300 text-lg max-w-2xl mx-auto">
            Pick a time that works for you. Whether it's a quick discovery call or a full project consultation,
            I'll make time to understand your restaurant's needs.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Info Sidebar */}
          <div className="space-y-6">
            {/* What to Expect Card */}
            <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-brand-accent">
              <h3 className="font-serif text-xl font-bold text-brand-dark mb-4">What to Expect</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="text-brand-accent w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-800">Discovery Call (15-30 min)</p>
                    <p className="text-sm text-slate-600">Quick intro to discuss your challenges and see if we're a good fit.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="text-brand-accent w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-800">Project Consultation (45-60 min)</p>
                    <p className="text-sm text-slate-600">Deep dive into your setup, goals, and a roadmap for your project.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="text-brand-accent w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-800">Site Visit (Scheduled Separately)</p>
                    <p className="text-sm text-slate-600">On-location assessment for complex installations.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Availability Info */}
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-brand-primary/10 p-2 rounded-lg">
                  <Clock className="text-brand-primary w-5 h-5" />
                </div>
                <h3 className="font-semibold text-brand-dark">Flexible Hours</h3>
              </div>
              <p className="text-slate-600 text-sm">
                60% of my meetings happen in the evening because that's when you're available.
                I work around your service schedule.
              </p>
            </div>

            {/* Urgent Support */}
            <div className="bg-brand-dark p-6 rounded-xl">
              <h3 className="text-white font-semibold mb-2">Need Urgent Support?</h3>
              <p className="text-slate-300 text-sm mb-4">
                POS down during service? Skip the calendar and call directly.
              </p>
              <a
                href={`tel:${PHONE_NUMBER}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-accent text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors"
              >
                <Phone className="w-4 h-4" />
                {PHONE_NUMBER}
              </a>
            </div>

            {/* Alternative Actions */}
            <div className="text-center space-y-3">
              <p className="text-sm text-slate-500">Prefer to explore first?</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  to="/quote"
                  className="flex-1 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:border-brand-accent hover:text-brand-accent transition-colors text-center"
                >
                  Build a Quote
                </Link>
                <Link
                  to="/contact"
                  className="flex-1 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:border-brand-accent hover:text-brand-accent transition-colors text-center"
                >
                  Send Message
                </Link>
              </div>
            </div>
          </div>

          {/* Acuity Calendar Embed */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50">
                <h2 className="font-serif text-xl font-bold text-brand-dark">Select a Time</h2>
                <p className="text-sm text-slate-600">Choose an appointment type and pick a slot that works for you.</p>
              </div>

              {/* Acuity Scheduling iframe embed */}
              <div className="acuity-embed-container">
                <iframe
                  src={ACUITY_EMBED_URL}
                  title="Schedule Appointment"
                  width="100%"
                  height="800"
                  frameBorder="0"
                  className="w-full"
                  style={{ minHeight: '800px' }}
                ></iframe>
              </div>

              {/* Fallback link if iframe doesn't load */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 text-center">
                <p className="text-sm text-slate-500">
                  Calendar not loading?{' '}
                  <a
                    href={ACUITY_EMBED_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-accent hover:underline font-medium"
                  >
                    Open scheduler in new tab
                  </a>
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* CTA Section */}
      <section className="py-16 bg-brand-accent relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative z-10 max-w-4xl mx-auto text-center px-4">
          <h2 className="font-serif text-2xl md:text-3xl font-bold text-white mb-4">
            Not Sure What You Need?
          </h2>
          <p className="text-orange-100 mb-6 max-w-xl mx-auto">
            Start with a free discovery call. We'll figure out the right approach together.
          </p>
          <Link
            to="/services"
            className="inline-flex items-center px-6 py-3 bg-white text-brand-accent rounded-lg font-bold hover:bg-slate-100 transition-colors shadow-lg"
          >
            View Our Services
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Schedule;
