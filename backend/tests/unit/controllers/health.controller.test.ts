import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { HealthController } from '../../../dist/controllers/health.controller';
import { createMockRequest, createMockResponse, createMockNext } from '../../setup';
import { createHealthCheckMocks } from '../../setup';

// Mock health service
const mockHealthService = {
  getOverallHealth: vi.fn(),
  getDatabaseHealth: vi.fn(),
  getRedisHealth: vi.fn(),
  getExternalServicesHealth: vi.fn(),
  getSystemMetrics: vi.fn(),
  performHealthCheck: vi.fn()
};

vi.mock('@/services/health.service', () => ({
  healthService: mockHealthService
}));

describe('HealthController', () => {
  let healthController: HealthController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    healthController = new HealthController();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
    
    vi.clearAllMocks();
  });

  describe('getHealth', () => {
    it('should return overall health status when all services are healthy', async () => {
      // Arrange
      mockHealthService.getOverallHealth.mockResolvedValue({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: 3600,
        version: '1.0.0',
        services: {
          database: { status: 'healthy', responseTime: 10 },
          redis: { status: 'healthy', responseTime: 5 },
          plex: { status: 'healthy', responseTime: 50 }
        },
        system: {
          memory: { used: 256, total: 1024, percentage: 25 },
          cpu: { usage: 15 },
          disk: { used: 10, total: 100, percentage: 10 }
        }
      });

      // Act
      await healthController.getHealth(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          status: 'healthy',
          services: expect.objectContaining({
            database: expect.objectContaining({ status: 'healthy' }),
            redis: expect.objectContaining({ status: 'healthy' }),
            plex: expect.objectContaining({ status: 'healthy' })
          }),
          system: expect.any(Object)
        })
      });
    });

    it('should return degraded status when some services are unhealthy', async () => {
      // Arrange
      mockHealthService.getOverallHealth.mockResolvedValue({
        status: 'degraded',
        timestamp: new Date().toISOString(),
        uptime: 3600,
        version: '1.0.0',
        services: {
          database: { status: 'healthy', responseTime: 10 },
          redis: { status: 'healthy', responseTime: 5 },
          plex: { status: 'unhealthy', responseTime: null, error: 'Connection timeout' }
        },
        system: {
          memory: { used: 512, total: 1024, percentage: 50 },
          cpu: { usage: 75 },
          disk: { used: 80, total: 100, percentage: 80 }
        }
      });

      // Act
      await healthController.getHealth(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          status: 'degraded',
          services: expect.objectContaining({
            plex: expect.objectContaining({
              status: 'unhealthy',
              error: 'Connection timeout'
            })
          })
        })
      });
    });

    it('should handle health service errors', async () => {
      // Arrange
      mockHealthService.getOverallHealth.mockRejectedValue(new Error('Health service unavailable'));

      // Act
      await healthController.getHealth(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Health service unavailable'),
          statusCode: 500
        })
      );
    });
  });

  describe('getDetailedHealth', () => {
    it('should return detailed health information', async () => {
      // Arrange
      const mockHealthChecks = createHealthCheckMocks();
      mockHealthService.performHealthCheck.mockResolvedValue({
        overall: 'healthy',
        checks: {
          database: {
            status: 'healthy',
            responseTime: 10,
            details: {
              connectionPool: { active: 5, idle: 15, total: 20 },
              lastQuery: new Date().toISOString()
            }
          },
          redis: {
            status: 'healthy',
            responseTime: 5,
            details: {
              memory: { used: '2MB', peak: '5MB' },
              connectedClients: 10
            }
          },
          externalServices: {
            plex: {
              status: 'healthy',
              responseTime: 50,
              version: '1.40.0.7998'
            },
            overseerr: {
              status: 'healthy',
              responseTime: 30,
              version: '1.33.2'
            }
          }
        }
      });

      // Act
      await healthController.getDetailedHealth(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          overall: 'healthy',
          checks: expect.objectContaining({
            database: expect.objectContaining({
              status: 'healthy',
              details: expect.any(Object)
            }),
            redis: expect.objectContaining({
              status: 'healthy',
              details: expect.any(Object)
            }),
            externalServices: expect.any(Object)
          })
        })
      });
    });

    it('should include system metrics in detailed health', async () => {
      // Arrange
      mockHealthService.getSystemMetrics.mockResolvedValue({
        memory: {
          total: 1073741824, // 1GB
          used: 536870912,   // 512MB
          free: 536870912,   // 512MB
          percentage: 50
        },
        cpu: {
          usage: 25.5,
          cores: 4,
          loadAverage: [1.2, 1.5, 1.8]
        },
        disk: {
          total: 107374182400, // 100GB
          used: 53687091200,   // 50GB
          free: 53687091200,   // 50GB
          percentage: 50
        },
        uptime: 86400, // 1 day
        nodeVersion: '20.0.0'
      });

      mockHealthService.performHealthCheck.mockResolvedValue({
        overall: 'healthy',
        checks: {},
        system: await mockHealthService.getSystemMetrics()
      });

      // Act
      await healthController.getDetailedHealth(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockHealthService.getSystemMetrics).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          system: expect.objectContaining({
            memory: expect.objectContaining({ percentage: 50 }),
            cpu: expect.objectContaining({ usage: 25.5 }),
            disk: expect.objectContaining({ percentage: 50 })
          })
        })
      });
    });
  });

  describe('getDatabaseHealth', () => {
    it('should return database health status', async () => {
      // Arrange
      mockHealthService.getDatabaseHealth.mockResolvedValue({
        status: 'healthy',
        responseTime: 15,
        connectionPool: {
          active: 3,
          idle: 17,
          total: 20,
          waiting: 0
        },
        lastQuery: new Date().toISOString(),
        version: 'PostgreSQL 15.4'
      });

      // Act
      await healthController.getDatabaseHealth(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          status: 'healthy',
          responseTime: 15,
          connectionPool: expect.any(Object),
          version: 'PostgreSQL 15.4'
        })
      });
    });

    it('should handle database connection errors', async () => {
      // Arrange
      mockHealthService.getDatabaseHealth.mockResolvedValue({
        status: 'unhealthy',
        responseTime: null,
        error: 'Connection refused',
        lastAttempt: new Date().toISOString(),
        retryCount: 3
      });

      // Act
      await healthController.getDatabaseHealth(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          status: 'unhealthy',
          error: 'Connection refused',
          retryCount: 3
        })
      });
    });
  });

  describe('getRedisHealth', () => {
    it('should return Redis health status', async () => {
      // Arrange
      mockHealthService.getRedisHealth.mockResolvedValue({
        status: 'healthy',
        responseTime: 3,
        memory: {
          used: '2.5MB',
          peak: '10MB',
          fragmentation: 1.2
        },
        clients: {
          connected: 8,
          blocked: 0
        },
        keyspace: {
          db0: { keys: 150, expires: 25 }
        },
        version: '7.0.12'
      });

      // Act
      await healthController.getRedisHealth(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          status: 'healthy',
          responseTime: 3,
          memory: expect.any(Object),
          clients: expect.any(Object),
          version: '7.0.12'
        })
      });
    });

    it('should handle Redis connection issues', async () => {
      // Arrange
      mockHealthService.getRedisHealth.mockResolvedValue({
        status: 'unhealthy',
        responseTime: null,
        error: 'ECONNREFUSED',
        lastPing: new Date().toISOString(),
        connectionAttempts: 5
      });

      // Act
      await healthController.getRedisHealth(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          status: 'unhealthy',
          error: 'ECONNREFUSED',
          connectionAttempts: 5
        })
      });
    });
  });

  describe('liveness probe', () => {
    it('should return 200 for liveness probe', async () => {
      // Act
      await healthController.liveness(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'alive',
        timestamp: expect.any(String)
      });
    });
  });

  describe('readiness probe', () => {
    it('should return 200 when all critical services are ready', async () => {
      // Arrange
      mockHealthService.performHealthCheck.mockResolvedValue({
        overall: 'healthy',
        critical: true,
        checks: {
          database: { status: 'healthy' },
          redis: { status: 'healthy' }
        }
      });

      // Act
      await healthController.readiness(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'ready',
        timestamp: expect.any(String)
      });
    });

    it('should return 503 when critical services are not ready', async () => {
      // Arrange
      mockHealthService.performHealthCheck.mockResolvedValue({
        overall: 'unhealthy',
        critical: false,
        checks: {
          database: { status: 'unhealthy' },
          redis: { status: 'healthy' }
        }
      });

      // Act
      await healthController.readiness(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'not ready',
        timestamp: expect.any(String),
        issues: expect.any(Array)
      });
    });
  });
});