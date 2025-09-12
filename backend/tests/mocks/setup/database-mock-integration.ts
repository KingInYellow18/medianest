/**
 * Database Mock Integration Setup - Phase A Foundation
 *
 * Integration layer that connects the comprehensive Prisma database mock
 * with the existing test infrastructure and provides seamless replacement
 * of the original mock system.
 *
 * Key Features:
 * - Automatic mock registration and lifecycle management
 * - Seamless integration with existing test setup
 * - Environment-specific configuration
 * - Performance monitoring and metrics
 * - Error recovery and fallback mechanisms
 * - Complete backward compatibility
 */

import { vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';

import {
  DatabaseBehaviorOrchestrator,
  createSuccessBehavior,
  createConnectionTimeoutBehavior,
} from '../behaviors/database-behavior-patterns';
import {
  PrismaDatabaseMock,
  PrismaDatabaseMockFactory,
  MockDecimal,
} from '../database/prisma-database-mock';
import {
  registerMock,
  getMock,
  resetMocks,
  cleanupMocks,
  mockRegistry,
  executeLifecycleHook,
} from '../foundation/unified-mock-registry';

// =============================================================================
// CONFIGURATION AND ENVIRONMENT DETECTION
// =============================================================================

interface DatabaseMockConfig {
  behavior: 'realistic' | 'error' | 'performance' | 'custom';
  enableMetrics: boolean;
  enableValidation: boolean;
  performanceCharacteristics?: {
    baseLatency: number;
    variability: number;
    degradationFactor: number;
    connectionPoolSize: number;
  };
  errorInjection?: {
    globalErrorRate: number;
    operationSpecificRates: Record<string, number>;
  };
}

/**
 * Get configuration based on environment
 */
function getDatabaseMockConfig(): DatabaseMockConfig {
  const nodeEnv = process.env.NODE_ENV || 'test';
  const testMode = process.env.TEST_MODE || 'unit';

  // Base configuration
  const baseConfig: DatabaseMockConfig = {
    behavior: 'realistic',
    enableMetrics: true,
    enableValidation: true,
  };

  // Environment-specific overrides
  switch (nodeEnv) {
    case 'test':
      return {
        ...baseConfig,
        behavior: testMode === 'integration' ? 'realistic' : 'performance',
        performanceCharacteristics: {
          baseLatency: testMode === 'unit' ? 0 : 5,
          variability: 0.1,
          degradationFactor: 1.2,
          connectionPoolSize: 10,
        },
        errorInjection: {
          globalErrorRate: 0.001, // Very low for stability
          operationSpecificRates: {},
        },
      };

    case 'development':
      return {
        ...baseConfig,
        behavior: 'realistic',
        performanceCharacteristics: {
          baseLatency: 10,
          variability: 0.3,
          degradationFactor: 1.5,
          connectionPoolSize: 20,
        },
        errorInjection: {
          globalErrorRate: 0.01,
          operationSpecificRates: {},
        },
      };

    default:
      return baseConfig;
  }
}

// =============================================================================
// GLOBAL MOCK SETUP AND MANAGEMENT
// =============================================================================

export class DatabaseMockManager {
  private static instance: DatabaseMockManager;
  private config: DatabaseMockConfig;
  private behaviorOrchestrator: DatabaseBehaviorOrchestrator;
  private mockFactory: PrismaDatabaseMockFactory;
  private isInitialized = false;
  private metrics: {
    operationCount: number;
    errorCount: number;
    averageLatency: number;
    startTime: number;
  } = {
    operationCount: 0,
    errorCount: 0,
    averageLatency: 0,
    startTime: Date.now(),
  };

  private constructor() {
    this.config = getDatabaseMockConfig();
    this.behaviorOrchestrator = new DatabaseBehaviorOrchestrator();
    this.mockFactory = new PrismaDatabaseMockFactory();
  }

  static getInstance(): DatabaseMockManager {
    if (!this.instance) {
      this.instance = new DatabaseMockManager();
    }
    return this.instance;
  }

  /**
   * Initialize the database mock system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Configure behavior orchestrator
      this.behaviorOrchestrator.setBehaviorMode(this.config.behavior);

      if (this.config.performanceCharacteristics) {
        const perfSimulator = this.behaviorOrchestrator.getPerformanceSimulator();
        // Apply configuration to performance simulator
        // Note: This would require extending the performance simulator to accept config
      }

      if (this.config.errorInjection) {
        const errorInjector = this.behaviorOrchestrator.getErrorInjector();
        errorInjector.setGlobalErrorRate(this.config.errorInjection.globalErrorRate);

        for (const [operation, rate] of Object.entries(
          this.config.errorInjection.operationSpecificRates,
        )) {
          errorInjector.setOperationErrorRate(operation, rate);
        }
      }

      // Register mock factory with integration namespace
      registerMock('prisma', this.mockFactory, undefined, {
        namespace: 'integration',
        isolate: true,
      });

      // Setup lifecycle hooks
      this.setupLifecycleHooks();

      // Setup metrics collection if enabled
      if (this.config.enableMetrics) {
        this.setupMetricsCollection();
      }

      // Setup Vi mock for @prisma/client
      this.setupPrismaClientMock();

      this.isInitialized = true;

      console.log('🗄️ Database Mock Foundation initialized successfully');
      console.log(`📊 Behavior mode: ${this.config.behavior}`);
      console.log(`🔍 Validation: ${this.config.enableValidation ? 'enabled' : 'disabled'}`);
      console.log(`📈 Metrics: ${this.config.enableMetrics ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('❌ Failed to initialize Database Mock Foundation:', error);
      throw error;
    }
  }

  /**
   * Setup lifecycle hooks for automatic management
   */
  private setupLifecycleHooks(): void {
    mockRegistry.registerLifecycle('prisma', {
      beforeEach: async () => {
        await this.beforeEachTest();
      },
      afterEach: async () => {
        await this.afterEachTest();
      },
      beforeAll: async () => {
        await this.beforeAllTests();
      },
      afterAll: async () => {
        await this.afterAllTests();
      },
      onError: (error: Error) => {
        this.handleError(error);
      },
    });
  }

  /**
   * Setup metrics collection
   */
  private setupMetricsCollection(): void {
    // This would hook into the mock operations to collect metrics
    // Implementation would depend on having access to operation calls
    console.log('📊 Metrics collection enabled');
  }

  /**
   * Setup Vi mock for @prisma/client
   */
  private setupPrismaClientMock(): void {
    vi.mock('@prisma/client', () => {
      const mockFactory = this.mockFactory;
      const behaviorOrchestrator = this.behaviorOrchestrator;

      return {
        PrismaClient: vi.fn().mockImplementation(() => {
          const mock = mockFactory.create(this.config);

          // Wrap methods with behavior orchestrator if needed
          if (this.config.behavior !== 'performance') {
            // Apply behavior patterns to operations
            this.wrapMockWithBehavior(mock);
          }

          return mock;
        }),
        Decimal: MockDecimal,
      };
    });
  }

  /**
   * Wrap mock operations with behavior patterns
   */
  private wrapMockWithBehavior(mock: any): void {
    const models = [
      'user',
      'mediaRequest',
      'session',
      'sessionToken',
      'serviceConfig',
      'youtubeDownload',
      'serviceStatus',
      'rateLimit',
      'account',
      'errorLog',
    ];

    models.forEach((modelName) => {
      if (mock[modelName]) {
        const model = mock[modelName];
        const operations = ['create', 'findUnique', 'findMany', 'update', 'delete'];

        operations.forEach((operationName) => {
          if (model[operationName]) {
            const originalMethod = model[operationName];

            model[operationName] = vi.fn().mockImplementation(async (args) => {
              const operationKey = `${modelName}.${operationName}`;

              return this.behaviorOrchestrator.applyBehavior(
                operationKey,
                () => originalMethod.getMockImplementation()(args),
                args,
              );
            });
          }
        });
      }
    });
  }

  /**
   * Get fresh Prisma client instance
   */
  getPrismaClient(): any {
    if (!this.isInitialized) {
      throw new Error('Database Mock Manager not initialized. Call initialize() first.');
    }

    return getMock('prisma', this.config, 'integration');
  }

  /**
   * Before each test hook
   */
  private async beforeEachTest(): Promise<void> {
    // Reset behavior orchestrator state
    this.behaviorOrchestrator.reset();

    // Reset metrics for the test
    this.metrics.operationCount = 0;
    this.metrics.errorCount = 0;

    if (this.config.enableValidation) {
      // Run quick validation
      const validation = this.mockFactory.validate(this.getPrismaClient());
      if (!validation.valid) {
        console.warn('⚠️ Mock validation warnings:', validation.warnings);
      }
    }
  }

  /**
   * After each test hook
   */
  private async afterEachTest(): Promise<void> {
    // Reset mocks to clean state
    resetMocks('prisma');

    // Log metrics if enabled
    if (this.config.enableMetrics && this.metrics.operationCount > 0) {
      console.log(
        `📊 Test metrics: ${this.metrics.operationCount} operations, ${this.metrics.errorCount} errors`,
      );
    }
  }

  /**
   * Before all tests hook
   */
  private async beforeAllTests(): Promise<void> {
    this.metrics.startTime = Date.now();
    console.log('🚀 Starting database mock test suite');
  }

  /**
   * After all tests hook
   */
  private async afterAllTests(): Promise<void> {
    const totalTime = Date.now() - this.metrics.startTime;
    console.log(`✅ Database mock test suite completed in ${totalTime}ms`);

    // Cleanup all resources
    await cleanupMocks();
  }

  /**
   * Handle errors in mock operations
   */
  private handleError(error: Error): void {
    this.metrics.errorCount++;

    console.error('❌ Database mock error:', error.message);

    // Could implement error recovery strategies here
    if (error.message.includes('pool exhausted')) {
      // Reset connection pool
      this.behaviorOrchestrator.getPerformanceSimulator().reset();
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<DatabaseMockConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Apply new configuration
    this.behaviorOrchestrator.setBehaviorMode(this.config.behavior);

    if (newConfig.errorInjection) {
      const errorInjector = this.behaviorOrchestrator.getErrorInjector();
      if (newConfig.errorInjection.globalErrorRate !== undefined) {
        errorInjector.setGlobalErrorRate(newConfig.errorInjection.globalErrorRate);
      }
    }
  }

  /**
   * Cleanup and reset
   */
  async cleanup(): Promise<void> {
    await cleanupMocks();
    this.behaviorOrchestrator.reset();
    this.isInitialized = false;
  }
}

// =============================================================================
// GLOBAL SETUP FUNCTIONS
// =============================================================================

/**
 * Initialize database mock for all tests
 */
export async function setupDatabaseMock(): Promise<void> {
  const manager = DatabaseMockManager.getInstance();
  await manager.initialize();
}

/**
 * Get Prisma client instance for tests
 */
export function getPrismaClient(): any {
  const manager = DatabaseMockManager.getInstance();
  return manager.getPrismaClient();
}

/**
 * Setup test lifecycle hooks
 */
export function setupDatabaseMockLifecycle(): void {
  beforeAll(async () => {
    await executeLifecycleHook('beforeAll');
  });

  afterAll(async () => {
    await executeLifecycleHook('afterAll');
  });

  beforeEach(async () => {
    await executeLifecycleHook('beforeEach');
  });

  afterEach(async () => {
    await executeLifecycleHook('afterEach');
  });
}

/**
 * Configure database mock behavior for specific test scenarios
 */
export function configureDatabaseMockBehavior(config: {
  behavior?: 'realistic' | 'error' | 'performance';
  errorRate?: number;
  latency?: number;
}): void {
  const manager = DatabaseMockManager.getInstance();

  const updateConfig: Partial<DatabaseMockConfig> = {};

  if (config.behavior) {
    updateConfig.behavior = config.behavior;
  }

  if (config.errorRate !== undefined) {
    updateConfig.errorInjection = {
      globalErrorRate: config.errorRate,
      operationSpecificRates: {},
    };
  }

  if (config.latency !== undefined) {
    updateConfig.performanceCharacteristics = {
      baseLatency: config.latency,
      variability: 0.1,
      degradationFactor: 1.2,
      connectionPoolSize: 20,
    };
  }

  manager.updateConfig(updateConfig);
}

// =============================================================================
// COMPATIBILITY LAYER
// =============================================================================

/**
 * Backward compatibility function to replace existing setupPrismaMock
 */
export function setupPrismaMock(): void {
  console.log('🔄 Using enhanced Database Mock Foundation (backward compatible)');
  setupDatabaseMockLifecycle();
}

/**
 * Backward compatibility function to replace existing createPrismaMock
 */
export function createPrismaMock() {
  const manager = DatabaseMockManager.getInstance();

  return vi.hoisted(() => {
    return {
      Decimal: MockDecimal,
      PrismaClient: vi.fn().mockImplementation(() => {
        return manager.getPrismaClient();
      }),
    };
  });
}

// =============================================================================
// EXPORTS
// =============================================================================

// Main setup function
export { setupDatabaseMock as default };

// Core classes and functions
export { DatabaseMockManager, PrismaDatabaseMock, PrismaDatabaseMockFactory, MockDecimal };

// Utility functions
export {
  getDatabaseMockConfig,
  configureDatabaseMockBehavior,
  setupDatabaseMockLifecycle,
  getPrismaClient,
};

// Type exports
export type { DatabaseMockConfig };
