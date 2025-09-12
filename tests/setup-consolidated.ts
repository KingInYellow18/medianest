/**
 * ROOT TESTS SETUP - CONSOLIDATED
 * Imports shared test infrastructure and adds root-specific configurations
 */

import './setup-shared';
import { vi } from 'vitest';

// Root-specific mocks
global.fetch = vi.fn();

// Mock next-auth for frontend integration tests
vi.mock('next-auth/react', () => ({
  signIn: vi.fn(() => Promise.resolve({ error: null })),
  signOut: vi.fn(() => Promise.resolve()),
  useSession: vi.fn(() => ({ data: null, status: 'unauthenticated' })),
}));

vi.mock('winston-daily-rotate-file', () => ({
  default: vi.fn(),
}));

// Additional environment variables specific to root tests
process.env.PLEX_CLIENT_ID = 'test-plex-client-id';
process.env.PLEX_CLIENT_SECRET = 'test-plex-client-secret';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-bytes-long';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.LOG_LEVEL = 'error'; // Reduce noise during tests

// Legacy global utilities for backward compatibility
// These will be deprecated in favor of imports from setup-shared
global.createTestUser = (overrides = {}) => ({
  id: 'test-user-id',
  plexId: 'test-plex-id',
  username: 'testuser',
  email: 'test@example.com',
  role: 'user',
  createdAt: new Date(),
  lastLoginAt: new Date(),
  status: 'active',
  plexToken: null,
  ...overrides,
});

global.createTestJWT = (payload = {}) => {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    {
      userId: 'test-user-id',
      role: 'user',
      ...payload,
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' },
  );
};