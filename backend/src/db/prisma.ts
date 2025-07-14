import { Prisma, PrismaClient } from '@prisma/client';

import { logger } from '../utils/logger';

// Create singleton instance
let prisma: PrismaClient;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
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

// Export the default instance
export default getPrismaClient();
