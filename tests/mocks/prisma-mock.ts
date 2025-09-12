/**
 * COMPREHENSIVE PRISMA MOCKING INFRASTRUCTURE
 *
 * Fixes Prisma client mocking failures and provides consistent database mocking.
 * Addresses transaction handling, connection issues, and query mocking.
 */

import { vi } from 'vitest';

/**
 * Create a comprehensive Prisma mock that handles all database operations
 */
export const createPrismaMock = () => {
  // Base model operations
  const createModelMock = () => ({
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  });

  const prismaMock = {
    // User model
    user: createModelMock(),

    // Media request model
    mediaRequest: createModelMock(),

    // Session token model
    sessionToken: createModelMock(),

    // Service status model
    serviceStatus: createModelMock(),

    // Service config model
    serviceConfig: createModelMock(),

    // Device session model (if exists)
    deviceSession: createModelMock(),

    // Connection management
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),

    // Transaction support
    $transaction: vi.fn(),

    // Raw queries
    $queryRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
    $executeRaw: vi.fn(),
    $executeRawUnsafe: vi.fn(),

    // Metrics and monitoring
    $metrics: {
      json: vi.fn().mockResolvedValue({}),
      prometheus: vi.fn().mockResolvedValue(''),
    },

    // Event handling
    $on: vi.fn(),
    $use: vi.fn(),

    // Extensions
    $extends: vi.fn().mockReturnThis(),
  };

  // Setup transaction mock behavior
  prismaMock.$transaction.mockImplementation(async (operations: any) => {
    // If operations is a function (interactive transaction)
    if (typeof operations === 'function') {
      return await operations(prismaMock);
    }

    // If operations is an array of promises (batch transaction)
    if (Array.isArray(operations)) {
      return Promise.all(operations);
    }

    // Single operation
    return operations;
  });

  return prismaMock;
};

/**
 * Global Prisma mock instance
 */
export const mockPrismaInstance = createPrismaMock();

/**
 * Setup Prisma mocks - call this in test setup files
 */
export function setupPrismaMocks() {
  // Mock Prisma Client
  vi.mock('@prisma/client', () => ({
    PrismaClient: vi.fn(() => createPrismaMock()),
  }));

  return {
    mockPrisma: mockPrismaInstance,
    resetMocks: () => {
      vi.clearAllMocks();
      // Reset all model mocks
      Object.values(mockPrismaInstance).forEach((model: any) => {
        if (model && typeof model === 'object' && 'findFirst' in model) {
          // Reset all CRUD operations for this model
          Object.values(model).forEach((method: any) => {
            if (typeof method?.mockReset === 'function') {
              method.mockReset();
            }
          });
        }
      });
    },
  };
}

/**
 * User model mock helpers
 */
export const userMockHelpers = {
  mockFindUserById: (id: string, userData?: any) => {
    mockPrismaInstance.user.findUnique.mockImplementation(({ where }: any) =>
      where?.id === id
        ? Promise.resolve(userData || createTestUser({ id }))
        : Promise.resolve(null),
    );
  },

  mockFindUserByEmail: (email: string, userData?: any) => {
    mockPrismaInstance.user.findFirst.mockImplementation(({ where }: any) =>
      where?.email === email
        ? Promise.resolve(userData || createTestUser({ email }))
        : Promise.resolve(null),
    );
  },

  mockCreateUser: (userData: any) => {
    mockPrismaInstance.user.create.mockResolvedValue({
      ...createTestUser(),
      ...userData,
      id: userData.id || 'new-user-id',
    });
  },

  mockUpdateUser: (id: string, updates: any) => {
    mockPrismaInstance.user.update.mockImplementation(({ where, data }: any) =>
      where?.id === id
        ? Promise.resolve({ ...createTestUser({ id }), ...data })
        : Promise.reject(new Error('User not found')),
    );
  },

  mockUserNotFound: () => {
    mockPrismaInstance.user.findUnique.mockResolvedValue(null);
    mockPrismaInstance.user.findFirst.mockResolvedValue(null);
  },
};

/**
 * Media request mock helpers
 */
export const mediaRequestMockHelpers = {
  mockFindMediaRequest: (id: string, requestData?: any) => {
    mockPrismaInstance.mediaRequest.findUnique.mockImplementation(({ where }: any) =>
      where?.id === id
        ? Promise.resolve(requestData || createTestMediaRequest({ id }))
        : Promise.resolve(null),
    );
  },

  mockCreateMediaRequest: (requestData: any) => {
    mockPrismaInstance.mediaRequest.create.mockResolvedValue({
      ...createTestMediaRequest(),
      ...requestData,
      id: requestData.id || 'new-request-id',
    });
  },

  mockFindUserMediaRequests: (userId: string, requests: any[] = []) => {
    mockPrismaInstance.mediaRequest.findMany.mockImplementation(({ where }: any) =>
      where?.userId === userId ? Promise.resolve(requests) : Promise.resolve([]),
    );
  },

  mockUpdateMediaRequest: (id: string, updates: any) => {
    mockPrismaInstance.mediaRequest.update.mockImplementation(({ where, data }: any) =>
      where?.id === id
        ? Promise.resolve({ ...createTestMediaRequest({ id }), ...data })
        : Promise.reject(new Error('Request not found')),
    );
  },
};

/**
 * Session token mock helpers
 */
export const sessionTokenMockHelpers = {
  mockCreateSessionToken: (tokenData: any) => {
    mockPrismaInstance.sessionToken.create.mockResolvedValue({
      id: tokenData.id || 'new-session-token-id',
      token: tokenData.token || 'test-session-token',
      userId: tokenData.userId || 'test-user-id',
      expiresAt: tokenData.expiresAt || new Date(Date.now() + 86400000), // 24 hours
      createdAt: new Date(),
      ...tokenData,
    });
  },

  mockFindSessionToken: (token: string, tokenData?: any) => {
    mockPrismaInstance.sessionToken.findUnique.mockImplementation(({ where }: any) =>
      where?.token === token
        ? Promise.resolve(tokenData || { id: 'token-id', token, userId: 'test-user-id' })
        : Promise.resolve(null),
    );
  },

  mockDeleteSessionToken: (id: string) => {
    mockPrismaInstance.sessionToken.delete.mockImplementation(({ where }: any) =>
      where?.id === id
        ? Promise.resolve({ id, deleted: true })
        : Promise.reject(new Error('Token not found')),
    );
  },
};

/**
 * Transaction mock helpers
 */
export const transactionMockHelpers = {
  mockTransactionSuccess: (results: any[]) => {
    mockPrismaInstance.$transaction.mockResolvedValue(results);
  },

  mockTransactionFailure: (error: Error) => {
    mockPrismaInstance.$transaction.mockRejectedValue(error);
  },

  mockInteractiveTransaction: (callback: (tx: any) => Promise<any>) => {
    mockPrismaInstance.$transaction.mockImplementation(async (fn) => {
      const txMock = createPrismaMock();
      return await fn(txMock);
    });
  },
};

/**
 * Error mock helpers
 */
export const errorMockHelpers = {
  mockUniqueConstraintError: (field: string) => {
    const error = new Error('Unique constraint failed');
    (error as any).code = 'P2002';
    (error as any).meta = { target: [field] };
    return error;
  },

  mockNotFoundError: () => {
    const error = new Error('Record not found');
    (error as any).code = 'P2025';
    return error;
  },

  mockConnectionError: () => {
    const error = new Error('Connection failed');
    (error as any).code = 'P1001';
    return error;
  },
};

/**
 * Test data factories
 */
function createTestUser(overrides = {}) {
  return {
    id: 'test-user-id',
    plexId: 'test-plex-id',
    plexUsername: 'testuser',
    email: 'test@medianest.com',
    name: 'Test User',
    role: 'USER',
    status: 'active',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    lastLoginAt: new Date('2024-01-01T00:00:00Z'),
    plexToken: null,
    image: null,
    requiresPasswordChange: false,
    ...overrides,
  };
}

function createTestMediaRequest(overrides = {}) {
  return {
    id: 'test-media-request-id',
    userId: 'test-user-id',
    title: 'Test Movie',
    year: 2024,
    type: 'movie',
    status: 'pending',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}
