import { describe, it, expect, vi, beforeAll } from 'vitest';

// Set up environment variables before any imports
beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key-32-bytes-long';
  process.env.JWT_ISSUER = 'medianest-test';
  process.env.JWT_AUDIENCE = 'medianest-test-users';
  process.env.NEXTAUTH_SECRET = 'test-nextauth-secret-key-32-bytes-long';
  process.env.ENCRYPTION_KEY = 'test-encryption-key-32-bytes-long';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5433/medianest_test';
  process.env.REDIS_URL = 'redis://localhost:6380';
  process.env.PLEX_CLIENT_ID = 'test-plex-client-id';
  process.env.PLEX_CLIENT_SECRET = 'test-plex-client-secret';
  process.env.FRONTEND_URL = 'http://localhost:3000';
  process.env.LOG_LEVEL = 'silent';
});

// Mock all external dependencies
vi.mock('@/config', () => ({
  config: {
    NODE_ENV: 'test',
    jwt: {
      secret: 'test-jwt-secret-key-32-bytes-long',
      issuer: 'medianest-test',
      audience: 'medianest-test-users',
    },
  },
}));

vi.mock('@/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    $disconnect: vi.fn(),
    $on: vi.fn(),
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('API Components Validation', () => {
  it('should validate JWT service can be imported', async () => {
    // Mock JWT service dependencies first
    vi.mock('jsonwebtoken', () => ({
      default: {
        sign: vi.fn(() => 'test-token'),
        verify: vi.fn(() => ({ userId: 'test', role: 'user' })),
      },
    }));

    const { JwtService } = await import('@/services/jwt.service');
    expect(JwtService).toBeDefined();
  });

  it('should validate auth controller can be imported', async () => {
    // This test checks if the controller can be imported without throwing
    try {
      await import('@/controllers/auth.controller');
      expect(true).toBe(true); // If we get here, import succeeded
    } catch (error) {
      console.error('Auth controller import failed:', error);
      throw error;
    }
  });

  it('should validate media controller can be imported', async () => {
    try {
      await import('@/controllers/media.controller');
      expect(true).toBe(true);
    } catch (error) {
      console.error('Media controller import failed:', error);
      throw error;
    }
  });

  it('should validate app can be constructed', async () => {
    // Mock Express and related dependencies
    vi.mock('express', () => ({
      default: Object.assign(
        vi.fn(() => ({
          use: vi.fn(),
          get: vi.fn(),
          post: vi.fn(),
          put: vi.fn(),
          patch: vi.fn(),
          delete: vi.fn(),
          listen: vi.fn(),
        })),
        {
          json: vi.fn(() => ({})),
          urlencoded: vi.fn(() => ({})),
          static: vi.fn(() => ({})),
        },
      ),
      Router: vi.fn(() => ({
        use: vi.fn(),
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
      })),
    }));

    vi.mock('socket.io', () => ({
      Server: vi.fn(() => ({
        on: vi.fn(),
        emit: vi.fn(),
      })),
    }));

    try {
      await import('@/app');
      expect(true).toBe(true);
    } catch (error) {
      console.error('App import failed:', error);
      throw error;
    }
  });
});
