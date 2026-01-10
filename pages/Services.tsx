import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ShieldCheck, Terminal, BookOpen, Clock, Activity, Shield, X, ArrowRightLeft, KeyRound } from 'lucide-react';
import { useSEO } from '../src/components/SEO';

// Combined FAQ data for SEO schema
const FAQ_DATA = [
  {
    question: "How long does a Toast POS installation take?",
    answer: "A typical Toast POS installation takes 1-3 days depending on the number of terminals, kitchen display systems, and menu complexity. We schedule installations during off-hours to minimize disruption to your operations."
  },
  {
    question: "Do you provide staff training for Toast POS?",
    answer: "Yes, we provide comprehensive staff training for both front-of-house and back-of-house teams. This includes server training on order entry, manager training on reporting, and kitchen staff training on KDS operations."
  },
  {
    question: "What areas do you serve for on-site Toast installation?",
    answer: "We serve Cape Cod, South Shore Massachusetts, Southeastern Massachusetts, and the greater Boston area for on-site installations. We also offer remote support and menu configuration services nationwide."
  },
  {
    question: "How much does Toast POS installation cost?",
    answer: "Installation costs vary based on the number of terminals, complexity of your menu, and training requirements. Use our Quote Builder tool for an instant estimate, or schedule a free 15-minute discovery call for a custom quote."
  },
  {
    question: "What is Toast Guardian?",
    answer: "Toast Guardian is our comprehensive support plan for Toast POS systems. It provides ongoing maintenance, troubleshooting, menu updates, and emergency support to keep your restaurant running smoothly."
  },
  {
    question: "How much do Toast support plans cost?",
    answer: "Toast Guardian plans start at $350/month for Core tier (1.5 hours included, 24-48hr response), $500/month for Professional tier (3 hours, 4-hour SLA, includes GMB management), and $800/month for Premium tier (5 hours, 2-hour SLA, includes website hosting and emergency support). Annual prepay saves one month free."
  },
  {
    question: "Do you offer emergency Toast POS support?",
    answer: "Yes, our Premium plan includes same-day emergency response. For Core and Professional plans, emergency support is available at our hourly rate. We understand that POS issues during service can be critical."
  }
];

const Services: React.FC = () => {
  useSEO({
    title: 'Toast POS Installation & Support Plans | Cape Cod Restaurant Consulting',
    description: 'Professional Toast POS installation, menu configuration, restaurant networking, and ongoing support plans. Toast Guardian support starting at $350/month with quarterly billing. Cape Cod & nationwide remote support.',
    canonical: 'https://ccrestaurantconsulting.com/#/services',
  });

  // Inject FAQPage schema for AI citation optimization
  React.useEffect(() => {
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": FAQ_DATA.map(faq => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer
        }
      }))
    };

    const existingScript = document.querySelector('script[data-schema="faq-services"]');
    if (existingScript) existingScript.remove();

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-schema', 'faq-services');
    script.textContent = JSON.stringify(faqSchema);
    document.head.appendChild(script);

    return () => {
      const scriptToRemove = document.querySelector('script[data-schema="faq-services"]');
      if (scriptToRemove) scriptToRemove.remove();
    };
  }, []);

  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');

  const plans = [
    {
      name: 'Core',
      monthlyPrice: 350,
      quarterlyPrice: 1050,
      annualPrice: 3850,
      annualSavings: 350,
      description: 'Essential coverage for single-location restaurants with straightforward needs',
      features: [
        '1.5 hours per month included',
        '24-48 hour response time',
        'Email support',
        'Basic monitoring alerts',
        'Quarterly system health check',
        'Knowledge base access'
      ],
      highlighted: false
    },
    {
      name: 'Professional',
      monthlyPrice: 500,
      quarterlyPrice: 1500,
      annualPrice: 5500,
      annualSavings: 500,
      description: 'Comprehensive support with faster response and proactive management',
      features: [
        '3 hours per month included',
        '4-hour response SLA',
        'Phone & email support',
        'Google Business Profile management',
        'Monthly system review',
        '1 on-site visit per quarter'
      ],
      highlighted: true
    },
    {
      name: 'Premium',
      monthlyPrice: 800,
      quarterlyPrice: 2400,
      annualPrice: 8800,
      annualSavings: 800,
      description: 'Full-service partnership for high-volume and complex operations',
      features: [
        '5 hours per month included',
        '2-hour response SLA',
        'Emergency after-hours included',
        'Website hosting & maintenance',
        'Third-party coordination (Loman, DoorDash)',
        '2 on-site visits per quarter',
        'Monthly strategy call',
        'Dedicated Slack channel'
      ],
      highlighted: false
    }
  ];

  const allFeatures = [
    { name: 'Monthly hours included', core: '1.5', professional: '3', premium: '5' },
    { name: 'Response SLA', core: '24-48 hour', professional: '4-hour', premium: '2-hour' },
    { name: 'Email support', core: true, professional: true, premium: true },
    { name: 'Phone support', core: false, professional: true, premium: true },
    { name: 'Emergency after-hours', core: false, professional: false, premium: true },
    { name: 'System monitoring', core: 'Basic alerts', professional: 'Full monitoring', premium: 'Proactive optimization' },
    { name: 'Google Business Profile', core: false, professional: true, premium: 'Full management' },
    { name: 'Website hosting', core: false, professional: false, premium: true },
    { name: 'Third-party coordination', core: false, professional: false, premium: true },
    { name: 'On-site visits', core: false, professional: '1/quarter', premium: '2/quarter' },
    { name: 'Strategy calls', core: false, professional: false, premium: 'Monthly' },
    { name: 'Dedicated Slack channel', core: false, professional: false, premium: true }
  ];

  return (
    <div className="bg-white min-h-screen pb-20">
      {/* Header */}
      <div className="bg-primary-dark py-16 pt-8 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center animate-on-scroll">
          <h1 className="font-display text-4xl font-bold text-white mb-4">Services &amp; Support Plans</h1>
          <div className="brass-line-draw short mb-6" />
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Professional POS installation, menu configuration, and restaurant networking in Cape Cod. Systems built to survive the Friday night rush.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8">
        {/* ======================== */}
        {/* SEGMENT CALLOUTS */}
        {/* ======================== */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Segment A - POS Switchers */}
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-6 animate-on-scroll">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-orange-600 rounded-full flex items-center justify-center flex-shrink-0">
                <ArrowRightLeft className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-display text-xl font-bold text-gray-900">Switching from Clover or Square?</h3>
            </div>
            <p className="text-gray-700 mb-4">
              Menu builds that take Toast corporate 3 weeks? I deliver in 48 hours. I migrate your menu data so you do not have to re-type it, and I handle the configuration based on your actual workflow.
            </p>
            <ul className="space-y-2 mb-5 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                <span>Zero-downtime migration planning</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                <span>Menu and modifier data transfer</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                <span>Staff training before go-live</span>
              </li>
            </ul>
            <Link
              to="/schedule"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all shadow-md hover:opacity-90"
              style={{ backgroundColor: '#ea580c', color: '#ffffff' }}
            >
              Get a Switch Readiness Audit
              <span className="text-lg">→</span>
            </Link>
          </div>

          {/* Segment C - Transitions */}
          <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-6 animate-on-scroll">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-violet-600 rounded-full flex items-center justify-center flex-shrink-0">
                <KeyRound className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-display text-xl font-bold text-gray-900">Taking Over a Restaurant?</h3>
            </div>
            <p className="text-gray-700 mb-4">
              Restaurant transitions fail when the tech handoff is fuzzy. I map ownership changes into a zero-downtime checklist: credentials, accounts, training, and vendor handoffs all covered.
            </p>
            <ul className="space-y-2 mb-5 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-violet-500 mt-0.5 flex-shrink-0" />
                <span>Full system and credential audit</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-violet-500 mt-0.5 flex-shrink-0" />
                <span>Overnight cutover execution</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-violet-500 mt-0.5 flex-shrink-0" />
                <span>Day-one on-site support</span>
              </li>
            </ul>
            <Link
              to="/schedule"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all shadow-md hover:opacity-90"
              style={{ backgroundColor: '#7c3aed', color: '#ffffff' }}
            >
              Schedule Transition Consultation
              <span className="text-lg">→</span>
            </Link>
          </div>
        </div>

        {/* ======================== */}
        {/* SERVICES SECTION */}
        {/* ======================== */}
        <div className="space-y-12">
          <ServiceSection
            title="Toast POS Installation & Configuration"
            icon={Terminal}
            description="Don't trust your install to a generic IT contractor. We configure your menu, modifiers, and hardware specifically for your kitchen's workflow."
            features={[
              "Hardware deployment (Terminals, KDS, Printers)",
              "Menu engineering and modifier group optimization",
              "Staff training (FOH & BOH specific sessions)",
              "Go-live support"
            ]}
          />

          <ServiceSection
            title="Restaurant Networking & IT"
            icon={Activity}
            description="If your internet drops, you can't print tickets. We build redundant, commercial-grade networks designed to handle heavy guest wifi traffic without compromising your POS."
            features={[
              "Ubiquiti/Cisco/Meraki configuration",
              "LTE Failover setup (never lose a credit card auth)",
              "Separate Guest/Staff/POS VLANs",
              "Structured cabling & cable management"
            ]}
          />

          {/* Local Networking Callout */}
          <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 animate-on-scroll">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-teal-600 rounded-full flex items-center justify-center flex-shrink-0">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-gray-900">Cape Cod On-Site Cabling & WiFi</h3>
                <p className="text-gray-600 text-sm">Dedicated networking services for Cape Cod, Plymouth, and Providence restaurants</p>
              </div>
            </div>
            <Link
              to="/local-networking"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all shadow-md hover:opacity-90 whitespace-nowrap"
              style={{ backgroundColor: '#0d9488', color: '#ffffff' }}
            >
              View Local Services
              <span className="text-lg">→</span>
            </Link>
          </div>

          <ServiceSection
            title="Operational Consulting"
            icon={BookOpen}
            description="The best POS in the world won't fix a bad line setup. We analyze your FOH and BOH operations to reduce ticket times and increase table turns."
            features={[
              "Ticket routing analysis",
              "Server station optimization",
              "Bar inventory workflow",
              "Standard Operating Procedures (SOPs) development"
            ]}
          />

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

        {/* Services CTA */}
        <div className="mt-16 text-center animate-on-scroll">
          <div className="inline-block bg-gray-50 p-8 rounded-2xl shadow-xl border border-gray-200 border-l-4 border-l-amber-500 card-hover-glow">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Need a Custom POS Solution?</h2>
            <div className="brass-line-draw short mb-4" />
            <p className="text-gray-600 mb-6">Let's hop on a 15-minute discovery call. No sales pitch, just problem solving for your restaurant.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/schedule"
                className="inline-block px-6 py-3 rounded-lg font-semibold transition-all shadow-md hover:opacity-90"
                style={{ backgroundColor: '#ea580c', color: '#ffffff' }}
              >
                Schedule a Call
              </Link>
              <Link
                to="/quote"
                className="inline-block px-6 py-3 rounded-lg font-semibold transition-all shadow-md hover:opacity-90"
                style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
              >
                Build Your Quote
              </Link>
            </div>
          </div>
        </div>

        {/* ======================== */}
        {/* TOAST GUARDIAN SUPPORT PLANS SECTION */}
        {/* ======================== */}
        <div className="mt-24 pt-16 border-t border-gray-200">
          {/* Support Plans Header */}
          <div className="text-center mb-12 animate-on-scroll">
            <div className="inline-flex items-center gap-3 mb-4">
              <Shield className="w-12 h-12 text-amber-500" />
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-gray-900">Toast Guardian</h2>
            </div>
            <div className="brass-line-draw short mb-6" />
            <p className="text-gray-600 max-w-2xl mx-auto text-base sm:text-lg">
              When your POS goes down at 7 PM on a Saturday, you need someone who answers the phone.
              Toast Guardian provides reliable support plans built for Cape Cod restaurants.
            </p>
          </div>

          {/* Billing Toggle */}
          <div className="flex justify-center mb-12 animate-on-scroll">
            <div className="inline-flex items-center gap-2 sm:gap-4 bg-white rounded-xl shadow-lg border border-gray-200 p-2">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className="px-4 sm:px-6 py-3 rounded-lg font-semibold transition-all text-sm sm:text-base"
                style={{
                  backgroundColor: billingPeriod === 'monthly' ? '#f59e0b' : 'transparent',
                  color: billingPeriod === 'monthly' ? '#ffffff' : '#4b5563',
                  boxShadow: billingPeriod === 'monthly' ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none'
                }}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingPeriod('annual')}
                className="px-4 sm:px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 text-sm sm:text-base"
                style={{
                  backgroundColor: billingPeriod === 'annual' ? '#f59e0b' : 'transparent',
                  color: billingPeriod === 'annual' ? '#ffffff' : '#4b5563',
                  boxShadow: billingPeriod === 'annual' ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none'
                }}
              >
                Annual Prepay
                <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full whitespace-nowrap">
                  1 Month Free
                </span>
              </button>
            </div>
          </div>

          {/* Quarterly Billing Note */}
          <div className="text-center mb-8 animate-on-scroll">
            <p className="text-gray-600 text-sm">
              All plans billed <strong className="text-gray-900">quarterly</strong> ($
              {billingPeriod === 'monthly' ? '1,050-2,400' : '3,850-8,800'}/
              {billingPeriod === 'monthly' ? 'quarter' : 'year'}).
              {billingPeriod === 'annual' && ' Annual prepay saves one month free.'}
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8 mb-16">
            {plans.map((plan, idx) => (
              <div
                key={plan.name}
                className={`rounded-xl shadow-xl border-2 overflow-hidden flex flex-col animate-on-scroll ${
                  plan.highlighted
                    ? 'border-amber-500 lg:scale-105 relative z-10'
                    : 'border-gray-200'
                }`}
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                {plan.highlighted && (
                  <div className="bg-amber-500 text-white text-center py-2 font-semibold text-sm">
                    MOST POPULAR
                  </div>
                )}

                <div className="p-6 sm:p-8 bg-white flex-grow">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <p className="text-gray-600 text-sm mb-6 min-h-[40px]">{plan.description}</p>

                  <div className="mb-6">
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl sm:text-5xl font-bold text-gray-900">
                        ${billingPeriod === 'monthly' ? plan.monthlyPrice : plan.annualPrice}
                      </span>
                      <span className="text-gray-600 text-sm sm:text-base">
                        /{billingPeriod === 'monthly' ? 'month' : 'year'}
                      </span>
                    </div>
                    {billingPeriod === 'annual' && (
                      <p className="text-sm text-green-600 mt-2 font-semibold">
                        Save ${plan.annualSavings}/year
                      </p>
                    )}
                  </div>

                  <div className="space-y-3 mb-8">
                    {plan.features.map((feature, featureIdx) => (
                      <div key={featureIdx} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700 text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <Link
                    to="/schedule"
                    className="block w-full text-center px-6 py-3 rounded-lg font-semibold transition-all shadow-md hover:opacity-90"
                    style={{
                      backgroundColor: plan.highlighted ? '#ea580c' : '#1f2937',
                      color: '#ffffff'
                    }}
                  >
                    Schedule Consultation
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Feature Comparison Grid */}
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden mb-16 animate-on-scroll">
            <div className="bg-primary-dark p-6 text-center">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Compare Plans</h2>
              <div className="brass-line-draw short" />
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b-2 border-gray-200">
                    <th className="text-left p-4 font-semibold text-gray-900">Feature</th>
                    <th className="text-center p-4 font-semibold text-gray-900">Core</th>
                    <th className="text-center p-4 font-semibold text-amber-600 bg-amber-50">Professional</th>
                    <th className="text-center p-4 font-semibold text-gray-900">Premium</th>
                  </tr>
                </thead>
                <tbody>
                  {allFeatures.map((feature, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-4 font-medium text-gray-900 border-b border-gray-200">
                        {feature.name}
                      </td>
                      <td className="p-4 text-center border-b border-gray-200">
                        {typeof feature.core === 'boolean' ? (
                          feature.core ? (
                            <Check className="w-5 h-5 text-green-500 mx-auto" />
                          ) : (
                            <X className="w-5 h-5 text-gray-300 mx-auto" />
                          )
                        ) : (
                          <span className="text-gray-700 text-sm">{feature.core}</span>
                        )}
                      </td>
                      <td className="p-4 text-center bg-amber-50 border-b border-amber-100">
                        {typeof feature.professional === 'boolean' ? (
                          feature.professional ? (
                            <Check className="w-5 h-5 text-green-500 mx-auto" />
                          ) : (
                            <X className="w-5 h-5 text-gray-300 mx-auto" />
                          )
                        ) : (
                          <span className="text-gray-700 text-sm font-medium">{feature.professional}</span>
                        )}
                      </td>
                      <td className="p-4 text-center border-b border-gray-200">
                        {typeof feature.premium === 'boolean' ? (
                          feature.premium ? (
                            <Check className="w-5 h-5 text-green-500 mx-auto" />
                          ) : (
                            <X className="w-5 h-5 text-gray-300 mx-auto" />
                          )
                        ) : (
                          <span className="text-gray-700 text-sm">{feature.premium}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Accordion */}
            <div className="md:hidden p-4 space-y-4">
              {plans.map((plan) => (
                <div key={plan.name} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className={`p-4 font-bold text-white ${plan.highlighted ? 'bg-amber-500' : 'bg-gray-800'}`}>
                    {plan.name}
                  </div>
                  <div className="p-4 space-y-3">
                    {allFeatures.map((feature, idx) => {
                      const value = plan.name === 'Core' ? feature.core :
                                    plan.name === 'Professional' ? feature.professional :
                                    feature.premium;
                      return (
                        <div key={idx} className="flex justify-between items-center text-sm">
                          <span className="font-medium text-gray-700">{feature.name}</span>
                          <span className="text-gray-900">
                            {typeof value === 'boolean' ? (
                              value ? (
                                <Check className="w-5 h-5 text-green-500" />
                              ) : (
                                <X className="w-5 h-5 text-gray-300" />
                              )
                            ) : (
                              value
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="mt-16 text-center animate-on-scroll">
          <div className="inline-block bg-primary-dark p-6 sm:p-8 rounded-2xl shadow-xl border border-gray-700">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">Ready to protect your restaurant?</h2>
            <div className="brass-line-draw short mb-4" />
            <p className="text-gray-300 mb-6 text-sm sm:text-base">
              Let's discuss which plan is right for your operation.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/schedule"
                className="inline-block px-6 py-3 rounded-lg font-semibold transition-all shadow-md hover:opacity-90 text-sm sm:text-base"
                style={{ backgroundColor: '#ea580c', color: '#ffffff' }}
              >
                Schedule Consultation
              </Link>
              <Link
                to="/about"
                className="inline-block px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-all shadow-md text-sm sm:text-base"
                style={{ backgroundColor: '#ffffff', color: '#111827' }}
              >
                Learn More About Us
              </Link>
            </div>
          </div>
        </div>

        {/* Service Area Info */}
        <div className="mt-12 text-center">
          <p className="text-gray-600">
            Serving restaurants in <strong className="text-gray-900">Cape Cod</strong>, <strong className="text-gray-900">South Shore</strong>, and <strong className="text-gray-900">Southeastern Massachusetts</strong>.{' '}
            <Link to="/about" className="text-amber-500 hover:underline transition-colors">Contact us</Link> to discuss your project.
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
