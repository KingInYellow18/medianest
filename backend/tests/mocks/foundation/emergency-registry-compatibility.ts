/**
 * EMERGENCY MOCK REGISTRY COMPATIBILITY LAYER
 *
 * Provides backward compatibility and prevents registration conflicts
 * during the foundation rebuild phase.
 *
 * CRITICAL PURPOSE: Eliminate "Mock factory already registered" errors
 * while maintaining full compatibility with existing test infrastructure.
 */

import { vi } from 'vitest';
import {
  registerMock as originalRegisterMock,
  getMock as originalGetMock,
  resetMocks,
  cleanupMocks,
  mockRegistry,
} from './unified-mock-registry';
import type { MockFactory, MockConfig } from './unified-mock-registry';

// =============================================================================
// EMERGENCY CONFLICT DETECTION
// =============================================================================

interface RegistrationAttempt {
  name: string;
  timestamp: number;
  source: string;
  namespace?: string;
}

class EmergencyRegistryManager {
  private static instance: EmergencyRegistryManager;
  private registrationAttempts = new Map<string, RegistrationAttempt[]>();
  private activeNamespaces = new Set<string>();
  private fallbackInstances = new Map<string, any>();

  static getInstance(): EmergencyRegistryManager {
    if (!this.instance) {
      this.instance = new EmergencyRegistryManager();
    }
    return this.instance;
  }

  /**
   * Track registration attempts for conflict analysis
   */
  trackRegistration(name: string, source: string, namespace?: string): void {
    if (!this.registrationAttempts.has(name)) {
      this.registrationAttempts.set(name, []);
    }

    this.registrationAttempts.get(name)!.push({
      name,
      timestamp: Date.now(),
      source,
      namespace,
    });

    if (namespace) {
      this.activeNamespaces.add(namespace);
    }

    // Log potential conflicts
    const attempts = this.registrationAttempts.get(name)!;
    if (attempts.length > 1) {
      console.warn(`⚠️ Multiple registration attempts for '${name}':`, attempts);
    }
  }

  /**
   * Get recommended namespace for a registration
   */
  getRecommendedNamespace(name: string, source: string): string {
    const attempts = this.registrationAttempts.get(name) || [];

    // Extract source directory for automatic namespacing
    const sourceDir = source.includes('/validation/')
      ? 'validation'
      : source.includes('/integration/')
        ? 'integration'
        : source.includes('/unit/')
          ? 'unit'
          : source.includes('/e2e/')
            ? 'e2e'
            : source.includes('/setup/')
              ? 'setup'
              : 'default';

    // Ensure unique namespace
    let namespace = sourceDir;
    let counter = 1;

    while (this.activeNamespaces.has(namespace)) {
      namespace = `${sourceDir}-${counter}`;
      counter++;
    }

    return namespace;
  }

  /**
   * Store fallback instance for emergency access
   */
  storeFallbackInstance(name: string, instance: any): void {
    this.fallbackInstances.set(name, instance);
  }

  /**
   * Get fallback instance if namespace resolution fails
   */
  getFallbackInstance(name: string): any {
    return this.fallbackInstances.get(name);
  }

  /**
   * Clear all tracking data
   */
  reset(): void {
    this.registrationAttempts.clear();
    this.activeNamespaces.clear();
    this.fallbackInstances.clear();
  }

  /**
   * Get conflict report
   */
  getConflictReport(): Record<string, any> {
    const conflicts: Record<string, any> = {};

    for (const [name, attempts] of this.registrationAttempts) {
      if (attempts.length > 1) {
        conflicts[name] = {
          attempts: attempts.length,
          sources: attempts.map((a) => a.source),
          namespaces: attempts.map((a) => a.namespace).filter(Boolean),
          timeline: attempts.map((a) => ({ source: a.source, timestamp: a.timestamp })),
        };
      }
    }

    return {
      totalConflicts: Object.keys(conflicts).length,
      activeNamespaces: Array.from(this.activeNamespaces),
      conflicts,
    };
  }
}

// =============================================================================
// EMERGENCY SAFE REGISTRATION FUNCTIONS
// =============================================================================

/**
 * Safe registration that automatically handles conflicts
 */
export function safeRegisterMock<T>(
  name: string,
  factory: MockFactory<T>,
  options: {
    source?: string;
    forceNamespace?: string;
    allowOverwrite?: boolean;
  } = {},
): string {
  const manager = EmergencyRegistryManager.getInstance();
  const source = options.source || extractSourceFromStackTrace();

  // Track the registration attempt
  manager.trackRegistration(name, source, options.forceNamespace);

  // Determine namespace strategy
  const namespace = options.forceNamespace || manager.getRecommendedNamespace(name, source);

  try {
    // Attempt registration with auto-isolation
    originalRegisterMock(name, factory, undefined, {
      namespace,
      isolate: true,
      overwrite: options.allowOverwrite,
    });

    console.log(`✅ Successfully registered '${name}' in namespace '${namespace}'`);
    return namespace;
  } catch (error) {
    console.error(`❌ Failed to register '${name}' in namespace '${namespace}':`, error);

    // Fallback: Create completely isolated instance
    const isolatedFactory = createIsolatedMockFactory(factory);
    const emergencyNamespace = `emergency-${Date.now()}`;

    try {
      originalRegisterMock(name, isolatedFactory, undefined, {
        namespace: emergencyNamespace,
        isolate: true,
        overwrite: true,
      });

      console.log(`🚨 Emergency registration of '${name}' in namespace '${emergencyNamespace}'`);
      return emergencyNamespace;
    } catch (emergencyError) {
      // Ultimate fallback: Store in emergency manager
      const instance = factory.create();
      manager.storeFallbackInstance(`${namespace}:${name}`, instance);

      console.error(`💥 Ultimate fallback for '${name}': stored in emergency manager`);
      return 'emergency-fallback';
    }
  }
}

/**
 * Safe retrieval that handles namespace resolution automatically
 */
export function safeGetMock<T>(name: string, config?: MockConfig, preferredNamespace?: string): T {
  const manager = EmergencyRegistryManager.getInstance();

  try {
    // Try preferred namespace first
    if (preferredNamespace) {
      return originalGetMock<T>(name, config, preferredNamespace);
    }

    // Try original name without namespace
    return originalGetMock<T>(name, config);
  } catch (error) {
    console.warn(`⚠️ Failed to get '${name}' with standard method:`, error.message);

    // Try emergency fallback
    const fallbackKey = preferredNamespace ? `${preferredNamespace}:${name}` : name;
    const fallbackInstance = manager.getFallbackInstance(fallbackKey);

    if (fallbackInstance) {
      console.log(`🔄 Using emergency fallback for '${name}'`);
      return fallbackInstance;
    }

    // Re-throw if no fallback available
    throw new Error(`Unable to retrieve mock '${name}': ${error.message}`);
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Extract source file from stack trace for automatic namespacing
 */
function extractSourceFromStackTrace(): string {
  const stack = new Error().stack || '';
  const lines = stack.split('\n');

  for (const line of lines) {
    if (line.includes('.test.ts') || line.includes('.spec.ts')) {
      const match = line.match(/\/([^\/]+\.test\.ts|[^\/]+\.spec\.ts)/);
      return match ? match[1] : 'unknown';
    }
  }

  return 'unknown';
}

/**
 * Create completely isolated mock factory wrapper
 */
function createIsolatedMockFactory<T>(originalFactory: MockFactory<T>): MockFactory<T> {
  return {
    create: (config?: MockConfig) => {
      const instance = originalFactory.create(config);

      // Add isolation metadata
      if (instance && typeof instance === 'object') {
        Object.defineProperty(instance, '_isolationId', {
          value: `isolated-${Date.now()}-${Math.random()}`,
          enumerable: false,
          writable: false,
        });
      }

      return instance;
    },

    reset: (instance: T) => {
      if (originalFactory.reset) {
        originalFactory.reset(instance);
      }
    },

    validate: (instance: T) => {
      if (originalFactory.validate) {
        return originalFactory.validate(instance);
      }
      return { valid: true, errors: [], warnings: [] };
    },

    getName: () => {
      return originalFactory.getName ? originalFactory.getName() : 'IsolatedMock';
    },

    getType: () => {
      return originalFactory.getType ? originalFactory.getType() : 'isolated';
    },
  };
}

// =============================================================================
// EMERGENCY CLEANUP AND VALIDATION
// =============================================================================

/**
 * Emergency cleanup of all mock registrations
 */
export async function emergencyCleanup(): Promise<void> {
  const manager = EmergencyRegistryManager.getInstance();

  console.log('🧹 Starting emergency mock registry cleanup...');

  try {
    // Clean up standard registry
    await cleanupMocks();

    // Reset emergency manager
    manager.reset();

    // Clear Vi mocks
    vi.clearAllMocks();
    vi.resetAllMocks();

    console.log('✅ Emergency cleanup completed successfully');
  } catch (error) {
    console.error('❌ Emergency cleanup failed:', error);
    throw error;
  }
}

/**
 * Validate registry state and detect conflicts
 */
export function validateRegistryState(): {
  isValid: boolean;
  conflicts: Record<string, any>;
  recommendations: string[];
} {
  const manager = EmergencyRegistryManager.getInstance();
  const conflictReport = manager.getConflictReport();

  const recommendations: string[] = [];

  if (conflictReport.totalConflicts > 0) {
    recommendations.push('Use namespace isolation for conflicting mock names');
    recommendations.push('Consider consolidating duplicate mock registrations');
    recommendations.push('Implement test file organization by functionality');
  }

  if (conflictReport.activeNamespaces.length > 10) {
    recommendations.push('Consider reducing namespace fragmentation');
  }

  return {
    isValid: conflictReport.totalConflicts === 0,
    conflicts: conflictReport.conflicts,
    recommendations,
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export { EmergencyRegistryManager };

// Re-export safe versions as defaults
export { safeRegisterMock as registerMock, safeGetMock as getMock, resetMocks, cleanupMocks };
