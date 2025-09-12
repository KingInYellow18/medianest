import { getPrismaClient, disconnectPrisma } from '../db/prisma';
import { createRepositories, Repositories } from '../repositories';
import { CatchError } from '../types/common';
import { logger } from '../utils/logger';

let repositories: Repositories;

// Context7 Pattern: Enhanced Database Initialization with Advanced Connection Management
export const initializeDatabase = async () => {
  const prisma = getPrismaClient();
  const initStartTime = process.hrtime.bigint();

  try {
    // Context7 Pattern: Enhanced connection timeout with progressive retries
    const connectionTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database connection timeout')), 15000);
    });

    // Context7 Pattern: Connection with retry logic
    let retries = 3;
    while (retries > 0) {
      try {
        await Promise.race([prisma.$connect(), connectionTimeout]);
        break; // Success, exit retry loop
      } catch (error) {
        retries--;
        if (retries === 0) throw error;

        // Context7 Pattern: Exponential backoff for retries
        const backoffTime = (4 - retries) * 1000; // 1s, 2s, 3s
        logger.warn(`Database connection failed, retrying in ${backoffTime}ms`, {
          retriesLeft: retries,
        });
        await new Promise((resolve) => setTimeout(resolve, backoffTime));
      }
    }

    // Context7 Pattern: Enhanced database health verification
    const healthChecks = await Promise.all([
      prisma.$queryRaw`SELECT 1 as health_check`,
      prisma.$queryRaw`SELECT current_database() as db_name`,
      prisma.$queryRaw`SELECT version() as pg_version`,
    ]);

    const [, dbInfo, versionInfo] = healthChecks;
    logger.info('Database connected successfully with comprehensive health verification', {
      database: (dbInfo as any)[0]?.db_name,
      version: ((versionInfo as any)[0]?.pg_version || '').substring(0, 50),
    });

    // Context7 Pattern: Connection pool optimization settings
    await Promise.allSettled([
      prisma.$executeRaw`SELECT pg_stat_reset()`, // Reset stats for monitoring
      prisma.$executeRaw`SET statement_timeout = '30s'`, // Query timeout
      prisma.$executeRaw`SET idle_in_transaction_session_timeout = '60s'`, // Idle timeout
    ]);

    // Create repositories
    repositories = createRepositories(prisma);

    const initEndTime = process.hrtime.bigint();
    const initDuration = Number(initEndTime - initStartTime) / 1e6; // Convert to milliseconds

    logger.info('Repositories initialized', {
      initializationTime: `${initDuration.toFixed(2)}ms`,
    });

    return prisma;
  } catch (error: CatchError) {
    logger.error('Failed to connect to database', error);
    throw error;
  }
};

export const getDatabase = () => {
  return getPrismaClient();
};

export const getRepositories = (): Repositories => {
  if (!repositories) {
    throw new Error('Repositories not initialized. Call initializeDatabase first.');
  }
  return repositories;
};

// Graceful shutdown
process.on('beforeExit', async () => {
  await disconnectPrisma();
});
