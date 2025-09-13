/**
 * SAFE DATABASE OPERATIONS
 * Null-safe Prisma operations with comprehensive error handling
 */

import { isString } from '../utils/type-guards';

/**
 * Safe database result type
 */
export type SafeDatabaseResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: string;
      code?: string;
    };

// Alias for backwards compatibility
export type SafeOperationResult<T> = SafeDatabaseResult<T>;

/**
 * Database error class
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public code?: string,
    public meta?: any,
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/**
 * Null-safe database result handler class
 */
export class SafeDatabaseResultHandler<T> {
  constructor(
    private result: T | null,
    private error?: Error,
  ) {}

  /**
   * Check if operation was successful
   */
  isSuccess(): boolean {
    return this.result !== null && !this.error;
  }

  /**
   * Get result with null check
   */
  getData(): T | null {
    return this.result;
  }

  /**
   * Get result or throw error
   */
  getDataOrThrow(): T {
    if (this.result === null) {
      throw new Error(this.error?.message || 'Database operation returned null');
    }
    return this.result;
  }

  /**
   * Get result or default value
   */
  getDataOrDefault(defaultValue: T): T {
    return this.result ?? defaultValue;
  }

  /**
   * Get error if present
   */
  getError(): Error | undefined {
    return this.error;
  }

  /**
   * Map result if successful
   */
  map<U>(mapper: (data: T) => U): SafeDatabaseResultHandler<U> {
    if (this.result === null || this.error) {
      return new SafeDatabaseResultHandler<U>(null, this.error);
    }

    try {
      const mapped = mapper(this.result);
      return new SafeDatabaseResultHandler(mapped);
    } catch (error) {
      const mappingError = error instanceof Error ? error : new Error('Mapping operation failed');
      return new SafeDatabaseResultHandler<U>(null, mappingError);
    }
  }
}

/**
 * Safe Prisma operations wrapper
 */
export class SafePrismaOperations {
  /**
   * Safe findUnique operation
   */
  static async findUnique<T>(
    operation: () => Promise<T | null>,
    context: string = 'findUnique',
  ): Promise<SafeDatabaseResultHandler<T>> {
    try {
      const result = await operation();

      if (result === null) {
        return new SafeDatabaseResultHandler<T>(null);
      }

      return new SafeDatabaseResultHandler(result);
    } catch (error) {
      const dbError = this.handleDatabaseError(error, context);
      return new SafeDatabaseResultHandler<T>(null, dbError);
    }
  }

  /**
   * Safe findMany operation
   */
  static async findMany<T>(
    operation: () => Promise<T[]>,
    context: string = 'findMany',
  ): Promise<T[]> {
    try {
      const result = await operation();
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error(`SafePrismaOperations.${context} error:`, error);
      return [];
    }
  }

  /**
   * Safe create operation
   */
  static async create<T>(
    operation: () => Promise<T>,
    context: string = 'create',
  ): Promise<SafeDatabaseResultHandler<T>> {
    try {
      const result = await operation();

      if (result === null || result === undefined) {
        const error = new Error(`Create operation in ${context} returned null/undefined`);
        return new SafeDatabaseResultHandler<T>(null, error);
      }

      return new SafeDatabaseResultHandler(result);
    } catch (error) {
      const dbError = this.handleDatabaseError(error, context);
      return new SafeDatabaseResultHandler<T>(null, dbError);
    }
  }

  /**
   * Safe update operation
   */
  static async update<T>(
    operation: () => Promise<T>,
    context: string = 'update',
  ): Promise<SafeDatabaseResultHandler<T>> {
    try {
      const result = await operation();

      if (result === null || result === undefined) {
        const error = new Error(`Update operation in ${context} returned null/undefined`);
        return new SafeDatabaseResultHandler<T>(null, error);
      }

      return new SafeDatabaseResultHandler(result);
    } catch (error) {
      const dbError = this.handleDatabaseError(error, context);
      return new SafeDatabaseResultHandler<T>(null, dbError);
    }
  }

  /**
   * Safe transaction operation
   */
  static async transaction<T>(
    operation: () => Promise<T>,
    context: string = 'transaction',
  ): Promise<SafeDatabaseResultHandler<T>> {
    try {
      const result = await operation();

      if (result === null || result === undefined) {
        const error = new Error(`Transaction in ${context} returned null/undefined`);
        return new SafeDatabaseResultHandler<T>(null, error);
      }

      return new SafeDatabaseResultHandler(result);
    } catch (error) {
      const dbError = this.handleDatabaseError(error, context);
      return new SafeDatabaseResultHandler<T>(null, dbError);
    }
  }

  /**
   * Handle database errors with proper typing
   */
  private static handleDatabaseError(error: unknown, context: string): Error {
    if (error instanceof Error) {
      console.error(`Database error in ${context}:`, {
        message: error.message,
        name: error.name,
        stack: error.stack?.split('\n').slice(0, 3).join('\n'), // Truncate stack trace
      });
      return error;
    }

    const unknownError = new Error(`Unknown database error in ${context}: ${String(error)}`);
    console.error(`Unknown database error in ${context}:`, error);
    return unknownError;
  }

  /**
   * Validate database connection input
   */
  static validateConnectionInput(input: {
    url?: unknown;
    host?: unknown;
    port?: unknown;
    database?: unknown;
    username?: unknown;
    password?: unknown;
  }): string[] {
    const errors: string[] = [];

    if (!isString(input.url) || input.url.trim() === '') {
      errors.push('Database URL is required and must be a non-empty string');
    }

    // Validate URL format if provided
    if (isString(input.url)) {
      try {
        new URL(input.url);
      } catch {
        errors.push('Database URL format is invalid');
      }
    }

    return errors;
  }
}

/**
 * Database null safety utilities
 */
export class DatabaseNullSafety {
  /**
   * Check if a database record exists
   */
  static recordExists<T>(record: T | null): record is T {
    return record !== null && record !== undefined;
  }

  /**
   * Assert record exists or throw
   */
  static requireRecord<T>(record: T | null, resourceName: string, identifier?: string | number): T {
    if (!this.recordExists(record)) {
      const idStr = identifier ? ` with ID ${identifier}` : '';
      throw new Error(`${resourceName}${idStr} not found`);
    }
    return record;
  }

  /**
   * Safe property access on database records
   */
  static getProperty<T, K extends keyof T>(
    record: T | null,
    property: K,
    defaultValue: T[K],
  ): T[K] {
    if (!this.recordExists(record)) {
      return defaultValue;
    }

    const value = record[property];
    return value ?? defaultValue;
  }

  /**
   * Safe relation access
   */
  static getRelation<T, R>(
    record: T | null,
    relationGetter: (record: T) => R | null,
    defaultValue: R,
  ): R {
    if (!this.recordExists(record)) {
      return defaultValue;
    }

    try {
      const relation = relationGetter(record);
      return relation ?? defaultValue;
    } catch (error) {
      logger.warn('Error accessing database relation:', error);
      return defaultValue;
    }
  }

  /**
   * Validate pagination parameters
   */
  static validatePagination(params: {
    page?: unknown;
    limit?: unknown;
    skip?: unknown;
    take?: unknown;
  }): {
    page: number;
    limit: number;
    skip: number;
    take: number;
  } {
    const page = this.safeParsePositiveInt(params.page, 1);
    const limit = Math.min(this.safeParsePositiveInt(params.limit, 20), 100);
    const skip = this.safeParseNonNegativeInt(params.skip, (page - 1) * limit);
    const take = Math.min(this.safeParsePositiveInt(params.take, limit), 100);

    return { page, limit, skip, take };
  }

  /**
   * Safe positive integer parsing
   */
  private static safeParsePositiveInt(value: unknown, defaultValue: number): number {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
      return value;
    }

    if (isString(value)) {
      const parsed = parseInt(value, 10);
      if (Number.isInteger(parsed) && parsed > 0) {
        return parsed;
      }
    }

    return defaultValue;
  }

  /**
   * Safe non-negative integer parsing
   */
  private static safeParseNonNegativeInt(value: unknown, defaultValue: number): number {
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
      return value;
    }

    if (isString(value)) {
      const parsed = parseInt(value, 10);
      if (Number.isInteger(parsed) && parsed >= 0) {
        return parsed;
      }
    }

    return defaultValue;
  }
}

/**
 * Express middleware for database error handling
 */
export function databaseErrorMiddleware() {
  return (error: unknown, req: any, res: any, next: any) => {
    // Handle Prisma-specific errors
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as { code: string; message: string; meta?: any };

      console.error('Database operation failed:', {
        code: prismaError.code,
        message: prismaError.message,
        path: req?.path,
        method: req?.method,
      });

      // Map Prisma error codes to HTTP status codes
      switch (prismaError.code) {
        case 'P2002': // Unique constraint violation
          return res.status(409).json({
            error: 'Resource already exists',
            code: 'CONFLICT',
          });

        case 'P2025': // Record not found
          return res.status(404).json({
            error: 'Resource not found',
            code: 'NOT_FOUND',
          });

        case 'P2003': // Foreign key constraint violation
          return res.status(400).json({
            error: 'Invalid reference to related resource',
            code: 'INVALID_REFERENCE',
          });

        default:
          return res.status(500).json({
            error: 'Database operation failed',
            code: 'DATABASE_ERROR',
          });
      }
    }

    // Pass other errors to next middleware
    next(error);
  };
}
