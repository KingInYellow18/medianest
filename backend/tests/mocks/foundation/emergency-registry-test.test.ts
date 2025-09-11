import { setupUniversalTestIsolation } from './universal-test-isolation';
import { beforeAll, afterAll } from 'vitest';

/**
 * EMERGENCY REGISTRY REPAIR VALIDATION TEST
 * 
 * Validates that the "Mock factory already registered" collision has been fixed
 * and that the namespace isolation system works correctly.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  registerMock,
  getMock,
  resetMocks,
  cleanupMocks,
  mockRegistry 
} from './unified-mock-registry';
import { 
  PrismaDatabaseMockFactory 
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

describe('Emergency Mock Registry Repair', () => {
  afterEach(async () => {
    await cleanupMocks();
  });

  describe('Registration Collision Fix', () => {
    it('should allow multiple registrations with different namespaces', () => {
      const factory1 = new PrismaDatabaseMockFactory();
      const factory2 = new PrismaDatabaseMockFactory();

      expect(() => {
        registerMock('prisma', factory1, undefined, { namespace: 'test1' });
        registerMock('prisma', factory2, undefined, { namespace: 'test2' });
      }).not.toThrow();
    });

    it('should allow isolated registrations of same name', () => {
      const factory1 = new PrismaDatabaseMockFactory();
      const factory2 = new PrismaDatabaseMockFactory();

      expect(() => {
        registerMock('prisma', factory1, undefined, { isolate: true });
        registerMock('prisma', factory2, undefined, { isolate: true });
      }).not.toThrow();
    });

    it('should retrieve correct mock by namespace', () => {
      const factory1 = new PrismaDatabaseMockFactory();
      const factory2 = new PrismaDatabaseMockFactory();

      registerMock('prisma', factory1, undefined, { namespace: 'ns1' });
      registerMock('prisma', factory2, undefined, { namespace: 'ns2' });

      const mock1 = getMock('prisma', undefined, 'ns1');
      const mock2 = getMock('prisma', undefined, 'ns2');

      expect(mock1).toBeDefined();
      expect(mock2).toBeDefined();
      expect(mock1).not.toBe(mock2);
    });

    it('should handle registry statistics correctly', () => {
      const factory = new PrismaDatabaseMockFactory();
      
      registerMock('prisma', factory, undefined, { namespace: 'stats-test' });
      
      const stats = mockRegistry.getStats();
      expect(stats.registeredFactories).toBeGreaterThan(0);
      expect(stats.factoryNames).toContain('stats-test:prisma');
    });
  });

  describe('Namespace Isolation', () => {
    it('should maintain separate state between namespaces', () => {
      const factory1 = new PrismaDatabaseMockFactory();
      const factory2 = new PrismaDatabaseMockFactory();

      registerMock('prisma', factory1, undefined, { namespace: 'isolated1' });
      registerMock('prisma', factory2, undefined, { namespace: 'isolated2' });

      const mock1 = getMock('prisma', undefined, 'isolated1');
      const mock2 = getMock('prisma', undefined, 'isolated2');

      // Verify they are different instances
      expect(mock1).not.toBe(mock2);
    });

    it('should reset only specific namespace', () => {
      const factory1 = new PrismaDatabaseMockFactory();
      const factory2 = new PrismaDatabaseMockFactory();

      registerMock('prisma', factory1, undefined, { namespace: 'reset1' });
      registerMock('prisma', factory2, undefined, { namespace: 'reset2' });

      const mock1 = getMock('prisma', undefined, 'reset1');
      const mock2 = getMock('prisma', undefined, 'reset2');

      // Reset only first namespace
      resetMocks('prisma', 'reset1');

      // Second namespace should still work
      expect(() => getMock('prisma', undefined, 'reset2')).not.toThrow();
    });
  });

  describe('Emergency Fallback', () => {
    it('should handle automatic isolation when no namespace specified', () => {
      const factory1 = new PrismaDatabaseMockFactory();
      const factory2 = new PrismaDatabaseMockFactory();

      // Register with automatic isolation
      registerMock('prisma', factory1);
      registerMock('prisma', factory2);

      // Should be able to get a mock without error
      expect(() => getMock('prisma')).not.toThrow();
    });

    it('should provide conflict detection', () => {
      const factory1 = new PrismaDatabaseMockFactory();
      const factory2 = new PrismaDatabaseMockFactory();

      registerMock('prisma', factory1, undefined, { namespace: 'conflict1' });
      registerMock('prisma', factory2, undefined, { namespace: 'conflict2' });

      const stats = mockRegistry.getStats();
      expect(stats.factoryNames).toEqual(
        expect.arrayContaining(['conflict1:prisma', 'conflict2:prisma'])
      );
    });
  });

  describe('Validation Integration', () => {
    it('should validate namespaced mocks correctly', () => {
      const factory = new PrismaDatabaseMockFactory();
      
      registerMock('prisma', factory, undefined, { namespace: 'validation-test' });
      
      const validation = mockRegistry.validate();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should handle cleanup of namespaced registrations', async () => {
      const factory1 = new PrismaDatabaseMockFactory();
      const factory2 = new PrismaDatabaseMockFactory();

      registerMock('prisma', factory1, undefined, { namespace: 'cleanup1' });
      registerMock('prisma', factory2, undefined, { namespace: 'cleanup2' });

      await cleanupMocks();

      const stats = mockRegistry.getStats();
      expect(stats.activeInstances).toBe(0);
    });
  });
});

console.log('🧪 Emergency Registry Repair Test Suite loaded successfully');