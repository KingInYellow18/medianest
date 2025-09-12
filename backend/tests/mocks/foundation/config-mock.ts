/**
 * STANDARDIZED CONFIG MOCK - Complete Environment Configuration
 * 
 * This mock provides a comprehensive configuration setup that matches
 * the actual config service structure and ensures all environment variables
 * are properly mocked for test execution.
 */

import { vi } from 'vitest';

// ✅ ENVIRONMENT SETUP - Comprehensive Test Configuration
export function setupTestEnvironment() {
  // Core environment
  process.env.NODE_ENV = 'test';
  
  // JWT Configuration - consistent across all tests
  process.env.JWT_SECRET = 'test-jwt-secret-key-32-bytes-long';
  process.env.JWT_ISSUER = 'medianest-test';
  process.env.JWT_AUDIENCE = 'medianest-test-users';
  process.env.JWT_SECRET_ROTATION = undefined;
  
  // Database Configuration - consistent test values
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5433/medianest_test';
  process.env.DATABASE_POOL_SIZE = '2';
  process.env.DATABASE_TIMEOUT = '3000';
  
  // Redis Configuration - consistent test values
  process.env.REDIS_URL = 'redis://localhost:6380/15';
  process.env.REDIS_TEST_DB = '15';
  
  // Plex Configuration - consistent test values
  process.env.PLEX_CLIENT_ID = 'test-plex-client-id';
  process.env.PLEX_CLIENT_SECRET = 'test-plex-client-secret';
  
  // Application Configuration
  process.env.FRONTEND_URL = 'http://localhost:3000';
  process.env.BACKEND_URL = 'http://localhost:4000';
  process.env.LOG_LEVEL = 'silent';
  
  // Encryption Configuration
  process.env.ENCRYPTION_KEY = 'test-encryption-key-32-bytes-long';
  
  // Server Configuration
  process.env.PORT = '4000';
  process.env.HOST = 'localhost';
  
  // Version
  process.env.npm_package_version = '1.0.0';
}

// ✅ CONFIG MOCK - Complete Configuration Service Mock
export const createConfigServiceMock = () => ({
  // Auth Configuration
  getAuthConfig: vi.fn().mockReturnValue({
    JWT_SECRET: 'test-jwt-secret-key-32-bytes-long',
    JWT_SECRET_ROTATION: undefined,
    JWT_ISSUER: 'medianest-test',
    JWT_AUDIENCE: 'medianest-test-users',
    JWT_ALGORITHM: 'HS256',
    JWT_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    REFRESH_TOKEN_COOKIE_NAME: 'refreshToken',
    REFRESH_TOKEN_COOKIE_DOMAIN: 'localhost',
    REFRESH_TOKEN_COOKIE_PATH: '/',
    REFRESH_TOKEN_COOKIE_SECURE: false,
    REFRESH_TOKEN_COOKIE_HTTP_ONLY: true,
    REFRESH_TOKEN_COOKIE_SAME_SITE: 'strict',
  }),

  // Database Configuration
  getDatabaseConfig: vi.fn().mockReturnValue({
    DATABASE_URL: 'postgresql://test:test@localhost:5433/medianest_test',
    DATABASE_POOL_SIZE: 2,
    DATABASE_TIMEOUT: 3000,
    DATABASE_IDLE_TIMEOUT: 10000,
    DATABASE_SSL: false,
  }),

  // Redis Configuration
  getRedisConfig: vi.fn().mockReturnValue({
    REDIS_URL: 'redis://localhost:6380/15',
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6380,
    REDIS_PASSWORD: undefined,
    REDIS_DB: 15,
    REDIS_TIMEOUT: 5000,
    REDIS_RETRY_ATTEMPTS: 3,
  }),

  // Server Configuration
  getServerConfig: vi.fn().mockReturnValue({
    PORT: 4000,
    HOST: 'localhost',
    NODE_ENV: 'test',
    FRONTEND_URL: 'http://localhost:3000',
    BACKEND_URL: 'http://localhost:4000',
    API_VERSION: 'v1',
    CORS_ORIGINS: ['http://localhost:3000'],
    TRUST_PROXY: false,
  }),

  // Plex Configuration
  getPlexConfig: vi.fn().mockReturnValue({
    PLEX_CLIENT_ID: 'test-plex-client-id',
    PLEX_CLIENT_SECRET: 'test-plex-client-secret',
    PLEX_CALLBACK_URL: 'http://localhost:4000/api/auth/plex/callback',
    PLEX_API_BASE_URL: 'https://plex.tv',
    PLEX_TIMEOUT: 5000,
  }),

  // Security Configuration
  getSecurityConfig: vi.fn().mockReturnValue({
    ENCRYPTION_KEY: 'test-encryption-key-32-bytes-long',
    BCRYPT_SALT_ROUNDS: 10,
    RATE_LIMIT_WINDOW_MS: 900000,
    RATE_LIMIT_MAX_REQUESTS: 100,
    SESSION_SECRET: 'test-session-secret',
    CSRF_SECRET: 'test-csrf-secret',
  }),

  // Logging Configuration
  getLoggingConfig: vi.fn().mockReturnValue({
    LOG_LEVEL: 'silent',
    LOG_FORMAT: 'json',
    LOG_FILE: undefined,
    LOG_MAX_SIZE: '20m',
    LOG_MAX_FILES: '14d',
  }),

  // Generic get method
  get: vi.fn().mockImplementation((category: string, key?: string) => {
    const configs = {
      auth: createConfigServiceMock().getAuthConfig(),
      database: createConfigServiceMock().getDatabaseConfig(),
      redis: createConfigServiceMock().getRedisConfig(),
      server: createConfigServiceMock().getServerConfig(),
      plex: createConfigServiceMock().getPlexConfig(),
      security: createConfigServiceMock().getSecurityConfig(),
      logging: createConfigServiceMock().getLoggingConfig(),
    };

    const config = configs[category as keyof typeof configs];
    if (key && config) {
      return config[key as keyof typeof config];
    }
    return config;
  }),

  // Validation methods
  validate: vi.fn().mockReturnValue({ isValid: true, errors: [] }),
  getValidationErrors: vi.fn().mockReturnValue([]),
  isValid: vi.fn().mockReturnValue(true),
});

// ✅ GLOBAL CONFIG MOCK APPLICATION
export function applyConfigMocks() {
  // Setup environment first
  setupTestEnvironment();

  // Apply config service mock
  vi.mock('@/config/config.service', () => ({
    configService: createConfigServiceMock(),
  }));

  // Also mock direct config imports
  vi.mock('@/config', () => ({
    config: {
      jwt: {
        secret: 'test-jwt-secret-key-32-bytes-long',
        issuer: 'medianest-test',
        audience: 'medianest-test-users',
      },
      encryption: {
        key: 'test-encryption-key-32-bytes-long',
      },
      database: {
        url: 'postgresql://test:test@localhost:5433/medianest_test',
      },
      redis: {
        url: 'redis://localhost:6380/15',
      },
      server: {
        port: 4000,
        host: 'localhost',
      },
    },
  }));

  return createConfigServiceMock();
}

// ✅ CLEANUP FUNCTION
export function cleanupTestEnvironment() {
  // Clean up test environment variables
  delete process.env.JWT_SECRET;
  delete process.env.JWT_ISSUER;
  delete process.env.JWT_AUDIENCE;
  delete process.env.JWT_SECRET_ROTATION;
  delete process.env.ENCRYPTION_KEY;
  delete process.env.DATABASE_URL;
  delete process.env.DATABASE_POOL_SIZE;
  delete process.env.DATABASE_TIMEOUT;
  delete process.env.REDIS_URL;
  delete process.env.REDIS_TEST_DB;
  delete process.env.PLEX_CLIENT_ID;
  delete process.env.PLEX_CLIENT_SECRET;
  delete process.env.FRONTEND_URL;
  delete process.env.BACKEND_URL;
  delete process.env.LOG_LEVEL;
  delete process.env.PORT;
  delete process.env.HOST;
  delete process.env.npm_package_version;
}