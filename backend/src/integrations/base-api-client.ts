import {
  CircuitBreaker,
  CircuitBreakerOptions,
} from '../utils/circuit-breaker';
import { logger } from '../utils/logger';

export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  apiKey?: string;
  headers?: Record<string, string>;
  circuitBreakerOptions?: CircuitBreakerOptions;
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
  success: boolean;
}

export interface HealthStatus {
  healthy: boolean;
  responseTime?: number;
  lastChecked: Date;
  error?: string;
  circuitBreakerState?: string;
}

export abstract class BaseApiClient {
  protected circuitBreaker: CircuitBreaker;
  protected lastHealthCheck: HealthStatus | null = null;

  constructor(
    protected serviceName: string,
    protected config: ApiClientConfig
  ) {
    const defaultCircuitBreakerOptions: CircuitBreakerOptions = {
      failureThreshold: 5,
      resetTimeout: 30000, // 30 seconds
      monitoringPeriod: 60000, // 1 minute
      expectedErrors: ['ENOTFOUND', 'ECONNREFUSED', 'timeout'],
    };

    this.circuitBreaker = new CircuitBreaker(`${serviceName}-circuit-breaker`, {
      ...defaultCircuitBreakerOptions,
      ...config.circuitBreakerOptions,
    });
  }

  protected async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.config.baseURL}${endpoint}`;
    const timeout = this.config.timeout || 5000;

    const requestOptions: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MediaNest/1.0',
        ...this.config.headers,
        ...(this.config.apiKey && { 'X-API-Key': this.config.apiKey }),
        ...options.headers,
      },
    };

    return this.circuitBreaker.execute(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        logger.debug(`${this.serviceName} API request`, {
          method: options.method || 'GET',
          url,
          headers: this.sanitizeHeaders(
            requestOptions.headers as Record<string, string>
          ),
        });

        const response = await fetch(url, {
          ...requestOptions,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        let data: T;
        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
          data = await response.json();
        } else {
          data = (await response.text()) as any;
        }

        const apiResponse: ApiResponse<T> = {
          data,
          status: response.status,
          headers: responseHeaders,
          success: response.ok,
        };

        if (!response.ok) {
          logger.warn(`${this.serviceName} API error`, {
            status: response.status,
            statusText: response.statusText,
            data,
          });

          throw new Error(
            `${this.serviceName} API error: ${response.status} ${response.statusText}`
          );
        }

        logger.debug(`${this.serviceName} API success`, {
          status: response.status,
          dataSize: JSON.stringify(data).length,
        });

        return apiResponse;
      } catch (error) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
          throw new Error(
            `${this.serviceName} request timeout after ${timeout}ms`
          );
        }

        logger.error(`${this.serviceName} API request failed`, {
          error: error.message,
          url,
          method: options.method || 'GET',
        });

        throw error;
      }
    });
  }

  protected async requestWithRetry<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const maxRetries = this.config.retryAttempts || 3;
    const retryDelay = this.config.retryDelay || 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.request<T>(endpoint, options);
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }

        logger.warn(`${this.serviceName} request failed, retrying`, {
          attempt,
          maxRetries,
          error: error.message,
          retryIn: retryDelay,
        });

        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }

    throw new Error(
      `${this.serviceName} request failed after ${maxRetries} attempts`
    );
  }

  async healthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();

    try {
      await this.performHealthCheck();
      const responseTime = Date.now() - startTime;

      this.lastHealthCheck = {
        healthy: true,
        responseTime,
        lastChecked: new Date(),
        circuitBreakerState: this.circuitBreaker.getStats().state,
      };

      return this.lastHealthCheck;
    } catch (error) {
      this.lastHealthCheck = {
        healthy: false,
        lastChecked: new Date(),
        error: error.message,
        circuitBreakerState: this.circuitBreaker.getStats().state,
      };

      return this.lastHealthCheck;
    }
  }

  protected abstract performHealthCheck(): Promise<void>;

  getCircuitBreakerStats() {
    return this.circuitBreaker.getStats();
  }

  getLastHealthCheck(): HealthStatus | null {
    return this.lastHealthCheck;
  }

  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
    logger.info(`${this.serviceName} circuit breaker reset`);
  }

  private sanitizeHeaders(
    headers: Record<string, string>
  ): Record<string, string> {
    const sanitized = { ...headers };
    const sensitiveKeys = ['authorization', 'x-api-key', 'x-plex-token'];

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}
