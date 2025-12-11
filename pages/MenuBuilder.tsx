import React from 'react';
import { Link } from 'react-router-dom';
import {
  UtensilsCrossed,
  FileText,
  DollarSign,
  ImagePlus,
  Palette,
  Grid3X3,
  Download,
  Printer,
  ArrowRight,
  Construction
} from 'lucide-react';

const MenuBuilder: React.FC = () => {
  const upcomingFeatures = [
    {
      icon: FileText,
      title: "Menu Template Library",
      description: "Choose from professionally designed menu templates for fine dining, casual, cafe, bar, and more."
    },
    {
      icon: Grid3X3,
      title: "Drag & Drop Layout",
      description: "Easily arrange sections, categories, and items with an intuitive visual editor."
    },
    {
      icon: DollarSign,
      title: "Dynamic Pricing",
      description: "Manage pricing tiers, specials, happy hour, and seasonal pricing with ease."
    },
    {
      icon: ImagePlus,
      title: "Image Integration",
      description: "Add high-quality photos of your dishes directly into your menu design."
    },
    {
      icon: Palette,
      title: "Brand Customization",
      description: "Match your restaurant's branding with custom colors, fonts, and logos."
    },
    {
      icon: Download,
      title: "Multi-Format Export",
      description: "Export to PDF, PNG, or directly sync with Toast digital menu boards."
    }
  ];

  return (
    <div className="bg-slate-100 min-h-screen">
      {/* Hero Section */}
      <section className="bg-brand-dark text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="p-4 bg-brand-accent/20 rounded-xl">
              <UtensilsCrossed size={48} className="text-brand-accent" />
            </div>
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-center mb-4">
            Menu Builder
          </h1>
          <p className="text-xl text-slate-300 text-center max-w-2xl mx-auto">
            Design beautiful, professional menus for your restaurant with our upcoming menu design tool.
          </p>
        </div>
      </section>

      {/* Coming Soon Banner */}
      <section className="bg-brand-accent/10 border-y border-brand-accent/30 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center gap-4">
            <Construction size={32} className="text-brand-accent" />
            <div className="text-center">
              <h2 className="text-2xl font-bold text-brand-dark">Coming Soon</h2>
              <p className="text-slate-600">
                This powerful tool is currently under development. Check back soon!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Preview */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-serif text-3xl font-bold text-brand-dark text-center mb-4">
            What's Coming
          </h2>
          <p className="text-slate-600 text-center mb-12 max-w-2xl mx-auto">
            The Menu Builder will help you create stunning menus that match your brand and delight your guests.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {upcomingFeatures.map((feature, index) => (
              <div
                key={index}
                className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 bg-brand-accent/10 rounded-xl flex items-center justify-center mb-4">
                  <feature.icon size={24} className="text-brand-accent" />
                </div>
                <h3 className="font-bold text-lg text-brand-dark mb-2">
                  {feature.title}
                </h3>
                <p className="text-slate-600 text-sm">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Preview Mockup */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-slate-900 rounded-2xl p-8 shadow-2xl">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="ml-4 text-slate-400 text-sm">Menu Builder Preview</span>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Left Panel */}
              <div className="bg-slate-800 rounded-xl p-4">
                <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-4">Categories</h4>
                <div className="space-y-2">
                  {['Appetizers', 'Entrees', 'Sides', 'Desserts', 'Beverages'].map(cat => (
                    <div
                      key={cat}
                      className="px-3 py-2 bg-slate-700/50 rounded-lg text-white text-sm hover:bg-slate-700 cursor-pointer transition-colors"
                    >
                      {cat}
                    </div>
                  ))}
                </div>
                <button className="mt-4 w-full py-2 border border-dashed border-slate-600 rounded-lg text-slate-400 text-sm hover:bg-slate-700/50">
                  + Add Category
                </button>
              </div>

              {/* Center Panel - Menu Preview */}
              <div className="bg-white rounded-xl p-6 text-slate-900">
                <div className="text-center mb-6">
                  <h3 className="font-serif text-2xl font-bold">Sample Restaurant</h3>
                  <p className="text-sm text-slate-500">Fine Dining Experience</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-sm uppercase tracking-wider text-brand-accent mb-2">Appetizers</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <div>
                          <span className="font-medium">Tuna Tartare</span>
                          <p className="text-xs text-slate-500">Fresh ahi tuna, avocado, sesame</p>
                        </div>
                        <span className="font-medium">$18</span>
                      </div>
                      <div className="flex justify-between">
                        <div>
                          <span className="font-medium">Burrata</span>
                          <p className="text-xs text-slate-500">Heirloom tomatoes, basil oil</p>
                        </div>
                        <span className="font-medium">$16</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Panel */}
              <div className="bg-slate-800 rounded-xl p-4">
                <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-4">Styling</h4>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-400 block mb-2">Font Family</label>
                    <select className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
                      <option>Playfair Display</option>
                      <option>Inter</option>
                      <option>Lora</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-2">Primary Color</label>
                    <div className="flex gap-2">
                      {['#d97706', '#2563eb', '#059669', '#dc2626', '#7c3aed'].map(color => (
                        <div
                          key={color}
                          className="w-8 h-8 rounded-full cursor-pointer border-2 border-transparent hover:border-white transition-colors"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-2">Layout</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['Single', 'Two-Col', 'Tri-Fold'].map(layout => (
                        <button
                          key={layout}
                          className="py-2 bg-slate-700 rounded-lg text-white text-xs hover:bg-slate-600"
                        >
                          {layout}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-serif text-3xl font-bold text-brand-dark mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-slate-600 mb-8">
            While Menu Builder is under development, check out our Quote Builder to plan your POS installation, or get in touch for a consultation.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/quote"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-brand-accent text-white rounded-lg font-semibold hover:bg-amber-600 transition-colors"
            >
              Try Quote Builder <ArrowRight size={18} />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-300 text-brand-dark rounded-lg font-semibold hover:bg-slate-50 transition-colors"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>

      {/* Notify Me */}
      <section className="py-16 bg-brand-dark text-white">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-serif text-2xl font-bold mb-4">
            Get Notified When It's Ready
          </h2>
          <p className="text-slate-300 mb-6">
            Enter your email to be the first to know when Menu Builder launches.
          </p>
          <form
            className="flex gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              alert('Thank you! We\'ll notify you when Menu Builder launches.');
            }}
          >
            <input
              type="email"
              placeholder="your@email.com"
              className="flex-1 px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-accent"
              required
            />
            <button
              type="submit"
              className="px-6 py-3 bg-brand-accent text-white rounded-lg font-semibold hover:bg-amber-600 transition-colors"
            >
              Notify Me
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};

export default MenuBuilder;
