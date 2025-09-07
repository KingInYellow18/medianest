import { UptimeKumaClient } from '../../integrations/uptime-kuma/uptime-kuma-client';
import { logger } from '../../utils/logger';
import { 
  BaseIntegrationClient,
  ClientConfig, 
  HealthStatus,
  ClientInitializer 
} from '../../../shared/src/patterns/integration-client-factory';

export interface UptimeKumaConfig extends ClientConfig {
  url?: string;
  username?: string;
  password?: string;
}

/**
 * Specialized Uptime Kuma integration service
 * Extracted from IntegrationService for better separation of concerns
 */
export class UptimeKumaIntegrationService extends BaseIntegrationClient {
  private client: UptimeKumaClient | null = null;

  constructor(config: UptimeKumaConfig) {
    super('UptimeKuma', config);
  }

  /**
   * Initialize Uptime Kuma integration
   */
  async initialize(): Promise<boolean> {
    if (!this.config.enabled) {
      logger.debug('Uptime Kuma integration disabled');
      return false;
    }

    const kumaConfig = this.config as UptimeKumaConfig;
    
    if (!kumaConfig.url) {
      logger.debug('Uptime Kuma integration disabled or not configured');
      return false;
    }

    try {
      this.client = await ClientInitializer.initializeWithRetry(
        'UptimeKuma',
        async () => {
          const client = UptimeKumaClient.createClient({
            url: kumaConfig.url!,
            username: kumaConfig.username,
            password: kumaConfig.password,
            reconnectInterval: 5000,
            heartbeatInterval: 30000,
            timeout: 10000,
          });

          await client.connect();
          return client;
        },
        3,
        2000
      );

      if (this.client) {
        this.setupEventHandlers();
        logger.info('Uptime Kuma integration initialized successfully');
        return true;
      }
    } catch (error) {
      this.logError('initialization', error as Error);
    }

    return false;
  }

  /**
   * Setup event handlers for Uptime Kuma client
   */
  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('monitorsUpdated', (monitors) => {
      logger.debug('Uptime Kuma monitors updated', { count: monitors.length });
    });

    this.client.on('heartbeat', (heartbeat) => {
      logger.debug('Uptime Kuma heartbeat received', { 
        monitorId: heartbeat.monitorId,
        status: heartbeat.status 
      });
    });

    this.client.on('statsUpdated', (stats) => {
      logger.debug('Uptime Kuma stats updated', stats);
    });

    this.client.on('error', (error) => {
      this.logError('client event', error);
    });

    this.client.on('disconnect', () => {
      logger.warn('Uptime Kuma client disconnected');
    });
  }

  /**
   * Get Uptime Kuma client
   */
  getUptimeKumaClient(): UptimeKumaClient | null {
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
        error: 'Uptime Kuma client not initialized',
      };
    }

    try {
      const isHealthy = this.client.isHealthy();
      const responseTime = Date.now() - startTime;
      
      if (isHealthy) {
        this.logSuccess('health check', responseTime);
      }
      
      return {
        healthy: isHealthy,
        lastChecked: new Date(),
        responseTime,
        ...(isHealthy ? {} : { error: 'Client reports unhealthy state' }),
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
      logger.info('Uptime Kuma circuit breaker reset');
    }
  }

  /**
   * Get monitors data
   */
  getMonitors(): Map<string, any> {
    if (!this.client) {
      return new Map();
    }
    return this.client.getMonitors();
  }

  /**
   * Get statistics data
   */
  getStats(): any {
    if (!this.client) {
      return null;
    }
    return this.client.getStats();
  }

  /**
   * Get latest heartbeats
   */
  getLatestHeartbeats(): Map<string, any> {
    if (!this.client) {
      return new Map();
    }
    return this.client.getLatestHeartbeats();
  }

  /**
   * Shutdown service
   */
  shutdown(): void {
    if (this.client) {
      this.client.disconnect();
    }
    this.client = null;
    logger.info('Uptime Kuma integration service shutdown');
  }
}
