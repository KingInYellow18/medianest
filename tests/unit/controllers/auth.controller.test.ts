/**
 * AUTH CONTROLLER UNIT TESTS
 * 
 * Comprehensive tests for AuthController covering:
 * - Login/logout workflows
 * - Token management
 * - Error handling
 * - Security validations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthController } from '../../../backend/src/controllers/auth.controller';
import { AuthenticationFacade } from '../../../backend/src/auth/authentication-facade';
import { UserService } from '../../../backend/src/services/user.service';
import { createMockAuthenticatedRequest, createMockResponse, createMockNext } from '../../mocks/auth-mock';
import { jwtTestHelpers } from '../../mocks/jwt-mock';
import { AuthenticationError, ValidationError } from '../../../backend/src/utils/errors';

// Mock dependencies
vi.mock('../../../backend/src/auth/authentication-facade');
vi.mock('../../../backend/src/services/user.service');
vi.mock('../../../backend/src/utils/logger');

describe('AuthController', () => {
  let authController: AuthController;
  let mockAuthFacade: any;
  let mockUserService: any;
  let mockRequest: any;
  let mockResponse: any;
  let mockNext: any;

  beforeEach(() => {
    mockAuthFacade = {
      authenticate: vi.fn(),
      authenticateOptional: vi.fn(),
      generateTokens: vi.fn(),
      refreshToken: vi.fn(),
      logout: vi.fn(),
      validateToken: vi.fn(),
    };

    mockUserService = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      updateLastLogin: vi.fn(),
      validateUser: vi.fn(),
    };

    authController = new AuthController(mockAuthFacade, mockUserService);
    mockRequest = createMockAuthenticatedRequest();
    mockResponse = createMockResponse();
    mockNext = createMockNext();
  });

  describe('login', () => {
    it('should login user successfully with valid credentials', async () => {
      const loginData = {
        email: 'test@medianest.com',
        password: 'password123',
        rememberMe: false,
      };

      const user = {
        id: 'test-user-id',
        email: 'test@medianest.com',
        name: 'Test User',
        role: 'USER',
      };

      const tokens = {
        accessToken: jwtTestHelpers.createValidToken(),
        refreshToken: jwtTestHelpers.createRefreshToken(),
      };

      mockRequest.body = loginData;
      mockUserService.findByEmail.mockResolvedValue(user);
      mockAuthFacade.generateTokens.mockReturnValue(tokens);
      mockUserService.updateLastLogin.mockResolvedValue(user);

      await authController.login(mockRequest, mockResponse, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user: expect.objectContaining({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          }),
          tokens,
        },
        message: 'Login successful',
      });

      expect(mockUserService.updateLastLogin).toHaveBeenCalledWith(user.id);
    });

    it('should handle remember me option', async () => {
      const loginData = {
        email: 'test@medianest.com',
        password: 'password123',
        rememberMe: true,
      };

      const user = { id: 'test-user-id', email: 'test@medianest.com' };
      const tokens = { accessToken: 'token', refreshToken: 'refresh' };

      mockRequest.body = loginData;
      mockUserService.findByEmail.mockResolvedValue(user);
      mockAuthFacade.generateTokens.mockReturnValue(tokens);
      mockUserService.updateLastLogin.mockResolvedValue(user);

      await authController.login(mockRequest, mockResponse, mockNext);

      expect(mockAuthFacade.generateTokens).toHaveBeenCalledWith(
        user,
        true, // rememberMe
        expect.any(Object)
      );
    });

    it('should return 401 for invalid credentials', async () => {
      const loginData = {
        email: 'test@medianest.com',
        password: 'wrongpassword',
      };

      mockRequest.body = loginData;
      mockUserService.findByEmail.mockResolvedValue(null);

      await authController.login(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'Invalid credentials',
        })
      );
    });

    it('should validate required fields', async () => {
      const loginData = {
        email: '', // Invalid email
        password: '',
      };

      mockRequest.body = loginData;

      await authController.login(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.any(ValidationError)
      );
    });

    it('should handle inactive users', async () => {
      const loginData = {
        email: 'test@medianest.com',
        password: 'password123',
      };

      const inactiveUser = {
        id: 'test-user-id',
        email: 'test@medianest.com',
        status: 'inactive',
      };

      mockRequest.body = loginData;
      mockUserService.findByEmail.mockResolvedValue(inactiveUser);

      await authController.login(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: 'Account is inactive',
        })
      );
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      const user = { id: 'test-user-id', email: 'test@medianest.com' };
      const token = jwtTestHelpers.createValidToken();
      const sessionId = 'test-session-id';

      mockRequest.user = user;
      mockRequest.token = token;
      mockRequest.sessionId = sessionId;
      
      mockAuthFacade.logout.mockResolvedValue(undefined);

      await authController.logout(mockRequest, mockResponse, mockNext);

      expect(mockAuthFacade.logout).toHaveBeenCalledWith(token, sessionId);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logout successful',
      });
    });

    it('should handle logout without session ID', async () => {
      const user = { id: 'test-user-id', email: 'test@medianest.com' };
      const token = jwtTestHelpers.createValidToken();

      mockRequest.user = user;
      mockRequest.token = token;
      // No sessionId

      mockAuthFacade.logout.mockResolvedValue(undefined);

      await authController.logout(mockRequest, mockResponse, mockNext);

      expect(mockAuthFacade.logout).toHaveBeenCalledWith(token, undefined);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logout successful',
      });
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const refreshTokenData = {
        refreshToken: jwtTestHelpers.createRefreshToken(),
      };

      const newTokens = {
        accessToken: jwtTestHelpers.createValidToken(),
        refreshToken: jwtTestHelpers.createRefreshToken(),
        user: {
          id: 'test-user-id',
          email: 'test@medianest.com',
          name: 'Test User',
          role: 'USER',
        },
      };

      mockRequest.body = refreshTokenData;
      mockAuthFacade.refreshToken.mockResolvedValue(newTokens);

      await authController.refreshToken(mockRequest, mockResponse, mockNext);

      expect(mockAuthFacade.refreshToken).toHaveBeenCalledWith(refreshTokenData.refreshToken);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: newTokens,
        message: 'Token refreshed successfully',
      });
    });

    it('should return 401 for invalid refresh token', async () => {
      const refreshTokenData = {
        refreshToken: 'invalid-refresh-token',
      };

      mockRequest.body = refreshTokenData;
      mockAuthFacade.refreshToken.mockRejectedValue(new AuthenticationError('Invalid refresh token'));

      await authController.refreshToken(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'Invalid refresh token',
        })
      );
    });

    it('should validate refresh token presence', async () => {
      mockRequest.body = {}; // Missing refresh token

      await authController.refreshToken(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.any(ValidationError)
      );
    });
  });

  describe('profile', () => {
    it('should return user profile', async () => {
      const user = {
        id: 'test-user-id',
        email: 'test@medianest.com',
        name: 'Test User',
        role: 'USER',
        plexId: 'test-plex-id',
        plexUsername: 'testuser',
      };

      mockRequest.user = user;

      await authController.profile(mockRequest, mockResponse, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user: expect.objectContaining({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          }),
        },
      });
    });

    it('should handle missing user in request', async () => {
      // No user attached to request

      await authController.profile(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'User not authenticated',
        })
      );
    });
  });

  describe('validateToken', () => {
    it('should validate token successfully', async () => {
      const token = jwtTestHelpers.createValidToken();
      const tokenPayload = {
        userId: 'test-user-id',
        email: 'test@medianest.com',
        role: 'USER',
        exp: Math.floor(Date.now() / 1000) + 900,
      };

      mockRequest.body = { token };
      mockAuthFacade.validateToken.mockReturnValue(tokenPayload);

      await authController.validateToken(mockRequest, mockResponse, mockNext);

      expect(mockAuthFacade.validateToken).toHaveBeenCalledWith(token);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          valid: true,
          payload: tokenPayload,
        },
        message: 'Token is valid',
      });
    });

    it('should return invalid for bad token', async () => {
      const invalidToken = 'invalid-token';

      mockRequest.body = { token: invalidToken };
      mockAuthFacade.validateToken.mockImplementation(() => {
        throw new AuthenticationError('Invalid token');
      });

      await authController.validateToken(mockRequest, mockResponse, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          valid: false,
          error: 'Invalid token',
        },
        message: 'Token validation completed',
      });
    });

    it('should validate token presence', async () => {
      mockRequest.body = {}; // Missing token

      await authController.validateToken(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.any(ValidationError)
      );
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const passwordData = {
        currentPassword: 'oldpassword123',
        newPassword: 'newpassword123',
        confirmPassword: 'newpassword123',
      };

      const user = {
        id: 'test-user-id',
        email: 'test@medianest.com',
        password: 'hashed-old-password',
      };

      mockRequest.user = { id: user.id };
      mockRequest.body = passwordData;
      mockUserService.findById.mockResolvedValue(user);
      mockUserService.update.mockResolvedValue({ ...user, password: 'hashed-new-password' });

      // Mock bcrypt compare and hash
      const bcrypt = await import('bcrypt');
      vi.mocked(bcrypt.compare).mockResolvedValue(true);
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed-new-password');

      await authController.changePassword(mockRequest, mockResponse, mockNext);

      expect(mockUserService.update).toHaveBeenCalledWith(
        user.id,
        expect.objectContaining({
          password: 'hashed-new-password',
        })
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password changed successfully',
      });
    });

    it('should validate current password', async () => {
      const passwordData = {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword123',
        confirmPassword: 'newpassword123',
      };

      const user = {
        id: 'test-user-id',
        password: 'hashed-password',
      };

      mockRequest.user = { id: user.id };
      mockRequest.body = passwordData;
      mockUserService.findById.mockResolvedValue(user);

      const bcrypt = await import('bcrypt');
      vi.mocked(bcrypt.compare).mockResolvedValue(false);

      await authController.changePassword(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'Current password is incorrect',
        })
      );
    });

    it('should validate password confirmation', async () => {
      const passwordData = {
        currentPassword: 'oldpassword123',
        newPassword: 'newpassword123',
        confirmPassword: 'differentpassword123', // Doesn't match
      };

      mockRequest.body = passwordData;

      await authController.changePassword(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.any(ValidationError)
      );
    });
  });
});