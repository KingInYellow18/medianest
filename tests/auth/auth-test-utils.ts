/**
 * SHARED AUTHENTICATION TEST UTILITIES
 * 
 * Comprehensive utilities consolidating common test helpers from:
 * - Mock factories for users, tokens, requests, responses
 * - JWT test helpers for token generation and validation
 * - Database cleanup and setup utilities
 * - Request/response mocking utilities
 * 
 * Used by all consolidated authentication test files
 */

import { vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { AuthenticatedUser } from '../../backend/src/auth/authentication-facade';

// ============================================================================
// JWT Test Helpers
// ============================================================================

export const jwtTestHelpers = {
  createValidToken(payload?: any): string {
    const defaultPayload = {
      userId: 'test-user-123',
      email: 'test@medianest.com',
      role: 'USER',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900, // 15 minutes
    };

    const finalPayload = { ...defaultPayload, ...payload };
    
    // Create a valid JWT format (header.payload.signature)
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payloadBase64 = btoa(JSON.stringify(finalPayload));
    const signature = 'test-signature-' + Math.random().toString(36).substring(7);
    
    return `${header}.${payloadBase64}.${signature}`;
  },

  createExpiredToken(payload?: any): string {
    const expiredPayload = {
      userId: 'test-user-123',
      email: 'test@medianest.com',
      role: 'USER',
      iat: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      exp: Math.floor(Date.now() / 1000) - 1800, // 30 minutes ago (expired)
      ...payload,
    };

    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payloadBase64 = btoa(JSON.stringify(expiredPayload));
    const signature = 'expired-signature-' + Math.random().toString(36).substring(7);
    
    return `${header}.${payloadBase64}.${signature}`;
  },

  createNearExpiredToken(payload?: any): string {
    const nearExpiredPayload = {
      userId: 'test-user-123',
      email: 'test@medianest.com',
      role: 'USER',
      iat: Math.floor(Date.now() / 1000) - 600, // 10 minutes ago
      exp: Math.floor(Date.now() / 1000) + 120, // 2 minutes from now (near expiry)
      ...payload,
    };

    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payloadBase64 = btoa(JSON.stringify(nearExpiredPayload));
    const signature = 'near-expired-signature-' + Math.random().toString(36).substring(7);
    
    return `${header}.${payloadBase64}.${signature}`;
  },

  createRefreshToken(payload?: any): string {
    const refreshPayload = {
      userId: 'test-user-123',
      sessionId: 'test-session-123',
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 604800, // 7 days
      ...payload,
    };

    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payloadBase64 = btoa(JSON.stringify(refreshPayload));
    const signature = 'refresh-signature-' + Math.random().toString(36).substring(7);
    
    return `${header}.${payloadBase64}.${signature}`;
  },

  createValidTokenWithIP(payload: any): string {
    const tokenPayload = {
      userId: 'test-user-123',
      email: 'test@medianest.com',
      role: 'USER',
      ipAddress: payload.ipAddress,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900,
      ...payload,
    };

    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payloadBase64 = btoa(JSON.stringify(tokenPayload));
    const signature = 'ip-bound-signature-' + Math.random().toString(36).substring(7);
    
    return `${header}.${payloadBase64}.${signature}`;
  },

  decodeToken(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      const payload = JSON.parse(atob(parts[1]));
      return payload;
    } catch {
      return null;
    }
  },

  isTokenExpired(token: string): boolean {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) return true;
    
    return decoded.exp < Math.floor(Date.now() / 1000);
  },
};

// ============================================================================
// User Mock Factories
// ============================================================================

export function createTestUser(overrides?: Partial<AuthenticatedUser>): AuthenticatedUser {
  return {
    id: 'test-user-' + Math.random().toString(36).substring(7),
    email: 'test@medianest.com',
    name: 'Test User',
    role: 'user',
    plexId: 'plex-' + Math.random().toString(36).substring(7),
    plexUsername: 'testuser',
    ...overrides,
  };
}

export function createMockUser(overrides?: any): any {
  return {
    id: 'mock-user-' + Math.random().toString(36).substring(7),
    email: 'mock@medianest.com',
    name: 'Mock User',
    role: 'user',
    status: 'active',
    plexId: 'plex-mock-' + Math.random().toString(36).substring(7),
    plexUsername: 'mockuser',
    plexToken: 'encrypted-mock-token',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
    ...overrides,
  };
}

export function createAdminUser(overrides?: Partial<AuthenticatedUser>): AuthenticatedUser {
  return createTestUser({
    role: 'admin',
    email: 'admin@medianest.com',
    name: 'Admin User',
    plexUsername: 'adminuser',
    ...overrides,
  });
}

// ============================================================================
// Request/Response Mock Factories
// ============================================================================

export function createTestRequest(overrides?: any): Partial<Request> {
  return {
    ip: '127.0.0.1',
    method: 'GET',
    path: '/test',
    query: {},
    params: {},
    body: {},
    headers: {
      'user-agent': 'test-agent',
      'content-type': 'application/json',
    },
    get: vi.fn().mockImplementation((name: string) => {
      const headers = overrides?.headers || {};
      return headers[name.toLowerCase()] || 'test-value';
    }),
    cookies: {},
    user: undefined,
    token: undefined,
    deviceId: undefined,
    sessionId: undefined,
    ...overrides,
  };
}

export function createTestResponse(): Partial<Response> {
  const response = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
    redirect: vi.fn().mockReturnThis(),
    locals: {},
    headers: {},
    set: vi.fn().mockReturnThis(),
    get: vi.fn().mockReturnValue('test-header-value'),
  };

  return response;
}

export function createMockAuthenticatedRequest(user?: AuthenticatedUser): any {
  const testUser = user || createTestUser();
  const token = jwtTestHelpers.createValidToken({ userId: testUser.id });

  return createTestRequest({
    user: testUser,
    token,
    headers: {
      authorization: `Bearer ${token}`,
      'user-agent': 'test-agent',
      'content-type': 'application/json',
    },
  });
}

export function createMockResponse(): any {
  return createTestResponse();
}

export function createMockNext(): NextFunction {
  return vi.fn();
}

// ============================================================================
// JWT Creation for E2E Tests
// ============================================================================

export function createTestJWT(payload?: any): string {
  return jwtTestHelpers.createValidToken(payload);
}

// ============================================================================
// Database Test Utilities
// ============================================================================

export class DatabaseCleanup {
  static async cleanAll(): Promise<void> {
    // Mock database cleanup for tests
    // In real implementation, this would clean test database
    const mockCleanupOperations = [
      'DELETE FROM sessions',
      'DELETE FROM refresh_tokens',
      'DELETE FROM users',
      'DELETE FROM device_sessions',
    ];

    // Simulate cleanup operations
    await Promise.all(
      mockCleanupOperations.map(async (operation) => {
        // Mock database operation
        await new Promise(resolve => setTimeout(resolve, 1));
        console.log(`Mock cleanup: ${operation}`);
      })
    );
  }

  static async createTestUser(userData: any): Promise<any> {
    // Mock user creation for tests
    return {
      ...createMockUser(userData),
      created: true,
    };
  }

  static async findUserByEmail(email: string): Promise<any | null> {
    // Mock user lookup by email
    if (email.includes('notfound')) {
      return null;
    }
    return createMockUser({ email });
  }

  static async findUserById(id: string): Promise<any | null> {
    // Mock user lookup by ID
    if (id.includes('notfound')) {
      return null;
    }
    return createMockUser({ id });
  }
}

// ============================================================================
// Mock Service Helpers
// ============================================================================

export const mockServiceHelpers = {
  setupUserRepositoryMocks(userRepository: any) {
    userRepository.findById = vi.fn();
    userRepository.findByEmail = vi.fn();
    userRepository.findByPlexId = vi.fn();
    userRepository.create = vi.fn();
    userRepository.update = vi.fn();
    userRepository.delete = vi.fn();
    userRepository.isFirstUser = vi.fn();
    return userRepository;
  },

  setupSessionRepositoryMocks(sessionRepository: any) {
    sessionRepository.create = vi.fn();
    sessionRepository.findById = vi.fn();
    sessionRepository.delete = vi.fn();
    sessionRepository.deleteExpired = vi.fn();
    return sessionRepository;
  },

  setupDeviceSessionMocks(deviceSessionService: any) {
    deviceSessionService.registerDevice = vi.fn();
    deviceSessionService.validateDevice = vi.fn();
    deviceSessionService.updateLastSeen = vi.fn();
    return deviceSessionService;
  },

  setupJWTMocks() {
    const jwt = vi.hoisted(() => ({
      sign: vi.fn().mockReturnValue('test-jwt-token'),
      verify: vi.fn().mockReturnValue({
        userId: 'test-user-id',
        role: 'USER',
        exp: Math.floor(Date.now() / 1000) + 900,
      }),
      decode: vi.fn().mockReturnValue({
        userId: 'test-user-id',
        role: 'USER',
        exp: Math.floor(Date.now() / 1000) + 900,
      }),
      TokenExpiredError: class extends Error {
        name = 'TokenExpiredError';
        expiredAt: Date;
        constructor(message: string, expiredAt: Date) {
          super(message);
          this.expiredAt = expiredAt;
        }
      },
      JsonWebTokenError: class extends Error {
        name = 'JsonWebTokenError';
        constructor(message: string) {
          super(message);
        }
      },
    }));

    return jwt;
  },
};

// ============================================================================
// Test Assertion Helpers
// ============================================================================

export const testAssertions = {
  expectValidJWTFormat(token: string): void {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error(`Invalid JWT format: expected 3 parts, got ${parts.length}`);
    }
    
    // Try to decode parts to ensure they're valid base64
    try {
      JSON.parse(atob(parts[0])); // header
      JSON.parse(atob(parts[1])); // payload
    } catch {
      throw new Error('Invalid JWT: header or payload not valid base64 JSON');
    }
  },

  expectUserObjectShape(user: any): void {
    const requiredFields = ['id', 'email', 'role'];
    const missingFields = requiredFields.filter(field => !user[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`User object missing required fields: ${missingFields.join(', ')}`);
    }
  },

  expectErrorResponseShape(errorResponse: any): void {
    if (!errorResponse.success || errorResponse.success !== false) {
      throw new Error('Error response should have success: false');
    }
    
    if (!errorResponse.error || !errorResponse.error.statusCode) {
      throw new Error('Error response should have error.statusCode');
    }
    
    if (!errorResponse.error.message) {
      throw new Error('Error response should have error.message');
    }
  },

  expectSuccessResponseShape(successResponse: any): void {
    if (!successResponse.success || successResponse.success !== true) {
      throw new Error('Success response should have success: true');
    }
    
    if (!successResponse.data && !successResponse.message) {
      throw new Error('Success response should have either data or message');
    }
  },
};

// ============================================================================
// Performance Test Helpers
// ============================================================================

export const performanceHelpers = {
  async measureExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const startTime = Date.now();
    const result = await fn();
    const duration = Date.now() - startTime;
    
    return { result, duration };
  },

  createMemoryPressure(): { cleanup: () => void } {
    const arrays: any[] = [];
    
    for (let i = 0; i < 100; i++) {
      arrays.push(new Array(10000).fill(`memory-pressure-${i}`));
    }
    
    return {
      cleanup: () => {
        arrays.length = 0;
      }
    };
  },

  async simulateNetworkDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
};

// ============================================================================
// Security Test Helpers
// ============================================================================

export const securityHelpers = {
  createXSSPayload(): string {
    return '<script>alert("xss-test")</script>';
  },

  createSQLInjectionPayload(): string {
    return "'; DROP TABLE users; --";
  },

  createCSRFPayload(): string {
    return 'csrf-attack-token-' + Math.random().toString(36);
  },

  sanitizeOutput(output: string): string {
    // Mock sanitization - in real implementation would use proper library
    return output
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  },

  validateSecurityHeaders(headers: Record<string, string>): { valid: boolean; missing: string[] } {
    const requiredHeaders = [
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection',
      'strict-transport-security',
    ];

    const missing = requiredHeaders.filter(header => !headers[header]);
    
    return {
      valid: missing.length === 0,
      missing,
    };
  },
};

// ============================================================================
// Accessibility Test Helpers
// ============================================================================

export const accessibilityHelpers = {
  validateAriaLabels(elements: any[]): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    elements.forEach((element, index) => {
      if (!element['aria-label'] && !element['aria-labelledby']) {
        issues.push(`Element ${index} missing aria-label or aria-labelledby`);
      }
    });

    return {
      valid: issues.length === 0,
      issues,
    };
  },

  validateFocusManagement(page: any): Promise<boolean> {
    // Mock focus validation - in real E2E tests would check actual focus
    return Promise.resolve(true);
  },

  checkColorContrast(foreground: string, background: string): { ratio: number; passes: boolean } {
    // Mock contrast checking - in real implementation would calculate actual contrast
    return {
      ratio: 4.5, // Mock ratio
      passes: true,
    };
  },
};

// ============================================================================
// Export All Utilities
// ============================================================================

export default {
  jwtTestHelpers,
  createTestUser,
  createMockUser,
  createAdminUser,
  createTestRequest,
  createTestResponse,
  createMockAuthenticatedRequest,
  createMockResponse,
  createMockNext,
  createTestJWT,
  DatabaseCleanup,
  mockServiceHelpers,
  testAssertions,
  performanceHelpers,
  securityHelpers,
  accessibilityHelpers,
};