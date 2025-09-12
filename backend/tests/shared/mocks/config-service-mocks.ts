/**
 * Configuration Service Mock Implementation - DEPRECATED
 * Use centralized test factories from ../test-factories.ts instead
 * @deprecated - This file will be removed in the next cleanup phase
 */

import { TEST_CONFIG } from '../../config/test-constants';
import { createMockConfigService } from '../test-factories';

// Re-export centralized mock for backward compatibility
export const createMockConfigs = () => TEST_CONFIG;

// Re-export factory for backward compatibility
export { createMockConfigService } from '../test-factories';

// Legacy export - deprecated
export const mockConfigService = createMockConfigService();

// Mark as deprecated
console.warn('[DEPRECATED] config-service-mocks.ts is deprecated. Use test-factories.ts instead.');
