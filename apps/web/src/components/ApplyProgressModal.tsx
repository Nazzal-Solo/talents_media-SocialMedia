import { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface ProgressModalProps {
  runId: string;
  onClose: () => void;
}

export function ApplyProgressModal({ runId, onClose }: ProgressModalProps) {
  const [progress, setProgress] = useState<any>(null);
  const [isPolling, setIsPolling] = useState(true);
  const [startTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);

  // Real-time timer that updates every second
  useEffect(() => {
    if (!isPolling || progress?.status === 'completed' || progress?.status === 'failed') {
      return;
    }

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsedTime(elapsed);
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime, isPolling, progress?.status]);

  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds} sec${seconds !== 1 ? 's' : ''}`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      if (secs === 0) {
        return `${minutes} min${minutes !== 1 ? 's' : ''}`;
      }
      return `${minutes} min ${secs} sec${secs !== 1 ? 's' : ''}`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours} hr${hours !== 1 ? 's' : ''} ${minutes} min${minutes !== 1 ? 's' : ''}`;
    }
  };

  useEffect(() => {
    if (!runId || !isPolling) return;

    const pollProgress = async () => {
      try {
        const response = await apiClient.get(`/api/apply/automation/progress?runId=${runId}`);
        const data = response?.data || response;
        
        if (!data || typeof data !== 'object') {
          console.error('Invalid progress response:', data);
          return;
        }

        setProgress(data);

        // Stop polling if completed or failed
        if (data.status === 'completed' || data.status === 'failed') {
          setIsPolling(false);
          // Auto-close after 3 seconds if completed
          if (data.status === 'completed') {
            setTimeout(() => {
              onClose();
            }, 3000);
          }
        }
      } catch (error: any) {
        console.error('Error polling progress:', error);
        // If it's a 404 or the run doesn't exist yet, keep polling
        if (error?.response?.status === 404) {
          // Run might not have started yet, keep polling
          return;
        }
        // For other errors, show error state
        setProgress({
          status: 'error',
          current_step: 'Error fetching progress',
          progress: 0,
          details: {
            jobs_fetched: 0,
            jobs_matched: 0,
            jobs_applied: 0,
            jobs_failed: 0,
          },
          logs: [],
        });
        setIsPolling(false);
      }
    };

    // Poll immediately
    pollProgress();

    // Then poll every 1 second for faster updates
    const interval = setInterval(pollProgress, 1000);

    return () => clearInterval(interval);
  }, [runId, isPolling, onClose]);

  if (!progress) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
        <div className="glass-card p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-tm-primary-from" />
            <span className="text-tm-text">Loading progress...</span>
          </div>
        </div>
      </div>
    );
  }


  const getStatusColor = () => {
    if (progress.status === 'completed') return 'text-green-500';
    if (progress.status === 'failed' || progress.status === 'error') return 'text-red-500';
    return 'text-tm-primary-from';
  };

  const getStatusIcon = () => {
    if (progress.status === 'completed') {
      return <CheckCircle className="h-6 w-6 text-green-500" />;
    }
    if (progress.status === 'failed' || progress.status === 'error') {
      return <AlertCircle className="h-6 w-6 text-red-500" />;
    }
    return <Loader2 className="h-6 w-6 animate-spin text-tm-primary-from" />;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="glass-card p-6 max-w-lg w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Automation Progress</h3>
          <button
            onClick={onClose}
            className="text-tm-text-muted hover:text-tm-text transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Status */}
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div className="flex-1">
              <div className={`font-medium ${getStatusColor()}`}>
                {progress.current_step || 'Processing...'}
              </div>
              <div className="text-sm text-tm-text-muted flex items-center gap-2">
                {progress.status === 'running' && (
                  <>
                    <span className="inline-block w-2 h-2 bg-tm-primary-from rounded-full animate-pulse" />
                    <span>Processing in background...</span>
                  </>
                )}
                {progress.status === 'fetching' && (
                  <>
                    <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span>Fetching jobs from sources...</span>
                  </>
                )}
                {progress.status === 'matching' && (
                  <>
                    <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                    <span>Matching jobs against your profile...</span>
                  </>
                )}
                {progress.status === 'applying' && (
                  <>
                    <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span>Applying to matched jobs...</span>
                  </>
                )}
                {progress.status === 'completed' && 'All done!'}
                {(progress.status === 'failed' || progress.status === 'error') && 'Something went wrong'}
                {!progress.status && 'Initializing...'}
              </div>
            </div>
          </div>

          {/* Daily Limit Reached Warning */}
          {progress.details?.limit_reached && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="text-sm text-blue-400">
                ℹ️ Daily limit reached ({progress.details?.daily_applied || 0}/{progress.details?.daily_limit || 0} applications today).
                {progress.details?.jobs_fetched > 0 && (
                  <span className="block mt-1 text-xs">
                    Found {progress.details.jobs_fetched} jobs but cannot apply due to daily limit.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Stuck Warning */}
          {!progress.details?.limit_reached && elapsedTime > 30 && progress.details?.jobs_fetched === 0 && progress.status !== 'completed' && progress.status !== 'failed' && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="text-sm text-yellow-500">
                ⚠️ Taking longer than expected. This might be due to:
                <ul className="list-disc list-inside mt-1 ml-2 text-xs">
                  <li>Large number of jobs to fetch</li>
                  <li>Network delays</li>
                  <li>API rate limiting</li>
                </ul>
              </div>
            </div>
          )}

          {/* Current Job Being Processed */}
          {(progress.current_job || (progress.status === 'applying' && progress.details?.total_jobs > 0)) && (
            <div className="p-4 bg-tm-bg/50 rounded-lg border border-tm-primary-from/20">
              <div className="flex items-start gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-tm-primary-from mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-tm-text mb-1">
                    {progress.current_job ? (
                      <>Applying to: {progress.current_job.title}</>
                    ) : (
                      <>Applying to jobs...</>
                    )}
                  </div>
                  <div className="text-xs text-tm-text-muted">
                    {progress.current_job?.company && `Company: ${progress.current_job.company}`}
                    {progress.current_job?.index > 0 && (
                      <span className="ml-2">
                        ({progress.current_job.index} of {progress.current_job.total})
                      </span>
                    )}
                    {!progress.current_job && progress.details?.total_jobs > 0 && (
                      <span>
                        ({progress.details?.processed_jobs || 0} of {progress.details.total_jobs})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Time Information */}
          <div className="flex items-center justify-between text-sm pt-2 border-t border-tm-bg/50">
            <div className="flex items-center gap-2 text-tm-text-muted">
              <span>⏱️ Elapsed:</span>
              <span className="font-medium text-tm-text">
                {progress.time?.elapsed_formatted || formatTime(elapsedTime)}
              </span>
            </div>
            {progress.time?.estimated_remaining_seconds > 0 && progress.status !== 'completed' && progress.status !== 'failed' && (
              <div className="flex items-center gap-2 text-tm-text-muted">
                <span>⏳ Est. Remaining:</span>
                <span className="font-medium text-tm-text">
                  {progress.time.estimated_remaining_formatted || formatTime(progress.time.estimated_remaining_seconds)}
                </span>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-tm-bg rounded-full h-2">
            <div
              className="bg-gradient-to-r from-tm-primary-from to-tm-primary-to h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.progress || 0}%` }}
            />
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="p-3 bg-tm-bg/50 rounded-lg">
              <div className="text-sm text-tm-text-muted">Jobs Fetched</div>
              <div className="text-2xl font-bold">{progress.details?.jobs_fetched || 0}</div>
            </div>
            <div className="p-3 bg-tm-bg/50 rounded-lg">
              <div className="text-sm text-tm-text-muted">Jobs Matched</div>
              <div className="text-2xl font-bold">{progress.details?.jobs_matched || 0}</div>
            </div>
            <div className="p-3 bg-tm-bg/50 rounded-lg">
              <div className="text-sm text-tm-text-muted">Jobs Applied</div>
              <div className="text-2xl font-bold text-green-500">
                {progress.details?.jobs_applied || 0}
              </div>
            </div>
            <div className="p-3 bg-tm-bg/50 rounded-lg">
              <div className="text-sm text-tm-text-muted">Failed</div>
              <div className="text-2xl font-bold text-red-500">
                {progress.details?.jobs_failed || 0}
              </div>
            </div>
          </div>

          {/* Logs */}
          {progress.logs && progress.logs.length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-medium mb-2">Recent Activity</div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {progress.logs.map((log: any, idx: number) => (
                  <div key={idx} className="text-xs text-tm-text-muted flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-tm-primary-from" />
                    <span>{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {progress.status === 'completed' && (
            <button
              onClick={onClose}
              className="w-full mt-4 px-4 py-2 bg-gradient-to-r from-tm-primary-from to-tm-primary-to text-white rounded-lg hover:brightness-110 transition"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

