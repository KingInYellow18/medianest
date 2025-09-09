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

    // Log queries in development
    if (process.env.NODE_ENV === 'development') {
      (prisma.$on as any)('query', (e: Prisma.QueryEvent) => {
        logger.debug('Prisma Query', {
          query: e.query,
          params: e.params,
          duration: `${e.duration}ms`,
        });
      });
    }

    // Log slow queries in all environments
    (prisma.$on as any)('query', (e: Prisma.QueryEvent) => {
      if (e.duration > 1000) {
        logger.warn('Slow query detected', {
          query: e.query,
          duration: `${e.duration}ms`,
        });
      }
    });

    // Log errors
    (prisma.$on as any)('error', (e: Prisma.LogEvent) => {
      logger.error('Prisma error', {
        message: e.message,
        target: e.target,
      });
    });
  }

  return prisma;
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
