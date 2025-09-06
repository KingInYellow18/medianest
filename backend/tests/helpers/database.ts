import { PrismaClient } from '@prisma/client';
import { vi } from 'vitest';

let prisma: PrismaClient;

// Mock Prisma client for integration tests
const createMockPrismaClient = () => {
  return {
    user: {
      create: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: `mock-user-${Date.now()}`,
          email: data.email,
          name: data.name || null,
          plexId: data.plexId || null,
          plexUsername: data.plexUsername || null,
          plexToken: data.plexToken || null,
          role: data.role || 'user',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
          lastLoginAt: null,
          requiresPasswordChange: false,
        }),
      ),
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: `mock-user-${Date.now()}`,
          ...data,
          updatedAt: new Date(),
        }),
      ),
      delete: vi.fn().mockResolvedValue({ id: 'mock-id' }),
      count: vi.fn().mockResolvedValue(0),
    },
    mediaRequest: {
      create: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: `mock-request-${Date.now()}`,
          userId: data.userId,
          title: data.title,
          mediaType: data.mediaType,
          tmdbId: data.tmdbId || null,
          overseerrId: data.overseerrId || null,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
          completedAt: null,
          user: {
            id: data.userId,
            email: 'test@example.com',
            name: 'Test User',
            role: 'user',
            status: 'active',
          },
        }),
      ),
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: `mock-request-${Date.now()}`,
          ...data,
          updatedAt: new Date(),
        }),
      ),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      delete: vi.fn().mockResolvedValue({ id: 'mock-id' }),
      count: vi.fn().mockResolvedValue(0),
      aggregate: vi.fn().mockResolvedValue({ _count: { id: 0 } }),
    },
    serviceStatus: {
      upsert: vi.fn().mockImplementation(({ create, update, where }) =>
        Promise.resolve({
          id: Math.floor(Math.random() * 1000),
          serviceName: where.serviceName,
          status: create?.status || update?.status || 'healthy',
          responseTimeMs: create?.responseTimeMs || update?.responseTimeMs || null,
          uptimePercentage: create?.uptimePercentage
            ? { toNumber: () => create.uptimePercentage }
            : update?.uptimePercentage
              ? { toNumber: () => update.uptimePercentage }
              : null,
          lastCheckAt: create?.lastCheckAt || update?.lastCheckAt || new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ),
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: Math.floor(Math.random() * 1000),
          ...data,
          updatedAt: new Date(),
        }),
      ),
      delete: vi.fn().mockResolvedValue({ id: 1 }),
      count: vi.fn().mockResolvedValue(0),
      aggregate: vi.fn().mockResolvedValue({ _avg: { responseTimeMs: null } }),
    },
    sessionToken: {
      create: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: `mock-token-${Date.now()}`,
          userId: data.userId,
          tokenHash: 'mock-hash-' + Date.now().toString(16).repeat(4),
          expiresAt: data.expiresAt,
          createdAt: new Date(),
          lastUsedAt: null,
          user: {
            id: data.userId,
            email: 'test@example.com',
            name: 'Test User',
            role: 'user',
            status: 'active',
          },
        }),
      ),
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: `mock-token-${Date.now()}`,
          ...data,
          updatedAt: new Date(),
        }),
      ),
      delete: vi.fn().mockResolvedValue({ id: 'mock-id' }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: vi.fn().mockResolvedValue(0),
    },
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $transaction: vi.fn().mockImplementation((callback) => callback(this)),
  } as any;
};

export function getTestPrismaClient(): PrismaClient {
  if (!prisma) {
    if (process.env.NODE_ENV === 'test') {
      prisma = createMockPrismaClient();
    } else {
      prisma = new PrismaClient({
        datasources: {
          db: {
            url: process.env.DATABASE_URL,
          },
        },
      });
    }
  }
  return prisma;
}

export async function cleanDatabase() {
  const prisma = getTestPrismaClient();

  if (process.env.NODE_ENV === 'test') {
    // Reset mock call counts for test isolation
    if (prisma.sessionToken?.deleteMany) {
      vi.resetAllMocks();
      // Re-setup basic mocks after reset
      setupBasicMocks(prisma);
    }
  } else {
    // Delete in correct order to respect foreign key constraints
    await prisma.sessionToken.deleteMany();
    await prisma.youtubeDownload?.deleteMany();
    await prisma.mediaRequest.deleteMany();
    await prisma.serviceStatus.deleteMany();
    await prisma.serviceConfig?.deleteMany();
    await prisma.user.deleteMany();
  }
}

// Setup basic mock responses after reset
function setupBasicMocks(prisma: any) {
  // User mocks
  prisma.user.create.mockImplementation(({ data }) =>
    Promise.resolve({
      id: `mock-user-${Date.now()}`,
      email: data.email,
      name: data.name || null,
      plexId: data.plexId || null,
      plexUsername: data.plexUsername || null,
      role: data.role || 'user',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  );

  // Basic null returns for find operations
  prisma.user.findUnique.mockResolvedValue(null);
  prisma.mediaRequest.findUnique.mockResolvedValue(null);
  prisma.serviceStatus.findUnique.mockResolvedValue(null);
  prisma.sessionToken.findUnique.mockResolvedValue(null);

  // Basic empty arrays for findMany
  prisma.user.findMany.mockResolvedValue([]);
  prisma.mediaRequest.findMany.mockResolvedValue([]);
  prisma.serviceStatus.findMany.mockResolvedValue([]);
  prisma.sessionToken.findMany.mockResolvedValue([]);
}

export async function disconnectDatabase() {
  if (prisma) {
    await prisma.$disconnect();
  }
}

export async function seedTestData() {
  const prisma = getTestPrismaClient();

  // Create test users
  const testUser = await prisma.user.create({
    data: {
      plexId: 'test-plex-id-1',
      username: 'testuser1',
      email: 'test1@example.com',
      role: 'user',
      status: 'active',
    },
  });

  const adminUser = await prisma.user.create({
    data: {
      plexId: 'test-plex-id-admin',
      username: 'testadmin',
      email: 'admin@example.com',
      role: 'admin',
      status: 'active',
    },
  });

  return { testUser, adminUser };
}
