/**
 * Database Behavior Patterns - Phase A Foundation
 *
 * Realistic behavior simulation and error patterns for Prisma database mock.
 * Provides comprehensive error scenarios, performance characteristics,
 * and edge case handling for thorough testing.
 *
 * Key Features:
 * - Realistic timing and latency simulation
 * - Comprehensive error scenario coverage
 * - Connection and constraint error patterns
 * - Performance degradation simulation
 * - Data consistency validation
 * - Edge case and boundary condition handling
 */

import { vi } from 'vitest';

// =============================================================================
// BEHAVIOR CONFIGURATION TYPES
// =============================================================================

export interface DatabaseBehavior {
  type: 'success' | 'error' | 'timeout' | 'performance';
  scenario: string;
  latency?: { min: number; max: number };
  errorType?: string;
  errorMessage?: string;
  retryable?: boolean;
  condition?: (operation: string, data?: any) => boolean;
}

export interface PerformanceCharacteristics {
  baseLatency: number;
  variability: number;
  degradationFactor: number;
  connectionPoolSize: number;
  queryComplexityMultiplier: number;
}

export interface ErrorScenario {
  name: string;
  probability: number;
  errorType: string;
  message: string;
  retryable: boolean;
  recovery?: () => void;
}

// =============================================================================
// ERROR TYPES AND MESSAGES
// =============================================================================

export const DATABASE_ERRORS = {
  // Connection Errors
  CONNECTION_TIMEOUT: {
    type: 'P1008',
    message: 'Operations timed out after 10000ms',
    retryable: true,
  },
  CONNECTION_REFUSED: {
    type: 'P1001',
    message: "Can't reach database server at `localhost:5432`",
    retryable: true,
  },
  CONNECTION_POOL_EXHAUSTED: {
    type: 'P1010',
    message: 'Connection pool exhausted. Try again later.',
    retryable: true,
  },

  // Constraint Violations
  UNIQUE_CONSTRAINT: {
    type: 'P2002',
    message: 'Unique constraint failed on the fields: (`email`)',
    retryable: false,
  },
  FOREIGN_KEY_CONSTRAINT: {
    type: 'P2003',
    message: 'Foreign key constraint failed on the field: `userId`',
    retryable: false,
  },
  RECORD_NOT_FOUND: {
    type: 'P2025',
    message:
      'An operation failed because it depends on one or more records that were required but not found.',
    retryable: false,
  },

  // Data Validation Errors
  NULL_CONSTRAINT: {
    type: 'P2011',
    message: 'Null constraint violation on the fields: (`email`)',
    retryable: false,
  },
  VALUE_TOO_LONG: {
    type: 'P2000',
    message: "The provided value for the column is too long for the column's type.",
    retryable: false,
  },
  INVALID_DATA_TYPE: {
    type: 'P2006',
    message: 'The provided value is not valid for the field type.',
    retryable: false,
  },

  // Transaction Errors
  TRANSACTION_FAILED: {
    type: 'P2034',
    message: 'Transaction failed due to a write conflict or a deadlock.',
    retryable: true,
  },
  DEADLOCK: {
    type: 'P2034',
    message: 'Deadlock detected. Transaction was rolled back.',
    retryable: true,
  },

  // Database Server Errors
  SERVER_ERROR: {
    type: 'P1002',
    message: 'The database server was reached but timed out.',
    retryable: true,
  },
  OUT_OF_MEMORY: {
    type: 'P1014',
    message: 'The underlying SQL Server had an out-of-memory error.',
    retryable: true,
  },
  DISK_FULL: {
    type: 'P1013',
    message: 'The provided database string is invalid.',
    retryable: false,
  },
} as const;

// =============================================================================
// PERFORMANCE SIMULATION
// =============================================================================

export class DatabasePerformanceSimulator {
  private characteristics: PerformanceCharacteristics;
  private currentLoad = 0;
  private connectionCount = 0;

  constructor(
    characteristics: PerformanceCharacteristics = {
      baseLatency: 5,
      variability: 0.3,
      degradationFactor: 1.5,
      connectionPoolSize: 20,
      queryComplexityMultiplier: 2,
    },
  ) {
    this.characteristics = characteristics;
  }

  /**
   * Calculate realistic latency based on operation and current load
   */
  calculateLatency(
    operation: string,
    complexity: 'simple' | 'medium' | 'complex' = 'simple',
  ): number {
    let baseLatency = this.characteristics.baseLatency;

    // Adjust for operation complexity
    const complexityMultipliers = {
      simple: 1,
      medium: this.characteristics.queryComplexityMultiplier,
      complex: this.characteristics.queryComplexityMultiplier * 2,
    };

    baseLatency *= complexityMultipliers[complexity];

    // Apply load-based degradation
    const loadFactor = this.currentLoad / this.characteristics.connectionPoolSize;
    if (loadFactor > 0.8) {
      baseLatency *= this.characteristics.degradationFactor;
    }

    // Add variability
    const variance = baseLatency * this.characteristics.variability;
    const variability = (Math.random() - 0.5) * 2 * variance;

    return Math.max(1, baseLatency + variability);
  }

  /**
   * Simulate connection acquisition
   */
  acquireConnection(): { success: boolean; latency: number; error?: string } {
    this.connectionCount++;
    this.currentLoad = this.connectionCount;

    const latency = this.calculateLatency('connect');

    if (this.connectionCount > this.characteristics.connectionPoolSize) {
      this.connectionCount--;
      return {
        success: false,
        latency,
        error: DATABASE_ERRORS.CONNECTION_POOL_EXHAUSTED.message,
      };
    }

    return { success: true, latency };
  }

  /**
   * Release connection
   */
  releaseConnection(): void {
    this.connectionCount = Math.max(0, this.connectionCount - 1);
    this.currentLoad = this.connectionCount;
  }

  /**
   * Get operation complexity based on query characteristics
   */
  getOperationComplexity(operation: string, data?: any): 'simple' | 'medium' | 'complex' {
    // Simple heuristics for complexity
    if (operation.includes('aggregate') || operation.includes('groupBy')) {
      return 'complex';
    }

    if (operation.includes('findMany') && data?.include) {
      return 'medium';
    }

    if (operation.includes('transaction') || operation.includes('$')) {
      return 'medium';
    }

    return 'simple';
  }

  /**
   * Reset performance metrics
   */
  reset(): void {
    this.currentLoad = 0;
    this.connectionCount = 0;
  }
}

// =============================================================================
// ERROR INJECTION SYSTEM
// =============================================================================

export class DatabaseErrorInjector {
  private errorScenarios: Map<string, ErrorScenario> = new Map();
  private globalErrorRate = 0;
  private operationErrorRates: Map<string, number> = new Map();
  private consecutiveErrors = 0;
  private maxConsecutiveErrors = 3;

  constructor() {
    this.initializeErrorScenarios();
  }

  /**
   * Initialize common error scenarios
   */
  private initializeErrorScenarios(): void {
    const scenarios: ErrorScenario[] = [
      {
        name: 'connection_timeout',
        probability: 0.02,
        errorType: DATABASE_ERRORS.CONNECTION_TIMEOUT.type,
        message: DATABASE_ERRORS.CONNECTION_TIMEOUT.message,
        retryable: true,
      },
      {
        name: 'unique_constraint_violation',
        probability: 0.01,
        errorType: DATABASE_ERRORS.UNIQUE_CONSTRAINT.type,
        message: DATABASE_ERRORS.UNIQUE_CONSTRAINT.message,
        retryable: false,
      },
      {
        name: 'deadlock',
        probability: 0.005,
        errorType: DATABASE_ERRORS.DEADLOCK.type,
        message: DATABASE_ERRORS.DEADLOCK.message,
        retryable: true,
      },
      {
        name: 'foreign_key_constraint',
        probability: 0.01,
        errorType: DATABASE_ERRORS.FOREIGN_KEY_CONSTRAINT.type,
        message: DATABASE_ERRORS.FOREIGN_KEY_CONSTRAINT.message,
        retryable: false,
      },
      {
        name: 'record_not_found',
        probability: 0.05,
        errorType: DATABASE_ERRORS.RECORD_NOT_FOUND.type,
        message: DATABASE_ERRORS.RECORD_NOT_FOUND.message,
        retryable: false,
      },
    ];

    scenarios.forEach((scenario) => {
      this.errorScenarios.set(scenario.name, scenario);
    });
  }

  /**
   * Check if operation should trigger an error
   */
  shouldTriggerError(
    operation: string,
    data?: any,
  ): {
    shouldError: boolean;
    error?: ErrorScenario;
    errorDetails?: any;
  } {
    // Check consecutive error limit
    if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
      this.consecutiveErrors = 0;
      return { shouldError: false };
    }

    // Check global error rate
    if (Math.random() < this.globalErrorRate) {
      const error = this.selectRandomError();
      if (error) {
        this.consecutiveErrors++;
        return {
          shouldError: true,
          error,
          errorDetails: this.generateErrorDetails(operation, data, error),
        };
      }
    }

    // Check operation-specific error rates
    const operationErrorRate = this.operationErrorRates.get(operation) || 0;
    if (Math.random() < operationErrorRate) {
      const error = this.selectOperationSpecificError(operation, data);
      if (error) {
        this.consecutiveErrors++;
        return {
          shouldError: true,
          error,
          errorDetails: this.generateErrorDetails(operation, data, error),
        };
      }
    }

    // Reset consecutive error count on success
    this.consecutiveErrors = 0;
    return { shouldError: false };
  }

  /**
   * Generate realistic error details based on operation and data
   */
  private generateErrorDetails(operation: string, data: any, error: ErrorScenario): any {
    const base = {
      code: error.errorType,
      message: error.message,
      meta: {
        operation,
        timestamp: new Date().toISOString(),
      },
    };

    // Customize error details based on error type
    switch (error.errorType) {
      case DATABASE_ERRORS.UNIQUE_CONSTRAINT.type:
        return {
          ...base,
          meta: {
            ...base.meta,
            target: ['email'], // Could be dynamic based on data
          },
        };

      case DATABASE_ERRORS.FOREIGN_KEY_CONSTRAINT.type:
        return {
          ...base,
          meta: {
            ...base.meta,
            field_name: 'userId',
          },
        };

      case DATABASE_ERRORS.RECORD_NOT_FOUND.type:
        return {
          ...base,
          meta: {
            ...base.meta,
            cause: 'Record to update not found.',
          },
        };

      default:
        return base;
    }
  }

  /**
   * Select random error based on probabilities
   */
  private selectRandomError(): ErrorScenario | null {
    const scenarios = Array.from(this.errorScenarios.values());
    const totalProbability = scenarios.reduce((sum, scenario) => sum + scenario.probability, 0);

    if (totalProbability === 0) return null;

    let random = Math.random() * totalProbability;

    for (const scenario of scenarios) {
      random -= scenario.probability;
      if (random <= 0) {
        return scenario;
      }
    }

    return null;
  }

  /**
   * Select error specific to operation type
   */
  private selectOperationSpecificError(operation: string, data?: any): ErrorScenario | null {
    // Create operation context-aware errors
    if (operation.includes('create') && data?.email) {
      // Check for potential unique constraint violations
      return this.errorScenarios.get('unique_constraint_violation') || null;
    }

    if (operation.includes('update') || operation.includes('delete')) {
      // Check for record not found
      return this.errorScenarios.get('record_not_found') || null;
    }

    if (operation.includes('transaction')) {
      // Transaction-specific errors
      return this.errorScenarios.get('deadlock') || null;
    }

    // Default to connection timeout for all operations
    return this.errorScenarios.get('connection_timeout') || null;
  }

  /**
   * Configure error injection rates
   */
  setGlobalErrorRate(rate: number): void {
    this.globalErrorRate = Math.max(0, Math.min(1, rate));
  }

  setOperationErrorRate(operation: string, rate: number): void {
    this.operationErrorRates.set(operation, Math.max(0, Math.min(1, rate)));
  }

  addErrorScenario(name: string, scenario: ErrorScenario): void {
    this.errorScenarios.set(name, scenario);
  }

  /**
   * Reset error injection state
   */
  reset(): void {
    this.consecutiveErrors = 0;
    this.globalErrorRate = 0;
    this.operationErrorRates.clear();
  }

  /**
   * Create Prisma-style error
   */
  createPrismaError(errorDetails: any): Error {
    const error = new Error(errorDetails.message);
    (error as any).code = errorDetails.code;
    (error as any).meta = errorDetails.meta;
    (error as any).name = 'PrismaClientKnownRequestError';
    return error;
  }
}

// =============================================================================
// BEHAVIOR ORCHESTRATOR
// =============================================================================

export class DatabaseBehaviorOrchestrator {
  private performanceSimulator: DatabasePerformanceSimulator;
  private errorInjector: DatabaseErrorInjector;
  private behaviorMode: 'realistic' | 'error' | 'performance' | 'custom' = 'realistic';

  constructor() {
    this.performanceSimulator = new DatabasePerformanceSimulator();
    this.errorInjector = new DatabaseErrorInjector();
  }

  /**
   * Apply behavior to database operation
   */
  async applyBehavior<T>(
    operation: string,
    originalMethod: () => Promise<T>,
    data?: any,
  ): Promise<T> {
    const connection = this.performanceSimulator.acquireConnection();

    try {
      // Check connection availability
      if (!connection.success) {
        throw this.errorInjector.createPrismaError({
          code: DATABASE_ERRORS.CONNECTION_POOL_EXHAUSTED.type,
          message: connection.error,
          meta: { operation },
        });
      }

      // Check for error injection
      const errorCheck = this.errorInjector.shouldTriggerError(operation, data);
      if (errorCheck.shouldError && errorCheck.error && errorCheck.errorDetails) {
        // Simulate latency even for errors
        await this.simulateLatency(operation, data);
        throw this.errorInjector.createPrismaError(errorCheck.errorDetails);
      }

      // Simulate realistic latency
      await this.simulateLatency(operation, data);

      // Execute original operation
      const result = await originalMethod();

      return result;
    } finally {
      this.performanceSimulator.releaseConnection();
    }
  }

  /**
   * Simulate realistic operation latency
   */
  private async simulateLatency(operation: string, data?: any): Promise<void> {
    if (this.behaviorMode === 'performance' || this.behaviorMode === 'realistic') {
      const complexity = this.performanceSimulator.getOperationComplexity(operation, data);
      const latency = this.performanceSimulator.calculateLatency(operation, complexity);

      if (latency > 0) {
        await new Promise((resolve) => setTimeout(resolve, latency));
      }
    }
  }

  /**
   * Configure behavior mode
   */
  setBehaviorMode(mode: 'realistic' | 'error' | 'performance' | 'custom'): void {
    this.behaviorMode = mode;

    switch (mode) {
      case 'realistic':
        this.errorInjector.setGlobalErrorRate(0.01); // 1% error rate
        break;
      case 'error':
        this.errorInjector.setGlobalErrorRate(0.1); // 10% error rate
        break;
      case 'performance':
        this.errorInjector.setGlobalErrorRate(0.005); // 0.5% error rate
        break;
      case 'custom':
        // Custom configuration - user sets their own rates
        break;
    }
  }

  /**
   * Get behavior statistics
   */
  getStats(): any {
    return {
      behaviorMode: this.behaviorMode,
      performanceCharacteristics: this.performanceSimulator,
      errorInjectionStats: {
        scenarios: this.errorInjector['errorScenarios'].size,
        consecutiveErrors: this.errorInjector['consecutiveErrors'],
      },
    };
  }

  /**
   * Reset all behavior state
   */
  reset(): void {
    this.performanceSimulator.reset();
    this.errorInjector.reset();
    this.behaviorMode = 'realistic';
  }

  /**
   * Get references to internal components for advanced configuration
   */
  getPerformanceSimulator(): DatabasePerformanceSimulator {
    return this.performanceSimulator;
  }

  getErrorInjector(): DatabaseErrorInjector {
    return this.errorInjector;
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Create realistic success behavior
 */
export function createSuccessBehavior(
  latency: { min: number; max: number } = { min: 1, max: 10 },
): DatabaseBehavior {
  return {
    type: 'success',
    scenario: 'normal_operation',
    latency,
  };
}

/**
 * Create connection timeout behavior
 */
export function createConnectionTimeoutBehavior(): DatabaseBehavior {
  return {
    type: 'error',
    scenario: 'connection_timeout',
    errorType: DATABASE_ERRORS.CONNECTION_TIMEOUT.type,
    errorMessage: DATABASE_ERRORS.CONNECTION_TIMEOUT.message,
    retryable: true,
  };
}

/**
 * Create constraint violation behavior
 */
export function createConstraintViolationBehavior(
  constraint: 'unique' | 'foreign_key' | 'null',
): DatabaseBehavior {
  const errorMap = {
    unique: DATABASE_ERRORS.UNIQUE_CONSTRAINT,
    foreign_key: DATABASE_ERRORS.FOREIGN_KEY_CONSTRAINT,
    null: DATABASE_ERRORS.NULL_CONSTRAINT,
  };

  const error = errorMap[constraint];

  return {
    type: 'error',
    scenario: `${constraint}_constraint_violation`,
    errorType: error.type,
    errorMessage: error.message,
    retryable: error.retryable,
  };
}

/**
 * Create performance degradation behavior
 */
export function createPerformanceDegradationBehavior(factor: number = 2): DatabaseBehavior {
  return {
    type: 'performance',
    scenario: 'performance_degradation',
    latency: { min: 50 * factor, max: 200 * factor },
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default DatabaseBehaviorOrchestrator;
