import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Shield, X } from 'lucide-react';
import { useSEO } from '../src/components/SEO';

// FAQ data for Support Plans - SEO schema optimization
const SUPPORT_FAQ_DATA = [
  {
    question: "What is Toast Guardian?",
    answer: "Toast Guardian is our comprehensive support plan for Toast POS systems. It provides ongoing maintenance, troubleshooting, menu updates, and emergency support to keep your restaurant running smoothly."
  },
  {
    question: "How much do Toast support plans cost?",
    answer: "Toast Guardian plans start at $125/month for Essential tier (2 hours included, 48-hour response), $250/month for Professional tier (4 hours, 24-hour response), and $400/month for Premium tier (8 hours, same-day response)."
  },
  {
    question: "What's included in Toast Guardian support?",
    answer: "All plans include remote troubleshooting, menu updates, system reviews, and email support. Higher tiers add phone support, priority response times, staff training resources, dedicated account managers, and quarterly on-site visits."
  },
  {
    question: "Do you offer emergency Toast POS support?",
    answer: "Yes, our Premium plan includes same-day emergency response. For Essential and Professional plans, emergency support is available at our hourly rate. We understand that POS issues during service can be critical."
  },
  {
    question: "Can I save money with annual Toast support plans?",
    answer: "Yes, annual plans save up to $1,200 per year compared to monthly billing. Essential saves $300/year, Professional saves $600/year, and Premium saves $1,200/year."
  }
];

const SupportPlans: React.FC = () => {
  useSEO({
    title: 'Toast Guardian Support Plans | Cape Cod Restaurant Consulting',
    description: 'Never get caught off guard again. 24/7 Toast POS support plans starting at $125/month. Essential, Professional, and Premium tiers available.',
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

  // All possible features for comparison grid
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
