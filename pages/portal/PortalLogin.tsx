import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  UtensilsCrossed,
  Lock,
  Mail,
  Loader2,
  AlertCircle,
  Check,
  ArrowLeft
} from 'lucide-react';
import { useSEO } from '../../src/components/SEO';

// ============================================
// TYPE DEFINITIONS
// ============================================
interface ClientInfo {
  id: string;
  name: string;
  company: string;
  email: string;
  slug: string;
  avatar_url: string | null;
  portal_enabled: boolean;
}

interface LoginStatus {
  type: 'idle' | 'loading' | 'error' | 'success';
  message: string;
}

type AuthMode = 'magic-link' | 'password';

// ============================================
// PORTAL LOGIN PAGE
// ============================================
const PortalLogin: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [isLoading, setIsLoading] = useState(true);
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auth form state
  const [authMode, setAuthMode] = useState<AuthMode>('magic-link');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<LoginStatus>({ type: 'idle', message: '' });
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  useSEO({
    title: clientInfo ? `Sign In | ${clientInfo.company} Portal` : 'Portal Login',
    description: 'Sign in to your client portal.',
  });

  // Check for magic link token in URL
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      verifyMagicLinkToken(token);
    }
  }, [searchParams]);

  // Verify magic link token
  const verifyMagicLinkToken = async (token: string) => {
    setStatus({ type: 'loading', message: 'Verifying your login link...' });

    try {
      const response = await fetch('/api/client/auth/verify-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, slug }),
        credentials: 'include'
      });

      const data = await response.json();

      if (data.success) {
        navigate(`/portal/${slug}/dashboard`);
      } else {
        setStatus({
          type: 'error',
          message: data.error || 'Invalid or expired login link. Please request a new one.'
        });
      }
    } catch (err) {
      console.error('Magic link verification error:', err);
      setStatus({
        type: 'error',
        message: 'Failed to verify login link. Please try again.'
      });
    }
  };

  // Load client info
  useEffect(() => {
    const loadClientInfo = async () => {
      if (!slug) {
        setError('Invalid portal URL');
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/portal/${slug}/info`);
        const data = await response.json();

        if (!data.success) {
          setError(data.error || 'Portal not found');
          setIsLoading(false);
          return;
        }

        if (!data.data.portal_enabled) {
          setError('This client portal is not currently active.');
          setIsLoading(false);
          return;
        }

        setClientInfo(data.data);

        // Check if already authenticated
        const authResponse = await fetch('/api/client/auth/verify', {
          credentials: 'include'
        });

        if (authResponse.ok) {
          const authData = await authResponse.json();
          if (authData.authenticated && authData.clientId === data.data.id) {
            navigate(`/portal/${slug}/dashboard`);
            return;
          }
        }
      } catch (err) {
        console.error('Portal load error:', err);
        setError('Failed to load portal information');
      } finally {
        setIsLoading(false);
      }
    };

    loadClientInfo();
  }, [slug, navigate]);

  // Handle magic link request
  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setStatus({ type: 'error', message: 'Please enter your email address.' });
      return;
    }

    setStatus({ type: 'loading', message: '' });

    try {
      const response = await fetch('/api/client/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, slug })
      });

      const data = await response.json();

      if (data.success) {
        setMagicLinkSent(true);
        setStatus({
          type: 'success',
          message: 'Check your email for the login link!'
        });
      } else {
        setStatus({
          type: 'error',
          message: data.error || 'Failed to send magic link. Please check your email address.'
        });
      }
    } catch (err) {
      console.error('Magic link error:', err);
      setStatus({
        type: 'error',
        message: 'Connection error. Please try again.'
      });
    }
  };

  // Handle password login
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      setStatus({ type: 'error', message: 'Please enter your email and password.' });
      return;
    }

    setStatus({ type: 'loading', message: '' });

    try {
      const response = await fetch('/api/client/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, slug }),
        credentials: 'include'
      });

      const data = await response.json();

      if (data.success) {
        navigate(`/portal/${slug}/dashboard`);
      } else {
        setStatus({
          type: 'error',
          message: data.error || 'Invalid email or password.'
        });
      }
    } catch (err) {
      console.error('Login error:', err);
      setStatus({
        type: 'error',
        message: 'Connection error. Please try again.'
      });
    }
  };

  const isDisabled = status.type === 'loading';

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-dark to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading portal...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !clientInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-dark to-gray-900 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-2xl font-display font-bold text-white mb-3">Portal Not Found</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <Link
            to="/portal"
            className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600 transition-colors"
          >
            Go to Main Portal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-dark to-gray-900 flex flex-col items-center justify-center px-4 py-12">
      {/* Back Link */}
      <div className="w-full max-w-md mb-6">
        <Link
          to={`/portal/${slug}`}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-amber-400 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Portal
        </Link>
      </div>

      {/* Logo & Company */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center border border-gray-700">
          <UtensilsCrossed className="w-6 h-6 text-amber-400" />
        </div>
        <div className="flex flex-col">
          <span className="font-display font-bold text-xl text-white leading-tight">
            {clientInfo.company}
          </span>
          <span className="text-[10px] font-semibold tracking-[0.2em] text-gray-400 uppercase">
            Client Portal
          </span>
        </div>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md">
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8 shadow-2xl">
          <div className="flex items-center justify-center mb-6">
            <div className="w-14 h-14 bg-amber-500/10 rounded-full flex items-center justify-center">
              {authMode === 'password' ? (
                <Lock className="w-7 h-7 text-amber-400" />
              ) : (
                <Mail className="w-7 h-7 text-amber-400" />
              )}
            </div>
          </div>

          <h1 className="text-2xl font-display font-bold text-white text-center mb-2">
            {magicLinkSent ? 'Check Your Email' : 'Sign In'}
          </h1>
          <p className="text-gray-400 text-center text-sm mb-8">
            {magicLinkSent
              ? `We sent a login link to ${email}`
              : authMode === 'password'
                ? 'Enter your credentials to access your portal'
                : 'Enter your email to receive a secure login link'}
          </p>

          {/* Auth Mode Toggle */}
          {!magicLinkSent && (
            <div className="flex bg-gray-900/50 rounded-lg p-1 mb-6">
              <button
                type="button"
                onClick={() => setAuthMode('magic-link')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  authMode === 'magic-link'
                    ? 'bg-amber-500 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Magic Link
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('password')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  authMode === 'password'
                    ? 'bg-amber-500 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Password
              </button>
            </div>
          )}

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
                className="text-amber-400 hover:text-amber-300 text-sm font-medium transition-colors"
              >
                Use a different email
              </button>
            </div>
          ) : authMode === 'magic-link' ? (
            /* Magic Link Form */
            <form onSubmit={handleMagicLink} className="space-y-5">
              <div>
                <label htmlFor="magic-email" className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="magic-email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isDisabled}
                  autoComplete="email"
                  autoFocus
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  placeholder="you@restaurant.com"
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
                className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 min-h-[48px]"
              >
                {status.type === 'loading' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-5 h-5" />
                    <span>Send Magic Link</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Password Login Form */
            <form onSubmit={handlePasswordLogin} className="space-y-5">
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
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  placeholder="you@restaurant.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isDisabled}
                  autoComplete="current-password"
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  placeholder="Enter your password"
                />
              </div>

              {/* Forgot Password Link */}
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setAuthMode('magic-link')}
                  className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
                >
                  Forgot password? Use magic link
                </button>
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
                className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 min-h-[48px]"
              >
                {status.type === 'loading' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </form>
          )}

          {/* Contact Support Link */}
          {!magicLinkSent && (
            <div className="mt-6 pt-6 border-t border-gray-700">
              <p className="text-center text-gray-400 text-sm">
                Having trouble signing in?{' '}
                <Link
                  to="/contact"
                  className="text-amber-400 hover:text-amber-300 font-medium transition-colors"
                >
                  Contact Support
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <p className="text-center text-gray-500 text-sm mt-8">
        Cape Cod Restaurant Consulting - Secure Client Portal
      </p>
    </div>
  );
};

export default PortalLogin;
