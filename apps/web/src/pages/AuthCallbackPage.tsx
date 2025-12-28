import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuthStore } from '@/store/auth-store';
import { Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuthStore();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const accessToken = searchParams.get('accessToken');
        const error = searchParams.get('error');

        if (error) {
          // Redirect immediately on error
          navigate('/login?error=auth_failed', { replace: true });
          return;
        }

        if (!accessToken) {
          // Redirect immediately if no token
          navigate('/login?error=no_token', { replace: true });
          return;
        }

        // Get user data from the server using the access token
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4002';
        const response = await fetch(`${apiUrl}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to get user data');
        }

        const { user } = await response.json();

        // Store user data in auth store
        login(user, accessToken);

        // Redirect immediately to home page after successful auth
        navigate('/', { replace: true });
      } catch (error) {
        console.error('Auth callback error:', error);
        // Redirect to login on error
        navigate('/login?error=auth_failed', { replace: true });
      }
    };

    handleCallback();
  }, [searchParams, login, navigate]);

  // Minimal loading UI - just a small centered spinner
  return (
    <>
      <Helmet>
        <title>Authenticating... - Talents Media</title>
      </Helmet>
      <div className="animated-gradient flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-tm-text-muted" />
      </div>
    </>
  );
}

