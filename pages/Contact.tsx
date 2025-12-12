import React, { useState } from 'react';
import { Phone, Mail, MapPin, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { PHONE_NUMBER, EMAIL_ADDRESS } from '../constants';

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
  const [formData, setFormData] = useState<FormData>({
    name: '',
    businessName: '',
    email: '',
    phone: '',
    service: 'New POS Installation',
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
          service: 'New POS Installation',
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
    <div className="bg-slate-50 min-h-screen">
      <div className="bg-brand-dark py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h1 className="font-serif text-4xl font-bold text-white mb-4">Get In Touch</h1>
          <p className="text-slate-300">POS Down? Call immediately. For everything else, fill out the form.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Contact Info Card */}
          <div className="bg-white p-8 rounded-xl shadow-lg border-t-4 border-brand-accent h-fit">
            <h3 className="font-serif text-2xl font-bold text-brand-dark mb-6">Contact Info</h3>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="bg-brand-primary/10 p-3 rounded-lg text-brand-primary">
                  <Phone size={24} />
                </div>
                <div>
                  <p className="font-bold text-slate-800">Phone</p>
                  <a href={`tel:${PHONE_NUMBER}`} className="text-brand-accent font-semibold hover:underline block">{PHONE_NUMBER}</a>
                  <p className="text-xs text-slate-500 mt-1">Direct line. If I don't answer, I'm likely on a job site.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-brand-primary/10 p-3 rounded-lg text-brand-primary">
                  <Mail size={24} />
                </div>
                <div>
                  <p className="font-bold text-slate-800">Email</p>
                  <a href={`mailto:${EMAIL_ADDRESS}`} className="text-slate-600 hover:text-brand-accent block">{EMAIL_ADDRESS}</a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-brand-primary/10 p-3 rounded-lg text-brand-primary">
                  <MapPin size={24} />
                </div>
                <div>
                  <p className="font-bold text-slate-800">Location</p>
                  <p className="text-slate-600">Cape Cod, Massachusetts</p>
                  <p className="text-xs text-slate-500">Serving New England & Remote Nationwide</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-brand-primary/10 p-3 rounded-lg text-brand-primary">
                  <Clock size={24} />
                </div>
                <div>
                  <p className="font-bold text-slate-800">Hours</p>
                  <p className="text-slate-600">Mon-Fri: 9 AM - 6 PM</p>
                  <p className="text-xs text-brand-accent font-semibold mt-1">Emergency Support 24/7 for Contract Clients</p>
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-2 bg-white p-8 rounded-xl shadow-lg">
            <h3 className="font-serif text-2xl font-bold text-brand-dark mb-6">Send a Message</h3>

            {/* Status Messages */}
            {status.type === 'success' && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="font-semibold text-green-800">Message Sent!</p>
                  <p className="text-green-700 text-sm">{status.message}</p>
                </div>
              </div>
            )}

            {status.type === 'error' && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="font-semibold text-red-800">Error</p>
                  <p className="text-red-700 text-sm">{status.message}</p>
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
                  <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
                    Your Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-brand-accent focus:border-brand-accent transition-colors"
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="businessName" className="block text-sm font-medium text-slate-700 mb-2">
                    Restaurant Name
                  </label>
                  <input
                    type="text"
                    id="businessName"
                    name="businessName"
                    value={formData.businessName}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-brand-accent focus:border-brand-accent transition-colors"
                    placeholder="The Seaside Grill"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-brand-accent focus:border-brand-accent transition-colors"
                    placeholder="john@restaurant.com"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-brand-accent focus:border-brand-accent transition-colors"
                    placeholder="(508) 555-0123"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="service" className="block text-sm font-medium text-slate-700 mb-2">
                  Service Needed
                </label>
                <select
                  id="service"
                  name="service"
                  value={formData.service}
                  onChange={handleChange}
                  className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-brand-accent focus:border-brand-accent transition-colors"
                >
                  <option value="New POS Installation">New POS Installation</option>
                  <option value="Network/Wifi Issues">Network/Wifi Issues</option>
                  <option value="Operations Consulting">Operations Consulting</option>
                  <option value="Urgent Support">Urgent Support</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-2">
                  How can I help? <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={5}
                  value={formData.message}
                  onChange={handleChange}
                  className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-brand-accent focus:border-brand-accent transition-colors"
                  placeholder="Describe your issue or project..."
                  required
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={status.type === 'loading'}
                className="w-full md:w-auto px-8 py-4 bg-brand-accent text-white font-bold rounded-lg hover:bg-amber-600 transition-all shadow-md disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
      </div>
    </div>
  );
};

export default Contact;
