import React from 'react';
import { Link } from 'react-router-dom';
import { Check, Star, Shield, Zap, Phone, Mail, Calendar, Users, MapPin, Headphones } from 'lucide-react';
import { useSEO } from '../src/components/SEO';

const SupportPlans: React.FC = () => {
  useSEO({
    title: 'Monthly Support Plans | Restaurant Technology Support | Cape Cod',
    description: 'Affordable monthly support subscriptions for your restaurant POS system. From basic maintenance to 24/7 emergency support. Plans starting at $199/month.',
    canonical: 'https://ccrestaurantconsulting.com/#/support-plans',
  });

  return (
    <div className="bg-white min-h-screen pb-20">
      {/* Header */}
      <div className="bg-primary-dark py-16 pt-8 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center animate-on-scroll">
          <h1 className="font-display text-4xl font-bold text-white mb-4">
            Monthly Support Plans for Restaurant Technology
          </h1>
          <div className="brass-line-draw short mb-6" />
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Keep your systems running smoothly with predictable monthly support. From routine maintenance to emergency 24/7 coverage.
          </p>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">

          {/* Essential Plan */}
          <PricingCard
            name="Essential Support"
            price="199"
            description="Perfect for stable operations that need occasional maintenance and updates."
            features={[
              { icon: Mail, text: "Email support (48-hour response)" },
              { icon: Calendar, text: "Monthly menu updates (up to 2 hours)" },
              { icon: Shield, text: "Quarterly system health checks" },
              { icon: Phone, text: "Basic troubleshooting & diagnostics" },
              { icon: Headphones, text: "Software update guidance" },
            ]}
            cta="Get Started"
            popular={false}
          />

          {/* Professional Plan - MOST POPULAR */}
          <PricingCard
            name="Professional Support"
            price="499"
            description="For busy restaurants that need responsive support and regular optimization."
            features={[
              { icon: Star, text: "Everything in Essential, plus:" },
              { icon: Phone, text: "Priority phone support (4-hour response)" },
              { icon: MapPin, text: "Quarterly on-site visits" },
              { icon: Users, text: "Staff training sessions (2 per quarter)" },
              { icon: Zap, text: "Menu optimization consulting" },
              { icon: Shield, text: "After-hours emergency contact" },
            ]}
            cta="Most Popular"
            popular={true}
          />

          {/* Enterprise Plan */}
          <PricingCard
            name="Enterprise Support"
            price="999"
            description="Complete peace of mind with 24/7 coverage and dedicated account management."
            features={[
              { icon: Star, text: "Everything in Professional, plus:" },
              { icon: Shield, text: "24/7 emergency support hotline" },
              { icon: Users, text: "Dedicated account manager" },
              { icon: MapPin, text: "Unlimited on-site visits" },
              { icon: Calendar, text: "Monthly strategic planning sessions" },
              { icon: Zap, text: "Multi-location coordination" },
            ]}
            cta="Contact Us"
            popular={false}
          />
        </div>

        {/* Plan Comparison Table */}
        <div className="mt-20 mb-16 animate-on-scroll">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="font-display text-3xl font-bold text-gray-900 mb-4">
              Compare Support Plans
            </h2>
            <div className="brass-line-draw short mb-6" />
            <p className="text-gray-600 text-lg">
              All plans include menu updates, system monitoring, and expert guidance. Choose the level that matches your operation.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wider">
                      Feature
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-bold text-gray-900 uppercase tracking-wider">
                      Essential
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-bold text-gray-900 uppercase tracking-wider bg-amber-50">
                      Professional
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-bold text-gray-900 uppercase tracking-wider">
                      Enterprise
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <ComparisonRow
                    feature="Response Time"
                    essential="48 hours"
                    professional="4 hours"
                    enterprise="Immediate (24/7)"
                  />
                  <ComparisonRow
                    feature="Monthly Menu Updates"
                    essential="Up to 2 hours"
                    professional="Up to 4 hours"
                    enterprise="Unlimited"
                  />
                  <ComparisonRow
                    feature="On-Site Visits"
                    essential="—"
                    professional="Quarterly"
                    enterprise="Unlimited"
                  />
                  <ComparisonRow
                    feature="Staff Training"
                    essential="—"
                    professional="2 per quarter"
                    enterprise="Unlimited"
                  />
                  <ComparisonRow
                    feature="Emergency Hotline"
                    essential="—"
                    professional="After-hours"
                    enterprise="24/7 Dedicated"
                  />
                  <ComparisonRow
                    feature="Account Manager"
                    essential="—"
                    professional="—"
                    enterprise="✓"
                  />
                  <ComparisonRow
                    feature="Multi-Location Support"
                    essential="—"
                    professional="—"
                    enterprise="✓"
                  />
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* FAQ / Additional Info */}
        <div className="mt-16 bg-gray-50 rounded-2xl p-8 border border-gray-200 animate-on-scroll">
          <h2 className="font-display text-2xl font-bold text-gray-900 mb-6 text-center">
            Support Plan FAQs
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <h3 className="font-bold text-gray-900 mb-2">Can I upgrade or downgrade my plan?</h3>
              <p className="text-gray-600">
                Yes, you can change plans at any time. Upgrades take effect immediately, and downgrades apply at your next billing cycle.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-2">What counts as a menu update?</h3>
              <p className="text-gray-600">
                Adding items, changing prices, adjusting modifiers, or updating descriptions. Seasonal menu changes, daily specials, and price optimization all count.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-2">Is there a contract?</h3>
              <p className="text-gray-600">
                No long-term contracts required. Pay month-to-month and cancel anytime with 30 days notice. Most clients stay for years because it works.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-2">What if I need emergency support on Essential?</h3>
              <p className="text-gray-600">
                Emergency support is available on-demand at $150/hour. Professional and Enterprise plans include priority and 24/7 emergency access.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center animate-on-scroll">
          <div className="inline-block bg-primary-dark p-8 rounded-2xl shadow-xl border border-gray-800 max-w-2xl">
            <h2 className="text-2xl font-bold text-white mb-4">Not Sure Which Plan is Right?</h2>
            <div className="brass-line-draw short mb-4" />
            <p className="text-gray-300 mb-6">
              Let's talk about your restaurant's needs. I'll recommend the plan that makes sense for your operation—no upselling.
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
                className="inline-block px-6 py-3 rounded-lg font-semibold transition-all shadow-md btn-hover"
                style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
              >
                Ask a Question
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Pricing Card Component
const PricingCard: React.FC<{
  name: string;
  price: string;
  description: string;
  features: { icon: React.ElementType; text: string }[];
  cta: string;
  popular: boolean;
}> = ({ name, price, description, features, cta, popular }) => (
  <div
    className={`relative bg-white rounded-xl shadow-lg border-2 overflow-hidden transition-all duration-300 hover:shadow-2xl animate-on-scroll ${
      popular
        ? 'border-amber-500 transform lg:scale-105'
        : 'border-gray-200 card-hover-glow'
    }`}
  >
    {/* Popular Badge */}
    {popular && (
      <div className="absolute top-0 right-0 bg-amber-500 text-white text-xs font-bold px-4 py-1 rounded-bl-lg uppercase tracking-wide">
        Most Popular
      </div>
    )}

    <div className="p-8">
      {/* Plan Name */}
      <h3 className="font-display text-2xl font-bold text-gray-900 mb-2">
        {name}
      </h3>

      {/* Price */}
      <div className="mb-4">
        <span className="text-4xl font-bold text-primary-dark">${price}</span>
        <span className="text-gray-500 text-lg">/month</span>
      </div>

      {/* Description */}
      <p className="text-gray-600 text-sm mb-6 leading-relaxed min-h-[60px]">
        {description}
      </p>

      {/* CTA Button */}
      <Link
        to="/contact"
        className={`block w-full text-center px-6 py-3 rounded-lg font-semibold transition-all shadow-md btn-hover mb-6 ${
          popular
            ? 'glow-pulse'
            : ''
        }`}
        style={
          popular
            ? { backgroundColor: '#ea580c', color: '#ffffff' }
            : { backgroundColor: '#0f172a', color: '#ffffff' }
        }
      >
        {cta}
      </Link>

      {/* Features List */}
      <div className="space-y-3 border-t border-gray-200 pt-6">
        {features.map((feature, idx) => {
          const Icon = feature.icon;
          return (
            <div key={idx} className="flex items-start gap-3">
              <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                popular ? 'text-amber-500' : 'text-teal-600'
              }`} />
              <span className="text-gray-700 text-sm font-medium leading-tight">
                {feature.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

// Comparison Table Row Component
const ComparisonRow: React.FC<{
  feature: string;
  essential: string;
  professional: string;
  enterprise: string;
}> = ({ feature, essential, professional, enterprise }) => (
  <tr className="hover:bg-gray-50 transition-colors">
    <td className="px-6 py-4 text-sm font-medium text-gray-900">
      {feature}
    </td>
    <td className="px-6 py-4 text-sm text-gray-600 text-center">
      {essential === '✓' ? (
        <Check className="w-5 h-5 text-teal-600 mx-auto" />
      ) : (
        essential
      )}
    </td>
    <td className="px-6 py-4 text-sm text-gray-900 font-semibold text-center bg-amber-50">
      {professional === '✓' ? (
        <Check className="w-5 h-5 text-amber-600 mx-auto" />
      ) : (
        professional
      )}
    </td>
    <td className="px-6 py-4 text-sm text-gray-600 text-center">
      {enterprise === '✓' ? (
        <Check className="w-5 h-5 text-teal-600 mx-auto" />
      ) : (
        enterprise
      )}
    </td>
  </tr>
);

export default SupportPlans;
