/**
 * JWT Mock Implementation - DEPRECATED
 * Use centralized test factories from ../test-factories.ts instead
 * @deprecated - This file will be removed in the next cleanup phase
 */

import { createMockJWTPayload, createMockTokenRotationInfo } from '../test-factories';

// Re-export centralized factories for backward compatibility
export { createMockJWTPayload, createMockTokenRotationInfo } from '../test-factories';

// Mark as deprecated
console.warn('[DEPRECATED] jwt-mocks.ts is deprecated. Use test-factories.ts instead.');
