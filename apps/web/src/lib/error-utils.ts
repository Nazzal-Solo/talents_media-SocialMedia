import axios from 'axios';

/**
 * Checks if an error is a request cancellation/timeout (non-fatal).
 * These errors should be silently ignored and not shown to users.
 * 
 * @param error - The error to check
 * @returns true if the error is a cancellation/timeout, false otherwise
 */
export function isRequestCanceled(error: unknown): boolean {
  if (!error) return false;

  // Axios CanceledError (from React Query or manual cancellation)
  if (
    (error as any).name === 'CanceledError' ||
    (error as any).code === 'ERR_CANCELED'
  ) {
    return true;
  }

  // Axios timeout error
  if (
    (error as any).code === 'ECONNABORTED' ||
    (error as any).message?.includes('timeout')
  ) {
    return true;
  }

  // AbortController cancellation
  if (
    (error as any).name === 'AbortError' ||
    (error as any).message?.includes('aborted')
  ) {
    return true;
  }

  // Check if axios.isCancel is available (Axios cancellation)
  if (axios.isCancel && axios.isCancel(error)) {
    return true;
  }

  // Check axios.isAxiosError for CanceledError
  if (axios.isAxiosError && axios.isAxiosError(error)) {
    if (
      error.code === 'ERR_CANCELED' ||
      error.name === 'CanceledError'
    ) {
      return true;
    }
  }

  return false;
}

