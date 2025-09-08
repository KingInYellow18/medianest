import {
  AppError,
  AuthenticationError,
  ValidationError,
  RateLimitError,
  ServiceUnavailableError,
  parseApiError,
  logError,
} from '@medianest/shared/client';

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
  timeout?: number;
  cache?: RequestCache;
  revalidate?: number; // seconds
}

class ApiClient {
  private baseUrl: string;
  private defaultTimeout: number;

  constructor(baseUrl = '', defaultTimeout = 30000) {
    this.baseUrl = baseUrl;
    this.defaultTimeout = defaultTimeout;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');

    if (!response.ok) {
      let errorData;
      try {
        errorData = isJson ? await response.json() : { error: { message: await response.text() } };
      } catch {
        errorData = { error: { message: 'An error occurred' } };
      }

      // Parse and throw appropriate error
      const error = this.parseResponseError(response.status, errorData);
      logError(error, {
        url: response.url,
        status: response.status,
        statusText: response.statusText,
      });
      throw error;
    }

    // Return successful response
    if (response.status === 204 || !isJson) {
      return {} as T;
    }

    const data = await response.json();

    // Handle API response format
    if (data.success === false && data.error) {
      throw parseApiError(data);
    }

    return data.data || data;
  }

  private parseResponseError(status: number, data: any): AppError {
    const error = data?.error || {};
    const message = error.message || 'An error occurred';
    const code = error.code || 'API_ERROR';
    const details = error.details;

    switch (status) {
      case 400:
        return new ValidationError(message, details);
      case 401:
        return new AuthenticationError(message);
      case 429:
        return new RateLimitError(error.retryAfter);
      case 503:
        return new ServiceUnavailableError('API');
      default:
        return new AppError(message, status, code, details);
    }
  }

  private async fetchWithTimeout(url: string, options: RequestOptions): Promise<Response> {
    const timeout = options.timeout || this.defaultTimeout;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new AppError('Request timeout', 408, 'TIMEOUT_ERROR');
        }
        if (error.message.includes('fetch')) {
          throw new AppError('Network error', 0, 'NETWORK_ERROR');
        }
      }

      throw error;
    }
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    const url = new URL(path, this.baseUrl);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    return url.toString();
  }

  async get<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(path, options.params);

    // Add cache headers for better performance
    const headers: HeadersInit = {
      ...options.headers,
    };

    // Set cache control based on revalidate option
    if (options.revalidate !== undefined) {
      headers['Cache-Control'] = `max-age=${options.revalidate}, stale-while-revalidate=${
        options.revalidate * 2
      }`;
    }

    const response = await this.fetchWithTimeout(url, {
      ...options,
      method: 'GET',
      headers,
      cache: options.cache || 'default',
    });
    return this.handleResponse<T>(response);
  }

  async post<T = any>(path: string, body?: any, options: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(path, options.params);
    const response = await this.fetchWithTimeout(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse<T>(response);
  }

  async put<T = any>(path: string, body?: any, options: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(path, options.params);
    const response = await this.fetchWithTimeout(url, {
      ...options,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse<T>(response);
  }

  async delete<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(path, options.params);
    const response = await this.fetchWithTimeout(url, {
      ...options,
      method: 'DELETE',
    });
    return this.handleResponse<T>(response);
  }

  async patch<T = any>(path: string, body?: any, options: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(path, options.params);
    const response = await this.fetchWithTimeout(url, {
      ...options,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse<T>(response);
  }
}

// Create default API client instance
export const apiClient = new ApiClient('/api');

// Export for custom instances
export { ApiClient };
