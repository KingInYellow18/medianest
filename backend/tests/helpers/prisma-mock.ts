import { vi } from 'vitest';

// Mock Decimal class to handle Prisma's decimal types
export class MockDecimal {
  private value: number;

  constructor(value: number | string) {
    this.value = typeof value === 'string' ? parseFloat(value) : value;
  }

  toNumber(): number {
    return this.value;
  }

  toString(): string {
    return this.value.toString();
  }

  static from(value: number | string): MockDecimal {
    return new MockDecimal(value);
  }
}

// Mock Prisma client setup
export function createPrismaMock() {
  return vi.hoisted(() => {
    return {
      Decimal: MockDecimal,
      PrismaClient: vi.fn().mockImplementation(() => ({
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
          findUnique: vi.fn(),
          findMany: vi.fn().mockResolvedValue([]),
          update: vi.fn(),
          delete: vi.fn(),
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
          findUnique: vi.fn(),
          findMany: vi.fn().mockImplementation(() =>
            Promise.resolve({
              items: [],
              total: 0,
              totalPages: 0,
              currentPage: 1,
            }),
          ),
          update: vi.fn(),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          delete: vi.fn(),
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
                ? new MockDecimal(create.uptimePercentage)
                : update?.uptimePercentage
                  ? new MockDecimal(update.uptimePercentage)
                  : null,
              lastCheckAt: create?.lastCheckAt || update?.lastCheckAt || new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          ),
          findUnique: vi.fn(),
          findMany: vi.fn().mockResolvedValue([]),
          update: vi.fn(),
          delete: vi.fn(),
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
          findUnique: vi.fn(),
          findMany: vi.fn().mockResolvedValue([]),
          update: vi.fn(),
          delete: vi.fn(),
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          count: vi.fn().mockResolvedValue(0),
        },
        $disconnect: vi.fn().mockResolvedValue(undefined),
        $transaction: vi.fn().mockImplementation((callback) => callback(this)),
      })),
    };
  });
}

// Setup Prisma mock for tests
export function setupPrismaMock() {
  vi.mock('@prisma/client', createPrismaMock());
}
