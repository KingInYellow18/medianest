import { setupUniversalTestIsolation } from '../foundation/universal-test-isolation';
import { beforeAll, afterAll } from 'vitest';

/**
 * Basic Database Foundation Validation - Phase A
 * 
 * Essential validation tests to verify the database mock foundation
 * works correctly and integrates properly with the test infrastructure.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  PrismaDatabaseMock, 
  PrismaDatabaseMockFactory,
  MockDecimal,
} from '../database/prisma-database-mock';


// =====================================================
// UNIVERSAL TEST ISOLATION - Phase F Proven Pattern
// =====================================================
// SUCCESS METRICS:
// - Frontend tests: 100% isolation (proven)
// - Security tests: 50/50 working with isolation
// - Winston mocks: 29/29 working with factory pattern
// =====================================================

let isolationManager: any;

beforeAll(async () => {
  // Initialize universal isolation manager
  isolationManager = setupUniversalTestIsolation();
});

beforeEach(async () => {
  // CRITICAL: Complete isolation reset before each test
  // This prevents cascade failures between tests
  vi.clearAllMocks();
  vi.resetAllMocks();
  isolationManager?.reset();
  
  // Additional environment cleanup
  process.env.NODE_ENV = 'test';
});

afterEach(async () => {
  // CRITICAL: Aggressive cleanup after each test
  // This ensures no state leaks to subsequent tests
  isolationManager?.cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

afterAll(async () => {
  // Final cleanup and resource deallocation
  isolationManager?.cleanup();
});

describe('Database Foundation Basic Validation', () => {
  let mockFactory: PrismaDatabaseMockFactory;
  let prismaClient: any;

  beforeEach(() => {
    // Create fresh instances for each test
    mockFactory = new PrismaDatabaseMockFactory();
    prismaClient = mockFactory.create({ behavior: 'realistic' });
  });

  describe('Core Interface Validation', () => {
    it('should have all required connection methods', () => {
      expect(typeof prismaClient.$connect).toBe('function');
      expect(typeof prismaClient.$disconnect).toBe('function');
      expect(typeof prismaClient.$transaction).toBe('function');
      expect(typeof prismaClient.$queryRaw).toBe('function');
      expect(typeof prismaClient.$executeRaw).toBe('function');
    });

    it('should have essential model operations', () => {
      const requiredModels = ['user', 'mediaRequest', 'session', 'sessionToken'];

      requiredModels.forEach(model => {
        expect(prismaClient[model]).toBeDefined();
        expect(typeof prismaClient[model]).toBe('object');
        
        const requiredOperations = ['create', 'findUnique', 'findMany', 'update', 'delete', 'count'];
        requiredOperations.forEach(operation => {
          expect(typeof prismaClient[model][operation]).toBe('function');
        });
      });
    });

    it('should validate factory interface completeness', () => {
      const validation = mockFactory.validate(prismaClient);
      expect(validation).toBeDefined();
      expect(typeof validation.valid).toBe('boolean');
      expect(Array.isArray(validation.errors)).toBe(true);
      expect(Array.isArray(validation.warnings)).toBe(true);
    });
  });

  describe('Basic CRUD Operations', () => {
    it('should create and retrieve user', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
      };

      const user = await prismaClient.user.create({ data: userData });

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.email).toBe(userData.email);
      expect(user.name).toBe(userData.name);
      expect(user.role).toBe(userData.role);
      expect(user.createdAt).toBeInstanceOf(Date);

      // Verify we can find the user
      const foundUser = await prismaClient.user.findUnique({
        where: { id: user.id }
      });

      expect(foundUser).toBeDefined();
      expect(foundUser.id).toBe(user.id);
      expect(foundUser.email).toBe(userData.email);
    });

    it('should handle user update operations', async () => {
      const userData = {
        email: 'update@example.com',
        name: 'Original Name',
        role: 'USER',
      };

      const user = await prismaClient.user.create({ data: userData });
      const updatedUser = await prismaClient.user.update({
        where: { id: user.id },
        data: { name: 'Updated Name', role: 'ADMIN' }
      });

      expect(updatedUser.name).toBe('Updated Name');
      expect(updatedUser.role).toBe('ADMIN');
      expect(updatedUser.email).toBe(userData.email); // Unchanged
    });

    it('should handle user deletion', async () => {
      const userData = {
        email: 'delete@example.com',
        name: 'Delete User',
      };

      const user = await prismaClient.user.create({ data: userData });
      const deletedUser = await prismaClient.user.delete({
        where: { id: user.id }
      });

      expect(deletedUser.id).toBe(user.id);

      // Verify user is deleted
      const foundUser = await prismaClient.user.findUnique({
        where: { id: user.id }
      });
      expect(foundUser).toBeNull();
    });

    it('should handle user counting', async () => {
      const initialCount = await prismaClient.user.count();

      // Create test users
      await prismaClient.user.create({ data: { email: 'count1@example.com' } });
      await prismaClient.user.create({ data: { email: 'count2@example.com' } });

      const finalCount = await prismaClient.user.count();
      expect(finalCount).toBe(initialCount + 2);
    });
  });

  describe('Relationship Operations', () => {
    it('should create related records', async () => {
      // Create user first
      const user = await prismaClient.user.create({
        data: {
          email: 'relationship@example.com',
          name: 'Relationship User',
        }
      });

      // Create related media request
      const request = await prismaClient.mediaRequest.create({
        data: {
          userId: user.id,
          title: 'Test Movie',
          mediaType: 'movie',
        }
      });

      expect(request).toBeDefined();
      expect(request.id).toBeDefined();
      expect(request.userId).toBe(user.id);
      expect(request.title).toBe('Test Movie');
      expect(request.mediaType).toBe('movie');
      expect(request.status).toBe('pending'); // Default value
    });

    it('should handle include relationships', async () => {
      // Create user
      const user = await prismaClient.user.create({
        data: {
          email: 'include@example.com',
          name: 'Include User',
        }
      });

      // Create media request
      await prismaClient.mediaRequest.create({
        data: {
          userId: user.id,
          title: 'Include Movie',
          mediaType: 'movie',
        }
      });

      // Find media requests with user include
      const requests = await prismaClient.mediaRequest.findMany({
        where: { userId: user.id },
        include: { user: true }
      });

      expect(requests).toHaveLength(1);
      expect(requests[0].user).toBeDefined();
      expect(requests[0].user.id).toBe(user.id);
      expect(requests[0].user.email).toBe(user.email);
    });
  });

  describe('Transaction Support', () => {
    it('should execute successful transaction', async () => {
      const userData = {
        email: 'transaction@example.com',
        name: 'Transaction User',
      };

      const result = await prismaClient.$transaction(async (tx: any) => {
        const user = await tx.user.create({ data: userData });
        const session = await tx.session.create({
          data: {
            sessionToken: 'tx-session-123',
            userId: user.id,
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
          }
        });

        return { user, session };
      });

      expect(result.user).toBeDefined();
      expect(result.session).toBeDefined();
      expect(result.session.userId).toBe(result.user.id);

      // Verify data exists outside transaction
      const foundUser = await prismaClient.user.findUnique({
        where: { id: result.user.id }
      });
      expect(foundUser).toBeDefined();
    });

    it('should rollback transaction on error', async () => {
      const userData = {
        email: 'rollback@example.com',
        name: 'Rollback User',
      };

      let thrownError: any;

      try {
        await prismaClient.$transaction(async (tx: any) => {
          await tx.user.create({ data: userData });
          
          // Simulate an error
          throw new Error('Transaction should rollback');
        });
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeDefined();
      expect(thrownError.message).toBe('Transaction should rollback');

      // Verify user was not created (rollback worked)
      const users = await prismaClient.user.findMany({
        where: { email: userData.email }
      });
      expect(users).toHaveLength(0);
    });
  });

  describe('MockDecimal Support', () => {
    it('should handle decimal values correctly', () => {
      const decimal1 = new MockDecimal(123.45);
      const decimal2 = new MockDecimal('67.89');

      expect(decimal1.toNumber()).toBe(123.45);
      expect(decimal1.toString()).toBe('123.45');
      expect(decimal1.valueOf()).toBe(123.45);

      expect(decimal2.toNumber()).toBe(67.89);
      expect(decimal2.toString()).toBe('67.89');
      expect(decimal2.valueOf()).toBe(67.89);
    });

    it('should create decimal from static method', () => {
      const decimal = MockDecimal.from(999.99);
      
      expect(decimal).toBeInstanceOf(MockDecimal);
      expect(decimal.toNumber()).toBe(999.99);
    });
  });

  describe('Service Status Operations', () => {
    it('should handle service status upsert', async () => {
      const statusData = {
        serviceName: 'test-service',
        status: 'healthy',
        responseTimeMs: 150,
        uptimePercentage: 99.5,
      };

      const status = await prismaClient.serviceStatus.upsert({
        where: { serviceName: statusData.serviceName },
        create: statusData,
        update: { status: 'unhealthy' }
      });

      expect(status).toBeDefined();
      expect(status.serviceName).toBe(statusData.serviceName);
      expect(status.status).toBe(statusData.status);
      expect(status.responseTimeMs).toBe(statusData.responseTimeMs);
      expect(status.uptimePercentage).toBeDefined();
      expect(status.uptimePercentage.toNumber()).toBe(99.5);
    });
  });

  describe('Complex Query Operations', () => {
    it('should handle findMany with multiple filters', async () => {
      // Create test data
      const users = await Promise.all([
        prismaClient.user.create({
          data: { email: 'filter1@example.com', name: 'User 1', role: 'USER' }
        }),
        prismaClient.user.create({
          data: { email: 'filter2@example.com', name: 'User 2', role: 'ADMIN' }
        }),
      ]);

      // Create media requests
      await Promise.all([
        prismaClient.mediaRequest.create({
          data: { userId: users[0].id, title: 'Movie A', mediaType: 'movie', status: 'pending' }
        }),
        prismaClient.mediaRequest.create({
          data: { userId: users[0].id, title: 'Movie B', mediaType: 'movie', status: 'completed' }
        }),
        prismaClient.mediaRequest.create({
          data: { userId: users[1].id, title: 'Show A', mediaType: 'tv', status: 'pending' }
        }),
      ]);

      // Query with multiple filters
      const results = await prismaClient.mediaRequest.findMany({
        where: {
          AND: [
            { mediaType: 'movie' },
            { status: 'pending' }
          ]
        }
      });

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Movie A');
    });
  });
});

// Basic performance test
describe('Performance Validation', () => {
  it('should perform operations within reasonable time', async () => {
    const mockFactory = new PrismaDatabaseMockFactory();
    const prismaClient = mockFactory.create({ behavior: 'performance' });

    const startTime = Date.now();
    
    // Perform multiple operations
    await prismaClient.user.create({ data: { email: 'perf@example.com' } });
    await prismaClient.user.findMany();
    await prismaClient.user.count();
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    // Should be very fast for mock operations (under 100ms)
    expect(totalTime).toBeLessThan(100);
  });
});