/**
 * Authentication Facade Mock Implementation - DEPRECATED
 * Use centralized test factories from ../test-factories.ts instead
 * @deprecated - This file will be removed in the next cleanup phase
 */

import { 
  createMockAuthenticatedUser, 
  createMockAuthResult, 
  createMockUserRepository,
  createMockRequest,
  createMockResponse
} from '../test-factories';

// Re-export centralized factories for backward compatibility
export { 
  createMockAuthenticatedUser, 
  createMockAuthResult, 
  createMockUserRepository,
  createMockRequest,
  createMockResponse
} from '../test-factories';

// Mark as deprecated
console.warn('[DEPRECATED] auth-facade-mocks.ts is deprecated. Use test-factories.ts instead.');