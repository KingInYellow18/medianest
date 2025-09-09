import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { AuthController, authController } from '../../../src/controllers/auth.controller';
import { userRepository } from '../../../src/repositories/instances';
import { encryptionService } from '../../../src/services/encryption.service';
import { jwtService } from '../../../src/services/jwt.service';
import { AppError } from '../../../src/utils/errors';
import { logger } from '../../../src/utils/logger';
import { config } from '../../../src/config';

// Mock dependencies
vi.mock('axios');
vi.mock('../../../src/repositories/instances', () => ({
  userRepository: {
    findByPlexId: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    isFirstUser: vi.fn(),
  },
}));

vi.mock('../../../src/services/encryption.service', () => ({
  encryptionService: {
    encryptForStorage: vi.fn(),
  },
}));

vi.mock('../../../src/services/jwt.service', () => ({
  jwtService: {
    generateAccessToken: vi.fn(),
    generateRememberToken: vi.fn(),
  },
}));

vi.mock('../../../src/config', () => ({
  config: {
    plex: {
      clientId: 'test-client-id',
    },
  },
}));

vi.mock('../../../src/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockAxios = axios as any;

describe('AuthController', () => {
  let controller: AuthController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AuthController();
    
    mockRequest = {
      body: {},
      user: undefined,
    };

    mockResponse = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      cookie: vi.fn().mockReturnThis(),
      clearCookie: vi.fn().mockReturnThis(),
      locals: {
        csrfToken: 'test-csrf-token',
      },
    };

    mockNext = vi.fn();
  });

  describe('generatePin', () => {
    it('should generate PIN successfully with default client name', async () => {
      const mockXmlResponse = `
        <?xml version="1.0" encoding="UTF-8"?>
        <pin>
          <id>123456</id>
          <code>ABCD1234</code>
        </pin>
      `;

      mockAxios.post.mockResolvedValue({ data: mockXmlResponse });

      await controller.generatePin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAxios.post).toHaveBeenCalledWith(
        'https://plex.tv/pins.xml',
        null,
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Plex-Client-Identifier': 'test-client-id',
            'X-Plex-Product': 'MediaNest',
            'X-Plex-Device-Name': 'MediaNest',
          }),
          timeout: 10000,
        })
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

    it('should generate PIN with custom client name', async () => {
      const mockXmlResponse = `
        <?xml version="1.0" encoding="UTF-8"?>
        <pin>
          <id>123456</id>
          <code>ABCD1234</code>
        </pin>
      `;

      mockRequest.body = { clientName: 'CustomClient' };
      mockAxios.post.mockResolvedValue({ data: mockXmlResponse });

      await controller.generatePin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAxios.post).toHaveBeenCalledWith(
        'https://plex.tv/pins.xml',
        null,
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Plex-Device-Name': 'CustomClient',
          }),
        })
      );
    });

    it('should handle invalid Plex response', async () => {
      const invalidXmlResponse = '<invalid>response</invalid>';
      mockAxios.post.mockResolvedValue({ data: invalidXmlResponse });

      await controller.generatePin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'PLEX_ERROR',
          message: 'Invalid response from Plex',
          statusCode: 502,
        })
      );
    });

    it('should handle Plex service unavailable', async () => {
      const error = {
        response: { status: 503 },
        isAxiosError: true,
      };
      mockAxios.post.mockRejectedValue(error);
      mockAxios.isAxiosError.mockReturnValue(true);

      await controller.generatePin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'PLEX_UNREACHABLE',
          message: 'Cannot connect to Plex server. Please try again.',
          statusCode: 503,
        })
      );
    });

    it('should handle connection timeout', async () => {
      const error = {
        code: 'ETIMEDOUT',
        isAxiosError: true,
      };
      mockAxios.post.mockRejectedValue(error);
      mockAxios.isAxiosError.mockReturnValue(true);

      await controller.generatePin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'PLEX_TIMEOUT',
          message: 'Plex server connection timed out. Please try again.',
          statusCode: 504,
        })
      );
    });

    it('should handle validation errors gracefully', async () => {
      const mockXmlResponse = `
        <?xml version="1.0" encoding="UTF-8"?>
        <pin>
          <id>123456</id>
          <code>ABCD1234</code>
        </pin>
      `;

      mockRequest.body = { clientName: 123 }; // Invalid type
      mockAxios.post.mockResolvedValue({ data: mockXmlResponse });

      await controller.generatePin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(logger.warn).toHaveBeenCalledWith(
        'Invalid input for generatePin, using defaults',
        expect.any(Object)
      );
      expect(mockResponse.json).toHaveBeenCalled();
    });
  });

  describe('verifyPin', () => {
    it('should verify PIN and create new user successfully', async () => {
      const mockPinResponse = `
        <?xml version="1.0" encoding="UTF-8"?>
        <pin>
          <authToken>test-auth-token</authToken>
        </pin>
      `;

      const mockUserResponse = `
        <?xml version="1.0" encoding="UTF-8"?>
        <user>
          <id>plex-123</id>
          <username>testuser</username>
          <email>test@example.com</email>
        </user>
      `;

      const mockUser = {
        id: 'user-123',
        plexId: 'plex-123',
        plexUsername: 'testuser',
        email: 'test@example.com',
        role: 'user',
      };

      mockRequest.body = { pinId: '123456', rememberMe: false };
      mockAxios.get
        .mockResolvedValueOnce({ data: mockPinResponse })
        .mockResolvedValueOnce({ data: mockUserResponse });
      
      (userRepository.findByPlexId as Mock).mockResolvedValue(null);
      (userRepository.isFirstUser as Mock).mockResolvedValue(false);
      (userRepository.create as Mock).mockResolvedValue(mockUser);
      (encryptionService.encryptForStorage as Mock).mockReturnValue('encrypted-token');
      (jwtService.generateAccessToken as Mock).mockReturnValue('access-token');

      await controller.verifyPin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAxios.get).toHaveBeenCalledWith(
        'https://plex.tv/pins/123456.xml',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Plex-Client-Identifier': 'test-client-id',
          }),
        })
      );

      expect(userRepository.create).toHaveBeenCalledWith({
        plexId: 'plex-123',
        plexUsername: 'testuser',
        email: 'test@example.com',
        plexToken: 'encrypted-token',
        role: 'user',
      });

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'token',
        'access-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          maxAge: 24 * 60 * 60 * 1000,
        })
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user: {
            id: 'user-123',
            username: 'testuser',
            email: 'test@example.com',
            role: 'user',
          },
          token: 'access-token',
          rememberToken: 'access-token',
          csrfToken: 'test-csrf-token',
        },
      });
    });

    it('should verify PIN and update existing user', async () => {
      const mockPinResponse = `
        <?xml version="1.0" encoding="UTF-8"?>
        <pin>
          <authToken>test-auth-token</authToken>
        </pin>
      `;

      const mockUserResponse = `
        <?xml version="1.0" encoding="UTF-8"?>
        <user>
          <id>plex-123</id>
          <username>updateduser</username>
          <email>updated@example.com</email>
        </user>
      `;

      const existingUser = {
        id: 'user-123',
        plexId: 'plex-123',
        plexUsername: 'olduser',
        email: 'old@example.com',
        role: 'user',
      };

      const updatedUser = {
        ...existingUser,
        plexUsername: 'updateduser',
        email: 'updated@example.com',
        lastLoginAt: expect.any(Date),
      };

      mockRequest.body = { pinId: '123456', rememberMe: true };
      mockAxios.get
        .mockResolvedValueOnce({ data: mockPinResponse })
        .mockResolvedValueOnce({ data: mockUserResponse });
      
      (userRepository.findByPlexId as Mock).mockResolvedValue(existingUser);
      (userRepository.update as Mock).mockResolvedValue(updatedUser);
      (encryptionService.encryptForStorage as Mock).mockReturnValue('encrypted-token');
      (jwtService.generateAccessToken as Mock).mockReturnValue('access-token');
      (jwtService.generateRememberToken as Mock).mockReturnValue('remember-token');

      await controller.verifyPin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(userRepository.update).toHaveBeenCalledWith('user-123', {
        plexUsername: 'updateduser',
        email: 'updated@example.com',
        plexToken: 'encrypted-token',
        lastLoginAt: expect.any(Date),
      });

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'rememberToken',
        'remember-token',
        expect.objectContaining({
          maxAge: 90 * 24 * 60 * 60 * 1000,
        })
      );
    });

    it('should handle PIN not authorized yet', async () => {
      const mockPinResponse = `
        <?xml version="1.0" encoding="UTF-8"?>
        <pin>
          <authToken></authToken>
        </pin>
      `;

      mockRequest.body = { pinId: '123456' };
      mockAxios.get.mockResolvedValue({ data: mockPinResponse });

      await controller.verifyPin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'PIN_NOT_AUTHORIZED',
          message: 'PIN has not been authorized yet. Please complete authorization on plex.tv/link',
          statusCode: 400,
        })
      );
    });

    it('should handle invalid PIN', async () => {
      const error = {
        response: { status: 404 },
        isAxiosError: true,
      };
      mockAxios.get.mockRejectedValue(error);
      mockAxios.isAxiosError.mockReturnValue(true);

      mockRequest.body = { pinId: 'invalid' };

      await controller.verifyPin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'INVALID_PIN',
          message: 'Invalid or expired PIN',
          statusCode: 400,
        })
      );
    });

    it('should handle validation errors', async () => {
      mockRequest.body = {}; // Missing pinId

      await controller.verifyPin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          statusCode: 400,
        })
      );
    });

    it('should handle database errors', async () => {
      const mockPinResponse = `
        <?xml version="1.0" encoding="UTF-8"?>
        <pin>
          <authToken>test-auth-token</authToken>
        </pin>
      `;

      const mockUserResponse = `
        <?xml version="1.0" encoding="UTF-8"?>
        <user>
          <id>plex-123</id>
          <username>testuser</username>
          <email>test@example.com</email>
        </user>
      `;

      mockRequest.body = { pinId: '123456' };
      mockAxios.get
        .mockResolvedValueOnce({ data: mockPinResponse })
        .mockResolvedValueOnce({ data: mockUserResponse });
      
      (userRepository.findByPlexId as Mock).mockRejectedValue(new Error('Database error'));

      await controller.verifyPin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'DATABASE_ERROR',
          message: 'Failed to save user information',
          statusCode: 503,
        })
      );
    });

    it('should handle JWT generation errors', async () => {
      const mockPinResponse = `
        <?xml version="1.0" encoding="UTF-8"?>
        <pin>
          <authToken>test-auth-token</authToken>
        </pin>
      `;

      const mockUserResponse = `
        <?xml version="1.0" encoding="UTF-8"?>
        <user>
          <id>plex-123</id>
          <username>testuser</username>
          <email>test@example.com</email>
        </user>
      `;

      const mockUser = {
        id: 'user-123',
        plexId: 'plex-123',
        plexUsername: 'testuser',
        email: 'test@example.com',
        role: 'user',
      };

      mockRequest.body = { pinId: '123456' };
      mockAxios.get
        .mockResolvedValueOnce({ data: mockPinResponse })
        .mockResolvedValueOnce({ data: mockUserResponse });
      
      (userRepository.findByPlexId as Mock).mockResolvedValue(null);
      (userRepository.isFirstUser as Mock).mockResolvedValue(false);
      (userRepository.create as Mock).mockResolvedValue(mockUser);
      (encryptionService.encryptForStorage as Mock).mockReturnValue('encrypted-token');
      (jwtService.generateAccessToken as Mock).mockImplementation(() => {
        throw new Error('JWT generation failed');
      });

      await controller.verifyPin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'TOKEN_ERROR',
          message: 'Failed to generate authentication tokens',
          statusCode: 503,
        })
      );
    });

    it('should handle first user as admin', async () => {
      const mockPinResponse = `
        <?xml version="1.0" encoding="UTF-8"?>
        <pin>
          <authToken>test-auth-token</authToken>
        </pin>
      `;

      const mockUserResponse = `
        <?xml version="1.0" encoding="UTF-8"?>
        <user>
          <id>plex-123</id>
          <username>admin</username>
          <email>admin@example.com</email>
        </user>
      `;

      const mockUser = {
        id: 'user-123',
        plexId: 'plex-123',
        plexUsername: 'admin',
        email: 'admin@example.com',
        role: 'admin',
      };

      mockRequest.body = { pinId: '123456' };
      mockAxios.get
        .mockResolvedValueOnce({ data: mockPinResponse })
        .mockResolvedValueOnce({ data: mockUserResponse });
      
      (userRepository.findByPlexId as Mock).mockResolvedValue(null);
      (userRepository.isFirstUser as Mock).mockResolvedValue(true);
      (userRepository.create as Mock).mockResolvedValue(mockUser);
      (encryptionService.encryptForStorage as Mock).mockReturnValue('encrypted-token');
      (jwtService.generateAccessToken as Mock).mockReturnValue('access-token');

      await controller.verifyPin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(userRepository.create).toHaveBeenCalledWith({
        plexId: 'plex-123',
        plexUsername: 'admin',
        email: 'admin@example.com',
        plexToken: 'encrypted-token',
        role: 'admin',
      });
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      await controller.logout(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.clearCookie).toHaveBeenCalledWith('token');
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('rememberToken');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logged out successfully',
      });
    });
  });

  describe('getSession', () => {
    it('should get session successfully', async () => {
      mockRequest.user = {
        id: 'user-123',
        plexUsername: 'testuser',
        email: 'test@example.com',
        role: 'user',
      };

      await controller.getSession(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user: {
            id: 'user-123',
            username: 'testuser',
            email: 'test@example.com',
            role: 'user',
          },
        },
      });
    });

    it('should throw error if user not in request', async () => {
      mockRequest.user = undefined;

      await expect(
        controller.getSession(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(AppError);
    });

    it('should handle missing username gracefully', async () => {
      mockRequest.user = {
        id: 'user-123',
        plexUsername: null,
        email: 'test@example.com',
        role: 'user',
      };

      await controller.getSession(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user: {
            id: 'user-123',
            username: 'test@example.com',
            email: 'test@example.com',
            role: 'user',
          },
        },
      });
    });
  });
});