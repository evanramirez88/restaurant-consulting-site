import React from 'react';
import { Phone, Mail, MapPin, Clock } from 'lucide-react';
import { PHONE_NUMBER, EMAIL_ADDRESS } from '../constants';

const Contact: React.FC = () => {
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
            <form className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Your Name</label>
                  <input type="text" className="w-full border-slate-300 rounded-lg p-3 focus:ring-brand-accent focus:border-brand-accent" placeholder="John Doe" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Restaurant Name</label>
                  <input type="text" className="w-full border-slate-300 rounded-lg p-3 focus:ring-brand-accent focus:border-brand-accent" placeholder="The Seaside Grill" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
                  <input type="email" className="w-full border-slate-300 rounded-lg p-3 focus:ring-brand-accent focus:border-brand-accent" placeholder="john@restaurant.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Phone Number</label>
                  <input type="tel" className="w-full border-slate-300 rounded-lg p-3 focus:ring-brand-accent focus:border-brand-accent" placeholder="(508) 555-0123" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Service Needed</label>
                <select className="w-full border-slate-300 rounded-lg p-3 focus:ring-brand-accent focus:border-brand-accent">
                  <option>New POS Installation</option>
                  <option>Network/Wifi Issues</option>
                  <option>Operations Consulting</option>
                  <option>Urgent Support</option>
                  <option>Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">How can I help?</label>
                <textarea rows={5} className="w-full border-slate-300 rounded-lg p-3 focus:ring-brand-accent focus:border-brand-accent" placeholder="Describe your issue or project..."></textarea>
              </div>

              <button type="submit" className="w-full md:w-auto px-8 py-4 bg-brand-accent text-white font-bold rounded-lg hover:bg-amber-600 transition-all shadow-md">
                Send Request
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Contact;