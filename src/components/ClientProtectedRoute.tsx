import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

interface ClientProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * Route protection component for client portal.
 * Verifies client authentication before rendering protected content.
 */
const ClientProtectedRoute: React.FC<ClientProtectedRouteProps> = ({
  children,
  redirectTo = '/portal/login'
}) => {
  const [authState, setAuthState] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking');
  const location = useLocation();

  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const response = await fetch('/api/client/auth/verify', {
          method: 'GET',
          credentials: 'include'
        });

        if (response.ok) {
          setAuthState('authenticated');
        } else {
          setAuthState('unauthenticated');
        }
      } catch (error) {
        console.error('Client auth verification failed:', error);
        setAuthState('unauthenticated');
      }
    };

    verifyAuth();
  }, []);

  if (authState === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary-dark">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ClientProtectedRoute;
