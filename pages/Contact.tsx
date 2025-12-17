import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, Mail, MapPin, Clock, CheckCircle, AlertCircle, Loader2, Calendar, ArrowRight } from 'lucide-react';
import { PHONE_NUMBER, EMAIL_ADDRESS } from '../constants';
import { useSEO } from '../src/components/SEO';

interface FormData {
  name: string;
  businessName: string;
  email: string;
  phone: string;
  service: string;
  message: string;
  website: string; // Honeypot field
}

interface FormStatus {
  type: 'idle' | 'loading' | 'success' | 'error';
  message: string;
}

const Contact: React.FC = () => {
  useSEO({
    title: 'Contact Toast POS Consultant | Cape Cod Restaurant Tech',
    description: 'Contact Cape Cod\'s trusted Toast POS consultant. Get help with POS installation, menu configuration, or restaurant networking. Call (508) 247-4936 today!',
    canonical: 'https://ccrestaurantconsulting.com/#/contact',
  });

  const [formData, setFormData] = useState<FormData>({
    name: '',
    businessName: '',
    email: '',
    phone: '',
    service: 'Toast POS',
    message: '',
    website: '' // Honeypot - should remain empty
  });

  const [status, setStatus] = useState<FormStatus>({
    type: 'idle',
    message: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic client-side validation
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      setStatus({
        type: 'error',
        message: 'Please fill in all required fields.'
      });
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setStatus({
        type: 'error',
        message: 'Please enter a valid email address.'
      });
      return;
    }

    setStatus({ type: 'loading', message: '' });

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (result.success) {
        setStatus({
          type: 'success',
          message: result.message || 'Thank you! Your message has been sent. We\'ll be in touch soon.'
        });
        // Reset form
        setFormData({
          name: '',
          businessName: '',
          email: '',
          phone: '',
          service: 'Toast POS',
          message: '',
          website: ''
        });
      } else {
        setStatus({
          type: 'error',
          message: result.error || 'Something went wrong. Please try again.'
        });
      }
    } catch (error) {
      setStatus({
        type: 'error',
        message: 'Unable to send message. Please try again or call us directly.'
      });
    }
  };

  return (
    <div className="bg-parchment min-h-screen">
      {/* Header - extends behind transparent nav */}
      <div className="bg-grove-dark py-16 pt-24 border-b border-grove -mt-[72px]">
        <div className="max-w-7xl mx-auto px-4 text-center animate-on-scroll">
          <h1 className="font-serif text-4xl font-bold text-parchment mb-4">Contact Your Cape Cod Toast POS Consultant</h1>
          <div className="brass-line-draw short mb-6" />
          <p className="text-grove-mist">POS down? Call <a href="tel:5082474936" className="text-parchment hover:text-parchment/80 transition-colors">(508) 247-4936</a> immediately. For everything else, fill out the form below.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Contact Info Card */}
          <div className="bg-parchment p-8 rounded-xl shadow-lg border border-sand border-l-4 border-l-grove h-fit animate-on-scroll slide-left card-hover-glow">
            <h2 className="font-serif text-2xl font-bold text-ink mb-6">Contact Info</h2>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="bg-grove p-3 rounded-lg text-parchment">
                  <Phone size={24} />
                </div>
                <div>
                  <p className="font-bold text-ink">Phone</p>
                  <a href={`tel:${PHONE_NUMBER}`} className="text-terracotta font-semibold hover:text-terracotta-dark transition-colors block">{PHONE_NUMBER}</a>
                  <p className="text-xs text-ink-light mt-1">Direct line. If I don't answer, I'm likely on a job site.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-grove p-3 rounded-lg text-parchment">
                  <Mail size={24} />
                </div>
                <div>
                  <p className="font-bold text-ink">Email</p>
                  <a href={`mailto:${EMAIL_ADDRESS}`} className="text-ink-light hover:text-grove transition-colors block">{EMAIL_ADDRESS}</a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-grove p-3 rounded-lg text-parchment">
                  <MapPin size={24} />
                </div>
                <div>
                  <p className="font-bold text-ink">Location</p>
                  <p className="text-ink-light">Cape Cod, Massachusetts</p>
                  <p className="text-xs text-ink-light/70">Serving New England & Remote Nationwide</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-grove p-3 rounded-lg text-parchment">
                  <Clock size={24} />
                </div>
                <div>
                  <p className="font-bold text-ink">Hours</p>
                  <p className="text-ink-light">Mon-Fri: 9 AM - 6 PM</p>
                  <p className="text-xs text-grove font-semibold mt-1">Emergency Support 24/7 for Contract Clients</p>
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-2 bg-parchment p-8 rounded-xl shadow-lg border border-sand border-l-4 border-l-grove animate-on-scroll slide-right">
            <h2 className="font-serif text-2xl font-bold text-ink mb-6">Send a Message</h2>

            {/* Status Messages */}
            {status.type === 'success' && (
              <div className="mb-6 p-4 bg-grove/10 border border-grove/30 rounded-lg flex items-start gap-3">
                <CheckCircle className="text-grove flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="font-semibold text-grove">Message Sent!</p>
                  <p className="text-ink/80 text-sm">{status.message}</p>
                </div>
              </div>
            )}

            {status.type === 'error' && (
              <div className="mb-6 p-4 bg-toast-orange/10 border border-toast-orange/30 rounded-lg flex items-start gap-3">
                <AlertCircle className="text-toast-orange flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="font-semibold text-toast-orange">Error</p>
                  <p className="text-ink/80 text-sm">{status.message}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Honeypot field - hidden from users, bots will fill it */}
              <div className="absolute opacity-0 pointer-events-none" aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }}>
                <label htmlFor="website">Website</label>
                <input
                  type="text"
                  id="website"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-ink mb-2">
                    Your Name <span className="text-toast-orange">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full bg-linen border border-sand rounded-lg p-3 text-ink placeholder-ink-light focus:ring-2 focus:ring-grove focus:border-grove transition-colors"
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="businessName" className="block text-sm font-medium text-ink mb-2">
                    Restaurant Name
                  </label>
                  <input
                    type="text"
                    id="businessName"
                    name="businessName"
                    value={formData.businessName}
                    onChange={handleChange}
                    className="w-full bg-linen border border-sand rounded-lg p-3 text-ink placeholder-ink-light focus:ring-2 focus:ring-grove focus:border-grove transition-colors"
                    placeholder="The Seaside Grill"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-ink mb-2">
                    Email Address <span className="text-toast-orange">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full bg-linen border border-sand rounded-lg p-3 text-ink placeholder-ink-light focus:ring-2 focus:ring-grove focus:border-grove transition-colors"
                    placeholder="john@restaurant.com"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-ink mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full bg-linen border border-sand rounded-lg p-3 text-ink placeholder-ink-light focus:ring-2 focus:ring-grove focus:border-grove transition-colors"
                    placeholder="(508) 555-0123"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="service" className="block text-sm font-medium text-ink mb-2">
                  Service Interest
                </label>
                <select
                  id="service"
                  name="service"
                  value={formData.service}
                  onChange={handleChange}
                  className="w-full bg-linen border border-sand rounded-lg p-3 text-ink focus:ring-2 focus:ring-grove focus:border-grove transition-colors"
                >
                  <option value="Toast POS">Toast POS</option>
                  <option value="Networking">Networking</option>
                  <option value="Operations">Operations</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-ink mb-2">
                  How can I help? <span className="text-toast-orange">*</span>
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={5}
                  value={formData.message}
                  onChange={handleChange}
                  className="w-full bg-linen border border-sand rounded-lg p-3 text-ink placeholder-ink-light focus:ring-2 focus:ring-grove focus:border-grove transition-colors"
                  placeholder="Describe your issue or project..."
                  required
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={status.type === 'loading'}
                className="w-full md:w-auto px-8 py-4 bg-terracotta text-parchment font-bold rounded-lg hover:bg-terracotta-dark transition-all shadow-md disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 glow-pulse"
              >
                {status.type === 'loading' ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Sending...
                  </>
                ) : (
                  'Send Request'
                )}
              </button>
            </form>
          </div>

        </div>

        {/* Schedule a Call Section */}
        <div className="mt-12 bg-parchment rounded-xl shadow-lg overflow-hidden border border-sand border-l-4 border-l-grove animate-on-scroll card-hover-glow">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            {/* Info Side */}
            <div className="bg-linen p-8 flex flex-col justify-center border-r border-sand">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-grove/20 text-grove text-sm font-semibold mb-4 w-fit">
                <Calendar className="w-4 h-4" />
                Book Online
              </div>
              <h3 className="font-serif text-2xl md:text-3xl font-bold text-ink mb-4">
                Prefer to Schedule a Call?
              </h3>
              <p className="text-ink-light mb-6">
                Skip the form and book a time directly on my calendar. Choose a slot that works around your service schedule.
              </p>
              <div className="space-y-3 text-ink-light text-sm mb-6">
                <div className="flex items-center gap-2">
                  <CheckCircle className="text-grove w-4 h-4" />
                  <span>15-30 min discovery calls</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="text-grove w-4 h-4" />
                  <span>Evening availability</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="text-grove w-4 h-4" />
                  <span>Calendar confirmations</span>
                </div>
              </div>
              <Link
                to="/schedule"
                className="inline-flex items-center gap-2 px-6 py-3 bg-terracotta text-parchment rounded-lg font-bold hover:bg-terracotta-dark transition-colors w-fit glow-pulse"
              >
                View Full Calendar
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Compact Acuity Embed */}
            <div className="p-4 bg-parchment">
              <iframe
                src="https://app.acuityscheduling.com/schedule.php?owner=34242148"
                title="Schedule Appointment"
                width="100%"
                height="450"
                frameBorder="0"
                className="w-full rounded-lg"
              ></iframe>
              <p className="text-center text-xs text-ink-light mt-2">
                <a
                  href="https://app.acuityscheduling.com/schedule.php?owner=34242148"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-grove transition-colors"
                >
                  Open in new window
                </a>
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Contact;
