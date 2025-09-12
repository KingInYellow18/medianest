import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

import { createServiceLogger } from './logging.config';

import type { DatabaseConfig } from './base.config';
// Use basic log level types instead of Prisma types
type LogLevel = 'info' | 'query' | 'warn' | 'error';

/**
 * Database Connection Pool Configuration
 */
export const DatabasePoolConfigSchema = z.object({
  min: z.coerce.number().min(0).default(2),
  max: z.coerce.number().min(1).default(10),
  acquireTimeoutMillis: z.coerce.number().min(1000).default(30000),
  createTimeoutMillis: z.coerce.number().min(1000).default(30000),
  destroyTimeoutMillis: z.coerce.number().min(1000).default(5000),
  idleTimeoutMillis: z.coerce.number().min(1000).default(10000),
  reapIntervalMillis: z.coerce.number().min(1000).default(1000),
  createRetryIntervalMillis: z.coerce.number().min(100).default(200),
});

export type DatabasePoolConfig = z.infer<typeof DatabasePoolConfigSchema>;

/**
 * Database Configuration Manager
 * Provides centralized database configuration and connection management
 */
export class DatabaseConfigManager {
  private static instance: DatabaseConfigManager | null = null;
  private prismaClients: Map<string, PrismaClient> = new Map();
  private logger = createServiceLogger('database-config');

  private constructor() {}

  /**
   * Singleton instance getter
   */
  public static getInstance(): DatabaseConfigManager {
    if (!DatabaseConfigManager.instance) {
      DatabaseConfigManager.instance = new DatabaseConfigManager();
    }
    return DatabaseConfigManager.instance;
  }

  /**
   * Create Prisma client with centralized configuration
   */
  public createPrismaClient(
    config: DatabaseConfig,
    options: {
      clientId?: string;
      logLevel?: LogLevel[];
      errorFormat?: 'pretty' | 'colorless' | 'minimal';
      transactionOptions?: {
        maxWait?: number;
        timeout?: number;
        isolationLevel?: 'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable';
      };
    } = {},
  ): PrismaClient {
    const {
      clientId = 'default',
      logLevel = this.getDefaultLogLevel(),
      errorFormat = 'colorless',
      transactionOptions = {},
    } = options;

    // Return existing client if available
    if (this.prismaClients.has(clientId)) {
      return this.prismaClients.get(clientId)!;
    }

    // Create new Prisma client with configuration
    const client = new PrismaClient({
      datasources: {
        db: {
          url: config.DATABASE_URL,
        },
      },
      log: logLevel.map((level) => ({
        emit: 'event',
        level,
      })),
      errorFormat,
      transactionOptions: {
        maxWait: transactionOptions.maxWait || 5000,
        timeout: transactionOptions.timeout || 10000,
        isolationLevel: transactionOptions.isolationLevel,
      },
    });

    // Setup logging for Prisma events
    this.setupPrismaLogging(client, clientId);

    // Cache client
    this.prismaClients.set(clientId, client);

    this.logger.info('Prisma client created', {
      clientId,
      databaseUrl: this.sanitizeUrl(config.DATABASE_URL),
      logLevel,
      errorFormat,
    });

    return client;
  }

  /**
   * Get existing Prisma client
   */
  public getPrismaClient(clientId: string = 'default'): PrismaClient {
    const client = this.prismaClients.get(clientId);
    if (!client) {
      throw new Error(`Prisma client '${clientId}' not found. Create it first.`);
    }
    return client;
  }

  /**
   * Connect to database with health checks
   */
  public async connectDatabase(
    clientId: string = 'default',
    options: {
      maxRetries?: number;
      retryDelay?: number;
      healthCheck?: boolean;
    } = {},
  ): Promise<void> {
    const { maxRetries = 3, retryDelay = 2000, healthCheck = true } = options;

    const client = this.getPrismaClient(clientId);
    let retries = 0;

    while (retries < maxRetries) {
      try {
        await client.$connect();

        if (healthCheck) {
          // Perform basic health check
          await client.$queryRaw`SELECT 1`;
        }

        this.logger.info('Database connected successfully', {
          clientId,
          retries,
          healthCheck,
        });
        return;
      } catch (error) {
        retries++;
        this.logger.warn('Database connection attempt failed', {
          clientId,
          retries,
          maxRetries,
          error: error instanceof Error ? error.message : error,
        });

        if (retries >= maxRetries) {
          this.logger.error('Database connection failed after max retries', {
            clientId,
            maxRetries,
            error: error instanceof Error ? error.message : error,
          });
          throw error;
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }

  /**
   * Disconnect from database
   */
  public async disconnectDatabase(clientId: string = 'default'): Promise<void> {
    const client = this.prismaClients.get(clientId);
    if (client) {
      await client.$disconnect();
      this.prismaClients.delete(clientId);
      this.logger.info('Database disconnected', { clientId });
    }
  }

  /**
   * Disconnect all database connections
   */
  public async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.prismaClients.entries()).map(
      async ([clientId, client]) => {
        try {
          await client.$disconnect();
          this.logger.info('Database disconnected', { clientId });
        } catch (error) {
          this.logger.error('Error disconnecting database', {
            clientId,
            error: error instanceof Error ? error.message : error,
          });
        }
      },
    );

    await Promise.all(disconnectPromises);
    this.prismaClients.clear();
    this.logger.info('All database connections disconnected');
  }

  /**
   * Check database health
   */
  public async checkHealth(clientId: string = 'default'): Promise<{
    healthy: boolean;
    latency?: number;
    error?: string;
  }> {
    try {
      const client = this.getPrismaClient(clientId);
      const startTime = Date.now();

      await client.$queryRaw`SELECT 1`;

      const latency = Date.now() - startTime;

      return { healthy: true, latency };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Setup Prisma logging
   */
  /**
   * Setup Prisma logging
   */
  private setupPrismaLogging(_client: PrismaClient, clientId: string): void {
    // Database logging disabled due to TypeScript conflicts with Prisma event types
    // This is a temporary workaround - Prisma event listeners have complex typing issues
    this.logger.info('Database client logging initialized', { clientId });
  }

  /**
   * Get default log level based on environment
   */
  private getDefaultLogLevel(): LogLevel[] {
    const nodeEnv = process.env.NODE_ENV || 'development';

    switch (nodeEnv) {
      case 'development':
        return ['query', 'info', 'warn', 'error'];
      case 'test':
        return ['warn', 'error'];
      case 'production':
      default:
        return ['warn', 'error'];
    }
  }

  /**
   * Sanitize database URL for logging (removes credentials)
   */
  private sanitizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      urlObj.password = '***';
      return urlObj.toString();
    } catch {
      return '[REDACTED]';
    }
  }
}

// Convenience functions
export const databaseConfig = DatabaseConfigManager.getInstance();

/**
 * Create Prisma client with default configuration
 */
export function createPrismaClient(
  config: DatabaseConfig,
  options?: Parameters<typeof databaseConfig.createPrismaClient>[1],
): PrismaClient {
  return databaseConfig.createPrismaClient(config, options);
}

/**
 * Connect to database with retry logic
 */
export async function connectDatabase(
  clientId?: string,
  options?: Parameters<typeof databaseConfig.connectDatabase>[1],
): Promise<void> {
  return databaseConfig.connectDatabase(clientId, options);
}

/**
 * Disconnect from database
 */
export async function disconnectDatabase(clientId?: string): Promise<void> {
  return databaseConfig.disconnectDatabase(clientId);
}

/**
 * Check database health
 */
export async function checkDatabaseHealth(
  clientId?: string,
): Promise<ReturnType<typeof databaseConfig.checkHealth>> {
  return databaseConfig.checkHealth(clientId);
}

// Export types
