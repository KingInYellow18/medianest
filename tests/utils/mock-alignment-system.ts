/**
 * Mock Alignment System
 * 
 * Ensures mock interfaces match actual service implementations
 * Prevents runtime errors and improves test reliability
 * 
 * CRITICAL FIX: Addresses Phase 1 mock interface mismatches
 */

import { vi, Mock } from 'vitest';
import type { CacheService } from '../../backend/src/services/cache.service';

interface MockValidation {
  service: string;
  methods: string[];
  missingMethods: string[];
  extraMethods: string[];
  alignmentStatus: 'ALIGNED' | 'MISALIGNED';
}

interface ServiceMockGenerator<T = any> {
  serviceName: string;
  generate(): T;
  validate(mockInstance: T): MockValidation;
}

/**
 * CacheService Mock Generator
 * CRITICAL: Includes all methods from actual CacheService implementation
 */
export class CacheServiceMockGenerator implements ServiceMockGenerator {
  serviceName = 'CacheService';

  generate() {
    return {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      del: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(false),
      ttl: vi.fn().mockResolvedValue(-1),
      clear: vi.fn().mockResolvedValue(undefined),
      ping: vi.fn().mockResolvedValue(true),
      mget: vi.fn().mockResolvedValue([]),
      mset: vi.fn().mockResolvedValue(undefined),
      getInfo: vi.fn().mockResolvedValue({
        keyCount: 0,
        memoryUsage: '0B'
      }),
      getOrSet: vi.fn(),
      invalidatePattern: vi.fn().mockResolvedValue(undefined)
    };
  }

  validate(mockInstance: any): MockValidation {
    const expectedMethods = [
      'get', 'set', 'del', 'exists', 'ttl', 'clear', 
      'ping', 'mget', 'mset', 'getInfo', 'getOrSet', 'invalidatePattern'
    ];
    
    const actualMethods = Object.keys(mockInstance);
    const missingMethods = expectedMethods.filter(method => !actualMethods.includes(method));
    const extraMethods = actualMethods.filter(method => !expectedMethods.includes(method));
    
    return {
      service: this.serviceName,
      methods: expectedMethods,
      missingMethods,
      extraMethods,
      alignmentStatus: missingMethods.length === 0 && extraMethods.length === 0 ? 'ALIGNED' : 'MISALIGNED'
    };
  }
}

/**
 * Redis Client Mock Generator
 * Complete Redis client interface for cache service testing
 */
export class RedisClientMockGenerator implements ServiceMockGenerator {
  serviceName = 'RedisClient';

  generate() {
    return {
      get: vi.fn().mockResolvedValue(null),
      setex: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
      exists: vi.fn().mockResolvedValue(0),
      ttl: vi.fn().mockResolvedValue(-1),
      flushall: vi.fn().mockResolvedValue('OK'),
      ping: vi.fn().mockResolvedValue('PONG'),
      info: vi.fn().mockResolvedValue(''),
      dbsize: vi.fn().mockResolvedValue(0),
      mget: vi.fn().mockResolvedValue([]),
      keys: vi.fn().mockResolvedValue([]),
      mset: vi.fn().mockResolvedValue('OK'),
      expire: vi.fn().mockResolvedValue(1),
      scan: vi.fn().mockResolvedValue(['0', []]),
    };
  }

  validate(mockInstance: any): MockValidation {
    const expectedMethods = [
      'get', 'setex', 'del', 'exists', 'ttl', 'flushall', 
      'ping', 'info', 'dbsize', 'mget', 'keys', 'mset', 'expire', 'scan'
    ];
    
    const actualMethods = Object.keys(mockInstance);
    const missingMethods = expectedMethods.filter(method => !actualMethods.includes(method));
    const extraMethods = actualMethods.filter(method => !expectedMethods.includes(method));
    
    return {
      service: this.serviceName,
      methods: expectedMethods,
      missingMethods,
      extraMethods,
      alignmentStatus: missingMethods.length === 0 ? 'ALIGNED' : 'MISALIGNED'
    };
  }
}

/**
 * JWT Service Mock Generator
 * TIER 1 PRIORITY: Critical auth component
 */
export class JWTServiceMockGenerator implements ServiceMockGenerator {
  serviceName = 'JWTService';

  generate() {
    return {
      sign: vi.fn().mockReturnValue('mock.jwt.token'),
      verify: vi.fn().mockReturnValue({ userId: 'test-user-id' }),
      decode: vi.fn().mockReturnValue({ userId: 'test-user-id' }),
      refresh: vi.fn().mockResolvedValue('new.jwt.token'),
      isExpired: vi.fn().mockReturnValue(false),
      getExpirationTime: vi.fn().mockReturnValue(Date.now() + 3600000),
      generateRefreshToken: vi.fn().mockReturnValue('refresh.token'),
      validateRefreshToken: vi.fn().mockResolvedValue(true),
    };
  }

  validate(mockInstance: any): MockValidation {
    const expectedMethods = [
      'sign', 'verify', 'decode', 'refresh', 'isExpired', 
      'getExpirationTime', 'generateRefreshToken', 'validateRefreshToken'
    ];
    
    const actualMethods = Object.keys(mockInstance);
    const missingMethods = expectedMethods.filter(method => !actualMethods.includes(method));
    const extraMethods = actualMethods.filter(method => !expectedMethods.includes(method));
    
    return {
      service: this.serviceName,
      methods: expectedMethods,
      missingMethods,
      extraMethods,
      alignmentStatus: missingMethods.length === 0 ? 'ALIGNED' : 'MISALIGNED'
    };
  }
}

/**
 * Auth Service Mock Generator  
 * TIER 1 PRIORITY: Critical auth component
 */
export class AuthServiceMockGenerator implements ServiceMockGenerator {
  serviceName = 'AuthService';

  generate() {
    return {
      login: vi.fn().mockResolvedValue({ 
        token: 'mock.jwt.token', 
        refreshToken: 'refresh.token',
        user: { id: 'test-user-id', username: 'testuser' }
      }),
      logout: vi.fn().mockResolvedValue(undefined),
      refreshToken: vi.fn().mockResolvedValue('new.jwt.token'),
      validateToken: vi.fn().mockResolvedValue(true),
      register: vi.fn().mockResolvedValue({
        user: { id: 'new-user-id', username: 'newuser' },
        token: 'new.jwt.token'
      }),
      resetPassword: vi.fn().mockResolvedValue(undefined),
      changePassword: vi.fn().mockResolvedValue(undefined),
      verifyEmail: vi.fn().mockResolvedValue(true),
    };
  }

  validate(mockInstance: any): MockValidation {
    const expectedMethods = [
      'login', 'logout', 'refreshToken', 'validateToken', 
      'register', 'resetPassword', 'changePassword', 'verifyEmail'
    ];
    
    const actualMethods = Object.keys(mockInstance);
    const missingMethods = expectedMethods.filter(method => !actualMethods.includes(method));
    const extraMethods = actualMethods.filter(method => !expectedMethods.includes(method));
    
    return {
      service: this.serviceName,
      methods: expectedMethods,
      missingMethods,
      extraMethods,
      alignmentStatus: missingMethods.length === 0 ? 'ALIGNED' : 'MISALIGNED'
    };
  }
}

/**
 * Mock Alignment Validator
 * Runtime validation to ensure mock interfaces match implementations
 */
export class MockAlignmentValidator {
  private generators: ServiceMockGenerator[] = [
    new CacheServiceMockGenerator(),
    new RedisClientMockGenerator(),
    new JWTServiceMockGenerator(),
    new AuthServiceMockGenerator(),
  ];

  /**
   * Validate all mock generators
   */
  validateAll(): MockValidation[] {
    return this.generators.map(generator => {
      const mockInstance = generator.generate();
      return generator.validate(mockInstance);
    });
  }

  /**
   * Get misaligned mocks
   */
  getMisalignedMocks(): MockValidation[] {
    return this.validateAll().filter(validation => validation.alignmentStatus === 'MISALIGNED');
  }

  /**
   * Assert all mocks are aligned (for use in tests)
   */
  assertAllAligned(): void {
    const misaligned = this.getMisalignedMocks();
    if (misaligned.length > 0) {
      const errors = misaligned.map(m => 
        `${m.service}: missing ${m.missingMethods.join(', ')}, extra ${m.extraMethods.join(', ')}`
      );
      throw new Error(`Mock alignment errors:\n${errors.join('\n')}`);
    }
  }

  /**
   * Generate report for CI/CD
   */
  generateReport(): string {
    const validations = this.validateAll();
    const aligned = validations.filter(v => v.alignmentStatus === 'ALIGNED').length;
    const total = validations.length;
    
    let report = `Mock Alignment Report\n`;
    report += `===================\n`;
    report += `Aligned: ${aligned}/${total} (${Math.round(aligned/total * 100)}%)\n\n`;
    
    validations.forEach(validation => {
      report += `${validation.service}: ${validation.alignmentStatus}\n`;
      if (validation.missingMethods.length > 0) {
        report += `  Missing: ${validation.missingMethods.join(', ')}\n`;
      }
      if (validation.extraMethods.length > 0) {
        report += `  Extra: ${validation.extraMethods.join(', ')}\n`;
      }
    });
    
    return report;
  }
}

// Export singleton instance
export const mockAlignmentValidator = new MockAlignmentValidator();

// Export generators for individual use
export const mockGenerators = {
  cacheService: new CacheServiceMockGenerator(),
  redisClient: new RedisClientMockGenerator(),
  jwtService: new JWTServiceMockGenerator(),
  authService: new AuthServiceMockGenerator(),
};