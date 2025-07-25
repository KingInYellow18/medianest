import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthService } from '../../../dist/services/health.service';
import { mockPrisma, mockRedis } from '../../setup';

// Mock OS and filesystem modules
const mockFS = {
  readFile: vi.fn(),
  stat: vi.fn()
};

const mockOS = {
  cpus: vi.fn(),
  totalmem: vi.fn(),
  freemem: vi.fn(),
  uptime: vi.fn(),
  loadavg: vi.fn()
};

vi.mock('fs/promises', () => mockFS);
vi.mock('os', () => mockOS);

vi.mock('@/config/redis', () => ({
  redis: mockRedis
}));

vi.mock('@/db/prisma', () => ({
  prisma: mockPrisma
}));

// Mock external service clients
const mockPlexClient = {
  checkConnection: vi.fn(),
  getServerInfo: vi.fn()
};

const mockOverseerrClient = {
  getStatus: vi.fn()
};

vi.mock('@/integrations/plex/plex.client', () => ({
  plexClient: mockPlexClient
}));

vi.mock('@/integrations/overseerr/overseerr.client', () => ({
  overseerrClient: mockOverseerrClient
}));

describe('HealthService', () => {
  let healthService: HealthService;

  beforeEach(() => {
    healthService = new HealthService();
    vi.clearAllMocks();
    
    // Default OS mocks
    mockOS.cpus.mockReturnValue([{}, {}, {}, {}]); // 4 CPUs
    mockOS.totalmem.mockReturnValue(1073741824); // 1GB
    mockOS.freemem.mockReturnValue(536870912);   // 512MB
    mockOS.uptime.mockReturnValue(86400);        // 1 day
    mockOS.loadavg.mockReturnValue([1.0, 1.2, 1.5]);
  });

  describe('getDatabaseHealth', () => {
    it('should return healthy status when database is accessible', async () => {
      // Arrange
      mockPrisma.$queryRaw.mockResolvedValue([{ version: 'PostgreSQL 15.4' }]);

      // Act
      const result = await healthService.getDatabaseHealth();

      // Assert
      expect(result.status).toBe('healthy');
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.details).toEqual(
        expect.objectContaining({
          version: expect.stringContaining('PostgreSQL')
        })
      );
    });

    it('should return unhealthy status when database is inaccessible', async () => {
      // Arrange
      const dbError = new Error('Connection refused');
      mockPrisma.$queryRaw.mockRejectedValue(dbError);

      // Act
      const result = await healthService.getDatabaseHealth();

      // Assert
      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Connection refused');
      expect(result.responseTime).toBeNull();
    });

    it('should measure response time accurately', async () => {
      // Arrange
      mockPrisma.$queryRaw.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve([]), 50))
      );

      // Act
      const result = await healthService.getDatabaseHealth();

      // Assert
      expect(result.responseTime).toBeGreaterThanOrEqual(45);
      expect(result.responseTime).toBeLessThan(100);
    });
  });

  describe('getRedisHealth', () => {
    it('should return healthy status when Redis is accessible', async () => {
      // Arrange
      mockRedis.ping.mockResolvedValue('PONG');
      mockRedis.info.mockResolvedValue(
        'redis_version:7.0.12\n' +
        'used_memory_human:2.5M\n' +
        'connected_clients:5\n'
      );

      // Act
      const result = await healthService.getRedisHealth();

      // Assert
      expect(result.status).toBe('healthy');
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.details).toEqual(
        expect.objectContaining({
          version: '7.0.12',
          memory: expect.stringContaining('2.5M'),
          clients: 5
        })
      );
    });

    it('should return unhealthy status when Redis is inaccessible', async () => {
      // Arrange
      const redisError = new Error('ECONNREFUSED');
      mockRedis.ping.mockRejectedValue(redisError);

      // Act
      const result = await healthService.getRedisHealth();

      // Assert
      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('ECONNREFUSED');
      expect(result.responseTime).toBeNull();
    });

    it('should handle Redis timeout gracefully', async () => {
      // Arrange
      mockRedis.ping.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 5000)
        )
      );

      // Act
      const result = await healthService.getRedisHealth();

      // Assert
      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Timeout');
    });
  });

  describe('getSystemMetrics', () => {
    it('should return comprehensive system metrics', async () => {
      // Arrange - OS mocks are already set in beforeEach

      // Act
      const result = await healthService.getSystemMetrics();

      // Assert
      expect(result).toEqual({
        memory: {
          total: 1073741824,
          used: 536870912,
          free: 536870912,
          percentage: 50
        },
        cpu: {
          cores: 4,
          usage: expect.any(Number),
          loadAverage: [1.0, 1.2, 1.5]
        },
        uptime: 86400,
        nodeVersion: expect.stringMatching(/\d+\.\d+\.\d+/),
        platform: expect.any(String),
        arch: expect.any(String)
      });
    });

    it('should calculate memory percentage correctly', async () => {
      // Arrange
      mockOS.totalmem.mockReturnValue(1000);
      mockOS.freemem.mockReturnValue(250);

      // Act
      const result = await healthService.getSystemMetrics();

      // Assert
      expect(result.memory.percentage).toBe(75); // (1000-250)/1000 * 100
    });

    it('should handle system metric errors gracefully', async () => {
      // Arrange
      mockOS.totalmem.mockImplementation(() => {
        throw new Error('System error');
      });

      // Act
      const result = await healthService.getSystemMetrics();

      // Assert
      expect(result.memory).toEqual({
        total: 0,
        used: 0,
        free: 0,
        percentage: 0,
        error: 'System error'
      });
    });
  });

  describe('getExternalServicesHealth', () => {
    it('should check all external services', async () => {
      // Arrange
      mockPlexClient.checkConnection.mockResolvedValue({
        status: 'online',
        version: '1.40.0.7998'
      });
      
      mockOverseerrClient.getStatus.mockResolvedValue({
        version: '1.33.2',
        status: 'OK'
      });

      // Act
      const result = await healthService.getExternalServicesHealth();

      // Assert
      expect(result.plex).toEqual(
        expect.objectContaining({
          status: 'healthy',
          version: '1.40.0.7998'
        })
      );
      
      expect(result.overseerr).toEqual(
        expect.objectContaining({
          status: 'healthy',
          version: '1.33.2'
        })
      );
    });

    it('should handle external service failures', async () => {
      // Arrange
      mockPlexClient.checkConnection.mockRejectedValue(new Error('Connection timeout'));
      mockOverseerrClient.getStatus.mockRejectedValue(new Error('Service unavailable'));

      // Act
      const result = await healthService.getExternalServicesHealth();

      // Assert
      expect(result.plex).toEqual(
        expect.objectContaining({
          status: 'unhealthy',
          error: 'Connection timeout'
        })
      );
      
      expect(result.overseerr).toEqual(
        expect.objectContaining({
          status: 'unhealthy',
          error: 'Service unavailable'
        })
      );
    });

    it('should measure response times for external services', async () => {
      // Arrange
      mockPlexClient.checkConnection.mockImplementation(() =>
        new Promise(resolve =>
          setTimeout(() => resolve({ status: 'online' }), 100)
        )
      );

      // Act
      const result = await healthService.getExternalServicesHealth();

      // Assert
      expect(result.plex.responseTime).toBeGreaterThanOrEqual(95);
      expect(result.plex.responseTime).toBeLessThan(150);
    });
  });

  describe('getOverallHealth', () => {
    it('should return healthy when all services are healthy', async () => {
      // Arrange
      vi.spyOn(healthService, 'getDatabaseHealth').mockResolvedValue({
        status: 'healthy',
        responseTime: 10
      });
      
      vi.spyOn(healthService, 'getRedisHealth').mockResolvedValue({
        status: 'healthy',
        responseTime: 5
      });
      
      vi.spyOn(healthService, 'getExternalServicesHealth').mockResolvedValue({
        plex: { status: 'healthy', responseTime: 50 },
        overseerr: { status: 'healthy', responseTime: 30 }
      });

      // Act
      const result = await healthService.getOverallHealth();

      // Assert
      expect(result.status).toBe('healthy');
      expect(result.services.database.status).toBe('healthy');
      expect(result.services.redis.status).toBe('healthy');
      expect(result.services.plex.status).toBe('healthy');
    });

    it('should return degraded when non-critical services are unhealthy', async () => {
      // Arrange
      vi.spyOn(healthService, 'getDatabaseHealth').mockResolvedValue({
        status: 'healthy',
        responseTime: 10
      });
      
      vi.spyOn(healthService, 'getRedisHealth').mockResolvedValue({
        status: 'healthy',
        responseTime: 5
      });
      
      vi.spyOn(healthService, 'getExternalServicesHealth').mockResolvedValue({
        plex: { status: 'unhealthy', error: 'Connection failed' },
        overseerr: { status: 'healthy', responseTime: 30 }
      });

      // Act
      const result = await healthService.getOverallHealth();

      // Assert
      expect(result.status).toBe('degraded');
      expect(result.services.database.status).toBe('healthy');
      expect(result.services.redis.status).toBe('healthy');
      expect(result.services.plex.status).toBe('unhealthy');
    });

    it('should return unhealthy when critical services are down', async () => {
      // Arrange
      vi.spyOn(healthService, 'getDatabaseHealth').mockResolvedValue({
        status: 'unhealthy',
        error: 'Connection refused'
      });
      
      vi.spyOn(healthService, 'getRedisHealth').mockResolvedValue({
        status: 'healthy',
        responseTime: 5
      });

      // Act
      const result = await healthService.getOverallHealth();

      // Assert
      expect(result.status).toBe('unhealthy');
      expect(result.services.database.status).toBe('unhealthy');
    });

    it('should include system metrics in overall health', async () => {
      // Arrange
      const mockSystemMetrics = {
        memory: { total: 1000, used: 500, free: 500, percentage: 50 },
        cpu: { cores: 4, usage: 25, loadAverage: [1.0, 1.1, 1.2] },
        uptime: 3600
      };
      
      vi.spyOn(healthService, 'getSystemMetrics').mockResolvedValue(mockSystemMetrics);

      // Act
      const result = await healthService.getOverallHealth();

      // Assert
      expect(result.system).toEqual(mockSystemMetrics);
    });
  });

  describe('performHealthCheck', () => {
    it('should perform comprehensive health check with detailed information', async () => {
      // Arrange
      vi.spyOn(healthService, 'getDatabaseHealth').mockResolvedValue({
        status: 'healthy',
        responseTime: 15,
        details: { connectionPool: { active: 5, idle: 15 } }
      });

      // Act
      const result = await healthService.performHealthCheck();

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          overall: expect.any(String),
          timestamp: expect.any(String),
          checks: expect.objectContaining({
            database: expect.objectContaining({
              status: 'healthy',
              details: expect.any(Object)
            })
          })
        })
      );
    });

    it('should identify critical service failures', async () => {
      // Arrange
      vi.spyOn(healthService, 'getDatabaseHealth').mockResolvedValue({
        status: 'unhealthy',
        error: 'Connection failed'
      });

      // Act
      const result = await healthService.performHealthCheck();

      // Assert
      expect(result.overall).toBe('unhealthy');
      expect(result.critical).toBe(false);
      expect(result.issues).toContain('database: Connection failed');
    });
  });
});