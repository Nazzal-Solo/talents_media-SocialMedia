import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Navbar } from '@/components/navbar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { apiClient } from '@/lib/api-client';
import { Activity, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function ApplyActivityPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['apply-activity'],
    queryFn: () => apiClient.get('/api/apply/activity?limit=100'),
  });

  const logs = (data as any)?.logs || [];

  const getIcon = (action: string) => {
    if (action.includes('enabled') || action.includes('applied')) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    if (action.includes('failed') || action.includes('error')) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    if (action.includes('skipped') || action.includes('limit')) {
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
    return <Clock className="h-4 w-4 text-blue-500" />;
  };

  return (
    <>
      <Helmet>
        <title>Activity Logs - Apply System - Talents Media</title>
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
            <h1 className="text-3xl font-bold mb-2">Activity Logs</h1>
            <p className="text-tm-text-muted">
              View all automation activity and application history.
            </p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : logs.length > 0 ? (
            <div className="space-y-3">
              {logs.map((log: any) => (
                <div key={log.id} className="glass-card p-4">
                  <div className="flex items-start gap-4">
                    <div className="mt-1">{getIcon(log.action)}</div>
                    <div className="flex-1">
                      <div className="font-medium mb-1">
                        {log.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </div>
                      {log.details && (
                        <div className="text-sm text-tm-text-muted">
                          {JSON.stringify(log.details, null, 2)}
                        </div>
                      )}
                      <div className="text-xs text-tm-text-muted mt-2">
                        {new Date(log.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card p-12 text-center">
              <Activity className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-semibold mb-2">No Activity Yet</h3>
              <p className="text-tm-text-muted">
                Activity logs will appear here once you start using the system.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

