/**
 * NULL SAFETY ENFORCEMENT SERVICE
 * Enterprise-grade null safety implementation
 */

import { isString, isValidInteger } from './type-guards';

/**
 * Result type for operations that can fail
 */
export type SafeResult<T, E = Error> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: E;
    };

/**
 * Safe operation wrapper
 */
export function safeOperation<T, E extends Error = Error>(
  operation: () => T,
  errorMessage?: string,
): SafeResult<T, E> {
  try {
    const result = operation();
    return { success: true, data: result };
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(errorMessage || 'Unknown error');
    return { success: false, error: errorObj as E };
  }
}

/**
 * Safe async operation wrapper
 */
export async function safeAsyncOperation<T, E extends Error = Error>(
  operation: () => Promise<T>,
  errorMessage?: string,
): Promise<SafeResult<T, E>> {
  try {
    const result = await operation();
    return { success: true, data: result };
  } catch (error) {
    const errorObj =
      error instanceof Error ? error : new Error(errorMessage || 'Unknown async error');
    return { success: false, error: errorObj as E };
  }
}

/**
 * Null-safe database query result handler
 */
export class DatabaseResultHandler<T> {
  private result: T | null;

  constructor(result: T | null | undefined) {
    this.result = result ?? null;
  }

  /**
   * Check if result exists
   */
  exists(): boolean {
    return this.result !== null;
  }

  /**
   * Get result with null check
   */
  get(): T | null {
    return this.result;
  }

  /**
   * Get result or throw error
   */
  getOrThrow(errorMessage: string = 'Database result is null'): T {
    if (this.result === null) {
      throw new Error(errorMessage);
    }
    return this.result;
  }

  /**
   * Get result or default value
   */
  getOrDefault(defaultValue: T): T {
    return this.result ?? defaultValue;
  }

  /**
   * Map result if it exists
   */
  map<U>(mapper: (value: T) => U): DatabaseResultHandler<U> {
    if (this.result === null) {
      return new DatabaseResultHandler<U>(null);
    }
    try {
      const mapped = mapper(this.result);
      return new DatabaseResultHandler(mapped);
    } catch (error) {
      console.error('Error in DatabaseResultHandler.map:', error);
      return new DatabaseResultHandler<U>(null);
    }
  }
}

/**
 * Safe environment configuration parser
 */
export class SafeEnvironmentParser {
  /**
   * Parse integer with comprehensive safety
   */
  static parseInt(value: string | undefined | null, defaultValue: number): number {
    if (!isString(value) || value.trim() === '') {
      return defaultValue;
    }

    const trimmed = value.trim();
    const parsed = parseInt(trimmed, 10);

    if (!isValidInteger(parsed)) {
      logger.warn(
        `SafeEnvironmentParser: Invalid integer '${value}', using default: ${defaultValue}`,
      );
      return defaultValue;
    }

    // Additional bounds checking for common use cases
    if (trimmed.includes('PORT') && (parsed < 1 || parsed > 65535)) {
      logger.warn(
        `SafeEnvironmentParser: Port ${parsed} out of range, using default: ${defaultValue}`,
      );
      return defaultValue;
    }

    return parsed;
  }

  /**
   * Parse boolean with comprehensive safety
   */
  static parseBoolean(value: string | undefined | null, defaultValue: boolean = false): boolean {
    if (!isString(value)) {
      return defaultValue;
    }

    const normalized = value.toLowerCase().trim();
    const truthyValues = ['true', '1', 'yes', 'on', 'enabled'];
    const falsyValues = ['false', '0', 'no', 'off', 'disabled'];

    if (truthyValues.includes(normalized)) {
      return true;
    }
    if (falsyValues.includes(normalized)) {
      return false;
    }

    logger.warn(
      `SafeEnvironmentParser: Ambiguous boolean '${value}', using default: ${defaultValue}`,
    );
    return defaultValue;
  }

  /**
   * Parse JSON with comprehensive safety
   */
  static parseJson<T>(value: string | undefined | null, defaultValue: T): T {
    if (!isString(value) || value.trim() === '') {
      return defaultValue;
    }

    try {
      const parsed = JSON.parse(value.trim());
      return parsed ?? defaultValue;
    } catch (error) {
      logger.warn(`SafeEnvironmentParser: Invalid JSON '${value}', using default:`, defaultValue);
      return defaultValue;
    }
  }

  /**
   * Validate required environment variable
   */
  static requireEnv(key: string): string {
    const value = process.env[key];
    if (!isString(value) || value.trim() === '') {
      throw new Error(`CRITICAL: Required environment variable '${key}' is missing or empty`);
    }
    return value.trim();
  }
}

/**
 * Safe HTTP request handler
 */
export class SafeHttpRequestHandler {
  /**
   * Parse request body with null safety
   */
  static parseRequestBody<T>(body: unknown, validator: (data: unknown) => data is T): T | null {
    if (!body || typeof body !== 'object') {
      return null;
    }

    if (validator(body)) {
      return body;
    }

    return null;
  }

  /**
   * Extract pagination parameters safely
   */
  static parsePaginationParams(query: any): { page: number; limit: number; offset: number } {
    const page = Math.max(1, SafeEnvironmentParser.parseInt(query.page, 1));
    const limit = Math.max(1, Math.min(100, SafeEnvironmentParser.parseInt(query.limit, 20)));
    const offset = (page - 1) * limit;

    return { page, limit, offset };
  }

  /**
   * Safe header extraction
   */
  static getHeader(headers: any, key: string): string | null {
    if (!headers || typeof headers !== 'object') {
      return null;
    }

    const value = headers[key] || headers[key.toLowerCase()];
    return isString(value) ? value : null;
  }
}

/**
 * Prisma query safety wrapper
 */
export class PrismaQuerySafety {
  /**
   * Wrap Prisma findUnique with null safety
   */
  static async findUnique<T>(
    query: Promise<T | null>,
    errorContext: string,
  ): Promise<DatabaseResultHandler<T>> {
    try {
      const result = await query;
      return new DatabaseResultHandler(result);
    } catch (error) {
      console.error(`PrismaQuerySafety.findUnique error in ${errorContext}:`, error);
      return new DatabaseResultHandler<T>(null);
    }
  }

  /**
   * Wrap Prisma findMany with null safety
   */
  static async findMany<T>(query: Promise<T[]>, errorContext: string): Promise<T[]> {
    try {
      const result = await query;
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error(`PrismaQuerySafety.findMany error in ${errorContext}:`, error);
      return [];
    }
  }

  /**
   * Wrap Prisma create/update with transaction safety
   */
  static async mutateWithRollback<T>(
    transaction: () => Promise<T>,
    errorContext: string,
  ): Promise<SafeResult<T>> {
    try {
      const result = await transaction();
      if (result === null || result === undefined) {
        return {
          success: false,
          error: new Error(`${errorContext}: Operation returned null/undefined`),
        };
      }
      return { success: true, data: result };
    } catch (error) {
      console.error(`PrismaQuerySafety.mutateWithRollback error in ${errorContext}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}

/**
 * Array operations with null safety
 */
export class SafeArrayOperations {
  /**
   * Safe array access with bounds checking
   */
  static at<T>(array: T[] | null | undefined, index: number): T | null {
    if (!Array.isArray(array) || !isValidInteger(index)) {
      return null;
    }

    if (index < 0) {
      // Handle negative indexing
      const positiveIndex = array.length + index;
      return positiveIndex >= 0 && positiveIndex < array.length ? array[positiveIndex] : null;
    }

    return index >= 0 && index < array.length ? array[index] : null;
  }

  /**
   * Safe array filtering with null removal
   */
  static filterNonNull<T>(array: (T | null | undefined)[]): T[] {
    if (!Array.isArray(array)) {
      return [];
    }

    return array.filter((item): item is T => item !== null && item !== undefined);
  }

  /**
   * Safe array chunk operation
   */
  static chunk<T>(array: T[] | null | undefined, size: number): T[][] {
    if (!Array.isArray(array) || !isValidInteger(size) || size <= 0) {
      return [];
    }

    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

/**
 * Object operations with null safety
 */
export class SafeObjectOperations {
  /**
   * Safe object property access with type checking
   */
  static get<T>(obj: any, path: string | string[], defaultValue: T): T {
    if (!obj || typeof obj !== 'object') {
      return defaultValue;
    }

    const keys = Array.isArray(path) ? path : path.split('.');
    let current = obj;

    for (const key of keys) {
      if (!current || typeof current !== 'object' || !(key in current)) {
        return defaultValue;
      }
      current = current[key];
    }

    return current ?? defaultValue;
  }

  /**
   * Safe object merging with null/undefined filtering
   */
  static merge<T extends Record<string, any>>(
    target: T,
    ...sources: (Partial<T> | null | undefined)[]
  ): T {
    const result = { ...target };

    for (const source of sources) {
      if (source && typeof source === 'object') {
        for (const [key, value] of Object.entries(source)) {
          if (value !== null && value !== undefined) {
            (result as Record<string, any>)[key] = value;
          }
        }
      }
    }

    return result;
  }
}

/**
 * Export all safety utilities
 */
export const NullSafety = {
  DatabaseResultHandler,
  SafeEnvironmentParser,
  SafeHttpRequestHandler,
  PrismaQuerySafety,
  SafeArrayOperations,
  SafeObjectOperations,
  safeOperation,
  safeAsyncOperation,
};
