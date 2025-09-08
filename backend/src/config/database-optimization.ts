import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

/**
 * Database optimization configurations and connection pooling
 * Performance: Optimized connection management, query performance monitoring
 */

/**
 * Optimized Prisma configuration for high-performance applications
 */
export function createOptimizedPrismaClient(): PrismaClient {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: [
      // Only log slow queries and errors in production
      ...(process.env.NODE_ENV === 'production'
        ? [{ emit: 'event' as const, level: 'warn' as const }]
        : [
            { emit: 'event' as const, level: 'query' as const },
            { emit: 'event' as const, level: 'info' as const },
            { emit: 'event' as const, level: 'warn' as const },
            { emit: 'event' as const, level: 'error' as const },
          ]),
    ],
    errorFormat: 'pretty',
  });

  // Query performance monitoring
  prisma.$on('query', (e) => {
    const duration = typeof e.duration === 'number' ? e.duration : parseInt(String(e.duration));

    // Log slow queries (>100ms in production, >500ms in development)
    const slowThreshold = process.env.NODE_ENV === 'production' ? 100 : 500;

    if (duration > slowThreshold) {
      logger.warn('Slow Database Query Detected', {
        query: e.query,
        params: e.params,
        duration: `${duration}ms`,
        target: e.target,
        timestamp: e.timestamp,
      });
    }

    // Log extremely slow queries as errors
    if (duration > 1000) {
      logger.error('Extremely Slow Database Query', {
        query: e.query,
        params: e.params,
        duration: `${duration}ms`,
        target: e.target,
        timestamp: e.timestamp,
      });
    }
  });

  // Error logging
  prisma.$on('error', (e) => {
    logger.error('Database Error', {
      message: e.message,
      target: e.target,
      timestamp: e.timestamp,
    });
  });

  // Info and warning logging (development only)
  if (process.env.NODE_ENV !== 'production') {
    prisma.$on('info', (e) => {
      logger.info('Database Info', {
        message: e.message,
        target: e.target,
        timestamp: e.timestamp,
      });
    });
  }

  prisma.$on('warn', (e) => {
    logger.warn('Database Warning', {
      message: e.message,
      target: e.target,
      timestamp: e.timestamp,
    });
  });

  return prisma;
}

/**
 * Database health check and optimization recommendations
 */
export async function checkDatabaseHealth(prisma: PrismaClient): Promise<{
  status: 'healthy' | 'warning' | 'error';
  connectionTime: number;
  recommendations: string[];
  metrics: {
    activeConnections?: number;
    slowQueries?: number;
    averageQueryTime?: number;
  };
}> {
  const recommendations: string[] = [];
  const metrics: any = {};

  try {
    const start = Date.now();

    // Test basic connectivity
    await prisma.$queryRaw`SELECT 1`;

    const connectionTime = Date.now() - start;
    metrics.connectionTime = connectionTime;

    // Connection time recommendations
    if (connectionTime > 100) {
      recommendations.push(
        'Database connection time is high. Consider connection pooling optimization.'
      );
    }

    if (connectionTime > 500) {
      recommendations.push(
        'Critical: Database connection time exceeds 500ms. Check network and database performance.'
      );
      return {
        status: 'error',
        connectionTime,
        recommendations,
        metrics,
      };
    }

    // Check for long-running transactions (if supported by database)
    try {
      const longRunningQueries = (await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM information_schema.processlist 
        WHERE command != 'Sleep' AND time > 10
      `) as any[];

      if (longRunningQueries[0]?.count > 0) {
        recommendations.push(
          `Found ${longRunningQueries[0].count} long-running queries. Consider query optimization.`
        );
      }
    } catch {
      // Ignore if database doesn't support this query
    }

    // Determine overall status
    const status = recommendations.length > 2 ? 'warning' : 'healthy';

    return {
      status,
      connectionTime,
      recommendations,
      metrics,
    };
  } catch (error) {
    logger.error('Database health check failed', { error });

    return {
      status: 'error',
      connectionTime: 0,
      recommendations: ['Database connection failed. Check database server status.'],
      metrics: {},
    };
  }
}

/**
 * Recommended database indexes for optimal performance
 */
export const RECOMMENDED_INDEXES = {
  mediaRequests: [
    'CREATE INDEX IF NOT EXISTS idx_media_requests_user_id ON MediaRequest(userId);',
    'CREATE INDEX IF NOT EXISTS idx_media_requests_status ON MediaRequest(status);',
    'CREATE INDEX IF NOT EXISTS idx_media_requests_created_at ON MediaRequest(createdAt);',
    'CREATE INDEX IF NOT EXISTS idx_media_requests_user_status ON MediaRequest(userId, status);',
    'CREATE INDEX IF NOT EXISTS idx_media_requests_tmdb_type ON MediaRequest(tmdbId, mediaType);',
    'CREATE INDEX IF NOT EXISTS idx_media_requests_compound ON MediaRequest(userId, status, createdAt);',
  ],
  users: [
    'CREATE INDEX IF NOT EXISTS idx_users_plex_id ON User(plexId);',
    'CREATE INDEX IF NOT EXISTS idx_users_email ON User(email);',
    'CREATE INDEX IF NOT EXISTS idx_users_status ON User(status);',
    'CREATE INDEX IF NOT EXISTS idx_users_role ON User(role);',
  ],
  sessions: [
    'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON Session(userId);',
    'CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON Session(expiresAt);',
    'CREATE INDEX IF NOT EXISTS idx_sessions_user_expires ON Session(userId, expiresAt);',
  ],
  serviceStatus: [
    'CREATE INDEX IF NOT EXISTS idx_service_status_name ON ServiceStatus(serviceName);',
    'CREATE INDEX IF NOT EXISTS idx_service_status_updated ON ServiceStatus(updatedAt);',
    'CREATE INDEX IF NOT EXISTS idx_service_status_name_updated ON ServiceStatus(serviceName, updatedAt);',
  ],
};

/**
 * Create recommended database indexes
 */
export async function createRecommendedIndexes(prisma: PrismaClient): Promise<{
  created: number;
  failed: number;
  errors: string[];
}> {
  const results = {
    created: 0,
    failed: 0,
    errors: [] as string[],
  };

  const allIndexes = Object.values(RECOMMENDED_INDEXES).flat();

  for (const indexQuery of allIndexes) {
    try {
      await prisma.$executeRawUnsafe(indexQuery);
      results.created++;
      logger.info('Database index created', { query: indexQuery });
    } catch (error) {
      results.failed++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      results.errors.push(`${indexQuery}: ${errorMessage}`);
      logger.warn('Failed to create database index', { query: indexQuery, error: errorMessage });
    }
  }

  logger.info('Database index optimization complete', results);
  return results;
}

/**
 * Database connection pool monitoring
 */
export class DatabaseMonitor {
  private queryCount = 0;
  private slowQueryCount = 0;
  private totalQueryTime = 0;
  private startTime = Date.now();

  recordQuery(duration: number): void {
    this.queryCount++;
    this.totalQueryTime += duration;

    if (duration > 100) {
      this.slowQueryCount++;
    }
  }

  getStatistics(): {
    totalQueries: number;
    slowQueries: number;
    averageQueryTime: number;
    queriesPerSecond: number;
    uptime: number;
  } {
    const uptime = Date.now() - this.startTime;

    return {
      totalQueries: this.queryCount,
      slowQueries: this.slowQueryCount,
      averageQueryTime: this.queryCount > 0 ? this.totalQueryTime / this.queryCount : 0,
      queriesPerSecond: this.queryCount / (uptime / 1000),
      uptime,
    };
  }

  reset(): void {
    this.queryCount = 0;
    this.slowQueryCount = 0;
    this.totalQueryTime = 0;
    this.startTime = Date.now();
  }
}

export const databaseMonitor = new DatabaseMonitor();

/**
 * Connection pool configuration for different environments
 */
export const CONNECTION_POOL_CONFIG = {
  development: {
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // Smaller pool for development
    pool: {
      min: 2,
      max: 10,
      acquireTimeout: 60000,
      createTimeout: 30000,
      destroyTimeout: 5000,
      idleTimeout: 10000,
      reapInterval: 1000,
      createRetryInterval: 100,
    },
  },

  production: {
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // Optimized pool for production
    pool: {
      min: 10,
      max: 30,
      acquireTimeout: 30000,
      createTimeout: 15000,
      destroyTimeout: 5000,
      idleTimeout: 30000,
      reapInterval: 1000,
      createRetryInterval: 500,
    },
  },

  test: {
    datasources: {
      db: {
        url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
      },
    },
    // Minimal pool for testing
    pool: {
      min: 1,
      max: 5,
      acquireTimeout: 10000,
      createTimeout: 5000,
      destroyTimeout: 1000,
      idleTimeout: 5000,
      reapInterval: 1000,
      createRetryInterval: 100,
    },
  },
};
