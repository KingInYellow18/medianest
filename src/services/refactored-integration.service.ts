// External dependencies
import { EventEmitter } from 'events';

// Shared utilities (using barrel exports)
import {
  HealthCheckManager,
  ServiceHealthStatus,
  IntegrationClientFactory,
  ServiceClient,
} from '@medianest/shared';

// Internal dependencies
import { OverseerrApiClient } from '../integrations/overseerr/overseerr-api.client';
import { PlexApiClient } from '../integrations/plex/plex-api.client';
import { UptimeKumaClient } from '../integrations/uptime-kuma/uptime-kuma-client';
import { logger } from '../utils/logger';

// Service integration imports
import {
  OverseerrIntegrationService,
  OverseerrConfig,
} from './integration/overseerr-integration.service';
import { PlexIntegrationService, PlexConfig } from './integration/plex-integration.service';
import {
  UptimeKumaIntegrationService,
  UptimeKumaConfig,
} from './integration/uptime-kuma-integration.service';

export interface ServiceIntegrationConfig {
  plex?: PlexConfig;
  overseerr?: OverseerrConfig;
  uptimeKuma?: UptimeKumaConfig;
  healthCheckInterval?: number;
}

/**
 * Refactored Integration Service with improved separation of concerns
 * Reduced from 377 lines to focused orchestration layer
 * Delegates specific service logic to specialized service classes
 */
export class RefactoredIntegrationService extends EventEmitter {
  private healthManager: HealthCheckManager;
  private plexService: PlexIntegrationService | null = null;
  private overseerrService: OverseerrIntegrationService | null = null;
  private uptimeKumaService: UptimeKumaIntegrationService | null = null;
  private services: Map<string, ServiceClient> = new Map();

  constructor(private config: ServiceIntegrationConfig = {}) {
    super();
    this.healthManager = new HealthCheckManager(config.healthCheckInterval || 2 * 60 * 1000);
    this.setupHealthManagerEvents();
  }

  /**
   * Setup health manager event forwarding
   */
  private setupHealthManagerEvents(): void {
    this.healthManager.on('serviceHealthChanged', (status: ServiceHealthStatus) => {
      this.emit('serviceHealthChanged', status);
    });
  }

  /**
   * Initialize all configured services
   */
  async initialize(): Promise<void> {
    logger.info('Initializing refactored service integrations');

    try {
      const initPromises = [
        this.initializePlexIntegration(),
        this.initializeOverseerrIntegration(),
        this.initializeUptimeKumaIntegration(),
      ];

      await Promise.allSettled(initPromises);

      // Start health monitoring for all initialized services
      this.healthManager.startHealthChecks();

      const enabledServices = Array.from(this.services.keys());
      logger.info('Service integrations initialized successfully', {
        enabledServices,
        totalServices: enabledServices.length,
      });
    } catch (error) {
      logger.error('Failed to initialize service integrations', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Initialize Plex integration using specialized service
   */
  private async initializePlexIntegration(): Promise<void> {
    if (!this.config.plex) {
      return;
    }

    try {
      this.plexService = new PlexIntegrationService(this.config.plex);
      const initialized = await this.plexService.initialize();

      if (initialized) {
        this.services.set('plex', this.plexService);
        this.healthManager.registerClient('plex', this.plexService);
        logger.info('Plex integration registered with health monitoring');
      }
    } catch (error) {
      logger.error('Failed to initialize Plex integration', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Initialize Overseerr integration using specialized service
   */
  private async initializeOverseerrIntegration(): Promise<void> {
    if (!this.config.overseerr) {
      return;
    }

    try {
      this.overseerrService = new OverseerrIntegrationService(this.config.overseerr);
      const initialized = await this.overseerrService.initialize();

      if (initialized) {
        this.services.set('overseerr', this.overseerrService);
        this.healthManager.registerClient('overseerr', this.overseerrService);
        logger.info('Overseerr integration registered with health monitoring');
      }
    } catch (error) {
      logger.error('Failed to initialize Overseerr integration', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Initialize Uptime Kuma integration using specialized service
   */
  private async initializeUptimeKumaIntegration(): Promise<void> {
    if (!this.config.uptimeKuma) {
      return;
    }

    try {
      this.uptimeKumaService = new UptimeKumaIntegrationService(this.config.uptimeKuma);
      const initialized = await this.uptimeKumaService.initialize();

      if (initialized) {
        this.services.set('uptimeKuma', this.uptimeKumaService);
        this.healthManager.registerClient('uptimeKuma', this.uptimeKumaService);

        // Forward Uptime Kuma specific events
        this.forwardUptimeKumaEvents();
        logger.info('Uptime Kuma integration registered with health monitoring');
      }
    } catch (error) {
      logger.error('Failed to initialize Uptime Kuma integration', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Forward Uptime Kuma specific events
   */
  private forwardUptimeKumaEvents(): void {
    if (!this.uptimeKumaService) return;

    const client = this.uptimeKumaService.getUptimeKumaClient();
    if (!client) return;

    client.on('monitorsUpdated', (monitors) => {
      this.emit('uptimeKumaMonitorsUpdated', monitors);
    });

    client.on('heartbeat', (heartbeat) => {
      this.emit('uptimeKumaHeartbeat', heartbeat);
    });

    client.on('statsUpdated', (stats) => {
      this.emit('uptimeKumaStatsUpdated', stats);
    });
  }

  // Service Access Methods (Delegated to specialized services)

  /**
   * Get Plex client (delegated to specialized service)
   */
  async getPlexClient(userToken?: string): Promise<PlexApiClient | null> {
    if (!this.plexService) {
      return null;
    }
    return await this.plexService.getPlexClient(userToken);
  }

  /**
   * Get Overseerr client (delegated to specialized service)
   */
  getOverseerrClient(): OverseerrApiClient | null {
    if (!this.overseerrService) {
      return null;
    }
    return this.overseerrService.getOverseerrClient();
  }

  /**
   * Get Uptime Kuma client (delegated to specialized service)
   */
  getUptimeKumaClient(): UptimeKumaClient | null {
    if (!this.uptimeKumaService) {
      return null;
    }
    return this.uptimeKumaService.getUptimeKumaClient();
  }

  // Health and Status Methods (Delegated to health manager)

  /**
   * Get service health status (delegated to health manager)
   */
  getServiceHealth(serviceName: string): ServiceHealthStatus | null {
    return this.healthManager.getServiceHealth(serviceName);
  }

  /**
   * Get all service health statuses (delegated to health manager)
   */
  getAllServiceHealth(): ServiceHealthStatus[] {
    return this.healthManager.getAllServiceHealth();
  }

  /**
   * Get cached service status (delegated to health manager)
   */
  async getCachedServiceStatus(serviceName: string): Promise<ServiceHealthStatus | null> {
    return await this.healthManager.getCachedServiceStatus(serviceName);
  }

  /**
   * Get overall system health (delegated to health manager)
   */
  getOverallSystemHealth(): {
    healthy: boolean;
    totalServices: number;
    healthyServices: number;
    services: ServiceHealthStatus[];
  } {
    return this.healthManager.getOverallSystemHealth();
  }

  // Management Methods

  /**
   * Reset all circuit breakers
   */
  async resetCircuitBreakers(): Promise<void> {
    for (const [serviceName, service] of this.services.entries()) {
      if (service.resetCircuitBreaker) {
        service.resetCircuitBreaker();
        logger.info(`Circuit breaker reset for ${serviceName}`);
      }
    }
  }

  /**
   * Reset specific service circuit breaker
   */
  async resetServiceCircuitBreaker(serviceName: string): Promise<boolean> {
    const service = this.services.get(serviceName);
    if (service?.resetCircuitBreaker) {
      service.resetCircuitBreaker();
      logger.info(`Circuit breaker reset for ${serviceName}`);
      return true;
    }
    return false;
  }

  /**
   * Refresh service configuration
   */
  async refreshServiceConfiguration(): Promise<void> {
    logger.info('Refreshing service configurations');

    // Clear client caches
    IntegrationClientFactory.clearCache();

    if (this.plexService) {
      this.plexService.clearUserClientsCache();
    }

    // Trigger health checks to validate configurations
    // Health manager will automatically perform checks
  }

  /**
   * Get service statistics and performance metrics
   */
  getServiceStatistics(): {
    totalServices: number;
    healthyServices: number;
    plexStats?: { userClients: number };
    cacheStats: any;
  } {
    const health = this.getOverallSystemHealth();

    return {
      totalServices: health.totalServices,
      healthyServices: health.healthyServices,
      plexStats: this.plexService?.getCacheStats(),
      cacheStats: {
        // Additional cache statistics can be added here
      },
    };
  }

  /**
   * Shutdown all services and cleanup resources
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down refactored integration service');

    // Stop health monitoring
    this.healthManager.shutdown();

    // Shutdown specialized services
    if (this.plexService) {
      this.plexService.shutdown();
    }

    if (this.overseerrService) {
      this.overseerrService.shutdown();
    }

    if (this.uptimeKumaService) {
      this.uptimeKumaService.shutdown();
    }

    // Clear service registry
    this.services.clear();

    // Clear factory cache
    IntegrationClientFactory.clearCache();

    // Remove all event listeners
    this.removeAllListeners();

    logger.info('Refactored integration service shutdown complete');
  }
}
