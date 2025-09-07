import type { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { csrfClient } from './api/csrf';
import { logger } from './utils';

interface CSRFInterceptorOptions {
  cookieName?: string;
  headerName?: string;
  excludeUrls?: (string | RegExp)[];
  retryOnFailure?: boolean;
}

/**
 * CSRF Token Interceptor for Axios
 */
export class CSRFInterceptor {
  private tokenCache: string | null = null;
  private tokenPromise: Promise<string | null> | null = null;
  private options: Required<CSRFInterceptorOptions>;

  constructor(options: CSRFInterceptorOptions = {}) {
    this.options = {
      cookieName: options.cookieName || 'csrf-token',
      headerName: options.headerName || 'X-CSRF-Token',
      excludeUrls: options.excludeUrls || [],
      retryOnFailure: options.retryOnFailure ?? true,
    };
  }

  /**
   * Get CSRF token from cookie
   */
  private getTokenFromCookie(): string | null {
    if (typeof document === 'undefined') return null;

    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === this.options.cookieName) {
        return decodeURIComponent(value);
      }
    }
    return null;
  }

  /**
   * Get CSRF token (cached or fresh)
   */
  private async getToken(): Promise<string | null> {
    // Try cache first
    if (this.tokenCache) {
      return this.tokenCache;
    }

    // Try cookie
    const cookieToken = this.getTokenFromCookie();
    if (cookieToken) {
      this.tokenCache = cookieToken;
      return cookieToken;
    }

    // Prevent multiple concurrent requests
    if (this.tokenPromise) {
      return this.tokenPromise;
    }

    // Fetch from API
    this.tokenPromise = this.fetchToken();
    const token = await this.tokenPromise;
    this.tokenPromise = null;

    return token;
  }

  /**
   * Fetch token from API
   */
  private async fetchToken(): Promise<string | null> {
    try {
      const response = await csrfClient.getToken();
      this.tokenCache = response.token;
      return response.token;
    } catch (error) {
      logger.error('Failed to fetch CSRF token', { error });
      return null;
    }
  }

  /**
   * Clear cached token
   */
  private clearToken(): void {
    this.tokenCache = null;
    this.tokenPromise = null;
  }

  /**
   * Check if URL should be excluded from CSRF protection
   */
  private shouldExcludeUrl(url: string): boolean {
    return this.options.excludeUrls.some((pattern) => {
      if (typeof pattern === 'string') {
        return url.includes(pattern);
      }
      return pattern.test(url);
    });
  }

  /**
   * Request interceptor
   */
  private requestInterceptor = async (config: AxiosRequestConfig): Promise<AxiosRequestConfig> => {
    const method = config.method?.toLowerCase();
    const url = config.url || '';

    // Skip for safe methods or excluded URLs
    if (!method || ['get', 'head', 'options'].includes(method) || this.shouldExcludeUrl(url)) {
      return config;
    }

    // Get and add CSRF token
    const token = await this.getToken();
    if (token) {
      config.headers = {
        ...config.headers,
        [this.options.headerName]: token,
      };
    }

    return config;
  };

  /**
   * Response interceptor for handling CSRF errors
   */
  private responseInterceptor = async (error: AxiosError): Promise<never> => {
    const { response, config } = error;

    // Handle CSRF-related errors
    if (
      response?.status === 403 &&
      this.options.retryOnFailure &&
      config &&
      !config.metadata?.csrfRetried
    ) {
      const errorCode = (response.data as any)?.code;

      if (['CSRF_TOKEN_INVALID', 'CSRF_TOKEN_EXPIRED', 'CSRF_TOKEN_MISSING'].includes(errorCode)) {
        logger.warn('CSRF token error, refreshing and retrying', {
          url: config.url,
          errorCode,
        });

        // Clear cached token and get fresh one
        this.clearToken();
        const newToken = await this.fetchToken();

        if (newToken) {
          // Mark request as retried to prevent infinite loops
          config.metadata = { ...config.metadata, csrfRetried: true };

          // Update headers with new token
          config.headers = {
            ...config.headers,
            [this.options.headerName]: newToken,
          };

          // Retry request
          const axios = error.config?.axios || (await import('axios')).default;
          return axios.request(config);
        }
      }
    }

    return Promise.reject(error);
  };

  /**
   * Install interceptors on an Axios instance
   */
  install(axiosInstance: AxiosInstance): void {
    // Request interceptor
    axiosInstance.interceptors.request.use(this.requestInterceptor, (error) =>
      Promise.reject(error),
    );

    // Response interceptor
    axiosInstance.interceptors.response.use((response) => response, this.responseInterceptor);
  }

  /**
   * Manually refresh token
   */
  async refreshToken(): Promise<void> {
    this.clearToken();
    await this.fetchToken();
  }

  /**
   * Get current token (for manual use)
   */
  async getCurrentToken(): Promise<string | null> {
    return this.getToken();
  }
}

// Default interceptor instance
export const csrfInterceptor = new CSRFInterceptor({
  excludeUrls: [
    '/api/v1/health',
    '/api/v1/auth/plex/pin', // PIN generation doesn't need CSRF
    '/api/v1/csrf/token', // Token endpoint itself
    /\/webhooks\//i, // Webhook endpoints
  ],
});
