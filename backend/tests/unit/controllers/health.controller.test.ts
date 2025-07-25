import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Request, Response } from 'express';
import { HealthController } from '../../../src/controllers/health.controller';
import { HealthService } from '../../../src/services/health.service';

// Mock dependencies
vi.mock('../../../src/services/health.service');

describe('HealthController Unit Tests', () => {
  let healthController: HealthController;
  let mockHealthService: any;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockHealthService = {
      getSystemHealth: vi.fn(),
      getDatabaseHealth: vi.fn(),
      getRedisHealth: vi.fn(),
      getServiceHealth: vi.fn(),
      getDetailedHealth: vi.fn(),
      performHealthCheck: vi.fn(),
    };

    healthController = new HealthController(mockHealthService);

    mockRequest = {
      params: {},
      query: {},
      headers: {},
      ip: '127.0.0.1',
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis(),
    };

    vi.clearAllMocks();
  });

  describe('Basic Health Check', () => {
    it('should return healthy status for basic health check', async () => {
      const healthData = {
        status: 'healthy',
        timestamp: new Date(),
        uptime: 3600,
        version: '1.0.0',
      };

      mockHealthService.getSystemHealth.mockResolvedValue(healthData);

      await healthController.getHealth(mockRequest as Request, mockResponse as Response);

      expect(mockHealthService.getSystemHealth).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(healthData);
    });

    it('should return unhealthy status when system is down', async () => {
      const healthData = {
        status: 'unhealthy',
        timestamp: new Date(),
        error: 'Database connection failed',
        uptime: 3600,
      };

      mockHealthService.getSystemHealth.mockResolvedValue(healthData);

      await healthController.getHealth(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith(healthData);
    });

    it('should handle errors in health check', async () => {
      const error = new Error('Health check failed');
      mockHealthService.getSystemHealth.mockRejectedValue(error);

      await healthController.getHealth(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'error',
        error: 'Health check failed',
        timestamp: expect.any(Date),
      });
    });
  });

  describe('Detailed Health Check', () => {
    it('should return detailed health information', async () => {
      const detailedHealth = {
        status: 'healthy',
        timestamp: new Date(),
        services: {
          database: { status: 'healthy', responseTime: 10 },
          redis: { status: 'healthy', responseTime: 5 },
          plex: { status: 'healthy', responseTime: 50 },
        },
        system: {
          uptime: 3600,
          memory: { used: 100, total: 1000 },
          cpu: { usage: 25 },
        },
      };

      mockHealthService.getDetailedHealth.mockResolvedValue(detailedHealth);

      await healthController.getDetailedHealth(mockRequest as Request, mockResponse as Response);

      expect(mockHealthService.getDetailedHealth).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(detailedHealth);
    });

    it('should handle partial service failures in detailed check', async () => {
      const detailedHealth = {
        status: 'degraded',
        timestamp: new Date(),
        services: {
          database: { status: 'healthy', responseTime: 10 },
          redis: { status: 'unhealthy', error: 'Connection timeout' },
          plex: { status: 'healthy', responseTime: 50 },
        },
        system: {
          uptime: 3600,
          memory: { used: 100, total: 1000 },
        },
      };

      mockHealthService.getDetailedHealth.mockResolvedValue(detailedHealth);

      await healthController.getDetailedHealth(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(detailedHealth);
    });
  });

  describe('Service-Specific Health Checks', () => {
    it('should check database health', async () => {
      const dbHealth = {
        status: 'healthy',
        responseTime: 15,
        connections: { active: 5, max: 10 },
      };

      mockHealthService.getDatabaseHealth.mockResolvedValue(dbHealth);

      await healthController.getDatabaseHealth(mockRequest as Request, mockResponse as Response);

      expect(mockHealthService.getDatabaseHealth).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(dbHealth);
    });

    it('should check Redis health', async () => {
      const redisHealth = {
        status: 'healthy',
        responseTime: 5,
        memory: { used: 50, max: 100 },
      };

      mockHealthService.getRedisHealth.mockResolvedValue(redisHealth);

      await healthController.getRedisHealth(mockRequest as Request, mockResponse as Response);

      expect(mockHealthService.getRedisHealth).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(redisHealth);
    });

    it('should check external service health', async () => {
      mockRequest.params = { serviceName: 'plex' };

      const serviceHealth = {
        status: 'healthy',
        responseTime: 100,
        version: '1.28.2',
      };

      mockHealthService.getServiceHealth.mockResolvedValue(serviceHealth);

      await healthController.getServiceHealth(mockRequest as Request, mockResponse as Response);

      expect(mockHealthService.getServiceHealth).toHaveBeenCalledWith('plex');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(serviceHealth);
    });

    it('should handle invalid service name', async () => {
      mockRequest.params = { serviceName: 'invalid-service' };

      const error = new Error('Service not found');
      mockHealthService.getServiceHealth.mockRejectedValue(error);

      await healthController.getServiceHealth(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'error',
        error: 'Service not found',
        timestamp: expect.any(Date),
      });
    });
  });

  describe('Live and Ready Checks', () => {
    it('should respond to liveness probe', async () => {
      await healthController.getLiveness(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'alive',
        timestamp: expect.any(Date),
      });
    });

    it('should respond to readiness probe when ready', async () => {
      const readyStatus = {
        status: 'ready',
        timestamp: new Date(),
        checks: {
          database: true,
          redis: true,
        },
      };

      mockHealthService.performHealthCheck.mockResolvedValue(readyStatus);

      await healthController.getReadiness(mockRequest as Request, mockResponse as Response);

      expect(mockHealthService.performHealthCheck).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(readyStatus);
    });

    it('should respond to readiness probe when not ready', async () => {
      const notReadyStatus = {
        status: 'not_ready',
        timestamp: new Date(),
        checks: {
          database: true,
          redis: false,
        },
        error: 'Redis connection failed',
      };

      mockHealthService.performHealthCheck.mockResolvedValue(notReadyStatus);

      await healthController.getReadiness(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith(notReadyStatus);
    });
  });

  describe('Health Check Headers', () => {
    it('should set appropriate cache headers for health endpoints', async () => {
      const healthData = { status: 'healthy', timestamp: new Date() };
      mockHealthService.getSystemHealth.mockResolvedValue(healthData);

      await healthController.getHealth(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.header).toHaveBeenCalledWith(
        'Cache-Control',
        'no-cache, no-store, must-revalidate',
      );
      expect(mockResponse.header).toHaveBeenCalledWith('Pragma', 'no-cache');
      expect(mockResponse.header).toHaveBeenCalledWith('Expires', '0');
    });

    it('should set custom headers for monitoring systems', async () => {
      const healthData = {
        status: 'healthy',
        timestamp: new Date(),
        responseTime: 25,
      };
      mockHealthService.getSystemHealth.mockResolvedValue(healthData);

      await healthController.getHealth(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.header).toHaveBeenCalledWith('X-Health-Check-Time', expect.any(String));
      expect(mockResponse.header).toHaveBeenCalledWith('X-Health-Status', 'healthy');
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent health checks efficiently', async () => {
      const healthData = { status: 'healthy', timestamp: new Date() };
      mockHealthService.getSystemHealth.mockResolvedValue(healthData);

      const startTime = Date.now();

      // Simulate 50 concurrent health checks
      const healthChecks = Array.from({ length: 50 }, () =>
        healthController.getHealth(mockRequest as Request, mockResponse as Response),
      );

      await Promise.all(healthChecks);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
      expect(mockHealthService.getSystemHealth).toHaveBeenCalledTimes(50);
    });

    it('should maintain performance under load', async () => {
      const healthData = { status: 'healthy', timestamp: new Date() };
      mockHealthService.getDetailedHealth.mockResolvedValue(healthData);

      const iterations = 100;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await healthController.getDetailedHealth(mockRequest as Request, mockResponse as Response);
        const end = Date.now();
        times.push(end - start);
      }

      const avgTime = times.reduce((a, b) => a + b) / times.length;
      const maxTime = Math.max(...times);

      expect(avgTime).toBeLessThan(10); // Average should be under 10ms
      expect(maxTime).toBeLessThan(50); // No single request should take over 50ms
    });
  });

  describe('Error Recovery', () => {
    it('should recover from temporary service failures', async () => {
      // First call fails
      mockHealthService.getSystemHealth.mockRejectedValueOnce(new Error('Temporary failure'));

      // Second call succeeds
      const healthData = { status: 'healthy', timestamp: new Date() };
      mockHealthService.getSystemHealth.mockResolvedValueOnce(healthData);

      // First call should return error
      await healthController.getHealth(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(500);

      // Reset mocks
      vi.clearAllMocks();

      // Second call should succeed
      await healthController.getHealth(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(healthData);
    });

    it('should handle cascading failures gracefully', async () => {
      const partialFailure = {
        status: 'degraded',
        timestamp: new Date(),
        services: {
          database: { status: 'healthy' },
          redis: { status: 'unhealthy', error: 'Connection failed' },
          plex: { status: 'timeout', error: 'Request timeout' },
        },
      };

      mockHealthService.getDetailedHealth.mockResolvedValue(partialFailure);

      await healthController.getDetailedHealth(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(partialFailure);
    });
  });
});
