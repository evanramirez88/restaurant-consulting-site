import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * Route protection component that verifies authentication
 * before rendering protected content.
 *
 * Usage: Wrap any route that requires authentication
 * <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  redirectTo = '/admin/login'
}) => {
  const [authState, setAuthState] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking');
  const location = useLocation();

  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const response = await fetch('/api/auth/verify', {
          method: 'GET',
          credentials: 'include'
        });

        if (response.ok) {
          setAuthState('authenticated');
        } else {
          setAuthState('unauthenticated');
        }
      } catch (error) {
        console.error('Auth verification failed:', error);
        setAuthState('unauthenticated');
      }
    };

    verifyAuth();
  }, []);

  // Loading state while checking authentication
  if (authState === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary-dark">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (authState === 'unauthenticated') {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Render protected content
  return <>{children}</>;
};

export default ProtectedRoute;
