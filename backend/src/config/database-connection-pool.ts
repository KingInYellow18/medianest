/**
 * Production-Ready Database Connection Pool Manager
 * Replaces singleton pattern with proper connection pooling
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../utils/logger';
import { env } from './env';
import { CatchError } from '../types/common';

// Connection pool configuration
interface DatabasePoolConfig {
  maxConnections: number;
  idleTimeout: number;
  connectionTimeout: number;
  statementTimeout: number;
  queryTimeout: number;
  retryAttempts: number;
  retryDelay: number;
}

// Production-optimized configuration
const PRODUCTION_CONFIG: DatabasePoolConfig = {
  maxConnections: 20,
  idleTimeout: 30000, // 30 seconds
  connectionTimeout: 10000, // 10 seconds
  statementTimeout: 30000, // 30 seconds
  queryTimeout: 15000, // 15 seconds
  retryAttempts: 3,
  retryDelay: 1000, // 1 second
};

// Development configuration (more relaxed)
const DEVELOPMENT_CONFIG: DatabasePoolConfig = {
  maxConnections: 10,
  idleTimeout: 60000, // 1 minute
  connectionTimeout: 15000, // 15 seconds
  statementTimeout: 60000, // 1 minute
  queryTimeout: 30000, // 30 seconds
  retryAttempts: 2,
  retryDelay: 500, // 0.5 seconds
};

class DatabaseConnectionPool {
  private static instance: DatabaseConnectionPool;
  private prismaPool: PrismaClient[];
  private readyClients: PrismaClient[];
  private busyClients: Set<PrismaClient>;
  private config: DatabasePoolConfig;
  private isInitialized: boolean = false;
  private connectionStats: {
    totalConnections: number;
    activeConnections: number;
    poolHits: number;
    poolMisses: number;
    totalQueries: number;
    slowQueries: number;
    errors: number;
  };

  private constructor() {
    this.config = env.NODE_ENV === 'production' ? PRODUCTION_CONFIG : DEVELOPMENT_CONFIG;
    this.prismaPool = [];
    this.readyClients = [];
    this.busyClients = new Set();
    this.connectionStats = {
      totalConnections: 0,
      activeConnections: 0,
      poolHits: 0,
      poolMisses: 0,
      totalQueries: 0,
      slowQueries: 0,
      errors: 0,
    };
  }

  static getInstance(): DatabaseConnectionPool {
    if (!DatabaseConnectionPool.instance) {
      DatabaseConnectionPool.instance = new DatabaseConnectionPool();
    }
    return DatabaseConnectionPool.instance;
  }

  /**
   * Initialize connection pool with optimized settings
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Database connection pool already initialized');
      return;
    }

    try {
      const startTime = Date.now();
      logger.info('Initializing database connection pool', {
        maxConnections: this.config.maxConnections,
        environment: env.NODE_ENV,
      });

      // Create initial pool of connections
      const connectionPromises = Array.from({ length: Math.min(5, this.config.maxConnections) }, () =>
        this.createConnection()
      );

      const initialConnections = await Promise.allSettled(connectionPromises);
      let successfulConnections = 0;

      initialConnections.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          this.readyClients.push(result.value);
          successfulConnections++;
        } else {
          logger.error(`Failed to create initial connection ${index + 1}`, {
            error: result.reason,
          });
        }
      });

      if (successfulConnections === 0) {
        throw new Error('Failed to create any database connections');
      }

      this.connectionStats.totalConnections = successfulConnections;
      this.isInitialized = true;

      const initTime = Date.now() - startTime;
      logger.info('Database connection pool initialized successfully', {
        initialConnections: successfulConnections,
        initializationTime: `${initTime}ms`,
        maxPoolSize: this.config.maxConnections,
      });

      // Start connection health monitoring
      this.startHealthMonitoring();
    } catch (error: CatchError) {
      logger.error('Failed to initialize database connection pool', { error });
      throw error;
    }
  }

  /**
   * Get connection from pool with automatic retry
   */
  async getConnection(): Promise<PrismaClient> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    let attempts = 0;
    while (attempts < this.config.retryAttempts) {
      try {
        // Try to get existing connection from pool
        if (this.readyClients.length > 0) {
          const client = this.readyClients.pop()!;
          this.busyClients.add(client);
          this.connectionStats.poolHits++;
          this.connectionStats.activeConnections++;
          return client;
        }

        // Create new connection if pool not at capacity
        if (this.prismaPool.length < this.config.maxConnections) {
          const client = await this.createConnection();
          this.busyClients.add(client);
          this.connectionStats.poolMisses++;
          this.connectionStats.activeConnections++;
          return client;
        }

        // Wait for connection to become available
        await new Promise((resolve) => setTimeout(resolve, 100));
        attempts++;
      } catch (error: CatchError) {
        attempts++;
        if (attempts >= this.config.retryAttempts) {
          this.connectionStats.errors++;
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay));
      }
    }

    throw new Error('Failed to acquire database connection after maximum retry attempts');
  }

  /**
   * Release connection back to pool
   */
  async releaseConnection(client: PrismaClient): Promise<void> {
    if (this.busyClients.has(client)) {
      this.busyClients.delete(client);
      
      // Health check before returning to pool
      try {
        await client.$queryRaw`SELECT 1`;
        this.readyClients.push(client);
        this.connectionStats.activeConnections--;
      } catch (error: CatchError) {
        logger.warn('Connection failed health check, removing from pool', { error });
        await this.removeConnection(client);
      }
    }
  }

  /**
   * Execute query with automatic connection management
   */
  async executeQuery<T>(
    queryFn: (client: PrismaClient) => Promise<T>,
    operation: string = 'query'
  ): Promise<T> {
    const startTime = Date.now();
    let client: PrismaClient | null = null;

    try {
      client = await this.getConnection();
      this.connectionStats.totalQueries++;
      
      const result = await queryFn(client);
      
      const duration = Date.now() - startTime;
      if (duration > 1000) {
        this.connectionStats.slowQueries++;
        logger.warn('Slow query detected', {
          operation,
          duration: `${duration}ms`,
        });
      }

      return result;
    } catch (error: CatchError) {
      this.connectionStats.errors++;
      logger.error('Database query failed', {
        operation,
        duration: `${Date.now() - startTime}ms`,
        error,
      });
      throw error;
    } finally {
      if (client) {
        await this.releaseConnection(client);
      }
    }
  }

  /**
   * Execute transaction with automatic connection management
   */
  async executeTransaction<T>(
    transactionFn: (client: PrismaClient) => Promise<T>,
    operation: string = 'transaction'
  ): Promise<T> {
    const startTime = Date.now();
    let client: PrismaClient | null = null;

    try {
      client = await this.getConnection();
      this.connectionStats.totalQueries++;
      
      const result = await client.$transaction(async (tx) => {
        return await transactionFn(tx as PrismaClient);
      });
      
      const duration = Date.now() - startTime;
      if (duration > 2000) {
        this.connectionStats.slowQueries++;
        logger.warn('Slow transaction detected', {
          operation,
          duration: `${duration}ms`,
        });
      }

      return result;
    } catch (error: CatchError) {
      this.connectionStats.errors++;
      logger.error('Database transaction failed', {
        operation,
        duration: `${Date.now() - startTime}ms`,
        error,
      });
      throw error;
    } finally {
      if (client) {
        await this.releaseConnection(client);
      }
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      ...this.connectionStats,
      availableConnections: this.readyClients.length,
      totalPoolSize: this.prismaPool.length,
      maxPoolSize: this.config.maxConnections,
      poolUtilization: (this.connectionStats.activeConnections / this.config.maxConnections) * 100,
      hitRatio: this.connectionStats.poolHits / (this.connectionStats.poolHits + this.connectionStats.poolMisses) * 100,
    };
  }

  /**
   * Create optimized Prisma client connection
   */
  private async createConnection(): Promise<PrismaClient> {
    const connectionString = this.buildConnectionString();
    
    const client = new PrismaClient({
      datasources: {
        db: {
          url: connectionString,
        },
      },
      log: env.NODE_ENV === 'development' ? [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ] : [
        { emit: 'event', level: 'error' },
      ],
    });

    // Set up query logging and monitoring
    this.setupClientMonitoring(client);

    // Connect with timeout
    await Promise.race([
      client.$connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), this.config.connectionTimeout)
      ),
    ]);

    // Verify connection with health check
    await client.$queryRaw`SELECT 1 as health_check`;

    this.prismaPool.push(client);
    return client;
  }

  /**
   * Build optimized connection string with pool parameters
   */
  private buildConnectionString(): string {
    const baseUrl = env.DATABASE_URL;
    if (!baseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    const url = new URL(baseUrl);
    
    // Production-optimized PostgreSQL settings
    url.searchParams.set('connection_limit', this.config.maxConnections.toString());
    url.searchParams.set('pool_timeout', '10');
    url.searchParams.set('connect_timeout', (this.config.connectionTimeout / 1000).toString());
    url.searchParams.set('statement_timeout', this.config.statementTimeout.toString());
    url.searchParams.set('idle_in_transaction_session_timeout', this.config.idleTimeout.toString());
    
    // Performance optimizations
    url.searchParams.set('application_name', 'medianest-backend');
    url.searchParams.set('search_path', 'public');
    
    return url.toString();
  }

  /**
   * Set up client monitoring and logging
   */
  private setupClientMonitoring(client: PrismaClient): void {
    if (env.NODE_ENV === 'development') {
      (client.$on as any)('query', (e: Prisma.QueryEvent) => {
        if (e.duration > 100) {
          logger.debug('Query executed', {
            query: e.query.slice(0, 200) + (e.query.length > 200 ? '...' : ''),
            duration: `${e.duration}ms`,
          });
        }
      });
    }

    (client.$on as any)('error', (e: Prisma.LogEvent) => {
      logger.error('Prisma client error', {
        message: e.message,
        target: e.target,
      });
      this.connectionStats.errors++;
    });
  }

  /**
   * Remove unhealthy connection from pool
   */
  private async removeConnection(client: PrismaClient): Promise<void> {
    try {
      await client.$disconnect();
    } catch (error) {
      logger.warn('Error disconnecting client', { error });
    }

    const index = this.prismaPool.indexOf(client);
    if (index > -1) {
      this.prismaPool.splice(index, 1);
      this.connectionStats.totalConnections--;
    }

    this.busyClients.delete(client);
  }

  /**
   * Start health monitoring for connections
   */
  private startHealthMonitoring(): void {
    setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Check every 30 seconds

    // Log stats every 5 minutes
    setInterval(() => {
      const stats = this.getStats();
      logger.info('Database pool statistics', stats);
    }, 300000);
  }

  /**
   * Perform health check on idle connections
   */
  private async performHealthCheck(): Promise<void> {
    const unhealthyConnections: PrismaClient[] = [];

    for (const client of this.readyClients) {
      try {
        await Promise.race([
          client.$queryRaw`SELECT 1`,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Health check timeout')), 5000))
        ]);
      } catch (error) {
        unhealthyConnections.push(client);
        logger.warn('Unhealthy connection detected during health check', { error });
      }
    }

    // Remove unhealthy connections
    for (const client of unhealthyConnections) {
      const index = this.readyClients.indexOf(client);
      if (index > -1) {
        this.readyClients.splice(index, 1);
      }
      await this.removeConnection(client);
    }

    // Maintain minimum pool size
    const minPoolSize = Math.min(5, this.config.maxConnections);
    if (this.readyClients.length < minPoolSize) {
      try {
        const newClient = await this.createConnection();
        this.readyClients.push(newClient);
        logger.info('Added new connection to maintain minimum pool size');
      } catch (error) {
        logger.error('Failed to create replacement connection', { error });
      }
    }
  }

  /**
   * Graceful shutdown of connection pool
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down database connection pool...');

    // Disconnect all connections
    const disconnectPromises = this.prismaPool.map(async (client) => {
      try {
        await client.$disconnect();
      } catch (error) {
        logger.warn('Error during connection disconnect', { error });
      }
    });

    await Promise.allSettled(disconnectPromises);

    this.prismaPool = [];
    this.readyClients = [];
    this.busyClients.clear();
    this.isInitialized = false;

    logger.info('Database connection pool shutdown complete');
  }
}

// Export singleton instance
export const databasePool = DatabaseConnectionPool.getInstance();

// Convenience functions for common operations
export const executeQuery = <T>(queryFn: (client: PrismaClient) => Promise<T>, operation?: string) =>
  databasePool.executeQuery(queryFn, operation);

export const executeTransaction = <T>(transactionFn: (client: PrismaClient) => Promise<T>, operation?: string) =>
  databasePool.executeTransaction(transactionFn, operation);

export const getDatabaseStats = () => databasePool.getStats();

// Initialize pool on import
if (env.NODE_ENV !== 'test') {
  databasePool.initialize().catch((error) => {
    logger.error('Failed to initialize database pool on startup', { error });
    process.exit(1);
  });
}

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  await databasePool.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await databasePool.shutdown();
  process.exit(0);
});
