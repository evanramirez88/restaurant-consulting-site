import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ShieldCheck, Terminal, BookOpen, Clock, Activity, Shield, X } from 'lucide-react';
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
    answer: "Toast Guardian plans start at $125/month for Essential tier (2 hours included, 48-hour response), $250/month for Professional tier (4 hours, 24-hour response), and $400/month for Premium tier (8 hours, same-day response)."
  },
  {
    question: "Do you offer emergency Toast POS support?",
    answer: "Yes, our Premium plan includes same-day emergency response. For Essential and Professional plans, emergency support is available at our hourly rate. We understand that POS issues during service can be critical."
  }
];

const Services: React.FC = () => {
  useSEO({
    title: 'Toast POS Installation & Support Plans | Cape Cod Restaurant Consulting',
    description: 'Professional Toast POS installation, menu configuration, restaurant networking, and ongoing support plans. Toast Guardian support starting at $125/month. Cape Cod & SE Massachusetts.',
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
      name: 'Essential',
      monthlyPrice: 125,
      annualPrice: 1200,
      annualSavings: 300,
      description: 'Perfect for single-location restaurants with basic support needs',
      features: [
        '2 hours per month included',
        '48-hour response time',
        'Email support',
        'Monthly plan reviews',
        'Basic menu guidance'
      ],
      highlighted: false
    },
    {
      name: 'Professional',
      monthlyPrice: 250,
      annualPrice: 2400,
      annualSavings: 600,
      description: 'For busy restaurants that need faster response times',
      features: [
        '4 hours per month included',
        '24-hour response time',
        'Priority email & phone support',
        'Weekly optimization consultations',
        'Menu engineering & analysis',
        'Staff training resources'
      ],
      highlighted: true
    },
    {
      name: 'Premium',
      monthlyPrice: 400,
      annualPrice: 3600,
      annualSavings: 1200,
      description: 'Maximum coverage for high-volume operations',
      features: [
        '8 hours per month included',
        'Same-day response time',
        'Dedicated account manager',
        'Daily POS monitoring & alerts',
        'Advanced menu optimization',
        'Full staff training & onboarding',
        'Quarterly business reviews'
      ],
      highlighted: false
    }
  ];

  const allFeatures = [
    { name: 'Monthly hours included', essential: '2', professional: '4', premium: '8' },
    { name: 'Response time', essential: '48-hour', professional: '24-hour', premium: 'Same-day' },
    { name: 'Email support', essential: true, professional: true, premium: true },
    { name: 'Phone support', essential: false, professional: true, premium: true },
    { name: 'Priority support', essential: false, professional: true, premium: true },
    { name: 'Plan reviews', essential: 'Monthly', professional: 'Weekly', premium: 'Daily monitoring' },
    { name: 'Menu guidance', essential: 'Basic', professional: 'Engineering & analysis', premium: 'Advanced optimization' },
    { name: 'Staff training resources', essential: false, professional: true, premium: true },
    { name: 'Dedicated account manager', essential: false, professional: false, premium: true },
    { name: 'POS monitoring & alerts', essential: false, professional: false, premium: true },
    { name: 'Staff onboarding', essential: false, professional: false, premium: true },
    { name: 'Business reviews', essential: false, professional: false, premium: 'Quarterly' }
  ];

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
        {/* ======================== */}
        {/* SERVICES SECTION */}
        {/* ======================== */}
        <div className="space-y-12">
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
            <p className="text-amber-600 text-xl sm:text-2xl font-semibold mb-4">
              Never get caught off guard again
            </p>
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
                className={`px-4 sm:px-6 py-3 rounded-lg font-semibold transition-all text-sm sm:text-base ${
                  billingPeriod === 'monthly'
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingPeriod('annual')}
                className={`px-4 sm:px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 text-sm sm:text-base ${
                  billingPeriod === 'annual'
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Annual
                <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full whitespace-nowrap">
                  Save up to $1,200
                </span>
              </button>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8 mb-16">
            {plans.map((plan, idx) => (
              <div
                key={plan.name}
                className={`rounded-xl shadow-xl border-2 overflow-hidden flex flex-col animate-on-scroll ${
                  plan.highlighted
                    ? 'border-amber-500 transform md:scale-105 relative'
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
                    className={`block w-full text-center px-6 py-3 rounded-lg font-semibold transition-all shadow-md btn-hover ${
                      plan.highlighted
                        ? 'text-white glow-pulse'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}
                    style={plan.highlighted ? { backgroundColor: '#ea580c' } : {}}
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
                    <th className="text-center p-4 font-semibold text-gray-900">Essential</th>
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
                        {typeof feature.essential === 'boolean' ? (
                          feature.essential ? (
                            <Check className="w-5 h-5 text-green-500 mx-auto" />
                          ) : (
                            <X className="w-5 h-5 text-gray-300 mx-auto" />
                          )
                        ) : (
                          <span className="text-gray-700 text-sm">{feature.essential}</span>
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
                      const value = plan.name === 'Essential' ? feature.essential :
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
              Let's discuss which Toast Guardian plan is right for your operation.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/schedule"
                className="inline-block px-6 py-3 rounded-lg font-semibold transition-all glow-pulse shadow-md btn-hover text-sm sm:text-base"
                style={{ backgroundColor: '#ea580c', color: '#ffffff' }}
              >
                Schedule Consultation
              </Link>
              <Link
                to="/about"
                className="inline-block px-6 py-3 bg-white text-gray-900 rounded-lg font-semibold hover:bg-gray-100 transition-all shadow-md btn-hover text-sm sm:text-base"
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
