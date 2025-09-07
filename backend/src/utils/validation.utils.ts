import { logger } from './logger';

/**
 * Check if value is null or undefined
 */
export function isNullOrUndefined(value: any): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Check if value is not null or undefined
 */
export function isNotNullOrUndefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Check if string is null, undefined, or empty
 */
export function isEmpty(value: string | null | undefined): value is null | undefined | '' {
  return isNullOrUndefined(value) || value === '';
}

/**
 * Check if string is not null, undefined, or empty
 */
export function isNotEmpty(value: string | null | undefined): value is string {
  return !isEmpty(value);
}

/**
 * Check if array is null, undefined, or empty
 */
export function isEmptyArray<T>(value: T[] | null | undefined): value is null | undefined | [] {
  return isNullOrUndefined(value) || value.length === 0;
}

/**
 * Check if array is not null, undefined, or empty
 */
export function isNotEmptyArray<T>(value: T[] | null | undefined): value is T[] {
  return isNotNullOrUndefined(value) && value.length > 0;
}

/**
 * Check if object is null, undefined, or has no own properties
 */
export function isEmptyObject(value: object | null | undefined): boolean {
  return isNullOrUndefined(value) || Object.keys(value).length === 0;
}

/**
 * Check if object is not null, undefined, and has own properties
 */
export function isNotEmptyObject(value: object | null | undefined): boolean {
  return isNotNullOrUndefined(value) && Object.keys(value).length > 0;
}

/**
 * Validate required fields in an object
 * @param obj - Object to validate
 * @param requiredFields - Array of required field names
 * @param objectName - Name of object for error messages
 * @throws Error if validation fails
 */
export function validateRequiredFields(
  obj: Record<string, any>,
  requiredFields: string[],
  objectName = 'Object'
): void {
  const missingFields: string[] = [];

  for (const field of requiredFields) {
    if (isEmpty(obj[field])) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    throw new Error(`${objectName} missing required fields: ${missingFields.join(', ')}`);
  }
}

/**
 * Validate and return required fields, throwing error if any are missing
 * @param obj - Object to validate
 * @param requiredFields - Array of required field names
 * @param objectName - Name of object for error messages
 * @returns The object if validation passes
 */
export function requireFields<T extends Record<string, any>>(
  obj: T,
  requiredFields: (keyof T)[],
  objectName = 'Object'
): T {
  validateRequiredFields(obj, requiredFields as string[], objectName);
  return obj;
}

/**
 * Assert that a value is not null or undefined
 * @param value - Value to check
 * @param message - Error message if assertion fails
 * @throws Error if value is null or undefined
 */
export function assertNotNull<T>(
  value: T | null | undefined,
  message = 'Value cannot be null or undefined'
): asserts value is T {
  if (isNullOrUndefined(value)) {
    throw new Error(message);
  }
}

/**
 * Assert that a string is not empty
 * @param value - String to check
 * @param message - Error message if assertion fails
 * @throws Error if string is empty
 */
export function assertNotEmpty(
  value: string | null | undefined,
  message = 'Value cannot be empty'
): asserts value is string {
  if (isEmpty(value)) {
    throw new Error(message);
  }
}

/**
 * Assert that an array is not empty
 * @param value - Array to check
 * @param message - Error message if assertion fails
 * @throws Error if array is empty
 */
export function assertNotEmptyArray<T>(
  value: T[] | null | undefined,
  message = 'Array cannot be empty'
): asserts value is T[] {
  if (isEmptyArray(value)) {
    throw new Error(message);
  }
}

/**
 * Safely get a property from an object with fallback
 * @param obj - Object to get property from
 * @param key - Property key
 * @param fallback - Fallback value if property is missing or null/undefined
 */
export function safeGet<T, K extends keyof T>(
  obj: T | null | undefined,
  key: K,
  fallback: T[K]
): T[K] {
  if (isNullOrUndefined(obj) || isNullOrUndefined(obj[key])) {
    return fallback;
  }
  return obj[key];
}

/**
 * Validate email format
 * @param email - Email to validate
 * @returns true if valid email format
 */
export function isValidEmail(email: string): boolean {
  if (isEmpty(email)) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL format
 * @param url - URL to validate
 * @returns true if valid URL format
 */
export function isValidUrl(url: string): boolean {
  if (isEmpty(url)) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate that a value is a positive number
 * @param value - Value to check
 * @returns true if value is a positive number
 */
export function isPositiveNumber(value: any): value is number {
  return typeof value === 'number' && value > 0 && !isNaN(value);
}

/**
 * Validate that a value is a non-negative number (>= 0)
 * @param value - Value to check
 * @returns true if value is a non-negative number
 */
export function isNonNegativeNumber(value: any): value is number {
  return typeof value === 'number' && value >= 0 && !isNaN(value);
}

/**
 * Create a validation error with context
 * @param message - Error message
 * @param field - Field that failed validation
 * @param value - Value that failed validation
 * @param context - Additional context
 */
export function createValidationError(
  message: string,
  field?: string,
  value?: any,
  context?: Record<string, any>
): Error {
  const error = new Error(message);
  (error as any).field = field;
  (error as any).value = value;
  (error as any).context = context;
  (error as any).type = 'ValidationError';

  logger.warn('Validation error', {
    message,
    field,
    value: typeof value === 'string' ? value : JSON.stringify(value),
    context,
  });

  return error;
}

/**
 * Sanitize input by trimming whitespace and removing dangerous characters
 * @param input - Input string to sanitize
 * @returns Sanitized string
 */
export function sanitizeInput(input: string | null | undefined): string {
  if (isEmpty(input)) return '';

  return input
    .trim()
    .replace(/[<>\"']/g, '') // Remove potentially dangerous characters
    .substring(0, 1000); // Limit length to prevent abuse
}

/**
 * Deep validation helper that checks nested object properties
 * @param obj - Object to validate
 * @param schema - Validation schema
 * @returns Validation result with errors
 */
export function deepValidate(
  obj: Record<string, any>,
  schema: Record<string, (value: any) => boolean | string>
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const [field, validator] of Object.entries(schema)) {
    const value = obj[field];
    const result = validator(value);

    if (result === false) {
      errors.push(`${field} is invalid`);
    } else if (typeof result === 'string') {
      errors.push(result);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
