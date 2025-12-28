import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { apiClient } from '@/lib/api-client';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, setLoading } = useAuthStore();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    displayName: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    if (!isLogin) {
      if (!formData.username) {
        newErrors.username = 'Username is required';
      } else if (formData.username.length < 3) {
        newErrors.username = 'Username must be at least 3 characters';
      } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
        newErrors.username =
          'Username can only contain letters, numbers, and underscores';
      }

      if (!formData.displayName) {
        newErrors.displayName = 'Display name is required';
      }

      if (!formData.confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password';
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous general errors on new submit attempt
    setErrors(prev => {
      const { general, ...rest } = prev;
      return rest;
    });

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setLoading(true);

    try {
      if (isLogin) {
        // Login
        const response = await apiClient.post('/api/auth/login', {
          email: formData.email,
          password: formData.password,
        });

        // Store user data in auth store
        login(response.user, response.accessToken);

        // Redirect to home page
        navigate('/');
      } else {
        // Register
        const response = await apiClient.post('/api/auth/register', {
          email: formData.email,
          username: formData.username,
          displayName: formData.displayName,
          password: formData.password,
        });

        // Store user data in auth store
        login(response.user, response.accessToken);

        // Redirect to home page
        navigate('/');
      }
    } catch (error: any) {
      console.error('Auth error:', error);

      if (error.response?.data?.details) {
        // Handle validation errors
        const validationErrors: Record<string, string> = {};
        error.response.data.details.forEach((detail: any) => {
          validationErrors[detail.path[0]] = detail.message;
        });
        setErrors(validationErrors);
      } else {
        // Handle general errors - preserve existing field errors
        setErrors(prev => ({
          ...prev,
          general:
            error.response?.data?.error ||
            `${isLogin ? 'Login' : 'Registration'} failed. Please try again.`,
        }));
      }
    } finally {
      setIsLoading(false);
      setLoading(false);
    }
  };

  const handleGoogleAuth = () => {
    // Prevent double-clicks and multiple redirects
    if (isGoogleLoading) {
      return;
    }

    // Set loading state immediately for visual feedback
    setIsGoogleLoading(true);

    // Redirect to Google OAuth
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4002';
    try {
      window.location.href = `${apiUrl}/api/auth/google`;
    } catch (error) {
      // If redirect fails (shouldn't happen), reset loading state
      console.error('Failed to redirect to Google OAuth:', error);
      setIsGoogleLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>{isLogin ? 'Login' : 'Register'} - Talents Media</title>
      </Helmet>
      
      <div className="animated-gradient flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="mb-8 text-center">
            <Link to="/" className="inline-flex items-center space-x-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r from-tm-primary-from to-tm-primary-to">
                <span className="text-xl font-bold text-white">TM</span>
              </div>
              <span className="gradient-text text-3xl font-bold">
                Talents Media
              </span>
            </Link>
          </div>

          {/* Auth Card */}
          <div className="rounded-2xl border border-tm-border/60 bg-tm-card/90 p-8 backdrop-blur-xl shadow-lg">
            <div className="mb-6 text-center">
              <h1 className="mb-2 text-2xl font-bold text-white">
                {isLogin ? 'Welcome Back' : 'Create Account'}
              </h1>
              <p className="text-tm-text-muted">
                {isLogin ? 'Sign in to your account' : 'Join our community today'}
              </p>
            </div>

            {/* Toggle Buttons */}
            <div className="mb-6 flex rounded-lg bg-tm-card-soft p-1">
              <button
                onClick={() => setIsLogin(true)}
                className={cn(
                  'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all',
                  isLogin
                    ? 'bg-gradient-to-r from-tm-primary-from to-tm-primary-to text-white'
                    : 'text-tm-text-muted hover:text-tm-text'
                )}
              >
                Sign In
              </button>
              <button
                onClick={() => setIsLogin(false)}
                className={cn(
                  'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all',
                  !isLogin
                    ? 'neon-glow bg-neon-purple-500 text-white'
                    : 'text-tm-text-muted hover:text-tm-text'
                )}
              >
                Sign Up
              </button>
            </div>

            {/* General Error */}
            {errors.general && (
              <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/20 p-3 text-sm text-red-400">
                {errors.general}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-tm-text-muted" />
                    <input
                      type="text"
                      name="username"
                      placeholder="Username"
                      value={formData.username}
                      onChange={handleInputChange}
                      className={cn(
                        'w-full rounded-lg border border-tm-border/60 bg-tm-card-soft py-3 pl-10 pr-4 text-tm-text placeholder-tm-text-muted focus:outline-none focus:ring-2 focus:ring-tm-primary-from/20',
                        errors.username
                          ? 'border-red-500'
                          : 'focus:border-tm-primary-from'
                      )}
                      required={!isLogin}
                    />
                    {errors.username && (
                      <p className="mt-1 text-xs text-red-400">{errors.username}</p>
                    )}
                  </div>

                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-tm-text-muted" />
                    <input
                      type="text"
                      name="displayName"
                      placeholder="Display Name"
                      value={formData.displayName}
                      onChange={handleInputChange}
                      className={cn(
                        'w-full rounded-lg border bg-white/10 py-3 pl-10 pr-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-neon-purple-500/20',
                        errors.displayName
                          ? 'border-red-500'
                          : 'border-white/20 focus:border-neon-purple-500'
                      )}
                      required={!isLogin}
                    />
                    {errors.displayName && (
                      <p className="mt-1 text-xs text-red-400">
                        {errors.displayName}
                      </p>
                    )}
                  </div>
                </>
              )}

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-tm-text-muted" />
                <input
                  type="email"
                  name="email"
                  placeholder="Email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={cn(
                    'w-full rounded-lg border bg-white/10 py-3 pl-10 pr-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-neon-purple-500/20',
                    errors.email
                      ? 'border-red-500'
                      : 'border-white/20 focus:border-neon-purple-500'
                  )}
                  required
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-400">{errors.email}</p>
                )}
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-tm-text-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className={cn(
                    'w-full rounded-lg border bg-white/10 py-3 pl-10 pr-12 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-neon-purple-500/20',
                    errors.password
                      ? 'border-red-500'
                      : 'border-white/20 focus:border-neon-purple-500'
                  )}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transform text-gray-400 hover:text-white"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
                {errors.password && (
                  <p className="mt-1 text-xs text-red-400">{errors.password}</p>
                )}
              </div>

              {!isLogin && (
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-tm-text-muted" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    placeholder="Confirm Password"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className={cn(
                      'w-full rounded-lg border border-tm-border/60 bg-tm-card-soft py-3 pl-10 pr-4 text-tm-text placeholder-tm-text-muted focus:outline-none focus:ring-2 focus:ring-tm-primary-from/20',
                      errors.confirmPassword
                        ? 'border-red-500'
                        : 'focus:border-tm-primary-from'
                    )}
                    required={!isLogin}
                  />
                  {errors.confirmPassword && (
                    <p className="mt-1 text-xs text-red-400">
                      {errors.confirmPassword}
                    </p>
                  )}
                </div>
              )}

              {isLogin && (
                <div className="flex items-center justify-between">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-tm-border/60 bg-tm-card-soft text-tm-primary-from focus:ring-2 focus:ring-tm-primary-from"
                    />
                    <span className="ml-2 text-sm text-tm-text-muted">
                      Remember me
                    </span>
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-sm text-tm-secondary hover:text-tm-secondary/80 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className={cn(
                  'flex w-full items-center justify-center space-x-2 rounded-lg px-4 py-3 font-medium transition-all duration-300',
                  isLoading
                    ? 'cursor-not-allowed bg-tm-card-soft text-tm-text-muted'
                    : 'bg-gradient-to-r from-tm-primary-from to-tm-primary-to text-white font-semibold hover:brightness-110 hover:scale-[1.01] transition-transform transition-colors'
                )}
              >
                {isLoading ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="my-6">
              <div className="relative flex items-center">
                <div className="flex-1 border-t border-tm-border/60"></div>
                <span className="px-3 text-sm text-tm-text-muted">
                  Or continue with
                </span>
                <div className="flex-1 border-t border-tm-border/60"></div>
              </div>
            </div>

            {/* Social Login */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={isGoogleLoading}
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-3 font-medium transition-all duration-300',
                  isGoogleLoading
                    ? 'cursor-not-allowed border-tm-border/40 bg-tm-card-soft/50 text-tm-text-muted opacity-75'
                    : 'border-tm-border/60 bg-tm-card-soft text-tm-text hover:bg-tm-card hover:border-tm-border'
                )}
              >
                {isGoogleLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Redirecting to Google…</span>
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </>
                )}
              </button>
            </div>

            {/* Terms */}
            {!isLogin && (
              <p className="mt-6 text-center text-xs text-tm-text-muted">
                By creating an account, you agree to our{' '}
                <Link
                  to="/terms"
                  className="text-tm-secondary hover:text-tm-secondary/80 hover:underline"
                >
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link
                  to="/privacy"
                  className="text-tm-secondary hover:text-tm-secondary/80 hover:underline"
                >
                  Privacy Policy
                </Link>
              </p>
            )}
          </div>

          {/* Back to Home / Register Link */}
          <div className="mt-6 text-center">
            {isLogin ? (
              <p className="text-tm-text-muted">
                Don't have an account?{' '}
                <Link
                  to="/register"
                  className="text-tm-secondary transition-colors hover:text-tm-secondary/80 hover:underline"
                >
                  Sign up
                </Link>
              </p>
            ) : (
              <p className="text-tm-text-muted">
                Already have an account?{' '}
                <Link
                  to="/login"
                  className="text-tm-secondary transition-colors hover:text-tm-secondary/80 hover:underline"
                >
                  Sign in
                </Link>
              </p>
            )}
            <div className="mt-2">
              <Link
                to="/"
                className="text-sm text-gray-400 transition-colors hover:text-white"
              >
                ← Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

