/**
 * PRISMA MOCK RESET FUNCTIONS
 *
 * Standalone reset functions for Prisma mocks
 */

import { vi } from 'vitest';

/**
 * Reset function for Prisma mocks
 */
export function resetPrismaMocks() {
  // Clear all mocks
  vi.clearAllMocks();

  // Reset specific Prisma mock behavior can be added here
  console.log('✅ Prisma mocks reset');
}
