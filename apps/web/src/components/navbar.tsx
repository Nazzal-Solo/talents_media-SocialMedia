import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from 'next-themes';
import {
  Home,
  Search,
  MessageCircle,
  Video,
  User,
  Settings,
  LogOut,
  Sun,
  Moon,
  Palette,
  Menu,
  X,
  Loader2,
  Briefcase,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/lib/utils';
import { Avatar } from './ui/avatar';
import { useToast } from './ui/toast-context';
import { apiClient } from '@/lib/api-client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';
import { useQueryClient } from '@tanstack/react-query';

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isNavigatingToSearch, setIsNavigatingToSearch] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { theme, setTheme, themes } = useTheme();
  const { showToast } = useToast();
  
  const isSearchActive = location.pathname.startsWith('/search');
  
  // Reset navigating state when search page becomes active
  useEffect(() => {
    if (isSearchActive) {
      setIsNavigatingToSearch(false);
    }
  }, [isSearchActive]);
  // Use selectors to prevent unnecessary re-renders
  const user = useAuthStore(state => state.user);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const logout = useAuthStore(state => state.logout);

  const handleConfirmLogout = async () => {
    // Prevent double-clicks
    if (isLoggingOut) return;

    setIsLoggingOut(true);

    try {
      // Call logout API endpoint - await this to ensure it completes
      await apiClient.post('/api/auth/logout');

      // Clear auth state from Zustand
      logout();

      // Clear React Query cache to remove any stale user data
      queryClient.clear();

      // Close dialog before redirect (though redirect will happen anyway)
      setIsLogoutDialogOpen(false);

      // Redirect to login page only after successful logout completes
      navigate('/login', { replace: true });
    } catch (error: any) {
      console.error('Failed to logout:', error);
      setIsLoggingOut(false);
      
      // Show error toast
      showToast(
        error?.response?.data?.error || 'Failed to logout. Please try again.',
        'error'
      );
      // Keep dialog open on error so user can try again
    }
  };

  const toggleTheme = () => {
    const currentIndex = themes.indexOf(theme || 'dark-neon');
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  return (
    <nav
      className="fixed left-0 right-0 top-0 z-50 border-b border-tm-border/60 bg-tm-card/90 backdrop-blur-xl shadow-lg"
      style={{
        borderRadius: '0',
      }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-tm-primary-from to-tm-primary-to"
            >
              <span className="text-sm font-bold text-white">TM</span>
            </div>
            <span className="gradient-text font-display text-xl font-bold">
              Talents Media
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden items-center space-x-8 md:flex">
            <Link
              to="/"
              className="flex items-center space-x-2 rounded-lg px-3 py-2 transition-colors hover:bg-white/10"
            >
              <Home className="h-5 w-5" />
              <span>Home</span>
            </Link>

            <Link
              to="/search"
              onClick={() => setIsNavigatingToSearch(true)}
              className={cn(
                'flex items-center space-x-2 rounded-lg px-3 py-2 transition-colors',
                isSearchActive
                  ? 'bg-gradient-to-r from-tm-primary-from/20 to-tm-primary-to/20 text-tm-text border border-tm-primary-from/30'
                  : 'hover:bg-white/10'
              )}
            >
              {isNavigatingToSearch && !isSearchActive ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Search className="h-5 w-5" />
              )}
              <span>Search</span>
            </Link>

            <Link
              to="/chat"
              className="flex items-center space-x-2 rounded-lg px-3 py-2 transition-colors hover:bg-white/10"
            >
              <MessageCircle className="h-5 w-5" />
              <span>Chat</span>
            </Link>

            <Link
              to="/reels"
              className="flex items-center space-x-2 rounded-lg px-3 py-2 transition-colors hover:bg-white/10"
            >
              <Video className="h-5 w-5" />
              <span>Reels</span>
            </Link>

            <Link
              to="/apply"
              className="flex items-center space-x-2 rounded-lg px-3 py-2 transition-colors hover:bg-white/10"
            >
              <Briefcase className="h-5 w-5" />
              <span>Apply</span>
            </Link>
          </div>

          {/* Right side actions */}
          <div className="flex items-center space-x-4">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="rounded-lg p-2 transition-colors hover:bg-white/10"
              title="Toggle theme"
            >
              <Palette className="h-5 w-5" />
            </button>

            {isAuthenticated ? (
              <>
                {/* User profile */}
                <Link
                  to={`/profile/${user?.username}`}
                  className="flex items-center space-x-2 rounded-lg px-3 py-2 transition-colors hover:bg-white/10"
                >
                  <Avatar
                    src={user?.avatar_url}
                    alt={user?.display_name || 'User'}
                    size={32}
                    displayName={user?.display_name}
                    username={user?.username}
                  />
                  <span className="hidden sm:block">
                    {user?.display_name || 'User'}
                  </span>
                </Link>

                {/* Settings */}
                <Link
                  to="/settings"
                  className="rounded-lg p-2 transition-colors hover:bg-white/10"
                  title="Settings"
                >
                  <Settings className="h-5 w-5" />
                </Link>

                {/* Logout */}
                <AlertDialog 
                  open={isLogoutDialogOpen} 
                  onOpenChange={(open) => {
                    // Prevent closing dialog while logging out
                    if (!isLoggingOut) {
                      setIsLogoutDialogOpen(open);
                    }
                  }}
                >
                  <AlertDialogTrigger asChild>
                    <button
                      className="rounded-lg p-2 transition-colors hover:bg-white/10"
                      title="Logout"
                      aria-label="Logout"
                    >
                      <LogOut className="h-5 w-5" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Logout</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to logout from Talents Media?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel 
                        disabled={isLoggingOut}
                        onClick={() => setIsLogoutDialogOpen(false)}
                      >
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={async (e) => {
                          // Prevent default dialog close behavior
                          e.preventDefault();
                          // Only proceed if not already logging out
                          if (!isLoggingOut) {
                            await handleConfirmLogout();
                          }
                        }}
                        disabled={isLoggingOut}
                        aria-busy={isLoggingOut}
                        className="flex items-center justify-center gap-2 min-w-[120px]"
                      >
                        {isLoggingOut ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Logging out…</span>
                          </>
                        ) : (
                          'Logout'
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : (
              <Link
                to="/login"
                className="rounded-full bg-gradient-to-r from-tm-primary-from to-tm-primary-to px-6 py-2 font-semibold text-white transition-all duration-300 hover:brightness-110 hover:scale-[1.01]"
              >
                Login
              </Link>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="rounded-lg p-2 transition-colors hover:bg-white/10 md:hidden"
            >
              {isMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="border-t border-white/10 py-4 md:hidden">
            <div className="flex flex-col space-y-2">
              <Link
                to="/"
                className="flex items-center space-x-2 rounded-lg px-3 py-2 transition-colors hover:bg-white/10"
                onClick={() => setIsMenuOpen(false)}
              >
                <Home className="h-5 w-5" />
                <span>Home</span>
              </Link>

              <Link
                to="/search"
                onClick={() => {
                  setIsNavigatingToSearch(true);
                  setIsMenuOpen(false);
                }}
                className={cn(
                  'flex items-center space-x-2 rounded-lg px-3 py-2 transition-colors',
                  isSearchActive
                    ? 'bg-gradient-to-r from-tm-primary-from/20 to-tm-primary-to/20 text-tm-text border border-tm-primary-from/30'
                    : 'hover:bg-white/10'
                )}
              >
                {isNavigatingToSearch && !isSearchActive ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Search className="h-5 w-5" />
                )}
                <span>Search</span>
              </Link>

              <Link
                to="/chat"
                className="flex items-center space-x-2 rounded-lg px-3 py-2 transition-colors hover:bg-white/10"
                onClick={() => setIsMenuOpen(false)}
              >
                <MessageCircle className="h-5 w-5" />
                <span>Chat</span>
              </Link>

              <Link
                to="/reels"
                className="flex items-center space-x-2 rounded-lg px-3 py-2 transition-colors hover:bg-white/10"
                onClick={() => setIsMenuOpen(false)}
              >
                <Video className="h-5 w-5" />
                <span>Reels</span>
              </Link>

              <Link
                to="/apply"
                className="flex items-center space-x-2 rounded-lg px-3 py-2 transition-colors hover:bg-white/10"
                onClick={() => setIsMenuOpen(false)}
              >
                <Briefcase className="h-5 w-5" />
                <span>Apply</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

