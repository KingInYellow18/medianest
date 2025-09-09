/**
 * Middleware Mock Implementation - DEPRECATED
 * Use centralized test factories from ../test-factories.ts instead
 * @deprecated - This file will be removed in the next cleanup phase
 */

import { 
  createMockRequest,
  createMockResponse,
  createMockAuthenticatedUser
} from '../test-factories';

// Re-export centralized factories for backward compatibility
export { 
  createMockRequest,
  createMockResponse,
  createMockAuthenticatedUser
} from '../test-factories';

// Mark as deprecated
console.warn('[DEPRECATED] middleware-mocks.ts is deprecated. Use test-factories.ts instead.');