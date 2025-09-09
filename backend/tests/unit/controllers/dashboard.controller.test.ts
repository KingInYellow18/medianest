import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Request, Response } from 'express';
import { DashboardController } from '../../../src/controllers/dashboard.controller';
import { mediaRequestRepository, userRepository } from '../../../src/repositories';
import { plexService } from '../../../src/services/plex.service';
import { statusService } from '../../../src/services/status.service';
import { cacheService } from '../../../src/services/cache.service';
import { AppError } from '../../../src/utils/errors';
import { logger } from '../../../src/utils/logger';

// Mock dependencies
vi.mock('../../../src/repositories', () => ({
  mediaRequestRepository: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  userRepository: {
    count: vi.fn(),
  },
}));

vi.mock('../../../src/services/plex.service', () => ({
  plexService: {
    getServerInfo: vi.fn(),
    getLibraries: vi.fn(),
  },
}));

vi.mock('../../../src/services/status.service', () => ({
  statusService: {
    getAllStatuses: vi.fn(),
    getServiceStatus: vi.fn(),
  },
}));

vi.mock('../../../src/services/cache.service', () => ({
  cacheService: {
    getOrSet: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('../../../src/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('DashboardController', () => {
  let controller: DashboardController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new DashboardController();
    
    mockRequest = {
      query: {},
      params: {},
      user: {
        id: 'user-123',
        role: 'user',
        email: 'test@example.com',
      },
    };

    mockResponse = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };
  });

  describe('getServiceStatuses', () => {
    it('should get service statuses successfully', async () => {
      const mockStatuses = [
        {
          service: 'plex',
          status: 'healthy',
          responseTime: 120,
          lastCheck: new Date(),
          version: '1.32.5',
        },
        {
          service: 'overseerr',
          status: 'healthy',
          responseTime: 85,
          lastCheck: new Date(),
          version: '1.33.2',
        },
        {
          service: 'database',
          status: 'healthy',
          responseTime: 15,
          lastCheck: new Date(),
        },
      ];

      (cacheService.getOrSet as Mock).mockResolvedValue(mockStatuses);

      await controller.getServiceStatuses(mockRequest as Request, mockResponse as Response);

      expect(cacheService.getOrSet).toHaveBeenCalledWith(
        'service:statuses:all',
        expect.any(Function),
        300
      );

      expect(mockResponse.set).toHaveBeenCalledWith({
        'Cache-Control': 'public, max-age=60',
        ETag: expect.stringMatching(/"[\d]+"/),
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockStatuses,
        meta: {
          timestamp: expect.any(Date),
          count: 3,
        },
      });
    });

    it('should call statusService when cache miss occurs', async () => {
      const mockStatuses = [
        {
          service: 'plex',
          status: 'healthy',
          responseTime: 120,
          lastCheck: new Date(),
        },
      ];

      // Mock cache miss scenario
      (cacheService.getOrSet as Mock).mockImplementation(async (key, fetchFn, ttl) => {
        return await fetchFn();
      });
      (statusService.getAllStatuses as Mock).mockResolvedValue(mockStatuses);

      await controller.getServiceStatuses(mockRequest as Request, mockResponse as Response);

      expect(statusService.getAllStatuses).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockStatuses,
        meta: {
          timestamp: expect.any(Date),
          count: 1,
        },
      });
    });

    it('should handle empty service statuses', async () => {
      (cacheService.getOrSet as Mock).mockResolvedValue([]);

      await controller.getServiceStatuses(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: [],
        meta: {
          timestamp: expect.any(Date),
          count: 0,
        },
      });
    });

    it('should handle service errors', async () => {
      (cacheService.getOrSet as Mock).mockRejectedValue(new Error('Cache service error'));

      await expect(
        controller.getServiceStatuses(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(AppError);

      expect(logger.error).toHaveBeenCalledWith('Failed to get service statuses', expect.any(Object));
    });

    it('should set appropriate cache headers', async () => {
      (cacheService.getOrSet as Mock).mockResolvedValue([]);

      await controller.getServiceStatuses(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Cache-Control': 'public, max-age=60',
          ETag: expect.any(String),
        })
      );
    });
  });

  describe('getServiceStatus', () => {
    it('should get individual service status successfully', async () => {
      const serviceName = 'plex';
      const mockStatus = {
        service: 'plex',
        status: 'healthy',
        responseTime: 120,
        lastCheck: new Date(),
        version: '1.32.5',
        details: {
          serverName: 'My Plex Server',
          libraries: 4,
        },
      };

      mockRequest.params = { service: serviceName };
      (cacheService.getOrSet as Mock).mockResolvedValue(mockStatus);

      await controller.getServiceStatus(mockRequest as Request, mockResponse as Response);

      expect(cacheService.getOrSet).toHaveBeenCalledWith(
        `service:status:${serviceName}`,
        expect.any(Function),
        300
      );

      expect(mockResponse.set).toHaveBeenCalledWith({
        'Cache-Control': 'public, max-age=60',
        ETag: expect.stringMatching(/"[\d]+"/),
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockStatus,
        meta: {
          timestamp: expect.any(Date),
          service: serviceName,
        },
      });
    });

    it('should call statusService when cache miss occurs', async () => {
      const serviceName = 'overseerr';
      const mockStatus = {
        service: 'overseerr',
        status: 'healthy',
        responseTime: 85,
        lastCheck: new Date(),
      };

      mockRequest.params = { service: serviceName };

      // Mock cache miss scenario
      (cacheService.getOrSet as Mock).mockImplementation(async (key, fetchFn, ttl) => {
        return await fetchFn();
      });
      (statusService.getServiceStatus as Mock).mockResolvedValue(mockStatus);

      await controller.getServiceStatus(mockRequest as Request, mockResponse as Response);

      expect(statusService.getServiceStatus).toHaveBeenCalledWith(serviceName);
    });

    it('should throw validation error for missing service parameter', async () => {
      mockRequest.params = {};

      await expect(
        controller.getServiceStatus(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(AppError);

      expect(cacheService.getOrSet).not.toHaveBeenCalled();
    });

    it('should throw validation error for empty service parameter', async () => {
      mockRequest.params = { service: '' };

      await expect(
        controller.getServiceStatus(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(AppError);
    });

    it('should handle service errors', async () => {
      mockRequest.params = { service: 'plex' };
      (cacheService.getOrSet as Mock).mockRejectedValue(new Error('Service unavailable'));

      await expect(
        controller.getServiceStatus(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(AppError);

      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle unknown service gracefully', async () => {
      const serviceName = 'unknown-service';
      mockRequest.params = { service: serviceName };

      (cacheService.getOrSet as Mock).mockImplementation(async (key, fetchFn, ttl) => {
        return await fetchFn();
      });
      (statusService.getServiceStatus as Mock).mockResolvedValue(null);

      await controller.getServiceStatus(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: null,
        meta: {
          timestamp: expect.any(Date),
          service: serviceName,
        },
      });
    });
  });

  describe('getDashboardMetrics', () => {
    it('should get dashboard metrics successfully', async () => {
      const mockMetrics = {
        users: {
          total: 15,
          active: 8,
          new: 2,
        },
        requests: {
          total: 45,
          pending: 12,
          approved: 25,
          declined: 8,
        },
        services: {
          healthy: 3,
          unhealthy: 1,
          unknown: 0,
        },
        system: {
          uptime: 86400,
          memoryUsage: {
            used: 512,
            free: 1536,
            total: 2048,
          },
          diskUsage: {
            used: 25600,
            free: 38400,
            total: 64000,
          },
        },
      };

      (cacheService.getOrSet as Mock).mockResolvedValue(mockMetrics);

      await controller.getDashboardMetrics(mockRequest as Request, mockResponse as Response);

      expect(cacheService.getOrSet).toHaveBeenCalledWith(
        'dashboard:metrics',
        expect.any(Function),
        300
      );

      expect(mockResponse.set).toHaveBeenCalledWith({
        'Cache-Control': 'public, max-age=60',
        ETag: expect.stringMatching(/"[\d]+"/),
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockMetrics,
        meta: {
          timestamp: expect.any(Date),
          lastUpdated: expect.any(Date),
        },
      });
    });

    it('should aggregate metrics from multiple sources', async () => {
      // Mock cache miss to trigger metric aggregation
      (cacheService.getOrSet as Mock).mockImplementation(async (key, fetchFn, ttl) => {
        return await fetchFn();
      });

      // Mock repository responses
      (userRepository.count as Mock)
        .mockResolvedValueOnce(15) // total users
        .mockResolvedValueOnce(8); // active users

      (mediaRequestRepository.count as Mock)
        .mockResolvedValueOnce(45) // total requests
        .mockResolvedValueOnce(12) // pending requests
        .mockResolvedValueOnce(25) // approved requests
        .mockResolvedValueOnce(8); // declined requests

      // Mock service statuses
      (statusService.getAllStatuses as Mock).mockResolvedValue([
        { service: 'plex', status: 'healthy' },
        { service: 'overseerr', status: 'healthy' },
        { service: 'database', status: 'healthy' },
        { service: 'redis', status: 'unhealthy' },
      ]);

      await controller.getDashboardMetrics(mockRequest as Request, mockResponse as Response);

      expect(userRepository.count).toHaveBeenCalledTimes(2);
      expect(mediaRequestRepository.count).toHaveBeenCalledTimes(4);
      expect(statusService.getAllStatuses).toHaveBeenCalled();

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          users: expect.objectContaining({
            total: 15,
            active: 8,
          }),
          requests: expect.objectContaining({
            total: 45,
            pending: 12,
            approved: 25,
            declined: 8,
          }),
          services: expect.objectContaining({
            healthy: 3,
            unhealthy: 1,
          }),
          system: expect.any(Object),
        }),
        meta: expect.any(Object),
      });
    });

    it('should handle database errors gracefully', async () => {
      (cacheService.getOrSet as Mock).mockImplementation(async (key, fetchFn, ttl) => {
        return await fetchFn();
      });

      (userRepository.count as Mock).mockRejectedValue(new Error('Database error'));

      await expect(
        controller.getDashboardMetrics(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(AppError);

      expect(logger.error).toHaveBeenCalled();
    });

    it('should include system metrics', async () => {
      (cacheService.getOrSet as Mock).mockImplementation(async (key, fetchFn, ttl) => {
        return await fetchFn();
      });

      // Mock minimal data to focus on system metrics
      (userRepository.count as Mock).mockResolvedValue(0);
      (mediaRequestRepository.count as Mock).mockResolvedValue(0);
      (statusService.getAllStatuses as Mock).mockResolvedValue([]);

      await controller.getDashboardMetrics(mockRequest as Request, mockResponse as Response);

      const responseCall = (mockResponse.json as Mock).mock.calls[0][0];
      expect(responseCall.data.system).toEqual(
        expect.objectContaining({
          uptime: expect.any(Number),
          memoryUsage: expect.objectContaining({
            used: expect.any(Number),
            free: expect.any(Number),
            total: expect.any(Number),
          }),
        })
      );
    });
  });

  describe('getRecentActivity', () => {
    it('should get recent activity successfully', async () => {
      const mockActivity = [
        {
          id: 'activity-1',
          type: 'media_request',
          message: 'User requested The Matrix',
          userId: 'user-123',
          username: 'testuser',
          timestamp: new Date(),
          metadata: { mediaType: 'movie', title: 'The Matrix' },
        },
        {
          id: 'activity-2',
          type: 'user_login',
          message: 'User logged in',
          userId: 'user-456',
          username: 'anotheruser',
          timestamp: new Date(),
        },
      ];

      mockRequest.query = { limit: '10' };
      (cacheService.getOrSet as Mock).mockResolvedValue(mockActivity);

      await controller.getRecentActivity(mockRequest as Request, mockResponse as Response);

      expect(cacheService.getOrSet).toHaveBeenCalledWith(
        'dashboard:activity:10',
        expect.any(Function),
        60 // 1 minute cache
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockActivity,
        meta: {
          timestamp: expect.any(Date),
          limit: 10,
          count: 2,
        },
      });
    });

    it('should handle custom limit parameter', async () => {
      mockRequest.query = { limit: '25' };
      (cacheService.getOrSet as Mock).mockResolvedValue([]);

      await controller.getRecentActivity(mockRequest as Request, mockResponse as Response);

      expect(cacheService.getOrSet).toHaveBeenCalledWith(
        'dashboard:activity:25',
        expect.any(Function),
        60
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: [],
        meta: {
          timestamp: expect.any(Date),
          limit: 25,
          count: 0,
        },
      });
    });

    it('should use default limit when not specified', async () => {
      (cacheService.getOrSet as Mock).mockResolvedValue([]);

      await controller.getRecentActivity(mockRequest as Request, mockResponse as Response);

      expect(cacheService.getOrSet).toHaveBeenCalledWith(
        'dashboard:activity:20',
        expect.any(Function),
        60
      );
    });

    it('should handle service errors', async () => {
      (cacheService.getOrSet as Mock).mockRejectedValue(new Error('Service error'));

      await expect(
        controller.getRecentActivity(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(AppError);

      expect(logger.error).toHaveBeenCalled();
    });
  });
});