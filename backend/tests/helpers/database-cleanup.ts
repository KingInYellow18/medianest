import { PrismaClient } from '@prisma/client';

/**
 * Clean up all database tables in the correct order to respect foreign key constraints
 */
export async function cleanupDatabase(prisma: PrismaClient): Promise<void> {
  // Delete in reverse order of dependencies to avoid foreign key violations
  // Use defensive programming for mocked environments

  const safeDelet = async (operation: () => Promise<any>) => {
    try {
      await operation();
    } catch (error) {
      // Silently catch errors for missing methods in mocks
    }
  };

  // First, delete tables that have no foreign keys pointing to them
  await safeDelet(() => prisma.errorLog?.deleteMany?.() || Promise.resolve());
  await safeDelet(() => prisma.sessionToken?.deleteMany?.() || Promise.resolve());
  await safeDelet(() => prisma.session?.deleteMany?.() || Promise.resolve());
  await safeDelet(() => prisma.account?.deleteMany?.() || Promise.resolve());
  await safeDelet(() => prisma.verificationToken?.deleteMany?.() || Promise.resolve());

  // Then delete tables that depend on users
  await safeDelet(() => prisma.youtubeDownload?.deleteMany?.() || Promise.resolve());
  await safeDelet(() => prisma.mediaRequest?.deleteMany?.() || Promise.resolve());
  await safeDelet(() => prisma.rateLimit?.deleteMany?.() || Promise.resolve());
  await safeDelet(() => prisma.serviceStatus?.deleteMany?.() || Promise.resolve());

  // Delete service config (depends on users for updatedBy)
  await safeDelet(() => prisma.serviceConfig?.deleteMany?.() || Promise.resolve());

  // Finally delete users
  await safeDelet(() => prisma.user?.deleteMany?.() || Promise.resolve());
}

/**
 * Reset database sequences (for auto-increment IDs)
 */
export async function resetSequences(prisma: PrismaClient): Promise<void> {
  try {
    if (prisma.$executeRawUnsafe) {
      await prisma.$executeRawUnsafe(
        `
      ALTER SEQUENCE service_status_id_seq RESTART WITH 1;
      ALTER SEQUENCE rate_limits_id_seq RESTART WITH 1;
      ALTER SEQUENCE service_config_id_seq RESTART WITH 1;
    `,
      );
    }
  } catch (error) {
    // Silently catch errors in test environment
  }
}

/**
 * Database cleanup utility object for tests
 */
export const databaseCleanup = {
  async cleanAll(providedPrisma?: PrismaClient): Promise<void> {
    if (providedPrisma) {
      await cleanupDatabase(providedPrisma);
      await resetSequences(providedPrisma);
    } else {
      // Fallback - try to use regular import
      try {
        const { prisma } = await import('@/db/prisma');
        await cleanupDatabase(prisma);
        await resetSequences(prisma);
      } catch {
        // Skip cleanup if can't import prisma in test environment
        console.warn('Skipping database cleanup - prisma import failed');
      }
    }
  },
};
