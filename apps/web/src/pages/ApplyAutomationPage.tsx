import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/navbar";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast-context";
import { Zap, CheckCircle, XCircle, Settings, Info, RefreshCw, AlertCircle, Play, Clock } from "lucide-react";
import { ApplyProgressModal } from "@/components/ApplyProgressModal";

export default function ApplyAutomationPage() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const { data: dashboardData } = useQuery({
    queryKey: ["apply-dashboard"],
    queryFn: () => apiClient.get("/api/apply/dashboard"),
  });

  const { data: sourcesData } = useQuery({
    queryKey: ["apply-sources"],
    queryFn: () => apiClient.get("/api/apply/sources"),
  });

  const profile = (dashboardData as any)?.profile;
  const plan = (dashboardData as any)?.plan;
  const sources = (sourcesData as any)?.sources || [];

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      apiClient.post("/api/apply/automation/toggle", { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apply-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["apply-profile"] });
      showToast(
        profile?.auto_apply_enabled
          ? "Auto-apply disabled"
          : "Auto-apply enabled",
        "success"
      );
    },
    onError: () => {
      showToast("Failed to update automation settings", "error");
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: () =>
      apiClient.post("/api/apply/sources/regenerate"),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["apply-sources"] });
      queryClient.invalidateQueries({ queryKey: ["apply-dashboard"] });
      showToast(
        data?.message || "Sources regenerated successfully",
        "success"
      );
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || "Failed to regenerate sources";
      showToast(errorMessage, "error");
    },
  });

  const [showProgressModal, setShowProgressModal] = useState(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);

  const applyNowMutation = useMutation({
    mutationFn: () =>
      apiClient.post("/api/apply/automation/apply-now"),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["apply-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["apply-activity"] });
      if (data.run_id) {
        setCurrentRunId(data.run_id);
        setShowProgressModal(true);
      }
      showToast(
        data?.message || "Automation started successfully",
        "success"
      );
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || "Failed to start automation";
      showToast(errorMessage, "error");
    },
  });

  const updateTimeMutation = useMutation({
    mutationFn: (time: string) =>
      apiClient.put("/api/apply/profile", { preferred_run_time: time }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apply-profile"] });
      queryClient.invalidateQueries({ queryKey: ["apply-dashboard"] });
      showToast("Preferred time updated successfully", "success");
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || "Failed to update time";
      showToast(errorMessage, "error");
    },
  });

  const [preferredTime, setPreferredTime] = useState(
    profile?.preferred_run_time || "09:00"
  );

  // Update preferred time when profile changes
  useEffect(() => {
    if (profile?.preferred_run_time) {
      setPreferredTime(profile.preferred_run_time);
    } else if (!profile?.preferred_run_time && preferredTime !== "09:00") {
      setPreferredTime("09:00");
    }
  }, [profile?.preferred_run_time]);

  const handleToggle = () => {
    toggleMutation.mutate(!profile?.auto_apply_enabled);
  };

  return (
    <>
      <Helmet>
        <title>Automation - Apply System - Talents Media</title>
      </Helmet>

      <Navbar />

      <div className="min-h-screen pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <Link
              to="/apply"
              className="text-tm-text-muted hover:text-tm-text mb-4 inline-block"
            >
              ← Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold mb-2">Automation Settings</h1>
            <p className="text-tm-text-muted">
              Control your auto-apply behavior and preferences.
            </p>
          </div>

          {/* Auto-Apply Toggle */}
          <div className="glass-card p-6 mb-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Zap className="h-6 w-6 text-tm-primary-from" />
                  <h2 className="text-xl font-semibold">Auto-Apply</h2>
                </div>
                <p className="text-tm-text-muted mb-4">
                  When enabled, the system will automatically apply to matching
                  jobs daily based on your plan limits.
                </p>
                {!profile && (
                  <div className="p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg mb-4">
                    <p className="text-sm text-yellow-500">
                      Please complete your profile setup first.
                    </p>
                  </div>
                )}
                {!plan && (
                  <div className="p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg mb-4">
                    <p className="text-sm text-yellow-500 mb-3">
                      Please select a plan to enable auto-apply.
                    </p>
                    <Link
                      to="/apply/billing"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-tm-primary-from to-tm-primary-to text-white rounded-lg hover:brightness-110 transition text-sm font-medium"
                    >
                      <Settings className="h-4 w-4" />
                      Choose Plan
                    </Link>
                  </div>
                )}
                {profile && plan && profile.auto_apply_enabled && (
                  <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium text-blue-500">Daily Schedule</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-tm-text-muted">Preferred run time:</label>
                      <input
                        type="time"
                        value={preferredTime}
                        onChange={(e) => setPreferredTime(e.target.value)}
                        onBlur={() => {
                          if (preferredTime !== profile?.preferred_run_time) {
                            updateTimeMutation.mutate(preferredTime);
                          }
                        }}
                        className="px-3 py-2 bg-tm-bg border border-tm-primary-from/30 rounded-lg text-tm-text focus:outline-none focus:border-tm-primary-from"
                        disabled={updateTimeMutation.isPending}
                      />
                      {updateTimeMutation.isPending && (
                        <LoadingSpinner />
                      )}
                    </div>
                    <p className="text-xs text-tm-text-muted mt-2">
                      Automation will run daily at this time (your local timezone)
                    </p>
                  </div>
                )}
                {profile && plan && profile.auto_apply_enabled && (
                  <div className="mt-4">
                    <button
                      onClick={() => applyNowMutation.mutate()}
                      disabled={applyNowMutation.isPending}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-tm-primary-from to-tm-primary-to text-white rounded-lg hover:brightness-110 transition font-medium disabled:opacity-50"
                    >
                      {applyNowMutation.isPending ? (
                        <>
                          <LoadingSpinner />
                          <span>Starting...</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-5 w-5" />
                          <span>Apply Now</span>
                        </>
                      )}
                    </button>
                    <p className="text-xs text-tm-text-muted mt-2">
                      Immediately start the automation engine to search and apply to jobs now
                    </p>
                  </div>
                )}
              </div>
              <button
                onClick={handleToggle}
                disabled={!profile || !plan || toggleMutation.isPending}
                className={`ml-4 px-6 py-3 rounded-lg font-medium transition ${
                  profile?.auto_apply_enabled
                    ? "bg-green-500/20 text-green-500 border border-green-500/30"
                    : "bg-gray-500/20 text-gray-500 border border-gray-500/30"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {toggleMutation.isPending ? (
                  <LoadingSpinner />
                ) : profile?.auto_apply_enabled ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Enabled
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5" />
                    Disabled
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* How It Works */}
          <div className="glass-card p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">How Auto-Apply Works</h2>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-tm-primary-from/20 flex items-center justify-center text-tm-primary-from font-semibold">
                  1
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Daily Job Search</h3>
                  <p className="text-sm text-tm-text-muted">
                    Every day, the system searches for new jobs from safe, legal
                    sources.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-tm-primary-from/20 flex items-center justify-center text-tm-primary-from font-semibold">
                  2
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Smart Matching</h3>
                  <p className="text-sm text-tm-text-muted">
                    Jobs are matched against your profile (skills, titles,
                    location, keywords).
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-tm-primary-from/20 flex items-center justify-center text-tm-primary-from font-semibold">
                  3
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Automatic Application</h3>
                  <p className="text-sm text-tm-text-muted">
                    Top matches are automatically applied up to your daily plan
                    limit.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-tm-primary-from/20 flex items-center justify-center text-tm-primary-from font-semibold">
                  4
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Full Transparency</h3>
                  <p className="text-sm text-tm-text-muted">
                    All applications are logged with match scores and reasons.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Job Sources */}
          <div className="glass-card p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Job Sources</h2>
              {profile && (
                <button
                  onClick={() => regenerateMutation.mutate()}
                  disabled={regenerateMutation.isPending}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-tm-bg border border-tm-primary-from/50 text-tm-primary-from rounded-lg hover:border-tm-primary-from transition text-sm font-medium disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${regenerateMutation.isPending ? 'animate-spin' : ''}`} />
                  {regenerateMutation.isPending ? 'Regenerating...' : 'Regenerate Sources'}
                </button>
              )}
            </div>
            <p className="text-sm text-tm-text-muted mb-4">
              Sources are automatically generated from your profile. The system fetches jobs from these sources daily.
            </p>
            {sources.length > 0 ? (
              <div className="space-y-3">
                {sources.map((source: any) => (
                  <div
                    key={source.id}
                    className="p-4 rounded-lg bg-tm-bg/50 flex items-start justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium capitalize">{source.provider_name || source.provider}</span>
                        {source.enabled ? (
                          <span className="px-2 py-1 bg-green-500/20 text-green-500 rounded text-xs">
                            Enabled
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-500/20 text-gray-500 rounded text-xs">
                            Disabled
                          </span>
                        )}
                      </div>
                      {source.last_fetched_at && (
                        <div className="text-xs text-tm-text-muted">
                          Last fetched: {new Date(source.last_fetched_at).toLocaleString()}
                        </div>
                      )}
                      {source.error_state && (
                        <div className="text-xs text-red-500 mt-1">
                          Error: {source.error_state}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-tm-text-muted">
                <p className="text-sm mb-3">No sources configured. Complete your profile to generate sources.</p>
                {profile && (
                  <button
                    onClick={() => regenerateMutation.mutate()}
                    disabled={regenerateMutation.isPending}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-tm-primary-from to-tm-primary-to text-white rounded-lg hover:brightness-110 transition text-sm font-medium disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${regenerateMutation.isPending ? 'animate-spin' : ''}`} />
                    Generate Sources Now
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Compliance & Safety */}
          <div className="glass-card p-6 mb-6 border-2 border-blue-500/30">
            <div className="flex items-start gap-3 mb-4">
              <Info className="h-6 w-6 text-blue-500 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h2 className="text-xl font-semibold mb-2">Compliance & Safety</h2>
                <p className="text-sm text-tm-text-muted mb-4">
                  We only use legal and ethical methods to find and apply to jobs.
                </p>
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <div className="font-medium">Official Channels Only</div>
                      <div className="text-tm-text-muted">
                        We only apply via official channels: public job listings, official apply emails (careers@, jobs@, hr@), and official apply URLs.
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <div className="font-medium">No Email Scraping</div>
                      <div className="text-tm-text-muted">
                        We do NOT scrape personal emails or hunt for HR contact information. We only use emails provided in public job listings.
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <div className="font-medium">Respect Provider Rules</div>
                      <div className="text-tm-text-muted">
                        We respect the terms of service of all job providers and only use public APIs and RSS feeds.
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <div className="font-medium">Assisted Apply</div>
                      <div className="text-tm-text-muted">
                        For jobs that require web forms, we use Assisted Apply: you click once to open the apply page with prefilled cover letter text.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Current Plan Info */}
          {plan && (
            <div className="glass-card p-6">
              <h2 className="text-xl font-semibold mb-4">Current Plan</h2>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-tm-text-muted">Plan:</span>
                  <span className="font-semibold">{plan.display_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-tm-text-muted">Daily Limit:</span>
                  <span className="font-semibold">
                    {plan.daily_apply_limit} applications
                  </span>
                </div>
                <div className="mt-4">
                  <Link
                    to="/apply/billing"
                    className="inline-flex items-center gap-2 text-tm-primary-from hover:underline"
                  >
                    <Settings className="h-4 w-4" />
                    Manage Plan
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Progress Modal */}
      {showProgressModal && currentRunId && (
        <ApplyProgressModal
          runId={currentRunId}
          onClose={() => {
            setShowProgressModal(false);
            setCurrentRunId(null);
            queryClient.invalidateQueries({ queryKey: ["apply-dashboard"] });
            queryClient.invalidateQueries({ queryKey: ["apply-activity"] });
          }}
        />
      )}
    </>
  );
}
