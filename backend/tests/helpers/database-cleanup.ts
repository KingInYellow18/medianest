import { PrismaClient } from '@prisma/client';

/**
 * Clean up all database tables in the correct order to respect foreign key constraints
 */
export async function cleanupDatabase(prisma: PrismaClient): Promise<void> {
  // Delete in reverse order of dependencies to avoid foreign key violations

  // First, delete tables that have no foreign keys pointing to them
  await prisma.errorLog.deleteMany().catch(() => {});
  await prisma.sessionToken.deleteMany().catch(() => {});
  await prisma.session.deleteMany().catch(() => {});
  await prisma.account.deleteMany().catch(() => {});
  await prisma.verificationToken.deleteMany().catch(() => {});

  // Then delete tables that depend on users
  await prisma.youtubeDownload.deleteMany().catch(() => {});
  await prisma.mediaRequest.deleteMany().catch(() => {});
  await prisma.rateLimit.deleteMany().catch(() => {});
  await prisma.serviceStatus.deleteMany().catch(() => {});

  // Delete service config (depends on users for updatedBy)
  await prisma.serviceConfig.deleteMany().catch(() => {});

  // Finally delete users
  await prisma.user.deleteMany().catch(() => {});
}

/**
 * Reset database sequences (for auto-increment IDs)
 */
export async function resetSequences(prisma: PrismaClient): Promise<void> {
  await prisma
    .$executeRawUnsafe(
      `
    ALTER SEQUENCE service_status_id_seq RESTART WITH 1;
    ALTER SEQUENCE rate_limits_id_seq RESTART WITH 1;
    ALTER SEQUENCE service_config_id_seq RESTART WITH 1;
  `,
    )
    .catch(() => {});
}
