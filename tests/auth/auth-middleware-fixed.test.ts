/**
 * FIXED AUTH MIDDLEWARE TESTS
 * Demonstrates proper testing patterns with comprehensive mock infrastructure
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { AuthenticationError } from '../../backend/src/utils/errors';

// Import test utilities
import { createTestRequest, createTestResponse, createTestJWT, createTestUser } from '../setup-comprehensive';

// Mock the auth middleware dependencies
const mockJWT = vi.hoisted(() => ({
  verify: vi.fn(),
  TokenExpiredError: class extends Error { name = 'TokenExpiredError' },
  JsonWebTokenError: class extends Error { name = 'JsonWebTokenError' },
}));

vi.mock('jsonwebtoken', () => mockJWT);

const mockUserRepository = vi.hoisted(() => ({
  findByUserId: vi.fn(),
}));

vi.mock('../../backend/src/repositories/user.repository', () => ({
  UserRepository: vi.fn(() => mockUserRepository),
}));

// Import the middleware after mocks are set up
const { authenticate, optionalAuth } = await vi.importActual('../../backend/src/middleware/auth') as any;

describe('AuthMiddleware', () => {
  let req: any;
  let res: any; 
  let next: NextFunction;

  beforeEach(() => {
    req = createTestRequest();
    res = createTestResponse();
    next = vi.fn();
    
    // Reset mocks
    vi.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should authenticate valid request and attach user to request', async () => {
      // Arrange
      const testUser = createTestUser();
      const token = createTestJWT({ userId: testUser.id });
      
      req.headers.authorization = `Bearer ${token}`;
      mockJWT.verify.mockReturnValue({ userId: testUser.id, role: testUser.role });
      mockUserRepository.findByUserId.mockResolvedValue(testUser);

      // Act
      await authenticate(req, res, next);

      // Assert
      expect(mockJWT.verify).toHaveBeenCalledWith(token, process.env.JWT_SECRET);
      expect(mockUserRepository.findByUserId).toHaveBeenCalledWith(testUser.id);
      expect(req.user).toEqual(testUser);
      expect(next).toHaveBeenCalledWith(); // No error
    });

    it('should call next with error for invalid token', async () => {
      // Arrange
      req.headers.authorization = 'Bearer invalid-token';
      mockJWT.verify.mockImplementation(() => {
        throw new mockJWT.JsonWebTokenError('Invalid token');
      });

      // Act
      await authenticate(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
      expect(req.user).toBeUndefined();
    });

    it('should call next with error when no authorization header', async () => {
      // Arrange
      delete req.headers.authorization;

      // Act
      await authenticate(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
      expect(req.user).toBeUndefined();
    });

    it('should handle expired tokens', async () => {
      // Arrange
      req.headers.authorization = 'Bearer expired-token';
      mockJWT.verify.mockImplementation(() => {
        throw new mockJWT.TokenExpiredError('Token expired', new Date());
      });

      // Act
      await authenticate(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should handle user not found', async () => {
      // Arrange
      const token = createTestJWT();
      req.headers.authorization = `Bearer ${token}`;
      mockJWT.verify.mockReturnValue({ userId: 'non-existent-user', role: 'USER' });
      mockUserRepository.findByUserId.mockResolvedValue(null);

      // Act
      await authenticate(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });
  });

  describe('optionalAuth', () => {
    it('should attach user for valid token', async () => {
      // Arrange
      const testUser = createTestUser();
      const token = createTestJWT({ userId: testUser.id });
      
      req.headers.authorization = `Bearer ${token}`;
      mockJWT.verify.mockReturnValue({ userId: testUser.id, role: testUser.role });
      mockUserRepository.findByUserId.mockResolvedValue(testUser);

      // Act
      await optionalAuth(req, res, next);

      // Assert
      expect(req.user).toEqual(testUser);
      expect(next).toHaveBeenCalledWith(); // No error
    });

    it('should continue without user for invalid token', async () => {
      // Arrange
      req.headers.authorization = 'Bearer invalid-token';
      mockJWT.verify.mockImplementation(() => {
        throw new mockJWT.JsonWebTokenError('Invalid token');
      });

      // Act
      await optionalAuth(req, res, next);

      // Assert
      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith(); // No error
    });

    it('should continue without user when no token provided', async () => {
      // Arrange
      delete req.headers.authorization;

      // Act
      await optionalAuth(req, res, next);

      // Assert
      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith(); // No error
    });
  });
});