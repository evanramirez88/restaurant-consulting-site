import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Shield, Clock, Phone, Zap, AlertCircle } from 'lucide-react';
import { useSEO } from '../src/components/SEO';

const SupportPlans: React.FC = () => {
  useSEO({
    title: 'Toast Guardian Support Plans | Cape Cod Restaurant Consulting',
    description: 'Never get caught off guard again. 24/7 Toast POS support plans starting at $125/month. Essential, Professional, and Premium tiers available.',
    canonical: 'https://ccrestaurantconsulting.com/#/support-plans',
  });

  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');

  const plans = [
    {
      name: 'Essential',
      monthlyPrice: 125,
      annualPrice: 1200,
      description: 'Perfect for single-location restaurants with basic support needs',
      features: [
        'Business hours phone support (9AM-9PM)',
        'Email support with 4-hour response time',
        'Remote diagnostics and troubleshooting',
        'Toast POS configuration assistance',
        'Monthly system health check',
        'Priority scheduling for on-site visits'
      ],
      highlighted: false
    },
    {
      name: 'Professional',
      monthlyPrice: 250,
      annualPrice: 2400,
      description: 'For busy restaurants that need faster response times',
      features: [
        'Extended hours support (7AM-11PM)',
        'Email support with 2-hour response time',
        'Remote diagnostics and troubleshooting',
        'Toast POS configuration assistance',
        'Bi-weekly system health checks',
        'Priority scheduling for on-site visits',
        '1 free on-site visit per quarter',
        'Menu optimization consultation',
        'Integration setup assistance'
      ],
      highlighted: true
    },
    {
      name: 'Premium',
      monthlyPrice: 400,
      annualPrice: 3600,
      description: 'Maximum coverage for high-volume operations',
      features: [
        '24/7 emergency phone support',
        'Email support with 1-hour response time',
        'Remote diagnostics and troubleshooting',
        'Toast POS configuration assistance',
        'Weekly system health checks',
        'Priority scheduling for on-site visits',
        '2 free on-site visits per quarter',
        'Menu optimization consultation',
        'Integration setup assistance',
        'Dedicated account manager',
        'Staff training sessions (quarterly)',
        'Network monitoring and maintenance'
      ],
      highlighted: false
    }
  ];

  return (
    <div className="bg-white min-h-screen pb-20">
      {/* Header */}
      <div className="bg-primary-dark py-16 pt-8 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center animate-on-scroll">
          <div className="inline-flex items-center gap-3 mb-4">
            <Shield className="w-12 h-12 text-amber-500" />
            <h1 className="font-display text-4xl font-bold text-white">Toast Guardian</h1>
          </div>
          <div className="brass-line-draw short mb-6" />
          <p className="text-amber-400 text-2xl font-semibold mb-4">
            Never get caught off guard again
          </p>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            When your POS goes down at 7 PM on a Saturday, you need someone who answers the phone.
            Toast Guardian provides 24/7 support plans built for Cape Cod restaurants.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8">
        {/* Billing Toggle */}
        <div className="flex justify-center mb-12 animate-on-scroll">
          <div className="inline-flex items-center gap-4 bg-white rounded-xl shadow-lg border border-gray-200 p-2">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                billingPeriod === 'monthly'
                  ? 'bg-amber-500 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('annual')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                billingPeriod === 'annual'
                  ? 'bg-amber-500 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Annual
              <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full">
                Save 2 months
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {plans.map((plan, idx) => (
            <div
              key={plan.name}
              className={`rounded-xl shadow-xl border-2 overflow-hidden flex flex-col animate-on-scroll ${
                plan.highlighted
                  ? 'border-amber-500 transform scale-105 relative'
                  : 'border-gray-200'
              }`}
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              {plan.highlighted && (
                <div className="bg-amber-500 text-white text-center py-2 font-semibold text-sm">
                  MOST POPULAR
                </div>
              )}

              <div className="p-8 bg-white flex-grow">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <p className="text-gray-600 text-sm mb-6 min-h-[40px]">{plan.description}</p>

                <div className="mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold text-gray-900">
                      ${billingPeriod === 'monthly' ? plan.monthlyPrice : plan.annualPrice}
                    </span>
                    <span className="text-gray-600">
                      /{billingPeriod === 'monthly' ? 'month' : 'year'}
                    </span>
                  </div>
                  {billingPeriod === 'annual' && (
                    <p className="text-sm text-green-600 mt-2">
                      ${(plan.monthlyPrice * 12 - plan.annualPrice).toFixed(0)} annual savings
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
                  to="/contact"
                  className={`block w-full text-center px-6 py-3 rounded-lg font-semibold transition-all shadow-md btn-hover ${
                    plan.highlighted
                      ? 'text-white glow-pulse'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  }`}
                  style={plan.highlighted ? { backgroundColor: '#ea580c' } : {}}
                >
                  Get Started
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Why Toast Guardian Section */}
        <div className="bg-gray-50 rounded-2xl p-8 shadow-xl border border-gray-200 border-l-4 border-l-amber-500 mb-16 animate-on-scroll">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">
            Why Toast Guardian?
          </h2>
          <div className="brass-line-draw short mb-8" />
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Phone className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">We Actually Answer</h3>
              <p className="text-gray-600 text-sm">
                No phone trees, no ticket systems. Call and talk to someone who knows your setup.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Restaurant-Specific</h3>
              <p className="text-gray-600 text-sm">
                We understand kitchen workflow, ticket routing, and the Friday night chaos.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Proactive Monitoring</h3>
              <p className="text-gray-600 text-sm">
                We catch issues before they become problems during service.
              </p>
            </div>
          </div>
        </div>

        {/* FAQ / Additional Info */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 animate-on-scroll">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Common Questions</h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                What's covered in remote support?
              </h3>
              <p className="text-gray-600 text-sm ml-7">
                Toast POS configuration, menu changes, troubleshooting printer issues, network diagnostics,
                integration problems, and staff training via screen share.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                Do you charge for on-site visits?
              </h3>
              <p className="text-gray-600 text-sm ml-7">
                Professional and Premium plans include free quarterly visits. Additional on-site work is billed
                at standard rates, but plan members get priority scheduling and discounted labor.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                Can I upgrade or downgrade my plan?
              </h3>
              <p className="text-gray-600 text-sm ml-7">
                Yes, you can change plans at any time. Changes take effect at the start of your next billing cycle.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                What if I need support outside my plan hours?
              </h3>
              <p className="text-gray-600 text-sm ml-7">
                Emergency support is available 24/7 for all plan tiers, billed at emergency rates.
                Premium members get 24/7 coverage included.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center animate-on-scroll">
          <div className="inline-block bg-primary-dark p-8 rounded-2xl shadow-xl border border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-4">Ready to protect your restaurant?</h2>
            <div className="brass-line-draw short mb-4" />
            <p className="text-gray-300 mb-6">
              Let's discuss which Toast Guardian plan is right for your operation.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/schedule"
                className="inline-block px-6 py-3 rounded-lg font-semibold transition-all glow-pulse shadow-md btn-hover"
                style={{ backgroundColor: '#ea580c', color: '#ffffff' }}
              >
                Schedule a Call
              </Link>
              <Link
                to="/contact"
                className="inline-block px-6 py-3 bg-white text-gray-900 rounded-lg font-semibold hover:bg-gray-100 transition-all shadow-md btn-hover"
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
