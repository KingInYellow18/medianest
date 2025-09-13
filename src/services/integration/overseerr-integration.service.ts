// Internal dependencies
import { BaseIntegrationClient, ClientConfig, HealthStatus, ClientInitializer } from '@medianest/shared';

import { OverseerrApiClient } from '../../integrations/overseerr/overseerr-api.client';
import { logger } from '../../utils/logger';

// Shared utilities (using barrel exports)

export interface OverseerrConfig extends ClientConfig {
  url?: string;
  apiKey?: string;
}

/**
 * Specialized Overseerr integration service
 * Extracted from IntegrationService for better separation of concerns
 */
export class OverseerrIntegrationService extends BaseIntegrationClient {
  private client: OverseerrApiClient | null = null;

  constructor(config: OverseerrConfig) {
    super('Overseerr', config);
  }

  /**
   * Initialize Overseerr integration
   */
  async initialize(): Promise<boolean> {
    if (!this.config.enabled) {
      logger.debug('Overseerr integration disabled');
      return false;
    }

    const overseerrConfig = this.config as OverseerrConfig;

    if (!overseerrConfig.url || !overseerrConfig.apiKey) {
      logger.debug('Overseerr integration disabled or not configured');
      return false;
    }

    try {
      this.client = await ClientInitializer.initializeWithRetry(
        'Overseerr',
        async () => {
          return await OverseerrApiClient.createFromConfig(overseerrConfig.url!, overseerrConfig.apiKey!);
        },
        3,
        2000
      );

      if (this.client) {
        logger.info('Overseerr integration initialized successfully');
        return true;
      }
    } catch (error) {
      this.logError('initialization', error as Error);
    }

    return false;
  }

  /**
   * Get Overseerr client
   */
  getOverseerrClient(): OverseerrApiClient | null {
    return this.client;
  }

  /**
   * Health check implementation
   */
  async healthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();

    if (!this.client) {
      return {
        healthy: false,
        lastChecked: new Date(),
        error: 'Overseerr client not initialized',
      };
    }

    try {
      // Perform health check by getting status
      await this.client.getStatus();

      const responseTime = Date.now() - startTime;
      this.logSuccess('health check', responseTime);

      return {
        healthy: true,
        lastChecked: new Date(),
        responseTime,
      };
    } catch (error) {
      this.logError('health check', error as Error);

      return {
        healthy: false,
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Get circuit breaker statistics
   */
  getCircuitBreakerStats(): { state: string } {
    if (this.client?.getCircuitBreakerStats) {
      return this.client.getCircuitBreakerStats();
    }
    return { state: 'UNKNOWN' };
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(): void {
    if (this.client?.resetCircuitBreaker) {
      this.client.resetCircuitBreaker();
      logger.info('Overseerr circuit breaker reset');
    }
  }

  /**
   * Shutdown service
   */
  shutdown(): void {
    this.client = null;
    logger.info('Overseerr integration service shutdown');
  }
}
