import { Prisma, PrismaClient } from '@prisma/client';

import { logger } from '../utils/logger';

// Create singleton instance
let prisma: PrismaClient;

// Parse DATABASE_URL to add connection pooling parameters
function getDatabaseUrl(): string {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Parse the URL to add connection pooling parameters
  const url = new URL(baseUrl);

  // Optimized for homelab with 10-20 users
  // Conservative settings to avoid overwhelming a homelab database
  url.searchParams.set('connection_limit', '20'); // Max 20 connections
  url.searchParams.set('pool_timeout', '10'); // 10 second timeout
  url.searchParams.set('connect_timeout', '10'); // 10 second connection timeout
  url.searchParams.set('statement_timeout', '30000'); // 30 second statement timeout

  return url.toString();
}

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: getDatabaseUrl(),
        },
      },
      log:
        process.env.NODE_ENV === 'development'
          ? [
              { emit: 'event', level: 'query' },
              { emit: 'event', level: 'error' },
              { emit: 'event', level: 'warn' },
            ]
          : [{ emit: 'event', level: 'error' }],
    });

    // Setup event listeners ONLY ONCE to prevent memory leaks
    setupPrismaEventListeners(prisma);
  }

  return prisma;
}

/**
 * Setup Prisma event listeners once to prevent memory leaks
 * CRITICAL: This function should only be called once per Prisma instance
 */
function setupPrismaEventListeners(prismaClient: PrismaClient): void {
  // Development query logging
  if (process.env.NODE_ENV === 'development') {
    (prismaClient.$on as any)('query', (e: Prisma.QueryEvent) => {
      logger.debug('Prisma Query', {
        query: e.query,
        params: e.params,
        duration: `${e.duration}ms`,
      });
    });
  }

  // Slow query monitoring (production critical)
  (prismaClient.$on as any)('query', (e: Prisma.QueryEvent) => {
    if (e.duration > 1000) {
      logger.warn('Slow query detected - performance issue', {
        query: e.query,
        duration: `${e.duration}ms`,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Error logging (production critical)
  (prismaClient.$on as any)('error', (e: Prisma.LogEvent) => {
    logger.error('Prisma database error', {
      message: e.message,
      target: e.target,
      timestamp: new Date().toISOString(),
    });
  });

  // Add connection monitoring for production stability
  (prismaClient.$on as any)('beforeExit', async () => {
    logger.info('Prisma client disconnecting...');
    await prismaClient.$disconnect();
  });
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
  }
}

// Export getPrisma as an alias for backward compatibility
export const getPrisma = getPrismaClient;

// Export the default instance
export default getPrismaClient();
