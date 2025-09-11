/**
 * ENTERPRISE MOCK INTEGRATION - 1,199 TEST CAPACITY ORCHESTRATION
 * 
 * Central orchestration layer that integrates all enterprise mock components
 * to handle 1,199+ test capacity with zero state bleeding and perfect isolation.
 * 
 * INTEGRATION COMPONENTS:
 * - Enterprise Mock Registry for concurrent access
 * - Enterprise Service Mocks with StatelessMock patterns
 * - Legacy compatibility layer for existing tests
 * - Performance monitoring and bottleneck detection
 * - Automatic scaling and optimization
 */

import { vi, beforeEach, afterEach } from 'vitest';
import { 
  EnterpriseMockRegistry, 
  enterpriseMockRegistry,
  configureEnterpriseScale,
  registerEnterpriseMock,
  getEnterpriseMock,
  resetEnterpriseMocks,
  getEnterprisePerformanceReport,
  enableLegacyCompatibility
} from './enterprise-mock-registry';

import {
  EnterpriseServiceMockFactory,
  createEnterpriseServiceMock,
  getAvailableEnterpriseServices,
  validateEnterpriseServiceMocks,
  setupEnterpriseServiceMocks,
  resetEnterpriseServiceMock,
  EnterpriseEncryptionServiceMock,
  EnterpriseRedisServiceMock,
  EnterpriseJwtServiceMock,
  EnterpriseDeviceSessionServiceMock,
  EnterprisePlexServiceMock,
  EnterpriseDatabaseMock
} from './enterprise-service-mocks';

import { 
  UnifiedMockRegistry,
  mockRegistry,
  StatelessMock,
  MockIsolation,
  type MockConfig,
  type ValidationResult 
} from './unified-mock-registry';

// =============================================================================
// ENTERPRISE INTEGRATION CONTROLLER
// =============================================================================

export class EnterpriseIntegrationController {
  private static instance: EnterpriseIntegrationController;
  private initialized = false;
  private testSessionId: string | null = null;
  private performanceMonitoring = false;
  private legacyCompatibilityEnabled = false;

  private constructor() {}

  static getInstance(): EnterpriseIntegrationController {
    if (!this.instance) {
      this.instance = new EnterpriseIntegrationController();
    }
    return this.instance;
  }

  /**
   * Initialize enterprise mock system for 1,199 test capacity
   */
  async initializeEnterpriseSystem(options?: {
    maxTests?: number;
    enableMonitoring?: boolean;
    enableLegacySupport?: boolean;
    memoryThresholdMB?: number;
  }): Promise<void> {
    if (this.initialized) {
      console.warn('Enterprise mock system already initialized');
      return;
    }

    const config = {
      maxTests: options?.maxTests || 1199,
      enableMonitoring: options?.enableMonitoring ?? true,
      enableLegacySupport: options?.enableLegacySupport ?? true,
      memoryThresholdMB: options?.memoryThresholdMB || 4096,
    };

    console.log(`🚀 Initializing Enterprise Mock System for ${config.maxTests} test capacity...`);

    // Configure enterprise scaling
    configureEnterpriseScale({
      maxConcurrentTests: config.maxTests,
      instancePoolSize: Math.min(config.maxTests / 10, 200), // 10% pool size, max 200
      memoryThresholdMB: config.memoryThresholdMB,
      enablePerformanceMonitoring: config.enableMonitoring,
      emergencyCompatibilityMode: config.enableLegacySupport,
    });

    // Register all enterprise service mocks
    await this.registerAllEnterpriseServices();

    // Enable legacy compatibility if requested
    if (config.enableLegacySupport) {
      enableLegacyCompatibility();
      this.legacyCompatibilityEnabled = true;
    }

    // Set up performance monitoring
    if (config.enableMonitoring) {
      this.enablePerformanceMonitoring();
    }

    // Validate system integrity
    const validation = await this.validateSystemIntegrity();
    if (!validation.valid) {
      throw new Error(`Enterprise mock system validation failed: ${validation.errors.join(', ')}`);
    }

    this.initialized = true;
    console.log('✅ Enterprise Mock System initialized successfully');
  }

  /**
   * Create isolated test session for perfect test isolation
   */
  async createTestSession(testId?: string): Promise<string> {
    const sessionId = testId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.testSessionId = sessionId;

    // Pre-warm critical mocks for this session
    await this.preWarmSessionMocks(sessionId);

    return sessionId;
  }

  /**
   * Clean up test session and ensure no state bleeding
   */
  async cleanupTestSession(sessionId?: string): Promise<void> {
    const targetSessionId = sessionId || this.testSessionId;
    
    if (targetSessionId) {
      await resetEnterpriseMocks([targetSessionId]);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }

    this.testSessionId = null;
  }

  /**
   * Get enterprise service mock with session isolation
   */
  getServiceMock<T>(serviceName: string, config?: MockConfig): T {
    if (!this.initialized) {
      throw new Error('Enterprise mock system not initialized. Call initializeEnterpriseSystem() first.');
    }

    return getEnterpriseMock<T>(serviceName, config, this.testSessionId || undefined);
  }

  /**
   * Setup complete mock environment for a test
   */
  async setupTestEnvironment(requiredServices: string[]): Promise<Record<string, any>> {
    const sessionId = await this.createTestSession();
    const mocks: Record<string, any> = {};

    for (const serviceName of requiredServices) {
      mocks[serviceName] = this.getServiceMock(serviceName, { behavior: 'realistic', isolation: true });
    }

    return mocks;
  }

  /**
   * Bulk operations for parallel test execution
   */
  async setupParallelTestEnvironments(testConfigs: Array<{
    testId: string;
    requiredServices: string[];
  }>): Promise<Record<string, Record<string, any>>> {
    const environments: Record<string, Record<string, any>> = {};

    // Process in parallel
    const operations = testConfigs.map(async (config) => {
      const sessionId = await this.createTestSession(config.testId);
      const mocks: Record<string, any> = {};

      for (const serviceName of config.requiredServices) {
        mocks[serviceName] = getEnterpriseMock(serviceName, { behavior: 'realistic', isolation: true }, sessionId);
      }

      environments[config.testId] = mocks;
    });

    await Promise.all(operations);
    return environments;
  }

  /**
   * Performance monitoring and optimization
   */
  getPerformanceReport(): Record<string, any> {
    if (!this.performanceMonitoring) {
      return { message: 'Performance monitoring not enabled' };
    }

    const report = getEnterprisePerformanceReport();
    
    return {
      ...report,
      systemStatus: this.getSystemStatus(),
      recommendations: this.generateOptimizationRecommendations(report),
    };
  }

  /**
   * Health check for the enterprise mock system
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    performance: Record<string, any>;
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check system initialization
    if (!this.initialized) {
      issues.push('Enterprise mock system not initialized');
    }

    // Validate service mocks
    const validation = validateEnterpriseServiceMocks();
    if (!validation.valid) {
      issues.push(...validation.errors);
    }

    // Check performance metrics
    const performance = this.getPerformanceReport();
    
    if (performance.memoryUsageMB > 2048) { // 2GB threshold
      issues.push(`High memory usage: ${performance.memoryUsageMB}MB`);
      recommendations.push('Consider reducing instance pool size or enabling garbage collection');
    }

    if (performance.registryUtilization > 90) {
      issues.push(`High registry utilization: ${performance.registryUtilization}%`);
      recommendations.push('Consider increasing max concurrent tests limit');
    }

    return {
      healthy: issues.length === 0,
      issues,
      performance,
      recommendations,
    };
  }

  private async registerAllEnterpriseServices(): Promise<void> {
    const services = getAvailableEnterpriseServices();
    const registrationPromises = services.map(async (serviceName) => {
      const mockFactory = {
        create: (config?: MockConfig) => createEnterpriseServiceMock(serviceName, config),
        reset: (instance: any) => resetEnterpriseServiceMock(serviceName, instance),
        validate: (instance: any) => ({ valid: true, errors: [], warnings: [] }),
        getName: () => serviceName,
        getType: () => 'enterprise',
      };

      await registerEnterpriseMock(serviceName, mockFactory, {
        priority: serviceName === 'deviceSessionService' ? 'high' : 'medium', // DeviceSessionService gets priority
        poolSize: serviceName === 'database' ? 20 : 10, // Database gets larger pool
      });
    });

    await Promise.all(registrationPromises);
  }

  private async preWarmSessionMocks(sessionId: string): Promise<void> {
    // Pre-warm critical high-usage mocks
    const criticalMocks = ['database', 'redisService', 'jwtService'];
    
    const preWarmPromises = criticalMocks.map(async (serviceName) => {
      // Create and immediately return to pool
      const instance = getEnterpriseMock(serviceName, { behavior: 'realistic' }, sessionId);
      return instance;
    });

    await Promise.all(preWarmPromises);
  }

  private async validateSystemIntegrity(): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate enterprise service mocks
    const serviceValidation = validateEnterpriseServiceMocks();
    errors.push(...serviceValidation.errors);
    warnings.push(...serviceValidation.warnings);

    // Validate registry capacity
    const performanceReport = getEnterprisePerformanceReport();
    if (performanceReport.totalRegisteredMocks === 0) {
      errors.push('No mocks registered in enterprise registry');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metadata: { serviceValidation: serviceValidation.metadata, performance: performanceReport },
    };
  }

  private enablePerformanceMonitoring(): void {
    this.performanceMonitoring = true;
    
    // Set up periodic performance checks
    setInterval(() => {
      const report = getEnterprisePerformanceReport();
      
      if (report.memoryUsageMB > 3072) { // 3GB warning threshold
        console.warn(`⚠️ High memory usage: ${report.memoryUsageMB}MB`);
      }
      
      if (report.registryUtilization > 95) {
        console.warn(`⚠️ Registry near capacity: ${report.registryUtilization}%`);
      }
    }, 30000); // Check every 30 seconds
  }

  private getSystemStatus(): Record<string, any> {
    return {
      initialized: this.initialized,
      hasActiveSession: this.testSessionId !== null,
      performanceMonitoring: this.performanceMonitoring,
      legacyCompatibility: this.legacyCompatibilityEnabled,
      availableServices: getAvailableEnterpriseServices().length,
    };
  }

  private generateOptimizationRecommendations(performance: Record<string, any>): string[] {
    const recommendations: string[] = [];

    if (performance.memoryUsageMB > 1024) {
      recommendations.push('Consider implementing more aggressive garbage collection');
    }

    if (performance.concurrentAccessLocks > 50) {
      recommendations.push('High concurrent access - consider optimizing lock granularity');
    }

    if (performance.registryUtilization > 80) {
      recommendations.push('Consider increasing registry capacity for better performance');
    }

    if (performance.activeInstances > performance.totalRegisteredMocks * 5) {
      recommendations.push('High instance-to-factory ratio - consider instance pooling optimization');
    }

    return recommendations;
  }
}

// =============================================================================
// GLOBAL SETUP HOOKS FOR VITEST INTEGRATION
// =============================================================================

/**
 * Global beforeEach hook for enterprise mock isolation
 */
export async function enterpriseBeforeEach(): Promise<void> {
  const controller = EnterpriseIntegrationController.getInstance();
  
  if (!controller['initialized']) {
    await controller.initializeEnterpriseSystem();
  }
  
  await controller.createTestSession();
}

/**
 * Global afterEach hook for enterprise mock cleanup
 */
export async function enterpriseAfterEach(): Promise<void> {
  const controller = EnterpriseIntegrationController.getInstance();
  await controller.cleanupTestSession();
}

/**
 * Setup enterprise mocks for a specific test file
 */
export function setupEnterpriseTestFile(requiredServices: string[]) {
  const controller = EnterpriseIntegrationController.getInstance();
  let testMocks: Record<string, any> = {};

  beforeEach(async () => {
    testMocks = await controller.setupTestEnvironment(requiredServices);
  });

  afterEach(async () => {
    await controller.cleanupTestSession();
  });

  return () => testMocks;
}

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

export const enterpriseIntegration = EnterpriseIntegrationController.getInstance();

/**
 * Quick setup for most common enterprise mock patterns
 */
export async function quickEnterpriseSetup(options?: {
  services?: string[];
  enableMonitoring?: boolean;
  maxTests?: number;
}): Promise<Record<string, any>> {
  const controller = EnterpriseIntegrationController.getInstance();
  
  await controller.initializeEnterpriseSystem({
    maxTests: options?.maxTests || 1199,
    enableMonitoring: options?.enableMonitoring ?? true,
    enableLegacySupport: true,
  });

  const defaultServices = options?.services || [
    'database',
    'redisService', 
    'jwtService',
    'encryptionService',
    'deviceSessionService'
  ];

  return await controller.setupTestEnvironment(defaultServices);
}

/**
 * Emergency fallback for legacy test compatibility
 */
export function emergencyLegacySetup(): void {
  enableLegacyCompatibility();
  console.warn('⚠️ Emergency legacy compatibility mode enabled');
}

// Re-export everything for convenience
export * from './enterprise-mock-registry';
export * from './enterprise-service-mocks';
export * from './unified-mock-registry';