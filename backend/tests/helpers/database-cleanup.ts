/**
 * Clean up all database tables in the correct order to respect foreign key constraints
 */
export async function cleanupDatabase(prisma: any): Promise<void> {
  // Delete in reverse order of dependencies to avoid foreign key violations

  // First, delete tables that have no foreign keys pointing to them
  if (prisma.errorLog?.deleteMany) {
    await prisma.errorLog.deleteMany().catch(() => {});
  }
  if (prisma.sessionToken?.deleteMany) {
    await prisma.sessionToken.deleteMany().catch(() => {});
  }
  if (prisma.session?.deleteMany) {
    await prisma.session.deleteMany().catch(() => {});
  }
  if (prisma.account?.deleteMany) {
    await prisma.account.deleteMany().catch(() => {});
  }
  if (prisma.verificationToken?.deleteMany) {
    await prisma.verificationToken.deleteMany().catch(() => {});
  }

  // Then delete tables that depend on users
  if (prisma.youtubeDownload?.deleteMany) {
    await prisma.youtubeDownload.deleteMany().catch(() => {});
  }
  if (prisma.mediaRequest?.deleteMany) {
    await prisma.mediaRequest.deleteMany().catch(() => {});
  }
  if (prisma.rateLimit?.deleteMany) {
    await prisma.rateLimit.deleteMany().catch(() => {});
  }
  if (prisma.serviceStatus?.deleteMany) {
    await prisma.serviceStatus.deleteMany().catch(() => {});
  }

  // Delete service config (depends on users for updatedBy)
  if (prisma.serviceConfig?.deleteMany) {
    await prisma.serviceConfig.deleteMany().catch(() => {});
  }

  // Delete monitor visibility
  if (prisma.monitorVisibility?.deleteMany) {
    await prisma.monitorVisibility.deleteMany().catch(() => {});
  }

  // Finally delete users
  if (prisma.user?.deleteMany) {
    await prisma.user.deleteMany().catch(() => {});
  }
}

/**
 * Reset database sequences (for auto-increment IDs)
 */
export async function resetSequences(prisma: any): Promise<void> {
  // Only execute if it's a real Prisma client with $executeRawUnsafe
  if (prisma.$executeRawUnsafe) {
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
}
