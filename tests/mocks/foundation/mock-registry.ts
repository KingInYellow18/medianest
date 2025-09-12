/**
 * UNIFIED MOCK REGISTRY FOUNDATION
 *
 * Centralized registry for all mock instances with factory patterns,
 * lifecycle management, and validation systems.
 *
 * Features:
 * - Factory Pattern for consistent mock creation
 * - Registry Pattern for centralized management
 * - Strategy Pattern for behavior configuration
 * - Observer Pattern for lifecycle events
 * - Stateless operation ensuring test isolation
 */

import { vi, beforeEach, afterEach } from 'vitest';

// ===========================
// Core Registry Interfaces
// ===========================

export interface MockConfig {
  behavior: 'realistic' | 'error' | 'custom';
  state?: Record<string, any>;
  lifecycle?: MockLifecycle;
  isolation?: boolean;
}

export interface MockFactory<T> {
  create(config?: MockConfig): T;
  reset(instance: T): void;
  validate(instance: T): boolean;
  destroy(instance: T): void;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metrics?: Record<string, any>;
}

export interface MockLifecycle {
  beforeEach?(): void;
  afterEach?(): void;
  beforeAll?(): void;
  afterAll?(): void;
  onError?(error: Error): void;
}

// ===========================
// Mock Registry Implementation
// ===========================

export class MockRegistry {
  private static instance: MockRegistry;
  private factories = new Map<string, MockFactory<any>>();
  private instances = new Map<string, any>();
  private configs = new Map<string, MockConfig>();
  private validators = new Map<string, (instance: any) => ValidationResult>();
  private lifecycleCallbacks = new Set<MockLifecycle>();

  private constructor() {
    this.setupGlobalLifecycle();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): MockRegistry {
    if (!MockRegistry.instance) {
      MockRegistry.instance = new MockRegistry();
    }
    return MockRegistry.instance;
  }

  /**
   * Register a mock factory with collision handling
   */
  register<T>(
    name: string,
    factory: MockFactory<T>,
    validator?: (instance: T) => ValidationResult,
    options?: {
      overwrite?: boolean;
      namespace?: string;
      isolate?: boolean;
    },
  ): void {
    const actualName = options?.namespace ? `${options.namespace}:${name}` : name;

    if (this.factories.has(actualName)) {
      if (options?.overwrite) {
        console.warn(`⚠️ Overwriting existing mock factory '${actualName}'`);
      } else if (options?.isolate) {
        const timestamp = Date.now();
        const isolatedName = `${actualName}:${timestamp}`;
        console.log(`🔒 Creating isolated mock instance '${isolatedName}'`);
        this.factories.set(isolatedName, factory);
        if (validator) {
          this.validators.set(isolatedName, validator);
        }
        return;
      } else {
        console.warn(`Mock factory '${actualName}' already exists, replacing...`);
      }
    }

    this.factories.set(actualName, factory);
    if (validator) {
      this.validators.set(actualName, validator);
    }
  }

  /**
   * Get mock instance with namespace support
   */
  get<T>(name: string, config?: MockConfig, namespace?: string): T {
    const actualName = namespace ? `${namespace}:${name}` : name;

    if (!this.instances.has(actualName)) {
      let factory = this.factories.get(actualName);

      // Try to find isolated instance if direct name fails
      if (!factory && !namespace) {
        const isolatedFactories = Array.from(this.factories.keys())
          .filter((key) => key.startsWith(`${name}:`))
          .sort();

        if (isolatedFactories.length > 0) {
          const latestIsolated = isolatedFactories[isolatedFactories.length - 1];
          factory = this.factories.get(latestIsolated);
          console.log(`🔍 Using isolated mock instance '${latestIsolated}' for '${name}'`);
        }
      }

      if (!factory) {
        throw new Error(`Mock factory '${actualName}' not registered`);
      }

      const mergedConfig: MockConfig = {
        behavior: 'realistic',
        isolation: true,
        ...config,
      };

      const instance = factory.create(mergedConfig);
      this.instances.set(actualName, instance);
      this.configs.set(actualName, mergedConfig);

      // Validate instance
      const validationResult = this.validateInstance(name, instance);
      if (!validationResult.isValid) {
        throw new Error(`Mock '${name}' validation failed: ${validationResult.errors.join(', ')}`);
      }
    }

    return this.instances.get(actualName) as T;
  }

  /**
   * Reset specific mock or all mocks
   */
  reset(name?: string): void {
    if (name) {
      const factory = this.factories.get(name);
      const instance = this.instances.get(name);
      if (factory && instance) {
        factory.reset(instance);
      }
    } else {
      // Reset all mocks
      for (const [mockName, instance] of this.instances) {
        const factory = this.factories.get(mockName);
        if (factory) {
          factory.reset(instance);
        }
      }
    }
  }

  /**
   * Validate mock instance
   */
  private validateInstance(name: string, instance: any): ValidationResult {
    const validator = this.validators.get(name);
    if (validator) {
      return validator(instance);
    }

    // Default validation
    const factory = this.factories.get(name);
    if (factory) {
      return {
        isValid: factory.validate(instance),
        errors: factory.validate(instance) ? [] : [`Mock '${name}' failed factory validation`],
        warnings: [],
      };
    }

    return { isValid: true, errors: [], warnings: [] };
  }

  /**
   * Validate all registered mocks
   */
  validate(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const metrics: Record<string, any> = {};

    for (const [name, instance] of this.instances) {
      const result = this.validateInstance(name, instance);
      if (!result.isValid) {
        errors.push(...result.errors.map((err) => `[${name}] ${err}`));
      }
      warnings.push(...result.warnings.map((warn) => `[${name}] ${warn}`));
      if (result.metrics) {
        metrics[name] = result.metrics;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metrics,
    };
  }

  /**
   * Clean up all mocks
   */
  cleanup(): void {
    for (const [name, instance] of this.instances) {
      const factory = this.factories.get(name);
      if (factory) {
        factory.destroy?.(instance);
      }
    }
    this.instances.clear();
    this.configs.clear();
  }

  /**
   * Add lifecycle callback
   */
  addLifecycleCallback(callback: MockLifecycle): void {
    this.lifecycleCallbacks.add(callback);
  }

  /**
   * Remove lifecycle callback
   */
  removeLifecycleCallback(callback: MockLifecycle): void {
    this.lifecycleCallbacks.delete(callback);
  }

  /**
   * Setup global lifecycle hooks
   */
  private setupGlobalLifecycle(): void {
    beforeEach(() => {
      // Execute all beforeEach callbacks
      for (const callback of this.lifecycleCallbacks) {
        callback.beforeEach?.();
      }

      // Reset all mocks for test isolation
      this.reset();
    });

    afterEach(() => {
      // Execute all afterEach callbacks
      for (const callback of this.lifecycleCallbacks) {
        callback.afterEach?.();
      }

      // Validate all mocks after test
      const validation = this.validate();
      if (!validation.isValid) {
        console.warn('Mock validation warnings after test:', validation.warnings);
      }
    });
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    factoryCount: number;
    instanceCount: number;
    validationResults: ValidationResult;
  } {
    return {
      factoryCount: this.factories.size,
      instanceCount: this.instances.size,
      validationResults: this.validate(),
    };
  }
}

// ===========================
// Stateless Mock Base Class
// ===========================

export abstract class StatelessMock<T> {
  protected initialState: any;
  protected currentInstance: T | null = null;

  constructor() {
    this.initialState = this.captureInitialState();
  }

  /**
   * Create fresh instance with no shared state
   */
  abstract createFreshInstance(): T;

  /**
   * Reset to initial state
   */
  abstract resetToInitialState(): void;

  /**
   * Validate interface completeness
   */
  abstract validateInterface(): boolean;

  /**
   * Capture initial state for reset operations
   */
  protected abstract captureInitialState(): any;

  /**
   * Ensure no shared state between instances
   */
  protected ensureIsolation(): void {
    if (this.currentInstance) {
      this.resetToInitialState();
    }
  }

  /**
   * Get or create instance
   */
  getInstance(): T {
    if (!this.currentInstance) {
      this.currentInstance = this.createFreshInstance();
    }
    return this.currentInstance;
  }

  /**
   * Destroy current instance
   */
  destroy(): void {
    this.currentInstance = null;
    this.resetToInitialState();
  }
}

// ===========================
// Mock Isolation Utilities
// ===========================

export class MockIsolation {
  /**
   * Create isolated mock with no shared state
   */
  static createIsolatedMock<T>(factory: () => T): T {
    const instance = factory();

    // Wrap all methods to ensure isolation
    return new Proxy(instance as any, {
      get(target, prop) {
        const value = target[prop];
        if (typeof value === 'function') {
          return function (...args: any[]) {
            // Clear any shared state before method execution
            MockIsolation.clearSharedState(target);
            return value.apply(target, args);
          };
        }
        return value;
      },
    });
  }

  /**
   * Ensure no shared state between mocks
   */
  static ensureNoSharedState(mock: any): void {
    if (mock && typeof mock === 'object') {
      // Clear any cached state
      if (mock._clearState) {
        mock._clearState();
      }

      // Reset all mock functions
      for (const key of Object.keys(mock)) {
        const value = mock[key];
        if (value && typeof value.mockReset === 'function') {
          value.mockReset();
        }
      }
    }
  }

  /**
   * Validate isolation between two mock instances
   */
  static validateIsolation(mockA: any, mockB: any): boolean {
    if (mockA === mockB) {
      return false; // Same instance, not isolated
    }

    // Check if they share any state
    if (mockA._getState && mockB._getState) {
      const stateA = mockA._getState();
      const stateB = mockB._getState();
      return stateA !== stateB; // Different state objects
    }

    return true; // Assume isolated if no state getter
  }

  /**
   * Clear shared state from mock
   */
  private static clearSharedState(mock: any): void {
    if (mock && typeof mock._clearState === 'function') {
      mock._clearState();
    }
  }
}

// ===========================
// Global Registry Instance
// ===========================

export const mockRegistry = MockRegistry.getInstance();

// ===========================
// Helper Functions
// ===========================

/**
 * Register a mock with the global registry and emergency collision handling
 */
export function registerMock<T>(
  name: string,
  factory: MockFactory<T>,
  validator?: (instance: T) => ValidationResult,
  options?: {
    overwrite?: boolean;
    namespace?: string;
    isolate?: boolean;
  },
): void {
  // EMERGENCY FIX: Default to safe isolation
  const safeOptions = {
    isolate: true,
    ...options,
  };

  mockRegistry.register(name, factory, validator, safeOptions);
}

/**
 * Get mock instance from global registry with namespace support
 */
export function getMock<T>(name: string, config?: MockConfig, namespace?: string): T {
  return mockRegistry.get<T>(name, config, namespace);
}

/**
 * Reset mocks in global registry
 */
export function resetMocks(name?: string): void {
  mockRegistry.reset(name);
}

/**
 * Validate all mocks in global registry
 */
export function validateMocks(): ValidationResult {
  return mockRegistry.validate();
}

/**
 * Clean up all mocks in global registry
 */
export function cleanupMocks(): void {
  mockRegistry.cleanup();
}
