/**
 * SAFE PARSING UTILITIES
 * Secure parsing operations with comprehensive null safety
 */

import { isString, isNumber, isValidInteger } from './type-guards';

/**
 * Safe integer parsing with comprehensive validation
 */
export function safeParseInt(
  value: unknown,
  defaultValue: number = 0,
  options: {
    min?: number;
    max?: number;
    allowNegative?: boolean;
  } = {}
): number {
  // Type guard for string input
  if (!isString(value)) {
    return defaultValue;
  }

  const trimmed = value.trim();
  if (trimmed === '') {
    return defaultValue;
  }

  const parsed = parseInt(trimmed, 10);

  if (!isValidInteger(parsed)) {
    return defaultValue;
  }

  // Apply validation rules
  if (!options.allowNegative && parsed < 0) {
    return defaultValue;
  }

  if (options.min !== undefined && parsed < options.min) {
    return defaultValue;
  }

  if (options.max !== undefined && parsed > options.max) {
    return defaultValue;
  }

  return parsed;
}

/**
 * Safe port number parsing
 */
export function safeParsePort(value: unknown, defaultPort: number = 3000): number {
  return safeParseInt(value, defaultPort, {
    min: 1,
    max: 65535,
    allowNegative: false,
  });
}

/**
 * Safe JSON parsing with fallback
 */
export function safeJsonParse<T>(
  jsonString: unknown,
  fallback: T
): T {
  if (!isString(jsonString)) {
    return fallback;
  }

  if (jsonString.trim() === '') {
    return fallback;
  }

  try {
    const parsed = JSON.parse(jsonString);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Safe boolean parsing
 */
export function safeParseBoolean(
  value: unknown,
  defaultValue: boolean = false
): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

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

  return defaultValue;
}

/**
 * Safe environment variable access
 */
export function safeGetEnv(
  key: string,
  defaultValue: string = ''
): string {
  const value = process.env[key];
  return isString(value) ? value : defaultValue;
}

/**
 * Required environment variable with validation
 */
export function requireEnv(key: string): string {
  const value = process.env[key];
  
  if (!isString(value) || value.trim() === '') {
    throw new Error(`Required environment variable '${key}' is missing or empty`);
  }

  return value.trim();
}

/**
 * Safe number parsing with float support
 */
export function safeParseFloat(
  value: unknown,
  defaultValue: number = 0,
  options: {
    min?: number;
    max?: number;
    allowNaN?: boolean;
  } = {}
): number {
  if (isNumber(value)) {
    return value;
  }

  if (!isString(value)) {
    return defaultValue;
  }

  const parsed = parseFloat(value.trim());

  if (!options.allowNaN && isNaN(parsed)) {
    return defaultValue;
  }

  if (options.min !== undefined && parsed < options.min) {
    return defaultValue;
  }

  if (options.max !== undefined && parsed > options.max) {
    return defaultValue;
  }

  return parsed;
}

/**
 * Safe array parsing from JSON string
 */
export function safeParseArray<T>(
  value: unknown,
  fallback: T[] = []
): T[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (!isString(value)) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Safe URL parsing
 */
export function safeParseUrl(
  value: unknown,
  fallback: string = ''
): string {
  if (!isString(value)) {
    return fallback;
  }

  try {
    new URL(value);
    return value;
  } catch {
    return fallback;
  }
}

/**
 * Safe database timeout parsing
 */
export function safeParseDatabaseTimeout(
  value: unknown,
  defaultTimeout: number = 30000
): number {
  return safeParseInt(value, defaultTimeout, {
    min: 1000, // Minimum 1 second
    max: 300000, // Maximum 5 minutes
    allowNegative: false,
  });
}

/**
 * Safe pool size parsing
 */
export function safeParsePoolSize(
  value: unknown,
  defaultSize: number = 10
): number {
  return safeParseInt(value, defaultSize, {
    min: 1,
    max: 100,
    allowNegative: false,
  });
}