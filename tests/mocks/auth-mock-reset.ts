/**
 * AUTH MOCK RESET FUNCTIONS
 *
 * Standalone reset functions for Auth mocks
 */

import { vi } from 'vitest';

/**
 * Reset function for auth mocks
 */
export function resetAuthMocks() {
  // Clear all mocks
  vi.clearAllMocks();

  // Reset specific auth mock behavior can be added here
  console.log('✅ Auth mocks reset');
}
