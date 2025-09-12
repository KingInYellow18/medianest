/**
 * Unified Mock Registry - Phase A Database Foundation
 * 
 * Enterprise-grade centralized mock management system for MediaNest.
 * Provides unified registration, lifecycle management, and validation for all mocks.
 * 
 * Key Features:
 * - Centralized mock registration and factory management
 * - Complete test isolation with stateless operation
 * - Progressive validation with early failure detection
 * - Standardized lifecycle hooks and cleanup procedures
 * - Type-safe mock creation and configuration
 */

import { vi, type MockedFunction } from 'vitest';

// =============================================================================
// CORE INTERFACES AND TYPES
// =============================================================================

export interface MockConfig {
  behavior: 'realistic' | 'error' | 'custom';
  state?: Record<string, any>;
  lifecycle?: MockLifecycle;
  isolation?: boolean;
  validation?: boolean;
}

export interface MockLifecycle {
  beforeEach?: () => void | Promise<void>;
  afterEach?: () => void | Promise<void>;
  beforeAll?: () => void | Promise<void>;
  afterAll?: () => void | Promise<void>;
  onError?: (error: Error) => void;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: Record<string, any>;
}

export interface MockFactory<T> {
  create(config?: MockConfig): T;
  reset(instance: T): void;
  validate(instance: T): ValidationResult;
  getName(): string;
  getType(): string;
}

// =============================================================================
// ABSTRACT BASE CLASSES
// =============================================================================

/**
 * Base class for all stateless mocks ensuring test isolation
 */
export abstract class StatelessMock<T> {
  protected config: MockConfig;
  protected instance: T | null = null;

  constructor(config: MockConfig = { behavior: 'realistic' }) {
    this.config = config;
  }

  abstract createFreshInstance(): T;
  abstract resetToInitialState(): void;
  abstract validateInterface(): ValidationResult;

  /**
   * Get a clean instance for test execution
   */
  public getInstance(): T {
    if (!this.instance || this.config.isolation !== false) {
      this.instance = this.createFreshInstance();
    }
    return this.instance;
  }

  /**
   * Ensure no shared state between instances
   */
  public ensureIsolation(): void {
    if (this.instance) {
      this.resetToInitialState();
      this.instance = null;
    }
  }

  /**
   * Validate mock integrity
   */
  public validate(): ValidationResult {
    const interfaceResult = this.validateInterface();
    const isolationResult = this.validateIsolation();
    
    return {
      valid: interfaceResult.valid && isolationResult.valid,
      errors: [...interfaceResult.errors, ...isolationResult.errors],
      warnings: [...interfaceResult.warnings, ...isolationResult.warnings],
      metadata: {
        interface: interfaceResult.metadata,
        isolation: isolationResult.metadata,
      },
    };
  }

  private validateIsolation(): ValidationResult {
    // Check for shared state contamination
    const instance1 = this.createFreshInstance();
    const instance2 = this.createFreshInstance();
    
    // Basic isolation check - instances should be different objects
    const isolated = instance1 !== instance2;
    
    return {
      valid: isolated,
      errors: isolated ? [] : ['Mock instances share state - isolation failure'],
      warnings: [],
      metadata: { isolated },
    };
  }
}

/**
 * Mock isolation utilities for preventing cross-test contamination
 */
export class MockIsolation {
  private static readonly instanceRegistry = new WeakMap<any, string>();
  private static instanceCounter = 0;

  /**
   * Create completely isolated mock instance
   */
  static createIsolatedMock<T>(factory: () => T): T {
    const instance = factory();
    const id = `mock-${++this.instanceCounter}-${Date.now()}`;
    this.instanceRegistry.set(instance, id);
    return instance;
  }

  /**
   * Validate no shared state between mock instances
   */
  static validateIsolation(mockA: any, mockB: any): ValidationResult {
    const idA = this.instanceRegistry.get(mockA);
    const idB = this.instanceRegistry.get(mockB);
    
    const isolated = idA !== idB && mockA !== mockB;
    
    return {
      valid: isolated,
      errors: isolated ? [] : ['Mock instances not properly isolated'],
      warnings: [],
      metadata: { idA, idB, isolated },
    };
  }

  /**
   * Ensure mock has no shared state
   */
  static ensureNoSharedState(mock: any): void {
    // Clear any prototype pollution or shared references
    if (mock && typeof mock === 'object') {
      Object.setPrototypeOf(mock, Object.prototype);
    }
  }

  /**
   * Clean up all tracked instances
   */
  static cleanup(): void {
    // WeakMap automatically handles cleanup, but we reset counter
    this.instanceCounter = 0;
  }
}

// =============================================================================
// UNIFIED MOCK REGISTRY
// =============================================================================

/**
 * Central registry for all mock instances and factories
 */
export class UnifiedMockRegistry {
  private static instance: UnifiedMockRegistry;
  private factories = new Map<string, MockFactory<any>>();
  private instances = new Map<string, any>();
  private lifecycleHooks = new Map<string, MockLifecycle>();
  private validationEnabled = true;

  private constructor() {}

  static getInstance(): UnifiedMockRegistry {
    if (!this.instance) {
      this.instance = new UnifiedMockRegistry();
    }
    return this.instance;
  }

  /**
   * Register a mock factory with the registry
   * EMERGENCY FIX: Handle registration conflicts with namespace isolation
   */
  register<T>(name: string, factory: MockFactory<T>, options?: { 
    overwrite?: boolean; 
    namespace?: string;
    isolate?: boolean;
  }): void {
    const actualName = options?.namespace ? `${options.namespace}:${name}` : name;
    
    if (this.factories.has(actualName)) {
      if (options?.overwrite) {
        console.warn(`⚠️ Overwriting existing mock factory '${actualName}'`);
        this.factories.delete(actualName);
      } else if (options?.isolate && !options?.namespace) {
        // Create unique isolated instance only if no namespace specified
        const timestamp = Date.now();
        const isolatedName = `${name}:${timestamp}`;
        console.log(`🔒 Creating isolated mock instance '${isolatedName}'`);
        this.factories.set(isolatedName, factory);
        return;
      } else {
        throw new Error(`Mock factory '${actualName}' is already registered`);
      }
    }
    
    this.factories.set(actualName, factory);
    
    // Validate factory immediately
    if (this.validationEnabled) {
      const testInstance = factory.create({ behavior: 'realistic' });
      const validation = factory.validate(testInstance);
      
      if (!validation.valid) {
        throw new Error(
          `Mock factory '${name}' failed validation: ${validation.errors.join(', ')}`
        );
      }
    }
  }

  /**
   * Get mock instance by name with namespace support
   */
  get<T>(name: string, config?: MockConfig, namespace?: string): T {
    const actualName = namespace ? `${namespace}:${name}` : name;
    let factory = this.factories.get(actualName);
    
    // EMERGENCY FIX: Try to find isolated instance if direct name fails
    if (!factory && !namespace) {
      const isolatedFactories = Array.from(this.factories.keys())
        .filter(key => key.startsWith(`${name}:`))
        .sort(); // Get most recent
      
      if (isolatedFactories.length > 0) {
        const latestIsolated = isolatedFactories[isolatedFactories.length - 1];
        factory = this.factories.get(latestIsolated);
        console.log(`🔍 Using isolated mock instance '${latestIsolated}' for '${name}'`);
      }
    }
    
    if (!factory) {
      throw new Error(`Mock factory '${actualName}' not found`);
    }

    // Create fresh instance for each request (stateless)
    const instance = MockIsolation.createIsolatedMock(() => 
      factory.create(config)
    );

    // Store for lifecycle management
    this.instances.set(`${name}-${Date.now()}`, instance);

    return instance;
  }

  /**
   * Reset specific mock or all mocks with namespace support
   */
  reset(name?: string, namespace?: string): void {
    if (name) {
      const actualName = namespace ? `${namespace}:${name}` : name;
      
      // Try exact match first
      let factory = this.factories.get(actualName);
      
      // If not found and no namespace specified, try to find any namespaced version
      if (!factory && !namespace) {
        const namespacedKeys = Array.from(this.factories.keys()).filter(key => 
          key.includes(':') && key.endsWith(`:${name}`) || key.startsWith(`${name}:`)
        );
        
        if (namespacedKeys.length > 0) {
          factory = this.factories.get(namespacedKeys[0]);
        }
      }
      
      if (factory) {
        // Reset all instances of this mock type
        for (const [key, instance] of this.instances) {
          if (key.startsWith(actualName) || (!namespace && key.includes(`:${name}`))) {
            factory.reset(instance);
            this.instances.delete(key);
          }
        }
      }
    } else {
      // Reset all mocks
      for (const [key, instance] of this.instances) {
        const mockName = key.split('-')[0];
        // Handle namespaced mock names
        const baseName = mockName.includes(':') ? mockName.split(':')[1] : mockName;
        const factory = this.factories.get(mockName) || 
                       Array.from(this.factories.values()).find(f => 
                         f.getName && f.getName().includes(baseName)
                       );
        
        if (factory) {
          factory.reset(instance);
        }
      }
      this.instances.clear();
      MockIsolation.cleanup();
    }
  }

  /**
   * Validate all registered mocks
   */
  validate(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const metadata: Record<string, any> = {};

    for (const [name, factory] of this.factories) {
      try {
        const testInstance = factory.create({ behavior: 'realistic' });
        const validation = factory.validate(testInstance);
        
        metadata[name] = validation.metadata;
        
        if (!validation.valid) {
          errors.push(`Mock '${name}': ${validation.errors.join(', ')}`);
        }
        
        warnings.push(...validation.warnings.map(w => `Mock '${name}': ${w}`));
      } catch (error) {
        errors.push(`Mock '${name}': Factory creation failed - ${error.message}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metadata,
    };
  }

  /**
   * Register lifecycle hooks for a mock
   */
  registerLifecycle(name: string, lifecycle: MockLifecycle): void {
    this.lifecycleHooks.set(name, lifecycle);
  }

  /**
   * Execute lifecycle hooks
   */
  async executeHook(phase: keyof MockLifecycle, mockName?: string): Promise<void> {
    const hooks = mockName 
      ? [this.lifecycleHooks.get(mockName)].filter(Boolean)
      : Array.from(this.lifecycleHooks.values());

    for (const lifecycle of hooks) {
      const hook = lifecycle[phase];
      if (hook) {
        try {
          await hook();
        } catch (error) {
          if (lifecycle.onError) {
            lifecycle.onError(error);
          } else {
            console.error(`Mock lifecycle hook '${phase}' failed:`, error);
          }
        }
      }
    }
  }

  /**
   * Clean up all mocks and reset registry
   */
  async cleanup(): Promise<void> {
    await this.executeHook('afterAll');
    
    for (const [key, instance] of this.instances) {
      const mockName = key.split('-')[0];
      const factory = this.factories.get(mockName);
      if (factory) {
        factory.reset(instance);
      }
    }
    
    this.instances.clear();
    MockIsolation.cleanup();
  }

  /**
   * Get registry statistics
   */
  getStats(): Record<string, any> {
    return {
      registeredFactories: this.factories.size,
      activeInstances: this.instances.size,
      lifecycleHooks: this.lifecycleHooks.size,
      validationEnabled: this.validationEnabled,
      factoryNames: Array.from(this.factories.keys()),
    };
  }

  /**
   * Enable/disable validation
   */
  setValidation(enabled: boolean): void {
    this.validationEnabled = enabled;
  }
}

// =============================================================================
// EXPORT CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Get the global mock registry instance
 */
export const mockRegistry = UnifiedMockRegistry.getInstance();

/**
 * Register a mock factory with emergency collision handling
 */
export function registerMock<T>(
  name: string, 
  factory: MockFactory<T>, 
  validator?: any,
  options?: { 
    overwrite?: boolean; 
    namespace?: string;
    isolate?: boolean;
  }
): void {
  // EMERGENCY FIX: Use namespace if provided, otherwise use isolation
  const safeOptions = {
    isolate: !options?.namespace, // Only use isolation if no namespace
    ...options
  };
  
  mockRegistry.register(name, factory, safeOptions);
}

/**
 * Get a mock instance with namespace support
 */
export function getMock<T>(name: string, config?: MockConfig, namespace?: string): T {
  return mockRegistry.get<T>(name, config, namespace);
}

/**
 * Reset mocks with namespace support
 */
export function resetMocks(name?: string, namespace?: string): void {
  mockRegistry.reset(name, namespace);
}

/**
 * Validate all mocks
 */
export function validateMocks(): ValidationResult {
  return mockRegistry.validate();
}

/**
 * Execute global mock lifecycle hooks
 */
export async function executeLifecycleHook(phase: keyof MockLifecycle): Promise<void> {
  await mockRegistry.executeHook(phase);
}

/**
 * Clean up all mocks
 */
export async function cleanupMocks(): Promise<void> {
  await mockRegistry.cleanup();
}