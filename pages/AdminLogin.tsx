import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2, AlertCircle, UtensilsCrossed } from 'lucide-react';
import { useSEO } from '../src/components/SEO';

interface LoginStatus {
  type: 'idle' | 'loading' | 'error';
  message: string;
  attemptsRemaining?: number;
  retryAfter?: number;
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
        // Redirect to admin dashboard
        navigate('/admin');
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

  const isDisabled = status.type === 'loading' || retryCountdown > 0;

  return (
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
            Admin Portal
          </span>
        </div>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md">
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8 shadow-2xl">
          <div className="flex items-center justify-center mb-6">
            <div className="w-14 h-14 bg-amber-500/10 rounded-full flex items-center justify-center">
              <Lock className="w-7 h-7 text-amber-400" />
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
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                placeholder="Enter admin password"
              />
            </div>

            {/* Error Message */}
            {status.type === 'error' && (
              <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-400 text-sm">{status.message}</p>
                  {retryCountdown > 0 && (
                    <p className="text-red-300 text-xs mt-1">
                      Try again in {retryCountdown}s
                    </p>
                  )}
                  {status.attemptsRemaining !== undefined && status.attemptsRemaining > 0 && (
                    <p className="text-red-300 text-xs mt-1">
                      {status.attemptsRemaining} attempt{status.attemptsRemaining !== 1 ? 's' : ''} remaining
                    </p>
                  )}
                </div>
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
              ) : retryCountdown > 0 ? (
                <span>Wait {retryCountdown}s</span>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>
        </div>

        {/* Back Link */}
        <p className="text-center text-gray-500 text-sm mt-6">
          <a href="/#/" className="hover:text-amber-400 transition-colors">
            &larr; Back to site
          </a>
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;
