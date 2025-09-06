import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { AuthController } from '../../controllers/auth.controller';
import { AppError } from '@medianest/shared';
import {
  mockPrismaClient,
  mockRedisClient,
  createTestUser,
  createTestRequest,
  createTestResponse,
  createTestJWT,
} from '../setup';

// Mock user repository
const mockUserRepository = {
  findByPlexId: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  isFirstUser: vi.fn(),
};

// Mock services
const mockEncryptionService = {
  encryptForStorage: vi.fn().mockReturnValue('encrypted-token'),
};

const mockJwtService = {
  generateAccessToken: vi.fn().mockReturnValue('test-access-token'),
  generateRememberToken: vi.fn().mockReturnValue('test-remember-token'),
};

// Mock axios
const mockAxios = {
  post: vi.fn(),
  get: vi.fn(),
  isAxiosError: vi.fn(),
};

// Mock dependencies
vi.mock('axios', () => ({
  default: mockAxios,
  ...mockAxios,
}));

vi.mock('../../config/database', () => ({
  prisma: mockPrismaClient,
}));

vi.mock('../../config/redis', () => ({
  redis: mockRedisClient,
}));

vi.mock('../../repositories/instances', () => ({
  userRepository: mockUserRepository,
}));

vi.mock('../../services/encryption.service', () => ({
  encryptionService: mockEncryptionService,
}));

vi.mock('../../services/jwt.service', () => ({
  jwtService: mockJwtService,
}));

vi.mock('@/config', () => ({
  config: {
    plex: {
      clientId: 'test-client-id',
    },
  },
}));

describe('AuthController', () => {
  let authController: AuthController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    authController = new AuthController();
    mockRequest = createTestRequest();
    mockResponse = createTestResponse();
    mockNext = vi.fn();

    // Reset all mocks
    vi.clearAllMocks();
    mockAxios.post.mockReset();
    mockAxios.get.mockReset();
    mockAxios.isAxiosError.mockReset();
    mockUserRepository.findByPlexId.mockReset();
    mockUserRepository.create.mockReset();
    mockUserRepository.update.mockReset();
    mockUserRepository.isFirstUser.mockReset();
    mockEncryptionService.encryptForStorage.mockReturnValue('encrypted-token');
    mockJwtService.generateAccessToken.mockReturnValue('test-access-token');
    mockJwtService.generateRememberToken.mockReturnValue('test-remember-token');
  });

  describe('generatePin', () => {
    it('should generate a Plex PIN successfully', async () => {
      const plexResponse = `
        <pin>
          <id>123456</id>
          <code>ABCD1234</code>
          <expires>2024-01-01T01:00:00Z</expires>
        </pin>
      `;

      mockAxios.post.mockResolvedValueOnce({
        data: plexResponse,
      });

      mockRequest.body = {
        clientName: 'MediaNest Test',
      };

      await authController.generatePin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAxios.post).toHaveBeenCalledWith(
        'https://plex.tv/pins.xml',
        null,
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Plex-Client-Identifier': 'test-client-id',
            'X-Plex-Product': 'MediaNest',
            'X-Plex-Device-Name': 'MediaNest Test',
          }),
          timeout: 10000,
        }),
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          id: '123456',
          code: 'ABCD1234',
          qrUrl: 'https://plex.tv/link/?pin=ABCD1234',
          expiresIn: 900,
        },
      });
    });

    it('should use default client name when none provided', async () => {
      const plexResponse = `
        <pin>
          <id>123456</id>
          <code>ABCD1234</code>
        </pin>
      `;

      mockAxios.post.mockResolvedValueOnce({
        data: plexResponse,
      });

      mockRequest.body = {}; // No client name

      await authController.generatePin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAxios.post).toHaveBeenCalledWith(
        'https://plex.tv/pins.xml',
        null,
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Plex-Device-Name': 'MediaNest', // Default
          }),
        }),
      );
    });

    it('should handle invalid Plex response', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: '<invalid>response</invalid>',
      });

      mockRequest.body = {};

      await authController.generatePin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PLEX_ERROR',
          message: 'Invalid response from Plex',
          statusCode: 502,
        }),
      );
    });

    it('should handle Plex connection errors', async () => {
      const connectionError = new Error('Connection refused') as any;
      connectionError.code = 'ECONNREFUSED';
      mockAxios.post.mockRejectedValueOnce(connectionError);

      mockRequest.body = {};

      await authController.generatePin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PLEX_UNREACHABLE',
          message: 'Cannot connect to Plex server. Please try again.',
          statusCode: 503,
        }),
      );
    });

    it('should handle Plex timeout errors', async () => {
      const timeoutError = new Error('Timeout') as any;
      timeoutError.code = 'ETIMEDOUT';
      mockAxios.post.mockRejectedValueOnce(timeoutError);

      await authController.generatePin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PLEX_TIMEOUT',
          statusCode: 504,
        }),
      );
    });
  });

  describe('verifyPin', () => {
    it('should verify PIN and create new user successfully', async () => {
      const pinResponse = `
        <pin>
          <authToken>plex-auth-token</authToken>
        </pin>
      `;

      const userResponse = `
        <user>
          <id>12345</id>
          <username>testuser</username>
          <email>test@example.com</email>
        </user>
      `;

      const testUser = createTestUser({
        plexId: '12345',
        plexUsername: 'testuser',
        email: 'test@example.com',
        role: 'admin', // First user
      });

      mockAxios.get
        .mockResolvedValueOnce({ data: pinResponse })
        .mockResolvedValueOnce({ data: userResponse });

      mockUserRepository.findByPlexId.mockResolvedValueOnce(null); // New user
      mockUserRepository.isFirstUser.mockResolvedValueOnce(true);
      mockUserRepository.create.mockResolvedValueOnce(testUser);

      mockRequest.body = {
        pinId: '123456',
        rememberMe: true,
      };

      mockResponse.locals = { csrfToken: 'test-csrf-token' };

      await authController.verifyPin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockUserRepository.create).toHaveBeenCalledWith({
        plexId: '12345',
        plexUsername: 'testuser',
        email: 'test@example.com',
        plexToken: 'encrypted-token',
        role: 'admin',
      });

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'token',
        'test-access-token',
        expect.any(Object),
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'rememberToken',
        'test-remember-token',
        expect.any(Object),
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user: {
            id: testUser.id,
            username: 'testuser',
            email: 'test@example.com',
            role: 'admin',
          },
          token: 'test-access-token',
          rememberToken: 'test-remember-token',
          csrfToken: 'test-csrf-token',
        },
      });
    });

    it('should verify PIN and update existing user', async () => {
      const pinResponse = `<pin><authToken>plex-auth-token</authToken></pin>`;
      const userResponse = `
        <user>
          <id>12345</id>
          <username>updateduser</username>
          <email>updated@example.com</email>
        </user>
      `;

      const existingUser = createTestUser({ plexId: '12345' });
      const updatedUser = createTestUser({
        plexId: '12345',
        plexUsername: 'updateduser',
        email: 'updated@example.com',
      });

      mockAxios.get
        .mockResolvedValueOnce({ data: pinResponse })
        .mockResolvedValueOnce({ data: userResponse });

      mockUserRepository.findByPlexId.mockResolvedValueOnce(existingUser);
      mockUserRepository.update.mockResolvedValueOnce(updatedUser);

      mockRequest.body = { pinId: '123456', rememberMe: false };
      mockResponse.locals = { csrfToken: 'test-csrf-token' };

      await authController.verifyPin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockUserRepository.update).toHaveBeenCalledWith(
        existingUser.id,
        expect.objectContaining({
          plexUsername: 'updateduser',
          email: 'updated@example.com',
          plexToken: 'encrypted-token',
          lastLoginAt: expect.any(Date),
        }),
      );
    });

    it('should handle PIN not authorized yet', async () => {
      const pinResponse = `<pin><authToken></authToken></pin>`; // Empty token

      mockAxios.get.mockResolvedValueOnce({ data: pinResponse });

      mockRequest.body = { pinId: '123456' };

      await authController.verifyPin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PIN_NOT_AUTHORIZED',
          message: 'PIN has not been authorized yet. Please complete authorization on plex.tv/link',
          statusCode: 400,
        }),
      );
    });

    it('should handle invalid PIN ID', async () => {
      const error = new Error('Not Found') as any;
      error.response = { status: 404 };
      mockAxios.get.mockRejectedValueOnce(error);

      mockRequest.body = { pinId: 'invalid-pin' };

      await authController.verifyPin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'INVALID_PIN',
          message: 'Invalid or expired PIN',
          statusCode: 400,
        }),
      );
    });

    it('should handle database errors', async () => {
      const pinResponse = `<pin><authToken>plex-auth-token</authToken></pin>`;
      const userResponse = `<user><id>12345</id><username>testuser</username></user>`;

      mockAxios.get
        .mockResolvedValueOnce({ data: pinResponse })
        .mockResolvedValueOnce({ data: userResponse });

      mockUserRepository.findByPlexId.mockRejectedValueOnce(new Error('Database error'));

      mockRequest.body = { pinId: '123456' };

      await authController.verifyPin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'DATABASE_ERROR',
          message: 'Failed to save user information',
          statusCode: 503,
        }),
      );
    });

    it('should handle invalid user data from Plex', async () => {
      const pinResponse = `<pin><authToken>plex-auth-token</authToken></pin>`;
      const invalidUserResponse = `<user><invalid>data</invalid></user>`; // Missing required fields

      mockAxios.get
        .mockResolvedValueOnce({ data: pinResponse })
        .mockResolvedValueOnce({ data: invalidUserResponse });

      mockRequest.body = { pinId: '123456' };

      await authController.verifyPin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PLEX_ERROR',
          message: 'Invalid user data from Plex',
          statusCode: 502,
        }),
      );
    });
  });

  describe('logout', () => {
    it('should logout successfully and clear cookies', async () => {
      await authController.logout(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.clearCookie).toHaveBeenCalledWith('token');
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('rememberToken');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logged out successfully',
      });
    });

    it('should always succeed regardless of request state', async () => {
      // Even with no cookies or tokens, logout should succeed
      mockRequest.headers = {};

      await authController.logout(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.clearCookie).toHaveBeenCalledWith('token');
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('rememberToken');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logged out successfully',
      });
    });
  });

  describe('getSession', () => {
    it('should return current user session successfully', async () => {
      const testUser = createTestUser({
        plexUsername: 'sessionuser',
        email: 'session@example.com',
        role: 'user',
      });

      mockRequest.user = testUser;

      await authController.getSession(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user: {
            id: testUser.id,
            username: 'sessionuser',
            email: 'session@example.com',
            role: 'user',
          },
        },
      });
    });

    it('should handle user with no plex username', async () => {
      const testUser = createTestUser({
        plexUsername: null,
        email: 'session@example.com',
        role: 'user',
      });

      mockRequest.user = testUser;

      await authController.getSession(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user: {
            id: testUser.id,
            username: 'session@example.com', // Falls back to email
            email: 'session@example.com',
            role: 'user',
          },
        },
      });
    });

    it('should throw AppError for missing user in request', async () => {
      mockRequest.user = undefined;

      await expect(() =>
        authController.getSession(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(
        expect.objectContaining({
          type: 'UNAUTHORIZED',
          message: 'User not found in request',
          statusCode: 401,
        }),
      );
    });
  });

  describe('Input validation and error handling', () => {
    it('should handle malformed request body in generatePin', async () => {
      // Even with malformed input, generatePin should use defaults
      mockRequest.body = { invalidField: 'test' };

      const plexResponse = `<pin><id>123456</id><code>ABCD1234</code></pin>`;
      mockAxios.post.mockResolvedValueOnce({ data: plexResponse });

      await authController.generatePin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAxios.post).toHaveBeenCalledWith(
        'https://plex.tv/pins.xml',
        null,
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Plex-Device-Name': 'MediaNest', // Should use default
          }),
        }),
      );
    });

    it('should handle malformed request body in verifyPin', async () => {
      mockRequest.body = { invalidField: 'test' }; // Missing required pinId

      await authController.verifyPin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          statusCode: 400,
        }),
      );
    });

    it('should handle JWT generation failure', async () => {
      const pinResponse = `<pin><authToken>plex-auth-token</authToken></pin>`;
      const userResponse = `<user><id>12345</id><username>testuser</username></user>`;
      const testUser = createTestUser();

      mockAxios.get
        .mockResolvedValueOnce({ data: pinResponse })
        .mockResolvedValueOnce({ data: userResponse });

      mockUserRepository.findByPlexId.mockResolvedValueOnce(null);
      mockUserRepository.isFirstUser.mockResolvedValueOnce(false);
      mockUserRepository.create.mockResolvedValueOnce(testUser);

      // Mock JWT generation failure
      mockJwtService.generateAccessToken.mockImplementationOnce(() => {
        throw new Error('JWT generation failed');
      });

      mockRequest.body = { pinId: '123456' };

      await authController.verifyPin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'TOKEN_ERROR',
          message: 'Failed to generate authentication tokens',
          statusCode: 503,
        }),
      );
    });
  });
});
