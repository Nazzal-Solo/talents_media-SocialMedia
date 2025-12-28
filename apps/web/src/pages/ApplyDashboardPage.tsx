import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Navbar } from '@/components/navbar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { apiClient } from '@/lib/api-client';
import {
  Briefcase,
  CheckCircle,
  XCircle,
  Clock,
  Settings,
  FileText,
  Zap,
  TrendingUp,
  Building2,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';

export default function ApplyDashboardPage() {
  const user = useAuthStore(state => state.user);
  const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';
  const isAdmin = user?.role === 'admin';
  const showCompanies = isDev || isAdmin;

  const { data, isLoading, error } = useQuery({
    queryKey: ['apply-dashboard'],
    queryFn: () => apiClient.get('/api/apply/dashboard'),
  });

  if (isLoading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen pt-24 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen pt-24 flex items-center justify-center">
          <div className="glass-card p-8 text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Error Loading Dashboard</h2>
            <p className="text-tm-text-muted">Please try again later.</p>
          </div>
        </div>
      </>
    );
  }

  const dashboard = data as any;
  const hasProfile = !!dashboard?.profile;
  const hasPlan = !!dashboard?.plan;
  const dailyStats = dashboard?.dailyStats || { applied: 0, limit: 2, remaining: 2 };

  return (
    <>
      <Helmet>
        <title>Apply Dashboard - Talents Media</title>
      </Helmet>

      <Navbar />

      <div className="min-h-screen pt-24 pb-12 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Auto Apply Dashboard</h1>
            <p className="text-tm-text-muted">
              Set it once, and we'll apply for you every day automatically.
            </p>
          </div>

          {/* Setup Status */}
          {!hasProfile && (
            <div className="glass-card p-6 mb-6 border-2 border-tm-primary-from/30">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-tm-primary-from/20">
                  <Settings className="h-6 w-6 text-tm-primary-from" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">Complete Your Setup</h3>
                  <p className="text-tm-text-muted mb-4">
                    Set up your profile and choose a plan to start auto-applying to jobs.
                  </p>
                  <div className="flex gap-3">
                    <Link
                      to="/apply/profile"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-tm-primary-from to-tm-primary-to text-white rounded-lg hover:brightness-110 transition"
                    >
                      <Settings className="h-4 w-4" />
                      Set Up Profile
                    </Link>
                    <Link
                      to="/apply/billing"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-tm-bg border-2 border-tm-primary-from/50 text-tm-primary-from rounded-lg hover:border-tm-primary-from transition"
                    >
                      <Zap className="h-4 w-4" />
                      Choose Plan
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Plan Selection Reminder */}
          {hasProfile && !dashboard?.plan && (
            <div className="glass-card p-6 mb-6 border-2 border-yellow-500/30">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-yellow-500/20">
                  <Zap className="h-6 w-6 text-yellow-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">Select a Plan to Enable Auto-Apply</h3>
                  <p className="text-tm-text-muted mb-4">
                    Choose a plan to start automatically applying to jobs daily. Free plan includes 2 applications per day.
                  </p>
                  <Link
                    to="/apply/billing"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-tm-primary-from to-tm-primary-to text-white rounded-lg hover:brightness-110 transition"
                  >
                    <Zap className="h-4 w-4" />
                    Choose Plan
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Daily Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-tm-text-muted">Applied Today</h3>
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div className="text-3xl font-bold">{dailyStats.applied}</div>
              <div className="text-sm text-tm-text-muted mt-1">
                of {dailyStats.limit} daily limit
              </div>
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-tm-text-muted">Remaining</h3>
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div className="text-3xl font-bold">{dailyStats.remaining}</div>
              <div className="text-sm text-tm-text-muted mt-1">applications left today</div>
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-tm-text-muted">Current Plan</h3>
                <Zap className="h-5 w-5 text-tm-primary-from" />
              </div>
              <div className="text-xl font-bold">
                {dashboard?.plan?.display_name || 'Free'}
              </div>
              <div className="text-sm text-tm-text-muted mt-1">
                {dashboard?.plan?.daily_apply_limit || 2} applications/day
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className={`grid grid-cols-1 md:grid-cols-2 ${showCompanies ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4 mb-8`}>
            <Link
              to="/apply/profile"
              className="glass-card p-6 hover:border-tm-primary-from/50 transition border-2 border-transparent"
            >
              <FileText className="h-6 w-6 mb-3 text-tm-primary-from" />
              <h3 className="font-semibold mb-1">Profile</h3>
              <p className="text-sm text-tm-text-muted">Update your skills & preferences</p>
            </Link>

            <Link
              to="/apply/jobs"
              className="glass-card p-6 hover:border-tm-primary-from/50 transition border-2 border-transparent"
            >
              <Briefcase className="h-6 w-6 mb-3 text-tm-primary-from" />
              <h3 className="font-semibold mb-1">Jobs</h3>
              <p className="text-sm text-tm-text-muted">Browse available positions</p>
            </Link>

            <Link
              to="/apply/automation"
              className="glass-card p-6 hover:border-tm-primary-from/50 transition border-2 border-transparent"
            >
              <Zap className="h-6 w-6 mb-3 text-tm-primary-from" />
              <h3 className="font-semibold mb-1">Automation</h3>
              <p className="text-sm text-tm-text-muted">Control auto-apply settings</p>
            </Link>

            <Link
              to="/apply/activity"
              className="glass-card p-6 hover:border-tm-primary-from/50 transition border-2 border-transparent"
            >
              <TrendingUp className="h-6 w-6 mb-3 text-tm-primary-from" />
              <h3 className="font-semibold mb-1">Activity</h3>
              <p className="text-sm text-tm-text-muted">View logs & history</p>
            </Link>

            {showCompanies && (
              <Link
                to="/apply/companies"
                className="glass-card p-6 hover:border-tm-primary-from/50 transition border-2 border-transparent"
              >
                <Building2 className="h-6 w-6 mb-3 text-tm-primary-from" />
                <h3 className="font-semibold mb-1">Companies</h3>
                <p className="text-sm text-tm-text-muted">Dev tools: Companies database</p>
              </Link>
            )}
          </div>

          {/* Recent Applications */}
          <div className="glass-card p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Recent Applications</h2>
              <Link
                to="/apply/activity"
                className="text-sm text-tm-primary-from hover:underline"
              >
                View All
              </Link>
            </div>
            {dashboard?.recentApplications?.length > 0 ? (
              <div className="space-y-3">
                {dashboard.recentApplications.slice(0, 5).map((app: any) => (
                  <div
                    key={app.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-tm-bg/50"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{app.job_title}</div>
                      <div className="text-sm text-tm-text-muted">{app.company}</div>
                      {app.match_reason && (
                        <div className="text-xs text-tm-text-muted mt-1">
                          {app.match_reason}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {app.match_score && (
                        <div className="text-sm font-medium">
                          {Math.round(app.match_score)}% match
                        </div>
                      )}
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          app.status === 'applied'
                            ? 'bg-green-500/20 text-green-500'
                            : app.status === 'failed'
                            ? 'bg-red-500/20 text-red-500'
                            : 'bg-gray-500/20 text-gray-500'
                        }`}
                      >
                        {app.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-tm-text-muted">
                <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No applications yet. Set up your profile to get started!</p>
              </div>
            )}
          </div>

          {/* System Health */}
          {dashboard?.systemHealth && (
            <div className="glass-card p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">System Health</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-tm-text-muted mb-1">Auto-Apply Status</div>
                  <div className="flex items-center gap-2">
                    {dashboard.systemHealth.autoApplyEnabled ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-green-500 font-medium">Enabled</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-500 font-medium">Disabled</span>
                      </>
                    )}
                  </div>
                </div>
                {dashboard.systemHealth.lastRunTime && (
                  <div>
                    <div className="text-sm text-tm-text-muted mb-1">Last Run</div>
                    <div className="text-sm">
                      {new Date(dashboard.systemHealth.lastRunTime).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
              {dashboard.sources && dashboard.sources.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm text-tm-text-muted mb-2">Active Sources</div>
                  <div className="flex flex-wrap gap-2">
                    {dashboard.sources.filter((s: any) => s.enabled).map((source: any) => (
                      <span
                        key={source.id}
                        className="px-2 py-1 bg-tm-primary-from/20 text-tm-primary-from rounded text-xs"
                      >
                        {source.provider}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recent Activity */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Recent Activity</h2>
              <Link
                to="/apply/activity"
                className="text-sm text-tm-primary-from hover:underline"
              >
                View All
              </Link>
            </div>
            {dashboard?.recentActivity?.length > 0 ? (
              <div className="space-y-2">
                {dashboard.recentActivity.slice(0, 5).map((log: any) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-tm-bg/50"
                  >
                    <div className="mt-1">
                      <div className="w-2 h-2 rounded-full bg-tm-primary-from" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{log.action.replace(/_/g, ' ')}</div>
                      {log.details && (
                        <div className="text-xs text-tm-text-muted mt-1">
                          {typeof log.details === 'object'
                            ? JSON.stringify(log.details)
                            : log.details}
                        </div>
                      )}
                      <div className="text-xs text-tm-text-muted mt-1">
                        {new Date(log.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-tm-text-muted">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No activity yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

