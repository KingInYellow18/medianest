/**
 * Comprehensive error type definitions and utilities
 * Rust-inspired error handling patterns for TypeScript
 */

/**
 * Result type inspired by Rust's Result<T, E>
 */
export type Result<T, E = Error> =
  | { success: true; data: T; error?: never }
  | { success: false; error: E; data?: never };

/**
 * Option type inspired by Rust's Option<T>
 */
export type Option<T> = T | null | undefined;

/**
 * Type guard to check if Result is successful
 */
export function isOk<T, E>(result: Result<T, E>): result is { success: true; data: T } {
  return result.success === true;
}

/**
 * Type guard to check if Result is an error
 */
export function isErr<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return result.success === false;
}

/**
 * Create a successful Result
 */
export function Ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

/**
 * Create an error Result
 */
export function Err<E>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Base error interface with enhanced context
 */
export interface BaseError {
  readonly name: string;
  readonly message: string;
  readonly code?: string;
  readonly cause?: Error;
  readonly context?: Record<string, unknown>;
  readonly timestamp: Date;
}

/**
 * HTTP error with status code
 */
export interface HttpError extends BaseError {
  readonly statusCode: number;
  readonly headers?: Record<string, string>;
}

/**
 * Validation error with field-specific details
 */
export interface ValidationError extends BaseError {
  readonly name: 'ValidationError';
  readonly field?: string;
  readonly value?: unknown;
  readonly constraints?: string[];
}

/**
 * Database error with connection details
 */
export interface DatabaseError extends BaseError {
  readonly name: 'DatabaseError';
  readonly query?: string;
  readonly table?: string;
  readonly operation?: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
}

/**
 * Network error with connection details
 */
export interface NetworkError extends BaseError {
  readonly name: 'NetworkError';
  readonly url?: string;
  readonly timeout?: number;
  readonly retryCount?: number;
}

/**
 * Authentication error
 */
export interface AuthenticationError extends BaseError {
  readonly name: 'AuthenticationError';
  readonly userId?: string;
  readonly sessionId?: string;
}

/**
 * Authorization error
 */
export interface AuthorizationError extends BaseError {
  readonly name: 'AuthorizationError';
  readonly userId?: string;
  readonly resource?: string;
  readonly action?: string;
  readonly requiredRole?: string;
}

/**
 * Circuit breaker error
 */
export interface CircuitBreakerError extends BaseError {
  readonly name: 'CircuitBreakerError';
  readonly circuitBreakerName: string;
  readonly state: 'OPEN' | 'HALF_OPEN' | 'CLOSED';
}

/**
 * Type guard to check if value is an Error instance
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Type guard to check if error is a ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return isError(error) && error.name === 'ValidationError';
}

/**
 * Type guard to check if error is an HttpError
 */
export function isHttpError(error: unknown): error is HttpError {
  return isError(error) && 'statusCode' in error && typeof (error as any).statusCode === 'number';
}

/**
 * Type guard to check if error is a DatabaseError
 */
export function isDatabaseError(error: unknown): error is DatabaseError {
  return isError(error) && error.name === 'DatabaseError';
}

/**
 * Type guard to check if error is a NetworkError
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return isError(error) && error.name === 'NetworkError';
}

/**
 * Type guard to check if error is an AuthenticationError
 */
export function isAuthenticationError(error: unknown): error is AuthenticationError {
  return isError(error) && error.name === 'AuthenticationError';
}

/**
 * Type guard to check if error is an AuthorizationError
 */
export function isAuthorizationError(error: unknown): error is AuthorizationError {
  return isError(error) && error.name === 'AuthorizationError';
}

/**
 * Type guard to check if error is a CircuitBreakerError
 */
export function isCircuitBreakerError(error: unknown): error is CircuitBreakerError {
  return isError(error) && error.name === 'CircuitBreakerError';
}

/**
 * Convert unknown error types to Error instances with context preservation
 */
export function toError(error: unknown): Error {
  if (isError(error)) {
    return error;
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  if (error && typeof error === 'object') {
    const errorObj = error as Record<string, unknown>;
    const message = String(errorObj.message || 'Unknown error');
    const err = new Error(message);

    // Preserve name if available
    if (typeof errorObj.name === 'string') {
      err.name = errorObj.name;
    }

    // Preserve stack if available
    if (typeof errorObj.stack === 'string') {
      err.stack = errorObj.stack;
    }

    // Add context if available
    if (errorObj.context && typeof errorObj.context === 'object') {
      (err as any).context = errorObj.context;
    }

    return err;
  }

  return new Error(String(error));
}

/**
 * Extract error message from unknown error types
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }

  return String(error);
}

/**
 * Extract error code from unknown error types
 */
export function getErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: unknown }).code;
    return typeof code === 'string' ? code : String(code);
  }

  return undefined;
}

/**
 * Error builder for creating structured errors
 */
export class ErrorBuilder {
  private error: Partial<BaseError>;

  constructor(message: string) {
    this.error = {
      message,
      timestamp: new Date(),
    };
  }

  static create(message: string): ErrorBuilder {
    return new ErrorBuilder(message);
  }

  name(name: string): this {
    (this.error as any).name = name;
    return this;
  }

  code(code: string): this {
    (this.error as any).code = code;
    return this;
  }

  cause(cause: Error): this {
    (this.error as any).cause = cause;
    return this;
  }

  context(context: Record<string, unknown>): this {
    (this.error as any).context = { ...(this.error as any).context, ...context };
    return this;
  }

  statusCode(statusCode: number): ErrorBuilder & { statusCode: number } {
    (this.error as any).statusCode = statusCode;
    return this as any;
  }

  field(field: string): this {
    (this.error as any).field = field;
    return this;
  }

  build(): Error {
    const err = new Error(this.error.message || 'Unknown error');
    Object.assign(err, this.error);
    return err;
  }
}

/**
 * Async error handling wrapper
 */
export async function safeAsync<T>(fn: () => Promise<T>): Promise<Result<T, Error>> {
  try {
    const data = await fn();
    return Ok(data);
  } catch (error) {
    return Err(toError(error));
  }
}

/**
 * Sync error handling wrapper
 */
export function safe<T>(fn: () => T): Result<T, Error> {
  try {
    const data = fn();
    return Ok(data);
  } catch (error) {
    return Err(toError(error));
  }
}

/**
 * Chain operations with error propagation
 */
export function chain<T, U, E>(result: Result<T, E>, fn: (data: T) => Result<U, E>): Result<U, E> {
  if (isOk(result)) {
    return fn(result.data);
  }
  return result;
}

/**
 * Map successful results
 */
export function map<T, U, E>(result: Result<T, E>, fn: (data: T) => U): Result<U, E> {
  if (isOk(result)) {
    return Ok(fn(result.data));
  }
  return result;
}

/**
 * Map error results
 */
export function mapError<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  if (isErr(result)) {
    return Err(fn(result.error));
  }
  return result;
}

/**
 * Unwrap result or throw error
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.data;
  }
  throw result.error;
}

/**
 * Unwrap result or return default value
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (isOk(result)) {
    return result.data;
  }
  return defaultValue;
}

/**
 * Option type utilities
 */
export const Option = {
  /**
   * Check if value is Some (not null/undefined)
   */
  isSome<T>(value: Option<T>): value is T {
    return value !== null && value !== undefined;
  },

  /**
   * Check if value is None (null/undefined)
   */
  isNone<T>(value: Option<T>): value is null | undefined {
    return value === null || value === undefined;
  },

  /**
   * Map over Some values
   */
  map<T, U>(value: Option<T>, fn: (val: T) => U): Option<U> {
    return this.isSome(value) ? fn(value) : (value as any);
  },

  /**
   * Unwrap or return default
   */
  unwrapOr<T>(value: Option<T>, defaultValue: T): T {
    return this.isSome(value) ? value : defaultValue;
  },

  /**
   * Convert to Result
   */
  toResult<T>(value: Option<T>, error: Error): Result<T, Error> {
    return this.isSome(value) ? Ok(value) : Err(error);
  },
};
