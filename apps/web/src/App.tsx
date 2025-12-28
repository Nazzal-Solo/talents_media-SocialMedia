import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { QueryProvider } from '@/components/query-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { SocketProvider } from '@/components/socket-provider';
import { ToastProvider } from '@/components/ui/toast-context';
import { BackToTop } from '@/components/ui/back-to-top';
import { useAuthStore } from '@/store/auth-store';

// Pages
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import AuthCallbackPage from '@/pages/AuthCallbackPage';
import ProfilePage from '@/pages/ProfilePage';
import SearchPage from '@/pages/SearchPage';
import PostDetailPage from '@/pages/PostDetailPage';
import ReelsPage from '@/pages/ReelsPage';
import ChatPage from '@/pages/ChatPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import ApplyDashboardPage from '@/pages/ApplyDashboardPage';
import ApplyProfilePage from '@/pages/ApplyProfilePage';
import ApplyJobsPage from '@/pages/ApplyJobsPage';
import ApplyAutomationPage from '@/pages/ApplyAutomationPage';
import ApplyActivityPage from '@/pages/ApplyActivityPage';
import ApplyBillingPage from '@/pages/ApplyBillingPage';
import ApplyCompaniesPage from '@/pages/ApplyCompaniesPage';
import ApplyCompanyFormPage from '@/pages/ApplyCompanyFormPage';
import ApplyCompanyDetailPage from '@/pages/ApplyCompanyDetailPage';

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

// Public Route Component (redirects to home if authenticated)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  return !isAuthenticated ? <>{children}</> : <Navigate to="/" replace />;
}

function App() {
  return (
    <HelmetProvider>
      <QueryProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark-neon"
          enableSystem={false}
          themes={['dark-neon', 'light', 'cyan', 'magenta', 'violet']}
        >
          <SocketProvider>
            <ToastProvider>
              <BrowserRouter>
                <Routes>
                  {/* Public Routes */}
                  <Route
                    path="/login"
                    element={
                      <PublicRoute>
                        <LoginPage />
                      </PublicRoute>
                    }
                  />
                  <Route
                    path="/register"
                    element={
                      <PublicRoute>
                        <RegisterPage />
                      </PublicRoute>
                    }
                  />
                  <Route path="/auth/callback" element={<AuthCallbackPage />} />
                  <Route
                    path="/forgot-password"
                    element={<ForgotPasswordPage />}
                  />
                  <Route
                    path="/reset-password"
                    element={<ResetPasswordPage />}
                  />

                  {/* Protected Routes */}
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <HomePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <ProfilePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/search"
                    element={
                      <ProtectedRoute>
                        <SearchPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/post/:id"
                    element={
                      <ProtectedRoute>
                        <PostDetailPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/reels"
                    element={
                      <ProtectedRoute>
                        <ReelsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/chat"
                    element={
                      <ProtectedRoute>
                        <ChatPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Apply System Routes */}
                  <Route
                    path="/apply"
                    element={
                      <ProtectedRoute>
                        <ApplyDashboardPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/apply/profile"
                    element={
                      <ProtectedRoute>
                        <ApplyProfilePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/apply/jobs"
                    element={
                      <ProtectedRoute>
                        <ApplyJobsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/apply/automation"
                    element={
                      <ProtectedRoute>
                        <ApplyAutomationPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/apply/activity"
                    element={
                      <ProtectedRoute>
                        <ApplyActivityPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/apply/billing"
                    element={
                      <ProtectedRoute>
                        <ApplyBillingPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/apply/companies"
                    element={
                      <ProtectedRoute>
                        <ApplyCompaniesPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/apply/companies/new"
                    element={
                      <ProtectedRoute>
                        <ApplyCompanyFormPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/apply/companies/:id"
                    element={
                      <ProtectedRoute>
                        <ApplyCompanyDetailPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/apply/companies/:id/edit"
                    element={
                      <ProtectedRoute>
                        <ApplyCompanyFormPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* 404 */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </BrowserRouter>
              <BackToTop />
            </ToastProvider>
          </SocketProvider>
        </ThemeProvider>
      </QueryProvider>
    </HelmetProvider>
  );
}

export default App;

