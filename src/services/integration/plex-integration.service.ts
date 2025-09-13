// Internal dependencies
import { BaseIntegrationClient, ClientConfig, HealthStatus, ClientInitializer } from '@medianest/shared';

import { PlexApiClient } from '../../integrations/plex/plex-api.client';
import { logger } from '../../utils/logger';

// Shared utilities (using barrel exports)

export interface PlexConfig extends ClientConfig {
  serverUrl?: string;
  defaultToken?: string;
}

/**
 * Specialized Plex integration service
 * Extracted from IntegrationService for better separation of concerns
 */
export class PlexIntegrationService extends BaseIntegrationClient {
  private client: PlexApiClient | null = null;
  private userClients: Map<string, PlexApiClient> = new Map();

  constructor(config: PlexConfig) {
    super('Plex', config);
  }

  /**
   * Initialize Plex integration
   */
  async initialize(): Promise<boolean> {
    if (!this.config.enabled) {
      logger.debug('Plex integration disabled');
      return false;
    }

    const plexConfig = this.config as PlexConfig;

    if (!plexConfig.defaultToken) {
      logger.warn('Plex default token not configured');
      return false;
    }

    try {
      this.client = await ClientInitializer.initializeWithRetry(
        'Plex',
        async () => {
          return await PlexApiClient.createFromUserToken(plexConfig.defaultToken!, plexConfig.serverUrl);
        },
        3,
        2000
      );

      if (this.client) {
        logger.info('Plex integration initialized successfully');
        return true;
      }
    } catch (error) {
      this.logError('initialization', error as Error);
    }

    return false;
  }

  /**
   * Get Plex client for user (creates user-specific client or returns default)
   */
  async getPlexClient(userToken?: string): Promise<PlexApiClient | null> {
    if (userToken) {
      // Check if we have a cached client for this token
      const cachedClient = this.userClients.get(userToken);
      if (cachedClient) {
        return cachedClient;
      }

      // Create user-specific client
      try {
        const userClient = await PlexApiClient.createFromUserToken(userToken);
        this.userClients.set(userToken, userClient);
        return userClient;
      } catch (error) {
        this.logError('user client creation', error as Error);
        return null;
      }
    }

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
        error: 'Plex client not initialized',
      };
    }

    try {
      // Perform basic health check by getting user info
      await this.client.getUser();

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
      logger.info('Plex circuit breaker reset');
    }
  }

  /**
   * Clean up user clients cache
   */
  clearUserClientsCache(): void {
    this.userClients.clear();
    logger.debug('Plex user clients cache cleared');
  }

  /**
   * Remove specific user client from cache
   */
  removeUserClient(userToken: string): void {
    this.userClients.delete(userToken);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { userClients: number } {
    return {
      userClients: this.userClients.size,
    };
  }

  /**
   * Shutdown service
   */
  shutdown(): void {
    this.client = null;
    this.userClients.clear();
    logger.info('Plex integration service shutdown');
  }
}
