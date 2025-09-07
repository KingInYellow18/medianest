/**
 * Client-safe exports for browser environments
 *
 * This module exports only utilities that are safe to use in the browser
 * and don't depend on Node.js-specific packages like bcrypt.
 *
 * Note: We re-export everything from the main package since the conditional
 * exports in index.ts will handle client-safety at runtime.
 */

// Re-export everything from main package (runtime safety handled in utils/index.ts)
export * from './index';
