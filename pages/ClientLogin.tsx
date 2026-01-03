import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Lock, Loader2, AlertCircle, UtensilsCrossed, Mail, ArrowRight, Check } from 'lucide-react';
import { useSEO } from '../src/components/SEO';

// ============================================
// COMING SOON FLAG - Set to false when ready to launch
// Admin users and demo mode (?demo=true) bypass this flag
// ============================================
const SHOW_COMING_SOON_DEFAULT = true;

interface LoginStatus {
  type: 'idle' | 'loading' | 'error' | 'success';
  message: string;
}

type AuthMode = 'password' | 'magic-link';

// ============================================
// COMING SOON WRAPPER
// ============================================
const ComingSoonWrapper: React.FC<{ children: React.ReactNode; showComingSoon: boolean }> = ({ children, showComingSoon }) => {
  if (!showComingSoon) return <>{children}</>;

  return (
    <div className="relative">
      {/* Blurred/disabled login form behind */}
      <div className="filter blur-sm pointer-events-none opacity-50">
        {children}
      </div>

      {/* Coming Soon Overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-primary-dark/80 backdrop-blur-sm">
        <div className="text-center px-6">
          <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-2xl font-display font-bold text-white mb-3">
            Portal Access Coming Soon
          </h2>
          <p className="text-gray-400 mb-6 max-w-sm mx-auto">
            Client portal login is currently in development.
            Contact us for early access.
          </p>
          <Link
            to="/portal"
            className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            Back to Portal Overview
          </Link>
        </div>
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================
const ClientLogin: React.FC = () => {
  useSEO({
    title: 'Client Login | Cape Cod Restaurant Consulting',
    description: 'Sign in to your Cape Cod Restaurant Consulting client portal.',
  });

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [authMode, setAuthMode] = useState<AuthMode>('magic-link');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [status, setStatus] = useState<LoginStatus>({
    type: 'idle',
    message: ''
  });
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(SHOW_COMING_SOON_DEFAULT);
  const [accessCheckDone, setAccessCheckDone] = useState(false);

  // Check if demo mode or admin - bypass coming soon
  useEffect(() => {
    const checkAccess = async () => {
      // Support both ?demo=true and #/path?demo=true (hash routing)
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
      const isDemoMode = urlParams.get('demo') === 'true' || hashParams.get('demo') === 'true';

      let isAdmin = false;
      try {
        const authResponse = await fetch('/api/auth/verify', { credentials: 'include' });
        const authData = await authResponse.json();
        isAdmin = authData.authenticated === true;
      } catch {
        // Not admin
      }

      if (isDemoMode || isAdmin) {
        setShowComingSoon(false);
      }
      setAccessCheckDone(true);
    };
    checkAccess();
  }, []);

  // Check for magic link token in URL
  useEffect(() => {
    if (!accessCheckDone) return;
    const token = searchParams.get('token');
    if (token && !showComingSoon) {
      verifyMagicLinkToken(token);
    }
  }, [searchParams, showComingSoon, accessCheckDone]);

  // Verify magic link token
  const verifyMagicLinkToken = async (token: string) => {
    setStatus({ type: 'loading', message: 'Verifying your login link...' });

    try {
      const response = await fetch('/api/client/auth/verify-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        credentials: 'include'
      });

      const data = await response.json();

      if (data.success) {
        // Redirect to dashboard or to slug-based portal if slug is in token
        if (data.client?.slug) {
          navigate(`/portal/${data.client.slug}/dashboard`);
        } else {
          navigate('/portal/dashboard');
        }
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

  // Check if already authenticated
  useEffect(() => {
    if (!accessCheckDone || showComingSoon) return;
    if (searchParams.get('token')) return; // Skip if verifying token

    const checkAuth = async () => {
      try {
        const response = await fetch('/api/client/auth/verify', {
          credentials: 'include'
        });
        const data = await response.json();
        if (data.authenticated) {
          navigate('/portal/dashboard');
        }
      } catch (error) {
        // Not authenticated, stay on login page
      }
    };
    checkAuth();
  }, [navigate, searchParams]);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      setStatus({
        type: 'error',
        message: 'Please enter your email and password.'
      });
      return;
    }

    setStatus({ type: 'loading', message: '' });

    try {
      // Simulated API call - replace with actual endpoint
      const response = await fetch('/api/client/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe })
      });

      const result = await response.json();

      if (result.success) {
        navigate('/portal/dashboard');
      } else {
        setStatus({
          type: 'error',
          message: result.error || 'Invalid email or password'
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      setStatus({
        type: 'error',
        message: 'Connection error. Please try again.'
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
      // Simulated API call - replace with actual endpoint
      const response = await fetch('/api/client/auth/magic-link', {
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

  const loginForm = (
    <div className="min-h-screen bg-gradient-to-b from-primary-dark to-gray-900 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex items-center justify-center w-12 h-12 bg-gray-800 rounded-lg border border-gray-700">
          <UtensilsCrossed className="w-6 h-6 text-amber-400" />
        </div>
        <div className="flex flex-col">
          <span className="font-display font-bold text-xl text-white leading-tight">
            R&G Consulting
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
            {magicLinkSent ? 'Check Your Email' : 'Client Login'}
          </h1>
          <p className="text-gray-400 text-center text-sm mb-8">
            {magicLinkSent
              ? `We sent a login link to ${email}`
              : authMode === 'password'
                ? 'Sign in to access your client dashboard'
                : 'Enter your email to receive a login link'}
          </p>

          {/* Auth Mode Toggle */}
          {!magicLinkSent && (
            <div className="flex bg-gray-900/50 rounded-lg p-1 mb-6">
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
          ) : authMode === 'password' ? (
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

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-900/50 text-amber-500 focus:ring-amber-500 focus:ring-offset-gray-800"
                  />
                  <span className="text-sm text-gray-400">Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => setAuthMode('magic-link')}
                  className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
                >
                  Forgot password?
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
          ) : (
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
          )}

          {/* Create Account Link */}
          {!magicLinkSent && (
            <div className="mt-6 pt-6 border-t border-gray-700">
              <p className="text-center text-gray-400 text-sm">
                Don't have an account?{' '}
                <Link
                  to="/contact"
                  className="text-amber-400 hover:text-amber-300 font-medium transition-colors"
                >
                  Contact us
                </Link>
              </p>
            </div>
          )}
        </div>

        {/* Back Link */}
        <p className="text-center text-gray-500 text-sm mt-6">
          <Link to="/portal" className="hover:text-amber-400 transition-colors">
            &larr; Back to Portal Overview
          </Link>
        </p>
      </div>
    </div>
  );

  // Show loading while checking access
  if (!accessCheckDone) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-dark via-gray-900 to-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  return <ComingSoonWrapper showComingSoon={showComingSoon}>{loginForm}</ComingSoonWrapper>;
};

export default ClientLogin;
