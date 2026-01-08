import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, CheckCircle2, Phone } from 'lucide-react';
import { PHONE_NUMBER } from '../constants';
import { useSEO } from '../src/components/SEO';

// Cal.com Scheduling configuration
const CALCOM_USERNAME = 'r-g-consulting';
const CALCOM_EMBED_URL = `https://cal.com/${CALCOM_USERNAME}`;

// Legacy Acuity (kept for reference)
// const ACUITY_OWNER_ID = '34242148';
// const ACUITY_EMBED_URL = `https://app.acuityscheduling.com/schedule.php?owner=${ACUITY_OWNER_ID}`;

const Schedule: React.FC = () => {
  useSEO({
    title: 'Schedule a Toast POS Consultation | Cape Cod Restaurant Tech',
    description: 'Book a free consultation with Cape Cod\'s Toast POS expert. Discuss POS installation, menu configuration, or networking needs. Flexible scheduling available.',
    canonical: 'https://ccrestaurantconsulting.com/#/schedule',
  });

  return (
    <div className="bg-white min-h-screen">
      {/* Hero Section */}
      <div className="bg-primary-dark py-16 pt-8 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white border border-white/20 text-sm font-semibold mb-6">
            <Calendar className="w-4 h-4" />
            Book Online 24/7
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">
            Schedule a <span className="text-gray-300">Toast POS Consultation</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Book time with Cape Cod's Toast POS consultants. Whether it's a quick discovery call or a full project consultation,
            we'll make time to understand your restaurant's needs.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Info Sidebar */}
          <div className="space-y-6">
            {/* What to Expect Card */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 border-l-4 border-l-amber-500">
              <h3 className="font-display text-xl font-bold text-gray-900 mb-4">What to Expect</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="text-amber-500 w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900">Discovery Call (15 min)</p>
                    <p className="text-sm text-gray-600">Quick intro to discuss your restaurant technology challenges and see if we're a good fit.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="text-amber-500 w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900">Toast POS Support (30 min)</p>
                    <p className="text-sm text-gray-600">Troubleshooting session for menu updates, configuration questions, or technical issues.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="text-amber-500 w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900">Project Consultation (45 min)</p>
                    <p className="text-sm text-gray-600">In-depth discussion of your project goals, current setup, and roadmap for success.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Availability Info */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 border-l-4 border-l-amber-500">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-primary-dark p-2 rounded-lg">
                  <Clock className="text-white w-5 h-5" />
                </div>
                <h3 className="font-semibold text-gray-900">Flexible Hours</h3>
              </div>
              <p className="text-gray-600 text-sm">
                60% of our meetings happen in the evening because that's when you're available.
                We work around your service schedule.
              </p>
            </div>

            {/* Urgent Support */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 border-l-4 border-l-amber-500">
              <h3 className="font-display text-lg font-bold text-gray-900 mb-2">Need Urgent Support?</h3>
              <p className="text-gray-600 text-sm mb-4">
                POS down during service? Skip the calendar and call directly.
              </p>
              <a
                href={`tel:${PHONE_NUMBER}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all hover:opacity-90"
                style={{ backgroundColor: '#ea580c', color: '#ffffff' }}
              >
                <Phone className="w-4 h-4" />
                {PHONE_NUMBER}
              </a>
            </div>

            {/* Alternative Actions */}
            <div className="text-center space-y-3">
              <p className="text-sm text-gray-600">Prefer to explore first?</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  to="/quote"
                  className="flex-1 px-4 py-2 bg-primary-dark text-white rounded-lg text-sm font-semibold hover:bg-primary transition-all text-center shadow-sm hover:opacity-90"
                >
                  Build a Quote
                </Link>
                <Link
                  to="/contact"
                  className="flex-1 px-4 py-2 bg-white border-2 border-primary-dark text-gray-900 rounded-lg text-sm font-semibold hover:bg-primary-dark hover:text-white transition-all text-center hover:opacity-90"
                >
                  Send Message
                </Link>
              </div>
            </div>
          </div>

          {/* Cal.com Calendar Embed */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 border-l-4 border-l-amber-500">
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h2 className="font-display text-xl font-bold text-gray-900">Select a Time</h2>
                <p className="text-sm text-gray-600">Choose an appointment type and pick a slot that works for you.</p>
              </div>

              {/* Cal.com Scheduling iframe embed */}
              <div className="calcom-embed-container bg-white">
                <iframe
                  src={CALCOM_EMBED_URL}
                  title="Schedule Appointment"
                  width="100%"
                  height="800"
                  frameBorder="0"
                  className="w-full"
                  style={{ minHeight: '800px', border: 'none' }}
                ></iframe>
              </div>

              {/* Fallback link if iframe doesn't load */}
              <div className="p-4 border-t border-gray-200 bg-gray-50 text-center">
                <p className="text-sm text-gray-600">
                  Calendar not loading?{' '}
                  <a
                    href={CALCOM_EMBED_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-500 hover:underline transition-colors font-medium"
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
      <section className="py-16 bg-gradient-to-br from-primary-dark via-primary to-secondary relative overflow-hidden grain-overlay border-t border-gray-800">
        <div className="absolute inset-0 bg-white/5"></div>
        <div className="relative z-10 max-w-4xl mx-auto text-center px-4">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-white mb-4">
            Not Sure What You Need?
          </h2>
          <p className="text-gray-300 mb-6 max-w-xl mx-auto">
            Start with a free discovery call. We'll figure out the right approach together.
          </p>
          <Link
            to="/services"
            className="inline-flex items-center px-6 py-3 rounded-lg font-bold transition-all shadow-lg hover:opacity-90"
            style={{ backgroundColor: '#ea580c', color: '#ffffff' }}
          >
            View Our Services
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Schedule;
