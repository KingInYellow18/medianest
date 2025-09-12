import { logger } from '../utils/logger';

export interface ClientConfig {
  enabled: boolean;
  url?: string;
  apiKey?: string;
  token?: string;
  username?: string;
  password?: string;
  serverUrl?: string;
  timeout?: number;
  retries?: number;
}

export interface ServiceClient {
  healthCheck?(): Promise<HealthStatus>;
  isHealthy?(): boolean;
  getCircuitBreakerStats?(): { state: string };
  resetCircuitBreaker?(): void;
}

export interface HealthStatus {
  healthy: boolean;
  lastChecked: Date;
  responseTime?: number;
  error?: string;
}

export abstract class BaseIntegrationClient implements ServiceClient {
  protected config: ClientConfig;
  protected name: string;

  constructor(name: string, config: ClientConfig) {
    this.name = name;
    this.config = config;
  }

  abstract healthCheck(): Promise<HealthStatus>;

  protected logError(operation: string, error: Error): void {
    logger.error(`${this.name} ${operation} failed`, {
      service: this.name,
      error: error.message,
      stack: error.stack,
    });
  }

  protected logSuccess(operation: string, responseTime?: number): void {
    logger.debug(`${this.name} ${operation} successful`, {
      service: this.name,
      responseTime,
    });
  }
}

/**
 * Factory for creating integration clients
 */
export class IntegrationClientFactory {
  private static clientCache = new Map<string, ServiceClient>();

  /**
   * Create or get cached client instance
   */
  static async getClient<T extends ServiceClient>(
    serviceName: string,
    config: ClientConfig,
    createFn: (config: ClientConfig) => Promise<T>,
  ): Promise<T | null> {
    const cacheKey = `${serviceName}-${JSON.stringify(config)}`;

    // Return cached instance if available and config matches
    if (this.clientCache.has(cacheKey)) {
      return this.clientCache.get(cacheKey) as T;
    }

    if (!config.enabled) {
      logger.debug(`${serviceName} integration disabled`);
      return null;
    }

    try {
      const client = await createFn(config);
      this.clientCache.set(cacheKey, client);
      logger.info(`${serviceName} client created successfully`);
      return client;
    } catch (error) {
      logger.error(`Failed to create ${serviceName} client`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Clear client cache
   */
  static clearCache(): void {
    this.clientCache.clear();
  }

  /**
   * Remove specific client from cache
   */
  static removeClient(serviceName: string): void {
    for (const [key] of this.clientCache.entries()) {
      if (key.startsWith(serviceName)) {
        this.clientCache.delete(key);
      }
    }
  }
}

/**
 * Common client initialization patterns
 */
export class ClientInitializer {
  /**
   * Initialize client with retry logic
   */
  static async initializeWithRetry<T>(
    serviceName: string,
    initFn: () => Promise<T>,
    maxRetries: number = 3,
    retryDelay: number = 1000,
  ): Promise<T | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await initFn();
        logger.info(`${serviceName} initialized on attempt ${attempt}`);
        return result;
      } catch (error) {
        logger.warn(`${serviceName} initialization attempt ${attempt} failed`, {
          error: error instanceof Error ? error.message : String(error),
          attemptsRemaining: maxRetries - attempt,
        });

        if (attempt === maxRetries) {
          logger.error(`${serviceName} initialization failed after ${maxRetries} attempts`);
          return null;
        }

        await this.delay(retryDelay * attempt); // Exponential backoff
      }
    }

    return null;
  }

  /**
   * Delay utility for retry logic
   */
  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
