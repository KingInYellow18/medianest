// Shared test utilities - applying proven 24-agent success patterns

export * from './error-factories';
export * from './test-factories';
export * from './test-helpers';
export * from './mock-data';

// Re-export commonly used test utilities for consistency
export { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
