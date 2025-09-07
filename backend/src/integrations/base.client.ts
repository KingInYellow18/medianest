import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import http from 'http';
import https from 'https';

// @ts-ignore
import {
  ServiceUnavailableError,
  BadRequestError, // @ts-ignore
} from '@medianest/shared';

import { logger } from '@/utils/logger';
import { CatchError } from '../types/common';

export interface ServiceConfig {
  name: string;
  baseURL: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  circuitBreakerThreshold?: number;
  circuitBreakerTimeout?: number;
}

interface CircuitBreakerState {
  failureCount: number;
  lastFailureTime: number | null;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

export abstract class BaseServiceClient {
  protected readonly name: string;
  protected readonly baseURL: string;
  protected readonly timeout: number;
  protected readonly retryAttempts: number;
  protected readonly retryDelay: number;
  protected readonly axios: AxiosInstance;

  private circuitBreaker: CircuitBreakerState;
  private readonly circuitBreakerThreshold: number;
  private readonly circuitBreakerTimeout: number;

  constructor(config: ServiceConfig) {
    this.name = config.name;
    this.baseURL = config.baseURL;
    this.timeout = config.timeout || 5000;
    this.retryAttempts = config.retryAttempts || 3;
    this.retryDelay = config.retryDelay || 1000;
    this.circuitBreakerThreshold = config.circuitBreakerThreshold || 5;
    this.circuitBreakerTimeout = config.circuitBreakerTimeout || 60000;

    this.circuitBreaker = {
      failureCount: 0,
      lastFailureTime: null,
      state: 'CLOSED',
    };

    // Create HTTP(S) agents with connection pooling
    // Optimized for homelab with 10-20 users
    const httpAgent = new http.Agent({
      keepAlive: true,
      maxSockets: 10, // Max 10 concurrent connections per host
      maxFreeSockets: 5, // Keep 5 sockets open in free state
      timeout: this.timeout,
      keepAliveMsecs: 1000,
      scheduling: 'fifo', // First-in-first-out scheduling
    });

    const httpsAgent = new https.Agent({
      keepAlive: true,
      maxSockets: 10,
      maxFreeSockets: 5,
      timeout: this.timeout,
      keepAliveMsecs: 1000,
      scheduling: 'fifo',
    });

    this.axios = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      httpAgent,
      httpsAgent,
      // Optimize for JSON responses
      maxContentLength: 10 * 1024 * 1024, // 10MB max response size
      maxBodyLength: 10 * 1024 * 1024, // 10MB max request body
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.axios.interceptors.request.use(
      (config) => {
        logger.debug(`${this.name} API request`, {
          method: config.method,
          url: config.url,
        });
        return config;
      },
      (error) => {
        logger.error(`${this.name} API request error`, { error });
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.axios.interceptors.response.use(
      (response) => {
        logger.debug(`${this.name} API response`, {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error) => {
        logger.error(`${this.name} API response error`, {
          status: error.response?.status,
          url: error.config?.url,
          error: error instanceof Error ? error.message : ('Unknown error' as any),
        });
        return Promise.reject(error);
      }
    );
  }

  protected async executeWithCircuitBreaker<T>(operation: () => Promise<T>): Promise<T> {
    // Check circuit breaker state
    if (this.circuitBreaker.state === 'OPEN') {
      const now = Date.now();
      if (
        this.circuitBreaker.lastFailureTime &&
        now - this.circuitBreaker.lastFailureTime >= this.circuitBreakerTimeout
      ) {
        // Try to recover
        this.circuitBreaker.state = 'HALF_OPEN';
      } else {
        throw new ServiceUnavailableError(`${this.name} service is temporarily unavailable`);
      }
    }

    try {
      const result = await this.executeWithRetry(operation);

      // Reset circuit breaker on success
      if (this.circuitBreaker.state === 'HALF_OPEN') {
        this.circuitBreaker.state = 'CLOSED';
        this.circuitBreaker.failureCount = 0;
        this.circuitBreaker.lastFailureTime = null;
      }

      return result;
    } catch (error: CatchError) {
      this.handleCircuitBreakerFailure();
      throw error;
    }
  }

  private handleCircuitBreakerFailure(): void {
    this.circuitBreaker.failureCount++;
    this.circuitBreaker.lastFailureTime = Date.now();

    if (this.circuitBreaker.failureCount >= this.circuitBreakerThreshold) {
      this.circuitBreaker.state = 'OPEN';
      logger.error(`${this.name} circuit breaker opened`, {
        failureCount: this.circuitBreaker.failureCount,
      });
    }
  }

  protected async executeWithRetry<T>(operation: () => Promise<T>, attempt = 1): Promise<T> {
    try {
      return await operation();
    } catch (error: CatchError) {
      if (attempt >= this.retryAttempts) {
        throw this.mapError(error);
      }

      const isRetryable = this.isRetryableError(error);
      if (!isRetryable) {
        throw this.mapError(error);
      }

      const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
      logger.warn(`${this.name} API retry attempt ${attempt}`, {
        delay,
        error: error instanceof Error ? error.message : ('Unknown error' as any),
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.executeWithRetry(operation, attempt + 1);
    }
  }

  protected isRetryableError(error: any): boolean {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      // Retry on network errors or 5xx errors
      return !status || status >= 500;
    }
    return false;
  }

  protected mapError(error: any): Error {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      const message = error.response?.data?.message || (error.message as any);

      switch (status) {
        case 400:
          return new BadRequestError(message);
        case 401:
        case 403:
          return new Error('Authentication failed');
        case 404:
          return new Error('Resource not found');
        case 429:
          return new Error('Rate limit exceeded');
        default:
          return new ServiceUnavailableError(`${this.name} service error: ${message}`);
      }
    }

    return error;
  }

  protected async request<T>(config: AxiosRequestConfig): Promise<T> {
    return this.executeWithCircuitBreaker(async () => {
      const response = await this.axios.request<T>(config);
      return response.data;
    });
  }
}
