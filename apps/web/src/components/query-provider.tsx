import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            gcTime: 5 * 60 * 1000, // 5 minutes
            refetchOnWindowFocus: false, // Don't refetch on window focus
            refetchOnMount: true, // Only refetch on mount if stale
            refetchOnReconnect: true, // Refetch on reconnect
            retry: (failureCount, error: any) => {
              // Don't retry on 429 (rate limit) or 401 (auth) errors
              if (error?.response?.status === 429 || error?.response?.status === 401) {
                return false;
              }
              return failureCount < 2; // Reduce retries from 3 to 2
            },
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
          },
          mutations: {
            retry: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

