import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useParams, useSearchParams } from 'react-router-dom';
import { Briefcase, Loader2, AlertCircle, Mail, ArrowRight, Check, ArrowLeft } from 'lucide-react';
import { useSEO } from '../../src/components/SEO';

interface LoginStatus {
  type: 'idle' | 'loading' | 'error' | 'success';
  message: string;
}

const RepLogin: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useSEO({
    title: 'Rep Login | Cape Cod Restaurant Consulting',
    description: 'Sign in to your Cape Cod Restaurant Consulting rep portal.',
  });

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<LoginStatus>({
    type: 'idle',
    message: ''
  });
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [repInfo, setRepInfo] = useState<{ name: string; territory: string | null } | null>(null);
  const [isLoadingRep, setIsLoadingRep] = useState(true);

  // Check for magic link token in URL
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      verifyMagicLink(token);
    }
  }, [searchParams]);

  // Load rep info and check if already authenticated
  useEffect(() => {
    const init = async () => {
      try {
        // Load rep info by slug
        const repRes = await fetch(`/api/rep/${slug}/info`);
        const repData = await repRes.json();

        if (repData.success && repData.data) {
          setRepInfo({
            name: repData.data.name,
            territory: repData.data.territory
          });

          // Check if already authenticated
          const authRes = await fetch(`/api/rep/${slug}/auth/verify`);
          const authData = await authRes.json();

          if (authData.authenticated) {
            navigate(`/rep/${slug}/dashboard`);
            return;
          }
        }
      } catch (error) {
        console.error('Init error:', error);
      } finally {
        setIsLoadingRep(false);
      }
    };

    init();
  }, [slug, navigate]);

  const verifyMagicLink = async (token: string) => {
    setStatus({ type: 'loading', message: 'Verifying login...' });

    try {
      const response = await fetch(`/api/rep/${slug}/auth/verify-magic-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      const result = await response.json();

      if (result.success) {
        navigate(`/rep/${slug}/dashboard`);
      } else {
        setStatus({
          type: 'error',
          message: result.error || 'Invalid or expired link. Please request a new one.'
        });
      }
    } catch (error) {
      console.error('Magic link verification error:', error);
      setStatus({
        type: 'error',
        message: 'Failed to verify login link. Please try again.'
      });
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setStatus({
        type: 'error',
        message: 'Please enter your email address.'
      });
      return;
    }

    setStatus({ type: 'loading', message: '' });

    try {
      const response = await fetch(`/api/rep/${slug}/auth/magic-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const result = await response.json();

      if (result.success) {
        setMagicLinkSent(true);
        setStatus({
          type: 'success',
          message: 'Check your email for the login link!'
        });
      } else {
        setStatus({
          type: 'error',
          message: result.error || 'Failed to send magic link'
        });
      }
    } catch (error) {
      console.error('Magic link error:', error);
      setStatus({
        type: 'error',
        message: 'Connection error. Please try again.'
      });
    }
  };

  const isDisabled = status.type === 'loading';

  if (isLoadingRep) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-dark to-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-dark to-gray-900 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex items-center justify-center w-12 h-12 bg-green-500/20 rounded-lg border border-green-500/30">
          <Briefcase className="w-6 h-6 text-green-400" />
        </div>
        <div className="flex flex-col">
          <span className="font-display font-bold text-xl text-white leading-tight">
            R&G Consulting
          </span>
          <span className="text-[10px] font-semibold tracking-[0.2em] text-gray-400 uppercase">
            Rep Portal
          </span>
        </div>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md">
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8 shadow-2xl">
          {/* Rep Info */}
          {repInfo && (
            <div className="text-center mb-6">
              <p className="text-gray-400 text-sm">Welcome to</p>
              <h2 className="text-xl font-display font-bold text-white">{repInfo.name}'s Portal</h2>
              {repInfo.territory && (
                <p className="text-green-400 text-sm mt-1">{repInfo.territory} Territory</p>
              )}
            </div>
          )}

          <div className="flex items-center justify-center mb-6">
            <div className="w-14 h-14 bg-green-500/10 rounded-full flex items-center justify-center">
              <Mail className="w-7 h-7 text-green-400" />
            </div>
          </div>

          <h1 className="text-2xl font-display font-bold text-white text-center mb-2">
            {magicLinkSent ? 'Check Your Email' : 'Rep Login'}
          </h1>
          <p className="text-gray-400 text-center text-sm mb-8">
            {magicLinkSent
              ? `We sent a login link to ${email}`
              : 'Enter your email to receive a secure login link'}
          </p>

          {magicLinkSent ? (
            /* Magic Link Sent State */
            <div className="text-center">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <p className="text-gray-400 text-sm mb-6">
                Click the link in your email to sign in. The link expires in 15 minutes.
              </p>
              <button
                onClick={() => {
                  setMagicLinkSent(false);
                  setStatus({ type: 'idle', message: '' });
                }}
                className="text-green-400 hover:text-green-300 text-sm font-medium transition-colors"
              >
                Use a different email
              </button>
            </div>
          ) : (
            /* Magic Link Form */
            <form onSubmit={handleMagicLink} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isDisabled}
                  autoComplete="email"
                  autoFocus
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  placeholder="you@example.com"
                />
              </div>

              {/* Error Message */}
              {status.type === 'error' && (
                <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-400 text-sm">{status.message}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isDisabled}
                className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 min-h-[48px]"
              >
                {status.type === 'loading' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-5 h-5" />
                    <span>Send Login Link</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Help Text */}
          {!magicLinkSent && (
            <div className="mt-6 pt-6 border-t border-gray-700">
              <p className="text-center text-gray-400 text-sm">
                Don't have access?{' '}
                <a
                  href="mailto:support@ccrestaurantconsulting.com"
                  className="text-green-400 hover:text-green-300 font-medium transition-colors"
                >
                  Contact support
                </a>
              </p>
            </div>
          )}
        </div>

        {/* Back Link */}
        <p className="text-center text-gray-500 text-sm mt-6">
          <Link to="/" className="hover:text-green-400 transition-colors flex items-center justify-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Website
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RepLogin;
