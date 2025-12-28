import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Navbar } from '@/components/navbar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { apiClient } from '@/lib/api-client';
import { Briefcase, ExternalLink, MapPin, DollarSign, CheckCircle, Clock, Copy } from 'lucide-react';
import { useToast } from '@/components/ui/toast-context';

export default function ApplyJobsPage() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'found' | 'matched' | 'applied' | 'assisted'>('found');

  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ['apply-jobs'],
    queryFn: () => apiClient.get('/api/apply/jobs?limit=50'),
    enabled: activeTab === 'found',
  });

  const { data: matchesData, isLoading: matchesLoading } = useQuery({
    queryKey: ['apply-matches', activeTab],
    queryFn: () => apiClient.get(`/api/apply/matches?status=${activeTab === 'matched' ? 'queued' : activeTab === 'applied' ? 'applied' : 'assisted_required'}&limit=50`),
    enabled: activeTab !== 'found',
  });

  const { data: assistedData, isLoading: assistedLoading } = useQuery({
    queryKey: ['apply-assisted'],
    queryFn: () => apiClient.get('/api/apply/assisted'),
    enabled: activeTab === 'assisted',
  });

  const jobs = activeTab === 'found' ? (jobsData as any)?.jobs || [] : [];
  const matches = activeTab === 'matched' || activeTab === 'applied' ? (matchesData as any)?.matches || [] : [];
  const assisted = activeTab === 'assisted' ? (assistedData as any)?.applications || [] : [];

  const isLoading = jobsLoading || matchesLoading || assistedLoading;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard', 'success');
  };

  return (
    <>
      <Helmet>
        <title>Jobs - Apply System - Talents Media</title>
      </Helmet>

      <Navbar />

      <div className="min-h-screen pt-24 pb-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <Link
              to="/apply"
              className="text-tm-text-muted hover:text-tm-text mb-4 inline-block"
            >
              ← Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold mb-2">Jobs</h1>
            <p className="text-tm-text-muted">
              Browse jobs, matches, and applications.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-tm-bg/50">
            {(['found', 'matched', 'applied', 'assisted'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 font-medium transition ${
                  activeTab === tab
                    ? 'border-b-2 border-tm-primary-from text-tm-primary-from'
                    : 'text-tm-text-muted hover:text-tm-text'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : (
            <>
              {/* Found Jobs Tab */}
              {activeTab === 'found' && (
                <>
                  {jobs.length > 0 ? (
                    <div className="space-y-4">
                      {jobs.map((job: any) => (
                        <div key={job.id} className="glass-card p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="text-xl font-semibold mb-2">{job.title}</h3>
                              {job.company && (
                                <div className="flex items-center gap-2 text-tm-text-muted mb-2">
                                  <Briefcase className="h-4 w-4" />
                                  {job.company}
                                </div>
                              )}
                              {job.location && (
                                <div className="flex items-center gap-2 text-tm-text-muted mb-2">
                                  <MapPin className="h-4 w-4" />
                                  {job.is_remote ? '🌍 Remote' : job.location}
                                </div>
                              )}
                              {(job.salary_min || job.salary_max) && (
                                <div className="flex items-center gap-2 text-tm-text-muted mb-3">
                                  <DollarSign className="h-4 w-4" />
                                  {job.salary_min && job.salary_max
                                    ? `${job.salary_min} - ${job.salary_max} ${job.salary_currency || ''}`
                                    : job.salary_min
                                    ? `From ${job.salary_min} ${job.salary_currency || ''}`
                                    : `Up to ${job.salary_max} ${job.salary_currency || ''}`}
                                </div>
                              )}
                              {job.description && (
                                <p className="text-sm text-tm-text-muted line-clamp-3 mb-3">
                                  {job.description}
                                </p>
                              )}
                              <div className="flex items-center gap-2">
                                <span className="text-xs px-2 py-1 bg-tm-primary-from/20 text-tm-primary-from rounded">
                                  {job.source}
                                </span>
                                {job.posted_date && (
                                  <span className="text-xs text-tm-text-muted">
                                    Posted {new Date(job.posted_date).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="ml-4">
                              <a
                                href={job.job_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-tm-primary-from to-tm-primary-to text-white rounded-lg hover:brightness-110"
                              >
                                View Job
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="glass-card p-12 text-center">
                      <Briefcase className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <h3 className="text-xl font-semibold mb-2">No Jobs Available</h3>
                      <p className="text-tm-text-muted">
                        Check back later for new job listings.
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Matched Jobs Tab */}
              {activeTab === 'matched' && (
                <>
                  {matches.length > 0 ? (
                    <div className="space-y-4">
                      {matches.map((match: any) => (
                        <div key={match.id} className="glass-card p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-xl font-semibold">{match.job_title}</h3>
                                <span className="px-2 py-1 bg-green-500/20 text-green-500 rounded text-sm font-medium">
                                  {Math.round(match.match_score)}% match
                                </span>
                              </div>
                              {match.company && (
                                <div className="flex items-center gap-2 text-tm-text-muted mb-2">
                                  <Briefcase className="h-4 w-4" />
                                  {match.company}
                                </div>
                              )}
                              {match.match_reasons && match.match_reasons.length > 0 && (
                                <div className="mb-3">
                                  <div className="text-sm font-medium mb-1">Match Reasons:</div>
                                  <div className="flex flex-wrap gap-2">
                                    {match.match_reasons.slice(0, 3).map((reason: string, idx: number) => (
                                      <span
                                        key={idx}
                                        className="text-xs px-2 py-1 bg-tm-primary-from/20 text-tm-primary-from rounded"
                                      >
                                        {reason}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div className="text-xs text-tm-text-muted">
                                Status: {match.status}
                              </div>
                            </div>
                            <div className="ml-4">
                              <a
                                href={match.job_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-tm-primary-from to-tm-primary-to text-white rounded-lg hover:brightness-110"
                              >
                                View Job
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="glass-card p-12 text-center">
                      <CheckCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <h3 className="text-xl font-semibold mb-2">No Matched Jobs</h3>
                      <p className="text-tm-text-muted">
                        Jobs matching your profile will appear here.
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Assisted Apply Tab */}
              {activeTab === 'assisted' && (
                <>
                  {assisted.length > 0 ? (
                    <div className="space-y-4">
                      {assisted.map((app: any) => (
                        <div key={app.id} className="glass-card p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="text-xl font-semibold mb-2">{app.job_title}</h3>
                              {app.company && (
                                <div className="flex items-center gap-2 text-tm-text-muted mb-2">
                                  <Briefcase className="h-4 w-4" />
                                  {app.company}
                                </div>
                              )}
                              {app.application_details?.cover_letter_text && (
                                <div className="mb-3">
                                  <div className="text-sm font-medium mb-2">Cover Letter:</div>
                                  <div className="p-3 bg-tm-bg/50 rounded text-sm text-tm-text-muted mb-2">
                                    {app.application_details.cover_letter_text.substring(0, 200)}...
                                  </div>
                                  <button
                                    onClick={() => copyToClipboard(app.application_details.cover_letter_text)}
                                    className="text-xs text-tm-primary-from hover:underline flex items-center gap-1"
                                  >
                                    <Copy className="h-3 w-3" />
                                    Copy full text
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="ml-4 flex flex-col gap-2">
                              <a
                                href={app.application_details?.apply_url || app.job_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-tm-primary-from to-tm-primary-to text-white rounded-lg hover:brightness-110"
                              >
                                Open Apply Page
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="glass-card p-12 text-center">
                      <Clock className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <h3 className="text-xl font-semibold mb-2">No Assisted Applies</h3>
                      <p className="text-tm-text-muted">
                        Jobs requiring manual application will appear here.
                      </p>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

