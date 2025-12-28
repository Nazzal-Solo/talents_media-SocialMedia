import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

class ApiClient {
  private client: AxiosInstance;
  private isRefreshing = false;
  private refreshPromise: Promise<any> | null = null;

  constructor() {
    // Backend is at http://localhost:4002
    // All API routes are under /api, so paths should include /api prefix
    // Use full URL to bypass Vite proxy and call backend directly
    const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4002';
    
    this.client = axios.create({
      baseURL,
      withCredentials: true,
      timeout: 300000, // 5 minutes timeout
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      config => {
        // Add authorization header if token exists
        if (typeof window !== 'undefined') {
          const authStorage = localStorage.getItem('auth-storage');
          if (authStorage) {
            try {
              const authData = JSON.parse(authStorage);
              if (authData.state?.accessToken) {
                config.headers.Authorization = `Bearer ${authData.state.accessToken}`;
              }
            } catch (error) {
              console.error('Error parsing auth storage:', error);
            }
          }
        }
        return config;
      },
      error => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      response => {
        return response;
      },
      async error => {
        const originalRequest = error.config;

        // Don't intercept canceled requests - let them be handled by caller
        if (
          error.code === 'ERR_CANCELED' ||
          error.name === 'CanceledError' ||
          error.message?.includes('canceled')
        ) {
          return Promise.reject(error);
        }

        // Don't intercept auth endpoints - let them handle their own errors
        const isAuthEndpoint =
          originalRequest?.url?.includes('/auth/login') ||
          originalRequest?.url?.includes('/auth/register') ||
          originalRequest?.url?.includes('/auth/refresh') ||
          originalRequest?.url?.includes('/api/auth/login') ||
          originalRequest?.url?.includes('/api/auth/register') ||
          originalRequest?.url?.includes('/api/auth/refresh');

        // Prevent infinite refresh loops
        if (originalRequest?.url?.includes('/api/auth/refresh')) {
          // Refresh endpoint failed - clear auth and redirect to login
          if (typeof window !== 'undefined') {
            // Clear any stored tokens
            document.cookie.split(";").forEach((c) => {
              document.cookie = c
                .replace(/^ +/, "")
                .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
            });
            // Redirect to login
            window.location.href = '/login';
          }
          return Promise.reject(error);
        }

        if (
          error.response?.status === 401 &&
          !originalRequest._retry &&
          !isAuthEndpoint
        ) {
          originalRequest._retry = true;

          // If already refreshing, wait for that to complete
          if (this.isRefreshing && this.refreshPromise) {
            try {
              await this.refreshPromise;
              // Retry original request after refresh completes
              return this.client(originalRequest);
            } catch {
              // Refresh failed, redirect to login
              if (typeof window !== 'undefined') {
                this.clearAuthAndRedirect();
              }
              return Promise.reject(error);
            }
          }

          // Start refresh process
          this.isRefreshing = true;
          this.refreshPromise = this.client.post('/api/auth/refresh')
            .then(() => {
              this.isRefreshing = false;
              this.refreshPromise = null;
            })
            .catch((refreshError) => {
              this.isRefreshing = false;
              this.refreshPromise = null;
              // Refresh failed, clear auth and redirect to login
              if (typeof window !== 'undefined') {
                this.clearAuthAndRedirect();
              }
              throw refreshError;
            });

          try {
            await this.refreshPromise;
            // Retry original request after successful refresh
            return this.client(originalRequest);
          } catch (refreshError) {
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.client.get(url, {
        ...config,
        // Allow per-request timeout override
        timeout: config?.timeout ?? this.client.defaults.timeout,
        // Support AbortController signal for request cancellation
        signal: config?.signal,
      });
      return response.data;
    } catch (error: any) {
      // Re-throw abort/timeout errors as-is (they'll be handled by caller)
      if (error.code === 'ECONNABORTED' || error.name === 'AbortError' || error.message?.includes('aborted')) {
        throw error;
      }
      throw error;
    }
  }

  async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response: AxiosResponse<T> = await this.client.post(
      url,
      data,
      config
    );
    return response.data;
  }

  async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response: AxiosResponse<T> = await this.client.put(url, data, config);
    return response.data;
  }

  async patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response: AxiosResponse<T> = await this.client.patch(
      url,
      data,
      config
    );
    return response.data;
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.delete(url, config);
    return response.data;
  }

  private clearAuthAndRedirect(): void {
    // Clear all cookies
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    // Clear localStorage auth data
    localStorage.removeItem('auth-storage');
    // Redirect to login
    window.location.href = '/login';
  }
}

export const apiClient = new ApiClient();

