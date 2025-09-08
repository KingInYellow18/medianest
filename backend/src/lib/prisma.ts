import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';
import { logger } from '../utils/logger';

declare global {
  var __prisma: PrismaClient | undefined;
}

const prisma =
  globalThis.__prisma ||
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: env.DATABASE_URL,
      },
    },
  });

if (env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

// Context7 Pattern: Use proper Prisma event types instead of any
interface QueryEvent {
  timestamp: Date;
  query: string;
  params: string;
  duration: number;
  target: string;
}

// Add connection event logging
prisma.$on('query', (e: QueryEvent) => {
  if (env.NODE_ENV === 'development') {
    logger.debug('Query executed', { query: e.query, duration: e.duration });
  }
});

export { prisma };
export default prisma;
