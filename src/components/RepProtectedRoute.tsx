import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';

interface RepProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Route protection component for rep portal.
 * Verifies rep authentication before rendering protected content.
 * Allows bypass for demo mode (?demo=true) and admin users.
 */
const RepProtectedRoute: React.FC<RepProtectedRouteProps> = ({ children }) => {
  const [authState, setAuthState] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking');
  const location = useLocation();
  const { slug } = useParams<{ slug: string }>();

  useEffect(() => {
    const verifyAuth = async () => {
      if (!slug) {
        setAuthState('unauthenticated');
        return;
      }

      // Check for demo mode (supports hash routing: /#/path?demo=true)
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
      const isDemoMode = urlParams.get('demo') === 'true' || hashParams.get('demo') === 'true';

      // Check if user is authenticated as admin
      let isAdmin = false;
      try {
        const adminResponse = await fetch('/api/auth/verify', { credentials: 'include' });
        const adminData = await adminResponse.json();
        isAdmin = adminData.authenticated === true;
      } catch {
        // Not an admin, continue with rep auth check
      }

      // Admin or demo mode bypasses rep auth
      if (isDemoMode || isAdmin) {
        setAuthState('authenticated');
        return;
      }

      // Normal rep auth verification
      try {
        const response = await fetch(`/api/rep/${slug}/auth/verify`, {
          method: 'GET',
          credentials: 'include'
        });

        const data = await response.json();

        if (data.authenticated) {
          setAuthState('authenticated');
        } else {
          setAuthState('unauthenticated');
        }
      } catch (error) {
        console.error('Rep auth verification failed:', error);
        setAuthState('unauthenticated');
      }
    };

    verifyAuth();
  }, [slug]);

  if (authState === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary-dark">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return <Navigate to={`/rep/${slug}/login`} state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default RepProtectedRoute;
