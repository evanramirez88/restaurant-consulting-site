import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2, AlertCircle, UtensilsCrossed, Shield, CheckCircle, Monitor } from 'lucide-react';
import { useSEO } from '../src/components/SEO';

interface LoginStatus {
  type: 'idle' | 'loading' | 'error' | 'success';
  message: string;
  attemptsRemaining?: number;
  retryAfter?: number;
}

interface SessionInfo {
  device: string;
  browser: string;
  location: string;
  timestamp: string;
}

const AdminLogin: React.FC = () => {
  useSEO({
    title: 'Admin Login | Cape Cod Restaurant Consulting',
    description: 'Admin login for Cape Cod Restaurant Consulting dashboard.',
  });

  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<LoginStatus>({
    type: 'idle',
    message: ''
  });
  const [retryCountdown, setRetryCountdown] = useState(0);
  const [showSessionInfo, setShowSessionInfo] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);

  // Get browser and device info
  useEffect(() => {
    const getBrowserInfo = () => {
      const ua = navigator.userAgent;
      let browser = 'Unknown Browser';
      let device = 'Unknown Device';

      if (ua.includes('Chrome')) browser = 'Chrome';
      else if (ua.includes('Firefox')) browser = 'Firefox';
      else if (ua.includes('Safari')) browser = 'Safari';
      else if (ua.includes('Edge')) browser = 'Edge';

      if (/Mobile|Android|iPhone|iPad/.test(ua)) {
        device = 'Mobile';
      } else {
        device = 'Desktop';
      }

      setSessionInfo({
        device,
        browser,
        location: 'Detecting...',
        timestamp: new Date().toLocaleString()
      });
    };

    getBrowserInfo();
  }, []);

  // Check if already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/verify');
        const data = await response.json();
        if (data.authenticated) {
          navigate('/admin');
        }
      } catch (error) {
        // Not authenticated, stay on login page
      }
    };
    checkAuth();
  }, [navigate]);

  // Handle retry countdown
  useEffect(() => {
    if (retryCountdown > 0) {
      const timer = setTimeout(() => {
        setRetryCountdown(retryCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (retryCountdown === 0 && status.type === 'error' && status.retryAfter) {
      setStatus({ type: 'idle', message: '' });
    }
  }, [retryCountdown, status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password.trim()) {
      setStatus({
        type: 'error',
        message: 'Please enter a password.'
      });
      return;
    }

    setStatus({ type: 'loading', message: '' });

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      });

      const result = await response.json();

      if (result.success) {
        setStatus({
          type: 'success',
          message: 'Login successful! Redirecting...'
        });
        setShowSessionInfo(true);
        // Short delay to show success state
        setTimeout(() => {
          navigate('/admin');
        }, 1000);
      } else {
        if (result.retryAfter) {
          setRetryCountdown(result.retryAfter);
          setStatus({
            type: 'error',
            message: result.error || 'Too many attempts. Please wait.',
            retryAfter: result.retryAfter
          });
        } else {
          setStatus({
            type: 'error',
            message: result.error || 'Invalid password',
            attemptsRemaining: result.attemptsRemaining
          });
        }
        setPassword('');
      }
    } catch (error) {
      console.error('Login error:', error);
      setStatus({
        type: 'error',
        message: 'Connection error. Please try again.'
      });
    }
  };

  const isDisabled = status.type === 'loading' || retryCountdown > 0 || status.type === 'success';

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-dark to-gray-900 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex items-center justify-center w-12 h-12 bg-gray-800 rounded-lg border border-gray-700">
          <UtensilsCrossed className="w-6 h-6 text-amber-400" aria-hidden="true" />
        </div>
        <div className="flex flex-col">
          <span className="font-display font-bold text-xl text-white leading-tight">
            R&G Consulting
          </span>
          <span className="text-[10px] font-semibold tracking-[0.2em] text-gray-400 uppercase">
            Admin Portal
          </span>
        </div>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md">
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8 shadow-2xl">
          <div className="flex items-center justify-center mb-6">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              status.type === 'success'
                ? 'bg-green-500/20'
                : status.type === 'error'
                ? 'bg-red-500/10'
                : 'bg-amber-500/10'
            }`}>
              {status.type === 'success' ? (
                <CheckCircle className="w-7 h-7 text-green-400" aria-hidden="true" />
              ) : (
                <Lock className={`w-7 h-7 ${status.type === 'error' ? 'text-red-400' : 'text-amber-400'}`} aria-hidden="true" />
              )}
            </div>
          </div>

          <h1 className="text-2xl font-display font-bold text-white text-center mb-2">
            Admin Login
          </h1>
          <p className="text-gray-400 text-center text-sm mb-8">
            Enter your password to access the dashboard
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              {/* Hidden username for password managers */}
              <input
                type="text"
                name="username"
                value="admin"
                autoComplete="username"
                readOnly
                hidden
                aria-hidden="true"
                tabIndex={-1}
              />
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
                autoFocus
                aria-describedby={status.type === 'error' ? 'error-message' : undefined}
                className={`w-full px-4 py-3 bg-gray-900/50 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors admin-input ${
                  status.type === 'error'
                    ? 'border-red-500/50 focus:ring-red-500'
                    : 'border-gray-600 focus:ring-amber-500'
                }`}
                placeholder="Enter admin password"
              />
            </div>

            {/* 2FA Status */}
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-900/30 rounded-lg border border-gray-700">
              <Shield className="w-4 h-4 text-gray-500" aria-hidden="true" />
              <span className="text-xs text-gray-500">2FA: Coming Soon</span>
            </div>

            {/* Success Message */}
            {status.type === 'success' && (
              <div className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg" role="status">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="text-green-400 text-sm font-medium">{status.message}</p>
                  {showSessionInfo && sessionInfo && (
                    <div className="mt-2 pt-2 border-t border-green-500/20">
                      <p className="text-green-300/80 text-xs flex items-center gap-1">
                        <Monitor className="w-3 h-3" aria-hidden="true" />
                        {sessionInfo.device} - {sessionInfo.browser}
                      </p>
                      <p className="text-green-300/60 text-xs mt-1">
                        Session started: {sessionInfo.timestamp}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error Message */}
            {status.type === 'error' && (
              <div
                id="error-message"
                className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg"
                role="alert"
              >
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="text-red-400 text-sm font-medium">{status.message}</p>
                  {retryCountdown > 0 && (
                    <p className="text-red-300 text-xs mt-1">
                      Try again in {retryCountdown} second{retryCountdown !== 1 ? 's' : ''}
                    </p>
                  )}
                  {status.attemptsRemaining !== undefined && status.attemptsRemaining > 0 && (
                    <p className="text-red-300 text-xs mt-1">
                      {status.attemptsRemaining} attempt{status.attemptsRemaining !== 1 ? 's' : ''} remaining before lockout
                    </p>
                  )}
                  {status.attemptsRemaining === 0 && !retryCountdown && (
                    <p className="text-red-300 text-xs mt-1">
                      Account temporarily locked. Please wait before trying again.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isDisabled}
              className={`w-full py-3 px-4 font-semibold rounded-lg transition-all flex items-center justify-center gap-2 min-h-[48px] ${
                status.type === 'success'
                  ? 'bg-green-600 text-white cursor-default'
                  : 'bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white'
              }`}
              aria-label={status.type === 'loading' ? 'Signing in...' : 'Sign In'}
            >
              {status.type === 'loading' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                  <span>Signing in...</span>
                </>
              ) : status.type === 'success' ? (
                <>
                  <CheckCircle className="w-5 h-5" aria-hidden="true" />
                  <span>Success!</span>
                </>
              ) : retryCountdown > 0 ? (
                <span>Wait {retryCountdown}s</span>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          {/* Session Info Preview */}
          {sessionInfo && !showSessionInfo && (
            <div className="mt-6 pt-6 border-t border-gray-700">
              <p className="text-xs text-gray-500 text-center flex items-center justify-center gap-2">
                <Monitor className="w-3 h-3" aria-hidden="true" />
                Logging in from {sessionInfo.device} ({sessionInfo.browser})
              </p>
            </div>
          )}
        </div>

        {/* Security Note */}
        <div className="mt-4 p-3 bg-gray-800/30 rounded-lg border border-gray-700/50">
          <p className="text-xs text-gray-500 text-center flex items-center justify-center gap-2">
            <Shield className="w-3 h-3 text-amber-400/60" aria-hidden="true" />
            This login is secured with rate limiting and session management
          </p>
          <p className="text-xs text-gray-600 text-center mt-2">
            Locked out? Contact{' '}
            <a href="mailto:ramirezconsulting.rg@gmail.com" className="text-amber-500/70 hover:text-amber-400 transition-colors">
              ramirezconsulting.rg@gmail.com
            </a>
          </p>
        </div>

        {/* Back Link */}
        <p className="text-center text-gray-500 text-sm mt-6">
          <a
            href="/"
            className="hover:text-amber-400 transition-colors focus:outline-none focus:text-amber-400"
            aria-label="Return to main site"
          >
            &larr; Back to site
          </a>
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;
