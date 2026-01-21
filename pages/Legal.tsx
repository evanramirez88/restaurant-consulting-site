import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, FileText, Lock, Mail, Phone } from 'lucide-react';
import { useSEO } from '../src/components/SEO';
import { COMPANY_NAME, PHONE_NUMBER, EMAIL_ADDRESS } from '../constants';

const Legal: React.FC = () => {
  useSEO({
    title: 'Terms of Service & Privacy Policy | Cape Cod Restaurant Consulting',
    description: 'Terms of service, privacy policy, and legal information for R&G Consulting LLC restaurant technology services.',
    canonical: 'https://ccrestaurantconsulting.com/#/legal',
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-primary-dark py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <Shield className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h1 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">
            Legal Information
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Terms of Service and Privacy Policy for R&G Consulting LLC
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="max-w-4xl mx-auto px-6">
          <nav className="flex gap-8 py-4">
            <a href="#terms" className="text-gray-600 hover:text-amber-500 font-medium transition-colors">
              Terms of Service
            </a>
            <a href="#privacy" className="text-gray-600 hover:text-amber-500 font-medium transition-colors">
              Privacy Policy
            </a>
            <a href="#contact" className="text-gray-600 hover:text-amber-500 font-medium transition-colors">
              Contact
            </a>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">

        {/* Terms of Service */}
        <section id="terms" className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-6 h-6 text-amber-500" />
            <h2 className="font-display text-2xl font-bold text-gray-900">Terms of Service</h2>
          </div>

          <p className="text-gray-500 text-sm mb-6">Last updated: January 21, 2026</p>

          <div className="prose prose-gray max-w-none space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">1. Agreement to Terms</h3>
            <p className="text-gray-600">
              By accessing or using the services provided by R&G Consulting LLC ("Company," "we," "us," or "our"),
              you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not
              use our services.
            </p>

            <h3 className="text-lg font-semibold text-gray-900">2. Services Description</h3>
            <p className="text-gray-600">
              R&G Consulting LLC provides restaurant technology consulting services, including but not limited to:
            </p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>Toast POS installation, configuration, and support</li>
              <li>Restaurant networking and IT infrastructure</li>
              <li>Menu engineering and configuration services</li>
              <li>Staff training and documentation</li>
              <li>Ongoing technical support plans</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900">3. Service Agreements</h3>
            <p className="text-gray-600">
              All project work and ongoing support services are subject to separate service agreements that
              outline specific terms, deliverables, timelines, and pricing. These Terms of Service apply in
              addition to any specific service agreement.
            </p>

            <h3 className="text-lg font-semibold text-gray-900">4. Payment Terms</h3>
            <p className="text-gray-600">
              Payment terms are specified in individual service agreements. Support plan subscriptions are
              billed quarterly in advance. Project work may require deposits or milestone payments as outlined
              in the project proposal.
            </p>

            <h3 className="text-lg font-semibold text-gray-900">5. Intellectual Property</h3>
            <p className="text-gray-600">
              All proprietary tools, methodologies, and documentation developed by R&G Consulting LLC remain
              the intellectual property of the Company. Client-specific configurations and customizations
              become the property of the client upon full payment.
            </p>

            <h3 className="text-lg font-semibold text-gray-900">6. Limitation of Liability</h3>
            <p className="text-gray-600">
              R&G Consulting LLC shall not be liable for any indirect, incidental, special, consequential,
              or punitive damages resulting from your use of our services. Our total liability shall not
              exceed the amount paid for the specific services in question.
            </p>

            <h3 className="text-lg font-semibold text-gray-900">7. Confidentiality</h3>
            <p className="text-gray-600">
              We maintain strict confidentiality regarding all client business information, including but not
              limited to sales data, menu pricing, operational procedures, and employee information. We will
              not disclose confidential information to third parties without your consent.
            </p>

            <h3 className="text-lg font-semibold text-gray-900">8. Termination</h3>
            <p className="text-gray-600">
              Either party may terminate ongoing services with 30 days written notice. Prepaid support plan
              fees are non-refundable but may be prorated at our discretion for terminations without cause.
            </p>

            <h3 className="text-lg font-semibold text-gray-900">9. Governing Law</h3>
            <p className="text-gray-600">
              These Terms shall be governed by and construed in accordance with the laws of the Commonwealth
              of Massachusetts, without regard to its conflict of law provisions.
            </p>
          </div>
        </section>

        {/* Privacy Policy */}
        <section id="privacy" className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <Lock className="w-6 h-6 text-amber-500" />
            <h2 className="font-display text-2xl font-bold text-gray-900">Privacy Policy</h2>
          </div>

          <p className="text-gray-500 text-sm mb-6">Last updated: January 21, 2026</p>

          <div className="prose prose-gray max-w-none space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Information We Collect</h3>
            <p className="text-gray-600">
              We collect information you provide directly to us, including:
            </p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>Contact information (name, email, phone number, business address)</li>
              <li>Business information (restaurant name, type, size, current technology stack)</li>
              <li>Project requirements and specifications</li>
              <li>Communication history and support tickets</li>
              <li>Billing and payment information</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900">How We Use Your Information</h3>
            <p className="text-gray-600">We use the information we collect to:</p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>Provide, maintain, and improve our services</li>
              <li>Process transactions and send related information</li>
              <li>Send technical notices, updates, and support messages</li>
              <li>Respond to your comments, questions, and requests</li>
              <li>Develop and improve our service offerings</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900">Information Sharing</h3>
            <p className="text-gray-600">
              We do not sell, trade, or rent your personal information to third parties. We may share
              information only in the following circumstances:
            </p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>With service providers who assist in our operations (e.g., payment processors)</li>
              <li>To comply with legal obligations or respond to lawful requests</li>
              <li>To protect our rights, privacy, safety, or property</li>
              <li>With your consent or at your direction</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900">Data Security</h3>
            <p className="text-gray-600">
              We implement appropriate technical and organizational measures to protect your personal
              information against unauthorized access, alteration, disclosure, or destruction. This includes
              encryption of data in transit and at rest, secure authentication methods, and regular security
              assessments.
            </p>

            <h3 className="text-lg font-semibold text-gray-900">Data Retention</h3>
            <p className="text-gray-600">
              We retain your personal information for as long as necessary to provide our services and
              fulfill the purposes described in this policy. We may retain certain information for longer
              periods as required by law or for legitimate business purposes.
            </p>

            <h3 className="text-lg font-semibold text-gray-900">Your Rights</h3>
            <p className="text-gray-600">You have the right to:</p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your information (subject to legal requirements)</li>
              <li>Opt out of marketing communications</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900">Cookies and Analytics</h3>
            <p className="text-gray-600">
              Our website may use cookies and similar technologies to enhance your experience and analyze
              site usage. You can control cookie preferences through your browser settings.
            </p>

            <h3 className="text-lg font-semibold text-gray-900">Third-Party Services</h3>
            <p className="text-gray-600">
              Our services may integrate with third-party platforms (e.g., Toast, Square, Stripe). Your use
              of these platforms is subject to their respective privacy policies.
            </p>

            <h3 className="text-lg font-semibold text-gray-900">Changes to This Policy</h3>
            <p className="text-gray-600">
              We may update this Privacy Policy from time to time. We will notify you of any material changes
              by posting the new policy on this page and updating the "Last updated" date.
            </p>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="bg-gray-50 rounded-2xl p-8">
          <h2 className="font-display text-xl font-bold text-gray-900 mb-4">Questions or Concerns?</h2>
          <p className="text-gray-600 mb-6">
            If you have any questions about these Terms of Service or our Privacy Policy, please contact us:
          </p>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-gray-600">
              <Mail className="w-5 h-5 text-amber-500" />
              <a href={`mailto:${EMAIL_ADDRESS}`} className="hover:text-amber-500 transition-colors">
                {EMAIL_ADDRESS}
              </a>
            </div>
            <div className="flex items-center gap-3 text-gray-600">
              <Phone className="w-5 h-5 text-amber-500" />
              <a href={`tel:${PHONE_NUMBER}`} className="hover:text-amber-500 transition-colors">
                {PHONE_NUMBER}
              </a>
            </div>
          </div>
          <p className="text-gray-500 text-sm mt-6">
            R&G Consulting LLC<br />
            Cape Cod, Massachusetts
          </p>
        </section>
      </div>
    </div>
  );
};

export default Legal;
