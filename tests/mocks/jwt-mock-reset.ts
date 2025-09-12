/**
 * JWT MOCK RESET FUNCTIONS
 *
 * Standalone reset functions for JWT mocks
 */

import { vi } from 'vitest';

/**
 * Reset function for JWT mocks
 */
export function resetJWTMocks() {
  // Clear all mocks
  vi.clearAllMocks();

  // Reset specific JWT mock behavior can be added here
  console.log('✅ JWT mocks reset');
}
