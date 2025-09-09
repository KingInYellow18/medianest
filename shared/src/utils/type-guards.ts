/**
 * TYPE GUARDS AND SAFE TYPE UTILITIES FOR NULL SAFETY
 * Centralized type checking and validation functions
 * Security-focused runtime type validation
 */

/**
 * Check if value is not null or undefined
 */
export function isNonNullable<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Type guard for strings
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Type guard for non-empty strings
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard for numbers (excluding NaN)
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Type guard for valid integers
 */
export function isValidInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && !isNaN(value);
}

/**
 * Type guard for boolean values
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Type guard for objects (excluding null)
 */
export function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

/**
 * Type guard for arrays
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Type guard for defined values (not undefined)
 */
export function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

/**
 * Assert value is never (exhaustiveness checking)
 */
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}

// Duplicate function removed - using the more comprehensive version below

/**
 * Safe property access with type validation
 */
export function safeGetProperty<T extends Record<string, any>, K extends keyof T>(
  obj: T | null | undefined,
  key: K,
  validator: (value: unknown) => boolean,
  defaultValue: T[K]
): T[K] {
  if (!obj || typeof obj !== 'object') {
    return defaultValue;
  }

  const value = obj[key];
  return validator(value) ? value : defaultValue;
}

/**
 * Safe array element access
 */
export function safeArrayAccess<T>(
  array: T[] | null | undefined,
  index: number,
  defaultValue: T
): T {
  if (!Array.isArray(array) || !isValidInteger(index)) {
    return defaultValue;
  }

  if (index < 0 || index >= array.length) {
    return defaultValue;
  }

  const value = array[index];
  return value ?? defaultValue;
}

/**
 * Request body validation with type safety
 */
export function validateRequestBody<T>(
  body: unknown,
  validator: (data: unknown) => data is T
): { isValid: true; data: T } | { isValid: false; data: null } {
  if (!body || typeof body !== 'object') {
    return { isValid: false, data: null };
  }

  if (validator(body)) {
    return { isValid: true, data: body };
  }

  return { isValid: false, data: null };
}

/**
 * Safe correlation ID extraction
 */
export function safeGetCorrelationId(req: unknown): string {
  if (req && typeof req === 'object' && 'correlationId' in req) {
    const correlationId = (req as { correlationId?: unknown }).correlationId;
    return isString(correlationId) ? correlationId : 'no-correlation-id';
  }
  return 'no-correlation-id';
}

/**
 * Prisma error type guard
 */
export function isPrismaClientKnownRequestError(
  error: unknown
): error is { code: string; message: string; meta?: any } {
  return (
    isObject(error) &&
    'code' in error &&
    'message' in error &&
    isString((error as { code?: unknown; message?: unknown }).code) &&
    isString((error as { code?: unknown; message?: unknown }).message)
  );
}

/**
 * HTTP error type guard
 */
export function isHttpError(
  error: unknown
): error is { status: number; message: string; response?: any } {
  return (
    isObject(error) &&
    'status' in error &&
    'message' in error &&
    isNumber((error as { status?: unknown; message?: unknown }).status) &&
    isString((error as { status?: unknown; message?: unknown }).message)
  );
}

/**
 * Express request with user type guard
 */
export function hasUser<T extends { user?: { id: string } }>(
  req: T
): req is T & { user: { id: string } } {
  return isObject(req.user) && 'id' in req.user && isString(req.user.id);
}

/**
 * Safe environment variable access
 */
export function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!isNonEmptyString(value)) {
    throw new Error(`Required environment variable ${key} is missing or empty`);
  }
  return value;
}

/**
 * Safe optional environment variable access
 */
export function getOptionalEnv(key: string, defaultValue?: string): string | undefined {
  const value = process.env[key];
  return isNonEmptyString(value) ? value : defaultValue;
}

/**
 * Safe integer parsing from environment
 */
export function parseIntegerEnv(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!isString(value) || value.length === 0) {
    return defaultValue;
  }

  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    console.warn(
      `Invalid integer environment variable ${key}=${value}, using default: ${defaultValue}`
    );
    return defaultValue;
  }

  return parsed;
}

/**
 * Safe boolean parsing from environment
 */
export function parseBooleanEnv(key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key];
  if (!isString(value)) {
    return defaultValue;
  }

  const normalized = value.toLowerCase().trim();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

/**
 * Safe JSON parsing with fallback and validation
 */
export function safeJsonParse<T>(
  text: string,
  fallback: T,
  validator?: (value: unknown) => value is T
): T {
  if (!isString(text) || text.length === 0) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(text);

    // Additional validation if validator provided
    if (validator && !validator(parsed)) {
      console.warn('safeJsonParse: Parsed JSON failed validation, using fallback');
      return fallback;
    }

    return parsed ?? fallback;
  } catch (error) {
    console.warn('safeJsonParse: JSON parsing failed:', error);
    return fallback;
  }
}

/**
 * Safe JSON parsing returning null on error
 */
export function tryJsonParse<T = unknown>(text: string): T | null {
  if (!isString(text) || text.length === 0) {
    return null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

// Duplicate function removed - using the more comprehensive version above

/**
 * Safe object property access
 */
export function safePropAccess<T extends object, K extends keyof T>(
  obj: T | null | undefined,
  key: K
): T[K] | undefined {
  if (!isObject(obj) || !(key in obj)) {
    return undefined;
  }
  return obj[key];
}

/**
 * Type guard for valid email format
 */
export function isValidEmail(value: unknown): value is string {
  if (!isString(value)) {
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * Type guard for valid URL format
 */
export function isValidUrl(value: unknown): value is string {
  if (!isString(value)) {
    return false;
  }

  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Type guard for valid UUID format
 */
export function isValidUuid(value: unknown): value is string {
  if (!isString(value)) {
    return false;
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Create a safe getter function with default value
 */
export function createSafeGetter<T>(defaultValue: T) {
  return (value: unknown): T => {
    return value !== null && value !== undefined ? (value as T) : defaultValue;
  };
}

/**
 * Create a validation function that throws on invalid input
 */
export function createValidator<T>(
  guard: (value: unknown) => value is T,
  errorMessage: string
): (value: unknown) => T {
  return (value: unknown): T => {
    if (!guard(value)) {
      throw new Error(errorMessage);
    }
    return value;
  };
}

// Export commonly used validators
export const requireString = createValidator(isString, 'Expected string value');
export const requireNonEmptyString = createValidator(isNonEmptyString, 'Expected non-empty string');
export const requireNumber = createValidator(isNumber, 'Expected valid number');
export const requireInteger = createValidator(isValidInteger, 'Expected valid integer');
export const requireBoolean = createValidator(isBoolean, 'Expected boolean value');
export const requireArray = createValidator(isArray, 'Expected array value');
export const requireObject = createValidator(isObject, 'Expected object value');

/**
 * Utility to remove undefined values from object
 */
export function removeUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: Partial<T> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      (result as Record<string, any>)[key] = value;
    }
  }

  return result;
}

/**
 * Utility to remove null and undefined values from object
 */
export function removeNullish<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: Partial<T> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined) {
      (result as Record<string, any>)[key] = value;
    }
  }

  return result;
}
