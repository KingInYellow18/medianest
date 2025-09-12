import { Request, Response } from 'express';
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';

import { redisClient } from '../../../src/config/redis';
import { HealthController } from '../../../src/controllers/health.controller';
import { getPrismaClient } from '../../../src/db/prisma';
import { cacheService } from '../../../src/services/cache.service';
import { logger } from '../../../src/utils/logger';

// Mock dependencies
vi.mock('../../../src/services/cache.service', () => ({
  cacheService: {
    ping: vi.fn(),
  },
}));

vi.mock('../../../src/db/prisma', () => ({
  getPrismaClient: vi.fn(),
}));

vi.mock('../../../src/config/redis', () => ({
  redisClient: {
    ping: vi.fn(),
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

describe('HealthController', () => {
  let controller: HealthController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockPrisma: any;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new HealthController();

    mockRequest = {};
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    mockPrisma = {
      $queryRaw: vi.fn(),
      $disconnect: vi.fn(),
    };

    (getPrismaClient as Mock).mockReturnValue(mockPrisma);

    // Mock process.uptime
    vi.spyOn(process, 'uptime').mockReturnValue(86400); // 24 hours
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getHealth', () => {
    it('should return basic health status successfully', async () => {
      const mockDate = new Date('2023-09-09T12:00:00.000Z');
      vi.setSystemTime(mockDate);

      await controller.getHealth(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'ok',
        timestamp: mockDate.toISOString(),
        version: expect.any(String),
        uptime: 86400,
        environment: expect.any(String),
        service: 'medianest-api',
      });
    });

    it('should use package version from environment', async () => {
      const originalVersion = process.env.npm_package_version;
      process.env.npm_package_version = '2.1.0';

      await controller.getHealth(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          version: '2.1.0',
        }),
      );

      // Restore original value
      if (originalVersion) {
        process.env.npm_package_version = originalVersion;
      } else {
        delete process.env.npm_package_version;
      }
    });

    it('should use default version when package version not available', async () => {
      const originalVersion = process.env.npm_package_version;
      delete process.env.npm_package_version;

      await controller.getHealth(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          version: '1.0.0',
        }),
      );

      // Restore original value if it existed
      if (originalVersion) {
        process.env.npm_package_version = originalVersion;
      }
    });

    it('should use NODE_ENV from environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await controller.getHealth(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          environment: 'production',
        }),
      );

      // Restore original value
      if (originalEnv) {
        process.env.NODE_ENV = originalEnv;
      } else {
        delete process.env.NODE_ENV;
      }
    });

    it('should handle primary health check errors gracefully', async () => {
      // Mock an error in the primary health check
      vi.spyOn(process, 'uptime').mockImplementation(() => {
        throw new Error('Process error');
      });

      await controller.getHealth(mockRequest as Request, mockResponse as Response);

      expect(logger.error).toHaveBeenCalledWith('Health check failed', expect.any(Object));
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ok',
          warning: 'Health check completed with warnings',
        }),
      );
    });

    it('should handle secondary health check errors', async () => {
      // Mock primary error
      vi.spyOn(process, 'uptime').mockImplementation(() => {
        throw new Error('Process error');
      });

      // Mock secondary error (response.json fails)
      (mockResponse.json as Mock).mockImplementation(() => {
        throw new Error('JSON error');
      });

      await controller.getHealth(mockRequest as Request, mockResponse as Response);

      expect(logger.error).toHaveBeenCalledWith('Health check failed', expect.any(Object));
      expect(logger.error).toHaveBeenCalledWith(
        'Secondary health check failure',
        expect.any(Object),
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.send).toHaveBeenCalledWith('OK');
    });

    it('should always return 200 status for container health checks', async () => {
      // Even if there's an error, should return 200 for container orchestration
      vi.spyOn(process, 'uptime').mockImplementation(() => {
        throw new Error('System error');
      });

      await controller.getHealth(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getMetrics', () => {
    it('should return comprehensive metrics successfully', async () => {
      const dbQueryTime = 50;
      const redisQueryTime = 25;

      // Mock successful database query
      mockPrisma.$queryRaw.mockResolvedValue([{ result: 1 }]);

      // Mock successful Redis ping
      (redisClient.ping as Mock).mockResolvedValue('PONG');

      // Mock Date.now() to control timing
      const mockStartTime = 1000000000;
      vi.spyOn(Date, 'now')
        .mockReturnValueOnce(mockStartTime) // DB start time
        .mockReturnValueOnce(mockStartTime + dbQueryTime) // DB end time
        .mockReturnValueOnce(mockStartTime + dbQueryTime + 10) // Redis start time
        .mockReturnValueOnce(mockStartTime + dbQueryTime + 10 + redisQueryTime); // Redis end time

      await controller.getMetrics(mockRequest as Request, mockResponse as Response);

      expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(expect.anything());
      expect(redisClient.ping).toHaveBeenCalled();

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          timestamp: expect.any(String),
          uptime: 86400,
          memory: expect.objectContaining({
            rss: expect.any(Number),
            heapTotal: expect.any(Number),
            heapUsed: expect.any(Number),
            external: expect.any(Number),
          }),
          cpu: expect.objectContaining({
            user: expect.any(Number),
            system: expect.any(Number),
          }),
          database: {
            status: 'connected',
            responseTime: dbQueryTime,
          },
          redis: {
            status: 'connected',
            responseTime: redisQueryTime,
          },
          version: expect.any(String),
          environment: expect.any(String),
        },
      });
    });

    it('should handle database connection errors', async () => {
      const dbError = new Error('Database connection failed');
      mockPrisma.$queryRaw.mockRejectedValue(dbError);

      // Redis should still work
      (redisClient.ping as Mock).mockResolvedValue('PONG');

      await controller.getMetrics(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            database: {
              status: 'error',
              error: 'Database connection failed',
              responseTime: null,
            },
            redis: {
              status: 'connected',
              responseTime: expect.any(Number),
            },
          }),
        }),
      );
    });

    it('should handle Redis connection errors', async () => {
      // Database should work
      mockPrisma.$queryRaw.mockResolvedValue([{ result: 1 }]);

      // Redis fails
      const redisError = new Error('Redis connection failed');
      (redisClient.ping as Mock).mockRejectedValue(redisError);

      await controller.getMetrics(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            database: {
              status: 'connected',
              responseTime: expect.any(Number),
            },
            redis: {
              status: 'error',
              error: 'Redis connection failed',
              responseTime: null,
            },
          }),
        }),
      );
    });

    it('should handle both database and Redis errors', async () => {
      const dbError = new Error('Database error');
      const redisError = new Error('Redis error');

      mockPrisma.$queryRaw.mockRejectedValue(dbError);
      (redisClient.ping as Mock).mockRejectedValue(redisError);

      await controller.getMetrics(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            database: {
              status: 'error',
              error: 'Database error',
              responseTime: null,
            },
            redis: {
              status: 'error',
              error: 'Redis error',
              responseTime: null,
            },
          }),
        }),
      );

      expect(logger.error).toHaveBeenCalledWith('Database health check failed', expect.any(Object));
      expect(logger.error).toHaveBeenCalledWith('Redis health check failed', expect.any(Object));
    });

    it('should include system memory and CPU metrics', async () => {
      // Mock successful connections
      mockPrisma.$queryRaw.mockResolvedValue([{ result: 1 }]);
      (redisClient.ping as Mock).mockResolvedValue('PONG');

      await controller.getMetrics(mockRequest as Request, mockResponse as Response);

      const responseCall = (mockResponse.json as Mock).mock.calls[0][0];
      const metrics = responseCall.data;

      expect(metrics.memory).toEqual(
        expect.objectContaining({
          rss: expect.any(Number),
          heapTotal: expect.any(Number),
          heapUsed: expect.any(Number),
          external: expect.any(Number),
        }),
      );

      expect(metrics.cpu).toEqual(
        expect.objectContaining({
          user: expect.any(Number),
          system: expect.any(Number),
        }),
      );

      expect(metrics.uptime).toBe(86400);
      expect(metrics.environment).toEqual(expect.any(String));
      expect(metrics.version).toEqual(expect.any(String));
    });

    it('should handle getPrismaClient errors', async () => {
      (getPrismaClient as Mock).mockImplementation(() => {
        throw new Error('Failed to get Prisma client');
      });

      await controller.getMetrics(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            database: {
              status: 'error',
              error: 'Failed to get Prisma client',
              responseTime: null,
            },
          }),
        }),
      );
    });

    it('should measure response times accurately', async () => {
      const dbDelay = 100;
      const redisDelay = 50;

      // Mock database with delay
      mockPrisma.$queryRaw.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([{ result: 1 }]), dbDelay)),
      );

      // Mock Redis with delay
      (redisClient.ping as Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve('PONG'), redisDelay)),
      );

      await controller.getMetrics(mockRequest as Request, mockResponse as Response);

      const responseCall = (mockResponse.json as Mock).mock.calls[0][0];
      const metrics = responseCall.data;

      expect(metrics.database.responseTime).toBeGreaterThanOrEqual(dbDelay - 10); // Allow some variance
      expect(metrics.redis.responseTime).toBeGreaterThanOrEqual(redisDelay - 10);
    });
  });

  describe('getReadiness', () => {
    it('should return ready when all services are healthy', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ result: 1 }]);
      (redisClient.ping as Mock).mockResolvedValue('PONG');

      await controller.getReadiness(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'ready',
        timestamp: expect.any(String),
        checks: {
          database: 'healthy',
          redis: 'healthy',
        },
      });
    });

    it('should return not ready when database is unhealthy', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Database error'));
      (redisClient.ping as Mock).mockResolvedValue('PONG');

      await controller.getReadiness(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'not ready',
        timestamp: expect.any(String),
        checks: {
          database: 'unhealthy',
          redis: 'healthy',
        },
      });
    });

    it('should return not ready when Redis is unhealthy', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ result: 1 }]);
      (redisClient.ping as Mock).mockRejectedValue(new Error('Redis error'));

      await controller.getReadiness(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'not ready',
        timestamp: expect.any(String),
        checks: {
          database: 'healthy',
          redis: 'unhealthy',
        },
      });
    });

    it('should return not ready when both services are unhealthy', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Database error'));
      (redisClient.ping as Mock).mockRejectedValue(new Error('Redis error'));

      await controller.getReadiness(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'not ready',
        timestamp: expect.any(String),
        checks: {
          database: 'unhealthy',
          redis: 'unhealthy',
        },
      });
    });
  });
});
