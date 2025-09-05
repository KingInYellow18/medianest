import { PrismaClient } from '@prisma/client';

import { logger } from '../utils/logger';
import { PrismaQueryEvent, PrismaErrorEvent } from '../types/database/prisma.types';

// Create singleton instance
let prisma: PrismaClient;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });

    // Log queries in development
    if (process.env.NODE_ENV === 'development') {
      prisma.$on('query', (e: PrismaQueryEvent) => {
        logger.debug('Prisma Query', {
          query: e.query,
          params: e.params,
          duration: `${e.duration}ms`,
        });
      });
    }

    // Log slow queries in all environments
    prisma.$on('query', (e: PrismaQueryEvent) => {
      if (e.duration > 1000) {
        logger.warn('Slow query detected', {
          query: e.query,
          duration: `${e.duration}ms`,
        });
      }
    });

    // Log errors
    prisma.$on('error', (e: PrismaErrorEvent) => {
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
