import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Shield, X } from 'lucide-react';
import { useSEO } from '../src/components/SEO';

// FAQ data for Support Plans - SEO schema optimization
// MUST match website pricing in pages/Services.tsx
const SUPPORT_FAQ_DATA = [
  {
    question: "What is Toast Guardian?",
    answer: "Toast Guardian is our comprehensive support plan for Toast POS systems. It provides ongoing maintenance, troubleshooting, menu updates, and emergency support to keep your restaurant running smoothly."
  },
  {
    question: "How much do Toast support plans cost?",
    answer: "Toast Guardian plans start at $350/month for Core tier (1.5 hours included, 24-48hr response), $500/month for Professional tier (3 hours, 4-hour SLA, includes GMB management), and $800/month for Premium tier (5 hours, 2-hour SLA, includes website hosting and emergency support). Annual prepay saves one month free."
  },
  {
    question: "What's included in Toast Guardian support?",
    answer: "All plans include remote troubleshooting, menu updates, system monitoring, and email support. Higher tiers add phone support, priority response SLAs, Google Business Profile management, on-site visits, and dedicated Slack channels."
  },
  {
    question: "Do you offer emergency Toast POS support?",
    answer: "Yes, our Premium plan includes emergency after-hours support. For Core and Professional plans, emergency support is available at our hourly rate. We understand that POS issues during service can be critical."
  },
  {
    question: "Can I save money with annual Toast support plans?",
    answer: "Yes, annual prepay saves one month free! Core saves $350/year, Professional saves $500/year, and Premium saves $800/year."
  }
];

const SupportPlans: React.FC = () => {
  useSEO({
    title: 'Toast Guardian Support Plans | Cape Cod Restaurant Consulting',
    description: 'Never get caught off guard again. Toast POS support plans starting at $350/month with quarterly billing. Core, Professional, and Premium tiers available.',
    canonical: 'https://ccrestaurantconsulting.com/#/support-plans',
  });

  // Inject FAQPage schema for AI citation optimization
  React.useEffect(() => {
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": SUPPORT_FAQ_DATA.map(faq => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer
        }
      }))
    };

    const existingScript = document.querySelector('script[data-schema="faq-support"]');
    if (existingScript) existingScript.remove();

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-schema', 'faq-support');
    script.textContent = JSON.stringify(faqSchema);
    document.head.appendChild(script);

    return () => {
      const scriptToRemove = document.querySelector('script[data-schema="faq-support"]');
      if (scriptToRemove) scriptToRemove.remove();
    };
  }, []);

  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');

  // MUST match website pricing in pages/Services.tsx
  const plans = [
    {
      name: 'Core',
      monthlyPrice: 350,
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

  // All possible features for comparison grid - MUST match Services.tsx
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
          <div className="inline-flex items-center gap-3 mb-4">
            <Shield className="w-12 h-12 text-amber-500" />
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">Toast Guardian</h1>
          </div>
          <div className="brass-line-draw short mb-6" />
          <p className="text-amber-400 text-xl sm:text-2xl font-semibold mb-4">
            Never get caught off guard again
          </p>
          <p className="text-gray-400 max-w-2xl mx-auto text-base sm:text-lg">
            When your POS goes down at 7 PM on a Saturday, you need someone who answers the phone.
            Toast Guardian provides reliable support plans built for Cape Cod restaurants.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8">
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
              Annual Prepay
              <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full whitespace-nowrap">
                1 Month Free
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
                  className={`block w-full text-center px-6 py-3 rounded-lg font-semibold transition-all shadow-md hover:opacity-90 ${
                    plan.highlighted
                      ? 'text-white hover:opacity-90'
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

        {/* CTA */}
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
                className="inline-block px-6 py-3 rounded-lg font-semibold transition-all hover:opacity-90 shadow-md hover:opacity-90 text-sm sm:text-base"
                style={{ backgroundColor: '#ea580c', color: '#ffffff' }}
              >
                Schedule Consultation
              </Link>
              <Link
                to="/contact"
                className="inline-block px-6 py-3 bg-white text-gray-900 rounded-lg font-semibold hover:bg-gray-100 transition-all shadow-md hover:opacity-90 text-sm sm:text-base"
              >
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportPlans;
