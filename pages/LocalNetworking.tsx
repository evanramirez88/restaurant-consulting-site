import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Cable,
  Wifi,
  Monitor,
  Wrench,
  Check,
  X,
  MapPin,
  Clock,
  Shield,
  Zap,
  Thermometer,
  Server,
  ArrowRight
} from 'lucide-react';
import { useSEO } from '../src/components/SEO';

const LocalNetworking: React.FC = () => {
  const [parallaxOffset, setParallaxOffset] = useState(0);

  useSEO({
    title: 'Restaurant Networking & Cabling | Cape Cod, MA | Toast POS Specialists',
    description: "Cape Cod's only restaurant-focused network installer. Toast POS setup, commercial kitchen cabling, WiFi that survives the dinner rush. Serving Provincetown to Providence.",
    canonical: 'https://ccrestaurantconsulting.com/#/local-networking',
  });

  // Inject LocalBusiness + Service schema
  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "LocalBusiness",
          "@id": "https://ccrestaurantconsulting.com/#business",
          "name": "Cape Cod Restaurant Consulting",
          "description": "Restaurant-focused network installation and IT services for commercial kitchens in Cape Cod, MA and Southeastern New England.",
          "url": "https://ccrestaurantconsulting.com",
          "telephone": "(774) 408-0083",
          "email": "ramirezconsulting.rg@gmail.com",
          "areaServed": [
            {
              "@type": "GeoCircle",
              "geoMidpoint": {
                "@type": "GeoCoordinates",
                "latitude": 41.6688,
                "longitude": -70.2962
              },
              "geoRadius": "80000"
            }
          ],
          "serviceArea": [
            "Cape Cod, MA",
            "Plymouth, MA",
            "Wareham, MA",
            "Providence, RI",
            "Southeastern Massachusetts"
          ],
          "priceRange": "$$"
        },
        {
          "@type": "Service",
          "name": "Restaurant-Grade Structured Cabling",
          "description": "Cat6 cable runs avoiding heat zones, moisture, and health code concerns. Proper conduit and clean terminations.",
          "provider": { "@id": "https://ccrestaurantconsulting.com/#business" },
          "areaServed": "Cape Cod, MA",
          "offers": {
            "@type": "Offer",
            "priceSpecification": {
              "@type": "PriceSpecification",
              "price": "125-300",
              "priceCurrency": "USD",
              "unitText": "per drop"
            }
          }
        },
        {
          "@type": "Service",
          "name": "Toast POS Network Setup",
          "description": "Dedicated VLAN configuration, QoS bandwidth management, and 5GHz WiFi optimization for Toast POS systems.",
          "provider": { "@id": "https://ccrestaurantconsulting.com/#business" },
          "areaServed": "Cape Cod, MA"
        },
        {
          "@type": "Service",
          "name": "Commercial Kitchen WiFi Design",
          "description": "Strategic access point placement accounting for stainless steel dead zones, microwave interference, and PCI compliance.",
          "provider": { "@id": "https://ccrestaurantconsulting.com/#business" },
          "areaServed": "Cape Cod, MA",
          "offers": {
            "@type": "Offer",
            "priceSpecification": {
              "@type": "PriceSpecification",
              "price": "150",
              "priceCurrency": "USD",
              "unitText": "per access point"
            }
          }
        },
        {
          "@type": "Service",
          "name": "Restaurant IT Maintenance & Support",
          "description": "Ongoing network support contracts with emergency response for restaurant operations.",
          "provider": { "@id": "https://ccrestaurantconsulting.com/#business" },
          "areaServed": "Cape Cod, MA",
          "offers": {
            "@type": "Offer",
            "priceSpecification": {
              "@type": "PriceSpecification",
              "price": "150-500",
              "priceCurrency": "USD",
              "unitText": "per month"
            }
          }
        }
      ]
    };

    const existingScript = document.querySelector('script[data-schema="local-networking"]');
    if (existingScript) existingScript.remove();

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-schema', 'local-networking');
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      const scriptToRemove = document.querySelector('script[data-schema="local-networking"]');
      if (scriptToRemove) scriptToRemove.remove();
    };
  }, []);

  // Parallax scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setParallaxOffset(window.scrollY * 0.3);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const supportPlans = [
    {
      name: 'Basic',
      price: 150,
      features: [
        '48-hour response time',
        'Business hours support',
        'Remote diagnostics',
        'Quarterly system check'
      ],
      highlighted: false
    },
    {
      name: 'Premium',
      price: 300,
      features: [
        '24-hour response time',
        'After-hours support',
        'Remote & on-site service',
        'Monthly system review',
        'Priority scheduling'
      ],
      highlighted: true
    },
    {
      name: 'Enterprise',
      price: 500,
      features: [
        '24/7 monitoring',
        'On-site critical support',
        'Emergency response',
        'Dedicated account manager',
        'Proactive maintenance',
        'Hardware loan program'
      ],
      highlighted: false
    }
  ];

  const comparisonData = [
    {
      feature: 'Work Schedule',
      generic: 'Works 9-5 Monday-Friday',
      ccrc: 'Works your dark hours—overnight installs, Monday closures'
    },
    {
      feature: 'Cable Routing',
      generic: 'Routes cables wherever convenient',
      ccrc: 'Routes around grease, heat, and health code concerns'
    },
    {
      feature: 'Network Design',
      generic: 'One network for everything',
      ccrc: 'Separate VLANs: POS, guest WiFi, security cameras, music'
    },
    {
      feature: 'Response Time',
      generic: '"We\'ll send someone Tuesday"',
      ccrc: 'Emergency response for service-killing outages'
    },
    {
      feature: 'Environment Knowledge',
      generic: 'Thinks "commercial" means office',
      ccrc: 'Knows a kitchen is the toughest environment for electronics'
    }
  ];

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-primary-dark grain-overlay">
        {/* Parallax decorative elements */}
        <div
          className="absolute top-20 left-10 w-64 h-64 rounded-full opacity-10 blur-3xl"
          style={{
            background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)',
            transform: `translateY(${parallaxOffset * 0.5}px)`
          }}
        />
        <div
          className="absolute bottom-40 right-10 w-96 h-96 rounded-full opacity-10 blur-3xl"
          style={{
            background: 'radial-gradient(circle, #0ea5e9 0%, transparent 70%)',
            transform: `translateY(${parallaxOffset * 0.3}px)`
          }}
        />

        {/* Main content */}
        <div className="relative z-20 max-w-4xl mx-auto px-4 text-center py-20">
          <span className="inline-flex items-center gap-2 bg-teal-600/90 text-white text-sm px-4 py-2 rounded-full mb-8 hero-fade-in">
            <Cable className="w-4 h-4" />
            Restaurant-Focused Network Solutions
          </span>

          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 hero-fade-in hero-fade-in-delay-1">
            Heavy-Duty Networking for<br />
            <span className="text-amber-400 italic">Cape Cod Restaurants</span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-300 mb-8 hero-fade-in hero-fade-in-delay-2">
            Low-voltage cabling, WiFi optimization, and POS infrastructure installed by a restaurant consultant—not just an IT guy.
          </p>

          <div className="text-gray-400 text-lg leading-relaxed max-w-3xl mx-auto mb-8 hero-fade-in hero-fade-in-delay-3">
            <p className="mb-4">
              Most networking companies build for climate-controlled offices. They don't understand that a commercial kitchen is a hostile environment—hot, greasy, wet, and surrounded by WiFi-killing stainless steel.
            </p>
            <p className="mb-4">
              I've spent years not just in IT, but in professional kitchens. I know that cable routed near the fryer will fail. I know the microwave kills your 2.4GHz WiFi every time someone reheats soup. I know the health inspector will flag "spaghetti wiring" over the prep station.
            </p>
          </div>

          <p className="text-2xl md:text-3xl font-display font-bold text-white mb-10 hero-fade-in hero-fade-in-delay-4">
            "I build networks that survive the dinner rush."
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4 hero-fade-in hero-fade-in-delay-4">
            <Link
              to="/schedule"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl hover:scale-105"
              style={{ backgroundColor: '#ea580c', color: '#ffffff' }}
            >
              Get a Free Site Survey
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href="tel:+17744080083"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg font-semibold bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-all"
            >
              (774) 408-0083
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center">
            <div className="w-1 h-3 bg-white/50 rounded-full mt-2 animate-pulse" />
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16 animate-on-scroll">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Networking Services Built for Restaurants
            </h2>
            <div className="brass-line-draw short mb-6" />
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              Every service designed around the unique challenges of commercial kitchen environments.
            </p>
          </div>

          <div className="space-y-8">
            {/* Structured Cabling */}
            <ServiceCard
              icon={Cable}
              title="Restaurant-Grade Structured Cabling"
              description="Cat6 runs that avoid heat zones, moisture, and the path of monthly hood pressure washing. Proper conduit where health codes require it. Clean terminations that pass inspection and certification."
              pricing={[
                "Per-drop pricing: $125-$300 depending on complexity",
                "Upgrade packages starting at $250 (up to 10 drops)"
              ]}
              features={[
                "Heat-resistant cable routing",
                "Health code compliant installation",
                "Certified terminations",
                "Proper conduit and labeling"
              ]}
            />

            {/* Toast POS Setup */}
            <ServiceCard
              icon={Monitor}
              title="Toast POS Network Setup"
              description="Your Toast system needs more than 'plug it in.' I configure the dedicated VLAN (192.168.192.0/24), set up QoS to guarantee Toast bandwidth, and ensure 5GHz-only WiFi with -65dBm minimum coverage. When your internet dies, your POS keeps running in offline mode—because I hardwired the critical stations."
              features={[
                "Dedicated VLAN configuration",
                "QoS bandwidth prioritization",
                "5GHz WiFi optimization (-65dBm coverage)",
                "Offline mode failover setup",
                "Hardwired critical stations"
              ]}
            />

            {/* Commercial WiFi */}
            <ServiceCard
              icon={Wifi}
              title="Commercial Kitchen WiFi Design"
              description="Strategic access point placement that accounts for stainless steel dead zones, microwave interference, and the refrigeration units that eat wireless signals. Guest WiFi segregated from POS traffic for PCI compliance."
              pricing={[
                "AP installation: $150 per access point",
                "Site surveys included"
              ]}
              features={[
                "Dead zone elimination",
                "Microwave interference mitigation",
                "PCI-compliant network segregation",
                "Guest vs. operations separation"
              ]}
            />

            {/* Maintenance & Support */}
            <ServiceCard
              icon={Wrench}
              title="Maintenance & Support Contracts"
              description={`Because "call us Monday" doesn't work when your kitchen printer dies at 7pm on Saturday.`}
              isSupport
            />
          </div>
        </div>
      </section>

      {/* Support Plans Grid */}
      <section className="py-20 section-light-gradient">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12 animate-on-scroll">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Support Plans
            </h2>
            <div className="brass-line-draw short mb-6" />
            <p className="text-gray-600 text-lg">
              Choose the level of coverage that fits your operation.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {supportPlans.map((plan, idx) => (
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

                  <div className="mb-6">
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl sm:text-5xl font-bold text-gray-900">
                        ${plan.price}
                      </span>
                      <span className="text-gray-600">/month</span>
                    </div>
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
                    Get Started
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Differentiator Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12 animate-on-scroll">
            <span className="text-amber-600 font-bold uppercase tracking-wider text-sm">
              The Blue Collar Geek Difference
            </span>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mt-2 mb-4">
              Why Hire a Restaurant Consultant for Cabling?
            </h2>
            <div className="brass-line-draw short mb-6" />
          </div>

          {/* Comparison Table */}
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden mb-12 animate-on-scroll">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b-2 border-gray-200">
                    <th className="text-left p-4 font-semibold text-gray-900 w-1/4">Comparison</th>
                    <th className="text-center p-4 font-semibold text-gray-500 w-[37.5%]">
                      <div className="flex items-center justify-center gap-2">
                        <X className="w-5 h-5 text-red-400" />
                        Generic IT Company
                      </div>
                    </th>
                    <th className="text-center p-4 font-semibold text-amber-600 bg-amber-50 w-[37.5%]">
                      <div className="flex items-center justify-center gap-2">
                        <Check className="w-5 h-5 text-green-500" />
                        CC Restaurant Consulting
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-4 font-medium text-gray-900 border-b border-gray-200">
                        {row.feature}
                      </td>
                      <td className="p-4 text-center text-gray-500 border-b border-gray-200">
                        {row.generic}
                      </td>
                      <td className="p-4 text-center bg-amber-50 border-b border-amber-100 text-gray-900 font-medium">
                        {row.ccrc}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden p-4 space-y-4">
              {comparisonData.map((row, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-100 p-3 font-semibold text-gray-900">
                    {row.feature}
                  </div>
                  <div className="p-3 space-y-3">
                    <div className="flex items-start gap-2">
                      <X className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs text-gray-500 uppercase">Generic IT</div>
                        <div className="text-sm text-gray-600">{row.generic}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 bg-amber-50 -mx-3 -mb-3 p-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs text-amber-600 uppercase font-semibold">CCRC</div>
                        <div className="text-sm text-gray-900 font-medium">{row.ccrc}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Handyman Edge */}
          <div className="bg-gradient-to-br from-primary-dark to-gray-800 rounded-2xl p-8 md:p-12 text-center animate-on-scroll">
            <div className="inline-flex items-center gap-2 bg-amber-500/20 text-amber-400 text-sm px-4 py-2 rounded-full mb-6">
              <Zap className="w-4 h-4" />
              The Handyman Edge
            </div>
            <h3 className="font-display text-2xl md:text-3xl font-bold text-white mb-4">
              One Contractor. One Invoice. One Point of Accountability.
            </h3>
            <p className="text-gray-300 text-lg max-w-2xl mx-auto">
              I can mount the TV, patch the drywall, run the conduit, and configure the VLAN.
              No juggling multiple vendors or playing phone tag between contractors.
            </p>
          </div>
        </div>
      </section>

      {/* Service Area Section */}
      <section className="py-20 section-light-gradient">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12 animate-on-scroll">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Specialized On-Site Service for Southeastern New England
            </h2>
            <div className="brass-line-draw short mb-6" />
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200 animate-on-scroll">
              <div className="w-12 h-12 bg-primary-dark rounded-full flex items-center justify-center mb-4">
                <MapPin className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-display text-xl font-bold text-gray-900 mb-2">The Cape</h3>
              <p className="text-gray-600">
                Provincetown to Bourne<br />
                <span className="text-amber-600 font-semibold text-sm">(Relocating to Falmouth Feb 2026)</span>
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200 animate-on-scroll" style={{ animationDelay: '100ms' }}>
              <div className="w-12 h-12 bg-primary-dark rounded-full flex items-center justify-center mb-4">
                <MapPin className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-display text-xl font-bold text-gray-900 mb-2">The Bridge</h3>
              <p className="text-gray-600">
                Plymouth & Wareham
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200 animate-on-scroll" style={{ animationDelay: '200ms' }}>
              <div className="w-12 h-12 bg-primary-dark rounded-full flex items-center justify-center mb-4">
                <MapPin className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-display text-xl font-bold text-gray-900 mb-2">The City</h3>
              <p className="text-gray-600">
                Providence, RI & surrounding areas
              </p>
            </div>
          </div>

          <div className="text-center animate-on-scroll">
            <p className="text-gray-600 mb-4">
              Not local? We offer remote Toast support nationwide.
            </p>
            <Link
              to="/services"
              className="inline-flex items-center gap-2 text-amber-600 font-semibold hover:text-amber-700 transition-colors"
            >
              See our Remote Toast Support packages
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Cross-Sell Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Toast Remote Support */}
            <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-8 hover:shadow-xl transition-shadow animate-on-scroll">
              <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center mb-4">
                <Monitor className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-display text-2xl font-bold text-gray-900 mb-3">
                Already Have the Network? Need Help With Toast?
              </h3>
              <p className="text-gray-600 mb-6">
                I'm a certified Toast POS specialist offering remote menu engineering, configuration, and database management nationwide. Once your cables are run, I can handle the software side.
              </p>
              <Link
                to="/services"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all shadow-md hover:opacity-90"
                style={{ backgroundColor: '#ea580c', color: '#ffffff' }}
              >
                Explore Remote Toast Support
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* New Location Package */}
            <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-8 hover:shadow-xl transition-shadow animate-on-scroll" style={{ animationDelay: '100ms' }}>
              <div className="w-12 h-12 bg-primary-dark rounded-full flex items-center justify-center mb-4">
                <Server className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-display text-2xl font-bold text-gray-900 mb-3">
                Opening a New Location in MA/RI?
              </h3>
              <p className="text-gray-600 mb-6">
                I offer comprehensive opening packages: infrastructure audit, cabling installation, POS setup, and staff training—all from one provider who understands restaurant operations.
              </p>
              <Link
                to="/schedule"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all shadow-md hover:opacity-90"
                style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
              >
                Schedule a Consultation
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-primary-dark relative grain-overlay">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="font-display text-3xl md:text-5xl font-bold text-white mb-6">
            Ready to Build a Network That<br />
            <span className="text-amber-400 italic">Survives the Dinner Rush?</span>
          </h2>
          <div className="brass-line-draw short mb-6" />
          <p className="text-gray-300 text-lg mb-10 max-w-2xl mx-auto">
            Let's start with a free site survey. I'll walk your space, identify potential issues, and provide a detailed quote—no obligation.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              to="/schedule"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl hover:scale-105"
              style={{ backgroundColor: '#ea580c', color: '#ffffff' }}
            >
              Get Your Free Site Survey
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/quote"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg font-semibold bg-white text-gray-900 hover:bg-gray-100 transition-all shadow-lg"
            >
              Build Your Quote
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

// Service Card Component
const ServiceCard: React.FC<{
  icon: React.ElementType;
  title: string;
  description: string;
  pricing?: string[];
  features?: string[];
  isSupport?: boolean;
}> = ({ icon: Icon, title, description, pricing, features, isSupport }) => (
  <div className="bg-white rounded-xl shadow-md border border-gray-200 border-l-4 border-l-amber-500 overflow-hidden animate-on-scroll card-hover-glow">
    <div className="p-8">
      <div className="flex items-start gap-6">
        <div className="w-16 h-16 bg-primary-dark rounded-full flex items-center justify-center flex-shrink-0">
          <Icon className="w-8 h-8 text-white" />
        </div>
        <div className="flex-grow">
          <h3 className="font-display text-2xl font-bold text-gray-900 mb-3">{title}</h3>
          <p className="text-gray-600 leading-relaxed mb-4">{description}</p>

          {pricing && pricing.length > 0 && (
            <div className="mb-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
              {pricing.map((price, idx) => (
                <p key={idx} className="text-amber-800 font-semibold text-sm">
                  {price}
                </p>
              ))}
            </div>
          )}

          {features && features.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {features.map((feature, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700 text-sm">{feature}</span>
                </div>
              ))}
            </div>
          )}

          {isSupport && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-gray-600 text-sm mb-2">See support plans below for pricing:</p>
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-gray-700"><strong>Basic:</strong> $150/mo</span>
                <span className="text-gray-700"><strong>Premium:</strong> $300/mo</span>
                <span className="text-gray-700"><strong>Enterprise:</strong> $500/mo</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
);

export default LocalNetworking;
