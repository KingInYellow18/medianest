import { setupUniversalTestIsolation } from '../foundation/universal-test-isolation';
import { beforeAll, afterAll } from 'vitest';

/**
 * Database Mock Validation Tests - Phase A Foundation
 * 
 * Progressive validation test suite for the comprehensive Prisma database mock.
 * Validates mock functionality, interface compliance, behavior patterns,
 * and integration capabilities systematically.
 * 
 * Test Layers:
 * 1. Interface Validation - Complete API surface coverage
 * 2. CRUD Operations - All database operations work correctly
 * 3. Transaction Support - Isolation and rollback functionality
 * 4. Relationship Handling - Proper joins and includes
 * 5. Error Simulation - Realistic error patterns
 * 6. Performance Behavior - Latency and load simulation
 * 7. Integration Testing - Real-world usage patterns
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  PrismaDatabaseMock, 
  PrismaDatabaseMockFactory,
  MockDecimal,
  type MockUser,
  type MockMediaRequest,
  type MockSession,
  type MockSessionToken,
} from '../database/prisma-database-mock';
import { 
  UnifiedMockRegistry,
  mockRegistry,
  registerMock,
  getMock,
  resetMocks,
  validateMocks,
} from '../foundation/unified-mock-registry';
import {
  DatabaseBehaviorOrchestrator,
  DatabasePerformanceSimulator,
  DatabaseErrorInjector,
  createSuccessBehavior,
  createConnectionTimeoutBehavior,
  createConstraintViolationBehavior,
} from '../behaviors/database-behavior-patterns';

// =============================================================================
// TEST SETUP AND UTILITIES
// =============================================================================


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

describe('Database Mock Foundation Validation', () => {
  let mockFactory: PrismaDatabaseMockFactory;
  let prismaClient: any;
  let behaviorOrchestrator: DatabaseBehaviorOrchestrator;

  beforeEach(() => {
    // Initialize mock factory
    mockFactory = new PrismaDatabaseMockFactory();
    
    // Register with unified registry using unique validation namespace for each test
    const testNamespace = `validation-${Date.now()}`;
    registerMock('prisma', mockFactory, undefined, { 
      namespace: testNamespace,
      isolate: true
    });
    
    // Get fresh instance from validation namespace
    prismaClient = getMock('prisma', { behavior: 'realistic' }, testNamespace);
    
    // Initialize behavior orchestrator
    behaviorOrchestrator = new DatabaseBehaviorOrchestrator();
    behaviorOrchestrator.setBehaviorMode('realistic');
  });

  afterEach(() => {
    resetMocks(); // Reset all mocks
    behaviorOrchestrator.reset();
  });

  // =============================================================================
  // LAYER 1: INTERFACE VALIDATION
  // =============================================================================

  describe('Layer 1: Interface Validation', () => {
    it('should have all required connection methods', () => {
      expect(typeof prismaClient.$connect).toBe('function');
      expect(typeof prismaClient.$disconnect).toBe('function');
      expect(typeof prismaClient.$transaction).toBe('function');
      expect(typeof prismaClient.$queryRaw).toBe('function');
      expect(typeof prismaClient.$executeRaw).toBe('function');
    });

    it('should have all model operations', () => {
      const requiredModels = [
        'user', 'mediaRequest', 'session', 'sessionToken', 
        'serviceConfig', 'youtubeDownload', 'serviceStatus', 
        'rateLimit', 'account', 'errorLog', 'notification',
        'serviceMetric', 'serviceIncident', 'verificationToken'
      ];

      requiredModels.forEach(model => {
        expect(prismaClient[model]).toBeDefined();
        expect(typeof prismaClient[model]).toBe('object');
      });
    });

    it('should have all CRUD operations for each model', () => {
      const requiredOperations = [
        'create', 'findUnique', 'findFirst', 'findMany', 
        'update', 'delete', 'count'
      ];

      const testModels = ['user', 'mediaRequest', 'session', 'sessionToken'];

      testModels.forEach(model => {
        requiredOperations.forEach(operation => {
          expect(typeof prismaClient[model][operation]).toBe('function');
        });
      });
    });

    it('should validate mock interface completeness', () => {
      const validation = mockFactory.validate(prismaClient);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      
      // May have warnings for optional operations
      if (validation.warnings.length > 0) {
        console.log('Interface warnings:', validation.warnings);
      }
    });

    it('should register successfully with unified registry', () => {
      const registryStats = mockRegistry.getStats();
      
      expect(registryStats.registeredFactories).toBeGreaterThan(0);
      expect(registryStats.factoryNames).toContain('prisma');
    });
  });

  // =============================================================================
  // LAYER 2: CRUD OPERATIONS VALIDATION
  // =============================================================================

  describe('Layer 2: CRUD Operations', () => {
    describe('User Model Operations', () => {
      it('should create user with all required fields', async () => {
        const userData = {
          email: 'test@example.com',
          name: 'Test User',
          role: 'USER',
          status: 'active',
        };

        const user = await prismaClient.user.create({ data: userData });

        expect(user).toBeDefined();
        expect(user.id).toBeDefined();
        expect(user.email).toBe(userData.email);
        expect(user.name).toBe(userData.name);
        expect(user.role).toBe(userData.role);
        expect(user.status).toBe(userData.status);
        expect(user.createdAt).toBeInstanceOf(Date);
      });

      it('should find user by unique identifier', async () => {
        const userData = {
          email: 'unique@example.com',
          name: 'Unique User',
        };

        const createdUser = await prismaClient.user.create({ data: userData });
        const foundUser = await prismaClient.user.findUnique({
          where: { id: createdUser.id }
        });

        expect(foundUser).toBeDefined();
        expect(foundUser.id).toBe(createdUser.id);
        expect(foundUser.email).toBe(userData.email);
      });

      it('should find multiple users with filtering', async () => {
        const users = [
          { email: 'user1@example.com', name: 'User 1', role: 'USER' },
          { email: 'user2@example.com', name: 'User 2', role: 'ADMIN' },
          { email: 'user3@example.com', name: 'User 3', role: 'USER' },
        ];

        // Create test users
        for (const userData of users) {
          await prismaClient.user.create({ data: userData });
        }

        // Find users with role filter
        const userRoleUsers = await prismaClient.user.findMany({
          where: { role: 'USER' }
        });

        expect(userRoleUsers).toHaveLength(2);
        userRoleUsers.forEach(user => {
          expect(user.role).toBe('USER');
        });
      });

      it('should update user data correctly', async () => {
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

      it('should delete user correctly', async () => {
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

      it('should count users correctly', async () => {
        const initialCount = await prismaClient.user.count();

        // Create test users
        await prismaClient.user.create({ data: { email: 'count1@example.com' } });
        await prismaClient.user.create({ data: { email: 'count2@example.com' } });

        const finalCount = await prismaClient.user.count();
        expect(finalCount).toBe(initialCount + 2);

        // Count with filter
        const userCount = await prismaClient.user.count({
          where: { role: 'USER' }
        });
        expect(userCount).toBeGreaterThanOrEqual(0);
      });
    });

    describe('MediaRequest Model Operations', () => {
      let testUser: MockUser;

      beforeEach(async () => {
        testUser = await prismaClient.user.create({
          data: {
            email: 'mediarequest@example.com',
            name: 'Media User',
          }
        });
      });

      it('should create media request with user relationship', async () => {
        const requestData = {
          userId: testUser.id,
          title: 'Test Movie',
          mediaType: 'movie',
          tmdbId: '12345',
        };

        const request = await prismaClient.mediaRequest.create({
          data: requestData
        });

        expect(request).toBeDefined();
        expect(request.id).toBeDefined();
        expect(request.userId).toBe(testUser.id);
        expect(request.title).toBe(requestData.title);
        expect(request.mediaType).toBe(requestData.mediaType);
        expect(request.status).toBe('pending'); // Default value
        expect(request.createdAt).toBeInstanceOf(Date);
      });

      it('should find media requests with user include', async () => {
        const requestData = {
          userId: testUser.id,
          title: 'Included Movie',
          mediaType: 'movie',
        };

        await prismaClient.mediaRequest.create({ data: requestData });

        const requests = await prismaClient.mediaRequest.findMany({
          where: { userId: testUser.id },
          include: { user: true }
        });

        expect(requests).toHaveLength(1);
        expect(requests[0].user).toBeDefined();
        expect(requests[0].user.id).toBe(testUser.id);
        expect(requests[0].user.email).toBe(testUser.email);
      });

      it('should update media request status', async () => {
        const request = await prismaClient.mediaRequest.create({
          data: {
            userId: testUser.id,
            title: 'Status Update Movie',
            mediaType: 'movie',
          }
        });

        const updatedRequest = await prismaClient.mediaRequest.update({
          where: { id: request.id },
          data: { status: 'completed' }
        });

        expect(updatedRequest.status).toBe('completed');
        expect(updatedRequest.completedAt).toBeInstanceOf(Date);
      });
    });

    describe('Session Model Operations', () => {
      let testUser: MockUser;

      beforeEach(async () => {
        testUser = await prismaClient.user.create({
          data: {
            email: 'session@example.com',
            name: 'Session User',
          }
        });
      });

      it('should create session with proper expiration', async () => {
        const expirationDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        
        const sessionData = {
          sessionToken: 'session-token-123',
          userId: testUser.id,
          expires: expirationDate,
        };

        const session = await prismaClient.session.create({
          data: sessionData
        });

        expect(session).toBeDefined();
        expect(session.id).toBeDefined();
        expect(session.sessionToken).toBe(sessionData.sessionToken);
        expect(session.userId).toBe(testUser.id);
        expect(session.expires).toEqual(expirationDate);
      });

      it('should find session with user relationship', async () => {
        const sessionData = {
          sessionToken: 'relation-token-456',
          userId: testUser.id,
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        };

        await prismaClient.session.create({ data: sessionData });

        const session = await prismaClient.session.findUnique({
          where: { sessionToken: sessionData.sessionToken },
          include: { user: true }
        });

        expect(session).toBeDefined();
        expect(session.user).toBeDefined();
        expect(session.user.id).toBe(testUser.id);
      });
    });
  });

  // =============================================================================
  // LAYER 3: TRANSACTION SUPPORT VALIDATION
  // =============================================================================

  describe('Layer 3: Transaction Support', () => {
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
          const user = await tx.user.create({ data: userData });
          
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

    it('should handle nested operations in transaction', async () => {
      const userData = {
        email: 'nested@example.com',
        name: 'Nested User',
      };

      const result = await prismaClient.$transaction(async (tx: any) => {
        // Create user
        const user = await tx.user.create({ data: userData });
        
        // Create multiple related records
        const mediaRequest = await tx.mediaRequest.create({
          data: {
            userId: user.id,
            title: 'Nested Movie',
            mediaType: 'movie',
          }
        });

        const sessionToken = await tx.sessionToken.create({
          data: {
            userId: user.id,
            tokenHash: 'nested-hash-123',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          }
        });

        return { user, mediaRequest, sessionToken };
      });

      expect(result.user).toBeDefined();
      expect(result.mediaRequest).toBeDefined();
      expect(result.sessionToken).toBeDefined();
      
      // All should reference the same user
      expect(result.mediaRequest.userId).toBe(result.user.id);
      expect(result.sessionToken.userId).toBe(result.user.id);
    });
  });

  // =============================================================================
  // LAYER 4: RELATIONSHIP HANDLING VALIDATION
  // =============================================================================

  describe('Layer 4: Relationship Handling', () => {
    let testUser: MockUser;

    beforeEach(async () => {
      testUser = await prismaClient.user.create({
        data: {
          email: 'relationships@example.com',
          name: 'Relationship User',
        }
      });
    });

    it('should handle one-to-many relationships', async () => {
      // Create multiple media requests for the user
      const requests = [
        { title: 'Movie 1', mediaType: 'movie' },
        { title: 'Movie 2', mediaType: 'movie' },
        { title: 'Show 1', mediaType: 'tv' },
      ];

      for (const requestData of requests) {
        await prismaClient.mediaRequest.create({
          data: {
            ...requestData,
            userId: testUser.id,
          }
        });
      }

      // Find user with all media requests
      const userWithRequests = await prismaClient.user.findUnique({
        where: { id: testUser.id },
        include: { mediaRequests: true }
      });

      expect(userWithRequests).toBeDefined();
      expect(userWithRequests.mediaRequests).toHaveLength(3);
      
      // Verify all requests belong to the user
      userWithRequests.mediaRequests.forEach((request: any) => {
        expect(request.userId).toBe(testUser.id);
      });
    });

    it('should handle many-to-one relationships', async () => {
      const mediaRequest = await prismaClient.mediaRequest.create({
        data: {
          userId: testUser.id,
          title: 'Relationship Movie',
          mediaType: 'movie',
        }
      });

      // Find media request with user
      const requestWithUser = await prismaClient.mediaRequest.findUnique({
        where: { id: mediaRequest.id },
        include: { user: true }
      });

      expect(requestWithUser).toBeDefined();
      expect(requestWithUser.user).toBeDefined();
      expect(requestWithUser.user.id).toBe(testUser.id);
      expect(requestWithUser.user.email).toBe(testUser.email);
    });

    it('should handle multiple relationship includes', async () => {
      // Create related data
      await prismaClient.mediaRequest.create({
        data: {
          userId: testUser.id,
          title: 'Multi Relationship Movie',
          mediaType: 'movie',
        }
      });

      await prismaClient.sessionToken.create({
        data: {
          userId: testUser.id,
          tokenHash: 'multi-hash-456',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        }
      });

      // Find user with multiple includes
      const userWithRelations = await prismaClient.user.findUnique({
        where: { id: testUser.id },
        include: {
          mediaRequests: true,
          sessionTokens: true,
        }
      });

      expect(userWithRelations).toBeDefined();
      expect(userWithRelations.mediaRequests).toHaveLength(1);
      expect(userWithRelations.sessionTokens).toHaveLength(1);
    });
  });

  // =============================================================================
  // LAYER 5: ERROR SIMULATION VALIDATION
  // =============================================================================

  describe('Layer 5: Error Simulation', () => {
    let errorInjector: DatabaseErrorInjector;

    beforeEach(() => {
      errorInjector = behaviorOrchestrator.getErrorInjector();
    });

    it('should simulate connection timeout errors', async () => {
      // Configure high error rate for testing
      errorInjector.setGlobalErrorRate(1.0); // 100% error rate
      errorInjector.addErrorScenario('test_timeout', {
        name: 'test_timeout',
        probability: 1.0,
        errorType: 'P1008',
        message: 'Operations timed out after 10000ms',
        retryable: true,
      });

      const errorCheck = errorInjector.shouldTriggerError('user.create');
      expect(errorCheck.shouldError).toBe(true);
      expect(errorCheck.error?.errorType).toBe('P1008');
    });

    it('should simulate constraint violation errors', async () => {
      // Create user first
      await prismaClient.user.create({
        data: {
          email: 'constraint@example.com',
          name: 'Constraint User',
        }
      });

      // Configure unique constraint error
      errorInjector.setOperationErrorRate('user.create', 1.0);
      errorInjector.addErrorScenario('unique_test', {
        name: 'unique_test',
        probability: 1.0,
        errorType: 'P2002',
        message: 'Unique constraint failed on the fields: (`email`)',
        retryable: false,
      });

      const errorCheck = errorInjector.shouldTriggerError('user.create', {
        email: 'constraint@example.com'
      });

      expect(errorCheck.shouldError).toBe(true);
      expect(errorCheck.error?.retryable).toBe(false);
    });

    it('should create proper Prisma error objects', () => {
      const errorDetails = {
        code: 'P2002',
        message: 'Unique constraint failed',
        meta: { target: ['email'] },
      };

      const prismaError = errorInjector.createPrismaError(errorDetails);

      expect(prismaError).toBeInstanceOf(Error);
      expect(prismaError.message).toBe(errorDetails.message);
      expect((prismaError as any).code).toBe(errorDetails.code);
      expect((prismaError as any).meta).toEqual(errorDetails.meta);
      expect((prismaError as any).name).toBe('PrismaClientKnownRequestError');
    });
  });

  // =============================================================================
  // LAYER 6: PERFORMANCE BEHAVIOR VALIDATION
  // =============================================================================

  describe('Layer 6: Performance Behavior', () => {
    let performanceSimulator: DatabasePerformanceSimulator;

    beforeEach(() => {
      performanceSimulator = behaviorOrchestrator.getPerformanceSimulator();
    });

    it('should calculate realistic latency', () => {
      const simpleLatency = performanceSimulator.calculateLatency('user.findUnique', 'simple');
      const complexLatency = performanceSimulator.calculateLatency('user.aggregate', 'complex');

      expect(simpleLatency).toBeGreaterThan(0);
      expect(complexLatency).toBeGreaterThan(simpleLatency);
    });

    it('should handle connection pool management', () => {
      const connection1 = performanceSimulator.acquireConnection();
      const connection2 = performanceSimulator.acquireConnection();

      expect(connection1.success).toBe(true);
      expect(connection2.success).toBe(true);

      performanceSimulator.releaseConnection();
      performanceSimulator.releaseConnection();

      // Should be able to acquire again
      const connection3 = performanceSimulator.acquireConnection();
      expect(connection3.success).toBe(true);
    });

    it('should simulate connection pool exhaustion', () => {
      // Acquire all connections
      const connections = [];
      for (let i = 0; i < 25; i++) { // More than pool size
        connections.push(performanceSimulator.acquireConnection());
      }

      const lastConnection = connections[connections.length - 1];
      expect(lastConnection.success).toBe(false);
      expect(lastConnection.error).toContain('pool exhausted');
    });

    it('should detect operation complexity correctly', () => {
      expect(performanceSimulator.getOperationComplexity('user.findUnique')).toBe('simple');
      expect(performanceSimulator.getOperationComplexity('user.findMany', { include: { posts: true } })).toBe('medium');
      expect(performanceSimulator.getOperationComplexity('user.aggregate')).toBe('complex');
      expect(performanceSimulator.getOperationComplexity('$transaction')).toBe('medium');
    });
  });

  // =============================================================================
  // LAYER 7: INTEGRATION TESTING
  // =============================================================================

  describe('Layer 7: Integration Testing', () => {
    it('should handle realistic user workflow', async () => {
      // Simulate complete user workflow
      
      // 1. Create user
      const user = await prismaClient.user.create({
        data: {
          email: 'workflow@example.com',
          name: 'Workflow User',
          role: 'USER',
        }
      });

      // 2. Create session
      const session = await prismaClient.session.create({
        data: {
          sessionToken: 'workflow-session-789',
          userId: user.id,
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        }
      });

      // 3. Create media request
      const mediaRequest = await prismaClient.mediaRequest.create({
        data: {
          userId: user.id,
          title: 'Workflow Movie',
          mediaType: 'movie',
          tmdbId: '98765',
        }
      });

      // 4. Update request status
      const updatedRequest = await prismaClient.mediaRequest.update({
        where: { id: mediaRequest.id },
        data: { status: 'completed' }
      });

      // 5. Find user with all related data
      const userWithData = await prismaClient.user.findUnique({
        where: { id: user.id },
        include: {
          sessions: true,
          mediaRequests: true,
        }
      });

      // Validate workflow
      expect(userWithData).toBeDefined();
      expect(userWithData.sessions).toHaveLength(1);
      expect(userWithData.mediaRequests).toHaveLength(1);
      expect(userWithData.mediaRequests[0].status).toBe('completed');
    });

    it('should handle concurrent operations', async () => {
      // Simulate concurrent user creation
      const userPromises = Array.from({ length: 5 }, (_, i) =>
        prismaClient.user.create({
          data: {
            email: `concurrent${i}@example.com`,
            name: `Concurrent User ${i}`,
          }
        })
      );

      const users = await Promise.all(userPromises);
      
      expect(users).toHaveLength(5);
      users.forEach((user, index) => {
        expect(user.email).toBe(`concurrent${index}@example.com`);
        expect(user.name).toBe(`Concurrent User ${index}`);
      });

      // Verify all users exist
      const totalUsers = await prismaClient.user.count();
      expect(totalUsers).toBeGreaterThanOrEqual(5);
    });

    it('should handle complex query operations', async () => {
      // Create test data
      const users = await Promise.all([
        prismaClient.user.create({
          data: { email: 'complex1@example.com', name: 'User 1', role: 'USER' }
        }),
        prismaClient.user.create({
          data: { email: 'complex2@example.com', name: 'User 2', role: 'ADMIN' }
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

      // Complex query with multiple filters and includes
      const results = await prismaClient.mediaRequest.findMany({
        where: {
          AND: [
            { mediaType: 'movie' },
            { status: 'pending' },
            { user: { role: 'USER' } }
          ]
        },
        include: { user: true },
        orderBy: { createdAt: 'desc' }
      });

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Movie A');
      expect(results[0].user.role).toBe('USER');
    });
  });

  // =============================================================================
  // COMPREHENSIVE VALIDATION SUITE
  // =============================================================================

  describe('Comprehensive Foundation Validation', () => {
    it('should pass complete mock registry validation', () => {
      const validation = validateMocks();
      
      expect(validation.valid).toBe(true);
      
      if (validation.errors.length > 0) {
        console.error('Validation errors:', validation.errors);
      }
      
      if (validation.warnings.length > 0) {
        console.warn('Validation warnings:', validation.warnings);
      }
      
      expect(validation.errors).toHaveLength(0);
    });

    it('should maintain consistent performance across operations', async () => {
      const operations = [
        () => prismaClient.user.create({ data: { email: 'perf1@example.com' } }),
        () => prismaClient.user.findMany({ take: 10 }),
        () => prismaClient.user.count(),
        () => prismaClient.mediaRequest.findMany({ include: { user: true } }),
      ];

      const startTime = Date.now();
      
      await Promise.all(operations.map(op => op()));
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Performance should be reasonable (under 1 second for mock operations)
      expect(totalTime).toBeLessThan(1000);
    });

    it('should provide comprehensive statistics', () => {
      const registryStats = mockRegistry.getStats();
      const behaviorStats = behaviorOrchestrator.getStats();
      
      expect(registryStats).toHaveProperty('registeredFactories');
      expect(registryStats).toHaveProperty('activeInstances');
      expect(registryStats).toHaveProperty('factoryNames');
      
      expect(behaviorStats).toHaveProperty('behaviorMode');
      expect(behaviorStats).toHaveProperty('performanceCharacteristics');
      expect(behaviorStats).toHaveProperty('errorInjectionStats');
    });

    it('should handle mock lifecycle correctly', async () => {
      // Test lifecycle hooks
      let hooksCalled = 0;
      
      mockRegistry.registerLifecycle('prisma', {
        beforeEach: () => { hooksCalled++; },
        afterEach: () => { hooksCalled++; },
      });

      await mockRegistry.executeHook('beforeEach');
      await mockRegistry.executeHook('afterEach');
      
      expect(hooksCalled).toBe(2);
    });

    it('should support behavior mode switching', async () => {
      // Test realistic mode
      behaviorOrchestrator.setBehaviorMode('realistic');
      expect(behaviorOrchestrator.getStats().behaviorMode).toBe('realistic');
      
      // Test error mode
      behaviorOrchestrator.setBehaviorMode('error');
      expect(behaviorOrchestrator.getStats().behaviorMode).toBe('error');
      
      // Test performance mode
      behaviorOrchestrator.setBehaviorMode('performance');
      expect(behaviorOrchestrator.getStats().behaviorMode).toBe('performance');
    });
  });
});

// =============================================================================
// EXPORT FOR INTEGRATION TESTING
// =============================================================================

export {
  PrismaDatabaseMock,
  PrismaDatabaseMockFactory,
  DatabaseBehaviorOrchestrator,
};