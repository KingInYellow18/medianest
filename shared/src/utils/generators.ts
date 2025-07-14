// Generator utility functions
import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a correlation ID for request tracking
 */
export function generateCorrelationId(): string {
  return uuidv4();
}

/**
 * Generate a simple ID for non-critical use cases
 */
export function generateSimpleId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a session ID
 */
export function generateSessionId(): string {
  return `session_${generateCorrelationId()}`;
}

/**
 * Generate a request ID
 */
export function generateRequestId(): string {
  return `req_${generateCorrelationId()}`;
}
