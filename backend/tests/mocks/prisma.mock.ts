import { vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'vitest-mock-extended';

export type MockPrismaClient = DeepMockProxy<PrismaClient>;

export const createMockPrisma = (): MockPrismaClient => {
  const mockPrisma = mockDeep<PrismaClient>();
  
  // Common mock implementations
  mockPrisma.user.findUnique.mockImplementation(async ({ where }) => {
    if (where.id === 'test-user-id') {
      return {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user',
        status: 'active',
        plexId: 'test-plex-id',
        plexToken: 'encrypted-token',
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
    return null;
  });

  mockPrisma.mediaRequest.findMany.mockResolvedValue([]);
  mockPrisma.youtubeDownload.findMany.mockResolvedValue([]);
  mockPrisma.sessionToken.findUnique.mockResolvedValue(null);

  return mockPrisma;
};

export const mockPrismaTransactions = (mockPrisma: MockPrismaClient) => {
  mockPrisma.$transaction.mockImplementation(async (operations: any) => {
    if (Array.isArray(operations)) {
      return Promise.all(operations);
    }
    if (typeof operations === 'function') {
      return operations(mockPrisma);
    }
    return operations;
  });
};

export const mockPrismaErrors = (mockPrisma: MockPrismaClient) => {
  const originalFindUnique = mockPrisma.user.findUnique;
  
  mockPrisma.user.findUnique.mockImplementation(async (args: any) => {
    if (args.where?.id === 'error-user-id') {
      throw new Error('Database connection error');
    }
    return originalFindUnique(args);
  });
};