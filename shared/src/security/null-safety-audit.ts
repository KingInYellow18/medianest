/**
 * NULL SAFETY AUDIT SYSTEM
 * Comprehensive null safety monitoring and validation
 */

import {
  isString,
  isNumber,
  isValidInteger,
  isNonNullable,
  safeJsonParse,
} from '../utils/type-guards';

export interface NullSafetyViolation {
  type: 'TYPE_ASSERTION' | 'NULL_ACCESS' | 'UNSAFE_PARSING' | 'MISSING_VALIDATION';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  location: string;
  description: string;
  suggestion: string;
  riskLevel: number; // 1-10
}

export interface NullSafetyAuditResult {
  totalViolations: number;
  criticalViolations: NullSafetyViolation[];
  highPriorityViolations: NullSafetyViolation[];
  mediumPriorityViolations: NullSafetyViolation[];
  lowPriorityViolations: NullSafetyViolation[];
  overallScore: number; // 0-100, 100 being perfectly safe
  recommendations: string[];
}

/**
 * Null Safety Runtime Validator
 */
export class NullSafetyValidator {
  private violations: NullSafetyViolation[] = [];

  /**
   * Validate a value is not null/undefined
   */
  requireNonNull<T>(value: T | null | undefined, context: string): T {
    if (value === null || value === undefined) {
      const violation: NullSafetyViolation = {
        type: 'NULL_ACCESS',
        severity: 'CRITICAL',
        location: context,
        description: `Null/undefined value accessed in ${context}`,
        suggestion: 'Add null checking before accessing value',
        riskLevel: 9,
      };

      this.violations.push(violation);
      throw new Error(`NULL_SAFETY_VIOLATION: ${violation.description}`);
    }

    return value;
  }

  /**
   * Safe type assertion with validation
   */
  safeAssert<T>(value: unknown, validator: (val: unknown) => val is T, context: string): T {
    if (!validator(value)) {
      const violation: NullSafetyViolation = {
        type: 'TYPE_ASSERTION',
        severity: 'HIGH',
        location: context,
        description: `Unsafe type assertion failed in ${context}`,
        suggestion: 'Use proper type guards instead of type assertions',
        riskLevel: 8,
      };

      this.violations.push(violation);
      throw new Error(`TYPE_SAFETY_VIOLATION: ${violation.description}`);
    }

    return value;
  }

  /**
   * Safe integer parsing with validation
   */
  safeParseInt(
    value: unknown,
    defaultValue: number,
    context: string,
    options: { min?: number; max?: number } = {}
  ): number {
    if (!isString(value)) {
      return defaultValue;
    }

    const parsed = parseInt(value, 10);

    if (!isValidInteger(parsed)) {
      const violation: NullSafetyViolation = {
        type: 'UNSAFE_PARSING',
        severity: 'MEDIUM',
        location: context,
        description: `Unsafe integer parsing in ${context}: '${value}'`,
        suggestion: 'Use type guards and validation before parsing',
        riskLevel: 6,
      };

      this.violations.push(violation);
      return defaultValue;
    }

    // Apply bounds checking
    if (options.min !== undefined && parsed < options.min) {
      return defaultValue;
    }
    if (options.max !== undefined && parsed > options.max) {
      return defaultValue;
    }

    return parsed;
  }

  /**
   * Safe JSON parsing with validation
   */
  safeJsonParsing<T>(
    text: string,
    fallback: T,
    context: string,
    validator?: (value: unknown) => value is T
  ): T {
    try {
      const result = safeJsonParse(text, fallback, validator);
      return result;
    } catch (error) {
      const violation: NullSafetyViolation = {
        type: 'UNSAFE_PARSING',
        severity: 'MEDIUM',
        location: context,
        description: `JSON parsing failed in ${context}`,
        suggestion: 'Use safeJsonParse with proper error handling',
        riskLevel: 5,
      };

      this.violations.push(violation);
      return fallback;
    }
  }

  /**
   * Add a violation to the list
   */
  addViolation(violation: NullSafetyViolation): void {
    this.violations.push(violation);
  }

  /**
   * Get all violations
   */
  getViolations(): NullSafetyViolation[] {
    return [...this.violations];
  }

  /**
   * Clear violations
   */
  clearViolations(): void {
    this.violations = [];
  }

  /**
   * Generate audit report
   */
  generateReport(): NullSafetyAuditResult {
    const criticalViolations = this.violations.filter((v) => v.severity === 'CRITICAL');
    const highPriorityViolations = this.violations.filter((v) => v.severity === 'HIGH');
    const mediumPriorityViolations = this.violations.filter((v) => v.severity === 'MEDIUM');
    const lowPriorityViolations = this.violations.filter((v) => v.severity === 'LOW');

    // Calculate overall safety score
    const maxScore = 100;
    const criticalPenalty = criticalViolations.length * 15;
    const highPenalty = highPriorityViolations.length * 10;
    const mediumPenalty = mediumPriorityViolations.length * 5;
    const lowPenalty = lowPriorityViolations.length * 2;

    const overallScore = Math.max(
      0,
      maxScore - criticalPenalty - highPenalty - mediumPenalty - lowPenalty
    );

    // Generate recommendations
    const recommendations: string[] = [];

    if (criticalViolations.length > 0) {
      recommendations.push('URGENT: Fix critical null safety violations immediately');
      recommendations.push('Implement null checks before accessing potentially null values');
    }

    if (highPriorityViolations.length > 0) {
      recommendations.push('Replace unsafe type assertions with proper type guards');
      recommendations.push('Add runtime validation for critical data paths');
    }

    if (mediumPriorityViolations.length > 0) {
      recommendations.push('Improve parsing safety with fallback values');
      recommendations.push('Add validation to JSON parsing operations');
    }

    if (this.violations.length === 0) {
      recommendations.push('Null safety score is excellent - maintain current practices');
    }

    return {
      totalViolations: this.violations.length,
      criticalViolations,
      highPriorityViolations,
      mediumPriorityViolations,
      lowPriorityViolations,
      overallScore,
      recommendations,
    };
  }
}

/**
 * Global null safety validator instance
 */
export const nullSafetyValidator = new NullSafetyValidator();

/**
 * Null Safety Middleware for Express
 */
export function nullSafetyMiddleware() {
  return (req: any, _res: any, next: any) => {
    // Validate common request properties
    try {
      // Ensure body exists if method expects it
      if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body === undefined) {
        console.warn(
          `Null Safety Warning: ${req.method} request to ${req.path} has undefined body`
        );
      }

      // Validate authentication token if present
      const authHeader = req.headers?.authorization;
      if (authHeader && !isString(authHeader)) {
        console.warn('Null Safety Warning: Invalid authorization header type');
      }

      // Validate query parameters for common injection patterns
      if (req.query) {
        for (const [key, value] of Object.entries(req.query)) {
          if (value !== null && value !== undefined && !isString(value) && !Array.isArray(value)) {
            console.warn(`Null Safety Warning: Unexpected query parameter type for ${key}`);
          }
        }
      }

      next();
    } catch (error) {
      console.error('Null Safety Middleware Error:', error);
      next();
    }
  };
}

/**
 * Database connection safety wrapper
 */
export function withDatabaseSafety<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T | null> {
  return operation().catch((error) => {
    console.error(`Database Safety Error in ${context}:`, error);

    // Log as violation for auditing
    nullSafetyValidator.addViolation({
      type: 'NULL_ACCESS',
      severity: 'HIGH',
      location: context,
      description: `Database operation failed: ${error.message}`,
      suggestion: 'Add proper error handling and null checks for database operations',
      riskLevel: 8,
    });

    return null;
  });
}

/**
 * Environment variable safety checker
 */
export function auditEnvironmentVariables(): NullSafetyViolation[] {
  const violations: NullSafetyViolation[] = [];

  // Check critical environment variables
  const criticalVars = ['DATABASE_URL', 'JWT_SECRET', 'REDIS_URL'];

  for (const varName of criticalVars) {
    const value = process.env[varName];

    if (!isString(value) || value.trim() === '') {
      violations.push({
        type: 'MISSING_VALIDATION',
        severity: 'CRITICAL',
        location: `process.env.${varName}`,
        description: `Critical environment variable ${varName} is missing or empty`,
        suggestion: `Ensure ${varName} is properly set in environment configuration`,
        riskLevel: 10,
      });
    }
  }

  return violations;
}

/**
 * Runtime null safety monitoring
 */
export class NullSafetyMonitor {
  private static instance: NullSafetyMonitor;
  private violations: Map<string, number> = new Map();
  private isEnabled = process.env.NODE_ENV !== 'production';

  static getInstance(): NullSafetyMonitor {
    if (!NullSafetyMonitor.instance) {
      NullSafetyMonitor.instance = new NullSafetyMonitor();
    }
    return NullSafetyMonitor.instance;
  }

  /**
   * Track null safety violation
   */
  trackViolation(location: string): void {
    if (!this.isEnabled) return;

    const count = this.violations.get(location) || 0;
    this.violations.set(location, count + 1);

    // Log frequent violations
    if (count > 5) {
      console.warn(`NULL_SAFETY: Frequent violations at ${location} (${count + 1} times)`);
    }
  }

  /**
   * Get violation statistics
   */
  getStatistics(): Record<string, number> {
    return Object.fromEntries(this.violations);
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.violations.clear();
  }
}

export const nullSafetyMonitor = NullSafetyMonitor.getInstance();
