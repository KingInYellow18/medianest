import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { AuthController } from '../../../dist/controllers/auth.controller';
import { createMockRequest, createMockResponse, createMockNext } from '../../setup';
import { mockPrisma, mockAxios, mockLogger } from '../../setup';
import { createMockAxios, mockPlexApiResponse, mockApiErrors } from '../../mocks/axios.mock';

// Mock dependencies
vi.mock('@/config', () => ({
  getPlexConfig: () => ({
    clientId: 'test-client-id',
    serverUrl: 'http://test-plex-server:32400'
  })
}));

vi.mock('@/repositories/instances', () => ({
  userRepository: {
    findById: vi.fn(),
    findByPlexId: vi.fn(),
    create: vi.fn(),
    updatePlexToken: vi.fn()
  },
  sessionTokenRepository: {
    create: vi.fn(),
    findByToken: vi.fn(),
    delete: vi.fn()
  }
}));

vi.mock('@/services/jwt.service', () => ({
  jwtService: {
    generateToken: vi.fn(),
    verifyToken: vi.fn(),
    generateAccessToken: vi.fn(),
    generateRefreshToken: vi.fn()
  }
}));

vi.mock('@/services/encryption.service', () => ({
  encryptionService: {
    encryptForStorage: vi.fn(),
    decryptFromStorage: vi.fn()
  }
}));

describe('AuthController', () => {
  let authController: AuthController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    authController = new AuthController();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
    
    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('generatePin', () => {
    it('should generate a Plex PIN successfully', async () => {
      // Arrange
      const mockAxiosInstance = createMockAxios();
      mockPlexApiResponse(mockAxiosInstance);
      
      mockReq.body = { clientName: 'MediaNest Test' };

      // Act
      await authController.generatePin(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          pinId: '12345',
          code: 'ABCD1234',
          url: expect.stringContaining('plex.tv/link')
        }
      });
    });

    it('should handle Plex API errors gracefully', async () => {
      // Arrange
      const mockAxiosInstance = createMockAxios();
      const apiErrors = mockApiErrors(mockAxiosInstance);
      apiErrors.serverError();
      
      mockReq.body = { clientName: 'MediaNest Test' };

      // Act
      await authController.generatePin(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Plex API error'),
          statusCode: 500
        })
      );
    });

    it('should use default client name when not provided', async () => {
      // Arrange
      const mockAxiosInstance = createMockAxios();
      mockPlexApiResponse(mockAxiosInstance);
      
      mockReq.body = {};

      // Act
      await authController.generatePin(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        null,
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Plex-Device-Name': 'MediaNest'
          })
        })
      );
    });

    it('should validate request body schema', async () => {
      // Arrange
      mockReq.body = { clientName: 123 }; // Invalid type

      // Act
      await authController.generatePin(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('validation'),
          statusCode: 400
        })
      );
    });
  });

  describe('verifyPin', () => {
    it('should verify PIN and create user session successfully', async () => {
      // Arrange
      const mockAxiosInstance = createMockAxios();
      mockPlexApiResponse(mockAxiosInstance);
      
      const mockUserRepository = (await import('@/repositories/instances')).userRepository;
      const mockJWTService = (await import('@/services/jwt.service')).jwtService;
      const mockEncryptionService = (await import('@/services/encryption.service')).encryptionService;
      
      (mockUserRepository.findByPlexId as any).mockResolvedValue(null);
      (mockUserRepository.create as any).mockResolvedValue({
        id: 'new-user-id',
        plexId: 'test-plex-user-id',
        email: 'test@plex.tv',
        role: 'user'
      });
      (mockJWTService.generateAccessToken as any).mockResolvedValue('access-token');
      (mockJWTService.generateRefreshToken as any).mockResolvedValue('refresh-token');
      (mockEncryptionService.encryptForStorage as any).mockReturnValue('encrypted-token');
      
      mockReq.body = { pinId: '12345', rememberMe: true };

      // Act
      await authController.verifyPin(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user: expect.objectContaining({
            id: 'new-user-id',
            plexId: 'test-plex-user-id'
          }),
          tokens: {
            accessToken: 'access-token',
            refreshToken: 'refresh-token'
          }
        }
      });
    });

    it('should handle existing user login', async () => {
      // Arrange
      const mockAxiosInstance = createMockAxios();
      mockPlexApiResponse(mockAxiosInstance);
      
      const mockUserRepository = (await import('@/repositories/instances')).userRepository;
      const mockJWTService = (await import('@/services/jwt.service')).jwtService;
      
      (mockUserRepository.findByPlexId as any).mockResolvedValue({
        id: 'existing-user-id',
        plexId: 'test-plex-user-id',
        email: 'test@plex.tv',
        role: 'user'
      });
      (mockJWTService.generateAccessToken as any).mockResolvedValue('access-token');
      (mockJWTService.generateRefreshToken as any).mockResolvedValue('refresh-token');
      
      mockReq.body = { pinId: '12345', rememberMe: false };

      // Act
      await authController.verifyPin(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockUserRepository.create).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user: expect.objectContaining({
            id: 'existing-user-id'
          }),
          tokens: expect.objectContaining({
            accessToken: 'access-token'
          })
        }
      });
    });

    it('should handle PIN verification failure', async () => {
      // Arrange
      const mockAxiosInstance = createMockAxios();
      mockAxiosInstance.get.mockRejectedValue(new Error('PIN not found'));
      
      mockReq.body = { pinId: 'invalid-pin' };

      // Act
      await authController.verifyPin(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('PIN verification failed'),
          statusCode: 400
        })
      );
    });
  });

  describe('refreshToken', () => {
    it('should refresh tokens successfully', async () => {
      // Arrange
      const mockJWTService = (await import('@/services/jwt.service')).jwtService;
      const mockSessionTokenRepository = (await import('@/repositories/instances')).sessionTokenRepository;
      
      (mockJWTService.verifyToken as any).mockResolvedValue({ userId: 'test-user-id' });
      (mockSessionTokenRepository.findByToken as any).mockResolvedValue({
        id: 'session-id',
        userId: 'test-user-id',
        token: 'old-refresh-token'
      });
      (mockJWTService.generateAccessToken as any).mockResolvedValue('new-access-token');
      (mockJWTService.generateRefreshToken as any).mockResolvedValue('new-refresh-token');
      
      mockReq.body = { refreshToken: 'old-refresh-token' };

      // Act
      await authController.refreshToken(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          tokens: {
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token'
          }
        }
      });
    });

    it('should handle invalid refresh token', async () => {
      // Arrange
      const mockJWTService = (await import('@/services/jwt.service')).jwtService;
      (mockJWTService.verifyToken as any).mockRejectedValue(new Error('Invalid token'));
      
      mockReq.body = { refreshToken: 'invalid-token' };

      // Act
      await authController.refreshToken(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Invalid refresh token'),
          statusCode: 401
        })
      );
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      // Arrange
      const mockSessionTokenRepository = (await import('@/repositories/instances')).sessionTokenRepository;
      (mockSessionTokenRepository.delete as any).mockResolvedValue(true);
      
      mockReq.body = { refreshToken: 'refresh-token-to-delete' };

      // Act
      await authController.logout(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockSessionTokenRepository.delete).toHaveBeenCalledWith('refresh-token-to-delete');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logged out successfully'
      });
    });

    it('should handle logout without refresh token', async () => {
      // Arrange
      mockReq.body = {};

      // Act
      await authController.logout(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logged out successfully'
      });
    });
  });
});